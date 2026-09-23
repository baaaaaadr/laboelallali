/**
 * Doublure de `next/navigation` avec un routeur STABLE (même objet à chaque
 * rendu, comme le vrai routeur Next). Les navigations sont enregistrées dans
 * `window.__nav`, jamais suivies ; `replace` est préfixé pour être distingué de
 * `push`.
 */
interface NavWindow {
  __nav: string[];
  __pathname?: string;
  __search?: string;
}

const g = globalThis as unknown as NavWindow;
g.__nav = g.__nav || [];

const router = {
  push: (url: string) => {
    g.__nav.push(url);
  },
  replace: (url: string) => {
    g.__nav.push(`replace:${url}`);
  },
  back: () => {
    g.__nav.push('back');
  },
  refresh: () => undefined,
  prefetch: () => undefined,
};

export function useRouter() {
  return router;
}

export function usePathname(): string {
  return g.__pathname || '/fr/resultats';
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(g.__search || '');
}
