'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SimplePWAButtonProps {
  variant?: 'button' | 'banner';
  className?: string;
}

export default function SimplePWAButton({ 
  variant = 'button',
  className = '' 
}: SimplePWAButtonProps) {
  const [showButton, setShowButton] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const { t } = useTranslation('common');
  
  // Check if the app is already installed
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isStandalone || (isIOS && !isSafari)) {
      setIsAppInstalled(true);
      setShowButton(false);
    }
  }, []);

  // Set up event listeners for beforeinstallprompt
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      
      // Store the event for later use
      const event = e as any;
      if (event.prompt && typeof event.prompt === 'function') {
        window.deferredPrompt = event;
        setShowButton(true);
      }
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

  // Handle install button click
  const handleInstallClick = useCallback(async () => {
    if (!window.deferredPrompt) return;
    
    try {
      await window.deferredPrompt.prompt();
      const { outcome } = await window.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsAppInstalled(true);
        setShowButton(false);
      }
      
      window.deferredPrompt = null;
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  }, []);

  if (isAppInstalled || !showButton) {
    return null;
  }
  
  if (variant === 'banner') {
    return (
      <div className="fixed bottom-16 sm:bottom-4 right-4 bg-bordeaux-custom text-white p-3 sm:p-4 rounded-lg shadow-xl z-[999] flex items-center space-x-2 sm:space-x-3 hover:bg-[#600018] transition-colors">
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <Download size={18} className="text-white" />
          <span>{t('pwa.install_app_button')}</span>
        </button>
      </div>
    );
  }
  
  return (
    <div className="w-full sm:w-auto">
      <button
        onClick={handleInstallClick}
        className={`w-full h-12 px-6 bg-white text-[var(--accent-fuchsia)] font-semibold rounded-lg shadow transition-colors text-center text-lg hover:bg-gray-100 ${className}`}
        title={t('pwa.install_app_title')}
        disabled={!window.deferredPrompt}
        aria-label={t('pwa.install_app_button')}
      >
        <div className="flex items-center justify-center gap-2">
          <Download size={18} />
          <span>{t('pwa.install_app_button')}</span>
        </div>
      </button>
      <div className="text-xs text-white mt-1 text-center">
        {t('pwa.install_hint')}
      </div>
    </div>
  );
}

// Add global type for TypeScript
declare global {
  interface Window {
    // Make sure this matches the type in other files
    deferredPrompt: {
      prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    } | null;
  }
}
