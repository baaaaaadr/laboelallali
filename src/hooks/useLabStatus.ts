import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLabOpeningStatus } from '@/constants/labHours';

interface LabStatus {
  /** Meaningless while `isClient` is false — check `isClient` before showing it. */
  isOpen: boolean;
  nextChangeTime: Date | null;
  countdownText: string;
  statusText: string;
  /** True once the status has been computed in the browser. */
  isClient: boolean;
}

/** Milliseconds left until the next whole minute (so the badge flips on time). */
const msUntilNextMinute = (from: Date) =>
  60_000 - (from.getSeconds() * 1000 + from.getMilliseconds());

/**
 * Live "laboratoire ouvert / fermé" status.
 *
 * IMPORTANT — why nothing is computed during the server render:
 * the status is time-dependent, so the HTML produced by the server (or baked
 * into a prerendered/CDN-cached page, or replayed from the service-worker
 * cache) is stale by construction. Rendering it server-side used to leave a
 * permanently wrong badge: the server said "Ouvert", the client's first render
 * said "Fermé", and because both renders after hydration produced the SAME
 * value React never patched the DOM — the stale "Ouvert" stayed on screen
 * until the value happened to flip. `suppressHydrationWarning` made it worse by
 * telling React to keep the server text.
 *
 * So: `currentTime` starts at `null` (server AND first client render agree on a
 * neutral "unknown" state), and the real status only appears after mount, which
 * is a genuine value change React always commits.
 */
export const useLabStatus = (): LabStatus => {
  const { t } = useTranslation('common');
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setCurrentTime(new Date());
    tick();

    // Align the first tick on the minute boundary, then run every minute.
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, msUntilNextMinute(new Date()));

    // Timers are throttled (or frozen) in a backgrounded tab / installed PWA,
    // so recompute as soon as the page comes back to the foreground.
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

  if (!currentTime) {
    return {
      isOpen: false,
      nextChangeTime: null,
      countdownText: '',
      statusText: '',
      isClient: false,
    };
  }

  const { isOpen, minutesUntilChange, nextChangeTime } = getLabOpeningStatus(currentTime);

  const hours = Math.floor(minutesUntilChange / 60);
  const minutes = minutesUntilChange % 60;
  const prefix = isOpen ? t('closes_in') : t('opens_in');
  const countdownText =
    hours > 0
      ? `${prefix} ${hours}${t('hours_short')}${minutes.toString().padStart(2, '0')}${t('minutes_short')}`
      : `${prefix} ${minutes}${t('minutes_short')}`;

  return {
    isOpen,
    nextChangeTime,
    countdownText,
    statusText: isOpen ? t('open') : t('closed'),
    isClient: true,
  };
};
