import { createInstance, i18n as I18nInstanceType } from 'i18next';
import { initReactI18next } from 'react-i18next/initReactI18next';
import resourcesToBackend from 'i18next-resources-to-backend';
// Correct path: i18n.ts is one level up from src/ (at project root)
import { fallbackLng, supportedLngs, defaultNS, i18nConfig } from '../i18n';

const initServerI18next = async (lng: string, ns: string | string[]): Promise<I18nInstanceType> => {
  const i18nInstance = createInstance();
  await i18nInstance
    .use(initReactI18next)
    .use(resourcesToBackend((language: string, namespace: string) =>
      // Correct path: From src/, go up to project root, then to public/locales
      import(`../../public/locales/${language}/${namespace}.json`)
    ))
    .init({
      ...i18nConfig,
      lng: lng,
      ns: ns,
      fallbackLng: fallbackLng,
      supportedLngs: supportedLngs,
      defaultNS: defaultNS,
      preload: supportedLngs,
    });
  return i18nInstance;
};

export default initServerI18next;