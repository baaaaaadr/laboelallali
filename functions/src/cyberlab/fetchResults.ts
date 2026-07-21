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
  RequesterType,
} from "./client";

const CYBERLAB_API_KEY = defineSecret("CYBERLAB_API_KEY");
const CYBERLAB_HMAC_SECRET = defineSecret("CYBERLAB_HMAC_SECRET");
const CYBERLAB_API_URL = defineString("CYBERLAB_API_URL");

const MAX_RESULTS = 50;
const VALID_TYPES: readonly RequesterType[] = [
  "patient",
  "medecin",
  "correspondant",
];

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

/** Thrown when the caller's profile can't be turned into a valid request. */
class ProfileError extends Error {
  readonly reason: "no_profile" | "no_requester";
  constructor(reason: "no_profile" | "no_requester") {
    super(reason);
    this.name = "ProfileError";
    this.reason = reason;
  }
}

/**
 * Client-controllable options (safe to accept: they only tune what the caller
 * gets for *their own* requester_id — identity stays server-side from Firestore).
 * - include_pdf: "latest" | "none" | "all" (perf: which PDFs to embed)
 * - dossier_id: fetch a single dossier's PDF on demand
 */
export interface FetchOptions {
  include_pdf?: IncludePdf;
  dossier_id?: string;
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
  // Normalized on read as well as on write: a profile saved before the fix may
  // still hold a space-separated id ("67 305"), which the lab server 404s.
  const requesterId = normalizeRequesterId(data.requester_id);
  const type = data.type;

  if (
    requesterId === "" ||
    typeof type !== "string" ||
    !VALID_TYPES.includes(type as RequesterType)
  ) {
    throw new ProfileError("no_requester");
  }

  const req: CyberlabRequest = {
    type: type as RequesterType,
    requester_id: requesterId,
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
  if (!opts.dossier_id) {
    await touchLastResultsAt(uid, data.lastResultsAt, Boolean(data.firstResultsAt));
  }

  return resp;
}

/** Parse the (untrusted) callable payload into validated options. */
function parseOptions(data: unknown): FetchOptions {
  const d = (data ?? {}) as { include_pdf?: unknown; dossier_id?: unknown };
  const opts: FetchOptions = {};
  if (d.include_pdf === "latest" || d.include_pdf === "none" || d.include_pdf === "all") {
    opts.include_pdf = d.include_pdf;
  }
  if (typeof d.dossier_id === "string" && d.dossier_id.trim() !== "") {
    opts.dossier_id = d.dossier_id.trim();
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
    secrets: [CYBERLAB_API_KEY, CYBERLAB_HMAC_SECRET],
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
        logger.warn("fetchResults: profile not usable", { reason: err.reason });
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
