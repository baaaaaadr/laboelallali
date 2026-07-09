'use client';

/**
 * "Indicateurs" bar at the top of the results page — an at-a-glance summary of the
 * patient's bilan history: total count, date of the most recent bilan, and (when the
 * history spans multiple years) the year follow-up started.
 *
 * Numbers/dates are localized via `Intl` (Arabic-Indic digits under `ar`), so there
 * are NO plural i18n keys. Stats come from the shared pure `computeResultsStats` — the
 * same source the checkup reminder uses, so the two never disagree. Results-page only.
 */

import { Files, CalendarClock, History } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CyberlabResult } from '@/types/cyberlab';
import { computeResultsStats } from '@/lib/results/stats';

export default function ResultsIndicators({
  results,
  lang,
}: {
  results: CyberlabResult[];
  lang: string;
}) {
  const { t } = useTranslation('common');
  const isArabic = lang === 'ar';
  const s = computeResultsStats(results);

  const formatInt = (n: number) =>
    new Intl.NumberFormat(isArabic ? 'ar-MA' : 'fr-FR', { useGrouping: false }).format(n);
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(isArabic ? 'ar-MA' : 'fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
  };

  const tiles: { icon: LucideIcon; value: string; label: string }[] = [
    {
      icon: Files,
      value: formatInt(s.count),
      label: t('resultats.stats_bilans_label', 'Bilans'),
    },
    {
      icon: CalendarClock,
      value: s.newestIso ? formatDate(s.newestIso) : '—',
      label: t('resultats.stats_last_label', 'Dernier bilan'),
    },
  ];

  // "Suivi depuis" only adds information when the history actually spans >1 year.
  if (s.oldestYear !== null && s.newestYear !== null && s.oldestYear < s.newestYear) {
    tiles.push({
      icon: History,
      value: formatInt(s.oldestYear),
      label: t('resultats.stats_since_label', 'Suivi depuis'),
    });
  }

  // Static class strings so Tailwind's scanner keeps them.
  const cols = tiles.length >= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2';

  return (
    <div className={`grid ${cols} gap-3`}>
      {tiles.map(({ icon: Icon, value, label }, i) => (
        <div key={i} className="card p-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 text-[var(--color-bordeaux-primary)] flex items-center justify-center flex-shrink-0">
            <Icon size={20} />
          </div>
          <div className="min-w-0 text-start">
            {/* Label first, value below — reads naturally for dates/years
                ("Suivi depuis 2021"), and keeps all three tiles consistent. */}
            <div className="text-xs text-[var(--text-tertiary)] font-medium">{label}</div>
            <div className="text-base sm:text-lg font-bold text-[var(--text-primary)] tabular-nums leading-tight truncate">
              {value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
