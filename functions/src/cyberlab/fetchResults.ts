/**
 * `fetchResults` — secure bridge between an authenticated patient and the lab's
 * CyberLab results server. See docs/integrations/cyberlab-results-api.md §9.
 *
 * The app is only a viewer OF RESULTS: they are fetched on demand and returned to
 * the client, never written to Firestore and never logged.
 *
 * The ONE thing this bridge does persist is a usage stamp on the caller's own
 * profile (`users/{uid}.lastResultsAt`) — a date, never a result and never a
 * medical value. It powers the admin dashboard's "suivi d'utilisation" (which
 * accounts are actually used, which are dormant and should be relanced) and is
 * declared in the privacy policy. See docs/pages/admin.md.
 *
 * Security notes:
 * - `type` and `requester_id` are read exclusively from the caller's Firestore
 *   profile — never from client input — so a patient cannot spoof another
 *   identity or a `medecin`/`correspondant` scope.
 * - Secrets come from Secret Manager (`defineSecret`); the API base URL from an
 *   env param (`defineString`). Nothing sensitive is hard-coded.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {
  callCyberlab,
  CyberlabConfig,
  CyberlabError,
  CyberlabRequest,
  CyberlabResponse,
  IncludePdf,
  normalizeRequesterId,
} from "./client";
import {authorizedIdentities, resolveIdentity} from "./identities";
import {
  alertRecipients,
  fmtCasablanca,
  renderAlertEmail,
  sendMail,
  SMTP_PASS,
  SMTP_USER,
} from "../email/mailer";

const CYBERLAB_API_KEY = defineSecret("CYBERLAB_API_KEY");
const CYBERLAB_HMAC_SECRET = defineSecret("CYBERLAB_HMAC_SECRET");
const CYBERLAB_API_URL = defineString("CYBERLAB_API_URL");

const MAX_RESULTS = 50;

/**
 * Don't re-stamp usage more often than this. The patient's results are prefetched
 * on EVERY app launch, so without a throttle we'd write on each one; the dashboard
 * only needs day-level freshness. The profile snapshot is already loaded when we
 * check, so the throttle costs no extra read.
 */
const USAGE_THROTTLE_MS = 6 * 60 * 60 * 1000; // 6 h

/** Today as YYYY-MM-DD (UTC) — the id of the anonymous daily counter doc. */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Best-effort "this account was used" stamp, for the admin dashboard.
 *
 * Records, on the caller's OWN profile, only usage metadata:
 *  - `lastResultsAt`   — when they last consulted
 *  - `firstResultsAt`  — the very first time (set once; measures the delay between
 *                        access activation and first real use)
 *  - `resultsViewCount`— how many sessions (throttled, so it counts sessions, not calls)
 * …and bumps a fully ANONYMOUS daily counter (`usageDaily/{YYYY-MM-DD}.consultations`)
 * that powers the weekly-activity chart and is linked to nobody.
 *
 * Never a result, never a value, never which dossier was opened.
 * Never throws: usage tracking must not be able to break a patient's results.
 */
async function touchLastResultsAt(
  uid: string,
  current: unknown,
  hasFirst: boolean
): Promise<void> {
  try {
    const ts = current as admin.firestore.Timestamp | undefined;
    const lastMs = ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
    if (Date.now() - lastMs < USAGE_THROTTLE_MS) return;

    const now = admin.firestore.FieldValue.serverTimestamp();
    const profile: Record<string, unknown> = {
      lastResultsAt: now,
      resultsViewCount: admin.firestore.FieldValue.increment(1),
    };
    // Set once and never again — it is the "first ever use" marker.
    if (!hasFirst) profile.firstResultsAt = now;

    await Promise.all([
      admin.firestore().doc(`users/${uid}`).set(profile, { merge: true }),
      admin
        .firestore()
        .doc(`usageDaily/${todayKey()}`)
        .set(
          { consultations: admin.firestore.FieldValue.increment(1) },
          { merge: true }
        ),
    ]);
  } catch {
    /* best-effort only — never fail the results fetch over a usage stamp */
  }
}

/**
 * A patient consulted a RELATIVE's dossier (ayant droit), not their own.
 *
 * Deliberately NOT stamped on the profile. `touchLastResultsAt` throttles on the
 * value it READ at the start of the call, so a self prefetch and an immediate
 * switch to a relative both read the same stale `lastResultsAt` and both write —
 * inflating `resultsViewCount`, which the admin dashboard buckets into frequency
 * bands (once / 2-5 / 6-15 / 16+). "One stamp per session" was an invariant of
 * the single-identity design; preserving it is cheaper than hardening it.
 *
 * What we keep instead is a fully anonymous daily tally, linked to nobody, so the
 * lab can answer "is the feature actually used?" — which they will ask, having
 * paid for it. Never throws.
 */
async function bumpProxyConsultation(): Promise<void> {
  try {
    await admin
      .firestore()
      .doc(`usageDaily/${todayKey()}`)
      .set(
        {proxyConsultations: admin.firestore.FieldValue.increment(1)},
        {merge: true}
      );
  } catch {
    /* best-effort only */
  }
}

