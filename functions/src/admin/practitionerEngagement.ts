/**
 * The doctor's CONFIDENTIALITY ENGAGEMENT (owner's request, 24/09/2026: « je
 * déclare ne pas partager avec autrui… il coche et puis fait sa demande »).
 *
 * Every doctor accepts, in the app, a short engagement: the results only for
 * his patients' care, nobody else on his account, medical secrecy, tell the lab
 * if his phone is lost or he stops practising. It replaces the paper engagement
 * the lab procedure used to describe. The text itself lives in the client
 * (`EngagementTerms`, keys `mes_patients.engagement_*`).
 *
 * Two moments, ONE record:
 *  - on the request form (the invitation link): the tick « Je suis médecin et
 *    j'accepte cet engagement » — recorded by `requestPractitionerAccess`;
 *  - a doctor the lab activated DIRECTLY never saw that form: the same text is
 *    shown to him once, before his first roster, and accepted here
 *    (`acceptPractitionerEngagement`).
 *
 * Where: `users/{uid}.practitionerEngagement = {version, acceptedAt, via}` — on
 * the ACCOUNT, not inside `practitioner`. Withdrawing then giving back an access
 * does not ask the same person again, and the record survives a withdrawal (it
 * is the lab's proof). Written only server-side; locked in `firestore.rules`
 * (both lists) so nobody can forge a date or a version.
 *
 * It is a commitment, NOT a lock: the access control stays the lab's activation
 * and the `practitioner` lock. The page shows the engagement before the roster;
 * `fetchResults` does not check it — a stale page must never turn a formality
 * into « accès retiré ».
 *
 * Bump `PRACTITIONER_ENGAGEMENT_VERSION` together with its client twin
 * (`src/lib/practitioner/engagement.ts` — `scripts/test-practitioner.js` checks
 * the pair) when the text changes materially: every doctor is asked again.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { REGION } from "./roles";
import { practitionerIdentity } from "../cyberlab/identities";

export const PRACTITIONER_ENGAGEMENT_VERSION = 1;

/** Where the doctor accepted: the request form, or his first visit. */
export type EngagementVia = "request" | "visit";

export interface EngagementInfo {
  version: number;
  /** Epoch ms, null only for a malformed record. */
  acceptedAt: number | null;
  via: string;
}

/**
 * The account's engagement for the CURRENT text, or null (absent, malformed,
 * or accepted for an older version). Pure — unit-tested by
 * `scripts/test-practitioner-admin.js`.
 * @param {object|undefined} data the `users/{uid}` document data.
 * @return {EngagementInfo|null} the engagement, or null.
 */
export function engagementOf(
  data: { practitionerEngagement?: unknown } | undefined
): EngagementInfo | null {
  const e = data?.practitionerEngagement;
  if (!e || typeof e !== "object" || Array.isArray(e)) return null;
  const raw = e as { version?: unknown; acceptedAt?: unknown; via?: unknown };
  if (typeof raw.version !== "number" || !(raw.version >= PRACTITIONER_ENGAGEMENT_VERSION)) {
    return null;
  }
  const ts = raw.acceptedAt as { toMillis?: () => number } | undefined;
  return {
    version: raw.version,
    acceptedAt: ts && typeof ts.toMillis === "function" ? ts.toMillis() : null,
    via: typeof raw.via === "string" ? raw.via : "",
  };
}

/**
 * The value written on the account (server time, current version).
 * @param {EngagementVia} via where the doctor accepted.
 * @return {object} the `practitionerEngagement` map.
 */
export function engagementRecord(via: EngagementVia) {
  return {
    version: PRACTITIONER_ENGAGEMENT_VERSION,
    acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    via,
  };
}

/**
 * Doctor, first visit: « J'accepte cet engagement ». Auth only, and only for an
 * account that HOLDS a doctor access (the request form records it otherwise).
 * Idempotent: a second call writes nothing.
 */
export const acceptPractitionerEngagement = onCall(
  { region: REGION },
  async (request: CallableRequest<{ version?: unknown }>) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");
    const uid = request.auth.uid;
    // A page older than the text must show the current text first.
    if (request.data?.version !== PRACTITIONER_ENGAGEMENT_VERSION) {
      throw new HttpsError(
        "failed-precondition",
        "Rechargez la page pour lire l'engagement à jour."
      );
    }
    const ref = admin.firestore().doc(`users/${uid}`);
    const data = (await ref.get()).data();
    if (!data || !practitionerIdentity(data)) {
      throw new HttpsError("failed-precondition", "Aucun accès médecin sur ce compte.");
    }
    if (engagementOf(data)) return { ok: true, already: true };
    await ref.set({ practitionerEngagement: engagementRecord("visit") }, { merge: true });
    logger.info("acceptPractitionerEngagement", { uid, version: PRACTITIONER_ENGAGEMENT_VERSION });
    return { ok: true, already: false };
  }
);
