/**
 * Pure, framework-free helpers for the CyberLab results ("bilans") — shared by the
 * checkup-reminder widget and the results indicators bar so the two never disagree.
 *
 * No React / no `'use client'`: importable from any client component (and, if ever
 * needed, from the server or a test).
 */

import type { CyberlabResult } from '@/types/cyberlab';

/** Full calendar months elapsed since `iso`. Null for missing/invalid/future dates. */
export function monthsSince(iso: string | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() > now.getTime()) return null;
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
