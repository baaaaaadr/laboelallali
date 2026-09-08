"use client";

import React from 'react';
import { Clock, Coffee, TestTube, AlertTriangle, Loader2, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CartView } from '@/lib/cart/cartView';
import type { PreparationRules } from '@/hooks/usePreparationRules';

/**
 * La réponse immédiate : prix, jeûne et délai affichés SANS attendre, dès que le
 * patient est passé par le catalogue.
 *
 * C'est le cœur de la promesse du parcours. L'application connaît déjà tout
 * (`Prix_Dhs`, `CPA_Jeune_H`, `DRR_Jours` voyagent dans le panier), donc rien ne
 * justifie de faire patienter le patient. Seules les ordonnances photographiées
 * et les demandes en texte libre appellent une réponse humaine du biologiste —
 * les deux blocs peuvent coexister : un patient qui joint son ordonnance ET
 * ajoute deux analyses du catalogue voit les chiffres pour ce qu'on sait
 * calculer, et l'annonce d'une réponse humaine pour le reste.
 *
 * ⚠ `complete === false` (composition de bilan pas encore résolue) masque le
 * TOTAL. Mieux vaut un instant de chargement qu'un devis sous-évalué : les
 * compositions non résolues sont valorisées à 0 par `computeCartView`.
 *
 * ⚠ La mention "estimation, tarif à confirmer au laboratoire" est obligatoire
 * partout où un montant s'affiche.
 */
export interface ImmediateAnswerCardProps {
  /** Langue courante : décide quelle version des consignes patient afficher. */
  isArabic: boolean;
  hasCart: boolean;
  complete: boolean;
  needsHumanAnswer: boolean;
  cartView: CartView;
  preparation: PreparationRules;
  locale: string;
  currencyLabel: string;
}

export default function ImmediateAnswerCard({
  isArabic,
  hasCart,
  complete,
  needsHumanAnswer,
  cartView,
  preparation,
  locale,
  currencyLabel,
}: ImmediateAnswerCardProps) {
  const { t } = useTranslation('journey');
  const { maxJeune, maxDRR, sampleTypes } = preparation;
  // ⚠ `Pre_Analytique_*` et NON `CPA_Instructions`. Ce dernier est la fiche
  // technique du préleveur (tubes, centrifugation, congélation) : 153/304
  // analyses seulement, et AUCUNE traduction arabe — preuve qu'il n'a jamais été
  // écrit pour un patient. Voir `usePreparationRules`.
  const patientNotes = isArabic
    ? preparation.patientPreparationAr
    : preparation.patientPreparation;
  const money = (n: number) => `${n.toLocaleString(locale)} ${currencyLabel}`;

  return (
    <div className="space-y-4">
      {hasCart && (
        <>
          {complete ? (
            <div className="rounded-xl border-2 border-[var(--color-bordeaux-primary)]/30 bg-[var(--color-bordeaux-primary)]/5 dark:bg-[var(--color-bordeaux-primary)]/10 p-4">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--text-secondary)]">{t('answer.items_label')}</dt>
                  <dd className="tabular-nums">{money(cartView.itemsTotal)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--text-secondary)]">{t('answer.fee_label')}</dt>
                  <dd className="tabular-nums">{money(cartView.samplingFee)}</dd>
                </div>
                <div className="flex justify-between gap-3 pt-2 mt-2 border-t border-[var(--color-bordeaux-primary)]/20 text-base font-bold">
                  <dt>{t('answer.total_label')}</dt>
                  <dd className="tabular-nums text-[var(--color-bordeaux-primary)]">
                    {money(cartView.total)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                {t('answer.estimate_disclaimer')}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border-default)] p-4 flex items-center gap-3 text-sm text-[var(--text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" aria-hidden="true" />
              <span>{t('answer.incomplete')}</span>
            </div>
          )}

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <li className="flex items-start gap-2.5 rounded-lg border border-[var(--border-default)] p-3">
              <Coffee
                className="h-4 w-4 mt-0.5 flex-shrink-0 text-[var(--color-bordeaux-primary)]"
                aria-hidden="true"
              />
              <span className="text-sm">
                {maxJeune > 0
                  ? t('answer.fasting_required', { hours: maxJeune })
                  : t('answer.fasting_none')}
              </span>
            </li>
            <li className="flex items-start gap-2.5 rounded-lg border border-[var(--border-default)] p-3">
              <Clock
                className="h-4 w-4 mt-0.5 flex-shrink-0 text-[var(--color-bordeaux-primary)]"
                aria-hidden="true"
              />
              <span className="text-sm">
                {maxDRR > 0 ? t('answer.delay_days', { count: maxDRR }) : t('answer.delay_same_day')}
              </span>
            </li>
            {sampleTypes.length > 0 && (
              <li className="flex items-start gap-2.5 rounded-lg border border-[var(--border-default)] p-3">
                <TestTube
                  className="h-4 w-4 mt-0.5 flex-shrink-0 text-[var(--color-bordeaux-primary)]"
                  aria-hidden="true"
                />
                <span className="text-sm">
                  <span className="text-[var(--text-secondary)]">{t('answer.sample_types')} : </span>
                  {sampleTypes.join(', ')}
                </span>
              </li>
            )}
            {patientNotes.length > 0 && (
              <li className="sm:col-span-2 flex items-start gap-2.5 rounded-lg border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/5 p-3">
                <AlertTriangle
                  className="h-4 w-4 mt-0.5 flex-shrink-0 text-[var(--status-warning)]"
                  aria-hidden="true"
                />
                <span className="text-sm">
                  <span className="text-[var(--text-secondary)]">
                    {t('answer.patient_preparation')} :{' '}
                  </span>
                  {patientNotes.join(' · ')}
                </span>
              </li>
            )}
          </ul>
        </>
      )}

      {needsHumanAnswer && (
        <div className="rounded-xl border border-[var(--status-info)]/40 bg-[var(--status-info)]/5 p-4 flex items-start gap-3">
          <UserCheck
            className="h-5 w-5 mt-0.5 flex-shrink-0 text-[var(--status-info)]"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold text-sm text-[var(--text-primary)]">
              {t('answer.human_title')}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('answer.human_body')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
