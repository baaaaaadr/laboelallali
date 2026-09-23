/**
 * Small, pure helpers on lab dossiers, shared by the patient results context
 * (`src/contexts/ResultsContext.tsx`) and the doctor's « Mes patients » page, so
 * both agree on what "the most recent report" means.
 */
import type { CyberlabResult } from '@/types/cyberlab';

/**
 * Chronological order on `date_dossier`. The lab sends ISO-8601 strings, for
 * which a string comparison IS chronological — no parsing, no time zone.
 * Descending (newest first) when used as a sort comparator.
 */
export function compareDossierDateDesc(a: CyberlabResult, b: CyberlabResult): number {
  if (a.date_dossier === b.date_dossier) return 0;
  return a.date_dossier > b.date_dossier ? -1 : 1;
}

/** The `dossier_id` of the most recent dossier of a list, or null when empty. */
export function newestOf(list: CyberlabResult[]): string | null {
  if (!list.length) return null;
  return list.reduce((m, x) => (!m || x.date_dossier > m.date_dossier ? x : m), list[0]).dossier_id;
}
