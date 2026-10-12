/**
 * The admin « Candidatures » tab (devis line 40, 08/10/2026) — admins,
 * owners and the « RH » role (12/10/2026, `requireApplicationsAccess`); the
 * stagiaires never see a candidate's CV (owner's decision). Server side of
 * `src/components/features/admin/ApplicationsTab.tsx`.
 *
 *  - `adminListApplications`  — every application still kept (≤ 6 months).
 *  - `adminUpdateApplication` — the lab's decision (à étudier / entretien /
 *    retenu / refusé) and its internal note; who and when, kept in `history`.
 *  - `adminGetApplicationFile` — a CV or a letter, as base64 (same path as the
 *    result PDFs: no public URL ever exists for a candidate's file).
 *  - `adminDeleteApplication` — erase one now (a candidate's request, a test).
 *  - `cleanupExpiredApplications` — the daily 6-month erasure, files included.
 *
 * Privacy: logs carry ids and the caller's uid — never a candidate's data.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { REGION, requireApplicationsAccess } from "../admin/roles";
import { APPLICATIONS, FILE_KINDS, NOTE_MAX, STATUSES, STORAGE_PREFIX, THROTTLE, Status } from "./applicationRules";

const MAX_LIST = 500;
const DAY_MS = 86_400_000;

const toMs = (v: unknown): number | null =>
  v && typeof (v as admin.firestore.Timestamp).toMillis === "function"
    ? (v as admin.firestore.Timestamp).toMillis()
    : null;

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** A Firestore auto-id — anything else never reaches a path. */
function readId(v: unknown): string {
  const id = typeof v === "string" ? v.trim() : "";
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new HttpsError("invalid-argument", "Candidature inconnue.");
  return id;
}

/** The application as the admin tab reads it: no storage path, dates in ms. */
function toDTO(doc: admin.firestore.DocumentSnapshot) {
  const d = doc.data() || {};
  const files: Record<string, { name: string; contentType: string; size: number }> = {};
  for (const kind of FILE_KINDS) {
    const f = d.files?.[kind];
    if (f?.path) files[kind] = { name: str(f.name), contentType: str(f.contentType), size: Number(f.size) || 0 };
  }
  return {
    id: doc.id,
    ref: str(d.ref),
    createdAt: toMs(d.createdAt),
    expiresAt: toMs(d.expiresAt),
    lang: d.lang === "ar" ? "ar" : "fr",
    status: (STATUSES as readonly string[]).includes(d.status) ? d.status : "a_etudier",
    note: str(d.note),
    updatedAt: toMs(d.updatedAt),
    updatedByName: str(d.updatedByName),
    hasAccount: !!d.uid,
    lastName: str(d.lastName),
    firstName: str(d.firstName),
    dateOfBirth: str(d.dateOfBirth),
    city: str(d.city),
    district: str(d.district),
    phone: str(d.phone),
    email: str(d.email),
    kind: str(d.kind),
    schoolLevel: str(d.schoolLevel),
    position: str(d.position),
    positionOther: str(d.positionOther),
    duration: str(d.duration),
    startDate: str(d.startDate),
    endDate: str(d.endDate),
    availability: str(d.availability),
    availableFrom: str(d.availableFrom),
    diplomaLevel: str(d.diplomaLevel),
    diplomaTitle: str(d.diplomaTitle),
    diplomaYear: typeof d.diplomaYear === "number" ? d.diplomaYear : null,
    school: str(d.school),
    experience: str(d.experience),
    lastEmployer: str(d.lastEmployer),
    license: d.license === true,
    vehicle: str(d.vehicle),
    languages: Array.isArray(d.languages) ? d.languages.filter((l: unknown) => typeof l === "string") : [],
    languagesOther: str(d.languagesOther),
    source: str(d.source),
    files,
  };
}

/** Admin: every application still kept, newest first. */
export const adminListApplications = onCall({ region: REGION }, async (request: CallableRequest) => {
  await requireApplicationsAccess(request);
  try {
    const snap = await admin
      .firestore()
      .collection(APPLICATIONS)
      .orderBy("createdAt", "desc")
      .limit(MAX_LIST)
      .get();
    return { applications: snap.docs.map(toDTO), truncated: snap.size >= MAX_LIST };
  } catch {
    logger.error("adminListApplications: read failed");
    throw new HttpsError("internal", "Les candidatures n'ont pas pu être chargées.");
  }
});

