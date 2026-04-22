"use client";

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { getClientAuth } from '@/config/firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';

export default function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, loading } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push(`/${lang}/profile`);
    }
  }, [user, loading, router, lang]);

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      const auth = await getClientAuth();
      if (!auth) throw new Error("Auth not initialized");
      
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // AuthContext will handle the state change and the useEffect will redirect
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to login with Google");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      const auth = await getClientAuth();
      if (!auth) throw new Error("Auth not initialized");

      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background-default)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#E3004F] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
      <div className="max-w-md w-full space-y-8 bg-[var(--background-card)] p-8 rounded-2xl shadow-xl border border-[var(--border-default)]">
        <div>
          <div className="mx-auto h-12 w-12 bg-[var(--color-bordeaux-primary)] text-white rounded-full flex items-center justify-center font-bold text-2xl">
            L
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--text-primary)]">
            {isSignUp ? t('create_account', 'Créer un compte') : t('sign_in', 'Connexion')}
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
            {isSignUp ? "Rejoignez Laboratoire El Allali" : "Accédez à votre espace patient"}
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleEmailAuth}>
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
          
          <div className="rounded-md shadow-sm space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent sm:text-sm transition-colors"
                placeholder={t('email', 'Adresse Email')}
              />
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent sm:text-sm transition-colors"
                placeholder={t('password', 'Mot de passe')}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full button-bordeaux justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                {isSignUp ? (
                  <UserPlus className="h-5 w-5 text-white/70 group-hover:text-white" aria-hidden="true" />
                ) : (
                  <LogIn className="h-5 w-5 text-white/70 group-hover:text-white" aria-hidden="true" />
                )}
              </span>
              {isSubmitting ? "..." : (isSignUp ? t('sign_up', 'S\'inscrire') : t('sign_in', 'Se connecter'))}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border-default)]"></div>
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
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </button>
          </div>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm font-medium text-[var(--color-bordeaux-primary)] hover:text-[var(--color-fuchsia-accent)] transition-colors"
          >
            {isSignUp 
              ? t('already_have_account', 'Vous avez déjà un compte ? Connectez-vous') 
              : t('no_account', 'Pas encore de compte ? Inscrivez-vous')}
          </button>
        </div>
      </div>
    </div>
  );
}
