'use client';

/**
 * The brain of "Détails des analyses", without any markup: parse a lab
 * `analyses_summary` into codes, and resolve those codes to patient-facing names.
 *
 * Extracted from `AnalysesDetails` when the home hero needed the same list in a
 * completely different skin (frosted glass over a photo, where that component's
 * light-surface tokens are all overridden to white by `.hero-banner *`).
 *
 * **The separator regex lives here and nowhere else.** The lab's real separator
 * is a caret, and codes contain internal spaces ("C HBA1") — duplicating this
 * split is how the "split on whitespace" bug comes back. Any new consumer uses
 * this hook rather than re-parsing the summary.
 *
 * The catalog (~324 Firestore docs) is fetched only when `load()` is called —
 * i.e. on first expand, never on mount. `loadAnalysesCatalog` is idempotent and
 * module-cached, so calling `load()` early (on hover/focus, to make the tap feel
 * instant) costs nothing.
 */

import { useCallback, useMemo, useState } from 'react';
import type { AnalyseItem } from '@/components/features/catalog/AnalysisCard';
import { loadAnalysesCatalog, buildCodeMap, resolveAnalysisName } from '@/lib/analyses/catalog';

export function useAnalysesLabels(summary: string, isArabic: boolean) {
  const [map, setMap] = useState<Map<string, AnalyseItem> | null>(null);
  const [loading, setLoading] = useState(false);

  // The lab's real separator is a caret "^" (e.g. "C HBA1^C U^C CR^EZALAT").
  // Codes are the FULL prefixed ids and DO contain internal spaces ("C HBA1"),
  // so we must NOT split on whitespace — only on ^ / , / ; / | . Lookup
  // normalization strips the spaces so "C HBA1" matches the catalog id "C  HBA1".
  const codes = useMemo(
    () =>
      (summary || '')
        .split(/[\^,;|]+/)
        .map((c) => c.trim())
        .filter(Boolean),
    [summary]
  );

  const load = useCallback(async () => {
    if (map || loading) return;
    setLoading(true);
    try {
      const catalog = await loadAnalysesCatalog();
      setMap(buildCodeMap(catalog));
    } finally {
      setLoading(false);
    }
  }, [map, loading]);

  /** Resolved names once the catalog is in; the raw codes until then. */
  const labels = useMemo(
    () => codes.map((c) => (map ? resolveAnalysisName(c, map, isArabic) : c)),
    [codes, map, isArabic]
  );

  return { codes, labels, ready: map !== null, loading, load };
}
