import { useEffect, useState } from 'react';

/** Milliseconds left until the next whole minute. */
const msUntilNextMinute = (from: Date) =>
  60_000 - (from.getSeconds() * 1000 + from.getMilliseconds());

/**
 * The current time — `null` until the component has mounted in the browser.
 *
 * Never compute "now" during a render that the server also performs: the pages
 * are prerendered at build time, so the server's clock is frozen at deploy
 * time, and a value that differs between the server HTML and the first client
 * render is NOT reliably repaired (React can keep the server text, and any
 * later re-render producing the same value writes nothing to the DOM). Starting
 * at `null` makes both renders agree, and the real time arrives after mount —
 * a genuine change React always commits.
 *
 * Ticks on the minute boundary, and refreshes when the page comes back to the
 * foreground because timers are throttled or frozen in a backgrounded tab or
 * installed PWA.
 */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();

    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, msUntilNextMinute(new Date()));

    const refresh = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  return now;
}
