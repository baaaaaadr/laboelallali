/**
 * The anonymous counter of the « Scannez-moi » QR code (Dr Aziz, 12/10/2026,
 * devis line 65): how many scans per day, and which buttons are pressed.
 *
 *  - `recordQrEvent` (public, no account): `{event: "scan"}` when the page is
 *    opened from the printed QR (`?scan=1`), `{event: "click", key}` per tile.
 *    It writes ONE counter document per day, `qrDaily/{YYYY-MM-DD}` (lab time):
 *    `{scans, clicks: {<key>: n}}`. Nothing else — no person, no phone, no
 *    address, no IP. Server-only (default deny in firestore.rules).
 *  - `qrSummary` feeds the admin dashboard (`adminDashboardStats.qr`).
 *
 * The click keys are a closed list (`QR_KEYS`, twin of `src/lib/qr/qrLanguage.ts`):
 * a public endpoint must not let anyone create arbitrary fields.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { REGION } from "../admin/roles";

export const QR_DAILY = "qrDaily";
export const QR_KEYS = [
  "results",
  "doctor",
  "whatsapp",
  "call",
  "directions",
  "hours",
  "rdv",
  "glabo",
  "prescription",
  "prices",
  "prep",
  "card",
  "review",
  "install",
  "doctors",
  "jobs",
] as const;
const DAY_MS = 86_400_000;

/** "2026-10-12" in Morocco time. */
export function labDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Validate a counter event. Pure. `null` = refused. */
export function parseQrEvent(raw: unknown): { event: "scan" } | { event: "click"; key: string } | null {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (d.event === "scan") return { event: "scan" };
  if (d.event === "click" && (QR_KEYS as readonly unknown[]).includes(d.key)) return { event: "click", key: String(d.key) };
  return null;
}

export const recordQrEvent = onCall({ region: REGION, memory: "256MiB" }, async (request: CallableRequest) => {
  const ev = parseQrEvent(request.data);
  if (!ev) throw new HttpsError("invalid-argument", "Événement inconnu.");
  const day = labDay(new Date());
  const inc = admin.firestore.FieldValue.increment(1);
  await admin
    .firestore()
    .doc(`${QR_DAILY}/${day}`)
    .set(ev.event === "scan" ? { day, scans: inc } : { day, clicks: { [ev.key]: inc } }, { merge: true });
  return { ok: true };
});

export interface QrSummary {
  thisMonth: number;
  lastMonth: number;
  last30: number;
  /** Buttons pressed in the last 30 days, most used first. */
  topClicks: { key: string; count: number }[];
}

/**
 * Scans this calendar month, last month, the last 30 days, and the buttons of
 * the last 30 days. Reads at most 62 small documents by id (no index).
 * @param {number} nowMs reference time.
 * @return {Promise<QrSummary>} the figures.
 */
export async function qrSummary(nowMs: number): Promise<QrSummary> {
  const days = Array.from({ length: 62 }, (_, i) => labDay(new Date(nowMs - i * DAY_MS)));
  const unique = [...new Set(days)];
  const snaps = await admin.firestore().getAll(...unique.map((d) => admin.firestore().doc(`${QR_DAILY}/${d}`)));
  const today = labDay(new Date(nowMs));
  const thisMonthKey = today.slice(0, 7);
  const lastMonthDate = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 2, 1));
  const lastMonthKey = lastMonthDate.toISOString().slice(0, 7);
  const last30 = new Set(days.slice(0, 30));
  const out: QrSummary = { thisMonth: 0, lastMonth: 0, last30: 0, topClicks: [] };
  const clicks: Record<string, number> = {};
  for (const s of snaps) {
    if (!s.exists) continue;
    const d = s.data() || {};
    const scans = typeof d.scans === "number" ? d.scans : 0;
    if (s.id.startsWith(thisMonthKey)) out.thisMonth += scans;
    if (s.id.startsWith(lastMonthKey)) out.lastMonth += scans;
    if (last30.has(s.id)) {
      out.last30 += scans;
      for (const [k, v] of Object.entries(d.clicks || {})) {
        if (typeof v === "number") clicks[k] = (clicks[k] || 0) + v;
      }
    }
  }
  out.topClicks = Object.entries(clicks)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
  return out;
}
