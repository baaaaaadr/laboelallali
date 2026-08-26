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
  // Until the status has been computed in the browser it is simply UNKNOWN:
  // the server cannot know the current time in Agadir at request time, and its
  // HTML may be prerendered or served from a cache. Showing a neutral badge for
  // one frame is the only way to never display a wrong "Ouvert".
  const isKnown = labStatus.isClient;
  const isOpen = labStatus.isOpen;

  return (
    <div className="group relative inline-block" onMouseLeave={() => setOpen(false)}>
      {/* Discreet open/closed badge */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-md ring-1 ring-white/30 backdrop-blur-[2px] transition-colors sm:text-sm min-w-[7rem] ${
          !isKnown
            ? 'bg-black/30'
            : isOpen
              ? 'bg-[var(--status-success)]'
              : 'bg-[var(--status-error)]'
        }`}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full bg-white ${isKnown && isOpen ? 'animate-pulse' : 'opacity-80'}`}
        />
        {/* aria-live sits on the STATUS span only, never on the button: with the
            countdown inside, the whole badge would be re-announced every minute
            (useNow ticks at 60s) for as long as the page stays open. */}
        <span aria-live="polite">{isKnown ? labStatus.statusText : '…'}</span>
        {isKnown && labStatus.countdownText && (
          <>
            {/* Separate flex children rather than one interpolated string: a "·"
                inside a string is mispositioned in RTL, a flex child follows dir. */}
            <span aria-hidden="true" className="opacity-60">·</span>
            <span className="font-medium opacity-95">{labStatus.countdownText}</span>
          </>
        )}
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
          {/* The countdown lives in the badge itself now — repeating it 40px
              below was the same information twice. */}
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">{t('opening_hours_text')}</p>
        </div>
      </div>
    </div>
  );
}
