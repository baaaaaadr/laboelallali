'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Define the BeforeInstallPromptEvent type
type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
};

declare global {
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent;
  }
}

interface PWAInstallButtonProps {
  variant?: 'button' | 'banner' | 'popup';
  onPopupDismiss?: () => void;
  className?: string;
}

// Global variable to store the deferred prompt
let deferredPrompt: BeforeInstallPromptEvent | null = null;

export default function PWAInstallButton({ 
  variant = 'button', 
  onPopupDismiss,
  className = '' 
}: PWAInstallButtonProps) {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const { t } = useTranslation('common');
  const [showPopup, setShowPopup] = useState(variant === 'popup');
  const [isIOS, setIsIOS] = useState(false);

  // Check if the app is already installed and detect iOS
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);
    
    // Check if app is installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone;
    
    if (isStandalone || isIOSStandalone) {
      console.log('>>> PWA: App is already installed');
      setIsAppInstalled(true);
    } else {
      console.log('>>> PWA: App is not installed');
    }
  }, []);

  // Set up event listeners for PWA installation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default prompt
      e.preventDefault();
      console.log('>>> PWA: beforeinstallprompt event captured', e);
      
      // Store the event
      const installEvent = e as BeforeInstallPromptEvent;
      setInstallPromptEvent(installEvent);
      
      // For debugging and global access
      window.deferredPrompt = installEvent;
      
      // Automatically show the popup when the prompt is available
      // This ensures the user sees our custom UI
      if (variant === 'popup' && !isAppInstalled) {
        setShowPopup(true);
      }
    };

    const handleAppInstalled = () => {
      console.log('>>> PWA: App was installed');
      setInstallPromptEvent(null);
      setIsAppInstalled(true);
      setShowPopup(false);
      
      if (onPopupDismiss) {
        onPopupDismiss();
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [variant, onPopupDismiss]);

  // Handle install button click
  const handleInstallClick = async () => {
    console.log('>>> PWA: Install button clicked');
    
    // Try to use the global deferredPrompt first
    const promptToUse = (window as any).deferredPrompt || deferredPrompt || installPromptEvent;
    
    if (!promptToUse) {
      console.log('>>> PWA: No install prompt available');
      return;
    }

    console.log('>>> PWA: Showing install prompt');
    
    try {
      // Show the install prompt
      await promptToUse.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await promptToUse.userChoice;
      console.log(`>>> PWA: User response to install prompt: ${outcome}`);
      
      // Clear the saved prompts since they can only be used once
      setInstallPromptEvent(null);
      (window as any).deferredPrompt = null;
      deferredPrompt = null;
      
      if (outcome === 'accepted') {
        console.log('>>> PWA: User accepted the install prompt');
        // The app will be installed, we can hide the button
        setIsAppInstalled(true);
      } else {
        console.log('>>> PWA: User dismissed the install prompt');
      }
    } catch (error) {
      console.error('>>> PWA: Error showing install prompt:', error);
    }
  };

  // Handle dismiss button click
  const handleDismiss = () => {
    console.log('>>> PWA: Popup dismissed without installing.');
    setShowPopup(false);
    if (onPopupDismiss) {
      onPopupDismiss();
    }
  };

  // Don't show anything if the app is already installed
  if (isAppInstalled) {
    return null;
  }

  // For iOS, let the system handle the installation
  if (isIOS) {
    console.log('>>> PWA: iOS device detected, using native install prompt');
    return null;
  }

  // Don't show anything if there's no install prompt event (except for popup variant)
  if (!installPromptEvent && variant !== 'popup') {
    return null;
  }

  // Render the button based on the variant
  if (variant === 'button') {
    return (
      <button
        onClick={handleInstallClick}
        className={`flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-lg ${className}`}
        title={t('pwa.install_app_title', 'Installer l\'application')}
      >
        <Download size={18} className="mr-2 rtl:ml-2 rtl:mr-0" />
        <span>{t('pwa.install_app_button', 'Installer l\'App')}</span>
      </button>
    );
  }
  
  if (variant === 'banner') {
    return (
      <div className="fixed bottom-16 sm:bottom-4 right-4 bg-[var(--accent-fuchsia)] text-white p-3 sm:p-4 rounded-lg shadow-xl z-[999] flex items-center space-x-2 sm:space-x-3">
        <span className="text-xs sm:text-sm">
          {t('pwa.install_banner_text', 'Installez notre application pour un accès rapide !')}
        </span>
        <button
          onClick={handleInstallClick}
          className="bg-white text-[var(--accent-fuchsia)] px-2 py-1 sm:px-3 sm:py-1.5 rounded font-semibold hover:bg-gray-100 text-xs sm:text-sm"
        >
          {t('pwa.install_now', 'Installer')}
        </button>
      </div>
    );
  }
  
  // Popup variant
  if (showPopup) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[1001] p-4 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full text-center transform transition-all scale-100 opacity-100">
          <div className="flex justify-end">
            <button 
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label={t('pwa.dismiss_popup_aria', "Fermer ce message")}
            >
              <X size={24} />
            </button>
          </div>
          <Download size={48} className="text-[var(--accent-fuchsia)] mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[var(--primary-bordeaux)] mb-3">
            {t('pwa.install_popup_title', 'Installer l\'application LaboElAllali ?')}
          </h3>
          <p className="text-gray-700 mb-6 text-sm">
            {t('pwa.install_popup_description', 'Obtenez une expérience optimisée et un accès rapide à nos services en installant l\'application sur votre appareil.')}
          </p>
          <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              onClick={handleInstallClick}
              className="btn-primary w-full sm:w-auto"
            >
              {t('pwa.install_confirm', 'Oui, Installer')}
            </button>
            <button
              onClick={handleDismiss}
              className="btn-outline w-full sm:w-auto"
            >
              {t('pwa.install_cancel', 'Plus tard')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
