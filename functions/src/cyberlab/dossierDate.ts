/**
 * The DOSSIER's date, not the date its record was created (08/10/2026).
 *
 * The results server sends one date per dossier, `date_dossier`, and it is the
 * moment the record was CREATED in Qalam — for a quote prepared in advance, the
 * day before (or weeks before) the patient actually came. Dr Aziz spotted it on
 * dossier 081026013: the report says 08/10/2026, the app said 07/10.
 *
 * Qalam numbers dossiers by their date: `JJMMAA` + a sequence (081026013 = the
 * 13th dossier of 08/10/26). Measured on 62 real dossiers of the app's accounts:
 * 57 numbers start with the very day of `date_dossier`, the 5 others with a
 * LATER day (1 day to 3½ weeks) — always the quote-in-advance case, never an
 * earlier one, never an unreadable prefix.
 *
 * So `date_dossier` is rewritten here, once, at the bridge — every screen
 * (patient, doctor, front desk, home panel, stats, sorting) then shows and uses
 * the dossier's date without knowing about it. The creation date is kept as
 * `date_creation`. Firebase-free and pure: unit-tested by
 * `scripts/test-dossier-date.js`.
 */

/** A quote is not prepared more than this long before the patient comes. */
const MAX_AHEAD_DAYS = 120;
const DAY_MS = 86_400_000;
/** Morocco is UTC+1 all year outside Ramadan — the lab's calendar day. */
const LAB_OFFSET_MS = 3_600_000;

/**
 * The date encoded at the start of a dossier number (`JJMMAA…`), as
 * `{y, m, d}`, or null when the prefix is not a real calendar date.
 * @param {unknown} dossierId the dossier number.
 * @return {{y: number, m: number, d: number} | null} the encoded day.
 */
export function dateFromDossierNumber(dossierId: unknown): { y: number; m: number; d: number } | null {
  const m = /^(\d{2})(\d{2})(\d{2})\d/.exec(String(dossierId ?? "").trim());
  if (!m) return null;
  const d = +m[1];
  const mo = +m[2];
  const y = 2000 + +m[3];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

/**
 * The date to show for a dossier: `date_dossier` itself when its (lab-local) day
 * is the one in the number, else that later day at noon lab time. Anything odd —
 * no readable prefix, an earlier day, a day too far ahead, an unreadable
 * `date_dossier` — keeps `date_dossier` untouched.
 * @param {unknown} dossierId the dossier number.
 * @param {unknown} createdIso `date_dossier` as the lab sent it.
 * @return {string} the ISO date to use.
 */
export function dossierDate(dossierId: unknown, createdIso: unknown): string {
  const created = typeof createdIso === "string" ? createdIso : "";
  const createdMs = Date.parse(created);
  const enc = dateFromDossierNumber(dossierId);
  if (!enc || Number.isNaN(createdMs)) return created;
  const local = new Date(createdMs + LAB_OFFSET_MS);
  const createdDay = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const numberDay = Date.UTC(enc.y, enc.m - 1, enc.d);
  if (numberDay === createdDay) return created;
  if (numberDay < createdDay || numberDay - createdDay > MAX_AHEAD_DAYS * DAY_MS) return created;
  // Noon, lab time: the same calendar day in every time zone a reader may use.
  return new Date(numberDay + 12 * 3_600_000 - LAB_OFFSET_MS).toISOString().replace(".000Z", "Z");
}

/**
 * Rewrite every result's `date_dossier` to the dossier's date, keeping the
 * original as `date_creation` when it changed. Returns a new response.
 * @param {T} resp a lab response ({results: [...]}).
 * @return {T} the same response with corrected dates.
 */
export function withDossierDates<T extends { results?: unknown }>(resp: T): T {
  if (!resp || !Array.isArray(resp.results)) return resp;
  const results = (resp.results as Record<string, unknown>[]).map((r) => {
    if (!r || typeof r !== "object") return r;
    const fixed = dossierDate(r.dossier_id, r.date_dossier);
    return fixed === r.date_dossier ? r : { ...r, date_dossier: fixed, date_creation: r.date_dossier };
  });
  return { ...resp, results };
}
