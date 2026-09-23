/**
 * `adminSetPractitioner` — give (or remove) an account's PRACTITIONER access:
 * a prescribing doctor's code, which opens in the app ("Mes patients") the
 * named results of the dossiers HE prescribed. See docs/pages/mes-patients.md.
 *
 * Why it is its own callable, separate from `adminSetRequester`:
 *  - a doctor is usually ALSO a patient of the lab, with relatives attached. His
 *    patient identity must stay untouched — the practitioner access lives in a
 *    separate field (`users/{uid}.practitioner`) that is never the default
 *    identity (see `practitionerIdentity` in ../cyberlab/identities.ts);
 *  - it is ADMIN level, not staff: a code opens a whole roster of named results.
 *
 * Safety nets, in the order they run:
 *  1. The code is verified against the lab server BEFORE anything is written —
 *     counts only (dossiers, distinct patients), never a name. A code the lab
 *     does not know yet (404: no dossier sent since the doctor's activation in
 *     Qalam) needs an explicit `allowUnknown`.
 *  2. A code equal to one of the account's PATIENT ids is refused: the server
 *     would resolve the patient side first and the doctor would see nothing.
 *  3. A code already held by another account (the doctor's secretary, a second
 *     device account) needs an explicit `allowShared` — the owner's decision of
 *     23/09/2026: "allowed case by case, the lab validates".
 *  4. `dryRun` performs 1–3 and writes NOTHING: it is what the admin card's
 *     « Vérifier » button calls, so the operator sees the counts before acting.
 *
 * What is never logged: the code, the label, any name. Only the target uid and
 * the acting staff uid, like every other admin callable.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { LEVEL, requireLevel, REGION } from "./roles";
import { callCyberlab, CyberlabError, normalizeRequesterId, RequesterType } from "../cyberlab/client";
import {
  normalizePractitionerId,
  PRACTITIONER_TYPES,
  practitionerIdentity,
} from "../cyberlab/identities";
import {
  APP_URL,
  renderAlertEmail,
  sendMail,
  SMTP_PASS,
  SMTP_USER,
} from "../email/mailer";

// Same secret/param names as fetchResults — defineSecret is idempotent by name.
const CYBERLAB_API_KEY = defineSecret("CYBERLAB_API_KEY");
const CYBERLAB_HMAC_SECRET = defineSecret("CYBERLAB_HMAC_SECRET");
const CYBERLAB_API_URL = defineString("CYBERLAB_API_URL");

/**
 * Qalam prescriber codes are short capitals ("MOUSTZOU"). Letters, digits and a
 * few separators, 2 to 32 characters — anything else is a typo, and a typo here
 * would silently activate nobody (or somebody else).
 */
const CODE_RE = /^[A-Z0-9][A-Z0-9._-]{1,31}$/;
const MIN_LABEL = 3;
const MAX_LABEL = 60;
/** Other accounts listed when a code is shared — plenty for an audit line. */
const SHARED_LIMIT = 10;

/** The practitioner access as the admin screen sees it (timestamps in ms). */
export interface PractitionerDTO {
  requester_id: string;
  type: string;
  label: string;
  linkedAt: number | null;
  lastUsedAt: number | null;
}

function toMs(v: unknown): number | null {
  const ts = v as admin.firestore.Timestamp | undefined;
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
}

/**
 * Read `users/{uid}.practitioner` for the admin screen. `null` unless it is a
 * VALID access — the same test `fetchResults` applies, so the screen can never
 * show an access the server would not honour.
 * @param {FirebaseFirestore.DocumentData|undefined} data the user document.
 * @return {PractitionerDTO|null} the access, or null.
 */
export function readPractitionerDTO(
  data: FirebaseFirestore.DocumentData | undefined
): PractitionerDTO | null {
  if (!data) return null;
  const identity = practitionerIdentity(data);
  if (!identity) return null;
  const raw = (data.practitioner || {}) as Record<string, unknown>;
  return {
    requester_id: identity.requester_id,
    type: identity.type,
    label: typeof raw.label === "string" ? raw.label : "",
    linkedAt: toMs(raw.linkedAt),
    lastUsedAt: toMs(raw.lastUsedAt),
  };
}

