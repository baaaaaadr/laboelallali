"use client";

import React, { useState, useEffect, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { getClientAuth, getClientFunctions } from '@/config/firebase';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
// Popup + blocked-popup redirect fallback, shared with GoogleSignInPrompt.
import { signInWithGoogle } from '@/lib/auth/googleSignIn';
import { renderGoogleButton, signInWithOneTapCredential } from '@/lib/auth/googleOneTap';
import { useAuth } from '@/contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '@/config/firebase';
import MedicalLoader from '@/components/ui/MedicalLoader';
import { Mail, Lock, LogIn, UserPlus, User, Calendar, Phone, CheckCircle, ArrowLeft, ExternalLink } from 'lucide-react';

const inputClass =
  'appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent sm:text-sm transition-colors';

const labelClass = 'block text-sm font-medium text-[var(--text-secondary)] mb-1';

const getFirebaseErrorCode = (err: unknown): string | null => {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  return null;
};

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err);
};

/**
 * Where this signup came from — `?ref=partage` is set by the referral card on
 * /resultats, so the admin dashboard can tell how many accounts word-of-mouth
 * actually brings in. Plain marketing attribution, no personal data.
 */
function readSignupRef(): string {
  try {
    return (new URLSearchParams(window.location.search).get('ref') || '').trim().slice(0, 32);
  } catch {
    return ''; // no window / malformed URL — attribution is optional
  }
}

/**
 * Where to send the user once authenticated. Defaults to /profile, but honors
 * `?redirect=<path>` when present — e.g. /resultats bounces an unauthenticated
 * patient here with `?redirect=/fr/resultats` so that, after login, they land back
 * on their results instead of on the profile page (they'd otherwise be stranded,
 * not knowing how to reach what they came for). Only same-origin relative paths are
 * accepted; anything else falls back to /profile to prevent open-redirect abuse.
 */
function getRedirectTarget(lang: string): string {
  const fallback = `/${lang}/profile`;
  try {
    const raw = new URLSearchParams(window.location.search).get('redirect');
    if (!raw) return fallback;
    // Must be an internal absolute path ("/fr/resultats"). Reject protocol-relative
    // ("//evil.com") and backslash tricks ("/\evil.com") — those are open redirects.
    if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) return raw;
    return fallback;
  } catch {
    return fallback; // no window (SSR) / malformed URL
  }
}

/**
 * On every completed signup, automatically put the new account on the lab's
 * results-access queue (the SAME `resultAccessRequests` doc the "Demander l'accès"
 * button creates). Dr Aziz uses that queue as an onboarding/outreach list: the
 * front desk calls each new registrant to offer and explain the online-results
 * service — so the patient never has to find or press the button themselves.
 *
 * Best-effort ONLY: it must never block or break signup. The callable is
 * idempotent (de-dupes per uid, returns early if the account is already linked),
 * so calling it once per signup is safe and coexists with the manual button.
 * A 2.5 s cap keeps a slow call from delaying the post-signup redirect; the
 * request still completes in the background (soft client-side navigation).
 */
async function autoRequestResultsAccess(): Promise<void> {
  try {
    const functions = await getClientFunctions();
    if (!functions) return;
    // `source` lands in the staff alert email so whoever calls the patient back
    // knows they were enrolled automatically rather than asking themselves.
    const call = httpsCallable(functions, 'requestResultsAccess')({ source: 'signup' });
    await Promise.race([call, new Promise<void>((resolve) => setTimeout(resolve, 2500))]);
  } catch {
    // Non-blocking — the patient can still request access later from /resultats.
  }
}

