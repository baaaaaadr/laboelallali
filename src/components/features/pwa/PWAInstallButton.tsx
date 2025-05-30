'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
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
  variant?: 'button' | 'banner' | 'footer';
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
  // For development, default to showing button
  const [showButton, setShowButton] = useState(process.env.NODE_ENV === 'development' || forceShow);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  
  // Set isClientReady to true after component mounts (client-side only)
  useEffect(() => {
    setIsClientReady(true);
  }, []);
  
  // Only initialize i18n when client is ready
  const { t } = useTranslation('common', { useSuspense: false });
  
  // Log state for debugging
  useEffect(() => {
    console.log('PWAInstallButton state:', { 
      showButton, 
      isAppInstalled, 
      env: process.env.NODE_ENV,
      variant
    });
  }, [showButton, isAppInstalled, variant]);

  // Check if the app is already installed
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isStandalone || (isIOS && !isSafari)) {
      console.log('PWA: App is already installed or on iOS');
      setIsAppInstalled(true);
      setShowButton(false);
    }
  }, []);

  // Set up event listeners for beforeinstallprompt
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if the app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('PWA: App is already installed');
      setIsAppInstalled(true);
      setShowButton(false);
      return;
    }
    
    // Initialize deferredPrompt for use later to show browser install prompt.
    window.deferredPrompt = null;
    
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('PWA: beforeinstallprompt event fired');
      
      // Cast the event to our custom type
      const installEvent = e as unknown as BeforeInstallPromptEvent;
      
      // Stash the event so it can be triggered later
      window.deferredPrompt = installEvent;
      setShowButton(true);
    };

    const handleAppInstalled = () => {
      console.log('PWA: App was installed');
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
    console.log('PWA: Install button clicked');
    
    if (!window.deferredPrompt) {
      console.log('PWA: No install prompt available');
      // Show alert in development mode
      if (process.env.NODE_ENV === 'development') {
        alert('PWA installation prompt not available in development. This button would trigger the PWA installation in production.');
      }
      return;
    }
    
    try {
      // Show the install prompt
      console.log('PWA: Showing install prompt');
      
      // Trigger the prompt
      await window.deferredPrompt.prompt();
      console.log('PWA: Install prompt shown');
      
      // Wait for the user to make a choice
      const choiceResult = await window.deferredPrompt.userChoice;
      console.log(`PWA: User choice: ${choiceResult.outcome}`);
      
      if (choiceResult.outcome === 'accepted') {
        console.log('PWA: User accepted the install prompt');
        setIsAppInstalled(true);
        setShowButton(false);
      } else {
        console.log('PWA: User dismissed the install prompt');
      }
    } catch (error) {
      console.error('PWA: Error showing install prompt:', error);
    } finally {
      // Reset the deferred prompt variable as it can only be used once
      window.deferredPrompt = null;
    }
  }, []);

  // Don't render anything if not on client yet to prevent hydration mismatch
  if (!isClientReady) {
    return null;
  }
  
  // In development mode or if forceShow is true, always show the button for testing UI
  if ((isAppInstalled || !showButton) && process.env.NODE_ENV !== 'development' && !forceShow) {
    return null;
  }
  
  // Banner variant - fixed position at bottom of screen
  if (variant === 'banner') {
    const isDisabled = !isClientReady || (!window.deferredPrompt && process.env.NODE_ENV !== 'development' && !forceShow);
    
    return (
      <div 
        className="fixed bottom-16 sm:bottom-4 right-4 z-[999] bg-[var(--brand-accent)] text-white px-4 py-3 rounded-lg shadow-xl hover:shadow-2xl hover:bg-[var(--brand-accent-hover)] transition-colors"
        style={style}
      >
        <button
          onClick={handleInstallClick}
          disabled={isDisabled}
          className={`${className || 'menu-pwa-button'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={isClientReady ? t('pwa.install_app_button') : 'Install App'}
          aria-disabled={isDisabled}
        >
          <Download size={18} />
          <span>{isClientReady ? t('pwa.install_app_button') : 'Install App'}</span>
        </button>
      </div>
    );
  }
  
  // Footer variant - full width with bordeaux background
  if (variant === 'footer') {
    const isDisabled = !isClientReady || (!window.deferredPrompt && process.env.NODE_ENV !== 'development' && !forceShow);
    
    return (
      <button
        onClick={handleInstallClick}
        className="menu-pwa-button w-full"
        aria-label={isClientReady ? t('pwa.install_app_button') : 'Install App'}
        style={style}
        disabled={isDisabled}
      >
        <Download size={18} />
        <span>{isClientReady ? t('pwa.install_app_button') : 'Install App'}</span>
      </button>
    );
  }
  
  // Default button variant
  const isDisabled = !isClientReady || (!window.deferredPrompt && process.env.NODE_ENV !== 'development' && !forceShow);
  
  // Get the hint text with a fallback
  const hintText = isClientReady && t('pwa.install_hint') !== 'pwa.install_hint' 
    ? t('pwa.install_hint') 
    : 'Accès rapide via l\'application';
  
  return (
    <div className="w-full sm:w-auto" style={style}>
      <button
        onClick={handleInstallClick}
        className={className || 'button-fuchsia'}
        title={isClientReady ? t('pwa.install_app_title') : 'Install Application'}
        disabled={isDisabled}
        aria-label={isClientReady ? t('pwa.install_app_button') : 'Install App'}
      >
        <Download size={20} />
        <span>{isClientReady ? t('pwa.install_app_button') : 'Install App'}</span>
      </button>
      {/* Only show hint text if not passed a className that might indicate hero usage */}
      {!className?.includes('min-w-[170px]') && (
        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 text-center">
          {hintText}
        </div>
      )}
    </div>
  );
}