/**
 * Same key as the client's `patientKey` (src/lib/practitioner/patients.ts):
 * accents off, upper case, punctuation as spaces, spaces collapsed.
 * @param {unknown} nom family name as the lab returned it.
 * @param {unknown} prenom first name as the lab returned it.
 * @return {string} the grouping key.
 */
export function patientKey(nom: unknown, prenom: unknown): string {
  const norm = (s: unknown) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
  return `${norm(nom)}|${norm(prenom)}`;
}

export interface SetPractitionerData {
  uid?: string;
  requester_id?: string;
  type?: string;
  label?: string;
  /** Remove the access. */
  clear?: boolean;
  /** Verify and audit only — write nothing. */
  dryRun?: boolean;
  /** Activate even though the lab server does not know the code yet (404). */
  allowUnknown?: boolean;
  /** Activate even though another account already holds this code. */
  allowShared?: boolean;
}

export type ProbeStatus = "ok" | "unknown" | "error";

export interface Probe {
  status: ProbeStatus;
  dossierCount: number;
  patientCount: number;
}

export interface SharedAccount {
  uid: string;
  fullName: string;
  email: string | null;
}

// ── Pure decision rules (Firebase-free, unit-tested by
//    functions/scripts/test-practitioner-admin.js) ────────────────────────────

/** A validated activation request. */
export interface PractitionerInput {
  code: string;
  type: RequesterType;
  label: string;
}

/**
 * Validate and normalise what the admin typed. Throws the French message the
 * admin screen displays as is.
 * @param {SetPractitionerData} data the callable payload.
 * @return {PractitionerInput} canonical code, type and label.
 */
export function parsePractitionerInput(data: SetPractitionerData): PractitionerInput {
  const code = normalizePractitionerId(data.requester_id);
  if (!code) throw new HttpsError("invalid-argument", "Code du médecin requis.");
  if (!CODE_RE.test(code)) {
    throw new HttpsError(
      "invalid-argument",
      "Code invalide : lettres et chiffres uniquement, tel qu'il apparaît dans Qalam (ex. MOUSTZOU)."
    );
  }
  const type = String(data.type || "medecin").trim() as RequesterType;
  if (!PRACTITIONER_TYPES.includes(type)) {
    throw new HttpsError("invalid-argument", "Type invalide (médecin ou correspondant).");
  }
  const label = String(data.label || "").trim();
  if (label.length < MIN_LABEL || label.length > MAX_LABEL) {
    throw new HttpsError(
      "invalid-argument",
      `Indiquez le nom affiché (${MIN_LABEL} à ${MAX_LABEL} caractères), ex. « Dr Moustadraf Zouhair ».`
    );
  }
  return { code, type, label };
}

/**
 * Is this code one of the account's own PATIENT ids (own dossier or a
 * relative's)? Compared case-insensitively, like the server resolution.
 * @param {string} code canonical practitioner code.
 * @param {FirebaseFirestore.DocumentData} user the target user document.
 * @return {boolean} true when it collides.
 */
export function collidesWithPatientIds(
  code: string,
  user: FirebaseFirestore.DocumentData
): boolean {
  const ownId = normalizeRequesterId(user.requester_id).toUpperCase();
  const linkedIds: string[] = Array.isArray(user.linkedRequesterIds) ?
    user.linkedRequesterIds.map((x: unknown) => normalizeRequesterId(x).toUpperCase()) :
    [];
  return code === ownId || linkedIds.includes(code);
}

/** Why an activation must not go through (yet), or null when it may. */
export type ActivationRefusal = "lab_error" | "unknown_code" | "shared_code" | null;

/**
 * The activation gate, once the lab was probed and the other holders listed.
 * @param {Probe} probe what the lab server answered for the code.
 * @param {SharedAccount[]} sharedWith other accounts holding the code.
 * @param {object} flags the admin's explicit confirmations.
 * @return {ActivationRefusal} the reason to refuse, or null.
 */
