/**
 * Doublure de `next/dynamic` : le composant chargé à la demande n'est JAMAIS
 * rendu. Son seul client monté par les bancs est la fenêtre de recherche de
 * `Header.tsx` (fermée, et sans objet pour ce qu'on y vérifie : les liens).
 */
export default function dynamic(): () => null {
  return function DynamicStub() {
    return null;
  };
}
