"use client";

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  promptInstall,
  subscribe,
  type InstallOutcome,
} from '@/lib/pwa/installStore';
import {
  detectCurrentPlatform,
  isInAppBrowser,
  type PwaPlatform,
} from '@/lib/pwa/platform';

/**
 * L'état d'installation de la PWA, pour un composant React.
 *
 * Branché sur `src/lib/pwa/installStore.ts` par `useSyncExternalStore` : tout
 * changement du magasin redessine **tous** les boutons en même temps. C'est
 * ce qui empêche le défaut signalé par un patient le 21/09/2026 — un bouton
 * resté affiché alors qu'il était devenu incapable d'agir.
 *
 * ⚠ Ce hook REMPLACE `usePWAInstall.ts` et `useInstallPrompt.ts`, tous deux
 * supprimés. Ils étaient morts depuis des mois (importés nulle part) tout en
 * étant cités comme la logique d'installation dans `CLAUDE.md` : la vraie
 * logique vivait, recopiée à la main, dans `PWAInstallButton.tsx`.
 *
 * ⚠ `platform` vaut `'other'` au premier rendu, serveur comme client, puis se
 * précise dans un effet. Lire `navigator` pendant le rendu provoquerait un
 * écart d'hydratation — et c'est ce que l'ancien composant contournait avec un
 * drapeau `isClientReady` qui masquait le bouton entier le temps d'un rendu.
 */
export type InstallState =
  | 'installed'
  /** Le dialogue natif est disponible : le vrai bouton. */
  | 'installable'
  /** Rien à lancer : on explique comment faire à la main. */
  | 'needs_help';

export interface UseInstallStateResult {
  state: InstallState;
  platform: PwaPlatform;
  /** Navigateur intégré à Facebook / Instagram : aucune installation possible. */
  inAppBrowser: boolean;
  /**
   * Le patient a lancé le dialogue natif puis l'a refusé, dans cette page.
   * Sert à ajouter une phrase que personne ne devine seul : la proposition ne
   * revient qu'au rechargement de la page.
   */
  dismissedHere: boolean;
  install: () => Promise<InstallOutcome>;
}

export function useInstallState(): UseInstallStateResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [platform, setPlatform] = useState<PwaPlatform>('other');
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const [dismissedHere, setDismissedHere] = useState(false);

  useEffect(() => {
    setPlatform(detectCurrentPlatform());
    setInAppBrowser(isInAppBrowser(navigator.userAgent));
  }, []);

  const install = async (): Promise<InstallOutcome> => {
    const outcome = await promptInstall();
    if (outcome === 'dismissed') setDismissedHere(true);
    return outcome;
  };

  const state: InstallState = snapshot.installed
    ? 'installed'
    : snapshot.canInstall
      ? 'installable'
      : 'needs_help';

  return { state, platform, inAppBrowser, dismissedHere, install };
}
