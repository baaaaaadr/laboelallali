// i18n.ts
import type { InitOptions } from 'i18next';

export const fallbackLng = 'fr';
export const supportedLngs = ['fr', 'ar'];
export const defaultNS = 'common';
// Nom de cookie spécifique à l'application pour éviter les conflits
export const cookieName = 'laboelallali-i18next-lng';

const i18nConfig: InitOptions = {
  // Décommentez pour le débogage en développement :
  // debug: process.env.NODE_ENV === 'development',
  supportedLngs: supportedLngs,
  fallbackLng: fallbackLng,
  // La langue (lng) sera généralement détectée (par le middleware via cookie/header, ou depuis le segment [lang] de l'URL).
  // La définir statiquement ici pourrait interférer avec la détection.
  defaultNS: defaultNS,
  ns: [defaultNS], // i18next attend un tableau de chaînes ou une seule chaîne pour 'ns'.
  // Configuration du backend pour charger les fichiers de traduction.
  // Ce chemin est utilisé par des backends comme i18next-http-backend (côté client)
  // ou i18next-fs-backend (côté serveur, ou pendant le build).
  // Pour l'App Router avec `output: 'export'`, les traductions dans `public/locales`
  // sont servies statiquement. `resourcesToBackend` est souvent une bonne approche
  // pour charger ces fichiers JSON dynamiquement.
  backend: {
    loadPath: '/locales/{{lng}}/{{ns}}.json',
  },
  // Options spécifiques à React (passées lors de l'initialisation avec initReactI18next)
  react: {
    // `useSuspense: false` est souvent recommandé pour l'App Router avec next-i18next
    // pour éviter la complexité liée au rendu serveur/client et Suspense.
    useSuspense: false,
  },
};

export default i18nConfig;
