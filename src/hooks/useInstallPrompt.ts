// src/hooks/useInstallPrompt.ts
'use client';
import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const useInstallPrompt = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    console.log('>>> PWA: useInstallPrompt hook mounted');
    
    // Check if already installed
    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      console.log('>>> PWA: Checking if app is installed - standalone mode:', isStandalone);
      
      // Check if the app is already installed
      if (isStandalone || (window.navigator as any).standalone) {
        console.log('>>> PWA: App is already installed');
        setIsAppInstalled(true);
        setInstallPromptEvent(null);
      } else {
        console.log('>>> PWA: App is not installed');
      }
    };

    // Initial check
    checkIfInstalled();

    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (event: Event) => {
      console.log('>>> PWA: beforeinstallprompt event fired');
      event.preventDefault();
      
      // Store the event
      const installEvent = event as BeforeInstallPromptEvent;
      console.log('>>> PWA: Platforms:', installEvent.platforms);
      
      setInstallPromptEvent(installEvent);
      
      // For debugging
      (window as any).deferredPrompt = installEvent;
    };

    // Handle appinstalled event
    const handleAppInstalled = () => {
      console.log('>>> PWA: App was installed');
      setInstallPromptEvent(null);
      setIsAppInstalled(true);
    };

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Check again after a short delay to ensure we don't miss the event
    const timeoutId = setTimeout(checkIfInstalled, 1000);

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timeoutId);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPromptEvent) {
      console.log('>>> PWA: No install prompt event available.');
      return false;
    }
    try {
      await installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      console.log(`>>> PWA: User response to install prompt: ${outcome}`);
      if (outcome === 'accepted') {
        setIsAppInstalled(true);
      }
      setInstallPromptEvent(null);
      return outcome === 'accepted';
    } catch (error) {
      console.error('>>> PWA: Error during install prompt:', error);
      setInstallPromptEvent(null);
      return false;
    }
  }, [installPromptEvent]);

  return { installPromptEvent, promptInstall, isAppInstalled };
};
