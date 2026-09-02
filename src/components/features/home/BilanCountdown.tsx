'use client';

/**
 * The live counter — "4 mois · 12 j · 06:31:44", seconds ticking.
 *
 * A LEAF, on purpose: this is the only thing that re-renders every second. The
 * panel around it, its title, the "Voir" pill and the analyses disclosure all
 * stay put. It consumes no context — in particular not `useResults`, whose
 * `pdfState` gets a new identity every time a PDF finishes loading; without the
 * `memo` below, every such load would re-render the counter for nothing.
 *
 * **No `aria-live`, ever.** Documented precedent: a live region on the
 * open/closed badge made screen readers re-announce the whole badge every 60s,
 * forever (docs/pages/home.md §3). At 1 Hz it would be unusable. The digits are
 * `aria-hidden`; the screen-reader-only sentence right above ("Votre dernier
 * bilan remonte à plus de 4 mois", see HeroLastBilan) carries the information in
 * a stable form. Do not drop that span: it is now the ONLY accessible source of
 * the duration, since the visible label above says only "remonte à :".
 */

import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSecondTick } from '@/hooks/useSecondTick';
import { elapsedSince } from '@/lib/results/elapsed';

function BilanCountdownImpl({ iso, isArabic }: { iso: string; isArabic: boolean }) {
  const { t } = useTranslation('common');
  const ref = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);

  // The hero is a full screen tall: without this we would repaint a blurred
  // panel once a second for as long as the visitor reads the rest of the page.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const nowMs = useSecondTick(onScreen);

  // Before mount the line is reserved but empty, so the server HTML and the
  // first client render agree (same contract as useNow).
  if (nowMs === null) {
    return (
      <div ref={ref} className="hero-panel__count" aria-hidden="true">
        &nbsp;
      </div>
    );
  }

  const e = elapsedSince(iso, nowMs);
  // Arabic-Indic digits in Arabic — the repo's convention (ResultsIndicators).
  const n = (v: number) =>
    new Intl.NumberFormat(isArabic ? 'ar-MA' : 'fr-FR', { useGrouping: false }).format(v);
  const p2 = (v: number) => (v < 10 ? n(0) + n(v) : n(v));

  return (
    <div ref={ref} className="hero-panel__count" aria-hidden="true">
      {e.months > 0 && (
        <span>
          {n(e.months)}&nbsp;{t('hero_panel.unit_month_short', { count: e.months })}
        </span>
      )}
      <span>
        {n(e.days)}&nbsp;{t('hero_panel.unit_day_short', { count: e.days })}
      </span>
      {/* hh:mm:ss ISOLATED in LTR: a colon-separated numeric run is reordered by
          the bidi algorithm under RTL, Arabic-Indic digits included. */}
      <span dir="ltr" className="hero-panel__clock">
        {p2(e.hours)}:{p2(e.minutes)}:{p2(e.seconds)}
      </span>
    </div>
  );
}

export default memo(BilanCountdownImpl);
