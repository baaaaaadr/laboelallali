import type { Metadata } from 'next';

/**
 * Interdit l'indexation de la page de validation du parcours patient.
 *
 * ⚠ Pourquoi un layout et pas la page elle-même : `page.tsx` est un composant
 * CLIENT (`"use client"`), et un composant client ne peut pas exporter
 * `metadata`. La première version posait donc la balise `robots` à la main dans
 * un `useEffect` — c'est-à-dire APRÈS le chargement du JavaScript. Vérifié en
 * production le 09/09/2026 : le HTML servi ne contenait **aucun** `noindex`.
 * Google exécute le JavaScript, mais il peut indexer la page avant, et rien ne
 * garantit qu'il repassera. Un layout est un composant serveur : la balise part
 * dans le HTML, dès la première réponse.
 *
 * Trois protections superposées, aucune suffisante seule :
 *  1. cette balise `robots` (dans le HTML servi) ;
 *  2. l'exclusion du sitemap (`next-sitemap.config.js`) ;
 *  3. la règle `Disallow` du `robots.txt`.
 *
 * La page reste néanmoins ACCESSIBLE à qui connaît l'adresse — c'est voulu : le
 * propriétaire doit pouvoir l'ouvrir sur son téléphone pour la valider. Ne rien
 * y mettre qui ne puisse pas être public.
 *
 * ⚠ Tout ce fichier disparaît quand le parcours deviendra `/rendez-vous`.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function TestRdvLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
