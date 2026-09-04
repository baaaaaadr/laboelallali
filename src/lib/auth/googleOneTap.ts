/**
 * Google One Tap — the "sign in in one click" side of Google auth.
 *
 * ⚠ READ THIS BEFORE CHANGING ANYTHING HERE.
 *
 * `src/lib/auth/googleSignIn.ts` sets `prompt: 'select_account'` because Google
 * was silently reusing the browser session and signing patients in as the WRONG
 * PERSON on a shared family phone (the normal case for this lab). One Tap uses
 * the same underlying session. The ONLY reason it is safe is that its card
 * always shows a name, an e-mail and an avatar, and requires a tap on that
 * specific card — the identity is visible *before* anything happens.
 *
 * That safety rests entirely on `auto_select: false` below. Flipping it to
 * `true` re-creates the wrong-account bug, and re-creates it worse: with zero
 * interaction there is not even a flash of a popup for the patient to notice.
 * **Do not "optimize" it.**
 *
 * This module never touches `googleSignIn.ts`. Two paths, two guarantees:
 *   - the One Tap card  → "continue as <named person>", identity visible, 1 tap
 *   - the explicit button → the full chooser, via `prompt: 'select_account'`
 * The explicit button must always stay reachable; One Tap never replaces it.
 *
 * Bonus, not a side effect: One Tap returns an ID token directly, so it skips
 * the cross-domain `firebaseapp.com/__/auth/handler` relay documented in
 * googleSignIn.ts — a real win on Safari/iOS where third-party storage is
 * restricted.
 */

import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { getClientAuth } from '@/config/firebase';

/** Public by nature — it travels in every OAuth URL the browser already sends. */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

interface GsiMoment {
  isDismissedMoment?: () => boolean;
  getDismissedReason?: () => string;
}
interface GsiId {
  initialize: (config: Record<string, unknown>) => void;
  prompt: (listener?: (n: GsiMoment) => void) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
  cancel: () => void;
}
type GsiWindow = Window & { google?: { accounts?: { id?: GsiId } } };

export function isOneTapConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0;
}

let scriptPromise: Promise<boolean> | null = null;

/**
 * Load the GSI script once per page. Resolves false rather than throwing: an ad
 * blocker or an offline device must degrade to the ordinary button, never to a
 * broken page.
 */
function loadGsi(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const w = window as GsiWindow;
  if (w.google?.accounts?.id) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(!!w.google?.accounts?.id));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(!!w.google?.accounts?.id);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * `initialize()` may only be called once per page; both consumers below go
 * through here, and the credential is routed to whoever asked last.
 */
let initialized = false;
let credentialSink: ((idToken: string) => void) | null = null;

async function ensureGsi(): Promise<GsiId | null> {
  if (!isOneTapConfigured()) return null;
  const ok = await loadGsi();
  const id = (window as GsiWindow).google?.accounts?.id;
  if (!ok || !id) return null;
  if (!initialized) {
    id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      // ⚠ NEVER true. See the header of this file, and googleSignIn.ts.
      auto_select: false,
      cancel_on_tap_outside: true,
      context: 'signin',
      itp_support: true,
      // Chrome removed the legacy iframe path; without this the card simply
      // never appears in recent versions.
      use_fedcm_for_prompt: true,
      callback: (res: { credential?: string }) => {
        if (res?.credential) credentialSink?.(res.credential);
      },
    });
    initialized = true;
  }
  return id;
}

