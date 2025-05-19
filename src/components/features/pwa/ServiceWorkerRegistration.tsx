'use client';

import { useEffect } from 'react';

const ServiceWorkerRegistration = () => {
  useEffect(() => {
    // Check if we're in development and PWA is not explicitly enabled
    const isDev = process.env.NODE_ENV !== 'production';
    const enableInDev = process.env.NEXT_PUBLIC_ENABLE_PWA_DEV === 'true';
    
    if (isDev && !enableInDev) {
      console.log('>>> PWA: Service worker registration is disabled in development. Set NEXT_PUBLIC_ENABLE_PWA_DEV=true to enable.');
      return;
    }
    
    console.log('>>> PWA: Registering service worker...', { isDev, enableInDev });

    if ('serviceWorker' in navigator) {
      console.log('>>> PWA: Registering service worker...');
      
      // Don't wait for the load event as it might fire too late
      const registerServiceWorker = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none',
          });
          
          console.log('>>> PWA: ServiceWorker registration successful with scope:', registration.scope);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              console.log('>>> PWA: New service worker found, installing...');
              
              newWorker.addEventListener('statechange', () => {
                console.log(`>>> PWA: Service worker state changed to: ${newWorker.state}`);
                
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New update available
                  console.log('>>> PWA: New content is available; please refresh.');
                } else if (newWorker.state === 'activated') {
                  console.log('>>> PWA: Service worker activated');
                }
              });
            }
          });
          
          // Ensure the page is controlled by the service worker
          if (navigator.serviceWorker.controller) {
            console.log('>>> PWA: This page is currently controlled by:', navigator.serviceWorker.controller);
          } else {
            console.log('>>> PWA: This page is not currently controlled by a service worker');
          }
          
        } catch (error) {
          console.error('>>> PWA: ServiceWorker registration failed:', error);
        }
      };
      
      // Register the service worker
      if (document.readyState === 'complete') {
        registerServiceWorker();
      } else {
        window.addEventListener('load', registerServiceWorker);
      }
      
      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('>>> PWA: Controller changed, reloading page...');
        window.location.reload();
      });
      
    } else {
      console.log('>>> PWA: Service workers are not supported in this browser');
    }
  }, []);

  return null;
};

export default ServiceWorkerRegistration;
