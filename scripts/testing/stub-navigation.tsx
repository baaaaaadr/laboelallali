/** Doublure de `next/navigation`. Les navigations sont enregistrées, jamais suivies. */
const nav = (globalThis as unknown as { __nav: string[] });
nav.__nav = nav.__nav || [];

export function useRouter() {
  return {
    push: (url: string) => { nav.__nav.push(url); },
    replace: (url: string) => { nav.__nav.push(url); },
    back: () => undefined,
    refresh: () => undefined,
    prefetch: () => undefined,
  };
}

export function usePathname(): string {
  return (globalThis as unknown as { __pathname?: string }).__pathname || '/fr/test-rdv2';
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(
    (globalThis as unknown as { __search?: string }).__search || ''
  );
}
