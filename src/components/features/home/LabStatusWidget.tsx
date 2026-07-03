'use client';

/**
 * Discreet lab open/closed badge that expands to the full hours + countdown card.
 * Expands on hover (desktop, via group-hover) OR on click/tap (mobile, via `open`).
 * Overlaid on the hero by the home page.
 */
import { useState } from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLabStatus } from '@/hooks/useLabStatus';

export default function LabStatusWidget() {
  const { t } = useTranslation('common');
  const labStatus = useLabStatus();
  const [open, setOpen] = useState(false);
  const isOpen = labStatus.isOpen;

  return (
    <div className="group relative inline-block" onMouseLeave={() => setOpen(false)}>
      {/* Discreet open/closed badge */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-white shadow-md ring-1 ring-white/30 backdrop-blur-[2px] transition-colors ${
          isOpen ? 'bg-[var(--status-success)]' : 'bg-[var(--status-error)]'
        }`}
        suppressHydrationWarning
      >
        <span
          className={`h-2 w-2 rounded-full bg-white ${isOpen ? 'animate-pulse' : 'opacity-80'}`}
          suppressHydrationWarning
        />
        <span suppressHydrationWarning>{labStatus.statusText || '…'}</span>
      </button>

      {/* Details popover — hover (desktop) or toggled by click/tap (mobile). */}
      <div
        className={`${open ? 'block' : 'hidden'} group-hover:block absolute top-full mt-2 left-1/2 -translate-x-1/2 lg:left-auto lg:right-0 lg:translate-x-0 z-30 w-64`}
      >
        <div className="card bg-[var(--background-card)] shadow-xl border border-[var(--border-default)]">
          <h3 className="mb-1 flex items-center text-base font-bold text-[var(--color-bordeaux-primary)]">
            <Clock size={18} className="mr-2 text-[var(--color-fuchsia-accent)]" />
            {t('opening_hours')}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">{t('opening_hours_text')}</p>
          {labStatus.isClient && labStatus.countdownText && (
            <div className="mt-3 inline-block rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)] px-3 py-1 text-sm font-medium text-[var(--text-secondary)]" suppressHydrationWarning>
              {labStatus.countdownText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
