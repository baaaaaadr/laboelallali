'use client';

import React, { useState } from 'react';
import { Check, Download, Share } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInstallState } from '@/hooks/useInstallState';
import InstallHelpDialog from './InstallHelpDialog';

/**
 * Le bouton « Installer l'application », en cinq présentations.
 *
 * ### La règle, sans exception
 * **Un élément visible et cliquable fait toujours quelque chose.** Soit il
 * lance le dialogue natif d'installation, soit il ouvre la fiche « comment
 * installer » (`InstallHelpDialog`). Il n'existe aucun troisième cas.
 *
 * C'est la correction du défaut signalé par un patient le 21/09/2026 :
 * « j'appuie ici, il ne se passe rien ». Le bouton du bas de page restait
 * affiché, d'apparence normale, alors qu'il était devenu incapable d'agir —
 * voir `src/lib/pwa/installStore.ts` pour les trois mécanismes qui y menaient.
 *
 * ### Trois états, décidés par le magasin, jamais par ce composant
 * | état | bas de page / menu / bandeau | tuile de l'accueil |
 * |---|---|---|
 * | `installed`   | rien (le bouton disparaît) | « Application installée », non cliquable |
 * | `installable` | le vrai bouton d'installation | le vrai bouton |
 * | `needs_help`  | bouton → fiche d'aide | bouton → fiche d'aide |
 *
 * ### Ce qui a disparu, et pourquoi
 * - **`forceShow` et les gardes `NODE_ENV === 'development'`.** Le bouton
 *   n'était visible en production qu'après réception de `beforeinstallprompt` :
 *   donc jamais sur iPhone, où cet événement n'existe pas. `docs/pages/home.md`
 *   notait d'ailleurs que « le bouton est TOUJOURS visible sous `npm run dev` »
 *   et qu'il fallait un `npm run build` pour voir le vrai comportement. Il n'y
 *   a plus aucun écart entre développement et production.
 * - **`isClientReady`.** Il renvoyait `null` le temps d'un rendu pour éviter un
 *   écart d'hydratation causé par la lecture de `window.deferredPrompt` PENDANT
 *   le rendu. L'état vient maintenant du magasin, qui répond `needs_help` au
 *   serveur comme au premier rendu client : aucun écart possible.
 * - **`window.deferredPrompt = null` au montage** — la cause du bug. Voir
 *   l'en-tête de `installStore.ts`.
 */
type PWAInstallButtonProps = {
  /** Présentation visuelle. */
  variant?: 'button' | 'banner' | 'footer' | 'icon' | 'tile';
  className?: string;
  style?: React.CSSProperties;
};

