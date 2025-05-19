// src/components/features/pwa/IOSInstallBanner.tsx
'use client';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const IOSInstallBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const { t } = useTranslation('common');

  useEffect(() => {
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // Vérifie aussi si l'app n'est PAS déjà en mode standalone (installée)
    const isInStandaloneMode = typeof navigator !== 'undefined' && 'standalone' in navigator && (navigator as any).standalone;
    
    if (isIOS && !isInStandaloneMode && !localStorage.getItem('iosInstallBannerDismissed')) {
      setShowBanner(true);
      console.log('>>> PWA: iOS device detected, not in standalone, banner not dismissed. Showing banner.');
    } else {
      console.log('>>> PWA: iOS banner conditions not met or already dismissed.');
    }
  }, []);

  const dismissBanner = () => {
    localStorage.setItem('iosInstallBannerDismissed', 'true');
    setShowBanner(false);
    console.log('>>> PWA: iOS install banner dismissed.');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[var(--primary-bordeaux)] text-white p-3 text-center text-sm z-[1000] shadow-lg flex items-center justify-between sm:justify-center">
      <span className="flex-grow sm:flex-grow-0 text-left sm:text-center">
        {t('pwa.ios_install_prompt_part1', "Pour un accès facile, ajoutez-nous à l'écran d'accueil :")}
        <br className="sm:hidden"/> {/* Saut de ligne pour mobile */}
        {t('pwa.ios_install_prompt_part2', "Appuyez sur")} <img src="/images/icons/ios-share-icon.png" alt={t('pwa.ios_share_alt', "l'icône Partager")} className="inline h-4 w-4 mx-1" /> {t('pwa.ios_install_prompt_part3', "puis 'Sur l'écran d'accueil'.")}
      </span>
      <button 
        onClick={dismissBanner} 
        className="ml-2 p-1 text-white hover:bg-white/20 rounded-full flex-shrink-0"
        aria-label={t('pwa.dismiss_banner_aria', "Fermer le bandeau d'installation")}
      >
        <X size={20} />
      </button>
    </div>
  );
};

export default IOSInstallBanner;
