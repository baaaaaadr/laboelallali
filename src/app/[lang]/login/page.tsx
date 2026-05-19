"use client";

import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { getClientAuth } from '@/config/firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Mail, Lock, LogIn, UserPlus, User, Calendar, Phone, CheckCircle } from 'lucide-react';

const inputClass =
  'appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent sm:text-sm transition-colors';

const labelClass = 'block text-sm font-medium text-[var(--text-secondary)] mb-1';

export default function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, userProfile, loading, refreshProfile } = useAuth();

  // Step 1: auth form — Step 2: profile completion (Google new users)
  const [step, setStep] = useState<'auth' | 'profile'>('auth');

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

  // Guards against a race where onAuthStateChanged fires before the profile is saved
  const isSigningUp = useRef(false);

  // Redirect users who are fully logged in with a complete profile
  useEffect(() => {
    if (!loading && user && userProfile?.phone) {
      router.push(`/${lang}/profile`);
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

  const persistProfile = async (uid: string, userEmail: string | null) => {
    if (!db) throw new Error('DB not initialized');
    await setDoc(doc(db, 'users', uid), {
      uid,
      fullName,
      dateOfBirth,
      phone,
      email: userEmail,
      createdAt: new Date().toISOString(),
    });
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      const auth = await getClientAuth();
      if (!auth) throw new Error('Auth not initialized');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('error_google_login', 'Échec de la connexion avec Google'));
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
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
        router.push(`/${lang}/profile`);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      isSigningUp.current = false;
      console.error(err);
      setError(err.message || t('error_auth', "Échec de l'authentification"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await persistProfile(user.uid, user.email);
      await refreshProfile();
      router.push(`/${lang}/profile`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('error_save_profile', 'Échec de la sauvegarde du profil'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background-default)]">
        <div className="animate-spin rounded-lg h-12 w-12 border-4 border-[#E3004F] border-t-transparent" />
      </div>
    );
  }

  if (user && userProfile?.phone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background-default)]">
        <div className="animate-spin rounded-lg h-12 w-12 border-4 border-[#E3004F] border-t-transparent" />
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

        <form className="mt-8 space-y-5" onSubmit={handleEmailAuth}>
          {error && (
            <div className="p-3 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 text-[var(--status-error)] rounded-lg text-sm text-center">
              {error}
            </div>
          )}

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
            <label htmlFor="s1-password" className={labelClass}>
              {t('password', 'Mot de passe')}
            </label>
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

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border-default)]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[var(--background-card)] text-[var(--text-tertiary)]">
                {t('or_continue_with', 'Ou continuer avec')}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center px-4 py-3 border border-[var(--border-default)] rounded-lg shadow-sm bg-[var(--background-default)] text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--background-tertiary)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-fuchsia-accent)]"
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>
          </div>
        </div>

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
