/**
 * Détection de plateforme pour l'installation de la PWA.
 *
 * Fonctions PURES : elles reçoivent l'`userAgent` et `maxTouchPoints` en
 * paramètres plutôt que de lire `navigator`. C'est ce qui permet de les
 * éprouver sur de vraies chaînes d'agent (iPhone Safari, iPad récent, webview
 * Facebook…) sans navigateur — voir `scripts/pwa-cases.ts`.
 *
 * ### Ce que remplace ce fichier
 * Le même bloc de détection était recopié dans cinq endroits, avec à chaque
 * fois la même paire de tests :
 *
 * ```ts
 * const isIOS    = /iPad|iPhone|iPod/.test(navigator.userAgent);
 * const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
 * if (isStandalone || (isIOS && !isSafari)) { … « application installée » … }
 * ```
 *
 * Deux défauts réels, vérifiés sur des agents authentiques :
 *
 * 1. **`(isIOS && !isSafari)` n'a jamais voulu dire « installée ».** Il dit
 *    « iOS dont l'agent ne contient pas le mot Safari » — c'est-à-dire les
 *    NAVIGATEURS INTÉGRÉS de Facebook, Instagram ou LinkedIn. Un patient qui
 *    ouvrait un lien du labo depuis Facebook voyait donc l'application
 *    déclarée « déjà installée », et tout point d'entrée d'installation
 *    disparaissait de son écran.
 * 2. **Un iPad n'était jamais reconnu.** Depuis iPadOS 13, un iPad s'annonce
 *    `Macintosh`. `/iPad|iPhone|iPod/` ne matche plus rien, et l'iPad recevait
 *    les consignes d'installation d'un ordinateur. Le seul signal qui reste
 *    est `maxTouchPoints > 1` sur un agent Macintosh — un Mac n'a pas d'écran
 *    tactile.
 */

/** La famille de plateforme, qui décide des consignes d'installation affichées. */
export type PwaPlatform = 'ios' | 'android' | 'desktop' | 'other';

/**
 * iOS au sens large : iPhone, iPod, et iPad moderne (qui se fait passer pour
 * un Mac). Tous partagent la même contrainte : **aucun navigateur iOS n'émet
 * `beforeinstallprompt`**, l'installation passe obligatoirement par le menu
 * Partager. C'est une règle d'Apple, pas un défaut de l'application.
 */
export function isIOSPlatform(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  // iPadOS 13+ : agent « Macintosh », mais un vrai Mac n'a pas d'écran tactile.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function detectPlatform(userAgent: string, maxTouchPoints = 0): PwaPlatform {
  if (!userAgent) return 'other';
  if (isIOSPlatform(userAgent, maxTouchPoints)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  if (/Windows|Macintosh|Linux|CrOS/i.test(userAgent)) return 'desktop';
  return 'other';
}

/**
 * Le navigateur est-il un navigateur INTÉGRÉ à une autre application
 * (Facebook, Instagram, LinkedIn, Snapchat) ?
 *
 * Utile parce qu'aucun d'eux ne sait installer une application web : les
 * consignes doivent alors dire « ouvrez ce lien dans votre navigateur ».
 * Beaucoup de patients arrivent par un lien posté sur la page Facebook du
 * laboratoire.
 */
export function isInAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Snapchat|Line\//i.test(userAgent);
}

/**
 * L'application tourne-t-elle DÉJÀ en mode installé ?
 *
 * Les deux signaux sont nécessaires, et l'ancien code n'en consultait qu'un
 * selon les fichiers : `display-mode` est la norme (Android, ordinateur),
 * `navigator.standalone` est le seul que connaisse iOS.
 *
 * ⚠ `fullscreen` et `minimal-ui` comptent aussi : le manifeste demande
 * `standalone`, mais un système peut servir un autre mode d'affichage.
 */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const byDisplayMode = ['standalone', 'fullscreen', 'minimal-ui'].some(
      (mode) => window.matchMedia(`(display-mode: ${mode})`).matches
    );
    const byIOS = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    return byDisplayMode || byIOS;
  } catch {
    return false;
  }
}

/** Raccourci navigateur : lit `navigator` puis délègue à `detectPlatform`. */
export function detectCurrentPlatform(): PwaPlatform {
  if (typeof navigator === 'undefined') return 'other';
  return detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}
