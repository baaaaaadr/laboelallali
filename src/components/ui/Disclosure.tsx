"use client";

import React, { useId } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Bloc dépliant réutilisable — le motif que le dépôt réécrivait à la main dans
 * `HeroAnalysesDisclosure`, `AnalysesDetails` et `LabStatusWidget`
 * (`docs/pages/contact.md` notait justement l'absence d'un composant partagé).
 *
 * Volontairement un `<button aria-expanded>` + `useState` chez l'appelant, et
 * NON un `<details>/<summary>` natif :
 *  - l'état doit être PILOTÉ de l'extérieur (le parcours patient est un
 *    accordéon : ouvrir une section en ferme une autre, et l'avancement du
 *    formulaire déplace l'ouverture tout seul) ;
 *  - `<details>` ne se laisse pas animer proprement et Safari gère mal
 *    `open` piloté par React.
 *
 * ⚠ RTL : le chevron fermé pointe vers l'intérieur du texte, donc à GAUCHE en
 * arabe. On n'utilise que `gap`, `ps-`/`pe-` et `text-start` — jamais `ml-`/`mr-`.
 */
export interface DisclosureProps {
  open: boolean;
  onToggle: () => void;
  /** Titre, toujours visible. */
  title: React.ReactNode;
  /** Résumé de l'état replié : « 3 analyses · 148 DH », « À domicile », … */
  summary?: React.ReactNode;
  /** Icône affichée avant le titre. */
  icon?: React.ReactNode;
  /** Pastille numérotée (étape du parcours). */
  badge?: React.ReactNode;
  /**
   * Mot écrit d'avance, déjà traduit — « Obligatoire » / « Facultatif ». Vient
   * s'ajouter à `status` : celui-ci ne se voit qu'une fois la section ouverte
   * au moins une fois, celui-là est visible dès le premier écran, replié
   * comme déplié. Omis = pas de puce.
   */
  obligationLabel?: string;
  /** Pilote la couleur de la puce : `required` = ton insistant (bordeaux). */
  obligationTone?: 'required' | 'optional';
  /**
   * État de complétion de l'étape :
   *  - `done`       → coche verte, toujours visible (ouvert comme replié) ;
   *  - `incomplete` → pastille ambre : l'étape est OBLIGATOIRE et il y manque
   *    quelque chose. Ne s'affiche qu'une fois l'étape ouverte au moins une
   *    fois — signaler « il manque quelque chose » avant que le patient ait
   *    eu l'occasion de répondre serait une réprimande, pas une aide ;
   *  - `none`       → rien (étape facultative, ou pas encore abordée).
   */
  status?: 'done' | 'incomplete' | 'none';
  /** Libellé accessible de la coche verte. */
  doneLabel?: string;
  /** Libellé accessible de la pastille ambre. */
  incompleteLabel?: string;
  isRtl?: boolean;
  /** Classe du conteneur externe. */
  className?: string;
  /** Classe de l'en-tête cliquable. */
  headerClassName?: string;
  children: React.ReactNode;
}

export default function Disclosure({
  open,
  onToggle,
  title,
  summary,
  icon,
  badge,
  obligationLabel,
  obligationTone,
  status = 'none',
  doneLabel,
  incompleteLabel,
  isRtl = false,
  className = '',
  headerClassName = '',
  children,
}: DisclosureProps) {
  const panelId = useId();
  const ClosedChevron = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`w-full flex items-center gap-3 text-start rounded-lg transition-colors hover:bg-[var(--background-secondary)] ${headerClassName}`}
      >
        {badge}
        {icon && <span className="flex-shrink-0">{icon}</span>}

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-bold text-[var(--text-primary)]">{title}</span>
            {obligationLabel && (
              <span
                className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  obligationTone === 'required'
                    ? 'bg-[var(--color-bordeaux-primary)]/10 text-[var(--color-bordeaux-primary)]'
                    : 'bg-[var(--background-secondary)] text-[var(--text-tertiary)]'
                }`}
              >
                {obligationLabel}
              </span>
            )}
          </span>
          {!open && summary && (
            <span className="mt-0.5 block truncate text-sm text-[var(--text-secondary)]">
              {summary}
            </span>
          )}
        </span>

        {/* La coche verte reste visible même déplié : c'est un retour de
            progression, pas seulement un résumé d'état replié. */}
        {status === 'done' && (
          <CheckCircle2
            size={20}
            className="flex-shrink-0 text-[var(--status-success)]"
            aria-label={doneLabel}
            role={doneLabel ? 'img' : undefined}
            aria-hidden={doneLabel ? undefined : true}
          />
        )}
        {status === 'incomplete' && (
          <AlertCircle
            size={20}
            className="flex-shrink-0 text-[var(--status-warning)]"
            aria-label={incompleteLabel}
            role={incompleteLabel ? 'img' : undefined}
            aria-hidden={incompleteLabel ? undefined : true}
          />
        )}
        <span className="flex-shrink-0 text-[var(--text-tertiary)]" aria-hidden="true">
          {open ? <ChevronDown size={20} /> : <ClosedChevron size={20} />}
        </span>
      </button>

      {open && (
        <div id={panelId} className="pt-4">
          {children}
        </div>
      )}
    </div>
  );
}
