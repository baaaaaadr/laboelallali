'use client';

/**
 * The doctor's patients, one row each: name, date of the most recent report,
 * number of reports. Presentational — the workspace owns the selection.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, UserRound } from 'lucide-react';
import { displayName, type PatientGroup } from '@/lib/practitioner/patients';
import { formatDossierDate } from '@/lib/results/format';

interface Props {
  groups: PatientGroup[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  lang: string;
}

export default function PatientList({ groups, selectedKey, onSelect, lang }: Props) {
  const { t } = useTranslation('common');
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <ul className="space-y-2" data-testid="mp-patient-list">
      {groups.map((g) => {
        const selected = g.key === selectedKey;
        const name = g.nameless
          ? t('mes_patients.nameless', 'Patient sans nom — dossier {{id}}', { id: g.newestDossierId })
          : displayName(g);
        return (
          <li key={g.key}>
            <button
              type="button"
              onClick={() => onSelect(g.key)}
              aria-current={selected ? 'true' : undefined}
              data-testid="mp-patient"
              className={`w-full text-start card p-4 flex items-center gap-3 transition-colors border-2 ${
                selected
                  ? 'border-[var(--color-bordeaux-primary)]'
                  : 'border-transparent hover:border-[var(--border-default)]'
              }`}
            >
              <span className="h-10 w-10 rounded-full bg-[var(--color-bordeaux-primary)]/10 text-[var(--color-bordeaux-primary)] flex items-center justify-center flex-shrink-0">
                <UserRound size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[var(--text-primary)] truncate" data-testid="mp-patient-name">
                  {name}
                </span>
                <span className="block text-sm text-[var(--text-secondary)] mt-0.5">
                  {t('mes_patients.last_bilan', 'Dernier bilan : {{date}}', {
                    date: formatDossierDate(g.newestDate, lang, 'short') || '—',
                  })}
                </span>
              </span>
              <span className="flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)]">
                {t('mes_patients.bilans_count', { count: g.dossiers.length, defaultValue: '{{count}} bilans' })}
              </span>
              <Chevron size={18} className="flex-shrink-0 text-[var(--text-tertiary)]" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
