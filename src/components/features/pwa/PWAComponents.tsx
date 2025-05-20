'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import ServiceWorkerRegistration from './ServiceWorkerRegistration';

// Dynamically import PWA components with SSR disabled
const IOSInstallBanner = dynamic(
  () => import('@/components/features/pwa/IOSInstallBanner'),
  { ssr: false }
);

const PWAInstallButton = dynamic(
  () => import('./PWAInstallButton'),
  { ssr: false }
);

// Use a ref to track if we've already set up the PWA components
let isPWAInitialized = false;

export default function PWAComponents() {
  const [isClient, setIsClient] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallButton, setShowInstallButton] = useState(process.env.NODE_ENV === 'development');

  useEffect(() => {
    // Only run on client side and only once
    if (typeof window === 'undefined' || isPWAInitialized) return;
    
    console.log('>>> PWA: Initializing PWA components...');
    isPWAInitialized = true;
    setIsClient(true);
    
    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);
    
    // Check if running in standalone mode
    const standalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone;
    
    setIsStandalone(!!standalone);
    
    // Debug info
    console.log('>>> PWA: Platform detection:', {
      isIOS: iOS,
      isStandalone: !!standalone,
      userAgent: navigator.userAgent,
      isSecure: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
      isPWA: (window as any).deferredPrompt !== undefined
    });
    
    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('>>> PWA: beforeinstallprompt event fired');
      // Store the event for later use
      (window as any).deferredPrompt = e;
      setShowInstallButton(true);
    };
    
    // Check if we already have a deferred prompt
    if ((window as any).deferredPrompt) {
      console.log('>>> PWA: Found existing deferred prompt');
      setShowInstallButton(true);
    }
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Only render PWA components on the client side and if not in standalone mode
  // However, always render in development mode for testing
  if ((!isClient || isStandalone) && process.env.NODE_ENV !== 'development') {
    console.log(`>>> PWA: Not rendering PWA components. isClient: ${isClient}, isStandalone: ${isStandalone}`);
    return null;
  }

  console.log('>>> PWA: Rendering PWA components');
  
  return (
    <>
      <ServiceWorkerRegistration />
      {isIOS && <IOSInstallBanner />}
      {/* Le bouton flottant a été supprimé */}
    </>
  );
}
