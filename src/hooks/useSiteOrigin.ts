'use client';

import { useEffect, useState } from 'react';

/** Where the app is served in production — the default before mount. */
export const PROD_ORIGIN = 'https://www.laboelallali.com';

/**
 * The origin links should point at: the site actually in use (production, a
 * preview…), read after mount. Used for the links the lab SENDS to a doctor
 * (invitation, his « Mes patients » bookmark) — they must open where the lab
 * works, not a hard-coded host.
 */
export function useSiteOrigin(): string {
  const [origin, setOrigin] = useState(PROD_ORIGIN);
  useEffect(() => {
    try {
      setOrigin(window.location.origin);
    } catch {
      /* keep the production origin */
    }
  }, []);
  return origin;
}
