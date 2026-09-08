import type { JourneyVariant } from './types';

/**
 * Adresse du parcours patient unifié — SEUL endroit à modifier le jour où
 * `/test-rdv` deviendra `/rendez-vous` (et où `/glabo` rendra la même page).
 *
 * Tout est en minuscules : Firebase Hosting distingue la casse, et le
 * propriétaire tape l'adresse à la main sur son téléphone.
 */
export const JOURNEY_SEGMENT = 'test-rdv';

/** Le service d'origine, transmis en `?service=` tant que le parcours vit sur /test-rdv. */
export type JourneyService = 'labo' | 'domicile';

export interface JourneyPathOptions {
  /** Pré-sélectionne le lieu et l'identité affichée sur l'écran d'accueil. */
  service?: JourneyService;
  /** D'où vient le patient — utile pour mesurer l'origine des demandes. */
  from?: string;
}

/** Construit le lien vers le parcours (`/fr/test-rdv?service=labo&from=catalogue`). */
export function journeyPath(lang: string, opts: JourneyPathOptions = {}): string {
  const params = new URLSearchParams();
  if (opts.service) params.set('service', opts.service);
  if (opts.from) params.set('from', opts.from);
  const qs = params.toString();
  return `/${lang}/${JOURNEY_SEGMENT}${qs ? `?${qs}` : ''}`;
}

/** Lien vers le catalogue depuis le parcours. */
export function catalogPathFromJourney(lang: string): string {
  return `/${lang}/analyses?from=${JOURNEY_SEGMENT}`;
}

/**
 * Traduit `?service=` en variante d'affichage.
 * Étape finale : la variante viendra de la ROUTE (/glabo → 'home',
 * /rendez-vous → 'lab') et cette fonction ne servira plus qu'au parcours de test.
 */
export function variantFromService(service: string | null): JourneyVariant {
  if (service === 'domicile') return 'home';
  if (service === 'labo') return 'lab';
  return 'neutral';
}
