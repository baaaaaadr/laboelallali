"use client";

import { Toaster } from 'react-hot-toast';

/**
 * Toast notification provider component
 * Wraps the app to provide toast notifications throughout
 */
export default function ToastProvider() {
  return (
    // react-hot-toast pose son conteneur à top:16px en style inline : sans
    // containerStyle, les toasts passent sous la barre d'état en PWA installée.
    // env() en dur plutôt que var(--safe-area-top) : ce style est appliqué hors
    // de la cascade de la feuille globale.
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      containerStyle={{ top: 'calc(16px + env(safe-area-inset-top, 0px))' }}
      toastOptions={{
        // Default options for all toasts
        duration: 4000,
        style: {
          background: 'var(--background-secondary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          padding: '16px',
        },
        // Success toast style
        success: {
          duration: 3000,
          iconTheme: {
            primary: 'var(--brand-primary)',
            secondary: 'white',
          },
        },
        // Error toast style
        error: {
          duration: 5000,
          iconTheme: {
            primary: '#dc2626',
            secondary: 'white',
          },
        },
        // Loading toast style
        loading: {
          iconTheme: {
            primary: 'var(--brand-primary)',
            secondary: 'white',
          },
        },
      }}
    />
  );
}
