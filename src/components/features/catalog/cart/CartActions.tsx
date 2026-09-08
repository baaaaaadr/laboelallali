"use client";

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { MessageCircle, Download, Loader2, CalendarPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CartView } from '@/lib/cart/cartView';
import type { PreparationRules } from '@/hooks/usePreparationRules';
import { getLangFromPath } from '@/lib/navigation/isActivePath';
import { journeyPath } from '@/lib/journey/route';
import { useCartPdfHandler } from './useCartPdfHandler';
import { PdfPreviewModal } from './PdfPreviewModal';

interface CartActionsProps {
  cartView: CartView;
  preparationRules: PreparationRules;
  currencyLabel: string;
  onWhatsAppSend: () => void;
  /** Optional — called before redirecting to login if auth fails (modal usage). */
  onAuthFail?: () => void;
  /**
   * Appelé juste avant de quitter la page (bouton « Prendre RDV »).
   * La modale mobile passe son `onClose` : sans cela elle reste montée
   * par-dessus la nouvelle page lors d'une navigation douce.
   */
  onBeforeNavigate?: () => void;
  /** Compact mode hides verbose labels on small screens. */
  compact?: boolean;
  /** Direction for the PDF preview modal (desktop). */
  isRtl?: boolean;
}

/**
 * Footer partagé : « Prendre RDV » + WhatsApp + PDF, sur UNE seule ligne.
 * Sur PC, le PDF est d'abord affiché dans une grande modale d'aperçu
 * (<PdfPreviewModal />) ; sur mobile il est téléchargé directement.
 *
 * ### Pourquoi cette répartition de largeurs
 * Budget réel sur un téléphone de 320 px : 320 − padding (24) − 2 gaps (16)
 * = 280 px pour trois boutons. En tiers égaux, « Prendre RDV » se tronque en
 * « Prendr… ». D'où : parts inégales, et le bouton PDF réduit à son icône seule
 * sous 640 px.
 *
 * ⚠ `basis-0 min-w-0` sur CHAQUE enfant flex. Sans `min-w-0`, un élément flex
 * refuse de rétrécir sous la largeur de son contenu et la ligne déborde
 * horizontalement — c'est la première cause d'une rangée de boutons cassée.
 * `truncate` va sur le `<span>`, jamais sur le `<button>` (qui est lui-même un
 * conteneur flex).
 *
 * ⚠ Rien à transporter vers la page de rendez-vous : /analyses écrit le panier
 * dans localStorage à chaque modification, le parcours le lit au montage.
 */
export function CartActions({
  cartView,
  preparationRules,
  currencyLabel,
  onWhatsAppSend,
  onAuthFail,
  onBeforeNavigate,
  compact = false,
  isRtl = false,
}: CartActionsProps) {
  const { t } = useTranslation('common');
  const { t: tc } = useTranslation('catalog');
  const router = useRouter();
  const pathname = usePathname() || '/fr';
  const lang = getLangFromPath(pathname);

  const handleBookAppointment = () => {
    onBeforeNavigate?.();
    router.push(journeyPath(lang, { service: 'labo', from: 'catalogue' }));
  };

  const {
    handleDownloadPdf,
    isGeneratingPdf,
    pdfPreview,
    closePdfPreview,
    downloadFromPreview,
  } = useCartPdfHandler({
    cartView,
    preparationRules,
    currencyLabel,
    onAuthFail,
  });

  return (
    <>
      <div className="border-t border-[var(--border-default)] px-3 py-3 bg-[var(--background-card)] flex-shrink-0 flex items-stretch gap-2 w-full">
        {/* 1 — Prendre RDV : action principale, elle reçoit la largeur en trop */}
        <button
          onClick={handleBookAppointment}
          className="flex-[1.15] basis-0 min-w-0 bg-[var(--color-bordeaux-primary)] text-white hover:brightness-110 py-3 px-2 rounded-xl flex items-center justify-center gap-1.5 font-semibold text-xs sm:text-sm transition-all shadow-md active:scale-[0.98]"
          aria-label={tc('cart.book_appointment', 'Prendre RDV')}
        >
          <CalendarPlus className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{tc('cart.book_appointment', 'Prendre RDV')}</span>
        </button>

        {/* 2 — WhatsApp (traitement vert existant, inchangé) */}
        <button
          onClick={onWhatsAppSend}
          className="flex-1 basis-0 min-w-0 bg-[var(--status-success)] dark:bg-transparent dark:border dark:border-[var(--status-success)] text-white dark:text-[var(--status-success)] hover:brightness-90 dark:hover:bg-[var(--status-success)]/10 py-3 px-2 rounded-xl flex items-center justify-center gap-1.5 font-semibold text-xs sm:text-sm transition-all shadow-md dark:shadow-none active:scale-[0.98]"
          aria-label="WhatsApp"
        >
          <MessageCircle className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">
            {compact ? 'WhatsApp' : t('analyses_catalog.selection.send_whatsapp', 'Envoyer via WhatsApp')}
          </span>
        </button>

        {/* 3 — PDF : icône seule sous 640 px, libellé au-delà */}
        <button
          onClick={handleDownloadPdf}
          disabled={isGeneratingPdf}
          className="flex-shrink-0 sm:flex-1 sm:basis-0 sm:min-w-0 px-3 sm:px-2 py-3 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-secondary)] border border-[var(--border-default)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait"
          aria-label={tc('cart.download_pdf', 'Télécharger / Imprimer PDF')}
        >
          {isGeneratingPdf ? (
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
          ) : (
            <Download className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="hidden sm:inline truncate">
            {compact ? 'PDF' : tc('cart.download_pdf', 'Télécharger / Imprimer PDF')}
          </span>
        </button>
      </div>

      <PdfPreviewModal
        isOpen={pdfPreview !== null}
        onClose={closePdfPreview}
        pdfUrl={pdfPreview?.url ?? null}
        onDownload={downloadFromPreview}
        isRtl={isRtl}
      />
    </>
  );
}

export default CartActions;
