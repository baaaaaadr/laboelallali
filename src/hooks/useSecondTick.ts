'use client';

import { useEffect, useState } from 'react';

/**
 * Epoch timestamp refreshed every second — `null` before mount.
 *
 * Same SSR contract as `useNow`: pages are statically prerendered, and a value
 * that differs between the server HTML and the first client render is NOT
 * reliably repaired by React. Consumers must handle `null`.
 *
 * Deliberately NOT an option on `useNow`. That hook ticks once a minute and
 * feeds the lab's open/closed badge, which is mounted on every page — adding a
 * "seconds" mode there would put a setState-per-second one careless argument
 * away from the whole header. Its alignment on the minute boundary is also
 * useless here. Two hooks, two contracts.
 *
 * Three guarantees:
 *  - the value is always re-read from `Date.now()`, never incremented, so a
 *    throttled or frozen tab cannot accumulate drift;
 *  - the interval is CLEARED (not merely ignored) while the document is hidden —
 *    iOS wakes a frozen PWA with a burst of pending callbacks;
 *  - `prefers-reduced-motion: reduce` falls back to one tick per minute. The
 *    value stays correct, only the ticking stops.
 *
 * @param enabled pass `false` when the counter is off-screen (an
 *   IntersectionObserver on the caller's side): the home hero is a full screen
 *   tall, and without this we would repaint a blurred panel once a second for as
 *   long as the visitor reads the rest of the page.
 */
export function useSecondTick(enabled = true): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const period = reduced ? 60_000 : 1_000;

    let id: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(Date.now());

    const start = () => {
      if (id !== undefined) return; // idempotent: focus and visibilitychange both fire
      tick(); // resync immediately on return
      id = setInterval(tick, period);
    };
    const stop = () => {
      if (id === undefined) return;
      clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());

    if (document.visibilityState === 'visible') start();
    else tick(); // correct value even if the page opened in a background tab

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', start);
    window.addEventListener('pageshow', start);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', start);
      window.removeEventListener('pageshow', start);
    };
  }, [enabled]);

  return now;
}
