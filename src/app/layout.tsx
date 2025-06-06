import '@/styles/index.css';
import EnvProvider from '@/components/EnvProvider';
import EnvironmentScript from '@/components/EnvironmentScript';
import RTLStylesProvider from '@/components/RTLStylesProvider';
import RTLAdditionalStyles from '@/components/RTLAdditionalStyles';

// Metadata is now defined in metadata.ts since this is a Server Component

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <head>
        {/* Client RTL helpers */}
        <RTLStylesProvider />
        <RTLAdditionalStyles />
        
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
        
        {/* Environment variables are loaded via a client component */}
        <EnvironmentScript />
      </head>
      <body className="flex flex-col min-h-screen bg-[var(--background-default)] overflow-x-hidden">
        <EnvProvider />
        {children}
      </body>
    </html>
  );
}
