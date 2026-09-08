import 'i18next';

/**
 * Typage d'i18next — SOURCE UNIQUE.
 *
 * Historique : deux augmentations coexistaient et aucune ne fonctionnait.
 *  - ce fichier écrivait `Resources` (majuscule) alors que l'option s'appelle
 *    `resources` : elle était purement décorative ;
 *  - `next-i18next.d.ts` faisait `import type { Resources } from '../i18n'`,
 *    or `i18n.ts` n'exporte aucun `Resources`.
 *
 * Faute de type utilisable, TypeScript retombait sur l'inférence récursive des
 * clés d'i18next et produisait des « Type instantiation is excessively deep »
 * (TS2589) dans six fichiers — exactement ce que
 * `typescript.ignoreBuildErrors: true` masque dans `next.config.js`.
 *
 * ### Pourquoi `any` ici, et pourquoi c'est le bon choix
 *
 * Deux formes plus strictes ont été essayées et rejetées, mesures à l'appui :
 *  - `{ [key: string]: string }` casse les clés IMBRIQUÉES. `t('admin.search')`
 *    résout `common['admin']` en `string`, puis `.search` dessus devient
 *    `String.prototype.search` — une fonction, que JSX refuse d'afficher. Or ce
 *    projet imbrique partout (`admin.*`, `resultats.*`, `gate.*`).
 *  - nommer les namespaces un par un fait revenir TS2589 ailleurs
 *    (`AnalysisCard.tsx`), et interdit `useTranslation(variable)`.
 *
 * La complétion des clés n'a JAMAIS fonctionné dans ce dépôt : chaque appel
 * s'écrit `t('cle', 'texte de repli')`, le repli étant la vraie sécurité. On
 * arrête donc l'inférence net, et on récupère un `npx tsc --noEmit` exploitable.
 *
 * ⚠ La contrepartie : une faute de frappe dans un nom de namespace n'est plus
 * signalée. Le garde-fou reste la liste des namespaces de
 * `src/app/[lang]/layout.tsx` (3 emplacements) — un namespace absent de cette
 * liste ne charge simplement pas.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    returnNull: false;
    // `keySeparator: false` est un réglage de TYPE uniquement : il dit à
    // TypeScript de traiter 'admin.search' comme UNE clé plate au lieu de
    // descendre dans un objet. C'est ce qui arrête la récursion à la racine
    // (et au passage ce qui évite que `common['admin'].search` se résolve en
    // `String.prototype.search`). Le runtime, lui, garde bien le séparateur '.'
    // — ces options ne pilotent que l'inférence.
    keySeparator: false;
    resources: { [namespace: string]: { [key: string]: string } };
  }
}
