/**
 * How much each doctor uses « Mes patients » — for the admin (owner's request,
 * 24/09/2026: « voir à quel point ils consultent les dossiers de leurs
 * patients »). Shown in the « Médecins » tab and on the dashboard.
 *
 * `practitionerUsage/{uid}` — one document per doctor account, written by
 * `fetchResults` only; server only (no Firestore rule, default deny):
 *   days          days with at least one visit (a roster list load), UTC days
 *   reports       reports opened — one per PDF the lab actually returned
 *   firstAt       first visit              lastAt        last visit
 *   lastReportAt  last report opened       lastDay       UTC day of the last counted visit
 *   months        { "YYYY-MM": { days, reports } } — for « ce mois-ci »
 *
 * Dates and counts ONLY: never which patient, never which dossier — the same
 * nature as the patients' usage stamp (`confidentialite.usage_*`), and the
 * doctor reads it in his engagement.
 *
 * Kept OUT of `users/{uid}.practitioner` on purpose: that map is the access
 * grant (withdrawing it deletes it) and what the doctor's own page reads; a
 * counter written at every PDF would churn it. The history survives a
 * withdrawal. `practitioner.lastUsedAt` (6 h throttle) predates this file and
 * stays — the « Médecins » tab reads the most recent of the two.
 */
import * as admin from "firebase-admin";

export const PRACTITIONER_USAGE = "practitionerUsage";

/** One doctor's usage, as the admin screens show it (timestamps in ms). */
export interface UsageSummary {
  days: number;
  reports: number;
  /** The current UTC month. */
  monthDays: number;
  monthReports: number;
  firstAt: number | null;
  lastAt: number | null;
  lastReportAt: number | null;
}

const count = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

const millis = (v: unknown): number | null => {
  const ts = v as { toMillis?: () => number } | null | undefined;
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
};

/**
 * "2026-09-24" in UTC — the convention of `usageDaily`.
 * @param {Date} d the date.
 * @return {string} the day key.
 */
export function dayKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Is this visit the first of its (UTC) day? Pure.
 * @param {unknown} lastDay `lastDay` as stored.
 * @param {string} today today's day key.
 * @return {boolean} true when the day counter must move.
 */
export function isNewDay(lastDay: unknown, today: string): boolean {
  return lastDay !== today;
}

/**
 * The summary of one usage document; « ce mois-ci » = the UTC month of `now`.
 * Pure — unit-tested by `scripts/test-practitioner-admin.js`.
 * @param {object|undefined} data the `practitionerUsage/{uid}` data.
 * @param {Date} now the reference date.
 * @return {UsageSummary} counts and dates, zeros when nothing was recorded.
 */
export function usageSummary(
  data: Record<string, unknown> | undefined,
  now: Date
): UsageSummary {
  const d = data || {};
  const month = dayKeyUTC(now).slice(0, 7);
  const months =
    d.months && typeof d.months === "object" ? (d.months as Record<string, unknown>) : {};
  const cur =
    months[month] && typeof months[month] === "object" ?
      (months[month] as Record<string, unknown>) :
      {};
  return {
    days: count(d.days),
    reports: count(d.reports),
    monthDays: count(cur.days),
    monthReports: count(cur.reports),
    firstAt: millis(d.firstAt),
    lastAt: millis(d.lastAt),
    lastReportAt: millis(d.lastReportAt),
  };
}

/**
 * A visit: the doctor's roster list was loaded. Counts the day once (a
 * transaction, so two tabs opened together count one day). Best-effort —
 * never throws: usage tracking must never break a doctor's results.
 * @param {string} uid the doctor's account.
 */
export async function recordPractitionerVisit(uid: string): Promise<void> {
  try {
    const db = admin.firestore();
    const ref = db.doc(`${PRACTITIONER_USAGE}/${uid}`);
    const today = dayKeyUTC(new Date());
    await db.runTransaction(async (tx) => {
      const d = (await tx.get(ref)).data() || {};
      const now = admin.firestore.FieldValue.serverTimestamp();
      const write: Record<string, unknown> = { lastAt: now, lastDay: today };
      if (!d.firstAt) write.firstAt = now;
      if (isNewDay(d.lastDay, today)) {
        const inc = admin.firestore.FieldValue.increment(1);
        write.days = inc;
        // set(merge) merges nested maps: the other months and this month's
        // `reports` are kept.
        write.months = { [today.slice(0, 7)]: { days: inc } };
      }
      tx.set(ref, write, { merge: true });
    });
  } catch {
    /* best-effort only */
  }
}

/**
 * A report opened: the lab returned a PDF for one of the doctor's dossiers.
 * Best-effort — never throws.
 * @param {string} uid the doctor's account.
 */
export async function recordPractitionerReport(uid: string): Promise<void> {
  try {
    const inc = admin.firestore.FieldValue.increment(1);
    await admin
      .firestore()
      .doc(`${PRACTITIONER_USAGE}/${uid}`)
      .set(
        {
          reports: inc,
          lastReportAt: admin.firestore.FieldValue.serverTimestamp(),
          months: { [dayKeyUTC(new Date()).slice(0, 7)]: { reports: inc } },
        },
        { merge: true }
      );
  } catch {
    /* best-effort only */
  }
}
