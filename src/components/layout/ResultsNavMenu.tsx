'use client';

/**
 * Desktop header: « Résultats » becomes a two-item menu for an account holding
 * a doctor access — « Moi et ma famille » (/resultats) and « Mes patients »
 * (/mes-patients). Owner's decision (24/09/2026): a doctor looks for his
 * patients' results under « Résultats ». See docs/pages/mes-patients.md §7.
 *
 * Why a menu and not an extra link: the desktop bar is full — an 8th link
 * overflows at 1024 px in French (measured, see Header.tsx and
 * docs/pages/resultats.md). The trigger keeps the featured look of
 * « Résultats » (outline + icon) and adds a chevron.
 *
 * ⚠ The popover is PORTALLED to <body> with `position: fixed`: the desktop
 *   <nav> is `overflow-x-auto` (its overflow valve), which clips any absolutely
 *   positioned child. The portal root carries `dir`/`lang` itself — it lives
 *   outside the [lang] wrapper that sets them for the rest of the page.
 * ⚠ The trigger is an <a href="/{lang}/resultats" role="button">, not a
 *   <button>: the header's link rules (padding, colours) are written for <a>,
 *   the global button reset would fight them, and a middle-click still opens
 *   the results page.
 * ⚠ Item colours are inline styles: the global, unlayered `a { color }` rule
 *   beats Tailwind text utilities on an <a>.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ChevronDown, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  /** Language taken from the URL. */
  lang: string;
  /** « vous êtes ici » for each half. */
  hereMine: boolean;
  herePatients: boolean;
  /** Current path — the menu closes on navigation. */
  pathname: string;
}

export default function ResultsNavMenu({ lang, hereMine, herePatients, pathname }: Props) {
  const { t } = useTranslation('common');
  const isRtl = lang === 'ar';
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; start: number } | null>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusFirst = useRef(false);

  // Close on navigation (a menu item was followed, or the back button).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    // Aligned on the trigger's START edge, in both directions.
    setPos({ top: Math.round(r.bottom + 8), start: Math.round(isRtl ? window.innerWidth - r.right : r.left) });
  }, [isRtl]);

  useEffect(() => {
    if (!open) return;
    place();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      if (items.length === 0) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
      items[next].focus();
    };
    // The page moving under a fixed popover would leave it floating: close.
    const onMove = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove);
    };
  }, [open, place]);

  // Opened from the keyboard: move focus into the menu.
  useEffect(() => {
    if (!open || !pos || !focusFirst.current) return;
    focusFirst.current = false;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open, pos]);

  const item = (href: string, title: string, desc: string, here: boolean, testId: string) => (
    <Link
      href={href}
      role="menuitem"
      aria-current={here ? 'page' : undefined}
      data-testid={testId}
      onClick={() => setOpen(false)}
      className="flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-start hover:bg-[var(--background-tertiary)] focus:bg-[var(--background-tertiary)] focus:outline-none"
      style={here ? { background: 'var(--background-secondary)' } : undefined}
    >
      <span style={{ color: here ? 'var(--color-bordeaux-primary)' : 'var(--text-primary)', fontWeight: here ? 700 : 600 }}>
        {title}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {desc}
      </span>
    </Link>
  );

  return (
    <>
      <a
        ref={triggerRef}
        href={`/${lang}/resultats`}
        role="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'results-nav-menu' : undefined}
        data-testid="results-nav-trigger"
        onClick={(e) => {
          e.preventDefault();
          // `detail === 0`: activated from the keyboard (Enter), not a pointer.
          focusFirst.current = e.detail === 0;
          setOpen((o) => !o);
        }}
        className={`nav-link nav-link-featured text-sm lg:text-base ${hereMine || herePatients ? 'active' : ''}`}
      >
        {/* Icon from 1280 px only: below, the chevron takes its room. Measured
            24/09/2026 (French, logged in): with both, a team member who is also
            a doctor overflowed the 1024 px bar by 28 px; without the icon, 4 px
            — the team's 8-link bar was already 6 px over before this menu. */}
        <FileText size={16} className="hidden xl:inline-block" />
        {t('resultats.nav', { defaultValue: 'Résultats' })}
        <ChevronDown
          size={14}
          aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease' }}
        />
      </a>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            id="results-nav-menu"
            role="menu"
            aria-label={t('resultats.nav', { defaultValue: 'Résultats' })}
            data-testid="results-nav-menu"
            dir={isRtl ? 'rtl' : 'ltr'}
            lang={lang}
            className="fixed z-[70] w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-[var(--border-default)] bg-[var(--background-default)] p-1.5 shadow-lg"
            style={{ top: pos.top, ...(isRtl ? { right: pos.start } : { left: pos.start }) }}
          >
            {item(
              `/${lang}/resultats`,
              t('mes_patients.switch_mine', 'Moi et ma famille'),
              t('mes_patients.menu_mine_desc', 'Vos résultats et ceux de vos proches'),
              hereMine,
              'results-nav-mine'
            )}
            {item(
              `/${lang}/mes-patients`,
              t('mes_patients.nav', 'Mes patients'),
              t('mes_patients.menu_patients_desc', 'Les bilans que vous avez prescrits'),
              herePatients,
              'results-nav-patients'
            )}
          </div>,
          document.body
        )}
    </>
  );
}
