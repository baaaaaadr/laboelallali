"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, Home, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import MedicalLoader from '@/components/ui/MedicalLoader';
import GoogleAuthButton from '@/components/features/auth/GoogleAuthButton';
import GlaboBenefits from './GlaboBenefits';
import type { JourneyVariant } from '@/lib/journey/types';

/**
 * Portail d'entrée du parcours patient : le formulaire n'apparaît qu'une fois
 * le patient connecté (décision du propriétaire, 08/09/2026).
 *
 * L'écran d'attente n'est PAS un mur nu : il porte l'identité du service par
 * lequel le patient est arrivé (GLABO ou laboratoire), parce que `/glabo` est
 * imprimé sur des devis déjà remis — quelqu'un qui scanne ce QR code doit
 * comprendre où il est avant qu'on lui demande quoi que ce soit.
 *
 * ⚠ INVARIANT — toute création de compte Google passe par `/login`.
 * Une première connexion Google produit un utilisateur authentifié SANS profil
 * Firestore et SANS téléphone. La complétion du profil et
 * `autoRequestResultsAccess()` (la file d'accueil du laboratoire) n'existent que
 * sur `/login`. On y renvoie donc systématiquement après une connexion réussie ;
 * `getRedirectTarget` y renvoie aussitôt ici si le profil est déjà complet, au
 * prix d'un seul écran de chargement.
 *
 * Le second effet (`user` sans `phone`) couvre le chemin de repli par
 * redirection : dans ce cas la page a été détruite puis rechargée ici, la
 * fonction de rappel n'a jamais tourné, et sans lui un compte tout neuf
 * atteindrait le formulaire sans jamais entrer dans la file du laboratoire.
 */
export interface JourneyAuthGateProps {
  lang: string;
  variant: JourneyVariant;
  children: React.ReactNode;
}

export default function JourneyAuthGate({ lang, variant, children }: JourneyAuthGateProps) {
  const { t } = useTranslation(['journey', 'common']);
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || `/${lang}`;
  const [handingOver, setHandingOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Une seule remise à /login par montage : deux `router.push` se marcheraient dessus. */
  const handedOver = useRef(false);

  const handOverToLogin = useCallback(() => {
    if (handedOver.current) return;
    handedOver.current = true;
    setHandingOver(true);
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const back = `${pathname}${search}`;
    router.push(`/${lang}/login?redirect=${encodeURIComponent(back)}`);
  }, [lang, pathname, router]);

  // Repli par redirection : on revient ici connecté, sans être passé par /login.
  // `loading` ne retombe à false qu'APRÈS la lecture du profil Firestore
  // (AuthContext), donc `userProfile` est définitif à ce moment — pas de faux
  // positif sur un profil encore en cours de chargement.
  useEffect(() => {
    if (loading || !user) return;
    if (!userProfile?.phone) handOverToLogin();
  }, [loading, user, userProfile, handOverToLogin]);

  if (loading || handingOver) return <MedicalLoader fullScreen />;

  // Profil complet : on laisse passer. Un compte sans téléphone est déjà parti
  // vers /login par l'effet ci-dessus.
  if (user && userProfile?.phone) return <>{children}</>;
  if (user) return <MedicalLoader fullScreen />;

  const title =
    variant === 'home'
      ? t('gate.title_home')
      : variant === 'lab'
        ? t('gate.title_lab')
        : t('gate.title_neutral');
  const subtitle =
    variant === 'home'
      ? t('gate.subtitle_home')
      : variant === 'lab'
        ? t('gate.subtitle_lab')
        : t('gate.subtitle_neutral');
  const HeaderIcon = variant === 'home' ? Home : CalendarDays;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-lg bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 mb-4">
          <HeaderIcon className="h-7 w-7 text-[var(--color-bordeaux-primary)]" aria-hidden="true" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
        <p className="mt-3 text-[var(--text-secondary)] max-w-lg mx-auto">{subtitle}</p>
      </div>

      {variant === 'home' && (
        <div className="card mb-6">
          <GlaboBenefits />
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[var(--color-bordeaux-primary)]" aria-hidden="true" />
          {t('gate.why_title')}
        </h2>
        <ul className="space-y-3 mb-6">
          {['gate.why_1', 'gate.why_2', 'gate.why_3'].map((key) => (
            <li key={key} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
              <CheckCircle2
                className="h-5 w-5 flex-shrink-0 text-[var(--status-success)] mt-0.5"
                aria-hidden="true"
              />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>

        {error && (
          <p className="mb-4 text-sm text-[var(--status-error)]" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <GoogleAuthButton
            lang={lang}
            onSignedIn={handOverToLogin}
            onError={() => setError(t('gate.error_generic'))}
          />
          <p className="text-xs text-center text-[var(--text-tertiary)]">{t('gate.signin_hint')}</p>
        </div>

        <div className="mt-6 pt-5 border-t border-[var(--border-default)] text-center">
          <Link
            href={`/${lang}/login?redirect=${encodeURIComponent(pathname)}`}
            className="text-sm font-medium text-[var(--color-bordeaux-primary)] hover:underline"
          >
            {t('gate.other_signin')}
          </Link>
        </div>
      </div>
    </div>
  );
}
