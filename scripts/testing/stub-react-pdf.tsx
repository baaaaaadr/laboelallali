/**
 * Doublure de `react-pdf`. La vraie bibliothèque charge pdf.js et son worker
 * depuis un CDN, ce qui n'a pas de sens dans un banc hors ligne. On ne vérifie
 * ici que le PASSAGE du document à la visionneuse (quel dossier, ouvert ou
 * non), jamais le rendu du PDF lui-même.
 */
import React, { useEffect } from 'react';

export const pdfjs = { GlobalWorkerOptions: { workerSrc: '' }, version: 'stub' };

export function Document({
  children,
  file,
  onLoadSuccess,
}: {
  children?: React.ReactNode;
  file?: unknown;
  onLoadSuccess?: (doc: { numPages: number }) => void;
}) {
  useEffect(() => {
    onLoadSuccess?.({ numPages: 1 });
    // Une seule notification par document, comme la vraie bibliothèque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);
  return <div data-testid="pdf-document">{children}</div>;
}

export function Page({ pageNumber }: { pageNumber?: number }) {
  return <div data-testid="pdf-page">page {pageNumber ?? 1}</div>;
}

const reactPdf = { Document, Page, pdfjs };
export default reactPdf;
