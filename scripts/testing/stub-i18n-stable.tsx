/**
 * `stub-i18n.tsx` avec une fonction `t` STABLE d'un rendu à l'autre.
 *
 * La doublure d'origine recrée `t` à chaque appel de `useTranslation`. Le vrai
 * `react-i18next` renvoie la même fonction tant que la langue ne change pas.
 * Pour les bancs du parcours, la différence est sans effet ; pour un banc qui
 * COMPTE les appels réseau, un `t` instable relancerait tous les effets qui en
 * dépendent et fausserait les mesures. On enveloppe donc sans rien réécrire :
 * les vrais fichiers de traduction restent la seule source des textes.
 */
import { useMemo } from 'react';
import { useTranslation as useBaseTranslation, Trans, initReactI18next } from './stub-i18n';

export function useTranslation(ns?: string | string[]) {
  const base = useBaseTranslation(ns);
  const lang = base.i18n.language;
  const nsKey = Array.isArray(ns) ? ns.join(',') : ns || '';
  // La langue ne change qu'au remontage du banc : la première valeur reste juste.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => base, [lang, nsKey]);
}

export { Trans, initReactI18next };
