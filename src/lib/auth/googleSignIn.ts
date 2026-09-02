/**
 * Shared Google sign-in — the ONLY place the popup→redirect fallback lives.
 *
 * Extracted from `src/app/[lang]/login/page.tsx` when the global sign-in prompt
 * (`GoogleSignInPrompt`) became a second caller. Duplicating the fallback is
 * exactly the kind of thing that drifts silently: the popup path works on most
 * browsers, so a divergent copy of the blocked-popup branch would go unnoticed
 * for months.
 *
 * Error MESSAGES stay with the callers: the login page has its own
 * `getAuthErrorMessage` + inline error state, the banner just closes itself.
 *
 * Both flows are first-party because NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is the
 * app's own domain (laboelallali.com) — no cross-domain auth relay, no
 * third-party-cookie failure. See docs/pages/login.md.
 */
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { getClientAuth } from '@/config/firebase';

/** Firebase Auth error codes come as `{ code: string }` on an unknown throwable. */
function errorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/**
 * Sign in with Google. Resolves once the popup flow completed.
 *
 * Always asks Google to show the account chooser (`prompt: 'select_account'`),
 * for both the popup and the redirect fallback — never silently reuse a session.
 *
 * On `auth/popup-blocked` it falls back to a full-page redirect and resolves
 * WITHOUT the user being signed in yet — the page navigates away and the result
 * is consumed by `getRedirectResult` on the login page. Callers must therefore
 * not assume `resolved === signed in`; anything they do afterwards has to
 * tolerate the redirect never coming back to the same component.
 *
 * Throws every other auth error (including the user simply closing the popup).
 */
export async function signInWithGoogle(): Promise<void> {
  const auth = await getClientAuth();
  if (!auth) throw new Error('Auth not initialized');

  const provider = new GoogleAuthProvider();
  // Without this, Google's authorization endpoint receives NO `prompt` parameter
  // (verified: the popup requests accounts.google.com/o/oauth2/auth with prompt
  // absent). Google is then free to reuse whatever session the browser already
  // has and to skip the chooser entirely once consent was granted once: the
  // account picker flashes open, closes by itself, and the patient is signed in
  // as an account they never picked. On a phone shared inside a family — the
  // normal case here — that silently opens the wrong person's account.
  // `select_account` forces the picker on every single sign-in.
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (err: unknown) {
    if (errorCode(err) === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}
