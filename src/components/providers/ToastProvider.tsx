"use client";

import { Toaster } from 'react-hot-toast';

/**
 * Toast notification provider component
 * Wraps the app to provide toast notifications throughout
 */
export default function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
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
