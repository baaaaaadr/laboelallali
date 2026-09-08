"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { FREETEXT_MAX, type PrescriptionAnswer } from '@/lib/journey/types';

/**
 * Zone de texte libre. Le libellé change selon la réponse à la question 1 :
 * "recopiez les analyses de votre ordonnance" (oui) ou "décrivez les analyses
 * que vous souhaitez faire" (non).
 *
 * ⚠ Jamais "décrivez vos symptômes" : un laboratoire d'analyses ne recueille pas
 * de plainte médicale, et la formulation validée parle des ANALYSES souhaitées.
 */
export interface FreeTextPanelProps {
  value: string;
  onChange: (value: string) => void;
  hasPrescription: PrescriptionAnswer;
}

export default function FreeTextPanel({ value, onChange, hasPrescription }: FreeTextPanelProps) {
  const { t } = useTranslation('journey');
  const isYes = hasPrescription === 'yes';

  return (
    <div>
      <label
        htmlFor="journey-freetext"
        className="block text-sm font-medium text-[var(--text-primary)] mb-2"
      >
        {isYes ? t('freetext.label_yes') : t('freetext.label_no')}
      </label>
      <textarea
        id="journey-freetext"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={FREETEXT_MAX}
        placeholder={isYes ? t('freetext.placeholder_yes') : t('freetext.placeholder_no')}
        className="block w-full rounded-lg border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)]"
      />
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--text-tertiary)]">{t('freetext.help')}</p>
        <p className="text-xs text-[var(--text-tertiary)] tabular-nums flex-shrink-0">
          {t('freetext.counter', { count: value.length, max: FREETEXT_MAX })}
        </p>
      </div>
    </div>
  );
}
