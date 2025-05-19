import type { Metadata } from 'next';
import './globals.css';
import EnvProvider from '@/components/EnvProvider';

export const metadata: Metadata = {
  title: 'Laboratoire El Allali',
  description: 'Analyses médicales à Agadir.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <head>
        {/* PWA Configuration */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#800020" />
        
        {/* iOS specific PWA configuration */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LaboElAllali" />
        <link rel="apple-touch-icon" href="/images/icons/apple-touch-icon.png" />
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Add CSS for RTL support */}
        <style dangerouslySetInnerHTML={{ __html: `
          [dir="rtl"] { text-align: right; }
          [dir="rtl"] .rtl-mirror { transform: scaleX(-1); }
          [dir="rtl"] .rtl-reverse { flex-direction: row-reverse; }
          [dir="rtl"] .rtl-content { direction: rtl; text-align: right; }
          [dir="rtl"] input, [dir="rtl"] select, [dir="rtl"] textarea { text-align: right; }
          [dir="rtl"] .form-group label { text-align: right; }
          [dir="rtl"] .ml-3 { margin-left: 0; margin-right: 0.75rem; }
          [dir="rtl"] .mr-3 { margin-right: 0; margin-left: 0.75rem; }
          [dir="rtl"] .text-left { text-align: right; }
          [dir="rtl"] .text-right { text-align: left; }
          [dir="rtl"] .rtl-filter-section { direction: rtl; text-align: right; }
          [dir="rtl"] .rtl-filter-section label { text-align: right; }
          [dir="rtl"] .rtl-filter-section input, 
          [dir="rtl"] .rtl-filter-section select { text-align: right !important; direction: rtl; }
          [dir="rtl"] .rtl-filter-section #search { text-align: right !important; }
          [dir="rtl"] .rtl-filter-section #category { text-align: right !important; }
        `}} />
        {/* Script to load environment variables */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.ENV = {
                NEXT_PUBLIC_FIREBASE_API_KEY: "${process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''}",
                NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || ''}",
                NEXT_PUBLIC_FIREBASE_PROJECT_ID: "${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''}",
                NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || ''}",
                NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || ''}",
                NEXT_PUBLIC_FIREBASE_APP_ID: "${process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''}",
                NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "${process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || ''}"
              };
            `
          }}
        />
      </head>
      <body className="flex flex-col min-h-screen bg-gray-50">
        <EnvProvider />
        {children}
      </body>
    </html>
  );
}
