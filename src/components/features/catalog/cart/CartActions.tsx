"use client";

import React from 'react';
import { MessageCircle, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CartView } from '@/lib/cart/cartView';
import type { PreparationRules } from '@/hooks/usePreparationRules';
import { useCartPdfHandler } from './useCartPdfHandler';

interface CartActionsProps {
  cartView: CartView;
  preparationRules: PreparationRules;
  currencyLabel: string;
  onWhatsAppSend: () => void;
  /** Optional — called before redirecting to login if auth fails (modal usage). */
  onAuthFail?: () => void;
  /** Compact mode hides verbose labels on small screens. */
  compact?: boolean;
}

/**
 * Footer partagé : bouton WhatsApp + bouton PDF (avec auth via useCartPdfHandler).
 */
export function CartActions({
  cartView,
  preparationRules,
  currencyLabel,
  onWhatsAppSend,
  onAuthFail,
  compact = false,
}: CartActionsProps) {
  const { t } = useTranslation('common');
  const { t: tc } = useTranslation('catalog');

  const { handleDownloadPdf } = useCartPdfHandler({
    cartView,
    preparationRules,
    currencyLabel,
    onAuthFail,
  });

  return (
    <div className="border-t border-[var(--border-default)] px-4 py-3 bg-[var(--background-card)] flex-shrink-0 flex gap-2 w-full">
      <button
        onClick={onWhatsAppSend}
        className="flex-1 bg-[var(--status-success)] dark:bg-transparent dark:border dark:border-[var(--status-success)] text-white dark:text-[var(--status-success)] hover:brightness-90 dark:hover:bg-[var(--status-success)]/10 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all shadow-md dark:shadow-none active:scale-[0.98]"
        aria-label="WhatsApp"
      >
        <MessageCircle className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">
          {compact ? 'WhatsApp' : t('analyses_catalog.selection.send_whatsapp', 'Envoyer via WhatsApp')}
        </span>
      </button>
      <button
        onClick={handleDownloadPdf}
        className={`${
          compact ? 'flex-1' : 'flex-shrink-0 px-4'
        } flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-secondary)] border border-[var(--border-default)] transition-all active:scale-[0.98]`}
        aria-label={tc('cart.download_pdf', 'Télécharger / Imprimer PDF')}
      >
        <Download className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">
          {compact ? 'PDF' : tc('cart.download_pdf', 'Télécharger / Imprimer PDF')}
        </span>
      </button>
    </div>
  );
}

export default CartActions;
