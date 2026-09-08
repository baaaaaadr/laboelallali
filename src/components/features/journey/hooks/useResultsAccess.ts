"use client";

import { useCallback, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getClientFunctions } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Les trois états de l'accès aux résultats en ligne, réutilisant les callables
 * déjà en production (`myAccessRequest`, `requestResultsAccess`) — voir
 * `functions/src/admin/adminPatients.ts` et `docs/pages/resultats.md` §4.
 *
 * ⚠ `granted` ne coûte AUCUN appel réseau : `requestResultsAccess` renvoie
 * `already_granted` sur la seule présence de `users/{uid}.requester_id`, et
 * `AuthContext` charge déjà ce champ. On lit donc le profil, point.
 *
 * ⚠ L'appel `myAccessRequest` est DIFFÉRÉ : il ne part que lorsque la section
 * devient visible (`enabled`), pas au montage de la page. Sinon chaque ouverture
 * du parcours coûterait un aller-retour de fonction, y compris aux patients qui
 * n'iront jamais jusqu'en bas.
 *
 * ⚠ `source: 'results_page'` est volontaire. La liste blanche serveur
 * (`REQUEST_SOURCES`) vaut `signup | results_page | admin` ; une valeur inconnue
 * ne lève PAS d'erreur, elle affiche « Non précisée » dans l'e-mail au personnel.
 * Ajouter une entrée dédiée demanderait un déploiement de fonctions — à faire au
 * prochain déploiement `functions` pour une autre raison, pas pour ce détail.
 */
export type AccessState = 'idle' | 'checking' | 'granted' | 'pending' | 'rejected' | 'none';

export interface UseResultsAccessResult {
  state: AccessState;
  requesting: boolean;
  error: string | null;
  request: () => Promise<void>;
}

export function useResultsAccess(
  enabled: boolean,
  messages: { needProfile: string; generic: string }
): UseResultsAccessResult {
  const { user, userProfile, refreshProfile } = useAuth();
  const [state, setState] = useState<AccessState>('idle');
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !user) return;
    if (userProfile?.requester_id) {
      setState('granted');
      return;
    }
    // Une seule interrogation : on ne repart pas si l'état est déjà connu.
    if (state !== 'idle') return;

    let alive = true;
    setState('checking');
    (async () => {
      try {
        const functions = await getClientFunctions();
        if (!functions) {
          if (alive) setState('none');
          return;
        }
        const call = httpsCallable<Record<string, never>, { status: string | null }>(
          functions,
          'myAccessRequest'
        );
        const res = await call({} as Record<string, never>);
        if (!alive) return;
        const status = res.data?.status;
        setState(status === 'pending' ? 'pending' : status === 'rejected' ? 'rejected' : 'none');
      } catch {
        // Une panne ici ne doit jamais bloquer l'envoi de la demande.
        if (alive) setState('none');
      }
    })();
    return () => {
      alive = false;
    };
  }, [enabled, user, userProfile?.requester_id, state]);

  const request = useCallback(async () => {
    setRequesting(true);
    setError(null);
    try {
      const functions = await getClientFunctions();
      if (!functions) throw new Error('functions unavailable');
      const call = httpsCallable<{ source: string }, { status: string }>(
        functions,
        'requestResultsAccess'
      );
      const res = await call({ source: 'results_page' });
      if (res.data?.status === 'already_granted') {
        await refreshProfile();
        setState('granted');
      } else {
        setState('pending');
      }
    } catch (err: unknown) {
      // Même découpage d'erreur que /resultats : le préfixe `functions/` est retiré.
      const raw = (err as { code?: string })?.code ?? '';
      const code = raw.startsWith('functions/') ? raw.slice('functions/'.length) : raw;
      setError(code === 'failed-precondition' ? messages.needProfile : messages.generic);
    } finally {
      setRequesting(false);
    }
  }, [messages.generic, messages.needProfile, refreshProfile]);

  return { state, requesting, error, request };
}
