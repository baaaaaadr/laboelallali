/**
 * Le parcours patient, regroupé en QUATRE blocs — pas dix.
 *
 * ### Pourquoi
 * Demande du Dr Aziz (09/09/2026) : « on a séparé en trop d'étapes, il faudra
 * regrouper en 3 ou 4 groupements logiques pour ne pas intimider les patients,
 * et que ça soit clair ce qu'ils peuvent zapper et ce qui est obligatoire. »
 * `/test-rdv` affiche aujourd'hui huit blocs dépliants numérotés de 1 à 8 : le
 * sommaire se lit comme une liste de corvées. Ici, quatre.
 *
 * ### Les deux cas les plus fréquents, qui commandent l'ordre
 * Toujours d'après le laboratoire (09/09/2026) :
 *  - **A.** le patient a une ordonnance et veut le PRIX, les conditions
 *    préanalytiques et le DÉLAI ;
 *  - **B.** il n'a pas d'ordonnance et veut choisir ses analyses, ou être aidé.
 *
 * Ces deux patients ne veulent pas de rendez-vous tout de suite. Le parcours
 * doit donc pouvoir s'arrêter après le groupe 2 : groupe 1 (ce qu'il veut) →
 * réponse immédiate → groupe 2 (comment le joindre) → *envoyer*. Les groupes 3
 * et 4 sont explicitement facultatifs et viennent APRÈS le point où ces deux
 * patients ont fini. C'est aussi ce que garantit `wantsAppointment`
 * (`useJourneyForm.ts`) : sans lui, `validate()` exigeait une date.
 *
 * ### Ce fichier est PUR
 * Pas de React, pas de traduction, pas d'icône : uniquement la carte
 * « quel bloc contient quelle section ». Les titres vivent dans
 * `public/locales/{fr,ar}/journey.json` (`group.*`), les icônes dans
 * `GroupedJourneyPage.tsx`. Ainsi la carte reste testable et la même liste sert
 * à trois endroits : l'affichage, le résumé replié, et l'ouverture automatique
 * du bon bloc quand une validation échoue.
 */

export type JourneyGroupId = 'analyses' | 'contact' | 'rendezvous' | 'plus';

/**
 * L'ordre d'affichage. `rendezvous` passe APRÈS `contact` — délibérément :
 * les cas A et B ci-dessus ont terminé leur demande à la fin de `contact`, et
 * tout ce qui suit doit pouvoir être ignoré sans remords.
 */
export const JOURNEY_GROUP_ORDER: readonly JourneyGroupId[] = [
  'analyses',
  'contact',
  'rendezvous',
  'plus',
];

/**
 * Les sections de `useJourneySections` contenues dans chaque groupe, dans leur
 * ordre d'apparition à l'intérieur du bloc.
 *
 * ⚠ `answer` (la réponse immédiate) n'appartient à AUCUN groupe : elle vit
 * hors de l'accordéon, toujours dépliée, entre le groupe 1 et le groupe 2.
 * C'est la chose que le patient est venu chercher — elle ne doit pas coûter un
 * clic, ni pouvoir être refermée par mégarde.
 */
export const JOURNEY_GROUP_SECTIONS: Record<JourneyGroupId, readonly string[]> = {
  analyses: ['prescription', 'cart'],
  contact: ['identity', 'channel'],
  rendezvous: ['place', 'when'],
  plus: ['want', 'access'],
};

/**
 * Le groupe qui contient une section — sert à ouvrir le bon bloc quand
 * `validate()` refuse l'envoi. Sans cela, le patient lit « Merci d'indiquer
 * votre nom » au-dessus d'un accordéon entièrement replié, et doit deviner
 * lequel des quatre blocs ouvrir.
 */
export function groupOfSection(sectionId: string): JourneyGroupId | null {
  for (const groupId of JOURNEY_GROUP_ORDER) {
    if (JOURNEY_GROUP_SECTIONS[groupId].includes(sectionId)) return groupId;
  }
  return null;
}
