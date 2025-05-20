'use client';

import { useEffect } from 'react';

const ServiceWorkerRegistration = () => {
  useEffect(() => {
    // Check if we're in development mode
    const isDev = process.env.NODE_ENV === 'development';
    const isProd = process.env.NODE_ENV === 'production';
    const enableInDev = process.env.NEXT_PUBLIC_ENABLE_PWA_DEV === 'true';
    
    // In development mode, don't register the service worker unless explicitly enabled
    if (isDev && !enableInDev) {
      console.log('>>> PWA: Service worker registration is disabled in development mode');
      
      // Unregister any existing service workers in development to prevent loops
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (const registration of registrations) {
            registration.unregister();
            console.log('>>> PWA: Unregistered existing service worker in development mode');
          }
        });
      }
      return;
    }
    
    // Only proceed in production or if explicitly enabled in development
    if (!isProd && !enableInDev) {
      return;
    }
    
    console.log('>>> PWA: Starting service worker registration...', { isDev, enableInDev });

    if ('serviceWorker' in navigator) {
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
                  // Don't auto-reload in development to prevent infinite loops
                  if (!isDev) {
                    // Optional: Show a UI notification to refresh instead of forcing reload
                  }
                } else if (newWorker.state === 'activated') {
                  console.log('>>> PWA: Service worker activated');
                }
              });
            }
          });
          
          // Ensure the page is controlled by the service worker
          if (navigator.serviceWorker.controller) {
            console.log('>>> PWA: This page is currently controlled by a service worker');
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
      
      // Listen for controller changes but don't auto-reload in development
      if (!isDev) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('>>> PWA: Controller changed');
          // Instead of immediate reload, we could show a refresh button
          // Only reload in production to prevent infinite loops
          if (isProd) {
            console.log('>>> PWA: Reloading page...');
            window.location.reload();
          }
        });
      }
      
    } else {
      console.log('>>> PWA: Service workers are not supported in this browser');
    }
  }, []);

  return null;
};

export default ServiceWorkerRegistration;
