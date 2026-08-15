'use client';

/**
 * Outage opt-in — the "Me prévenir par email dès le rétablissement" flow shown
 * under the confirmed-outage message on /resultats.
 *
 * `useOutageStatus()` reads the server health doc `systemStatus/cyberlab` once
 * (auth-gated read, see firestore.rules). It NEVER breaks the page: any failure
 * (rules, offline, missing doc) resolves to `known:false` and the caller keeps
 * showing the plain generic error. It is only "down" when the monitor has
 * actually flipped `up:false` — so the opt-in button appears only when a
 * recovery (down→up) transition is genuinely coming to fulfill the promise.
 *
 * `OutageOptIn` calls the `joinOutageWaitlist` callable (which takes the email
 * from the verified auth token, never from the client). One tap, idempotent.
 */

import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { BellRing, Check, Loader2 } from 'lucide-react';
import { db, getClientFunctions } from '@/config/firebase';

export interface OutageStatus {
  /** True once the health doc has been read (whatever its content). */
  known: boolean;
  /** True only when the monitor reports the server as down. */
  down: boolean;
  /** When the current outage was first detected (from `downSince`). */
  downSince: Date | null;
}

/** One-shot read of the server health status. Never throws. */
export function useOutageStatus(enabled: boolean): OutageStatus {
  const [status, setStatus] = useState<OutageStatus>({ known: false, down: false, downSince: null });

  useEffect(() => {
    if (!enabled || !db) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'systemStatus', 'cyberlab'));
        if (cancelled) return;
        if (!snap.exists()) {
          setStatus({ known: true, down: false, downSince: null });
          return;
        }
        const data = snap.data();
        const down = data.up === false;
        // Prefer downSince; fall back to `since` (both are stamped on the
        // down transition) so the "détectée à {{time}}" line is never blank.
        const ts = data.downSince ?? data.since;
        const downSince =
          down && ts && typeof ts.toDate === 'function' ? ts.toDate() : null;
        setStatus({ known: true, down, downSince });
      } catch {
        // Auth-gated read denied / offline / any error → stay "unknown" so the
        // page falls back to the plain generic error. Never break the page.
        if (!cancelled) setStatus({ known: false, down: false, downSince: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return status;
}

export default function OutageOptIn({ lang }: { lang: string }) {
  const { t } = useTranslation('common');
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle');
  const [email, setEmail] = useState<string>('');

  const handleJoin = useCallback(async () => {
    setState('pending');
    try {
      const functions = await getClientFunctions();
      if (!functions) throw new Error('functions unavailable');
      const call = httpsCallable<{ lang: string }, { ok: true; email: string }>(
        functions,
        'joinOutageWaitlist'
      );
      const res = await call({ lang });
      setEmail(res.data.email);
      setState('done');
    } catch {
      setState('idle');
      toast.error(t('resultats.outage_notify_error', "Impossible d'enregistrer votre demande. Réessayez, ou contactez le laboratoire."));
    }
  }, [lang, t]);

  if (state === 'done') {
    return (
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-[var(--status-success)]">
        <Check size={18} className="flex-shrink-0" />
        {t('resultats.outage_notify_done', {
          email,
          defaultValue: "C'est noté ! Un email sera envoyé à {{email}} dès le rétablissement du serveur.",
        })}
      </p>
    );
  }

  return (
    <button
      onClick={handleJoin}
      disabled={state === 'pending'}
      className="button-bordeaux-outline justify-center flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {state === 'pending' ? <Loader2 size={18} className="animate-spin" /> : <BellRing size={18} />}
      {state === 'pending'
        ? t('resultats.outage_notify_pending', 'Inscription…')
        : t('resultats.outage_notify_button', 'Me prévenir par email dès le rétablissement')}
    </button>
  );
}