export default function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, userProfile, loading, refreshProfile } = useAuth();

  // Step 1: auth form — Step 2: profile completion (Google new users)
  const [step, setStep] = useState<'auth' | 'profile' | 'forgot_password'>('auth');
  const [resetSent, setResetSent] = useState(false);
  // CNDP / loi 09-08: explicit consent required at registration.
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Auth fields
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Profile fields (used in signup form + profile step)
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Where Google draws its own button. See the effect below for why it matters. */
  const googleSlot = useRef<HTMLDivElement | null>(null);
  const [nativeGoogleButton, setNativeGoogleButton] = useState(false);

  // Guards against a race where onAuthStateChanged fires before the profile is saved
  const isSigningUp = useRef(false);

  const getAuthErrorMessage = useCallback(
    (err: unknown, fallbackKey: string, fallbackMessage: string) => {
      const code = getFirebaseErrorCode(err);

      switch (code) {
        case 'auth/unauthorized-domain':
          return t('auth_error_unauthorized_domain', "La connexion n'est pas autorisee sur ce domaine. Veuillez contacter le laboratoire.");
        case 'auth/network-request-failed':
          return t('auth_error_network', 'Connexion reseau impossible. Verifiez votre connexion puis reessayez.');
        case 'auth/popup-blocked':
          return t('auth_error_popup_blocked', 'La fenetre Google a ete bloquee. Reessayez ou autorisez les popups pour ce site.');
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
          return t('auth_error_google_cancelled', 'Connexion Google annulee.');
        case 'auth/invalid-email':
          return t('auth_error_invalid_email', "L'adresse email est invalide.");
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          return t('auth_error_invalid_credentials', 'Email ou mot de passe incorrect.');
        case 'auth/email-already-in-use':
          return t('auth_error_email_in_use', 'Un compte existe deja avec cette adresse email.');
        case 'auth/weak-password':
          return t('auth_error_weak_password', 'Le mot de passe doit contenir au moins 6 caracteres.');
        case 'auth/too-many-requests':
          return t('auth_error_too_many_requests', 'Trop de tentatives. Veuillez patienter avant de reessayer.');
        default:
          return getErrorMessage(err) || t(fallbackKey, fallbackMessage);
      }
    },
    [t]
  );

  // Redirect users who are fully logged in with a complete profile — back to where
  // they intended to go (?redirect=…, e.g. /resultats), or /profile by default.
  useEffect(() => {
    if (!loading && user && userProfile?.phone) {
      router.push(getRedirectTarget(lang));
    }
  }, [user, loading, userProfile, router, lang]);

  // Show profile step for users who authenticated but have no profile yet
  useEffect(() => {
    if (!loading && user && !userProfile?.phone && !isSigningUp.current) {
      setStep('profile');
    }
  }, [user, loading, userProfile]);

  // Pre-fill name from Google display name when showing step 2
  useEffect(() => {
    if (step === 'profile' && user?.displayName && !fullName) {
      setFullName(user.displayName);
    }
  }, [step, user?.displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let mounted = true;

    const resolveGoogleRedirect = async () => {
      try {
        const auth = await getClientAuth();
        if (!auth) return;
        await getRedirectResult(auth);
      } catch (err: unknown) {
        console.error(err);
        if (mounted) {
          setError(getAuthErrorMessage(err, 'error_google_login', 'Echec de la connexion avec Google'));
        }
      }
    };

    resolveGoogleRedirect();

    return () => {
      mounted = false;
    };
  }, [getAuthErrorMessage]);

  const persistProfile = async (uid: string, userEmail: string | null) => {
    if (!db) throw new Error('DB not initialized');
    // Explicitly typed: an inline conditional spread here made TypeScript's
    // inference blow past its instantiation budget on this file (TS2589).
    const payload: Record<string, unknown> = {
      uid,
      fullName,
      dateOfBirth,
      phone,
      email: userEmail,
      createdAt: new Date().toISOString(),
      consentAccepted: true,
      consentAcceptedAt: new Date().toISOString(),
    };
    const signupRef = readSignupRef();
    if (signupRef) payload.signupRef = signupRef;

    // merge:true so we never wipe fields set elsewhere (e.g. requester_id/type/role
    // written by the admin space). Records the CNDP consent given at registration.
    await setDoc(doc(db, 'users', uid), payload, { merge: true });
  };

  /**
   * Let Google draw its own button here, and make it the primary Google CTA.
   *
   * **This is the load-bearing half of the personalized-button fix, not a
   * cosmetic upgrade.** Google only renders "Continuer en tant que <Nom>" for an
   * account that has already completed a Sign In With Google flow **on this
   * origin**. A Firebase `signInWithPopup` does not qualify: it hands off to
   * `labo-el-allali-pwa.firebaseapp.com/__/auth/handler`, a different origin,
   * and it is not a FedCM flow. So as long as every patient signs in through the
   * hand-made button below, that record is never created and the button stays
   * generic forever — which is exactly what was observed in production.
   *
   * Putting the real GSI button on the page someone actually uses is what
   * eventually earns the personalization. The hand-made button stays underneath
   * for the cases Google cannot serve (ad blocker, Safari, Firefox).
   *
   * No `router.push` on success: we are already on /login, and the existing
   * step-2 effect takes over to complete the profile or forward the user.
   */
  useEffect(() => {
    if (step !== 'auth') return;
    const slot = googleSlot.current;
    if (!slot) return;
    let alive = true;
    void renderGoogleButton(slot, {
      locale: lang,
      width: slot.clientWidth || 320,
      dark: document.documentElement.classList.contains('dark'),
      onCredential: (idToken) => {
        if (!alive) return;
        void (async () => {
          try {
            setIsSubmitting(true);
            setError(null);
            await signInWithOneTapCredential(idToken);
          } catch (err: unknown) {
            console.error(err);
            setError(getAuthErrorMessage(err, 'error_google_login', 'Echec de la connexion avec Google'));
          } finally {
            setIsSubmitting(false);
          }
        })();
      },
    }).then((ok) => {
      if (alive && ok) setNativeGoogleButton(true);
    });
    return () => {
      alive = false;
    };
    // `getAuthErrorMessage` is a useCallback and is listed for the same reason
    // the redirect-result effect above lists it: stable identity, no re-runs.
  }, [step, lang, getAuthErrorMessage]);

  const handleGoogleLogin = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      // Popup + blocked-popup redirect fallback both live in
      // src/lib/auth/googleSignIn.ts, shared with the global GoogleSignInPrompt.
      await signInWithGoogle();
    } catch (err: unknown) {
      console.error(err);
      setError(getAuthErrorMessage(err, 'error_google_login', 'Echec de la connexion avec Google'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp && !consentAccepted) {
      setError(t('consent_error', 'Vous devez accepter la politique de confidentialité pour continuer.'));
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      const auth = await getClientAuth();
      if (!auth) throw new Error('Auth not initialized');

      if (isSignUp) {
        isSigningUp.current = true;
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await persistProfile(cred.user.uid, cred.user.email);
        await refreshProfile();
        isSigningUp.current = false;
        // New account → queue it for staff onboarding (Dr Aziz). Best-effort.
        await autoRequestResultsAccess();
        router.push(getRedirectTarget(lang));
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: unknown) {
      isSigningUp.current = false;
      console.error(err);
      setError(getAuthErrorMessage(err, 'error_auth', "Echec de l'authentification"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!consentAccepted) {
      setError(t('consent_error', 'Vous devez accepter la politique de confidentialité pour continuer.'));
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      await persistProfile(user.uid, user.email);
      await refreshProfile();
      // New account (Google, profile just completed) → queue for staff onboarding.
      await autoRequestResultsAccess();
      router.push(getRedirectTarget(lang));
    } catch (err: unknown) {
      console.error(err);
      setError(getAuthErrorMessage(err, 'error_save_profile', 'Echec de la sauvegarde du profil'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      const auth = await getClientAuth();
      if (!auth) throw new Error('Auth not initialized');
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: unknown) {
      console.error(err);
      setError(getAuthErrorMessage(err, 'error_reset_password', "Echec de l'envoi de l'e-mail de reinitialisation"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const consentCheckbox = (
    <label className="flex items-start gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
      <input
        type="checkbox"
        checked={consentAccepted}
        onChange={(e) => setConsentAccepted(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--color-bordeaux-primary)] flex-shrink-0"
      />
      <span>
        {t('consent_prefix', "J'ai lu et j'accepte la ")}
        <Link
          href={`/${lang}/confidentialite`}
          target="_blank"
          className="text-[var(--color-bordeaux-primary)] underline hover:text-[var(--color-fuchsia-accent)]"
        >
          {t('consent_link', 'politique de confidentialité')}
        </Link>
        {t('consent_suffix', '.')}
      </span>
    </label>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background-default)]">
        <MedicalLoader />
      </div>
    );
  }

  if (user && userProfile?.phone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background-default)]">
        <MedicalLoader />
      </div>
    );
  }

  // ── Step: Forgot Password ──────────────────────────────────────────────────
  if (step === 'forgot_password') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
        <div className="max-w-md w-full space-y-8 bg-[var(--background-card)] p-8 rounded-lg shadow-xl border border-[var(--border-default)]">
          <div>
            <div className="mx-auto h-12 w-12 bg-[var(--color-bordeaux-primary)] text-white rounded-lg flex items-center justify-center">
              <Lock size={24} />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--text-primary)]">
              {t('forgot_password', 'Mot de passe oublié ?')}
            </h2>
            <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
              {resetSent
                ? t('reset_email_sent', 'Un e-mail de réinitialisation a été envoyé. Veuillez vérifier votre boîte de réception.')
                : t('forgot_password_desc', 'Saisissez votre e-mail pour recevoir un lien de réinitialisation.')}
            </p>
          </div>

          {resetSent ? (
            <div className="mt-8">
              <button
                onClick={() => {
                  setStep('auth');
                  setError(null);
                  setResetSent(false);
                }}
                className="group relative w-full button-bordeaux justify-center flex items-center gap-2"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
                {t('back_to_login', 'Retour à la connexion')}
              </button>
            </div>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleForgotPassword}>
              {error && (
                <div className="p-3 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 text-[var(--status-error)] rounded-lg text-sm text-center">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="reset-email" className={labelClass}>
                  {t('email', 'Adresse Email')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="exemple@email.com"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group relative w-full button-bordeaux justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <CheckCircle className="h-5 w-5 text-white/70 group-hover:text-white" />
                  </span>
                  {isSubmitting ? '...' : t('reset_password', 'Réinitialiser le mot de passe')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('auth');
                    setError(null);
                  }}
                  className="group relative w-full button-outline justify-center flex items-center gap-2"
                >
                  <ArrowLeft className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />
                  {t('back_to_login', 'Retour à la connexion')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Step 2: Profile completion ─────────────────────────────────────────────
  if (step === 'profile') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
        <div className="max-w-md w-full space-y-8 bg-[var(--background-card)] p-8 rounded-lg shadow-xl border border-[var(--border-default)]">
          <div>
            <div className="mx-auto h-12 w-12 bg-[var(--color-bordeaux-primary)] text-white rounded-lg flex items-center justify-center">
              <User size={24} />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--text-primary)]">
              {t('almost_there', 'Presque terminé !')}
            </h2>
            <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
              {t('complete_profile_desc', 'Complétez votre profil pour accéder à votre espace patient.')}
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleProfileSubmit}>
            {error && (
              <div className="p-3 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 text-[var(--status-error)] rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="p2-fullName" className={labelClass}>
                {t('full_name', 'Nom complet')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="p2-fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                  placeholder="Ahmed El Allali"
                />
              </div>
            </div>

            <div>
              <label htmlFor="p2-dob" className={labelClass}>
                {t('date_of_birth', 'Date de naissance')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="p2-dob"
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="p2-phone" className={labelClass}>
                {t('phone', 'Téléphone')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="p2-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                  placeholder="+212 6XX XXX XXX"
                />
              </div>
            </div>

            {consentCheckbox}

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full button-bordeaux justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <CheckCircle className="h-5 w-5 text-white/70 group-hover:text-white" />
              </span>
              {isSubmitting ? '...' : t('save_profile', 'Enregistrer mon profil')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Step 1: Auth form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
      <div className="max-w-md w-full space-y-8 bg-[var(--background-card)] p-8 rounded-lg shadow-xl border border-[var(--border-default)]">
        <div>
          <div className="mx-auto h-12 w-12 bg-[var(--color-bordeaux-primary)] text-white rounded-lg flex items-center justify-center font-bold text-2xl">
            L
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--text-primary)]">
            {isSignUp ? t('create_account', 'Créer un compte') : t('sign_in', 'Connexion')}
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
            {isSignUp
              ? t('signup_subtitle', 'Rejoignez Laboratoire El Allali')
              : t('signin_subtitle', 'Accédez à votre espace patient')}
          </p>
        </div>

        {/* Help text (demande n. 21). Sits above the Google button because that is
            the path we actually want patients to take. The third item the lab
            asked for ("an agent will assist you") is deliberately NOT here: it
            needs a call-back workflow, which is a separately quoted line. */}
        <div className="space-y-2 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {t('login_help.intro', 'Retrouvez toutes vos analyses en vous connectant ici avec votre compte Google.')}
          </p>
          <a
            href={`https://accounts.google.com/signup?hl=${lang === 'ar' ? 'ar' : 'fr'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-bordeaux-primary)] hover:text-[var(--color-fuchsia-accent)] transition-colors"
          >
            {t('login_help.no_google', "Vous n'avez pas de compte Google ? Créez-en un en trois minutes")}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>

        {/* Error block lives OUTSIDE the form on purpose: handleGoogleLogin also
            calls setError, and with Google now above the form the message would
            otherwise show up far below the button that produced it. */}
        {error && (
          <div className="p-3 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 text-[var(--status-error)] rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        {/* Google first (demande n. 19). Promoted by hierarchy, not by colour:
            Google's branding rules require the white/black/blue button with the
            official G mark, so it gets the full width, a heavier border and a
            real label instead of a bare "Google". */}
        {/* Google's own button. Empty and collapsed until it renders, so nothing
            moves if it never does. */}
        <div ref={googleSlot} className="flex justify-center [&:empty]:hidden" />

        {!nativeGoogleButton && (
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center px-4 py-3 border-2 border-[var(--border-default)] rounded-lg shadow-sm bg-[var(--background-default)] text-base font-semibold text-[var(--text-primary)] hover:bg-[var(--background-tertiary)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-fuchsia-accent)] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <svg className="h-5 w-5 me-2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {t('continue_with_google', 'Continuer avec Google')}
        </button>
        )}

        {/* Separator. New key rather than reusing `or_continue_with`: that string
            ("Ou continuer avec") introduced Google, it makes no sense now that it
            introduces the email form. The old key is left in place, unused. */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border-default)]" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[var(--background-card)] text-[var(--text-tertiary)]">
              {t('or_use_email', 'Ou utiliser une adresse e-mail')}
            </span>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleEmailAuth}>
          {/* Name — signup only */}
          {isSignUp && (
            <div>
              <label htmlFor="s1-fullName" className={labelClass}>
                {t('full_name', 'Nom complet')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="s1-fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                  placeholder="Ahmed El Allali"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="s1-email" className={labelClass}>
              {t('email', 'Adresse Email')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="s1-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="exemple@email.com"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="s1-password" className="block text-sm font-medium text-[var(--text-secondary)]">
                {t('password', 'Mot de passe')}
              </label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => {
                    setStep('forgot_password');
                    setError(null);
                    setResetSent(false);
                  }}
                  className="text-xs font-medium text-[var(--color-bordeaux-primary)] hover:text-[var(--color-fuchsia-accent)] transition-colors cursor-pointer"
                >
                  {t('forgot_password', 'Mot de passe oublié ?')}
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="s1-password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Date of birth + Phone — signup only */}
          {isSignUp && (
            <>
              <div>
                <label htmlFor="s1-dob" className={labelClass}>
                  {t('date_of_birth', 'Date de naissance')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="s1-dob"
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="s1-phone" className={labelClass}>
                  {t('phone', 'Téléphone')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="s1-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    placeholder="+212 6XX XXX XXX"
                  />
                </div>
              </div>
            </>
          )}

          {isSignUp && consentCheckbox}

          <button
            type="submit"
            disabled={isSubmitting}
            className="group relative w-full button-bordeaux justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              {isSignUp
                ? <UserPlus className="h-5 w-5 text-white/70 group-hover:text-white" />
                : <LogIn className="h-5 w-5 text-white/70 group-hover:text-white" />}
            </span>
            {isSubmitting ? '...' : (isSignUp ? t('sign_up', "S'inscrire") : t('sign_in', 'Se connecter'))}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setFullName('');
              setDateOfBirth('');
              setPhone('');
            }}
            className="text-sm font-medium text-[var(--color-bordeaux-primary)] hover:text-[var(--color-fuchsia-accent)] transition-colors"
          >
            {isSignUp
              ? t('already_have_account', 'Vous avez déjà un compte ? Connectez-vous')
              : t('no_account', "Pas encore de compte ? Inscrivez-vous")}
          </button>
        </div>
      </div>
    </div>
  );
}
