import '../globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import i18nConfig, { defaultNS, supportedLngs } from '../../../i18n'; 
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next/initReactI18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { use } from 'react'; 
import TranslationsProvider from '@/components/providers/TranslationsProvider'; 
import Header from '@/components/layout/Header'; 
import Footer from '@/components/layout/Footer'; 

// Define the font to be used throughout the app
const inter = Inter({ subsets: ['latin'] });

// Initialise i18next pour les Server Components
async function initServerI18next(lang: string, namespaces: string | string[] = [defaultNS]) {
  const i18nInstance = createInstance();
  await i18nInstance
    .use(initReactI18next)
    .use(resourcesToBackend((language: string, namespace: string) => 
        import(`../../../public/locales/${language}/${namespace}.json`)
    ))
    .init({
      ...i18nConfig,
      lng: lang,
      ns: namespaces,
    });
  return i18nInstance;
}

// Génère les paramètres statiques pour les langues supportées
export async function generateStaticParams() {
  return supportedLngs.map((lng) => ({ lang: lng }));
}

// Génère les métadonnées dynamiques pour la page
export async function generateMetadata({ params }: { params: { lang: string } }): Promise<Metadata> {
  const { lang } = params;
  console.log('generateMetadata pour lang:', lang); // Pour le débogage
  return {
    title: 'Titre Statique Temporaire',
    description: 'Description Statique Temporaire.'
  };
}

// Define the interface that matches Next.js 15.3.1 expectations for layout props
interface LayoutProps {
  children: React.ReactNode;
  params: { lang: string };
}

// Layout principal de l'application
export default function RootLayout(props: LayoutProps) {
  const { children, params } = props;
  const { lang } = params;
  const dirValue = lang === 'ar' ? 'rtl' : 'ltr';
  console.log('RootLayout pour lang:', lang); // Pour le débogage

  // We need to initialize i18next on the server side
  const i18nPromise = initServerI18next(lang, [defaultNS]);
  const i18nInstance = use(i18nPromise);
  const resources = i18nInstance.services.resourceStore.data;

  return (
    <html lang={lang} dir={dirValue}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`flex flex-col min-h-screen bg-gray-50 ${inter.className}`}>
        <TranslationsProvider
          locale={lang}
          namespaces={[defaultNS]}
          resources={resources}
        >
          <Header />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </TranslationsProvider>
      </body>
    </html>
  );
}
