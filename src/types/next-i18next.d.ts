import 'next-i18next';

/**
 * `next-i18next` n'est PAS utilisé à l'exécution (le runtime passe par
 * `i18next` + `react-i18next` + `i18next-resources-to-backend`) : ce fichier ne
 * sert qu'au typage résiduel.
 *
 * ⚠ Le bloc `declare module 'i18next'` qui vivait ici a été supprimé : il
 * faisait doublon avec `src/types/i18next.d.ts` et importait un type
 * `Resources` que `i18n.ts` n'a jamais exporté. Le typage d'i18next a une seule
 * source désormais — `src/types/i18next.d.ts`.
 */
declare module 'next-i18next' {
  interface PublicRuntimeConfig {
    i18n: {
      defaultLocale: string;
      locales: string[];
    };
  }
}
