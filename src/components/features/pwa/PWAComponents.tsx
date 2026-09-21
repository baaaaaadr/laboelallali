'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import ServiceWorkerRegistration from './ServiceWorkerRegistration';
import { detectCurrentPlatform, isRunningStandalone } from '@/lib/pwa/platform';

const IOSInstallBanner = dynamic(() => import('./IOSInstallBanner'), { ssr: false });

/**
 * Les deux morceaux de PWA qui vivent en permanence dans la page : l'inscription
 * du service worker, et le bandeau d'installation iOS.
 *
 * ### Trois défauts corrigés ici le 21/09/2026
 *
 * 1. **Un verrou de module gelait le composant après un changement de langue.**
 *    Une variable `isPWAInitialized` déclarée au niveau du MODULE (et non dans
 *    une `ref`) faisait sortir l'effet immédiatement au second montage. Or le
 *    sous-arbre `[lang]` est remonté à chaque changement de langue : `isClient`
 *    restait alors `false`, le composant renvoyait `null`, et le bandeau iOS
 *    comme `ServiceWorkerRegistration` disparaissaient pour le reste de la
 *    visite. Le verrou est supprimé ; un effet à dépendances vides suffit.
 *
 * 2. **`ServiceWorkerRegistration` était démonté dans l'application installée.**
 *    Le garde `isStandalone` renvoyait `null` pour tout le composant. C'est
 *    précisément en mode installé que le service worker compte le plus : il
 *    contrôle alors chaque requête. Le garde ne concerne plus que le bandeau.
 *
 * 3. **Un quatrième écouteur `beforeinstallprompt` vivait ici**, dont le
 *    résultat (`showInstallButton`) n'était lu nulle part, et qui écrivait dans
 *    la même globale que les boutons. Supprimé : la capture est faite une seule
 *    fois, dans le <head> du layout racine, et l'état vit dans
 *    `src/lib/pwa/installStore.ts`.
 */
export default function PWAComponents() {
  const [showIOSBanner, setShowIOSBanner] = useState(false);

  useEffect(() => {
    // Le bandeau ne s'adresse qu'à un iPhone/iPad qui n'a pas encore installé.
    setShowIOSBanner(detectCurrentPlatform() === 'ios' && !isRunningStandalone());
  }, []);

  return (
    <>
      <ServiceWorkerRegistration />
      {showIOSBanner && <IOSInstallBanner />}
    </>
  );
}
