"use client";

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
  JOURNEY_SEGMENT,
  catalogPathFromJourney,
  rememberJourneyOrigin,
} from '@/lib/journey/route';
import type { JourneyVariant } from '@/lib/journey/types';

import type { JourneyForm } from './useJourneyForm';
import type { UseJourneyDraftResult } from './useJourneyDraft';

/**
 * Le brouillon : restauration au montage, et sauvegarde avant l'aller-retour
 * vers le catalogue.
 *
 * Partagé par les deux mises en page du parcours (`/test-rdv` à huit blocs,
 * `/test-rdv2` à quatre groupes) : perdre la saisie d'un patient parce que
 * l'une des deux a oublié un champ dans son instantané serait invisible en
 * revue de code et très visible pour le patient.
 *
 * ⚠ La restauration ne tourne QU'UNE FOIS, au montage. `useJourneyDraft.load()`
 * se garde lui-même (`loadedOnce`), mais l'effet doit rester à dépendances
 * vides : le relancer écraserait ce que le patient vient de taper.
 *
 * ⚠ `wantsAppointment` est absent des brouillons enregistrés avant le lot
 * « réponse d'abord » (11/09/2026). On ne l'applique que si c'est bien un
 * booléen — sinon la valeur par défaut du hook (selon `variant`) reste en
 * place, jamais écrasée par `undefined`.
 */
export interface UseJourneyPersistenceArgs {
  lang: string;
  variant: JourneyVariant;
  /**
   * L'adresse de CETTE mise en page (`test-rdv` ou `test-rdv2`). Mémorisée
   * avant le départ vers le catalogue pour que le bouton « Prendre RDV » y
   * ramène — voir `rememberJourneyOrigin` dans `src/lib/journey/route.ts`.
   */
  segment?: string;
  form: JourneyForm;
  draft: UseJourneyDraftResult;
  restoredUrls: string[];
  setRestoredUrls: (urls: string[]) => void;
}

export interface UseJourneyPersistenceResult {
  /** Sauve le brouillon puis part vers `/analyses`. */
  openCatalog: () => void;
}

export function useJourneyPersistence({
  lang,
  variant,
  segment = JOURNEY_SEGMENT,
  form,
  draft,
  restoredUrls,
  setRestoredUrls,
}: UseJourneyPersistenceArgs): UseJourneyPersistenceResult {
  const router = useRouter();
  const { load: loadDraft, save: saveDraft } = draft;

  useEffect(() => {
    const d = loadDraft();
    if (!d) return;
    form.setHasPrescription(d.hasPrescription);
    form.setTransmission(d.transmission);
    form.setWantToKnow(d.wantToKnow);
    form.setFreeText(d.freeText);
    form.setSamplingPlace(d.samplingPlace);
    form.setAdresse(d.adresse);
    form.setInstructionsAcces(d.instructionsAcces);
    form.setReplyChannel(d.replyChannel);
    if (typeof d.wantsAppointment === 'boolean') form.setWantsAppointment(d.wantsAppointment);
    if (d.time) form.setTime(d.time);
    if (d.dateISO) form.setDate(new Date(d.dateISO));
    if (d.nom) form.setNom(d.nom);
    if (d.telephone) form.setTelephone(d.telephone);
    if (d.email) form.setEmail(d.email);
    setRestoredUrls(d.uploadedUrls || []);
    // Restauration unique au montage : voir le commentaire de tête.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCatalog = useCallback(() => {
    rememberJourneyOrigin(segment);
    saveDraft({
      variant,
      hasPrescription: form.hasPrescription,
      transmission: form.transmission,
      freeText: form.freeText,
      wantToKnow: form.wantToKnow,
      samplingPlace: form.samplingPlace,
      adresse: form.adresse,
      instructionsAcces: form.instructionsAcces,
      dateISO: form.selectedDate ? form.selectedDate.toISOString() : null,
      time: form.selectedTime,
      replyChannel: form.replyChannel,
      wantsAppointment: form.wantsAppointment,
      nom: form.nom,
      telephone: form.telephone,
      email: form.email,
      uploadedUrls: restoredUrls,
    });
    router.push(catalogPathFromJourney(lang, segment));
  }, [saveDraft, variant, segment, form, restoredUrls, router, lang]);

  return { openCatalog };
}
