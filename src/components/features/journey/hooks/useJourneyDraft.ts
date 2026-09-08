"use client";

import { useCallback, useRef } from 'react';
import { DRAFT_STORAGE_KEY, DRAFT_TTL_MS, type JourneyDraft } from '@/lib/journey/types';

/**
 * Brouillon du parcours, en `sessionStorage`.
 *
 * Sert à deux allers-retours qui font sinon perdre toute la saisie :
 *  - vers `/analyses` (« choisir dans le catalogue ») ;
 *  - vers `/login` (connexion, ou session expirée en cours de formulaire).
 *
 * ⚠ Les objets `File` ne sont PAS sérialisables. Seules les URL déjà
 * téléversées survivent : l'appelant les affiche comme « ordonnance déjà
 * transmise », il ne fait pas semblant d'avoir encore les fichiers.
 *
 * `sessionStorage` et non `localStorage` : le brouillon ne doit pas ressurgir
 * trois semaines plus tard dans un autre onglet. TTL de 2 h par-dessus.
 */
export interface UseJourneyDraftResult {
  save: (draft: Omit<JourneyDraft, 'v' | 'savedAt'>) => void;
  /** Lit et CONSOMME le brouillon (une seule restauration par session). */
  load: () => JourneyDraft | null;
  clear: () => void;
}

export function useJourneyDraft(): UseJourneyDraftResult {
  const loadedOnce = useRef(false);

  const save = useCallback((draft: Omit<JourneyDraft, 'v' | 'savedAt'>) => {
    if (typeof window === 'undefined') return;
    try {
      const payload: JourneyDraft = { ...draft, v: 1, savedAt: Date.now() };
      window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* mode privé / quota : le brouillon est un confort, jamais une garantie */
    }
  }, []);

  const clear = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback((): JourneyDraft | null => {
    if (typeof window === 'undefined' || loadedOnce.current) return null;
    loadedOnce.current = true;
    try {
      const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as JourneyDraft;
      if (!parsed || parsed.v !== 1 || typeof parsed.savedAt !== 'number') return null;
      if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
        window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, []);

  return { save, load, clear };
}
