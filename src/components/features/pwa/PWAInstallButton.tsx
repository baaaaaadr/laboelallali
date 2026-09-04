'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, Download, Share } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * BeforeInstallPromptEvent interface defines the browser event triggered when a PWA can be installed
 * This is the standardized definition that should be used in all PWA-related components
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Extend Window interface to include deferredPrompt
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  
  interface Window {
    deferredPrompt: BeforeInstallPromptEvent | null;
  }
}

/**
 * Props for the PWAInstallButton component
 */
type PWAInstallButtonProps = {
  /** Visual presentation style of the button */
  variant?: 'button' | 'banner' | 'footer' | 'icon' | 'tile';
  /** Additional CSS classes to apply */
  className?: string;
  /** Force button to show regardless of installation state (useful for testing) */
  forceShow?: boolean;
  /** Additional styling for different contexts */
  style?: React.CSSProperties;
};

/**
 * PWAInstallButton - The official install button component for the Laboratoire El Allali PWA
 * 
 * This component handles detecting PWA install eligibility and provides various visual
 * presentations through the variant prop. It manages the browser's beforeinstallprompt event
 * and provides appropriate feedback for iOS Safari which handles installation differently.
 */
export default function PWAInstallButton({ 
  variant = 'button', 
  className = '', 
  forceShow = false,
  style = {}
}: PWAInstallButtonProps) {
  const [showButton, setShowButton] = useState(process.env.NODE_ENV === 'development' || forceShow);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  /** iOS never fires `beforeinstallprompt`; the tile has to say something else. */
  const [isIOS, setIsIOS] = useState(false);
  
  useEffect(() => {
    setIsClientReady(true);
  }, []);
  
  const { t } = useTranslation('common', { useSuspense: false });
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsIOS(isIOS);
    
    if (isStandalone || (isIOS && !isSafari)) {
      setIsAppInstalled(true);
      setShowButton(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
      setShowButton(false);
      return;
    }
    
    window.deferredPrompt = null;
    
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const installEvent = e as unknown as BeforeInstallPromptEvent;
      window.deferredPrompt = installEvent;
      setShowButton(true);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setShowButton(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!window.deferredPrompt) {
      if (process.env.NODE_ENV === 'development') {
        alert('PWA installation prompt not available in development. This button would trigger the PWA installation in production.');
      }
      return;
    }
    
    try {
      await window.deferredPrompt.prompt();
      const choiceResult = await window.deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        setIsAppInstalled(true);
        setShowButton(false);
      }
    } catch (error) {
      console.error('PWA: Error showing install prompt:', error);
    } finally {
      window.deferredPrompt = null;
    }
  }, []);

  if (!isClientReady) return null;
  
  // The hero tile is the ONE variant that must never vanish: it is the 5th cell
  // of a 5-column grid, and returning null left a visible hole next to four
  // filled tiles — which reads as a broken layout, not as "nothing to offer".
  // It stays, and says something true instead. Every other variant keeps the
  // old behaviour: a footer or banner with nothing to propose should disappear.
  if (
    variant !== 'tile' &&
    (isAppInstalled || !showButton) &&
    process.env.NODE_ENV !== 'development' &&
    !forceShow
  ) {
    return null;
  }
  
  const isDisabled = !isClientReady || (!window.deferredPrompt && process.env.NODE_ENV !== 'development' && !forceShow);
  
  if (variant === 'banner') {
    return (
      <div 
        className={`fixed bottom-16 sm:bottom-4 right-4 z-[999] bg-[var(--brand-accent)] text-white px-4 py-3 rounded-lg shadow-xl hover:shadow-2xl hover:bg-[var(--brand-accent-hover)] transition-colors ${className}`}
        style={style}
      >
        <button
          onClick={handleInstallClick}
          disabled={isDisabled}
          className={`flex items-center space-x-2 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={isClientReady ? t('pwa.install_app_button') : 'Install App'}
        >
          <Download size={18} />
          <span>{isClientReady ? t('pwa.install_app_button') : 'Install App'}</span>
        </button>
      </div>
    );
  }
  
  // Icon variant: compact icon-only button (used in the mobile menu's 3-icon action row).
  // Rendered as a <div role="button"> to bypass the global button background reset.
  if (variant === 'icon') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={isDisabled ? undefined : handleInstallClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleInstallClick(); } }}
        className={`menu-icon-button ${className} ${isDisabled ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}`}
        aria-label={isClientReady ? t('pwa.install_app_button') : 'Install App'}
        title={isClientReady ? t('pwa.install_app_button') : 'Install App'}
        style={style}
      >
        <Download size={22} className="flex-shrink-0" />
      </div>
    );
  }

  // Tile variant: the 5th shortcut of the home hero grid (see HeroShortcuts).
  // Uses the shared `.hero-tile*` classes so it is indistinguishable from the four
  // <a> tiles beside it. <div role="button"> like the footer/icon variants, to
  // bypass the global `button { background-color: transparent }` reset.
  if (variant === 'tile') {
    // Three states, one cell. Whatever happens, the grid keeps its five tiles.
    //   installed  → acknowledge it, quietly (this is the case the lab sees most,
    //                since the staff all run the installed app)
    //   installable→ the real install button
    //   otherwise  → tell the visitor where the command lives in THEIR browser,
    //                rather than offering a button that cannot do anything
    const canInstall = !isAppInstalled && !!(typeof window !== 'undefined' && window.deferredPrompt);

    const state = isAppInstalled
      ? {
          Icon: Check,
          label: t('hero_shortcuts.installed_label', 'Application installée'),
          desc: t('hero_shortcuts.installed_desc', 'Vous y êtes déjà'),
        }
      : canInstall
        ? {
            Icon: Download,
            label: t('pwa.install_app_button', "Installer l'appli"),
            desc: t('hero_shortcuts.install_desc', "Sur votre écran d'accueil"),
          }
        : isIOS
          ? {
              Icon: Share,
              label: t('hero_shortcuts.install_ios_label', "Ajouter à l'écran d'accueil"),
              desc: t('hero_shortcuts.install_ios_desc', 'Menu Partager de votre navigateur'),
            }
          : {
              Icon: Download,
              label: t('pwa.install_app_button', "Installer l'appli"),
              desc: t('hero_shortcuts.install_menu_desc', 'Depuis le menu de votre navigateur'),
            };

    const { Icon } = state;

    // Non-actionable states are plain <div>s: no role="button", no tabIndex, no
    // handler. A focusable control that does nothing is worse than static text.
    if (!canInstall) {
      return (
        <div className={`hero-tile hero-tile--static ${className}`} style={style}>
          <span className="hero-tile__icon">
            <Icon size={22} aria-hidden="true" />
          </span>
          <span className="hero-tile__label">{state.label}</span>
          <span className="hero-tile__desc">{state.desc}</span>
        </div>
      );
    }

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleInstallClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleInstallClick(); } }}
        className={`hero-tile ${className}`}
        aria-label={state.label}
        style={style}
      >
        <span className="hero-tile__icon">
          <Icon size={22} aria-hidden="true" />
        </span>
        <span className="hero-tile__label">{state.label}</span>
        <span className="hero-tile__desc">{state.desc}</span>
      </div>
    );
  }

  // Footer variant: rendered as a <div role="button"> to bypass the global `button { background-color: transparent }` reset.
  // The WhatsApp link is an <a> tag and doesn't suffer from this. Using <div> is the cleanest fix.
  if (variant === 'footer') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={isDisabled ? undefined : handleInstallClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleInstallClick(); } }}
        className={`bg-[var(--brand-primary)] hover:bg-[var(--color-bordeaux-light)] text-white px-6 py-3 rounded-lg inline-flex items-center justify-center space-x-2 transition-colors shadow-sm hover:shadow-md w-full cursor-pointer select-none ${className} ${isDisabled ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}`}
        aria-label={isClientReady ? t('pwa.install_app_button') : 'Install App'}
        style={style}
      >
        <Download size={20} className="flex-shrink-0" />
        <span>{isClientReady ? t('pwa.install_app_button') : 'Install App'}</span>
      </div>
    );
  }
  
  return (
    <div className={`w-full sm:w-auto ${className}`} style={style}>
      <button
        onClick={handleInstallClick}
        className={`bg-[var(--color-fuchsia-accent)] hover:bg-[var(--color-fuchsia-bright)] text-white text-base font-semibold px-[1.75rem] py-[0.875rem] min-h-[48px] rounded-lg flex items-center justify-center gap-2 w-full transition-all ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isClientReady ? t('pwa.install_app_title') : 'Install Application'}
        disabled={isDisabled}
        aria-label={isClientReady ? t('pwa.install_app_button') : 'Install App'}
      >
        <Download size={20} />
        <span>{isClientReady ? t('pwa.install_app_button') : 'Install App'}</span>
      </button>
    </div>
  );
}