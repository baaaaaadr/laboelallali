import type { JourneyVariant } from './types';

/**
 * Adresse du parcours patient unifié — SEUL endroit à modifier le jour où
 * `/test-rdv` deviendra `/rendez-vous` (et où `/glabo` rendra la même page).
 *
 * Tout est en minuscules : Firebase Hosting distingue la casse, et le
 * propriétaire tape l'adresse à la main sur son téléphone.
 */
export const JOURNEY_SEGMENT = 'test-rdv';

/**
 * La SECONDE mise en page, en cours d'arbitrage : mêmes questions, mais
 * regroupées en quatre blocs au lieu de huit (demande du Dr Aziz, 09/09/2026 —
 * « on a séparé en trop d'étapes »). Les deux vivent côte à côte le temps que
 * le laboratoire tranche ; une seule survivra et deviendra `/rendez-vous`.
 * Voir `src/lib/journey/groups.ts` et `docs/pages/test-rdv2.md`.
 */
export const JOURNEY_V2_SEGMENT = 'test-rdv2';

/** Les deux adresses du parcours, pour les listes d'exclusion (robots, One Tap…). */
export const JOURNEY_SEGMENTS: readonly string[] = [JOURNEY_SEGMENT, JOURNEY_V2_SEGMENT];

/** Le service d'origine, transmis en `?service=` tant que le parcours vit sur /test-rdv. */
export type JourneyService = 'labo' | 'domicile';

export interface JourneyPathOptions {
  /** Pré-sélectionne le lieu et l'identité affichée sur l'écran d'accueil. */
  service?: JourneyService;
  /** D'où vient le patient — utile pour mesurer l'origine des demandes. */
  from?: string;
  /**
   * Forcer une mise en page. Omis, le lien retourne là d'où le patient est
   * parti (voir `rememberJourneyOrigin`), et à défaut sur `/test-rdv`.
   */
  segment?: string;
}

/**
 * La mise en page d'où le patient est parti vers le catalogue, en
 * `sessionStorage`.
 *
 * ### Pourquoi ce détour
 * Le bouton « Prendre RDV » du catalogue (`CartActions.tsx`) est rendu très
 * loin du parcours et n'a aucun moyen de savoir laquelle des deux pages
 * l'a envoyé là. Sans cette mémoire, un testeur parti de `/test-rdv2` pour
 * choisir ses analyses revenait sur `/test-rdv` — son panier suivait, mais pas
 * la mise en page qu'il était en train d'évaluer, et le brouillon restauré
 * s'affichait dans l'autre présentation.
 *
 * Portée `sessionStorage` : l'onglet, et rien de plus. Un patient qui n'ouvre
 * jamais `/test-rdv2` n'est jamais concerné. Disparaît le jour où une seule
 * mise en page subsiste.
 */
const ORIGIN_KEY = 'laboElAllali_journeyOrigin';

export function rememberJourneyOrigin(segment: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ORIGIN_KEY, segment);
  } catch {
    /* mode privé / quota : on retombera sur /test-rdv, ce n'est pas grave */
  }
}

export function readJourneyOrigin(): string {
  if (typeof window === 'undefined') return JOURNEY_SEGMENT;
  try {
    const stored = window.sessionStorage.getItem(ORIGIN_KEY);
    return stored && JOURNEY_SEGMENTS.includes(stored) ? stored : JOURNEY_SEGMENT;
  } catch {
    return JOURNEY_SEGMENT;
  }
}

/** Construit le lien vers le parcours (`/fr/test-rdv?service=labo&from=catalogue`). */
export function journeyPath(lang: string, opts: JourneyPathOptions = {}): string {
  const params = new URLSearchParams();
  if (opts.service) params.set('service', opts.service);
  if (opts.from) params.set('from', opts.from);
  const qs = params.toString();
  const segment = opts.segment ?? readJourneyOrigin();
  return `/${lang}/${segment}${qs ? `?${qs}` : ''}`;
}

/** Lien vers le catalogue depuis le parcours. */
export function catalogPathFromJourney(lang: string, segment: string = JOURNEY_SEGMENT): string {
  return `/${lang}/analyses?from=${segment}`;
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
