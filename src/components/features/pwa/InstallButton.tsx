'use client';

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Define the BeforeInstallPromptEvent interface
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  
  interface Window {
    deferredPrompt: BeforeInstallPromptEvent | null;
  }
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type InstallButtonProps = {
  className?: string;
};

export default function InstallButton({ className = '' }: InstallButtonProps) {
  const [showButton, setShowButton] = useState(false);
  const { t } = useTranslation('common');

  // Check if the app is already installed and set up event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if the app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('PWA: App is already installed');
      return;
    }
    
    // Initialize deferredPrompt
    window.deferredPrompt = null;
    
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('PWA: beforeinstallprompt event fired');
      
      // Store the event for later use
      window.deferredPrompt = e as unknown as BeforeInstallPromptEvent;
      setShowButton(true);
    };
    
    const handleAppInstalled = () => {
      console.log('PWA: App installed');
      setShowButton(false);
      window.deferredPrompt = null;
    };

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Clean up
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle install button click
  const handleClick = async () => {
    if (!window.deferredPrompt) {
      console.log('PWA: No install prompt available');
      return;
    }
    
    try {
      // Show the install prompt
      console.log('PWA: Showing install prompt');
      await window.deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const choiceResult = await window.deferredPrompt.userChoice;
      console.log(`PWA: User choice: ${choiceResult.outcome}`);
      
      if (choiceResult.outcome === 'accepted') {
        console.log('PWA: User accepted the install prompt');
        setShowButton(false);
      }
    } catch (error) {
      console.error('PWA: Error showing install prompt:', error);
    } finally {
      // Reset the deferred prompt variable as it can only be used once
      window.deferredPrompt = null;
    }
  };

  if (!showButton) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full h-12 bg-white text-[var(--accent-fuchsia)] hover:bg-gray-100 font-semibold rounded-lg shadow transition-colors text-center text-lg flex items-center justify-center gap-2 ${className}`}
      aria-label={t('pwa.install_app_button')}
    >
      <Download size={18} />
      {t('pwa.install_app_button')}
    </button>
  );
}
