/**
 * `adminUpdateProfile` — the front desk corrects a patient's PROFILE
 * (staff request, 07/10/2026): a mistyped date of birth, a nickname or an
 * abbreviated name typed at signup, a wrong phone number. Those make the
 * patient hard to find in the admin search, and the date of birth is what
 * separates homonyms when a relative's dossier is attached.
 *
 * What can be corrected: `fullName`, `dateOfBirth`, `phone`. Nothing else —
 * the e-mail is the LOGIN (Firebase Auth), and the identities (`requester_id`,
 * relatives, doctor access) have their own, audited screens.
 *
 * Staff level, like the rest of the patient onboarding. A team account can only
 * be corrected by someone above it (a stagiaire cannot rename an admin).
 *
 * Traceability: every correction writes one record in `adminProfileEdits`
 * (who, when, each field's old and new value) — server only, default deny in
 * `firestore.rules`. The values are the patient's identity data, so they are
 * NEVER logged: the log line carries uids and field names only.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { LEVEL, levelOf, requireLevel, REGION } from "./roles";

export const PROFILE_EDITS = "adminProfileEdits";

const NAME_MIN = 2;
const NAME_MAX = 80;
const PHONE_MIN_DIGITS = 8;
const PHONE_MAX = 20;

export type ProfileField = "fullName" | "dateOfBirth" | "phone";
export type ProfileFields = Partial<Record<ProfileField, string>>;

export interface ProfileEditInput {
  uid?: unknown;
  fullName?: unknown;
  dateOfBirth?: unknown;
  phone?: unknown;
}

const clean = (v: unknown): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";

/**
 * Validate what the front desk typed. Only the fields PRESENT in the input are
 * returned; each one present must be valid. Pure — unit-tested by
 * `scripts/test-profile-edit.js`.
 * @param {ProfileEditInput} data the raw callable input.
 * @param {Date} today the reference day for the date of birth.
 * @return {ProfileFields} the cleaned fields.
 */
export function parseProfileEdit(data: ProfileEditInput, today: Date = new Date()): ProfileFields {
  const out: ProfileFields = {};
  if (data.fullName !== undefined) {
    const name = clean(data.fullName);
    if (name.length < NAME_MIN || name.length > NAME_MAX) {
      throw new HttpsError(
        "invalid-argument",
        `Nom complet : ${NAME_MIN} à ${NAME_MAX} caractères.`
      );
    }
    out.fullName = name;
  }
  if (data.dateOfBirth !== undefined) {
    const dob = clean(data.dateOfBirth);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
    const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
    const real =
      !!d && !!m &&
      d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
    const todayKey = today.toISOString().slice(0, 10);
    if (!real || dob > todayKey || +m![1] < 1900) {
      throw new HttpsError(
        "invalid-argument",
        "Date de naissance invalide (entre 1900 et aujourd'hui)."
      );
    }
    out.dateOfBirth = dob;
  }
  if (data.phone !== undefined) {
    const phone = clean(data.phone);
    const digits = phone.replace(/\D+/g, "");
    if (
      phone.length > PHONE_MAX ||
      !/^\+?[\d\s.()-]+$/.test(phone) ||
      digits.length < PHONE_MIN_DIGITS
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Téléphone invalide (chiffres uniquement, au moins 8)."
      );
    }
    out.phone = phone;
  }
  return out;
}

/**
 * The fields that really change, with their old and new values. Pure.
 * @param {object} current the profile as stored.
 * @param {ProfileFields} next the validated input.
 * @return {object} field → {from, to}, only for changed fields.
 */
export function profileDiff(
  current: Record<string, unknown>,
  next: ProfileFields
): Partial<Record<ProfileField, { from: string; to: string }>> {
  const diff: Partial<Record<ProfileField, { from: string; to: string }>> = {};
  for (const key of Object.keys(next) as ProfileField[]) {
    const from = typeof current[key] === "string" ? (current[key] as string) : "";
    const to = next[key] as string;
    if (from !== to) diff[key] = { from, to };
  }
  return diff;
}

/** Staff: correct a patient's name, date of birth or phone. */
export const adminUpdateProfile = onCall(
  { region: REGION },
  async (request: CallableRequest<ProfileEditInput>) => {
    const { uid: adminUid, level } = await requireLevel(request, LEVEL.staff);
    const data = request.data || {};
    const targetUid = typeof data.uid === "string" ? data.uid.trim() : "";
    if (!targetUid) throw new HttpsError("invalid-argument", "Compte requis.");
    const fields = parseProfileEdit(data);
    if (Object.keys(fields).length === 0) {
      throw new HttpsError("invalid-argument", "Rien à corriger.");
    }

    const db = admin.firestore();
    const ref = db.doc(`users/${targetUid}`);
    const changed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "Ce compte n'existe pas.");
      const current = snap.data() || {};
      // A team account is corrected by someone ABOVE it, or by its owner.
      if (targetUid !== adminUid && levelOf(String(current.role || "")) >= level) {
        throw new HttpsError(
          "permission-denied",
          "Ce compte appartient à un membre de l'équipe de même niveau ou supérieur."
        );
      }
      const diff = profileDiff(current, fields);
      const keys = Object.keys(diff) as ProfileField[];
      if (keys.length === 0) return [] as ProfileField[];
      const update: Record<string, string> = {};
      for (const k of keys) update[k] = diff[k]!.to;
      tx.set(ref, update, { merge: true });
      tx.create(db.collection(PROFILE_EDITS).doc(), {
        uid: targetUid,
        by: adminUid,
        at: admin.firestore.FieldValue.serverTimestamp(),
        changes: diff,
      });
      return keys;
    });

    // uids and field NAMES only — never the values (identity data).
    logger.info("adminUpdateProfile", { uid: targetUid, by: adminUid, fields: changed });
    const after = (await ref.get()).data() || {};
    return {
      changed,
      fullName: String(after.fullName || ""),
      dateOfBirth: String(after.dateOfBirth || ""),
      phone: String(after.phone || ""),
    };
  }
);
