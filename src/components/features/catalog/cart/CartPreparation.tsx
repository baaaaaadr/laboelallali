"use client";

import React from 'react';
import {
  FileText, TestTube, AlertTriangle, CheckCircle2, CalendarCheck, Info,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PreparationRules } from '@/hooks/usePreparationRules';

interface CartPreparationProps {
  preparation: PreparationRules;
  total: number;
  locale: string;
  currencyLabel: string;
}

/**
 * Onglet "Préparation" partagé (identique sidebar / modale).
 * Affiche documents administratifs, types de prélèvements, instructions spéciales,
 * jeûne (warning ou OK), et un récap délai/total.
 */
export function CartPreparation({
  preparation,
  total,
  locale,
  currencyLabel,
}: CartPreparationProps) {
  const { t: tc } = useTranslation('catalog');
  const { maxJeune, maxDRR, sampleTypes, specialInstructions } = preparation;
  const requiresFasting = maxJeune > 0;

  return (
    <div className="space-y-3">
      {/* Documents */}
      <div className="rounded-xl border border-[var(--border-default)] overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 dark:bg-blue-900/50 border-b border-[var(--border-default)]">
          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-300 flex-shrink-0" />
          <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
            {tc('preparation_summary.card_documents_title', 'Documents Administratifs')}
          </h3>
        </div>
        <ul className="px-4 py-3 space-y-2">
          {[
            tc('preparation_summary.cin', "Carte d'Identité Nationale (CIN)"),
            tc('preparation_summary.mutuelle', 'Carte de Mutuelle / Assurance'),
            tc('preparation_summary.ordonnance', 'Ordonnance médicale (si vous en avez une)'),
          ].map((item, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              <span className="text-sm text-[var(--text-primary)]">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Sample types */}
      {sampleTypes.length > 0 && (
        <div className="rounded-xl border border-[var(--border-default)] overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-teal-50 dark:bg-teal-900/50 border-b border-[var(--border-default)]">
            <TestTube className="h-4 w-4 text-teal-600 dark:text-teal-300 flex-shrink-0" />
            <h3 className="font-semibold text-sm text-teal-900 dark:text-teal-100">
              {tc('preanalytic.type_label', 'Type de prélèvement')}
            </h3>
          </div>
          <div className="px-4 py-3 flex flex-wrap gap-2">
            {sampleTypes.map((type, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-700"
              >
                <TestTube className="h-3 w-3" />
                {type}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Special instructions + fasting */}
      <div className="space-y-2">
        {specialInstructions.length > 0 && (
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--background-default)] px-4 py-3 space-y-2">
            {specialInstructions.map((instr, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Info className="h-3.5 w-3.5 text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--text-primary)] leading-snug">
                  {instr}
                </p>
              </div>
            ))}
          </div>
        )}

        {requiresFasting ? (
          <div className="rounded-xl border border-orange-400 dark:border-orange-600 bg-orange-100 dark:bg-orange-900/30 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-orange-700 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-orange-900 dark:text-orange-200 leading-snug">
              {tc(
                'preparation_summary.fasting_warning',
                'Jeûne strict de {{hours}} heures requis avant votre prise de sang.',
                { hours: maxJeune }
              )}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-1 py-1">
            <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400 flex-shrink-0" />
            <p className="text-sm text-[var(--text-secondary)]">
              {tc(
                'preparation_summary.fasting_ok',
                'Aucun jeûne obligatoire pour vos analyses.'
              )}
            </p>
          </div>
        )}
      </div>

      {/* Délai + total */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--background-default)]">
        <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
          <CalendarCheck className="h-4 w-4 flex-shrink-0 text-[var(--text-tertiary)] mt-0.5" />
          <span className="leading-snug">
            {maxDRR === 0
              ? tc('preparation_summary.delay_same_day', 'Résultats disponibles le jour même.')
              : tc('preparation_summary.delay_days', 'Résultats sous {{days}} jour(s).', { days: maxDRR })}
          </span>
        </div>
        <span className="text-lg font-bold text-[#E3004F] flex-shrink-0 whitespace-nowrap">
          {total.toLocaleString(locale)} {currencyLabel}
        </span>
      </div>
    </div>
  );
}

export default CartPreparation;
