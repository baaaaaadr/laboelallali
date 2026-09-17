'use client';

/**
 * Keeps the screen awake while the patient shows their barcode at the counter.
 *
 * Why this matters more than it sounds: no browser API can raise screen
 * brightness — not Chrome, not Safari. The two levers that actually exist are a
 * full-screen white surface (handled by `ScanFullscreen`) and this: stopping the
 * phone from dimming. iOS and Android dim after 15-30 s, and a dimmed screen is
 * precisely when the scanner stops decoding, which is also precisely when the
 * patient is still fumbling to present their phone.
 *
 * Degrades silently. An unsupported browser (iOS < 16.4, Firefox Android) is not
 * an error — the caller shows "keep your screen on" instead of a warning.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Minimal shape of the Wake Lock sentinel — not in this project's TS lib yet. */
interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
  removeEventListener: (type: 'release', listener: () => void) => void;
}

interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

function getWakeLock(): WakeLockLike | null {
  if (typeof navigator === 'undefined') return null;
  const wl = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
  return wl ?? null;
}

export interface ScreenWakeLock {
  /** The browser exposes the API at all. Known false on iOS < 16.4, Firefox Android. */
  supported: boolean;
  /** A lock is currently held. False while acquiring, or after a silent release. */
  held: boolean;
}

/**
 * Hold a screen wake lock while `active` is true.
 *
 * ⚠ The re-acquisition on `visibilitychange` is the whole point of this hook,
 * not a detail. The browser releases the sentinel by itself whenever the tab is
 * hidden — switching apps at the counter, answering a call, pulling down the
 * notification shade — and it does **not** come back on its own. Without this,
 * the lock works on the first scan attempt and silently stops working on every
 * one after it, which is the hardest kind of bug to reproduce on a desk.
 */
export function useScreenWakeLock(active: boolean): ScreenWakeLock {
  const [supported, setSupported] = useState(false);
  const [held, setHeld] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  // Read inside async callbacks so a release racing a deactivation cannot
  // re-acquire a lock nobody asked for any more.
  const activeRef = useRef(active);
  activeRef.current = active;

  // Detection runs in an effect, not during render: `navigator` does not exist
  // during SSR and the root layout renders this tree on the server.
  useEffect(() => {
    setSupported(getWakeLock() !== null);
  }, []);

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setHeld(false);
    if (!sentinel || sentinel.released) return;
    try {
      await sentinel.release();
    } catch {
      /* already gone — nothing to do */
    }
  }, []);

  const acquire = useCallback(async () => {
    const wl = getWakeLock();
    if (!wl || sentinelRef.current) return;
    try {
      const sentinel = await wl.request('screen');
      // The user may have closed the overlay while the request was in flight.
      if (!activeRef.current) {
        try {
          await sentinel.release();
        } catch {
          /* ignore */
        }
        return;
      }
      sentinelRef.current = sentinel;
      setHeld(true);
      sentinel.addEventListener('release', () => {
        sentinelRef.current = null;
        setHeld(false);
      });
    } catch {
      // Refused (battery saver, no user gesture, policy). Not an error worth
      // surfacing: the white surface alone still helps.
      setHeld(false);
    }
  }, []);

  useEffect(() => {
    if (!active) {
      void release();
      return;
    }

    void acquire();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && activeRef.current && !sentinelRef.current) {
        void acquire();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void release();
    };
  }, [active, acquire, release]);

  return { supported, held };
}

export default useScreenWakeLock;
