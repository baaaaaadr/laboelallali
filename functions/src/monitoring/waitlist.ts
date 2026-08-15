/**
 * `joinOutageWaitlist` — opt-in "notify me by email when the results server is
 * back" (the button under the confirmed-outage message on /resultats).
 *
 * Privacy contract (declared on the confidentialité page):
 *  - the address comes from the VERIFIED auth token (never from client input —
 *    a caller cannot subscribe someone else's mailbox);
 *  - one entry per account (`outageWaitlist/{uid}` — idempotent re-taps);
 *  - the entry is DELETED right after the recovery email is sent (see
 *    monitoring/healthCheck.ts `drainWaitlist`) — deletion is the retention policy.
 *
 * The only client input is `lang` ('fr' | 'ar'), used to localize the recovery
 * email; anything else defaults to 'fr'.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { STATE_DOC } from "./healthCheck";

export const joinOutageWaitlist = onCall(
  { region: "europe-southwest1" },
  async (request: CallableRequest): Promise<{ ok: true; email: string }> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const uid = request.auth.uid;

    // Verified token email first; profile email as fallback (some providers
    // don't put an email on the token).
    let email =
      typeof request.auth.token.email === "string" ? request.auth.token.email : "";
    if (!email.includes("@")) {
      const snap = await admin.firestore().doc(`users/${uid}`).get();
      const profileEmail = snap.data()?.email;
      email = typeof profileEmail === "string" ? profileEmail : "";
    }
    if (!email.includes("@")) {
      throw new HttpsError(
        "failed-precondition",
        "Aucune adresse email n'est associée à votre compte."
      );
    }

    const lang = (request.data as { lang?: unknown } | null)?.lang === "ar" ? "ar" : "fr";

    const db = admin.firestore();
    await db.doc(`outageWaitlist/${uid}`).set({
      email,
      lang,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Belt-and-braces flag: even if this opt-in races the recovery, the next
    // steady-up check sweeps the waitlist (see stateMachine.ts).
    await db.doc(STATE_DOC).set({ waitlistPending: true }, { merge: true });

    // Count-free, address-free log.
    logger.info("joinOutageWaitlist: patient subscribed", { lang });
    return { ok: true, email };
  }
);
