"use client";

import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Analysis, CartItem } from './AnalysisCard';
import { LAB_CONTACT } from '@/constants/contact';
import { ChevronUp, Trash2 } from 'lucide-react';

interface TotalCalculatorProps {
  totalCost: number;
  selectedCount: number;
  onReset: () => void;
  currencyLabel: string;
  isRtl?: boolean;
  selectedAnalyses?: Analysis[]; // Legacy support
  selectedItems?: CartItem[]; // New mixed cart support
  onOpenCartDetails?: () => void; // NOUVEAU - Callback pour ouvrir la modale panier
  onOpenPreparation?: () => void;
}

export default function TotalCalculator({
  totalCost,
  selectedCount,
  onReset,
  currencyLabel,
  isRtl = false,
  selectedAnalyses = [],
  selectedItems = [],
  onOpenCartDetails,
  onOpenPreparation
}: TotalCalculatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(selectedCount);

  // Simple animation effect when count changes (desktop only)
  useEffect(() => {
    if (prevCountRef.current === undefined || containerRef.current === null) {
      prevCountRef.current = selectedCount;
      return;
    }

    if (prevCountRef.current !== selectedCount && containerRef.current) {
      const div = containerRef.current;

      // Simple scale animation
      div.style.transform = 'scale(1.05)';
      setTimeout(() => {
        if (div) {
          div.style.transform = 'scale(1)';
        }
      }, 150);
    }

    prevCountRef.current = selectedCount;
  }, [selectedCount]);

  const { t, i18n } = useTranslation('common');

  const isRtlDirection = isRtl || i18n.language === 'ar';

  const translationsUI = {
    selectedAnalyses: t('analyses_catalog.selection.analyses_selected', 'analyses sélectionnées'),
    total: t('analyses_catalog.selection.total', 'Total'),
    reset: t('analyses_catalog.selection.reset', 'Réinitialiser'),
    tooltip: t('analyses_catalog.selection.tooltip', 'Calcul automatique du coût total des analyses sélectionnées'),
    sendWhatsapp: t('analyses_catalog.selection.send_whatsapp', 'Envoyer via WhatsApp'),
    viewDetails: t('analyses_catalog.selection.view_details', 'Détails'),
  };

  const whatsappTranslations = {
    greeting: t('analyses_catalog.selection.whatsapp_message.greeting', 'Bonjour Laboratoire El Allali,'),
    intro: t('analyses_catalog.selection.whatsapp_message.intro', 'Je suis intéressé(e) par les analyses suivantes :'),
    analysisItemPrefix: t('analyses_catalog.selection.whatsapp_message.analysis_item_prefix', '- '),
    totalLabel: t('analyses_catalog.selection.whatsapp_message.total_label', 'Total estimé :'),
    currency: t('analyses_catalog.selection.whatsapp_message.currency', 'MAD'),
    closingRemark: t('analyses_catalog.selection.whatsapp_message.closing_remark', 'Pouvez-vous me donner plus d\'informations ?'),
    websiteReference: t('analyses_catalog.selection.whatsapp_message.website_reference', 'Sélection faite depuis le site web.')
  };

  const generateWhatsAppMessage = () => {
    let message = `${whatsappTranslations.greeting}\n\n`;
    message += `${whatsappTranslations.intro}\n`;

    // Support both legacy and new cart formats
    const items = selectedItems.length > 0 ? selectedItems : selectedAnalyses.map(a => ({ type: 'analyse' as const, item: a }));

    // Group by type
    const analyses = items.filter(item =>
      item.type === 'analyse' || 'name_fr' in item || 'Nom_Patient_FR' in item
    );
    const bilans = items.filter(item =>
      item.type === 'bilan' || 'Nom_Bilan_FR' in item
    );

    // List bilans first (if any)
    if (bilans.length > 0) {
      message += `\n📦 ${t('catalog:bilans', 'Bilans')} :\n`;
      bilans.forEach(cartItem => {
        const item: any = 'item' in cartItem ? cartItem.item : cartItem;
        const name = i18n.language === 'ar' ? item.Nom_Bilan_AR : item.Nom_Bilan_FR;
        message += `${whatsappTranslations.analysisItemPrefix}${name}\n`;
      });
    }

    // Then individual analyses
    if (analyses.length > 0) {
      message += `\n🔬 ${t('catalog:analyses', 'Analyses')} :\n`;
      analyses.forEach(cartItem => {
        const item: any = 'item' in cartItem ? cartItem.item : cartItem;
        const name = i18n.language === 'ar'
          ? (item.Nom_Patient_AR || item.name_ar)
          : (item.Nom_Patient_FR || item.name_fr);
        message += `${whatsappTranslations.analysisItemPrefix}${name}\n`;
      });
    }

    const locale = i18n.language === 'ar' ? 'ar-MA' : 'fr-MA';
    message += `\n${whatsappTranslations.totalLabel} ${totalCost.toLocaleString(locale)} ${whatsappTranslations.currency}\n\n`;
    message += `${whatsappTranslations.closingRemark}\n\n`;
    message += whatsappTranslations.websiteReference;

    return message;
  };

  const handleSendViaWhatsApp = () => {
    const message = generateWhatsAppMessage();
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${LAB_CONTACT.WHATSAPP_ID}?text=${encodedMessage}`;
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = whatsappUrl;
    } else {
      window.open(whatsappUrl, '_blank');
    }
  };

  // Only render if there are selected items
  if (selectedCount === 0) return null;

  return (
    <>
      {/* Mobile Horizontal Bar - Visible on screens < 1024px */}
      <div
        className={`
          lg:hidden
          fixed left-0 right-0 z-50
          bg-[#800020] dark:bg-[var(--brand-primary)] text-white
          shadow-[0_-4px_20px_-2px_rgba(0,0,0,0.1)]
          px-4 py-3
          flex items-center justify-between
          ${isRtlDirection ? 'flex-row-reverse' : 'flex-row'}
        `}
        dir={isRtlDirection ? 'rtl' : 'ltr'}
        aria-live="polite"
        data-testid="total-calculator-mobile"
        style={{
          bottom: '70px'
        }}
      >
        {/* Left section - Count badge + Total (CLIQUABLE) */}
        <button
          onClick={onOpenCartDetails}
          className="flex items-center gap-2 flex-1 cursor-pointer hover:opacity-90 transition-opacity"
          aria-label={t('analyses_catalog.selection.view_cart', 'Voir le panier')}
        >
          <div className="bg-white/20 rounded-lg px-2 py-1 text-sm font-bold">
            {selectedCount}
          </div>
          <span className="text-sm font-semibold whitespace-nowrap">
            {totalCost.toLocaleString()} {currencyLabel}
          </span>
          <ChevronUp className="h-4 w-4 text-white/70 ml-1" />
        </button>

        {/* Right section - Clear + WhatsApp icon */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Clear cart button */}
          <button
            onClick={onReset}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label={translationsUI.reset}
            title={translationsUI.reset}
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>

          {/* WhatsApp icon-only button */}
          <button
            onClick={handleSendViaWhatsApp}
            className="p-2.5 rounded-lg bg-[var(--status-success)] hover:brightness-90 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
            aria-label={translationsUI.sendWhatsapp}
            title={translationsUI.sendWhatsapp}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.386"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Desktop Floating Bubble - replaced by CartSidePanel on lg+ */}
      <div
        ref={containerRef}
        className={`
          hidden
          fixed w-64 max-w-[calc(100vw-2rem)] z-50
          bg-[#800020] dark:bg-[var(--brand-primary)] text-white rounded-lg p-6 min-w-[280px]
          shadow-[0_8px_30px_-2px_rgba(0,0,0,0.15)]
          transition-all duration-300 ease-out
          ${isRtlDirection ? 'lg:left-6' : 'lg:right-6'}
        `}
        dir={isRtlDirection ? 'rtl' : 'ltr'}
        aria-live="polite"
        data-testid="total-calculator-desktop"
        style={{
          bottom: '1.5rem'
        }}
      >
        {/* Header with count and reset button */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center">
            <div
              className="bg-white/20 rounded-lg px-2 py-1 text-sm font-bold transition-transform duration-200"
              style={{ marginRight: isRtlDirection ? 0 : '0.5rem', marginLeft: isRtlDirection ? '0.5rem' : 0 }}
            >
              {selectedCount}
            </div>
            <span className="text-sm font-medium">
              {translationsUI.selectedAnalyses}
            </span>
          </div>

          <button
            onClick={onReset}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label={translationsUI.reset}
            title={translationsUI.reset}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>

        {/* Total cost — static display */}
        <div className="w-full text-left mb-3 p-2">
          <div className="text-lg font-bold">
            <span className="text-white/80">{translationsUI.total}: </span>
            <span className="text-white">
              {totalCost.toLocaleString()} {currencyLabel}
            </span>
          </div>
        </div>

        {/* Détails button — opens cart details modal */}
        <button
          onClick={onOpenCartDetails}
          className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors duration-200"
          aria-label={translationsUI.viewDetails}
        >
          <ChevronUp className="h-4 w-4 flex-shrink-0" />
          <span>{translationsUI.viewDetails}</span>
        </button>

        {/* WhatsApp button */}
        <button
          onClick={handleSendViaWhatsApp}
          className="
            w-full py-2 px-3 rounded-lg
            bg-[var(--status-success)] hover:brightness-90
            text-white text-sm font-medium
            flex items-center justify-center
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-[var(--color-bordeaux-primary)]
          "
          aria-label={translationsUI.sendWhatsapp}
          title={translationsUI.sendWhatsapp}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ marginRight: isRtlDirection ? 0 : '0.5rem', marginLeft: isRtlDirection ? '0.5rem' : 0 }}
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.386"/>
          </svg>
          <span>{translationsUI.sendWhatsapp}</span>
        </button>
      </div>
    </>
  );
}
