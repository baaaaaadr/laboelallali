'use client';

/**
 * View / download / share of a report PDF on the doctor's « Mes patients » page.
 *
 * Same mechanics as the patient page (`/resultats`): the base64 stays in the
 * shared results context (memory only, never persisted, cleared on logout), the
 * viewer keeps only the dossier id and reads the payload through the context —
 * so it closes by itself if the context resets (account switch) instead of
 * showing a PDF to the wrong session.
 *
 * Differences, on purpose:
 *  - the share texts are NEUTRAL (the patient page says « Mon résultat… »);
 *  - the file name carries the dossier number, NEVER the patient's name: it ends
 *    up in download folders and chat previews.
 */
import { useCallback, useEffect, useState } from 'react';
import { base64ToPdfBlob, isDesktopViewer } from '@/lib/results/pdfBlob';
import type { ResultsView } from '@/contexts/ResultsContext';
import type { PdfState } from '@/types/cyberlab';

export function usePractitionerPdfActions(
  view: Pick<ResultsView, 'pdfState' | 'loadPdf'>,
  shareTitle: string,
  shareText: string
) {
  const { pdfState, loadPdf } = view;
  const [viewerId, setViewerId] = useState<string | null>(null);
  // Web Share on mobile only (on desktop it duplicates « Télécharger »).
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(!isDesktopViewer() && typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  /** The PDF if already in memory, otherwise fetched now (one call). */
  const ensure = useCallback(
    async (dossierId: string): Promise<PdfState> => {
      const st = pdfState(dossierId);
      return st.status === 'ready' && st.base64 ? st : loadPdf(dossierId);
    },
    [pdfState, loadPdf]
  );

  const openViewer = useCallback(
    async (dossierId: string) => {
      const st = await ensure(dossierId);
      if (st.status === 'ready' && st.base64) setViewerId(dossierId);
    },
    [ensure]
  );

  const closeViewer = useCallback(() => setViewerId(null), []);

  const download = useCallback(
    async (dossierId: string) => {
      const st = await ensure(dossierId);
      if (st.status !== 'ready' || !st.base64) return;
      const url = URL.createObjectURL(base64ToPdfBlob(st.base64));
      const a = document.createElement('a');
      a.href = url;
      a.download = `resultat-${dossierId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    },
    [ensure]
  );

  const share = useCallback(
    async (dossierId: string) => {
      const st = await ensure(dossierId);
      if (st.status !== 'ready' || !st.base64) return;
      const file = new File([base64ToPdfBlob(st.base64)], `resultat-${dossierId}.pdf`, {
        type: 'application/pdf',
      });
      try {
        const data = { title: shareTitle, text: shareText };
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ ...data, files: [file] });
        else await navigator.share(data);
      } catch {
        // Cancelled by the user, or refused by the platform — nothing to do.
      }
    },
    [ensure, shareTitle, shareText]
  );

  // Read through to the context rather than keeping a second copy of the PDF.
  const viewerBase64 = viewerId ? pdfState(viewerId).base64 : undefined;

  return { canShare, viewerId, viewerBase64, openViewer, closeViewer, download, share };
}
