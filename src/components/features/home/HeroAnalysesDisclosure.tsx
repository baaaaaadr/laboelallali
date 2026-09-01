'use client';

/**
 * "Détails des analyses (13)" inside the hero — the same brain as the results
 * page, a different skin.
 *
 * Not `AnalysesDetails` reused as-is: `.hero-banner * { color: white !important }`
 * overrides all of its light-surface tokens, so the button, the bullets and the
 * labels collapse to one flat white, the hover does nothing, and its coloured
 * `MedicalLoader` reads as a glitch on frosted glass — while nothing *looks*
 * broken, so nobody would fix it. The parsing and code→name resolution are
 * shared through `useAnalysesLabels`; only the markup differs.
 *
 * **Collapsed by default, and never auto-expanded.** This is what keeps the
 * widget compliant: the signed consent says results are shown "au moment où j'en
 * fais la demande" — the tap IS the request. Analysis names (HbA1c, serology…)
 * are also what would be on screen when someone hands their phone to a relative.
 * The open state is never persisted, in any form.
 */

import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAnalysesLabels } from '@/hooks/useAnalysesLabels';

export default function HeroAnalysesDisclosure({
  summary,
  isArabic,
}: {
  summary: string;
  isArabic: boolean;
}) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const { codes, labels, ready, load } = useAnalysesLabels(summary, isArabic);

  if (!codes.length) return null;

  const ClosedChevron = isArabic ? ChevronLeft : ChevronRight;

  return (
    <div className="hero-panel__analyses">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
        // Warm the catalog before the tap so opening feels instant. The loader is
        // idempotent and module-cached, so this costs nothing if it already ran.
        onPointerEnter={() => void load()}
        onFocus={() => void load()}
        aria-expanded={open}
        className="hero-panel__analyses-toggle"
      >
        {open ? <ChevronDown size={15} aria-hidden="true" /> : <ClosedChevron size={15} aria-hidden="true" />}
        {t('resultats.analyses_details', 'Détails des analyses')} ({codes.length})
      </button>

      {open && (
        <ul className="hero-panel__analyses-list">
          {(ready ? labels : codes).map((label, i) => (
            <li key={`${codes[i]}-${i}`}>{label}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
