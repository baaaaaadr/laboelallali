"use client";

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { renderGoogleButton, signInWithOneTapCredential } from '@/lib/auth/googleOneTap';
import { signInWithGoogle } from '@/lib/auth/googleSignIn';

/**
 * Bouton « Continuer avec Google », factorisé.
 *
 * Le même montage existait en double, écrit à la main, dans `login/page.tsx` et
 * `GoogleSignInPrompt.tsx`. Le parcours patient est le troisième appelant : ce
 * composant regroupe les deux pièges qui ont déjà coûté une panne de production,
 * pour qu'ils ne soient plus jamais réécrits :
 *
 * 1. **Le conteneur est un callback ref STOCKÉ DANS UN `useState`**, pas un
 *    `useRef`. Les pages qui montent ce bouton renvoient souvent un loader au
 *    premier rendu : avec un objet ref, l'effet s'exécute une seule fois contre
 *    `null` et le bouton n'apparaît JAMAIS — en production uniquement, car en
 *    développement StrictMode double les effets et masque le bug.
 * 2. **`renderGoogleButton` peut légitimement renvoyer `false`** quand l'origine
 *    n'est pas autorisée côté Google. On garde donc notre bouton de secours
 *    affiché tant qu'il n'a pas renvoyé `true` (panne « origin_mismatch »,
 *    septembre 2026 : la page de connexion s'est retrouvée sans aucun bouton).
 *
 * ⚠ Ce composant NE décide PAS de la suite. `onSignedIn` est appelé après une
 * connexion réussie et l'appelant fait ce qu'il doit — sur toute page autre que
 * `/login`, cela veut dire rediriger vers `/login?redirect=…` : c'est le seul
 * endroit où le profil se complète et où `autoRequestResultsAccess()` s'exécute.
 *
 * ⚠ `signInWithGoogle()` qui se résout ne signifie PAS « connecté » : sur le
 * chemin de repli par redirection, la page est détruite et le résultat est
 * consommé par `getRedirectResult` sur `/login`. `onSignedIn('popup')` n'est
 * donc appelé que si l'utilisateur est effectivement revenu connecté.
 */
export interface GoogleAuthButtonProps {
  /** 'fr' | 'ar' — passé à Google pour la locale de son propre bouton. */
  lang: string;
  /** Connexion réussie. `via` indique quel chemin a abouti. */
  onSignedIn?: (via: 'credential' | 'popup') => void;
  /** Erreur brute ; l'appelant possède le texte affiché. */
  onError?: (err: unknown) => void;
  /** Désactive le bouton de secours (envoi en cours côté appelant). */
  disabled?: boolean;
  /** Libellé du bouton de secours. Par défaut `common:continue_with_google`. */
  label?: string;
}

export default function GoogleAuthButton({
  lang,
  onSignedIn,
  onError,
  disabled = false,
  label,
}: GoogleAuthButtonProps) {
  const { t } = useTranslation('common');
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [nativeButton, setNativeButton] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
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
            setBusy(true);
            await signInWithOneTapCredential(idToken);
            onSignedIn?.('credential');
          } catch (err) {
            console.error(err);
            onError?.(err);
          } finally {
            if (alive) setBusy(false);
          }
        })();
      },
    }).then((ok) => {
      if (alive && ok) setNativeButton(true);
    });
    return () => {
      alive = false;
    };
    // `onSignedIn`/`onError` sont volontairement hors dépendances : les
    // recréer à chaque rendu relancerait `renderGoogleButton`, et Google
    // n'autorise qu'un seul `initialize()` par page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, lang]);

  const handleFallbackClick = async () => {
    try {
      setBusy(true);
      // Popup d'abord, repli par redirection si le navigateur la bloque :
      // les deux vivent dans src/lib/auth/googleSignIn.ts — ne jamais recopier
      // cette branche ailleurs, elle passerait des mois sans être exercée.
      await signInWithGoogle();
      onSignedIn?.('popup');
    } catch (err) {
      console.error(err);
      onError?.(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Bouton dessiné par Google. Vide et replié tant qu'il n'a rien dessiné,
          pour que rien ne bouge s'il ne vient jamais. */}
      <div ref={setSlot} className="flex justify-center [&:empty]:hidden" />

      {!nativeButton && (
        <button
          type="button"
          onClick={handleFallbackClick}
          disabled={disabled || busy}
          className="w-full flex items-center justify-center px-4 py-3 border-2 border-[var(--border-default)] rounded-lg shadow-sm bg-[var(--background-default)] text-base font-semibold text-[var(--text-primary)] hover:bg-[var(--background-tertiary)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-fuchsia-accent)] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <svg className="h-5 w-5 me-2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {label ?? t('continue_with_google', 'Continuer avec Google')}
        </button>
      )}
    </>
  );
}
