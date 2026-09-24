/**
 * Doctor access REQUESTS — the doctor asks, the lab decides.
 *
 * The two onboarding cases (owner's decision, 24/09/2026):
 *  - the lab already has the doctor's app account → an admin activates it
 *    directly (`adminSetPractitioner`, « Accès médecin » card). No request.
 *  - the doctor has no account yet → the lab sends him the invitation link
 *    (`/{lang}/mes-patients`, « Inviter un médecin » card in the admin, usually
 *    over WhatsApp). He signs up, lands on the request form, and submits: the
 *    request appears in the admin « Demandes » tab and the staff get an e-mail.
 *    An admin then attaches his Qalam code. The same link becomes his workspace.
 *
 * NOTHING here grants anything. `requestPractitionerAccess` writes a request and
 * alerts the staff; activation stays `adminSetPractitioner` (admin level), which
 * marks the request fulfilled. Anyone can claim to be a doctor in an app — only
 * the lab can check it, and only the lab knows the doctor's Qalam code.
 *
 * A doctor who never had a test at the lab has no patient dossier: nothing here
 * depends on one (the profile only needs a name and a phone, like every account).
 *
 * The form also carries his CONFIDENTIALITY ENGAGEMENT (« Je suis médecin et
 * j'accepte cet engagement », owner's request 24/09/2026): recorded on his
 * account here, so the lab does not ask him again after activating him — see
 * ./practitionerEngagement.ts.
 *
 * Collection `practitionerAccessRequests/{uid}` — one per account, like
 * `resultAccessRequests`. Server only: no Firestore rule, default deny.
 * Never logged: the name, the e-mail, the phone. Only uids.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { LEVEL, requireLevel, REGION } from "./roles";
import { practitionerIdentity } from "../cyberlab/identities";
import {
  engagementOf,
  engagementRecord,
  PRACTITIONER_ENGAGEMENT_VERSION,
} from "./practitionerEngagement";
import {
  alertRecipients,
  APP_URL,
  fmtCasablanca,
  renderAlertEmail,
  sendMail,
  SMTP_PASS,
  SMTP_USER,
} from "../email/mailer";

export const PRACTITIONER_REQUESTS = "practitionerAccessRequests";

const LABEL_MIN = 3;
const LABEL_MAX = 60;
const SPECIALTY_MAX = 60;
const PLACE_MAX = 80;

export interface PractitionerRequestInput {
  /** His name as printed on his prescriptions — what the lab looks up in Qalam. */
  label?: unknown;
  specialty?: unknown;
  /** City or practice. */
  place?: unknown;
  /** « Je suis médecin et j'accepte cet engagement » — must be ticked. */
  attest?: unknown;
  /**
   * The engagement version the page showed him. Equal to the current version →
   * the engagement is recorded. Anything else (a page older than the text) →
   * the request still goes through, and the engagement is asked again at his
   * first visit.
   */
  engagement?: unknown;
}

export interface PractitionerRequestFields {
  label: string;
  specialty: string;
  place: string;
  /** He accepted the CURRENT engagement text on the form. */
  engagement: boolean;
}

const clean = (v: unknown): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";

/**
 * Validate what the doctor typed. Pure — unit-tested by
 * `scripts/test-practitioner-admin.js`.
 * @param {PractitionerRequestInput} data the raw callable input.
 * @return {PractitionerRequestFields} the cleaned fields.
 */
export function parsePractitionerRequest(data: PractitionerRequestInput): PractitionerRequestFields {
  if (data?.attest !== true) {
    throw new HttpsError("invalid-argument", "Confirmez que vous êtes médecin prescripteur.");
  }
  const label = clean(data.label);
  if (label.length < LABEL_MIN || label.length > LABEL_MAX) {
    throw new HttpsError(
      "invalid-argument",
      "Indiquez votre nom tel qu'il figure sur vos ordonnances (3 à 60 caractères)."
    );
  }
  const specialty = clean(data.specialty);
  if (specialty.length > SPECIALTY_MAX) {
    throw new HttpsError("invalid-argument", "Spécialité trop longue (60 caractères au plus).");
  }
  const place = clean(data.place);
  if (place.length > PLACE_MAX) {
    throw new HttpsError("invalid-argument", "Ville ou cabinet trop long (80 caractères au plus).");
  }
  return {
    label,
    specialty,
    place,
    engagement: data.engagement === PRACTITIONER_ENGAGEMENT_VERSION,
  };
}

