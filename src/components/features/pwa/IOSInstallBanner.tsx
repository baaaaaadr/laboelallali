// src/components/features/pwa/IOSInstallBanner.tsx
'use client';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const DISMISS_KEY = 'iosInstallBannerDismissed';

/**
 * Le bandeau qui apprend aux patients iPhone que l'application s'installe.
 *
 * ⚠ Il ne décide plus S'IL doit s'afficher : `PWAComponents` ne le monte que
 * sur iOS et hors mode installé, via les helpers partagés de
 * `src/lib/pwa/platform.ts`. Sa détection propre a été retirée — elle testait
 * `navigator.standalone` seul, là où le reste de l'application testait
 * `display-mode`, si bien que les deux pouvaient être en désaccord sur la même
 * page.
 *
 * Il ne lui reste qu'une responsabilité : se souvenir d'avoir été fermé.
 *
 * Note : depuis le 21/09/2026 ce bandeau n'est plus le SEUL recours des
 * patients iPhone. Le bouton du bas de page et l'icône du menu leur ouvrent
 * désormais la fiche `InstallHelpDialog`, qui porte les mêmes consignes en
 * plus détaillé. Le bandeau reste parce qu'il est PROACTIF : il se montre sans
 * qu'on aille le chercher.
 */
const IOSInstallBanner = () => {
  const { t } = useTranslation('common');
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const dismissBanner = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      /* mode privé : le bandeau reviendra, ce n'est pas grave */
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="ios-install-banner bg-[var(--color-bordeaux-primary)] text-white p-3 text-center text-sm shadow-lg flex items-center justify-between gap-3 sm:justify-center">
      <span className="flex-grow sm:flex-grow-0 text-left sm:text-center">
        {t('pwa.ios_install_prompt_part1', "Pour un accès facile, ajoutez-nous à l'écran d'accueil :")}
        <br className="sm:hidden" />
        {t('pwa.ios_install_prompt_part2', 'Appuyez sur')}{' '}
        <img
          src="/images/icons/ios-share-icon.png"
          alt={t('pwa.ios_share_alt', "l'icône Partager")}
          className="inline h-4 w-4 mx-1"
        />{' '}
        {t('pwa.ios_install_prompt_part3', "puis 'Sur l'écran d'accueil'.")}
      </span>
      <button
        onClick={dismissBanner}
        className="p-1 text-white hover:bg-white/20 rounded-lg flex-shrink-0 min-h-8 min-w-8 inline-flex items-center justify-center"
        aria-label={t('pwa.dismiss_banner_aria', "Fermer le bandeau d'installation")}
      >
        <X size={20} />
      </button>
    </div>
  );
};

export default IOSInstallBanner;
