'use client';

/**
 * Full-screen white surface showing one patient code, for scanning at the front
 * desk.
 *
 * Two reasons it is full screen rather than a bigger card:
 *  - a large white area is the only real way to raise what the phone emits (no
 *    browser API can touch screen brightness — not Chrome, not Safari);
 *  - a wider surface means wider bars, and bar width is what decides whether a
 *    mediocre counter scanner locks on.
 *
 * ⚠ `createPortal` to `document.body` is mandatory, not stylistic. An ancestor
 * with `backdrop-filter`, `filter` or `transform` becomes the containing block
 * of its `position: fixed` descendants — the home hero carries
 * `backdrop-filter: blur(16px)` — so a "full screen" overlay rendered in place
 * would resolve against a 340×220 box and get clipped. Same reasoning as
 * `PdfViewerModal`, which documents the trap at length.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Barcode, { barcodeFits } from '@/components/common/Barcode';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';

/** Share of the screen width the symbol may use, leaving the quiet zone room. */
const WIDTH_RATIO = 0.92;
/** Share of the screen height the bars take when laid out horizontally. */
const BAR_HEIGHT_RATIO = 0.28;

export interface ScanFullscreenProps {
  /** The patient code to display. */
  code: string;
  /** Whose dossier this is — shown so the front desk can cross-check. */
  personLabel: string;
  onClose: () => void;
}

export function ScanFullscreen({ code, personLabel, onClose }: ScanFullscreenProps) {
  const { t } = useTranslation('common');
  const [mounted, setMounted] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const surfaceRef = useRef<HTMLDivElement>(null);

  // The wake lock is requested for as long as this overlay is open. The hook
  // re-acquires it when the tab comes back to the foreground, which is what
  // makes the second and third scan attempts work.
  const { supported: wakeSupported } = useScreenWakeLock(true);

  useEffect(() => setMounted(true), []);

  // Escape closes, like any dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Measure the surface so the symbol is recomputed on rotation — turning the
  // phone sideways is the natural move when a long code will not fit.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted]);

  /**
   * When the code is too long to stay legible across the width, lay it out along
   * the HEIGHT instead and rotate it a quarter turn. Without this it would
   * silently degrade to 1px modules — a symbol that looks fine and decodes to
   * nothing, which is the worst possible outcome at a counter.
   */
  const layout = useMemo(() => {
    const across = Math.floor(size.width * WIDTH_RATIO);
    if (across <= 0) return null;
    if (barcodeFits(code, across)) {
      return {
        rotated: false,
        targetWidth: across,
        barHeight: Math.max(120, Math.floor(size.height * BAR_HEIGHT_RATIO)),
      };
    }
    const along = Math.floor(size.height * WIDTH_RATIO);
    return {
      rotated: true,
      targetWidth: along,
      barHeight: Math.max(120, Math.floor(size.width * BAR_HEIGHT_RATIO)),
    };
  }, [code, size.width, size.height]);

  if (!mounted) return null;

  return createPortal(
    <div
      // barcode-surface forces true white in both themes and kills the global
      // 1s colour transition — see the class comment in src/styles/index.css.
      className="barcode-surface fixed inset-0 z-50 flex flex-col"
      style={{ paddingTop: 'var(--safe-area-top)' }}
      role="dialog"
      aria-modal="true"
      aria-label={t('profile.code.scan_title', 'Code patient à scanner')}
      dir="ltr"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="font-semibold text-sm truncate" style={{ color: '#000' }}>
          {personLabel}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('profile.code.scan_close', 'Fermer')}
          className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg"
          style={{ color: '#000' }}
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div ref={surfaceRef} className="flex-1 flex flex-col items-center justify-center gap-6 px-2">
        {layout && (
          <div
            style={
              layout.rotated
                ? { transform: 'rotate(90deg)', transformOrigin: 'center' }
                : undefined
            }
          >
            <Barcode
              value={code}
              targetWidth={layout.targetWidth}
              height={layout.barHeight}
              ariaLabel={t('profile.code.aria', 'Code patient {{code}}', { code })}
            />
          </div>
        )}

        {/* The digits stay readable even when the scan fails: the front desk can
            always type them. Latin digits and dir=ltr on purpose — a code meant
            to be read aloud and typed into Qalam must never be rendered in
            Arabic-Indic digits nor reordered by RTL. */}
        {!layout?.rotated && (
          <p
            className="text-4xl font-bold tabular-nums"
            style={{ color: '#000', letterSpacing: '0.18em' }}
          >
            {code}
          </p>
        )}
      </div>

      {/* Only --safe-area-top is defined as a variable in this project
          (navigation.css); the bottom inset is read straight from env(). */}
      <div
        className="px-6 text-center"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <p className="text-sm" style={{ color: '#444' }}>
          {t(
            'profile.code.scan_hint',
            "Présentez cet écran au lecteur de l'accueil."
          )}
        </p>
        {!wakeSupported && (
          <p className="text-sm mt-2" style={{ color: '#444' }}>
            {t(
              'profile.code.scan_keep_awake',
              'Gardez votre écran allumé pendant le scan.'
            )}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}

export default ScanFullscreen;