/** Don't email the staff about impacted patients more than once per window. */
const IMPACT_ALERT_DEDUP_MS = 30 * 60 * 1000; // 30 min

/**
 * A REAL patient just hit the results-server outage. Best-effort (mirrors
 * `touchLastResultsAt`: whole body try/catch, never breaks the error mapping):
 *  - bump `systemStatus/cyberlab.patientsImpacted` (recovery email + `outages`
 *    history report it);
 *  - at most once per 30 min, email the lab staff "un patient est bloqué" —
 *    an early warning that can beat the 5-min monitor, and proof the outage
 *    hurts real users. The email carries NO identity — "un patient" only.
 * Only upstream-outage kinds count (network / 5xx incl. Cloudflare 522-523);
 * 404/429/401 are not outages from the patient's side.
 */
async function recordPatientImpact(err: CyberlabError): Promise<void> {
  try {
    const isOutage =
      err.kind === "network" ||
      (err.kind === "server" && (err.status === undefined || err.status >= 500));
    if (!isOutage) return;

    const db = admin.firestore();
    const ref = db.doc("systemStatus/cyberlab");
    const now = admin.firestore.Timestamp.now();

    // Transaction so two simultaneous patient failures can't both claim the
    // 30-min alert slot.
    const shouldAlert = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const last = snap.data()?.lastPatientAlertAt as
        | admin.firestore.Timestamp
        | undefined;
      const lastMs = last && typeof last.toMillis === "function" ? last.toMillis() : 0;
      const claim = now.toMillis() - lastMs >= IMPACT_ALERT_DEDUP_MS;
      tx.set(
        ref,
        {
          patientsImpacted: admin.firestore.FieldValue.increment(1),
          lastPatientImpactAt: now,
          ...(claim ? { lastPatientAlertAt: now } : {}),
        },
        { merge: true }
      );
      return claim;
    });

    if (shouldAlert) {
      const html = renderAlertEmail({
        title: "Un patient est bloqué par la panne des résultats",
        lead:
          "Un patient vient d'essayer de consulter ses résultats dans l'application, " +
          "mais le serveur de résultats du laboratoire n'a pas répondu.",
        rows: [
          ["Heure", `${fmtCasablanca(now.toMillis())} (heure du Maroc)`],
          [
            "Détail technique",
            `${err.kind}${err.status ? ` (code ${err.status})` : ""}`,
          ],
        ],
        todo:
          "La supervision automatique (test toutes les 5 minutes) confirmera la panne et " +
          "vous préviendra du rétablissement. Cette alerte est limitée à une par 30 minutes.",
        footer: "Aucune information sur l'identité du patient n'est transmise.",
      });
      // Cap the extra latency this adds to an already-failing request.
      await Promise.race([
        sendMail({
          to: alertRecipients(),
          subject: "[Labo El Allali] Un patient est bloqué par la panne des résultats",
          html,
        }),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    }
  } catch {
    /* best-effort only — never fail the results fetch over an alert */
  }
}

/**
 * Thrown when the caller's profile can't be turned into a valid request.
 *
 * `not_authorized` is deliberately distinct from `no_requester`: the client must
 * be able to tell "this account never had access" (→ show the activation card)
 * from "the dossier you asked for is not, or no longer, yours" (→ fall back to
 * the primary identity and say so). Merging them would strand a patient on an
 * activation screen because a relative's link was revoked.
 */
type ProfileErrorReason = "no_profile" | "no_requester" | "not_authorized";

class ProfileError extends Error {
  readonly reason: ProfileErrorReason;
  constructor(reason: ProfileErrorReason) {
    super(reason);
    this.name = "ProfileError";
    this.reason = reason;
  }
}

/**
 * Client-controllable options.
 * - include_pdf: "latest" | "none" | "all" (perf: which PDFs to embed)
 * - dossier_id: fetch a single dossier's PDF on demand
 * - requester_id: WHICH of the caller's authorized identities to read
 *
 * `requester_id` is a **selector, never a value**. It is matched against the list
 * built from the caller's own Firestore profile (`./identities`) and is never
 * passed through to the lab server as-is — which preserves, unchanged, the
 * anti-spoof property the single-identity version had for free.
 */
export interface FetchOptions {
  include_pdf?: IncludePdf;
  dossier_id?: string;
  requester_id?: string;
}

/**
 * Core logic, decoupled from the callable/auth plumbing so it can be exercised
 * directly by the local test script.
 */
