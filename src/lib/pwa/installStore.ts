/**
 * La SEULE source de vérité de l'état d'installation de la PWA.
 *
 * ### Le défaut qu'il corrige (signalé par un patient, 21/09/2026)
 * « J'appuie ici, il ne se passe rien » — le bouton « Installer l'appli » du
 * bas de page, sur Android.
 *
 * L'ancien code suivait DEUX choses avec DEUX mécanismes différents :
 *  - **« est-ce que je m'affiche ? »** → un état React `showButton`, mis à
 *    `true` à la réception de `beforeinstallprompt` et quasiment jamais remis
 *    à `false` ;
 *  - **« est-ce que je peux agir ? »** → la variable globale
 *    `window.deferredPrompt`.
 *
 * La seconde était effacée dans trois cas sans que la première en soit
 * informée, et le bouton restait alors affiché, d'apparence normale, **sans
 * aucun effet** :
 *
 * 1. **Après un refus.** `finally { window.deferredPrompt = null }` s'exécutait
 *    quel que soit le choix du patient. Or Chrome ne réémet jamais
 *    `beforeinstallprompt` sans rechargement : un patient qui annulait une
 *    fois ne pouvait plus jamais installer depuis ce bouton.
 * 2. **Au montage de n'importe quel bouton.** `PWAInstallButton` faisait
 *    `window.deferredPrompt = null` dans son effet de montage. Trois instances
 *    coexistent (bas de page, menu, tuile d'accueil) : celle qui montait en
 *    dernier effaçait la capture des deux autres. Revenir sur l'accueil
 *    suffisait à casser le bouton du bas de page.
 * 3. **Aucun redessin.** L'état « désactivé » lisait la variable globale
 *    PENDANT le rendu. Une variable globale ne déclenche pas de rendu React :
 *    le bouton gardait l'apparence active d'un bouton devenu inerte.
 *
 * ### Le principe retenu
 * Un magasin unique, hors de React, avec des abonnés. Les composants s'y
 * branchent par `useSyncExternalStore` (`src/hooks/useInstallState.ts`), qui
 * est exactement le primitif prévu pour une source extérieure à React : tout
 * changement d'état redessine les trois boutons, ensemble.
 *
 * ⚠ **Ne jamais remettre l'événement à `null` au montage d'un composant.**
 * C'est la cause n° 2 ci-dessus. Seuls `promptInstall()` et `appinstalled`
 * ont le droit de le consommer, et tous deux préviennent les abonnés.
 *
 * ⚠ `getSnapshot()` doit renvoyer une référence STABLE tant que rien ne
 * change, sinon `useSyncExternalStore` redessine en boucle jusqu'à l'erreur
 * « The result of getSnapshot should be cached ». D'où `publish()`, qui
 * compare champ à champ avant de créer un nouvel objet.
 */
