// src/components/providers/TranslationsProvider.tsx
'use client';

import { useEffect, useRef } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18next, { createInstance } from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

// We're using any here because the exact i18next resource structure is complex
// and attempting to type it precisely is causing TypeScript errors
/* eslint-disable @typescript-eslint/no-explicit-any */
type I18NextResources = any;

interface TranslationsProviderProps {
  children: React.ReactNode;
  locale: string;
  namespaces: string[];
  resources: I18NextResources;
}

// Crée une nouvelle instance i18n pour chaque rendu afin d'éviter
// les fuites d'état entre les requêtes côté serveur et d'éliminer
// les décalages d'hydratation.
function createI18nInstance(locale: string, namespaces: string[], resources: I18NextResources) {
  const instance = createInstance();
  instance
    .use(initReactI18next)
    .use(
      // Charger les namespaces manquants depuis /public/locales au besoin
      resourcesToBackend((language: string, namespace: string) =>
        fetch(`/locales/${language}/${namespace}.json`).then((res) => res.json())
      )
    )
    .init({
      lng: locale,
      ns: namespaces,
      resources,
      fallbackLng: 'fr',
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
  return instance;
}

export default function TranslationsProvider({
  children,
  locale,
  namespaces,
  resources,
}: TranslationsProviderProps) {
  // Conserver l'instance pour la session du composant
  const i18nRef = useRef(createI18nInstance(locale, namespaces, resources));

  useEffect(() => {
    // CORRECTION: Pour éviter les erreurs d'hydratation, toujours mettre à jour 
    // la langue côté client immédiatement après le premier rendu
    const updateLanguage = async () => {
      if (i18nRef.current.language !== locale) {
        console.log(`[TranslationsProvider] Changing language from ${i18nRef.current.language} to ${locale}`);
        await i18nRef.current.changeLanguage(locale);
      }
      
      // Add new resource bundles if needed
      if (resources && resources[locale]) {
        Object.keys(resources[locale]).forEach(ns => {
          if (!i18nRef.current.hasResourceBundle(locale, ns)) {
            console.log(`[TranslationsProvider] Adding resource bundle for ${locale}/${ns}`);
            i18nRef.current.addResourceBundle(locale, ns, resources[locale][ns], true, true);
          }
        });
      }
    };
    
    updateLanguage();
  }, [locale, resources]);

  return <I18nextProvider i18n={i18nRef.current}>{children}</I18nextProvider>;
}