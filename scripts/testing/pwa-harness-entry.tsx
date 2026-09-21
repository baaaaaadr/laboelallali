/**
 * Banc d'essai des boutons d'installation PWA.
 *
 * Monte les TROIS points d'entrée sur la même page — bas de page, icône du
 * menu, tuile de l'accueil — exactement comme l'application. C'est essentiel :
 * le défaut signalé par un patient le 21/09/2026 naissait de leur interaction
 * (le montage de l'un effaçait la capture d'installation des autres), et ne se
 * serait jamais vu en testant un bouton isolément.
 *
 * Le composant monté est le code de production, sans modification. Seule
 * frontière doublée : `react-i18next`, remplacé par une doublure qui lit les
 * VRAIS fichiers de traduction (`scripts/testing/stub-i18n.tsx`) — une clé
 * manquante s'affiche alors brute et le pilote la repère.
 *
 * ⚠ Le magasin (`src/lib/pwa/installStore.ts`) est le VRAI, y compris sa
 * capture de `beforeinstallprompt`. Le pilote émet un événement synthétique
 * portant `prompt()` et `userChoice`, ce que le navigateur ferait de lui-même
 * sur un appareil installable. C'est la limite du banc : le dialogue natif
 * d'Android n'est jamais réellement affiché.
 */
import React, { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import PWAInstallButton from '../../src/components/features/pwa/PWAInstallButton';
import { __resetForTests } from '../../src/lib/pwa/installStore';

declare global {
  interface Window {
    __lang?: string;
    __reset?: () => void;
    __mount?: () => void;
    __unmount?: () => void;
    /** Monte ou démonte la tuile de l'accueil, pour rejouer le défaut du montage croisé. */
    __setTileMounted?: (mounted: boolean) => void;
    /** Nombre d'appels réels à `prompt()` sur l'événement synthétique. */
    __promptCalls?: number;
    /** Ce que le patient répondra au dialogue natif simulé. */
    __nextOutcome?: 'accepted' | 'dismissed';
    /** Fabrique et émet un `beforeinstallprompt` synthétique. */
    __fireInstallPrompt?: () => void;
    /** Fabrique l'événement SANS l'émettre, et le dépose comme capture précoce. */
    __seedEarlyPrompt?: () => void;
    __fireAppInstalled?: () => void;
  }
}

window.__promptCalls = 0;
window.__nextOutcome = 'accepted';

/**
 * L'événement tel que Chrome le fabrique : un `Event` ordinaire auquel le
 * navigateur ajoute `prompt()` et `userChoice`.
 */
function makePromptEvent(): Event {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    platforms: string[];
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string; platform: string }>;
  };
  event.platforms = ['web'];
  event.prompt = async () => {
    window.__promptCalls = (window.__promptCalls ?? 0) + 1;
  };
  Object.defineProperty(event, 'userChoice', {
    get: () => Promise.resolve({ outcome: window.__nextOutcome ?? 'accepted', platform: 'web' }),
  });
  return event;
}

window.__fireInstallPrompt = () => {
  window.dispatchEvent(makePromptEvent());
};

window.__seedEarlyPrompt = () => {
  // Ce que fait le script du <head> du layout racine quand Chrome émet
  // l'événement AVANT que React ait monté quoi que ce soit.
  window.__pwaInstallPrompt = makePromptEvent() as never;
};

window.__fireAppInstalled = () => {
  window.dispatchEvent(new Event('appinstalled'));
};

let root: Root | null = null;
let setTile: ((mounted: boolean) => void) | null = null;

function Harness() {
  const [tileMounted, setTileMounted] = useState(true);
  setTile = setTileMounted;
  return (
    <div>
      <div id="slot-footer" data-slot="footer">
        <PWAInstallButton variant="footer" />
      </div>
      <div id="slot-icon" data-slot="icon">
        <PWAInstallButton variant="icon" />
      </div>
      <div id="slot-tile" data-slot="tile">
        {tileMounted && <PWAInstallButton variant="tile" />}
      </div>
    </div>
  );
}

window.__setTileMounted = (mounted: boolean) => setTile?.(mounted);

/**
 * ⚠ La remise à zéro est SÉPARÉE du montage, et c'est indispensable : le
 * scénario « capture précoce » dépose `window.__pwaInstallPrompt` AVANT de
 * monter. Si `__mount` remettait le magasin à zéro, il effacerait la capture
 * que le scénario vient justement de poser — reproduisant par accident le bug
 * qu'on cherche à interdire.
 */
window.__reset = () => {
  __resetForTests();
  window.__promptCalls = 0;
};

window.__mount = () => {
  root = createRoot(document.getElementById('app')!);
  root.render(<Harness />);
};

window.__unmount = () => {
  root?.unmount();
  root = null;
};
