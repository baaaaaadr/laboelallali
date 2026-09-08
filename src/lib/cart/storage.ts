import type { CartItem } from '@/components/features/catalog/AnalysisCard';

/**
 * Persistance du panier ("devis") dans le navigateur.
 *
 * La clé était un littéral local dans `analyses/page.tsx`. Depuis que le parcours
 * unifié (`/test-rdv`) lit le même panier, deux littéraux dans deux fichiers
 * finiraient par diverger — d'où ce module, seule source de la clé.
 *
 * On stocke les objets `CartItem` COMPLETS (pas seulement des identifiants) :
 * c'est ce qui permet au parcours d'afficher prix / jeûne / délai sans aucune
 * lecture Firestore. Voir `computeCartView` — la carte des analyses n'est
 * nécessaire que pour résoudre la composition des bilans.
 *
 * ⚠ Ne JAMAIS appeler ces fonctions pendant un rendu : le serveur pré-rend ces
 * pages et `localStorage` n'y existe pas (décalage d'hydratation garanti).
 * Toujours dans un `useEffect` / un gestionnaire d'événement.
 */
export const CART_STORAGE_KEY = 'laboElAllali_selectedItems_v2';

/** Lit le panier. Renvoie `[]` sur absence, quota, JSON corrompu ou valeur non-tableau. */
export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    // Garde-fou minimal : une entrée sans `type`/`item` ne peut rien produire
    // d'utile en aval (prix, nom) et ferait planter les composants d'affichage.
    return parsed.filter(
      (entry): entry is CartItem =>
        !!entry &&
        typeof entry === 'object' &&
        'type' in entry &&
        'item' in entry &&
        !!(entry as { item?: unknown }).item
    );
  } catch {
    return [];
  }
}

/** Écrit le panier. Silencieux en cas d'échec (mode privé Safari, quota plein). */
export function writeCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

/** Supprime le panier. */
export function clearCartStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
