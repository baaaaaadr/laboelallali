'use client';

/**
 * Collapsible "Détails des analyses" for a result card. Collapsed by default; on
 * first expand it lazy-loads the analyses catalog and maps each terse lab code to
 * its patient-facing name (unknown codes are shown as-is). See src/lib/analyses/catalog.ts.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AnalyseItem } from '@/components/features/catalog/AnalysisCard';
import { loadAnalysesCatalog, buildCodeMap, resolveAnalysisName } from '@/lib/analyses/catalog';
import MedicalLoader from '@/components/ui/MedicalLoader';

export default function AnalysesDetails({
  summary,
  isArabic,
}: {
  summary: string;
  isArabic: boolean;
}) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [map, setMap] = useState<Map<string, AnalyseItem> | null>(null);
  const [loading, setLoading] = useState(false);

  // The lab's real separator isn't always a comma (the spec example was misleading):
  // split on any run of comma / semicolon / pipe / whitespace. Lab codes are terse
  // abbreviations without internal spaces, so this is safe.
  const codes = (summary || '')
    .split(/[\s,;|]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (!codes.length) return null;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !map && !loading) {
      setLoading(true);
      try {
        const catalog = await loadAnalysesCatalog();
        setMap(buildCodeMap(catalog));
      } finally {
        setLoading(false);
      }
    }
  };

  const ClosedChevron = isArabic ? ChevronLeft : ChevronRight;

  return (
    <div className="text-sm">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 font-medium text-[var(--text-secondary)] hover:text-[var(--color-bordeaux-primary)] transition-colors"
      >
        {open ? <ChevronDown size={16} /> : <ClosedChevron size={16} />}
        {t('resultats.analyses_details', 'Détails des analyses')} ({codes.length})
      </button>

      {open && (
        <div className="mt-2 ps-5">
          {loading || !map ? (
            <MedicalLoader size="sm" />
          ) : (
            <ul className="space-y-1 list-disc ps-4">
              {codes.map((code, i) => (
                <li key={`${code}-${i}`} className="text-[var(--text-primary)]">
                  {resolveAnalysisName(code, map, isArabic)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
