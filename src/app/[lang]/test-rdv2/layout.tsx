import type { Metadata } from 'next';

/**
 * Interdit l'indexation de la SECONDE mise en page du parcours patient
 * (quatre groupes au lieu de huit — voir `docs/pages/test-rdv2.md`).
 *
 * ⚠ Pourquoi un layout et pas la page elle-même : `page.tsx` est un composant
 * CLIENT (`"use client"`), et un composant client ne peut pas exporter
 * `metadata`. La première version de `/test-rdv` posait la balise `robots` à la
 * main dans un `useEffect` — c'est-à-dire APRÈS le chargement du JavaScript.
 * Vérifié en production le 09/09/2026 : le HTML servi ne contenait AUCUN
 * `noindex`. Un layout est un composant serveur : la balise part dans le HTML,
 * dès la première réponse.
 *
 * Trois protections superposées, aucune suffisante seule :
 *  1. cette balise `robots` (dans le HTML servi) ;
 *  2. l'exclusion du sitemap (`next-sitemap.config.js`) ;
 *  3. la règle `Disallow` du `robots.txt`.
 *
 * La page reste ACCESSIBLE à qui connaît l'adresse — c'est voulu : le
 * propriétaire et le Dr Aziz doivent pouvoir l'ouvrir sur leur téléphone pour
 * comparer les deux présentations. Ne rien y mettre qui ne puisse pas être
 * public.
 *
 * ⚠ Ce dossier entier disparaît quand l'arbitrage sera rendu : la mise en page
 * retenue deviendra `/rendez-vous`, l'autre sera supprimée.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function TestRdv2Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
