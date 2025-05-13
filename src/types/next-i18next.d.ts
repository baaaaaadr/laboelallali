import 'next-i18next';
// Adjust the path if your Resources type is elsewhere
import type { Resources } from '../i18n';

declare module 'next-i18next' {
  interface PublicRuntimeConfig {
    i18n: {
      defaultLocale: string;
      locales: string[];
    };
  }
}

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'; // Adjust if your defaultNS is different
    resources: Resources;
    returnNull: false;
  }
}
