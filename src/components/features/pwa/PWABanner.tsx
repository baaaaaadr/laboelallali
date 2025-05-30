'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Extend Window interface to include deferredPrompt
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  
  interface Window {
    deferredPrompt: BeforeInstallPromptEvent | null;
  }
}

type PWABannerProps = {
  className?: string;
};

export default function PWABanner({ className = '' }: PWABannerProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const { t } = useTranslation('common');

  // Check if the app is already installed
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isStandalone || (isIOS && !isSafari)) {
      setIsInstalled(true);
      setShowBanner(false);
    }
  }, []);

  // Set up event listeners for beforeinstallprompt
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      
      // Store the event for later use
      const event = e as unknown as { prompt: () => Promise<{ outcome: string }> };
      if (event.prompt && typeof event.prompt === 'function') {
        window.deferredPrompt = {
          prompt: () => event.prompt(),
          userChoice: Promise.resolve({ outcome: 'dismissed' })
        } as PWAPrompt;
        setShowBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle install button click
  const handleInstallClick = useCallback(async () => {
    if (!window.deferredPrompt) return;
    
    try {
      await window.deferredPrompt.prompt();
      const { outcome } = await window.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowBanner(false);
      }
      
      window.deferredPrompt = null;
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  }, []);

  if (isInstalled || !showBanner) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto bg-[var(--brand-primary)] text-white p-4 rounded-lg shadow-xl z-[999] flex items-center justify-between">
      <div className="flex items-center">
        <div className="flex-shrink-0 mr-3">
          <Download size={20} className="text-white" />
        </div>
        <div>
          <p className="font-medium">{t('pwa.install_app_title')}</p>
          <p className="text-sm opacity-90">{t('pwa.install_hint')}</p>
        </div>
      </div>
      <button
        onClick={handleInstallClick}
        className="ml-4 px-4 py-2 bg-white text-[var(--brand-primary)] font-medium rounded-md hover:bg-gray-100 transition-colors whitespace-nowrap"
      >
        {t('pwa.install_button')}
      </button>
    </div>
  );
}