const millis = (v: unknown): number | null => {
  const ts = v as { toMillis?: () => number } | null | undefined;
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
};

/** Doctor: « je suis médecin, je demande l'accès ». Auth only — grants nothing. */
export const requestPractitionerAccess = onCall(
  { region: REGION, secrets: [SMTP_USER, SMTP_PASS] },
  async (request: CallableRequest<PractitionerRequestInput>) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");
    const uid = request.auth.uid;
    const fields = parsePractitionerRequest(request.data || {});

    const userRef = admin.firestore().doc(`users/${uid}`);
    const u = (await userRef.get()).data() || {};
    if (!u.fullName || !u.phone) {
      throw new HttpsError(
        "failed-precondition",
        "Complétez d'abord votre profil (nom et téléphone)."
      );
    }
    // The engagement is his, whatever happens to the request: recorded first, so
    // the lab's activation does not ask him again. Never overwritten (the first
    // acceptance date is the one that counts).
    const previous = engagementOf(u);
    if (fields.engagement && !previous) {
      await userRef.set({ practitionerEngagement: engagementRecord("request") }, { merge: true });
    }

    // Already active (the profile was read before the admin's activation).
    if (practitionerIdentity(u)) return { status: "already_granted" };

    const ref = admin.firestore().doc(`${PRACTITIONER_REQUESTS}/${uid}`);
    const existing = (await ref.get()).data();
    // One pending request per account: a second tap sends nothing and no e-mail.
    if (existing?.status === "pending") {
      return { status: "pending", createdAt: millis(existing.createdAt) };
    }

    const email = u.email || request.auth.token?.email || null;
    // merge + deletes: a request made again after a refusal starts clean.
    await ref.set(
      {
        uid,
        fullName: String(u.fullName),
        email,
        phone: String(u.phone),
        label: fields.label,
        specialty: fields.specialty,
        place: fields.place,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        // Shown on the admin card: the lab sees he accepted it (now, or before —
        // then with its real date).
        engagementAt: previous?.acceptedAt ?
          admin.firestore.Timestamp.fromMillis(previous.acceptedAt) :
          fields.engagement ?
            admin.firestore.FieldValue.serverTimestamp() :
            admin.firestore.FieldValue.delete(),
        rejectedBy: admin.firestore.FieldValue.delete(),
        rejectedAt: admin.firestore.FieldValue.delete(),
        fulfilledBy: admin.firestore.FieldValue.delete(),
        fulfilledAt: admin.firestore.FieldValue.delete(),
        requester_id: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );

    // Staff alert — best-effort, never blocks the doctor (same shape as the
    // patient access requests: raw values, the template escapes them; 10 s cap).
    try {
      const html = renderAlertEmail({
        title: "Nouvelle demande d'accès médecin",
        lead:
          "Un médecin demande à consulter dans l'application les résultats des " +
          "patients qu'il prescrit.",
        rows: [
          ["Nom sur ses ordonnances", fields.label],
          ["Spécialité", fields.specialty || "—"],
          ["Ville / cabinet", fields.place || "—"],
          [
            "Engagement de confidentialité",
            fields.engagement || previous ?
              "Accepté" :
              "Pas encore (demandé à sa première visite)",
          ],
          ["Nom du compte", String(u.fullName)],
          ["Téléphone", String(u.phone)],
          ["E-mail", email ? String(email) : "—"],
          ["Demandé le", fmtCasablanca(Date.now())],
          ["Identifiant du compte", uid],
          ["Espace admin", `${APP_URL.value()}/fr/admin`],
        ],
        todo:
          "À faire : vérifier qu'il s'agit bien de ce médecin, trouver son code dans " +
          "Qalam (fiche Prescripteur, « Serveur Résultat » = Oui), puis activer son " +
          "accès depuis l'espace admin, onglet « Demandes ».",
      });
      await Promise.race([
        sendMail({
          to: alertRecipients(),
          subject: `Nouvelle demande d'accès médecin — ${fields.label}`,
          html,
          replyTo: email ? String(email) : undefined,
          fromName: "Labo El Allali — Demandes d'accès",
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
      ]);
    } catch {
      logger.error("requestPractitionerAccess: staff alert email failed", { uid });
    }

    logger.info("requestPractitionerAccess", { uid });
    return { status: "pending", createdAt: Date.now() };
  }
);

/** Doctor: where is my request? Auth only. */
export const myPractitionerRequest = onCall(
  { region: REGION },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");
    const d = (await admin.firestore().doc(`${PRACTITIONER_REQUESTS}/${request.auth.uid}`).get()).data();
    if (!d) return { status: null };
    return {
      status: typeof d.status === "string" ? d.status : null,
      createdAt: millis(d.createdAt),
      label: typeof d.label === "string" ? d.label : "",
    };
  }
);

/** Staff: the pending doctor requests, newest first. Staff may see; admins act. */
export const adminListPractitionerRequests = onCall(
  { region: REGION },
  async (request: CallableRequest<unknown>) => {
    await requireLevel(request, LEVEL.staff);
    const snap = await admin
      .firestore()
      .collection(PRACTITIONER_REQUESTS)
      .where("status", "==", "pending")
      .limit(100)
      .get();
    const requests = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          uid: doc.id,
          fullName: String(d.fullName || ""),
          email: d.email == null ? null : String(d.email),
          phone: String(d.phone || ""),
          label: String(d.label || ""),
          specialty: String(d.specialty || ""),
          place: String(d.place || ""),
          createdAt: millis(d.createdAt),
          engagementAt: millis(d.engagementAt),
        };
      })
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return { requests };
  }
);

