'use client';

/**
 * Full-screen result PDF viewer — pinch to zoom, one-finger pan, page nav,
 * download and share.
 *
 * Extracted verbatim from `/resultats` so the home hero can open THE SAME viewer
 * instead of growing a second, subtly different one (the repo already carries two
 * independent `react-pdf` setups; a third would be one too many).
 *
 * ── Things that look removable and are not ───────────────────────────────────
 * - **Rendered on a `<canvas>` via pdf.js, never an `<iframe>`.** Android cannot
 *   render a PDF inline in an iframe — it only offers an "Open" button.
 * - **`react-pdf` is `lazy()`-loaded.** A static import breaks SSR (no DOMMatrix
 *   on the server) and drags a few hundred KB into every page that mounts this.
 * - **The touch listeners are native and `{ passive: false }`.** React attaches
 *   JSX touch handlers passively, so `preventDefault()` silently becomes a no-op
 *   and the pinch jumps ~1% then stalls. Do not convert them to `onTouchMove`.
 * - **`zoomRef` and its sync effect.** The gesture closure reads `zoomRef.current`,
 *   never `zoom`, so the effect does not need to re-subscribe on every zoom step.
 * - **The inline `<style>` for `.pdf-touch-surface`.** That class exists in NO
 *   stylesheet; deleting the tag because "the class is defined somewhere" kills
 *   the pinch.
 * - **`width={…*zoom}` and not `scale`.** zoom=1 means "fit the viewer width".
 * - **`dir="ltr"` on the toolbar and the scroll surface.** Under Arabic the flex
 *   row reversed and the ◀▶ arrows read backwards.
 * - **`paddingTop: var(--safe-area-top)`.** Without it the title and the close
 *   button slide under the status bar in the installed iOS PWA.
 *
 * ── Why it takes `base64` and not a blob URL ─────────────────────────────────
 * The component owns the whole Blob → object URL → revoke lifecycle in one
 * effect, which covers closing, unmounting and StrictMode double-mounts in a
 * single place. It also means callers no longer keep a second copy of the
 * medical payload in their own state: when the results context resets (logout,
 * account switch) the base64 disappears and the modal closes by itself, instead
 * of sitting there showing another account's PDF.
 *

 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Share2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import MedicalLoader from '@/components/ui/MedicalLoader';
import { base64ToPdfBlob, isDesktopViewer } from '@/lib/results/pdfBlob';

// PDF rendering via pdf.js (react-pdf): renders on a <canvas>, so "Voir" works on
// Android too — where the native <iframe> inline PDF view is unsupported (it only
// offers an "Open" button). Lazy-loaded to avoid SSR issues (no DOMMatrix on server).
const LazyDocument = lazy(() =>
  import('react-pdf').then((mod) => {
    mod.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.pdfjs.version}/build/pdf.worker.min.mjs`;
    return { default: mod.Document };
  })
);
const LazyPage = lazy(() => import('react-pdf').then((mod) => ({ default: mod.Page })));

export interface PdfViewerModalProps {
  /** Raw base64. The component owns the Blob + object URL lifecycle. */
  base64: string;
  /** Shown in the header, interpolated into `resultats.viewer_title`. */
  dossierId: string;
  onClose: () => void;
}