/** Admin: set the decision and/or the internal note. */
export const adminUpdateApplication = onCall(
  { region: REGION },
  async (request: CallableRequest<{ id?: unknown; status?: unknown; note?: unknown }>) => {
    const { uid } = await requireApplicationsAccess(request);
    const d = request.data || {};
    const id = readId(d.id);
    let status: Status | undefined;
    if (d.status !== undefined) {
      if (!(STATUSES as readonly unknown[]).includes(d.status)) {
        throw new HttpsError("invalid-argument", "Statut inconnu.");
      }
      status = d.status as Status;
    }
    let note: string | undefined;
    if (d.note !== undefined) {
      if (typeof d.note !== "string") throw new HttpsError("invalid-argument", "Note invalide.");
      note = d.note.trim();
      if (note.length > NOTE_MAX) throw new HttpsError("invalid-argument", `Note : ${NOTE_MAX} caractères au plus.`);
    }
    if (status === undefined && note === undefined) {
      throw new HttpsError("invalid-argument", "Rien à enregistrer.");
    }

    const db = admin.firestore();
    const me = (await db.doc(`users/${uid}`).get()).data() || {};
    const byName = str(me.fullName) || str(me.email) || uid;
    const ref = db.doc(`${APPLICATIONS}/${id}`);
    if (!(await ref.get()).exists) throw new HttpsError("not-found", "Cette candidature n'existe plus.");

    const entry: Record<string, unknown> = { at: admin.firestore.Timestamp.now(), by: uid, byName };
    if (status !== undefined) entry.status = status;
    if (note !== undefined) entry.note = true; // the note itself lives in `note`
    const update: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid,
      updatedByName: byName,
      history: admin.firestore.FieldValue.arrayUnion(entry),
    };
    if (status !== undefined) update.status = status;
    if (note !== undefined) update.note = note;
    await ref.update(update);
    logger.info("adminUpdateApplication", { id, by: uid, status: status ?? null, note: note !== undefined });
    return { ok: true, updatedAt: Date.now(), updatedByName: byName };
  }
);

/** Admin: one CV or letter, as base64 — never a public link. */
export const adminGetApplicationFile = onCall(
  { region: REGION, memory: "512MiB" },
  async (request: CallableRequest<{ id?: unknown; kind?: unknown }>) => {
    try {
      request.rawRequest.res?.setHeader("Cache-Control", "no-store");
    } catch {
      /* best-effort */
    }
    const { uid } = await requireApplicationsAccess(request);
    const d = request.data || {};
    const id = readId(d.id);
    if (!(FILE_KINDS as readonly unknown[]).includes(d.kind)) throw new HttpsError("invalid-argument", "Pièce inconnue.");
    const snap = await admin.firestore().doc(`${APPLICATIONS}/${id}`).get();
    const f = snap.data()?.files?.[d.kind as string];
    if (!f?.path) throw new HttpsError("not-found", "Ce fichier n'existe plus.");
    try {
      const [buf] = await admin.storage().bucket().file(String(f.path)).download();
      logger.info("adminGetApplicationFile", { id, kind: d.kind, by: uid });
      return { base64: buf.toString("base64"), contentType: str(f.contentType), fileName: str(f.name) };
    } catch {
      logger.error("adminGetApplicationFile: download failed", { id });
      throw new HttpsError("not-found", "Ce fichier n'existe plus.");
    }
  }
);

async function eraseApplication(id: string): Promise<void> {
  await admin.storage().bucket().deleteFiles({ prefix: `${STORAGE_PREFIX}/${id}/` });
  await admin.firestore().doc(`${APPLICATIONS}/${id}`).delete();
}

/** Admin: erase one application and its files now. */
export const adminDeleteApplication = onCall(
  { region: REGION },
  async (request: CallableRequest<{ id?: unknown }>) => {
    const { uid } = await requireApplicationsAccess(request);
    const id = readId(request.data?.id);
    try {
      await eraseApplication(id);
    } catch {
      logger.error("adminDeleteApplication: failed", { id });
      throw new HttpsError("internal", "La candidature n'a pas pu être effacée. Réessayez.");
    }
    logger.info("adminDeleteApplication", { id, by: uid });
    return { ok: true };
  }
);

/**
 * Daily: erase every application past its 6 months (files included), and the
 * anti-spam counters older than two days. europe-west1 — Cloud Scheduler has
 * no europe-southwest1 (same constraint as `checkCyberlabHealth`).
 */
export const cleanupExpiredApplications = onSchedule(
  {
    schedule: "30 3 * * *",
    timeZone: "Africa/Casablanca",
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 300,
    maxInstances: 1,
  },
  async () => {
    const db = admin.firestore();
    let erased = 0;
    let failed = 0;
    const expired = await db
      .collection(APPLICATIONS)
      .where("expiresAt", "<=", admin.firestore.Timestamp.now())
      .limit(200)
      .get();
    for (const doc of expired.docs) {
      try {
        await eraseApplication(doc.id);
        erased += 1;
      } catch {
        failed += 1;
      }
    }
    const old = await db
      .collection(THROTTLE)
      .where("updatedAt", "<=", admin.firestore.Timestamp.fromMillis(Date.now() - 2 * DAY_MS))
      .limit(450)
      .get();
    if (!old.empty) {
      const batch = db.batch();
      old.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    logger.info("cleanupExpiredApplications", { erased, failed, counters: old.size });
  }
);
