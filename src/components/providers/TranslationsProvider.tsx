"use client";

"use client";

import { createInstance, i18n as I18nInstanceType } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { ReactNode, useEffect, useState } from 'react';
import { fallbackLng as globalFallbackLng, defaultNS as globalDefaultNS } from '../../../i18n';

interface TranslationsProviderProps {
  children: ReactNode;
  locale: string;
  namespaces: string[];
  resources: any; // i18next Resource type is complex, 'any' for simplicity here
}

// Initialize i18next instance
const initI18next = (locale: string, namespaces: string[], resources: any) => {
  const i18n = createInstance();
  i18n
    .use(initReactI18next)
    .init({
      lng: locale,
      fallbackLng: globalFallbackLng,
      ns: namespaces,
      defaultNS: globalDefaultNS,
      resources,
      react: {
        useSuspense: false, // Recommended for App Router
      },
      // debug: process.env.NODE_ENV === 'development',
    });
  return i18n;
};

export default function TranslationsProvider({
  children,
  locale,
  namespaces,
  resources,
}: TranslationsProviderProps) {
  // Memoize the i18next instance to prevent re-initialization on re-renders
  // Trigger re-initialization only if locale, namespaces or resources change.
  const [i18n, setI18n] = useState<I18nInstanceType | null>(null);

  useEffect(() => {
    setI18n(initI18next(locale, namespaces, resources));
  }, [locale, namespaces, resources]);

  if (!i18n) {
    // You can render a loader here if needed, or null
    return null;
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
