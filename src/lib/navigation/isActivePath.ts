/**
 * Détection de la page courante, partagée par Header (desktop + drawer) et BottomNav.
 *
 * Source unique : dupliquer cette logique ferait diverger les trois menus.
 */

/** Extrait le segment de langue d'un chemin (`/fr/analyses` → `fr`). */
export function getLangFromPath(path: string): string {
  const match = path.match(/^\/([a-zA-Z-]+)/);
  return match ? match[1] : 'fr';
}

/**
 * `targetPath` est le chemin SANS préfixe de langue (`/analyses`, ou `/` pour l'accueil).
 * L'accueil exige une correspondance exacte ; les autres routes acceptent les
 * sous-chemins (`/resultats/xyz` garde « Résultats » actif).
 */
export function isActivePath(currentPath: string, targetPath: string): boolean {
  const lang = getLangFromPath(currentPath);
  const expectedPath = `/${lang}${targetPath === '/' ? '' : targetPath}`;

  if (targetPath === '/') {
    return currentPath === `/${lang}` || currentPath === expectedPath;
  }

  return currentPath === expectedPath || currentPath.startsWith(`${expectedPath}/`);
}
