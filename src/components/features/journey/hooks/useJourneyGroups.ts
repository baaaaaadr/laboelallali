"use client";

import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import {
  JOURNEY_GROUP_ORDER,
  JOURNEY_GROUP_SECTIONS,
  type JourneyGroupId,
} from '@/lib/journey/groups';
import type { JourneySectionInfo, SectionStatus } from './useJourneySections';

/**
 * L'en-tête de chacun des QUATRE blocs : son résumé replié, sa coche, et le mot
 * « Obligatoire » / « Facultatif ».
 *
 * Se pose PAR-DESSUS `useJourneySections`, jamais à sa place. Les sections
 * gardent leur propre résumé (elles restent affichées à l'intérieur du bloc,
 * chacune sous son sous-titre) ; ce hook ne fait que les agréger.
 *
 * ### La règle des trois états, reprise telle quelle
 * - **coche verte** : le bloc est complet ;
 * - **pastille ambre** : le bloc est OBLIGATOIRE et il y manque quelque chose,
 *   affichée seulement une fois l'intention exprimée — signaler un manque avant
 *   que le patient ait eu l'occasion de répondre serait une réprimande ;
 * - **rien** : bloc facultatif que le patient n'a pas rempli.
 *
 * ### Le seul groupe dont l'obligation CHANGE
 * `rendezvous` suit `wantsAppointment` (`useJourneyForm.ts`). Quand le patient
 * a choisi « recevoir ma réponse d'abord », le bloc devient facultatif ET son
 * résumé le dit en toutes lettres (`group.rendezvous_skipped`) : un bloc marqué
 * « Facultatif » avec un résumé vide laisse croire à un oubli.
 */
export interface JourneyGroupInfo {
  status: SectionStatus;
  summary: string;
  obligation: 'required' | 'optional';
}

export interface UseJourneyGroupsArgs {
  /** La sortie de `useJourneySections`. */
  sections: Record<string, JourneySectionInfo>;
  /** L'intention est exprimée : la vague 2 est visible. */
  intentDone: boolean;
  /** Le patient veut-il réserver un créneau maintenant ? */
  wantsAppointment: boolean;
  /** Le panier est-il non vide ? Décide si son résumé mérite d'être repris. */
  hasCart: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: TFunction<any, any>;
}

export function useJourneyGroups({
  sections,
  intentDone,
  wantsAppointment,
  hasCart,
  t,
}: UseJourneyGroupsArgs): Record<JourneyGroupId, JourneyGroupInfo> {
  return useMemo(() => {
    const dash = '—';
    const required = (ok: boolean): SectionStatus =>
      ok ? 'done' : intentDone ? 'incomplete' : 'none';

    /** Concatène les résumés des sections d'un bloc, en écartant les tirets. */
    const join = (groupId: JourneyGroupId, skip: readonly string[] = []): string => {
      const parts = JOURNEY_GROUP_SECTIONS[groupId]
        .filter((id) => !skip.includes(id))
        .map((id) => sections[id]?.summary)
        .filter((s): s is string => Boolean(s) && s !== dash);
      return parts.length ? parts.join(' · ') : dash;
    };

    const placeDone = sections.place?.status === 'done';
    const whenDone = sections.when?.status === 'done';

    return {
      // 1 — Ce que le patient veut faire analyser. Le seul bloc qui existe
      //     avant que l'intention soit exprimée.
      analyses: {
        status: required(intentDone),
        // Le panier n'entre dans le résumé que s'il contient quelque chose :
        // sinon « Aucune analyse sélectionnée pour l'instant » viendrait
        // contredire une ordonnance déjà photographiée, juste à côté.
        summary: join('analyses', hasCart ? [] : ['cart']),
        obligation: 'required' as const,
      },

      // 2 — Comment le joindre. Obligatoire dans TOUS les cas : c'est la seule
      //     chose sans laquelle le laboratoire ne peut pas répondre, y compris
      //     aux deux cas fréquents qui n'ont pas besoin de rendez-vous.
      contact: {
        status: sections.identity?.status ?? 'none',
        summary: join('contact'),
        obligation: 'required' as const,
      },

      // 3 — Le rendez-vous. Facultatif tant que le patient n'a pas dit qu'il
      //     voulait réserver maintenant.
      rendezvous: {
        status: wantsAppointment ? required(placeDone && whenDone) : 'none',
        summary: wantsAppointment ? join('rendezvous') : t('group.rendezvous_skipped'),
        obligation: wantsAppointment ? ('required' as const) : ('optional' as const),
      },

      // 4 — Tout ce qui peut être ignoré sans conséquence.
      plus: {
        status: sections.want?.status ?? 'none',
        summary: join('plus'),
        obligation: 'optional' as const,
      },
    };
  }, [sections, intentDone, wantsAppointment, hasCart, t]);
}

/** Le nombre de blocs obligatoires encore incomplets — sert la phrase d'entête. */
export function countRemainingRequired(
  groups: Record<JourneyGroupId, JourneyGroupInfo>
): number {
  return JOURNEY_GROUP_ORDER.filter(
    (id) => groups[id].obligation === 'required' && groups[id].status !== 'done'
  ).length;
}
