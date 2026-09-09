/**
 * Doublure de `react-i18next` qui lit les VRAIS fichiers de traduction.
 *
 * C'est le point important : si une clé manque dans `public/locales/fr` ou
 * `public/locales/ar`, le banc affiche la clé brute et le pilote la repère
 * (`assertAucuneCleBrute`). Une doublure qui renverrait la clé « proprement »
 * ou un texte factice masquerait exactement le défaut qu'on cherche — c'est
 * arrivé : `section.required_label` et `section.optional_label` n'existaient
 * que côté français, et rien ne le signalait.
 *
 * Les bundles JSON sont incorporés à la compilation par esbuild (`import … from
 * '…json'`), donc aucun accès disque à l'exécution dans le navigateur.
 */
import React from 'react';

import frJourney from '../../public/locales/fr/journey.json';
import frCommon from '../../public/locales/fr/common.json';
import frCatalog from '../../public/locales/fr/catalog.json';
import frAppointment from '../../public/locales/fr/appointment.json';
import frGlabo from '../../public/locales/fr/glabo.json';
import arJourney from '../../public/locales/ar/journey.json';
import arCommon from '../../public/locales/ar/common.json';
import arCatalog from '../../public/locales/ar/catalog.json';
import arAppointment from '../../public/locales/ar/appointment.json';
import arGlabo from '../../public/locales/ar/glabo.json';

type Dict = Record<string, unknown>;

const BUNDLES: Record<string, Record<string, Dict>> = {
  fr: {
    journey: frJourney as Dict,
    common: frCommon as Dict,
    catalog: frCatalog as Dict,
    appointment: frAppointment as Dict,
    glabo: frGlabo as Dict,
  },
  ar: {
    journey: arJourney as Dict,
    common: arCommon as Dict,
    catalog: arCatalog as Dict,
    appointment: arAppointment as Dict,
    glabo: arGlabo as Dict,
  },
};

function currentLang(): string {
  const l = (globalThis as unknown as { __lang?: string }).__lang;
  return l === 'ar' ? 'ar' : 'fr';
}

function get(dict: Dict | undefined, path: string): unknown {
  if (!dict) return undefined;
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Dict)[part];
    return undefined;
  }, dict);
}

/**
 * Les formes plurielles. L'arabe en a six — c'est la raison pour laquelle
 * `journey.json` porte `count_zero` … `count_other` côté AR et seulement
 * `count_one`/`count_other` côté FR.
 */
function pluralSuffix(lang: string, n: number): string[] {
  if (lang !== 'ar') return n === 1 ? ['one', 'other'] : ['other'];
  if (n === 0) return ['zero', 'other'];
  if (n === 1) return ['one', 'other'];
  if (n === 2) return ['two', 'other'];
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10) return ['few', 'other'];
  if (mod100 >= 11 && mod100 <= 99) return ['many', 'other'];
  return ['other'];
}

function interpolate(text: string, opts: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, name: string) => {
    const v = opts[name];
    return v === undefined || v === null ? whole : String(v);
  });
}

export function useTranslation(ns?: string | string[]) {
  const lang = currentLang();
  const defaultNs = Array.isArray(ns) ? ns[0] : ns || 'common';
  const bundles = BUNDLES[lang];

  function t(key: string, second?: unknown, third?: unknown): string {
    // Signatures utilisées dans le dépôt : t(k), t(k, 'repli'),
    // t(k, { count }), t('ns:k', 'repli').
    const fallback = typeof second === 'string' ? second : undefined;
    const opts = (typeof second === 'object' && second !== null
      ? second
      : typeof third === 'object' && third !== null
        ? third
        : {}) as Record<string, unknown>;

    const [maybeNs, ...rest] = key.split(':');
    const usedNs = rest.length > 0 ? maybeNs : defaultNs;
    const path = rest.length > 0 ? rest.join(':') : key;
    const dict = bundles[usedNs];

    let value: unknown;
    if (typeof opts.count === 'number') {
      for (const suffix of pluralSuffix(lang, opts.count)) {
        value = get(dict, `${path}_${suffix}`);
        if (typeof value === 'string') break;
      }
    }
    if (typeof value !== 'string') value = get(dict, path);

    if (typeof value !== 'string') {
      // Ni la clé ni un repli : on rend la CLÉ BRUTE, volontairement visible.
      return fallback ?? key;
    }
    return interpolate(value, opts);
  }

  return { t, i18n: { language: lang, changeLanguage: async () => undefined } };
}

export function Trans({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export const initReactI18next = { type: '3rdParty', init: () => undefined };
