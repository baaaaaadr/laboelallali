'use client';

/**
 * Collapsible "Détails des analyses" for a result card. Collapsed by default; on
 * first expand it lazy-loads the analyses catalog and maps each terse lab code to
 * its patient-facing name (unknown codes are shown as-is).
 *
 * This is the light-surface skin, used by `/resultats` and `/admin`. The parsing
 * and code→name resolution live in `useAnalysesLabels` so the home hero can wear
 * a different skin over the same brain — see that hook, and
 * `src/components/features/home/HeroAnalysesDisclosure.tsx`.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAnalysesLabels } from '@/hooks/useAnalysesLabels';
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
  const { codes, labels, ready, loading, load } = useAnalysesLabels(summary, isArabic);

  if (!codes.length) return null;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await load();
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
          {loading || !ready ? (
            <MedicalLoader size="sm" />
          ) : (
            <ul className="space-y-1 list-disc ps-4">
              {labels.map((label, i) => (
                <li key={`${codes[i]}-${i}`} className="text-[var(--text-primary)]">
                  {label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
