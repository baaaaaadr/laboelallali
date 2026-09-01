'use client';

/**
 * The enriched `reminder` state of the hero panel: last bilan, live counter,
 * "Voir mon dernier bilan" opening the shared PDF viewer, and the collapsed
 * analyses list.
 *
 * **It substitutes, it does not stack.** The counter replaces the
 * `checkup_nudge_gentle` sentence and the action row reuses the existing one —
 * that is what keeps the growth to ~60-95px instead of ~250px in a hero that is
 * already taller than the screen. "Prendre rendez-vous" steps down from pill to
 * quiet link: someone opening the app wants their result, not an appointment.
 *
 * **The widget never shows an error.** If the PDF is missing or failed, the
 * "Voir" pill simply disappears and the appointment link becomes the primary
 * action again. No "le laboratoire n'a pas encore joint le PDF" on the home
 * page: it is noisy, it is worrying, and it exposes the state of a dossier on
 * the most public page of the site. /resultats is where things get explained.
 *
 * No network call of its own: `ResultsProvider` sits in the root layout and has
 * already prefetched the list AND the newest PDF for any linked patient, on
 * whatever page they landed.
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, FileText, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useResults } from '@/contexts/ResultsContext';
import type { CyberlabResult } from '@/types/cyberlab';
import PdfViewerModal from '@/components/features/results/PdfViewerModal';
import BilanCountdown from './BilanCountdown';
import HeroAnalysesDisclosure from './HeroAnalysesDisclosure';

export default function HeroLastBilan({
  result,
  title,
  lang,
  demoBase64,
}: {
  /** The newest dossier — chosen by the panel, which already knows it is usable. */
  result: CyberlabResult;
  /** "Votre dernier bilan remonte à plus de 4 mois", from the shared checkupCopy. */
  title: string;
  lang: string;
  /** Dev fixture only (see heroPanelFixture.ts): lets the driver open the viewer
   *  without a real account. Always undefined in production. */
  demoBase64?: string;
}) {
  const { t } = useTranslation('common');
  const { pdfState, loadPdf } = useResults();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [opening, setOpening] = useState(false);

  const isArabic = lang === 'ar';
  const pdf = demoBase64
    ? ({ status: 'ready', base64: demoBase64 } as const)
    : pdfState(result.dossier_id);
  // 'ready' is the normal case (prefetched at app open). 'idle' still works: we
  // fetch on tap. 'error'/'unavailable' hide the pill entirely — see the header.
  const canView = pdf.status === 'ready' || pdf.status === 'idle' || pdf.status === 'loading';

  const openViewer = useCallback(async () => {
    if (pdf.status === 'ready' && pdf.base64) {
      setViewerOpen(true);
      return;
    }
    setOpening(true);
    try {
      const ready = await loadPdf(result.dossier_id);
      if (ready.status === 'ready' && ready.base64) setViewerOpen(true);
    } finally {
      setOpening(false);
    }
  }, [pdf, loadPdf, result.dossier_id]);

  const busy = opening || pdf.status === 'loading';
  const base64 = demoBase64 ?? pdfState(result.dossier_id).base64;

  return (
    <>
      <span className="hero-panel__icon">
        <CalendarClock size={20} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="hero-panel__title">{title}</p>

        <BilanCountdown iso={result.date_dossier} isArabic={isArabic} />

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          {canView && (
            <button type="button" onClick={openViewer} disabled={busy} className="hero-panel__cta">
              {busy ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <FileText size={16} aria-hidden="true" />
              )}
              {t('hero_panel.view_last_bilan', 'Voir mon dernier bilan')}
            </button>
          )}
          <Link
            href={`/${lang}/rendez-vous`}
            className={canView ? 'hero-panel__link' : 'hero-panel__cta'}
          >
            {t('resultats.checkup_cta_appointment', 'Prendre rendez-vous')}
          </Link>
        </div>

        <HeroAnalysesDisclosure summary={result.analyses_summary} isArabic={isArabic} />
      </div>

      {viewerOpen && base64 && (
        <PdfViewerModal
          base64={base64}
          dossierId={result.dossier_id}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
