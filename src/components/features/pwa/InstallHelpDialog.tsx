"use client";

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Share, MoreVertical, Smartphone, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PwaPlatform } from '@/lib/pwa/platform';

/**
 * « Comment installer l'application » — la fiche affichée quand le navigateur
 * ne peut PAS lancer le dialogue natif.
 *
 * ### Pourquoi elle existe
 * Un patient a signalé le 21/09/2026 : « j'appuie ici, il ne se passe rien ».
 * Deux situations produisaient ce bouton muet, et aucune n'était rattrapée :
 *
 *  - **iPhone** : aucun navigateur iOS n'émet `beforeinstallprompt`. Apple
 *    impose le passage par le menu Partager. L'ancien code faisait donc tout
 *    simplement DISPARAÎTRE le bouton du bas de page et l'icône du menu sur
 *    iPhone — un patient sur iPhone n'avait aucun moyen d'apprendre que
 *    l'application s'installe.
 *  - **Android après un refus** : le navigateur consomme la proposition au
 *    premier `prompt()`, refus compris, et ne la réémet qu'au rechargement de
 *    la page. Rien ne le dit au patient.
 *
 * Règle tenue partout depuis : **un élément visible et cliquable fait toujours
 * quelque chose.** S'il ne peut pas installer, il explique comment faire.
 *
 * ⚠ Rendue par `createPortal(document.body)` et non dans l'arbre. Le bas de
 * page et l'accueil portent des `backdrop-filter` : un ancêtre filtré devient
 * bloc conteneur des `position: fixed`, et une modale « plein écran » se
 * résoudrait alors sur le rectangle du parent puis serait rognée. Même raison
 * que `PdfViewerModal.tsx`.
 */
export interface InstallHelpDialogProps {
  open: boolean;
  onClose: () => void;
  platform: PwaPlatform;
  /** Navigateur intégré (Facebook, Instagram…) : aucune installation possible. */
  inAppBrowser: boolean;
  /** Le patient vient de refuser le dialogue natif dans cette page. */
  dismissedHere: boolean;
}

export default function InstallHelpDialog({
  open,
  onClose,
  platform,
  inAppBrowser,
  dismissedHere,
}: InstallHelpDialogProps) {
  const { t } = useTranslation('common', { useSuspense: false });

  // Échappement au clavier + blocage du défilement de la page derrière.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (open === false || typeof document === 'undefined') return null;

  /**
   * Les étapes, dans l'ordre où le patient les verra sur SON téléphone.
   * Le navigateur intégré passe en premier : tant qu'on y est, aucune des
   * autres consignes ne peut aboutir.
   */
  const steps: string[] = inAppBrowser
    ? [
        t('pwa.help.inapp_step1', "Appuyez sur le menu « … » en haut de cette fenêtre."),
        t('pwa.help.inapp_step2', "Choisissez « Ouvrir dans le navigateur » (Chrome ou Safari)."),
        t('pwa.help.inapp_step3', "Reprenez l'installation depuis là."),
      ]
    : platform === 'ios'
      ? [
          t('pwa.help.ios_step1', "Appuyez sur l'icône Partager, en bas de l'écran."),
          t('pwa.help.ios_step2', "Faites défiler, puis choisissez « Sur l'écran d'accueil »."),
          t('pwa.help.ios_step3', "Appuyez sur « Ajouter », en haut à droite."),
        ]
      : platform === 'android'
        ? [
            t('pwa.help.android_step1', "Appuyez sur le menu ⋮, en haut à droite du navigateur."),
            t('pwa.help.android_step2', "Choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil »."),
            t('pwa.help.android_step3', "Confirmez : l'icône du laboratoire apparaît sur votre écran."),
          ]
        : [
            t('pwa.help.desktop_step1', "Cherchez l'icône d'installation dans la barre d'adresse."),
            t('pwa.help.desktop_step2', "Ou ouvrez le menu ⋮ puis « Installer Laboratoire El Allali »."),
          ];

  const StepIcon = inAppBrowser ? ExternalLink : platform === 'ios' ? Share : MoreVertical;

  const title = inAppBrowser
    ? t('pwa.help.inapp_title', 'Ouvrez d’abord dans votre navigateur')
    : t('pwa.help.title', "Installer l'application");

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-help-title"
      onClick={onClose}
    >
      <div
        className="card w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2
            id="pwa-help-title"
            className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"
          >
            <Smartphone className="h-5 w-5 flex-shrink-0 text-[var(--color-bordeaux-primary)]" aria-hidden="true" />
            <span>{title}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('pwa.help.close', 'Fermer')}
            className="flex-shrink-0 rounded-lg p-1 text-[var(--text-tertiary)] hover:bg-[var(--background-secondary)]"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          {t('pwa.help.intro', "En quelques secondes, le laboratoire s'installe comme une application sur votre téléphone : vos résultats en un seul geste, sans passer par le navigateur.")}
        </p>

        {/* La phrase que personne ne devine seul : après un refus, la
            proposition automatique ne revient qu'au rechargement. */}
        {dismissedHere && !inAppBrowser && (
          <p className="mb-4 rounded-lg bg-[var(--background-secondary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            {t('pwa.help.dismissed_note', "Vous venez de refuser la proposition d'installation. Rechargez la page pour la revoir, ou suivez les étapes ci-dessous.")}
          </p>
        )}

        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-bordeaux-primary)]/10 text-sm font-bold text-[var(--color-bordeaux-primary)]"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="pt-0.5 text-sm text-[var(--text-primary)]">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex items-center gap-2 rounded-lg bg-[var(--background-secondary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <StepIcon size={16} className="flex-shrink-0" aria-hidden="true" />
          <span>
            {platform === 'ios'
              ? t('pwa.help.ios_note', "Sur iPhone, l'installation passe toujours par le menu Partager : c'est une règle d'Apple, aucune application web ne peut le faire à votre place.")
              : t('pwa.help.generic_note', "Le nom exact de l'option change selon le navigateur, mais elle est toujours dans son menu principal.")}
          </span>
        </div>

        <button type="button" onClick={onClose} className="btn-base btn-primary btn-block mt-5">
          {t('pwa.help.got_it', "J'ai compris")}
        </button>
      </div>
    </div>,
    document.body
  );
}
