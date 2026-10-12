/**
 * Shared role-gate for the admin space callables.
 *
 * Single `role` field on users/{uid}; higher does all of lower:
 *   staff (1): encode requester_id/type on a patient; test a requester_id.
 *   admin (2): staff + add/remove staff (stagiaires).
 *   owner (3): admin + add/remove admins.
 *
 * Kept as a side-effect-free leaf module (only firebase-functions + firebase-admin)
 * so it can be imported by both adminPatients.ts and the CyberLab staff callable
 * without dragging in either module's onCall registrations or risking a cycle.
 */
import { HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const REGION = "europe-southwest1";

export const LEVEL: Record<string, number> = { owner: 3, admin: 2, staff: 1 };

export function levelOf(role?: string): number {
  return (role && LEVEL[role]) || 0;
}

/**
 * « RH » (Dr Aziz, 12/10/2026): the recruitment services see the job
 * applications (« Candidatures ») and NOTHING else. Deliberately OUTSIDE the
 * level ladder — `levelOf("rh")` is 0 — so every callable guarded by
 * `requireLevel(…)` (patients, results, doctors, team…) keeps refusing it
 * without a single change; only the applications callables let it in.
 */
export const RH_ROLE = "rh";

/** Admins, owners and the « RH » role read the job applications. Pure. */
export function canReadApplications(role?: string): boolean {
  return role === RH_ROLE || levelOf(role) >= LEVEL.admin;
}

/** Throws unless the caller may read the job applications (`canReadApplications`). */
export async function requireApplicationsAccess(
  request: CallableRequest
): Promise<{ uid: string; role: string }> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentification requise.");
  }
  const uid = request.auth.uid;
  const role = String((await admin.firestore().doc(`users/${uid}`).get()).data()?.role || "");
  if (!canReadApplications(role)) {
    throw new HttpsError("permission-denied", "Accès réservé au recrutement et à la direction du laboratoire.");
  }
  return { uid, role };
}

/** Throws unless the caller is authenticated and at least `min` level. */
export async function requireLevel(
  request: CallableRequest,
  min: number
): Promise<{ uid: string; level: number }> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentification requise.");
  }
  const uid = request.auth.uid;
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  const level = levelOf(snap.data()?.role);
  if (level < min) {
    throw new HttpsError(
      "permission-denied",
      "Accès réservé au personnel du laboratoire."
    );
  }
  return { uid, level };
}