export default function PWAInstallButton({
  variant = 'button',
  className = '',
  style = {},
}: PWAInstallButtonProps) {
  const { t } = useTranslation('common', { useSuspense: false });
  const { state, platform, inAppBrowser, dismissedHere, install } = useInstallState();
  const [helpOpen, setHelpOpen] = useState(false);

  /**
   * Le geste unique de tous les points d'entrée. Sur `installable` il lance le
   * dialogue natif ; si celui-ci n'aboutit pas — refus, ou événement déjà
   * consommé — la fiche d'aide prend le relais immédiatement, plutôt que de
   * laisser le patient devant un bouton qui n'a rien fait.
   */
  const handleClick = async () => {
    if (state !== 'installable') {
      setHelpOpen(true);
      return;
    }
    const outcome = await install();
    if (outcome === 'unavailable' || outcome === 'error') setHelpOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void handleClick();
    }
  };

  const label = t('pwa.install_app_button', "Installer l'appli");

  const dialog = (
    <InstallHelpDialog
      open={helpOpen}
      onClose={() => setHelpOpen(false)}
      platform={platform}
      inAppBrowser={inAppBrowser}
      dismissedHere={dismissedHere}
    />
  );

  // ── La tuile de l'accueil : 5e cellule d'une grille de 5 ───────────────────
  // Elle ne disparaît JAMAIS — un trou visible à côté de quatre tuiles pleines
  // se lit comme une mise en page cassée, pas comme « rien à proposer ».
  if (variant === 'tile') {
    if (state === 'installed') {
      return (
        <div className={`hero-tile hero-tile--static ${className}`} style={style}>
          <span className="hero-tile__icon">
            <Check size={22} aria-hidden="true" />
          </span>
          <span className="hero-tile__label">
            {t('hero_shortcuts.installed_label', 'Application installée')}
          </span>
          <span className="hero-tile__desc">
            {t('hero_shortcuts.installed_desc', 'Vous y êtes déjà')}
          </span>
        </div>
      );
    }

    const tileIsIOS = state === 'needs_help' && platform === 'ios';
    const TileIcon = tileIsIOS ? Share : Download;
    const tileLabel = tileIsIOS
      ? t('hero_shortcuts.install_ios_label', "Ajouter à l'écran d'accueil")
      : label;
    const tileDesc =
      state === 'installable'
        ? t('hero_shortcuts.install_desc', "Sur votre écran d'accueil")
        : tileIsIOS
          ? t('hero_shortcuts.install_ios_desc', 'Menu Partager de votre navigateur')
          : t('hero_shortcuts.install_menu_desc', 'Depuis le menu de votre navigateur');

    return (
      <>
        <div
          role="button"
          tabIndex={0}
          onClick={() => void handleClick()}
          onKeyDown={onKeyDown}
          className={`hero-tile ${className}`}
          aria-label={tileLabel}
          style={style}
        >
          <span className="hero-tile__icon">
            <TileIcon size={22} aria-hidden="true" />
          </span>
          <span className="hero-tile__label">{tileLabel}</span>
          <span className="hero-tile__desc">{tileDesc}</span>
        </div>
        {dialog}
      </>
    );
  }

  // ── Partout ailleurs : rien à proposer à qui a déjà l'application ─────────
  if (state === 'installed') return null;

  if (variant === 'icon') {
    return (
      <>
        <div
          role="button"
          tabIndex={0}
          onClick={() => void handleClick()}
          onKeyDown={onKeyDown}
          className={`menu-icon-button ${className}`}
          aria-label={label}
          title={label}
          style={style}
        >
          <Download size={22} className="flex-shrink-0" />
        </div>
        {dialog}
      </>
    );
  }

  // Rendu en <div role="button"> et non en <button> : la remise à zéro globale
  // de Tailwind v4 force `background-color: transparent` sur les boutons, ce
  // qui effacerait le fond bordeaux. Le lien WhatsApp voisin est un <a> et n'a
  // pas le problème. Voir docs/CSS_ARCHITECTURE_GUIDE.md.
  if (variant === 'footer') {
    return (
      <>
        <div
          role="button"
          tabIndex={0}
          onClick={() => void handleClick()}
          onKeyDown={onKeyDown}
          className={`bg-[var(--brand-primary)] hover:bg-[var(--color-bordeaux-light)] text-white px-6 py-3 rounded-lg inline-flex items-center justify-center space-x-2 transition-colors shadow-sm hover:shadow-md w-full cursor-pointer select-none ${className}`}
          aria-label={label}
          style={style}
        >
          <Download size={20} className="flex-shrink-0" />
          <span>{label}</span>
        </div>
        {dialog}
      </>
    );
  }

  if (variant === 'banner') {
    return (
      <>
        <div
          className={`fixed bottom-16 sm:bottom-4 right-4 z-[999] bg-[var(--brand-accent)] text-white px-4 py-3 rounded-lg shadow-xl hover:shadow-2xl hover:bg-[var(--brand-accent-hover)] transition-colors ${className}`}
          style={style}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => void handleClick()}
            onKeyDown={onKeyDown}
            className="flex items-center space-x-2 cursor-pointer select-none"
            aria-label={label}
          >
            <Download size={18} />
            <span>{label}</span>
          </div>
        </div>
        {dialog}
      </>
    );
  }

  return (
    <>
      <div className={`w-full sm:w-auto ${className}`} style={style}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => void handleClick()}
          onKeyDown={onKeyDown}
          className="bg-[var(--color-fuchsia-accent)] hover:bg-[var(--color-fuchsia-bright)] text-white text-base font-semibold px-[1.75rem] py-[0.875rem] min-h-[48px] rounded-lg flex items-center justify-center gap-2 w-full transition-all cursor-pointer select-none"
          title={t('pwa.install_app_title', "Installer l'application du Labo")}
          aria-label={label}
        >
          <Download size={20} />
          <span>{label}</span>
        </div>
      </div>
      {dialog}
    </>
  );
}
