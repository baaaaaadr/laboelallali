import '@/styles/index.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import i18nConfig, { defaultNS, supportedLngs } from '../../../i18n'; 
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next/initReactI18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import TranslationsProvider from '@/components/providers/TranslationsProvider'; 
import Header from '@/components/layout/Header'; 
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import PWAComponents from '@/components/features/pwa/PWAComponents';
import SplashRemover from '@/components/ui/SplashRemover';
import { ThemeProvider } from '@/contexts/ThemeContext';
import ToastProvider from '@/components/providers/ToastProvider';
import { LAB_SITE_URL } from '@/constants/contact';
// AuthProvider + ResultsProvider are mounted in the ROOT layout (src/app/layout.tsx)
// so they survive language switches (this [lang] subtree remounts on lang change).

// Font is defined but not used in this layout - if needed, uncomment and apply to elements
// import { Inter } from 'next/font/google';
// const inter = Inter({ subsets: ['latin'] });

// Initialize i18next for Server Components within this layout
async function initServerI18next(
  lang: string,
  namespaces: string[] = [defaultNS, 'appointment', 'glabo', 'catalog']
) {
  const i18nInstance = createInstance();
  await i18nInstance
    .use(initReactI18next)
    .use(
      resourcesToBackend((language: string, namespace: string) =>
        import(`../../../public/locales/${language}/${namespace}.json`)
      )
    )
    .init({
      ...i18nConfig,
      lng: lang,
      ns: namespaces,
      // No need for 'react: { useSuspense: false }' here as this is server-side init
    });
  return i18nInstance;
}

// Generate static paths for each supported language
export async function generateStaticParams() {
  return supportedLngs.map((lng) => ({ lang: lng }));
}

// Define the Params type consistent with Next.js 15.3.1 expectations
type Params = {
  lang: string;
};

// Viewport configuration
export const viewport = {
  themeColor: '#800020',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

// Generate dynamic metadata for the page
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const resolvedParams = await params;
  const { lang } = resolvedParams;
  
  // Set page title based on language
  let pageTitle = 'Laboratoire El Allali';
  let description = 'Analyses médicales à Agadir.';
  
  if (lang === 'ar') {
    pageTitle = 'مختبر العلالي';
    description = 'مختبر للتحاليل الطبية في أغادير';
  }

  return {
    title: pageTitle,
    description: description,
    applicationName: 'LaboElAllali',
    manifest: '/manifest.json',
    // Site-wide social preview (rich card when any page is shared, e.g. on WhatsApp).
    // metadataBase resolves the relative OG image to an absolute URL.
    metadataBase: new URL(LAB_SITE_URL),
    openGraph: {
      title: pageTitle,
      description: description,
      type: 'website',
      locale: lang,
      siteName: 'Laboratoire El Allali',
      images: ['/images/hero-banner.jpg'],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: pageTitle,
    },
    formatDetection: {
      telephone: true,
    },
    icons: [
      {
        rel: 'apple-touch-icon',
        url: '/images/icons/apple-touch-icon.png',
        sizes: '180x180',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '192x192',
        url: '/images/icons/icon-192x192.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '512x512',
        url: '/images/icons/icon-512x512.png',
      },
    ],
  };
}

// Define the layout properties with params as Promise for Next.js 15.3.1
interface LangLayoutProps {
  children: React.ReactNode;
  params: Promise<Params>; // Params as Promise
}

export default async function LangLayout({
  children,
  params,
}: LangLayoutProps) {
  // Await the promise to get params
  const resolvedParams = await params;
  const { lang } = resolvedParams;
  
  // Set the document direction based on language from URL
  const dirValue = lang === 'ar' ? 'rtl' : 'ltr';
  
  // Initialize i18next for server-side rendering within this layout
  let i18nInstance;
  let resources;

  try {
    i18nInstance = await initServerI18next(lang, [defaultNS, 'appointment', 'glabo', 'catalog']);
    resources = i18nInstance.services.resourceStore.data;
  } catch {
    // Fallback to create a minimal instance
    i18nInstance = createInstance();
    await i18nInstance.init({ lng: lang });
    resources = {};
  }

  // This component's return value will be injected into the {children} of src/app/layout.tsx
  return (
    <div lang={lang} dir={dirValue} className="h-full" suppressHydrationWarning>
      <ThemeProvider>
        <TranslationsProvider
          locale={lang}
          namespaces={[defaultNS, 'appointment', 'glabo', 'catalog']}
          resources={resources}
        >
            <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow w-full main-content-mobile-padding">
              <div className="max-w-full">
                {children}
              </div>
            </main>
            <Footer />
            <BottomNav />
            <PWAComponents />
            <ToastProvider />
            <SplashRemover />
            <Script id="pwa-init" strategy="afterInteractive">
              {`
                // Listen for beforeinstallprompt event
                window.addEventListener('beforeinstallprompt', (e) => {
                  e.preventDefault();
                  // Store the event for later use
                  window.deferredPrompt = e;
                });
              `}
            </Script>
          </div>
        </TranslationsProvider>
      </ThemeProvider>
    </div>
  );
}
