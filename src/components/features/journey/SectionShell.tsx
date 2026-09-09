"use client";

import React, { useEffect, useRef } from 'react';
import Disclosure from '@/components/ui/Disclosure';

/**
 * Une étape du parcours, sous forme de bloc dépliant.
 *
 * ### Pourquoi tout est REPLIÉ par défaut
 * Demande du propriétaire (08/09/2026) : « le user voit la suite logique des
 * grandes étapes et déplie juste ce qu'il veut/doit éditer ». Un formulaire de
 * huit sections déroulé d'un bloc se lit comme un mur ; replié, il se lit comme
 * un sommaire. Chaque en-tête porte donc :
 *  - le numéro de l'étape,
 *  - son titre,
 *  - un RÉSUMÉ de ce qui est déjà renseigné (« À domicile — 12 rue X »),
 *  - une **coche verte** quand l'étape est complète, une pastille ambre quand il
 *    manque quelque chose d'obligatoire.
 *
 * Accordéon : une seule section ouverte à la fois (`openId` vit dans
 * `PatientJourneyPage`). C'est ce qui donne la « suite logique » — sinon on
 * retombe sur le mur qu'on voulait éviter.
 *
 * ⚠ `scrollMarginTop` vaut `var(--header-total-height)` et NON `64px` : dans une
 * PWA installée l'en-tête grandit de la hauteur de la barre d'état, et tout
 * littéral `64px` survivant laisse le titre caché dessous.
 */
export interface SectionShellProps {
  id: string;
  /** Numéro affiché dans la pastille. Omis = pas de pastille. */
  step?: number;
  title: string;
  /** Résumé affiché quand la section est repliée. */
  summary?: React.ReactNode;
  icon?: React.ReactNode;
  visible: boolean;
  open: boolean;
  onToggle: () => void;
  status?: 'done' | 'incomplete' | 'none';
  doneLabel?: string;
  incompleteLabel?: string;
  /** « Obligatoire » / « Facultatif », déjà traduit. Voir `Disclosure.tsx`. */
  obligationLabel?: string;
  obligationTone?: 'required' | 'optional';
  isRtl?: boolean;
  /**
   * `false` = la section reste TOUJOURS ouverte, sans en-tête cliquable.
   * Réservé à l'envoi : replier le bouton d'action derrière une flèche
   * cacherait la seule chose que le patient est venu faire.
   */
  collapsible?: boolean;
  /** Fait défiler jusqu'à la section à sa première apparition. */
  autoScroll?: boolean;
  children: React.ReactNode;
}

export default function SectionShell({
  id,
  step,
  title,
  summary,
  icon,
  visible,
  open,
  onToggle,
  status = 'none',
  doneLabel,
  incompleteLabel,
  obligationLabel,
  obligationTone,
  isRtl = false,
  collapsible = true,
  autoScroll = false,
  children,
}: SectionShellProps) {
  const ref = useRef<HTMLElement | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    if (!visible || !autoScroll || scrolled.current || !ref.current) return;
    scrolled.current = true;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, [visible, autoScroll]);

  if (!visible) return null;

  if (!collapsible) {
    return (
      <section
        id={id}
        ref={ref}
        className="card"
        style={{ scrollMarginTop: 'var(--header-total-height)' }}
      >
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
          {icon}
          <span>{title}</span>
        </h2>
        {children}
      </section>
    );
  }

  return (
    <section
      id={id}
      ref={ref}
      className="card !p-0 overflow-hidden"
      style={{ scrollMarginTop: 'var(--header-total-height)' }}
    >
      <Disclosure
        open={open}
        onToggle={onToggle}
        isRtl={isRtl}
        status={status}
        doneLabel={doneLabel}
        incompleteLabel={incompleteLabel}
        obligationLabel={obligationLabel}
        obligationTone={obligationTone}
        headerClassName="px-4 py-4 sm:px-5"
        className={open ? 'pb-5' : ''}
        badge={
          typeof step === 'number' ? (
            <span
              className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 text-[var(--color-bordeaux-primary)] font-bold text-sm"
              aria-hidden="true"
            >
              {step}
            </span>
          ) : undefined
        }
        icon={icon}
        title={title}
        summary={summary}
      >
        <div className="px-4 sm:px-5">{children}</div>
      </Disclosure>
    </section>
  );
}

/**
 * Carte-choix réutilisable (radio ou case à cocher) : le motif visuel de toute
 * la page — ordonnance oui/non, modes de transmission, lieu, canal de réponse.
 * Bordure bordeaux + fond teinté quand sélectionnée, jamais un aplat de couleur.
 */
export interface ChoiceCardProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  /** 'radio' = un seul choix, 'checkbox' = cumulable. Pilote uniquement l'a11y. */
  role?: 'radio' | 'checkbox';
  className?: string;
}

export function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  role = 'radio',
  className = '',
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onSelect}
      className={`w-full text-start p-4 rounded-xl border-2 transition-all active:scale-[0.99] ${
        selected
          ? 'border-[var(--color-bordeaux-primary)] bg-[var(--color-bordeaux-primary)]/5 dark:bg-[var(--color-bordeaux-primary)]/15'
          : 'border-[var(--border-default)] bg-[var(--background-default)] hover:border-[var(--color-bordeaux-primary)]/40 hover:bg-[var(--background-secondary)]'
      } ${className}`}
    >
      <span className="flex items-start gap-3">
        {icon && (
          <span
            className={`flex-shrink-0 mt-0.5 ${
              selected ? 'text-[var(--color-bordeaux-primary)]' : 'text-[var(--text-tertiary)]'
            }`}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[var(--text-primary)]">{title}</span>
          {description && (
            <span className="block mt-0.5 text-sm text-[var(--text-secondary)]">{description}</span>
          )}
        </span>
      </span>
    </button>
  );
}