import { isRunningStandalone } from './platform';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  interface Window {
    /**
     * La capture PRÉCOCE, posée par le script du layout racine avant même
     * l'hydratation — voir `src/app/layout.tsx`. Chrome émet
     * `beforeinstallprompt` très tôt, souvent avant que React ait monté quoi
     * que ce soit : un écouteur posé dans un `useEffect` le rate purement et
     * simplement, et aucun bouton ne peut plus jamais s'afficher.
     */
    __pwaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export interface InstallSnapshot {
  /** Le navigateur peut lancer le dialogue natif MAINTENANT. */
  canInstall: boolean;
  /** L'application tourne en mode installé, ou vient d'être installée. */
  installed: boolean;
}

/** L'état vu par le serveur et par le tout premier rendu client (pas d'écart d'hydratation). */
const INITIAL: InstallSnapshot = { canInstall: false, installed: false };

let snapshot: InstallSnapshot = INITIAL;
let deferred: BeforeInstallPromptEvent | null = null;
let started = false;
const listeners = new Set<() => void>();

/** Ne crée un nouvel objet — et ne prévient les abonnés — que si l'état a vraiment changé. */
function publish(next: InstallSnapshot): void {
  if (next.canInstall === snapshot.canInstall && next.installed === snapshot.installed) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function setDeferred(event: BeforeInstallPromptEvent | null): void {
  deferred = event;
  if (typeof window !== 'undefined') window.__pwaInstallPrompt = event;
  publish({ canInstall: event !== null, installed: snapshot.installed });
}

function markInstalled(): void {
  deferred = null;
  if (typeof window !== 'undefined') window.__pwaInstallPrompt = null;
  publish({ canInstall: false, installed: true });
}

/**
 * Branche le magasin sur le navigateur. Idempotent : appelé par chaque abonné,
 * il ne pose ses écouteurs qu'une fois.
 *
 * ⚠ Les écouteurs ne sont JAMAIS retirés, volontairement. `beforeinstallprompt`
 * n'est émis qu'une fois par chargement de page, à un instant que nous ne
 * choisissons pas ; un écouteur qu'on retire au démontage d'un composant est
 * un écouteur qui manquera l'événement. Le magasin vit aussi longtemps que la
 * page.
 */
function start(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  if (isRunningStandalone()) {
    publish({ canInstall: false, installed: true });
    // On continue quand même : une fenêtre affichée en mode installé n'émettra
    // pas d'événement, mais rien ne coûte à rester à l'écoute.
  }

  // 1) Récupérer ce que le script précoce a déjà capté. C'est le chemin NORMAL
  //    sur Android : l'événement arrive avant l'hydratation.
  const early = window.__pwaInstallPrompt;
  if (early) {
    deferred = early;
    publish({ canInstall: true, installed: snapshot.installed });
  }

  // 2) Écouter pour de bon. Le script précoce écoute lui aussi et écrit dans la
  //    même globale ; les deux écrivent la même valeur, c'est sans effet de
  //    bord. Ce doublon est délibéré : il rend le magasin autonome, y compris
  //    dans le banc d'essai où le layout racine n'existe pas.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    setDeferred(event);
  });

  window.addEventListener('appinstalled', markInstalled);

  // 3) Le passage en mode installé pendant que l'onglet est ouvert.
  try {
    window
      .matchMedia('(display-mode: standalone)')
      .addEventListener('change', (e) => {
        if (e.matches) markInstalled();
      });
  } catch {
    /* Safari ancien : `addEventListener` absent sur MediaQueryList. Sans effet. */
  }
}

export function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): InstallSnapshot {
  return snapshot;
}

/** Rendu serveur : toujours l'état neutre, jamais d'accès à `window`. */
export function getServerSnapshot(): InstallSnapshot {
  return INITIAL;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable' | 'error';

/**
 * Lance le dialogue natif d'installation.
 *
 * ⚠ L'événement est CONSOMMÉ par `prompt()`, quel que soit le choix du
 * patient — c'est une règle du navigateur, pas un choix de notre part. Le
 * magasin repasse donc à `canInstall: false` dans TOUS les cas, et prévient
 * les abonnés : les boutons basculent aussitôt vers la fiche d'aide au lieu
 * de rester des boutons morts. C'est très exactement le défaut signalé par le
 * patient.
 */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferred ?? (typeof window !== 'undefined' ? window.__pwaInstallPrompt : null);
  if (!event) return 'unavailable';

  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') {
      markInstalled();
      return 'accepted';
    }
    setDeferred(null);
    return 'dismissed';
  } catch (error) {
    console.warn('PWA : le dialogue d\'installation a échoué', error);
    setDeferred(null);
    return 'error';
  }
}

/**
 * Remet le magasin à zéro. **Réservé au banc d'essai** — chaque scénario doit
 * repartir d'une page vierge. Rien dans `src/` ne doit l'appeler.
 */
export function __resetForTests(): void {
  snapshot = INITIAL;
  deferred = null;
  started = false;
  listeners.clear();
  if (typeof window !== 'undefined') window.__pwaInstallPrompt = null;
}
