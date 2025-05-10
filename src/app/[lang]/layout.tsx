import '../globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import i18nConfig, { defaultNS, supportedLngs } from '../../../i18n'; 
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next/initReactI18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { dir } from 'i18next'; 
import TranslationsProvider from '@/components/providers/TranslationsProvider'; 
import Header from '@/components/layout/Header'; 
import Footer from '@/components/layout/Footer'; 

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
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  console.log('generateMetadata pour lang:', lang); // Pour le débogage
  return {
    title: 'Titre Statique Temporaire',
    description: 'Description Statique Temporaire.'
  };
}

// Layout principal de l'application
export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dirValue = lang === 'ar' ? 'rtl' : 'ltr';
  console.log('RootLayout pour lang:', lang); // Pour le débogage

  // Réactivation de la logique i18next côté serveur
  const i18nInstance = await initServerI18next(lang, [defaultNS]);
  const resources = i18nInstance.services.resourceStore.data;

  return (
    <html lang={lang} dir={dirValue}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="flex flex-col min-h-screen bg-gray-50">
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
