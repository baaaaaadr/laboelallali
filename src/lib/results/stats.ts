/**
 * Pure, framework-free helpers for the CyberLab results ("bilans") — shared by the
 * checkup-reminder widget and the results indicators bar so the two never disagree.
 *
 * No React / no `'use client'`: importable from any client component (and, if ever
 * needed, from the server or a test).
 */

import type { CyberlabResult } from '@/types/cyberlab';

/**
 * Tolerance for a `date_dossier` that parses slightly INTO THE FUTURE.
 *
 * The lab's timestamps carry a "Z" but appear to hold Moroccan wall-clock time
 * (UTC+1) — see docs/integrations/diagnostic-dossiers.md, where "13/07 08h42" is
 * read as local. A bilan taken ten minutes ago therefore parses up to ~1h ahead.
 * Add a phone clock that is often minutes or hours off on low-end Android, and
 * "slightly in the future" is a routine state, not an anomaly.
 *
 * Returning `null` there was a real bug: /resultats hid the checkup reminder and
 * the hero panel fell back to its generic message during the hour following
 * EVERY bilan — precisely when the patient opens the app to see that result.
 *
 * Inside the window → 0 months ("moins d'un mois"), which is the truth. Beyond
 * it, the date really is wrong and `null` remains the right answer. Six hours is
 * a judgement call, not a physical constant: it covers UTC+1 plus a reasonably
 * drifted device clock, while still rejecting a date that is days or years off.
 *
 * NOT a timezone correction. Morocco drops to UTC+0 during Ramadan, the evidence
 * is circumstantial, and if the lab ever fixes its serialiser a hardcoded −1h
 * would silently become a +1h error nobody watches for. Ask the lab instead.
 */
const CLOCK_SKEW_MS = 6 * 60 * 60 * 1000;

/** Full calendar months elapsed since `iso`. Null for missing/invalid dates, and
 *  for dates further ahead than the clock-skew window above. */
export function monthsSince(iso: string | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ahead = d.getTime() - now.getTime();
  if (ahead > CLOCK_SKEW_MS) return null; // genuinely in the future → unusable
  if (ahead > 0) return 0;                // within skew → "less than a month ago"
  let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) m -= 1; // current month not complete yet
  return Math.max(0, m);
}

export interface ResultsStats {
  /** Total number of dossiers (unfiltered). */
  count: number;
  /** `date_dossier` of the newest PARSEABLE dossier, or null if none is parseable. */
  newestIso: string | null;
  /** Full months since the newest bilan; null if no parseable date. */
  newestMonthsAgo: number | null;
  /** Calendar year of the oldest parseable bilan. */
  oldestYear: number | null;
  /** Calendar year of the newest parseable bilan. */
  newestYear: number | null;
}

/**
 * Display-ready aggregates over the results list. "Newest" is derived from the
 * parseable dates (robust if a `date_dossier` is malformed) rather than from
 * `newestDossierId`'s lexicographic compare — for valid ISO strings the two agree.
 */
export function computeResultsStats(
  results: CyberlabResult[],
  now: Date = new Date()
): ResultsStats {
  let newest: Date | null = null;
  let newestIso: string | null = null;
  let oldestYear: number | null = null;
  let newestYear: number | null = null;

  for (const r of results) {
    const d = new Date(r.date_dossier);
    if (!r.date_dossier || Number.isNaN(d.getTime())) continue;
    const y = d.getFullYear();
    if (oldestYear === null || y < oldestYear) oldestYear = y;
    if (newestYear === null || y > newestYear) newestYear = y;
    if (!newest || d.getTime() > newest.getTime()) {
      newest = d;
      newestIso = r.date_dossier;
    }
  }

  return {
    count: results.length,
    newestIso,
    newestMonthsAgo: monthsSince(newestIso ?? undefined, now),
    oldestYear,
    newestYear,
  };
}