/**
 * Render Google's OWN button inside `parent`.
 *
 * This is the answer to "can the signed-in account show up directly in the
 * widget?". When the visitor has a Google session and has already granted
 * consent, Google renders a **personalized** button — "Continuer en tant que
 * <Nom>", with their avatar — and clicking it signs them in **without opening
 * any popup**: the ID token arrives straight in the callback. With no session it
 * degrades to the ordinary "Continuer avec Google", which opens the chooser.
 *
 * It shows ONE account (the browser's active session), not a list — that is a
 * Google constraint, not ours. Someone with several accounts still gets the
 * chooser, from the button or from One Tap.
 *
 * Resolves false if the button could not be rendered, so the caller keeps its
 * own fallback markup.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  opts: { locale?: string; width?: number; dark?: boolean; onCredential: (idToken: string) => void }
): Promise<boolean> {
  const id = await ensureGsi();
  if (!id) return false;
  credentialSink = opts.onCredential;
  try {
    parent.innerHTML = '';
    id.renderButton(parent, {
      type: 'standard',
      // Google's own dark variant; `outline` on a dark card reads as a hole.
      theme: opts.dark ? 'filled_black' : 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      locale: opts.locale === 'ar' ? 'ar' : 'fr',
      // Google caps this at 400px and ignores anything larger.
      width: Math.min(400, Math.max(200, Math.round(opts.width || 320))),
    });
    return parent.childElementCount > 0;
  } catch {
    return false;
  }
}

export interface OneTapOutcome {
  /** The card was shown and the visitor chose an account. */
  credential?: string;
  /** The visitor actively closed the card. Treat as "not now", do not re-ask. */
  dismissed?: boolean;
  /** One Tap could not run at all (no client id, script blocked, init failed). */
  unavailable?: boolean;
}

/**
 * Ask Google to show the One Tap card.
 *
 * Returns a cleanup function. The outcome arrives through `onOutcome`, which is
 * called AT MOST ONCE.
 *
 * **`silenceAfterMs`** exists because of FedCM: Chrome removed
 * `isNotDisplayed()` / `isSkippedMoment()`, so a page can no longer ask whether
 * the card actually appeared. The only honest reading of "nothing happened" is
 * elapsed time — most often it means the visitor has no Google session at all,
 * or Chrome put One Tap in its post-dismissal cooldown. After that delay the
 * caller may show its own card; the One Tap card is NOT closed (see `settle`).
 * Twelve seconds, not six: FedCM negotiates with Google over the network and is
 * slower when several accounts are signed in.
 */
export function promptOneTap(
  onOutcome: (o: OneTapOutcome) => void,
  silenceAfterMs = 12000
): () => void {
  let settled = false;
  let timer: number | undefined;

  const closeCard = () => {
    try {
      (window as GsiWindow).google?.accounts?.id?.cancel();
    } catch {
      // No card up, or the script never loaded. Nothing to close.
    }
  };

  const settle = (o: OneTapOutcome) => {
    if (settled) return;
    settled = true;
    if (timer) window.clearTimeout(timer);
    // ⚠ We used to `closeCard()` here, to guarantee a single solicitation. That
    // was a mistake: FedCM can take several seconds to answer Google (longer
    // with many signed-in accounts), so the timeout was closing the One Tap card
    // at the very moment it was about to appear — which is exactly what "I never
    // see the Google card" looked like from the field. The window is now long
    // (12s) and the card is left alone; on desktop Chrome anchors it top-right
    // while our own card sits bottom-right, so they do not collide.
    onOutcome(o);
  };

  if (!isOneTapConfigured()) {
    settle({ unavailable: true });
    return () => {};
  }

  void ensureGsi().then((id) => {
    if (settled) return;
    if (!id) return settle({ unavailable: true });

    try {
      credentialSink = (idToken) => settle({ credential: idToken });

      id.prompt((n: GsiMoment) => {
        // Under FedCM only the dismissal moment survives — and a dismissal whose
        // reason is `credential_returned` is a SUCCESS, not a refusal.
        if (n?.isDismissedMoment?.() && n.getDismissedReason?.() !== 'credential_returned') {
          settle({ dismissed: true });
        }
      });

      timer = window.setTimeout(() => settle({ unavailable: true }), silenceAfterMs);
    } catch {
      settle({ unavailable: true });
    }
  });

  return () => {
    settled = true;
    if (timer) window.clearTimeout(timer);
    closeCard();
  };
}

/**
 * Exchange a One Tap ID token for a Firebase session.
 *
 * Throws like any Firebase auth call; the caller decides what to show. Note the
 * caller must STILL hand over to /login afterwards — profile completion and the
 * automatic results-access request live only there, and an account created
 * anywhere else has no phone number and never reaches the lab's queue.
 */
export async function signInWithOneTapCredential(idToken: string): Promise<void> {
  const auth = await getClientAuth();
  if (!auth) throw new Error('Auth not initialized');
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}
