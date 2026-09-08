"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNow } from '@/hooks/useNow';
import { generateTimeSlots, hasBookableSlots, nextBookableDate } from '@/utils/timeSlots';

/**
 * Date + créneau, câblés sur les horaires réels d'ouverture.
 *
 * Ce montage était copié à l'identique dans `/rendez-vous` et `/glabo`. Il porte
 * trois pièges documentés (`docs/pages/glabo.md` §1) qu'il ne faut pas réécrire :
 *
 * 1. **`useNow()` vaut `null` jusqu'au montage.** Ces pages sont pré-rendues :
 *    tout `new Date()` évalué pendant un rendu que le serveur exécute aussi se
 *    fige dans le HTML statique — c'est exactement ce qui avait bloqué le badge
 *    « Ouvert » de la page d'accueil. `selectedDate` démarre donc à `null`
 *    (serveur et premier rendu client d'accord) et n'est semé qu'en effet.
 *
 * 2. **Le semis utilise la forme fonctionnelle `current ?? …`**, pour ne jamais
 *    écraser une date que le patient a déjà choisie.
 *
 * 3. **`setDate` DOIT vider le créneau** quand la nouvelle date ne le propose
 *    plus (17 h choisi un mardi, puis bascule sur un samedi qui ferme à 13 h).
 *    Sans cela le `<select>` s'affiche vide tout en conservant la valeur périmée,
 *    et le laboratoire reçoit une demande pour une heure de fermeture.
 *
 * Ne jamais redéfinir les horaires localement : `src/constants/labHours.ts` est
 * le seul planning lisible par la machine, partagé avec le badge d'ouverture.
 */
export interface UseLabScheduleResult {
  /** `Date | null` — null jusqu'au montage (sécurité SSR). */
  now: Date | null;
  selectedDate: Date | null;
  selectedTime: string;
  /** Créneaux « HH:MM » du jour choisi, ceux déjà passés aujourd'hui exclus. */
  timeSlots: string[];
  /** Passe TOUJOURS par ici, jamais par un `setSelectedDate` direct. */
  setDate: (date: Date | null) => void;
  setTime: (time: string) => void;
  /** Prédicat pour `filterDate` de react-datepicker : grise les jours fermés. */
  isDayBookable: (date: Date) => boolean;
}

export function useLabSchedule(): UseLabScheduleResult {
  const now = useNow();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');

  useEffect(() => {
    if (!now) return;
    setSelectedDate((current) => current ?? nextBookableDate(now));
  }, [now]);

  const timeSlots = useMemo(() => generateTimeSlots(selectedDate, now), [selectedDate, now]);

  const setDate = useCallback(
    (date: Date | null) => {
      setSelectedDate(date);
      const slots = generateTimeSlots(date, now);
      setSelectedTime((current) => (current && slots.includes(current) ? current : ''));
    },
    [now]
  );

  const isDayBookable = useCallback((date: Date) => hasBookableSlots(date, now), [now]);

  return { now, selectedDate, selectedTime, timeSlots, setDate, setTime: setSelectedTime, isDayBookable };
}
