import '../globals.css';
import type { Metadata } from 'next';
import i18nConfig, { defaultNS, supportedLngs } from '../../../i18n'; 
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next/initReactI18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import TranslationsProvider from '@/components/providers/TranslationsProvider'; 
import Header from '@/components/layout/Header'; 
import Footer from '@/components/layout/Footer'; 

// Font is defined but not used in this layout - if needed, uncomment and apply to elements
// import { Inter } from 'next/font/google';
// const inter = Inter({ subsets: ['latin'] });

// Initialize i18next for Server Components within this layout
async function initServerI18next(
  lang: string,
  namespaces: string[] = [defaultNS, 'appointment', 'glabo']
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

// Generate dynamic metadata for the page
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const resolvedParams = await params;
  const { lang } = resolvedParams;
  // Example: Fetch translated title (you'd need i18n instance here too or pass translations)
  // For now, static:
  let pageTitle = 'Laboratoire El Allali';
  if (lang === 'ar') {
    pageTitle = 'مختبر العلالي'; // Example Arabic title
  }
  return {
    title: pageTitle,
    description: 'Analyses médicales à Agadir.' // Add translated description later
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
  
  // PROBLÈME IDENTIFIÉ: Inversion entre l'URL et la langue affichée
  // On utilise la langue de l'URL comme source de vérité absolue
  console.log(`Layout for language: URL lang=${lang}`);
  
  // Set the document direction based on language from URL
  const dirValue = lang === 'ar' ? 'rtl' : 'ltr';
  
  // CORRECTION: Debug complet pour détecter la source du problème
  console.log(`[DEBUG] Rendering layout for URL language: ${lang}, applying dir=${dirValue}`);
  
  // Initialize i18next for server-side rendering within this layout
  // CRITIQUE: S'assurer d'utiliser EXACTEMENT la langue de l'URL
  let i18nInstance;
  let resources;
  
  try {
    i18nInstance = await initServerI18next(lang, [defaultNS, 'appointment', 'glabo']);
    resources = i18nInstance.services.resourceStore.data;
    
    // Vérification complète des ressources chargées
    console.log(`[DEBUG] Loaded resources for languages: ${Object.keys(resources).join(', ')}`);
    
    if (resources && resources[lang]) {
      // Vérifier les clés de traduction pour confirmer que nous avons chargé la bonne langue
      const keys = Object.keys(resources[lang][defaultNS] || {}).slice(0, 5);
      console.log(`[DEBUG] Resources for ${lang} contain keys: ${keys.join(', ')}...`);
      
      // Vérifier si certaines valeurs ont été chargées - en accédant de manière sécurisée
      const currentLangValue = resources[lang][defaultNS] && 
                              typeof resources[lang][defaultNS] === 'object' && 
                              'currentLanguage' in resources[lang][defaultNS] ? 
                              resources[lang][defaultNS].currentLanguage : 'unknown';
      
      console.log(`[DEBUG] Value of 'currentLanguage' for ${lang}: "${currentLangValue}"`);
    } else {
      console.error(`[ERROR] No resources found for language: ${lang}. Available resources: ${Object.keys(resources).join(', ')}`);
    }
  } catch (error) {
    console.error(`[ERROR] Failed to initialize i18next for language ${lang}:`, error);
    // Fallback to create a minimal instance
    i18nInstance = createInstance();
    await i18nInstance.init({ lng: lang });
    resources = {};
  }

  // This component's return value will be injected into the {children} of src/app/layout.tsx
  return (
    <div lang={lang} dir={dirValue} className="h-full">
      <TranslationsProvider
        locale={lang}
        namespaces={[defaultNS, 'appointment', 'glabo']}
        resources={resources}
      >
        <Header /> {/* Header and Footer now correctly get i18n context */}
        <main className="flex-grow container mx-auto px-4 py-8"> {/* Add page container here */}
          {children}
        </main>
        <Footer />
      </TranslationsProvider>
    </div>
  );
}