export async function fetchResultsForUser(
  uid: string,
  cfg: CyberlabConfig,
  opts: FetchOptions = {}
): Promise<CyberlabResponse> {
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  if (!snap.exists) {
    throw new ProfileError("no_profile");
  }

  const data = snap.data() ?? {};

  // Which identity to read: the caller's own dossier, or one of the relatives'
  // dossiers the lab attached to this account. Ids are normalized on BOTH sides
  // inside `resolveIdentity` — a profile saved before the whitespace fix may
  // still hold "67 305", which the lab server 404s.
  const identity = resolveIdentity(data, opts.requester_id);
  if (!identity) {
    // Asked for a specific dossier and did not get it → it is not (or no longer)
    // theirs. Asked for nothing and got nothing → the account has no access yet.
    throw new ProfileError(
      opts.requester_id && authorizedIdentities(data).length > 0 ?
        "not_authorized" :
        "no_requester"
    );
  }

  const req: CyberlabRequest = {
    type: identity.type,
    requester_id: identity.requester_id,
  };
  if (opts.dossier_id) {
    // Single-dossier on-demand fetch: no list needed.
    req.dossier_id = opts.dossier_id;
  } else {
    req.max_results = MAX_RESULTS;
    if (opts.include_pdf) req.include_pdf = opts.include_pdf;
  }

  const resp = await callCyberlab(cfg, req);

  // Stamp usage on the LIST fetch only — that's the one that runs when the patient
  // opens the app, so it marks "this account is used". Per-PDF fetches would just
  // re-stamp the same session. Awaited (not floating) so it can't be dropped when
  // the function instance freezes; the 6 h throttle makes it a no-op most times.
  //
  // A relative's dossier never stamps the profile — see `bumpProxyConsultation`.
  if (!opts.dossier_id) {
    if (identity.isSelf) {
      await touchLastResultsAt(uid, data.lastResultsAt, Boolean(data.firstResultsAt));
    } else {
      await bumpProxyConsultation();
    }
  }

  return resp;
}

/** Parse the (untrusted) callable payload into validated options. */
function parseOptions(data: unknown): FetchOptions {
  const d = (data ?? {}) as {
    include_pdf?: unknown;
    dossier_id?: unknown;
    requester_id?: unknown;
  };
  const opts: FetchOptions = {};
  if (d.include_pdf === "latest" || d.include_pdf === "none" || d.include_pdf === "all") {
    opts.include_pdf = d.include_pdf;
  }
  if (typeof d.dossier_id === "string" && d.dossier_id.trim() !== "") {
    opts.dossier_id = d.dossier_id.trim();
  }
  // Normalized at the boundary so the authorization comparison downstream is
  // between two canonical forms, never between a raw client string and a
  // cleaned-up stored one.
  if (d.requester_id !== undefined) {
    const id = normalizeRequesterId(d.requester_id);
    if (id !== "") opts.requester_id = id;
  }
  return opts;
}

/**
 * Callable entry point. Returns the lab API payload verbatim; maps every failure
 * to a generic HttpsError so no technical detail leaks to the client.
 */
export const fetchResults = onCall(
  {
    region: "europe-southwest1",
    // SMTP_* power the best-effort "un patient est bloqué" alert; if they hold
    // placeholders the mailer degrades to log-only and results are unaffected.
    secrets: [CYBERLAB_API_KEY, CYBERLAB_HMAC_SECRET, SMTP_USER, SMTP_PASS],
  },
  async (request: CallableRequest): Promise<CyberlabResponse> => {
    // Medical data must never be cached by any intermediary or the browser.
    try {
      request.rawRequest.res?.setHeader("Cache-Control", "no-store");
    } catch {
      /* best-effort only */
    }

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const uid = request.auth.uid;
    const opts = parseOptions(request.data);

    const cfg: CyberlabConfig = {
      apiUrl: CYBERLAB_API_URL.value(),
      apiKey: CYBERLAB_API_KEY.value(),
      hmacSecret: CYBERLAB_HMAC_SECRET.value(),
    };

    try {
      return await fetchResultsForUser(uid, cfg, opts);
    } catch (err) {
      if (err instanceof ProfileError) {
        // Only the reason is logged — NEVER the requested id, which would be
        // another patient's lab dossier number.
        logger.warn("fetchResults: profile not usable", { reason: err.reason });
        if (err.reason === "not_authorized") {
          // An unknown id and an id belonging to someone else produce exactly the
          // same answer, so this cannot be used to enumerate dossier numbers.
          throw new HttpsError(
            "permission-denied",
            "Vous n'avez pas accès à ce dossier."
          );
        }
        throw new HttpsError(
          "failed-precondition",
          "Profil patient incomplet. Contactez le laboratoire."
        );
      }
      if (err instanceof CyberlabError) {
        // Log the kind/status only — never the response body.
        logger.error("fetchResults: lab API error", {
          kind: err.kind,
          status: err.status ?? null,
        });
        // Outage telemetry + rate-limited staff alert (best-effort, never throws).
        await recordPatientImpact(err);
        switch (err.kind) {
          case "not_found":
            throw new HttpsError("not-found", "Aucun résultat disponible.");
          case "rate_limited":
            throw new HttpsError(
              "resource-exhausted",
              "Trop de requêtes. Réessayez dans quelques instants."
            );
          case "network":
            throw new HttpsError(
              "unavailable",
              "Service de résultats momentanément indisponible."
            );
          // "unauthorized" (our key/signature) and "server" are our problem, not
          // the patient's — surface a neutral message.
          default:
            throw new HttpsError(
              "internal",
              "Impossible de récupérer les résultats pour le moment."
            );
        }
      }
      logger.error("fetchResults: unexpected error");
      throw new HttpsError("internal", "Une erreur inattendue est survenue.");
    }
  }
);