export function activationRefusal(
  probe: Probe,
  sharedWith: SharedAccount[],
  flags: { allowUnknown?: boolean; allowShared?: boolean }
): ActivationRefusal {
  // A lab outage is never overridable: activating blind would hide a typo.
  if (probe.status === "error") return "lab_error";
  if (probe.status === "unknown" && flags.allowUnknown !== true) return "unknown_code";
  if (sharedWith.length > 0 && flags.allowShared !== true) return "shared_code";
  return null;
}

/**
 * Ask the lab server what this code would show — COUNTS only. The list is
 * requested without PDFs (0.25 s, measured 23/09/2026). Names are used to count
 * distinct patients and immediately dropped; nothing leaves this function but
 * two integers and a status.
 */
async function probeCode(code: string, type: RequesterType): Promise<Probe> {
  try {
    const resp = await callCyberlab(
      {
        apiUrl: CYBERLAB_API_URL.value(),
        apiKey: CYBERLAB_API_KEY.value(),
        hmacSecret: CYBERLAB_HMAC_SECRET.value(),
      },
      { type, requester_id: code, max_results: 50, include_pdf: "none" }
    );
    const results = Array.isArray(resp.results) ? resp.results : [];
    const patients = new Set(results.map((r) => patientKey(r.patient_nom, r.patient_prenom)));
    return { status: "ok", dossierCount: results.length, patientCount: patients.size };
  } catch (err) {
    if (err instanceof CyberlabError && err.kind === "not_found") {
      return { status: "unknown", dossierCount: 0, patientCount: 0 };
    }
    logger.warn("adminSetPractitioner: probe failed", {
      kind: err instanceof CyberlabError ? err.kind : "unexpected",
    });
    return { status: "error", dossierCount: 0, patientCount: 0 };
  }
}

/** Other accounts that already hold this code. */
async function accountsHolding(code: string, exceptUid: string): Promise<SharedAccount[]> {
  const snap = await admin
    .firestore()
    .collection("users")
    .where("practitioner.requester_id", "==", code)
    .limit(SHARED_LIMIT + 1)
    .get();
  const out: SharedAccount[] = [];
  snap.forEach((doc) => {
    if (doc.id === exceptUid) return;
    const d = doc.data() || {};
    out.push({
      uid: doc.id,
      fullName: String(d.fullName || ""),
      email: d.email == null ? null : String(d.email),
    });
  });
  return out.slice(0, SHARED_LIMIT);
}

/**
 * Best-effort email to the account holder: "your doctor access is active".
 * Returns whether something was actually sent (false in simulated mode is
 * reported as sent by the mailer — see `isSmtpConfigured` for that nuance).
 */
