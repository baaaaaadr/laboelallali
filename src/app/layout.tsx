import '@/styles/index.css';
import EnvProvider from '@/components/EnvProvider';
import EnvironmentScript from '@/components/EnvironmentScript';
import RTLStylesProvider from '@/components/RTLStylesProvider';
import RTLAdditionalStyles from '@/components/RTLAdditionalStyles';
import { AuthProvider } from '@/contexts/AuthContext';
import { ResultsProvider } from '@/contexts/ResultsContext';

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
      <body className="flex flex-col min-h-screen bg-[var(--background-default)]" suppressHydrationWarning>
        {/* PWA Splash Screen — pure HTML/CSS, visible before JS executes */}
        <div
          id="splash-screen"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            gap: '20px',
          }}
        >
          <style>{`
            @keyframes ml-rise {
              0%, 100% { transform: translateY(28px); }
              50%       { transform: translateY(2px);  }
            }
            @keyframes ml-bubble {
              0%   { opacity: 0;   transform: translateY(0);     }
              15%  { opacity: 0.7; }
              100% { opacity: 0;   transform: translateY(-44px); }
            }
            @keyframes ml-drip {
              0%   { opacity: 0;   transform: translateY(-3px); }
              20%  { opacity: 1;   transform: translateY(0);    }
              80%  { opacity: 0.8; transform: translateY(10px); }
              100% { opacity: 0;   transform: translateY(16px); }
            }
            @keyframes ml-shimmer {
              0%, 100% { opacity: 0.22; }
              50%       { opacity: 0.42; }
            }
            @keyframes ml-glow {
              0%, 100% { opacity: 0.6; }
              50%       { opacity: 1;   }
            }
            @keyframes ml-label-pulse {
              0%, 100% { opacity: 0.6; }
              50%       { opacity: 1;   }
            }
            .sp-rise    { animation: ml-rise 3s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom; }
            .sp-b1      { animation: ml-bubble 3s ease-out infinite 0s;   transform-box: fill-box; transform-origin: center center; }
            .sp-b2      { animation: ml-bubble 3s ease-out infinite 1.1s; transform-box: fill-box; transform-origin: center center; }
            .sp-b3      { animation: ml-bubble 3s ease-out infinite 2s;   transform-box: fill-box; transform-origin: center center; }
            .sp-drip    { animation: ml-drip 2.6s ease-in infinite; transform-box: fill-box; transform-origin: center top; }
            .sp-shimmer { animation: ml-shimmer 2.4s ease-in-out infinite; }
            .sp-glow    { animation: ml-glow 3s ease-in-out infinite; }
            .sp-label   { animation: ml-label-pulse 2s ease-in-out infinite; color: #800020; font-weight: 700; font-size: 12px; letter-spacing: 0.28em; font-family: system-ui, sans-serif; margin: 0; }
          `}</style>

          <svg width="56" height="152" viewBox="0 0 56 152" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <clipPath id="sp-clip">
                <path d="M16 23 L40 23 L40 118 Q40 136 28 136 Q16 136 16 118 Z" />
              </clipPath>
              <linearGradient id="sp-blood" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#6B0016" />
                <stop offset="45%"  stopColor="#9B001E" />
                <stop offset="100%" stopColor="#6B0016" />
              </linearGradient>
              <linearGradient id="sp-cap-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#5a0016" />
                <stop offset="50%"  stopColor="#9A0020" />
                <stop offset="100%" stopColor="#5a0016" />
              </linearGradient>
              <radialGradient id="sp-glow-grad" cx="50%" cy="80%" r="60%">
                <stop offset="0%"   stopColor="#9B001E" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#9B001E" stopOpacity="0"    />
              </radialGradient>
            </defs>

            <ellipse cx="28" cy="136" rx="18" ry="8" fill="url(#sp-glow-grad)" className="sp-glow" />
            <rect x="22" y="1"  width="12" height="4"  rx="2" fill="#420010" />
            <rect x="14" y="4"  width="28" height="16" rx="5" fill="url(#sp-cap-grad)" />
            <rect x="14" y="18" width="28" height="5"  rx="1.5" fill="#420010" />
            <rect x="18" y="7"  width="5"  height="9"  rx="2.5" fill="rgba(255,255,255,0.17)" />
            <path d="M16 23 L40 23 L40 118 Q40 136 28 136 Q16 136 16 118 Z" fill="rgba(255,238,242,0.15)" stroke="#800020" strokeWidth="2" strokeLinejoin="round" />
            <g clipPath="url(#sp-clip)">
              <g className="sp-rise">
                <rect x="16" y="60" width="24" height="90" fill="url(#sp-blood)" />
                <path d="M16 60 C19 55 23 65 27 60 C31 55 35 65 39 60 C40 58 40 60 40 60 L40 70 L16 70 Z" fill="#A80022" />
                <path d="M16 60 C19.5 57.5 23 62.5 26.5 60 C30 57.5 33.5 62.5 37 60 L40 60 L40 62.5 L16 62.5 Z" fill="rgba(255,70,70,0.28)" />
                <circle cx="21" cy="95"  r="2"   fill="rgba(255,110,90,0.5)"  className="sp-b1" />
                <circle cx="34" cy="108" r="1.5" fill="rgba(255,90,75,0.45)"  className="sp-b2" />
                <circle cx="26" cy="120" r="1.3" fill="rgba(255,110,90,0.4)"  className="sp-b3" />
              </g>
            </g>
            <rect x="19" y="25" width="3.5" height="90" rx="1.75" fill="rgba(255,255,255,0.27)" clipPath="url(#sp-clip)" className="sp-shimmer" />
            <rect x="36" y="25" width="2"   height="70" rx="1"    fill="rgba(255,255,255,0.08)" clipPath="url(#sp-clip)" />
            <line x1="39" y1="50"  x2="42.5" y2="50"  stroke="rgba(128,0,32,0.5)"  strokeWidth="1"   />
            <line x1="39" y1="70"  x2="41.5" y2="70"  stroke="rgba(128,0,32,0.35)" strokeWidth="0.8" />
            <line x1="39" y1="90"  x2="42.5" y2="90"  stroke="rgba(128,0,32,0.5)"  strokeWidth="1"   />
            <line x1="39" y1="110" x2="41.5" y2="110" stroke="rgba(128,0,32,0.35)" strokeWidth="0.8" />
            <ellipse cx="28" cy="27" rx="2.2" ry="2.8" fill="#BB0020" className="sp-drip" />
          </svg>

          <p className="sp-label">LABO EL ALLALI</p>
        </div>

        <EnvProvider />
        {/* Auth + results live ABOVE the [lang] segment so switching language
            (which remounts the [lang] subtree) never resets them — no refetch,
            no PDF reload. They don't depend on locale. */}
        <AuthProvider>
          <ResultsProvider>
            {children}
          </ResultsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
