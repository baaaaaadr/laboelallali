'use client';

/**
 * Non-blocking invitation to sign in with Google, shown to visitors who are not
 * logged in (demande n. 19: "proposer de se connecter par gmail des ouverture
 * de l'app"). Same shape as IOSInstallBanner: no modal, no navigation lock —
 * a dismissible strip that renders `null` until it has something to say.
 *
 * THE IMPORTANT PART — why a successful sign-in navigates to /login.
 * A first Google sign-in creates an authenticated user with NO Firestore
 * profile (no phone number). The profile-completion step, and the automatic
 * `requestResultsAccess()` call that puts the patient in the lab's onboarding
 * queue, exist ONLY on the login page. Signing in from here and staying put
 * would produce an account that is authenticated, has no phone, and never
 * reaches the queue — the exact opposite of the goal. So we hand over to
 * /login, whose existing effect either shows the profile step or forwards a
 * complete profile to its post-auth target.
 * Invariant: every Google account creation goes through /login.
 *
 * Mounted from src/app/[lang]/layout.tsx and NOT from PWAComponents: that one
 * returns null in standalone display mode, i.e. precisely inside the installed
 * app, where this prompt is most useful.
 *
 * ── One Tap arbitration (septembre 2026) ────────────────────────────────────
 * This component now owns BOTH solicitations, so there is exactly one place
 * deciding which appears — the rule its header has always stated.
 *
 *   1. Google One Tap is tried first. Its card names the account, so a visitor
 *      with a Google session signs in with a single tap. See googleOneTap.ts
 *      for why that is SAFER than the popup, not laxer.
 *   2. Only if One Tap cannot run — no client id, script blocked by an
 *      extension, or ten silent seconds (usually: no Google session at all, or
 *      Chrome's post-dismissal cooldown) — does this card appear.
 *   3. If the visitor closes the One Tap card, that is an answer: we snooze for
 *      30 days and show nothing. Asking twice in a row is how a prompt becomes
 *      a nuisance.
 *
 * Under FedCM a page can no longer ask whether the card was displayed, so step
 * 2 is a timeout, not a signal. During those ten seconds both could in theory
 * be on screen — accepted knowingly, and the reason the delay is long.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithGoogle } from '@/lib/auth/googleSignIn';
import { promptOneTap, signInWithOneTapCredential } from '@/lib/auth/googleOneTap';

const STORAGE_KEY = 'googleSignInPromptDismissedAt';
/** Dated dismissal, not a boolean: a permanent 'true' would kill the CTA on this
 *  device forever, including for someone who simply was not ready that day. */
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
/** Let the page be read first. Appearing on the very first paint reads as a
 *  pop-up and covers content before the visitor has seen any of it. */
const DELAY_MS = 3000;

/**
 * Routes where the prompt must stay quiet, matched on the first path segment
 * after the locale. `login` (redundant), the RDV and GLABO funnels (never
 * interrupt a conversion in progress), `profile`/`admin` (already signed in),
 * `resultats` (has its own sign-in CTA — two competing ones cancel out), and
 * `confidentialite` (legal page).
 */
const HIDDEN_ROUTES = new Set([
  'login',
  'rendez-vous',
  'glabo',
  'profile',
  'admin',
  'resultats',
  'confidentialite',
]);

/** '/fr/analyses' → 'analyses'; '/fr' → ''. */
function sectionOf(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length > 1 ? parts[1] : '';
}

/** 'fr' | 'ar', read back from the URL (this component has no params). */
function localeOf(pathname: string): string {
  const first = pathname.split('/').filter(Boolean)[0];
  return first === 'ar' ? 'ar' : 'fr';
}

export default function GoogleSignInPrompt() {
  const { t } = useTranslation('common');
  const { user, loading } = useAuth();
  const pathname = usePathname() || '/';
  const router = useRouter();

  // Starts false and only ever turns true inside an effect — the first render is
  // therefore identical on server and client, no hydration mismatch.
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Our own card. Stays false while One Tap has a chance of showing its own. */
  const [showCard, setShowCard] = useState(false);
  /** One attempt per mount: pathname changes must not re-prompt on every step. */
  const attempted = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const dismissedAt = Number(window.localStorage.getItem(STORAGE_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < SNOOZE_MS) return;

    // One solicitation at a time: on iOS the install banner may already be up.
    const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
    if (isIOS && !window.localStorage.getItem('iosInstallBannerDismissed')) return;

    const timer = window.setTimeout(() => setAllowed(true), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Private mode / storage disabled — hiding it for this session is enough.
    }
    setAllowed(false);
  }, []);

  /**
   * A One Tap credential. The handover to /login is NOT optional: profile
   * completion and `requestResultsAccess()` live only there (see header).
   * `?redirect=` sends a patient whose profile is already complete back to the
   * page they were reading; /login validates it and ignores anything unsafe.
   */
  const handleCredential = useCallback(
    async (idToken: string) => {
      setBusy(true);
      try {
        await signInWithOneTapCredential(idToken);
        const lang = localeOf(pathname);
        router.push(`/${lang}/login?redirect=${encodeURIComponent(pathname)}`);
      } catch {
        // Revoked token, offline, disabled account… fall back to the explicit
        // button, which has the full chooser and real error handling.
        setShowCard(true);
      } finally {
        setBusy(false);
      }
    },
    [pathname, router]
  );

  const hidden = HIDDEN_ROUTES.has(sectionOf(pathname));

  useEffect(() => {
    if (!allowed || loading || user || hidden || attempted.current) return;
    attempted.current = true;
    return promptOneTap((outcome) => {
      if (outcome.credential) void handleCredential(outcome.credential);
      else if (outcome.dismissed) dismiss();
      else setShowCard(true);
    });
  }, [allowed, loading, user, hidden, handleCredential, dismiss]);

  const handleSignIn = useCallback(async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
      // See the header comment: /login owns profile completion and the access
      // request. Also covers the popup-blocked path, which navigates away first.
      router.push(`/${localeOf(pathname)}/login?redirect=${encodeURIComponent(pathname)}`);
    } catch {
      // Closed popup, offline, blocked account… nothing to say here: the full
      // login page has the error handling. Just step out of the way.
      dismiss();
    } finally {
      setBusy(false);
    }
  }, [dismiss, pathname, router]);

  if (!allowed || loading || user || hidden) return null;
  // One Tap may still be about to show its own card — do not compete with it.
  if (!showCard) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-[calc(var(--mobile-bottom-nav-offset,64px)+0.75rem)] z-[900] mx-auto max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--background-card)] p-4 shadow-xl lg:bottom-4 lg:inset-x-auto lg:end-4 lg:mx-0"
      role="region"
      aria-label={t('google_prompt.title', 'Accédez à vos analyses')}
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-2 end-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        aria-label={t('google_prompt.dismiss_aria', 'Fermer')}
      >
        <X size={18} />
      </button>

      <p className="pe-8 text-sm font-semibold text-[var(--text-primary)]">
        {t('google_prompt.title', 'Accédez à vos analyses')}
      </p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        {t('google_prompt.body', 'Connectez-vous avec Google pour consulter vos résultats.')}
      </p>

      <button
        type="button"
        onClick={handleSignIn}
        disabled={busy}
        className="mt-3 w-full flex items-center justify-center rounded-lg border-2 border-[var(--border-default)] bg-[var(--background-default)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition-colors hover:bg-[var(--background-tertiary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-fuchsia-accent)] disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <svg className="h-5 w-5 me-2" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        {t('continue_with_google', 'Continuer avec Google')}
      </button>
    </div>
  );
}
