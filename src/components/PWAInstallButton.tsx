'use client';

import { useState, useEffect } from 'react';
import { FaDownload } from 'react-icons/fa';

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

export default function PWAInstallButton() {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.deferredPrompt = e as BeforeInstallPromptEvent;
      setShowButton(true);
    };

    const handleAppInstalled = () => {
      setShowButton(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!window.deferredPrompt) return;

    try {
      window.deferredPrompt.prompt();
      const { outcome } = await window.deferredPrompt.userChoice;
      console.log(`PWAInstallButton: User ${outcome} the install prompt`);
      window.deferredPrompt = undefined;
      setShowButton(false);
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  };

  if (!showButton) return null;
  
  return (
    <button
      onClick={handleInstallClick}
      className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 flex items-center space-x-2 z-50"
      aria-label="Installer l'application"
    >
      <FaDownload className="text-lg" />
      <span>Installer l'application</span>
    </button>
  );
}