/** Admin: refuse a doctor request. Nothing is sent to the doctor — the lab calls him. */
export const adminRejectPractitionerRequest = onCall(
  { region: REGION },
  async (request: CallableRequest<{ uid?: string }>) => {
    const { uid: adminUid } = await requireLevel(request, LEVEL.admin);
    const uid = String(request.data?.uid || "").trim();
    if (!uid) throw new HttpsError("invalid-argument", "Compte requis.");
    const ref = admin.firestore().doc(`${PRACTITIONER_REQUESTS}/${uid}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.status !== "pending") {
      throw new HttpsError("failed-precondition", "Cette demande n'est plus en attente.");
    }
    await ref.update({
      status: "rejected",
      rejectedBy: adminUid,
      rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.info("adminRejectPractitionerRequest", { uid, by: adminUid });
    return { ok: true };
  }
);

/**
 * Called by `adminSetPractitioner` on a successful activation: the doctor's
 * pending request, if any, is marked fulfilled. Best-effort — the access is
 * already written; a failure here only leaves the request in the queue.
 * @param {string} uid the account just activated.
 * @param {string} adminUid who activated it.
 * @param {string} code the Qalam code attached.
 * @return {Promise<boolean>} whether a pending request was closed.
 */
export async function fulfillPractitionerRequest(
  uid: string,
  adminUid: string,
  code: string
): Promise<boolean> {
  try {
    const ref = admin.firestore().doc(`${PRACTITIONER_REQUESTS}/${uid}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.status !== "pending") return false;
    await ref.update({
      status: "fulfilled",
      fulfilledBy: adminUid,
      fulfilledAt: admin.firestore.FieldValue.serverTimestamp(),
      requester_id: code,
    });
    return true;
  } catch {
    logger.error("fulfillPractitionerRequest failed", { uid });
    return false;
  }
}
