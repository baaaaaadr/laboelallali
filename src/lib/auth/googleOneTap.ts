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
 * The same interdiction applies, by name, to **`button_auto_select`** — the
 * button-flow twin, which re-creates the same bug after the click.
 * `use_fedcm_for_button: true` is the opposite and IS required: FedCM still
 * shows the name, the e-mail and the avatar before anything happens.
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

/**
 * The Web OAuth client Firebase auto-created for this project.
 *
 * **Public by nature** — it already travels in every OAuth URL the browser
 * sends, and it is useless from an origin that is not authorized in Google Cloud
 * Console. It is not a secret and must not be treated as one.
 *
 * ⚠ The literal fallback is deliberate, and load-bearing. **The Firebase
 * web-frameworks deploy does NOT apply `.env.local` to the client build.** Proof
 * that is not a guess: `.env.local` sets
 * `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=laboelallali.com`, yet production has always
 * relayed through `labo-el-allali-pwa.firebaseapp.com` — Firebase injects its own
 * config and our file is ignored. Shipping this value only through the env
 * therefore produced an EMPTY client id in the bundle, `isOneTapConfigured()`
 * returned false, the GSI script was never even requested, and One Tap silently
 * did nothing in production while working perfectly in dev.
 * Keep the env override first so another environment can point elsewhere.
 */
const FALLBACK_CLIENT_ID = '611850340982-901b8smpi7o89dq4db5tt9a9ect199mj.apps.googleusercontent.com';
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || FALLBACK_CLIENT_ID;

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
      // ITP browsers only (Safari, Firefox, Chrome iOS). Inert on Chrome
      // desktop; kept for iPhone patients.
      itp_support: true,
      // Routes the BUTTON through Chrome's own FedCM dialog instead of the
      // accounts.google.com "Selectionnez un compte" popup — and, decisively,
      // it is the ONLY thing that records {this origin <-> google.com <-> that
      // account} in the browser. That record is the precondition for the
      // personalized "Continuer en tant que <Nom>" button on LATER visits.
      // Defaults to false, which is why the button had always been generic.
      // IdConfiguration only: renderButton() silently ignores it.
      use_fedcm_for_button: true,
      // ⚠ NEVER add `button_auto_select`. It is the button-flow twin of
      // `auto_select`: it signs a returning visitor in while bypassing the
      // account chooser. That is exactly the wrong-account incident described
      // at the top of this file — shared family phone, patient signed in as
      // someone else, on an app that shows medical results.
      //
      // `use_fedcm_for_prompt` used to sit here. Google's reference now marks it
      // "Deprecated: this attribute will be ignored if used" — One Tap goes
      // through FedCM unconditionally. It was removed rather than left in place,
      // because the comment that justified it ("without this the card never
      // appears") was simply false and sent the next reader down a dead end.
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
 * Google renders the PERSONALIZED button — "Continuer en tant que <Nom>" with
 * the avatar — only when ALL of these hold:
 *   1. an active Google session in this browser, AND
 *   2. **that account has already completed a Sign In With Google flow on THIS
 *      origin, in THIS browser, not cleared since.** A Firebase
 *      `signInWithPopup` through `firebaseapp.com/__/auth/handler` does NOT
 *      count — different origin, and not a FedCM flow. This is the condition
 *      that had never once been met in production, which is why the button was
 *      always generic no matter what was configured.
 *   3. `use_fedcm_for_button: true` in initialize()   (set above)
 *   4. `type: 'standard'` and `size: 'large'`         (set below)
 *   5. width >= 200px                                 (clamped below)
 * Otherwise it degrades — silently and by design — to "Continuer avec Google".
 * SEVERAL active Google sessions also degrade it. Safari and Firefox have no
 * FedCM button mode and always get the generic one.
 *
 * Consequence to state plainly rather than discover: the FIRST visit after this
 * ships still shows the generic button and the chooser, for everyone. That first
 * flow is what CREATES the record. Personalization starts on the second visit.
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
 *
 * THIRTY seconds, deliberately long. The owner saw both cards at once — the One
 * Tap list top-right and our own bottom-right — and only wants the first. Under
 * FedCM a page cannot ask whether the card is displayed, so the only lever is
 * time. A visitor who ACTS on the card gives us a credential, and one who CLOSES
 * it gives us a dismissal (→ 30-day snooze, our card never appears): both end
 * the wait immediately. The remaining overlap is only "displayed and ignored for
 * half a minute", which is rare and harmless — whereas dropping the fallback
 * entirely would leave anyone WITHOUT a Google session with nothing at all.
 */
export function promptOneTap(
  onOutcome: (o: OneTapOutcome) => void,
  silenceAfterMs = 30000
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