async function notifyPractitioner(email: string, label: string): Promise<boolean> {
  try {
    const html = renderAlertEmail({
      title: "Votre accès médecin est actif",
      lead:
        "Le Laboratoire El Allali vous donne accès, dans son application, aux " +
        "résultats des analyses que vous avez prescrites.",
      rows: [
        ["Accès", label || "Espace « Mes patients »"],
        ["Où", `${APP_URL.value()}/fr/mes-patients`],
      ],
      todo:
        "Ouvrez l'application Labo El Allali avec ce même compte, puis « Mes " +
        "patients ». Seuls les bilans que vous avez vous-même prescrits y " +
        "apparaissent, quelques minutes après leur validation au laboratoire.",
      footer:
        "Si vous n'êtes pas à l'origine de cette demande, contactez le laboratoire " +
        "au 05 28 84 33 84.",
    });
    await Promise.race([
      sendMail({
        to: [email],
        subject: "[Labo El Allali] Votre accès médecin est actif",
        html,
        fromName: "Laboratoire El Allali",
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ]);
    return true;
  } catch {
    logger.error("adminSetPractitioner: notification email failed");
    return false;
  }
}

export const adminSetPractitioner = onCall(
  {
    region: REGION,
    secrets: [CYBERLAB_API_KEY, CYBERLAB_HMAC_SECRET, SMTP_USER, SMTP_PASS],
  },
  async (request: CallableRequest<SetPractitionerData>) => {
    const { uid: adminUid } = await requireLevel(request, LEVEL.admin);
    const data = request.data || {};
    const targetUid = String(data.uid || "").trim();
    if (!targetUid) throw new HttpsError("invalid-argument", "Compte requis.");

    const ref = admin.firestore().doc(`users/${targetUid}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Ce compte n'existe pas.");
    const user = snap.data() || {};

    // ── Removal ───────────────────────────────────────────────────────────────
    if (data.clear === true) {
      if (data.dryRun === true) {
        return { ok: true, dryRun: true, practitioner: readPractitionerDTO(user) };
      }
      await ref.update({ practitioner: admin.firestore.FieldValue.delete() });
      logger.info("adminSetPractitioner", { uid: targetUid, by: adminUid, action: "clear" });
      return { ok: true, dryRun: false, practitioner: null };
    }

    // ── Validation ────────────────────────────────────────────────────────────
    const { code, type, label } = parsePractitionerInput(data);

    // A code equal to one of the account's PATIENT ids would be shadowed by the
    // patient side (resolveIdentity checks it first): the doctor would open his
    // own results under « Mes patients ». Refuse it here, where it is fixable.
    if (collidesWithPatientIds(code, user)) {
      throw new HttpsError(
        "failed-precondition",
        "Ce code est déjà un dossier patient de ce compte. Vérifiez le code du médecin dans Qalam."
      );
    }

    // ── Verification (counts only) + audit ──────────────────────────────────
    const [probe, sharedWith, accessReq] = await Promise.all([
      probeCode(code, type),
      accountsHolding(code, targetUid),
      admin.firestore().doc(`resultAccessRequests/${targetUid}`).get(),
    ]);
    // Signup files a patient access request automatically: a doctor-only
    // account shows up in the patient queue. Tell the operator, don't decide.
    const pendingAccessRequest = accessReq.exists && accessReq.data()?.status === "pending";
    const current = readPractitionerDTO(user);

    if (data.dryRun === true) {
      return {
        ok: true,
        dryRun: true,
        probe,
        sharedWith,
        pendingAccessRequest,
        practitioner: current,
      };
    }

    const refusal = activationRefusal(probe, sharedWith, data);
    if (refusal === "lab_error") {
      throw new HttpsError(
        "unavailable",
        "Le serveur de résultats ne répond pas : impossible de vérifier ce code. Réessayez dans quelques minutes."
      );
    }
    if (refusal === "unknown_code") {
      throw new HttpsError(
        "failed-precondition",
        "Le serveur de résultats ne connaît encore aucun dossier pour ce code. Cochez la confirmation pour activer quand même."
      );
    }
    if (refusal === "shared_code") {
      throw new HttpsError(
        "failed-precondition",
        "Ce code est déjà rattaché à un autre compte. Cochez la confirmation pour le partager."
      );
    }

    // ── Write ─────────────────────────────────────────────────────────────────
    // `update` with the WHOLE map when the code changes — a `set(merge)` would
    // deep-merge and keep the previous code's `lastUsedAt`. Same code: only the
    // editable fields, so the activation date and usage history survive.
    const sameCode = current?.requester_id === code;
    await admin.firestore().runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists) throw new HttpsError("not-found", "Ce compte n'existe pas.");
      if (sameCode) {
        tx.update(ref, { "practitioner.type": type, "practitioner.label": label });
      } else {
        tx.update(ref, {
          practitioner: {
            requester_id: code,
            type,
            label,
            linkedAt: admin.firestore.FieldValue.serverTimestamp(),
            linkedBy: adminUid,
          },
        });
      }
    });
    logger.info("adminSetPractitioner", {
      uid: targetUid,
      by: adminUid,
      action: sameCode ? "update" : "activate",
    });

    // Tell the doctor, but only when access is NEW (not on a label edit).
    let notified = false;
    const email = user.email ? String(user.email) : "";
    if (!sameCode && email) notified = await notifyPractitioner(email, label);

    const after = readPractitionerDTO((await ref.get()).data());
    return {
      ok: true,
      dryRun: false,
      probe,
      sharedWith,
      pendingAccessRequest,
      practitioner: after,
      notified,
    };
  }
);
