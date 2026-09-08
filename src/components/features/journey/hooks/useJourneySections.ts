"use client";

import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import type { PreparationRules } from '@/hooks/usePreparationRules';
import type { CartView } from '@/lib/cart/cartView';
import { TRANSMISSION_MODES, WANT_TO_KNOW_KEYS } from '@/lib/journey/types';
import type { JourneyForm } from './useJourneyForm';

/**
 * Ce que chaque étape du parcours affiche quand elle est REPLIÉE : un résumé de
 * la réponse, et un état de complétion (coche verte / pastille ambre).
 *
 * Vit à part de `useJourneyForm` parce que c'est de la PRÉSENTATION : ça mélange
 * l'état du formulaire, celui du panier et les traductions. `useJourneyForm`
 * reste, lui, la source de vérité de l'état pur.
 *
 * ### Règle des marqueurs
 * - **coche verte** = l'étape est renseignée et valide ;
 * - **pastille ambre** = l'étape est OBLIGATOIRE et il y manque quelque chose,
 *   affichée seulement `once wave 2 est visible` — signaler « il manque quelque
 *   chose » avant que le patient ait eu l'occasion de répondre serait une
 *   réprimande, pas une aide ;
 * - **rien** = étape facultative (souhaits) ou purement informative
 *   (réponse immédiate, accès aux résultats).
 */
export type SectionStatus = 'done' | 'incomplete' | 'none';

export interface JourneySectionInfo {
  status: SectionStatus;
  summary: string;
}

export interface UseJourneySectionsArgs {
  form: JourneyForm;
  hasCart: boolean;
  cartView: CartView;
  preparation: PreparationRules;
  answerComplete: boolean;
  attachedFileCount: number;
  restoredUrlCount: number;
  accessLabel: string;
  locale: string;
  currencyLabel: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: TFunction<any, any>;
}

export function useJourneySections({
  form,
  hasCart,
  cartView,
  preparation,
  answerComplete,
  attachedFileCount,
  restoredUrlCount,
  accessLabel,
  locale,
  currencyLabel,
  t,
}: UseJourneySectionsArgs): Record<string, JourneySectionInfo> {
  const {
    hasPrescription,
    transmission,
    wantToKnow,
    samplingPlace,
    adresse,
    selectedDate,
    selectedTime,
    replyChannel,
    nom,
    telephone,
    intentDone,
    isHomeService,
    needsHumanAnswer,
  } = form;

  return useMemo(() => {
    const money = (n: number) => `${n.toLocaleString(locale)} ${currencyLabel}`;
    const dash = '—';
    /** Ambre seulement une fois que le patient a exprimé son intention. */
    const required = (ok: boolean): SectionStatus =>
      ok ? 'done' : intentDone ? 'incomplete' : 'none';

    // 1 — Ordonnance + modes de transmission
    const modes = TRANSMISSION_MODES.filter((m) => transmission[m]).map((m) =>
      t(`prescription.mode_${m}_title${m === 'freetext' && hasPrescription === 'no' ? '_no' : ''}`)
    );
    const prescriptionSummary =
      hasPrescription === null
        ? dash
        : [
            `${t('prescription.summary_label')} ${
              hasPrescription === 'yes' ? t('prescription.yes_short') : t('prescription.no_short')
            }`,
            modes.length ? modes.join(' · ') : null,
          ]
            .filter(Boolean)
            .join(' — ');

    // 2 — Panier
    const analysesCount = cartView.lines.length;
    const cartSummary = !hasCart
      ? t('cart.empty')
      : answerComplete
        // Un montant affiche dans un en-tete replie doit porter sa reserve :
        // le patient peut ne jamais deplier la section ou elle figure en toutes
        // lettres.
        ? `${t('cart.count', { count: analysesCount })} · ${money(cartView.total)} ${t('cart.estimated_short')}`
        : t('cart.count', { count: analysesCount });

    // Réponse immédiate — informative, jamais de marqueur
    const answerBits: string[] = [];
    if (hasCart && answerComplete) answerBits.push(money(cartView.total));
    if (hasCart) {
      answerBits.push(
        preparation.maxJeune > 0
          ? t('answer.fasting_required', { hours: preparation.maxJeune })
          : t('answer.fasting_none')
      );
      answerBits.push(
        preparation.maxDRR > 0
          ? t('answer.delay_days', { count: preparation.maxDRR })
          : t('answer.delay_same_day')
      );
    }
    if (needsHumanAnswer) answerBits.push(t('answer.human_title'));

    // 3 — Souhaits (facultatif)
    const wants = WANT_TO_KNOW_KEYS.filter((k) => wantToKnow[k]).map((k) => t(`want.${k}`));

    // 4 — Lieu
    const placeOk = !isHomeService || adresse.trim() !== '';
    const placeSummary = [t(`place.${samplingPlace}`), isHomeService ? adresse.trim() : '']
      .filter(Boolean)
      .join(' — ');

    // 5 — Date et créneau
    const dateOk = Boolean(selectedDate && selectedTime);
    const dateStr = selectedDate ? selectedDate.toLocaleDateString(locale) : '';
    const whenSummary = dateOk ? `${dateStr} · ${selectedTime}` : dateStr || dash;

    // 7 — Identité
    const identityOk = nom.trim() !== '' && telephone.trim() !== '';
    const identitySummary = identityOk ? `${nom.trim()} · ${telephone.trim()}` : dash;

    return {
      prescription: {
        status: required(intentDone),
        summary: prescriptionSummary,
      },
      cart: {
        status: hasCart ? 'done' : 'none',
        summary: cartSummary,
      },
      answer: {
        status: 'none',
        summary: answerBits.join(' · ') || dash,
      },
      want: {
        status: wants.length > 0 ? 'done' : 'none',
        summary: wants.length ? wants.join(', ') : t('want.summary_none'),
      },
      place: {
        status: required(placeOk),
        summary: placeSummary || dash,
      },
      when: {
        status: required(dateOk),
        summary: whenSummary,
      },
      channel: {
        status: 'done',
        summary: t(`channel.${replyChannel}`),
      },
      identity: {
        status: required(identityOk),
        summary: identitySummary,
      },
      access: {
        status: 'none',
        summary: accessLabel,
      },
      // Le nombre de pièces jointes n'apparaît pas dans un résumé mais fait
      // partie des dépendances : il change `intentDone`.
      __files: { status: 'none', summary: String(attachedFileCount + restoredUrlCount) },
    } as Record<string, JourneySectionInfo>;
  }, [
    hasPrescription,
    transmission,
    wantToKnow,
    samplingPlace,
    adresse,
    selectedDate,
    selectedTime,
    replyChannel,
    nom,
    telephone,
    intentDone,
    isHomeService,
    needsHumanAnswer,
    hasCart,
    cartView,
    preparation,
    answerComplete,
    attachedFileCount,
    restoredUrlCount,
    accessLabel,
    locale,
    currencyLabel,
    t,
  ]);
}