export default function PdfViewerModal({ base64, dossierId, onClose }: PdfViewerModalProps) {
  const { t } = useTranslation('common');

  const [url, setUrl] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  // zoom = 1 means "fit the PDF to the viewer width"; we open at 1.6 (160%) on
  // mobile so the left column (test names + results) is readable straight away.
  const [zoom, setZoom] = useState(() => (isDesktopViewer() ? 1.05 : 1.6));
  const [containerWidth, setContainerWidth] = useState(0);
  const [canShare, setCanShare] = useState(false);

  // Pinch-to-zoom + one-finger pan on the PDF (touch-action: none so the browser
  // never steals the gesture; preventDefault needs non-passive native listeners).
  const pdfScrollRef = useRef<HTMLDivElement>(null); // scroll viewport
  const pdfWrapRef = useRef<HTMLDivElement>(null);   // the page box we scale live
  const zoomRef = useRef(zoom);
  // Scroll position we want AFTER the next real (width) re-render — applied in the
  // Page's onRenderSuccess so it isn't clamped against the still-old canvas size.
  const pendingScrollRef = useRef<{ left?: number; top: number; centerX?: boolean } | null>(
    isDesktopViewer() ? { centerX: true, top: 0 } : { left: 0, top: 0 }
  );

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // One place owns Blob → object URL → revoke: close, unmount and StrictMode.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(base64ToPdfBlob(base64));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [base64]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Keep the "fit-to-width" base in sync with the viewer's real width
  // (initial open + rotation / resize).
  useEffect(() => {
    if (!url) return;
    const el = pdfScrollRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [url]);

  const applyPendingScroll = useCallback(() => {
    const el = pdfScrollRef.current;
    const p = pendingScrollRef.current;
    if (el && p) {
      el.scrollLeft = p.centerX
        ? Math.max(0, (el.scrollWidth - el.clientWidth) / 2)
        : (p.left ?? 0);
      el.scrollTop = p.top;
      pendingScrollRef.current = null;
    }
  }, []);

  useEffect(() => {
    const el = pdfScrollRef.current;
    if (!el || !url) return;
    let mode: 'none' | 'pan' | 'pinch' = 'none';
    let startDist = 0;
    let startZoom = 1;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let originX = 0; // pinch focus, in the page box's own coordinates
    let originY = 0;
    let liveScale = 1;
    let lastX = 0;
    let lastY = 0;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const beginPinch = (e: TouchEvent) => {
      const wrap = pdfWrapRef.current;
      if (!wrap) return;
      mode = 'pinch';
      startDist = dist(e.touches);
      startZoom = zoomRef.current;
      startScrollLeft = el.scrollLeft;
      startScrollTop = el.scrollTop;
      liveScale = 1;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const r = wrap.getBoundingClientRect();
      originX = midX - r.left;
      originY = midY - r.top;
      wrap.style.transformOrigin = `${originX}px ${originY}px`;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        beginPinch(e);
      } else if (e.touches.length === 1) {
        mode = 'pan';
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (mode === 'pinch' && e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const wrap = pdfWrapRef.current;
        if (!wrap) return;
        // Clamp so the *committed* zoom will stay within [0.5, 5].
        const raw = dist(e.touches) / startDist;
        liveScale = Math.min(5 / startZoom, Math.max(0.5 / startZoom, raw));
        // Cheap GPU transform during the gesture — NO react-pdf re-render (that
        // redraws the canvas mid-pinch and cancels the touch sequence).
        wrap.style.transform = `scale(${liveScale})`;
      } else if (mode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        el.scrollLeft -= e.touches[0].clientX - lastX;
        el.scrollTop -= e.touches[0].clientY - lastY;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };
    const commitPinch = () => {
      const wrap = pdfWrapRef.current;
      if (!wrap) return;
      wrap.style.transform = '';
      const next = +(startZoom * liveScale).toFixed(3);
      // Only when the committed zoom truly changes (else no re-render fires and a
      // stashed scroll would apply later by mistake).
      if (next !== startZoom) {
        // Keep the pinch focus point stationary AFTER the real (width) re-render:
        // stash the target scroll, applied in onRenderSuccess (see applyPendingScroll).
        pendingScrollRef.current = {
          left: startScrollLeft + originX * (liveScale - 1),
          top: startScrollTop + originY * (liveScale - 1),
        };
        setZoom(next);
      }
      liveScale = 1;
    };
    const onEnd = (e: TouchEvent) => {
      if (mode === 'pinch' && e.touches.length < 2) commitPinch();
      if (e.touches.length === 1) {
        mode = 'pan';
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      } else if (e.touches.length === 0) {
        mode = 'none';
      }
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [url]);

  // User-initiated save. The blob URL is released after the browser has had time
  // to start the download.
  const handleDownload = useCallback(() => {
    const objectUrl = URL.createObjectURL(base64ToPdfBlob(base64));
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `resultat-${dossierId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
  }, [base64, dossierId]);

  // Mobile share via the Web Share API (email / WhatsApp / … chosen by the OS).
  // User-initiated, like a download — the File is handed to the OS share sheet
  // and never persisted by us.
  const handleShare = useCallback(async () => {
    const file = new File([base64ToPdfBlob(base64)], `resultat-${dossierId}.pdf`, {
      type: 'application/pdf',
    });
    try {
      const shareData = {
        title: t('resultats.share_title', "Résultat d'analyses"),
        text: t('resultats.share_text', "Mon résultat d'analyses — Labo El Allali"),
      };
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ ...shareData, files: [file] });
      } else {
        await navigator.share(shareData);
      }
    } catch {
      // User cancelled (AbortError) or the platform refused — nothing to do.
    }
  }, [base64, dossierId, t]);

  return (
    // Plein écran : sans le paddingTop, le titre et le bouton « Fermer »
    // passent sous la barre d'état en PWA. Vaut 0 hors PWA installée.
    <div
      className="fixed inset-0 z-50 bg-[var(--background-card)] flex flex-col"
      style={{ paddingTop: 'var(--safe-area-top)' }}
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border-default)]">
        <p className="font-semibold text-[var(--text-primary)] truncate">
          {t('resultats.viewer_title', 'Résultat — dossier {{id}}', { id: dossierId })}
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleDownload}
            aria-label={t('resultats.download', 'Télécharger')}
            title={t('resultats.download', 'Télécharger')}
            className="p-2 rounded-lg hover:bg-[var(--background-tertiary)] text-[var(--text-secondary)] transition-colors"
          >
            <Download size={20} />
          </button>
          {canShare && (
            <button
              onClick={handleShare}
              aria-label={t('resultats.share', 'Partager')}
              title={t('resultats.share', 'Partager')}
              className="p-2 rounded-lg hover:bg-[var(--background-tertiary)] text-[var(--text-secondary)] transition-colors"
            >
              <Share2 size={20} />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label={t('resultats.close', 'Fermer')}
            className="p-2 rounded-lg hover:bg-[var(--background-tertiary)] text-[var(--text-secondary)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Toolbar: page navigation + zoom. Forced LTR: it's an icon toolbar, so
          "◀ prev / next ▶" and "− / +" must keep a fixed direction — under RTL
          (Arabic) the flex row reversed and the arrows looked inverted. */}
      <div dir="ltr" className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-default)] bg-[var(--background-secondary)]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
            disabled={pdfPage <= 1}
            aria-label={t('resultats.pdf_prev', 'Page précédente')}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-[var(--text-secondary)] min-w-[70px] text-center">
            {pdfPage} / {pdfPages || '…'}
          </span>
          <button
            onClick={() => setPdfPage((p) => Math.min(pdfPages, p + 1))}
            disabled={pdfPage >= pdfPages}
            aria-label={t('resultats.pdf_next', 'Page suivante')}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            aria-label={t('resultats.pdf_zoom_out', 'Dézoomer')}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)]"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-xs text-[var(--text-secondary)] min-w-[42px] text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(5, +(z + 0.25).toFixed(2)))}
            aria-label={t('resultats.pdf_zoom_in', 'Zoomer')}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)]"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      {/* PDF rendered on a <canvas> via pdf.js — works on Android + iOS + desktop.
          touch-action:none must cover the <canvas> descendants too, else the
          browser hijacks the two-finger gesture and our preventDefault is ignored
          (pinch jumped ~1% then stalled). Hence the style rule below. */}
      <div
        ref={pdfScrollRef}
        dir="ltr"
        className="pdf-touch-surface flex-1 overflow-auto p-2 bg-[var(--background-tertiary)]"
        style={{ touchAction: 'none' }}
      >
        <style>{`.pdf-touch-surface, .pdf-touch-surface * { touch-action: none; }`}</style>
        {/* w-max (left-aligned, NOT centered) so the LEFT edge is always the
            first thing reached when scrolled to 0 — the readable column the
            patient wants. This box is the live-scale target during a pinch. */}
        <div ref={pdfWrapRef} className="w-max will-change-transform">
          {url && (
            <Suspense fallback={<div className="py-16"><MedicalLoader size="sm" /></div>}>
              <LazyDocument
                file={url}
                onLoadSuccess={({ numPages }: { numPages: number }) => setPdfPages(numPages)}
                loading={<div className="py-16"><MedicalLoader size="sm" /></div>}
                error={
                  <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)] text-center px-6">
                    <FileText size={44} className="mb-3" />
                    <p className="text-sm">{t('resultats.pdf_error', "Impossible d'afficher le PDF ici. Utilisez le bouton « Télécharger ».")}</p>
                  </div>
                }
              >
                {/* width (not scale) so zoom=1 fits the viewer width; zoom scales from there. */}
                <LazyPage
                  pageNumber={pdfPage}
                  width={Math.max(120, ((containerWidth || 360) - 16) * zoom)}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onRenderSuccess={applyPendingScroll}
                  className="shadow-xl rounded-lg overflow-hidden"
                />
              </LazyDocument>
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
