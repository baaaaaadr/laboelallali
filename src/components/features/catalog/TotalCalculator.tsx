"use client";

import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Analysis } from './AnalysisCard';
import { LAB_WHATSAPP_NUMBER } from '@/constants/contact';

interface TotalCalculatorProps {
  totalCost: number;
  selectedCount: number;
  onReset: () => void;
  currencyLabel: string;
  isRtl?: boolean;
  selectedAnalyses?: Analysis[];
}

export default function TotalCalculator({
  totalCost,
  selectedCount,
  onReset,
  currencyLabel,
  isRtl = false,
  selectedAnalyses = []
}: TotalCalculatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(selectedCount);
  
  // Simple animation effect when count changes
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
    sendWhatsapp: t('analyses_catalog.selection.send_whatsapp', 'Envoyer via WhatsApp')
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
    
    selectedAnalyses.forEach(analysis => {
      const analysisName = i18n.language === 'ar' ? analysis.name_ar : analysis.name_fr;
      message += `${whatsappTranslations.analysisItemPrefix}${analysisName}\n`;
    });
    
    message += `\n${whatsappTranslations.totalLabel} ${totalCost.toLocaleString()} ${whatsappTranslations.currency}\n\n`;
    message += `${whatsappTranslations.closingRemark}\n\n`;
    message += whatsappTranslations.websiteReference;
    
    return message;
  };
  
  const handleSendViaWhatsApp = () => {
    const message = generateWhatsAppMessage();
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${LAB_WHATSAPP_NUMBER}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };
  
  // Only render if there are selected items
  if (selectedCount === 0) return null;

  return (
    <div 
      ref={containerRef}
      className={`
        fixed bottom-4 w-64 max-w-[calc(100vw-2rem)]
        bg-[var(--color-bordeaux-primary)] text-white rounded-xl p-4 shadow-lg
        transition-all duration-300 ease-out
        ${isRtlDirection ? 'left-4' : 'right-4'}
      `}
      dir={isRtlDirection ? 'rtl' : 'ltr'}
      title={translationsUI.tooltip}
      aria-live="polite"
      data-testid="total-calculator"
      style={{
        zIndex: 50,
        boxShadow: '0 10px 25px -3px rgba(128, 0, 32, 0.3), 0 4px 6px -2px rgba(128, 0, 32, 0.15)'
      }}
    >
      {/* Header with count and reset button */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <div 
            className="bg-white/20 rounded-full px-2 py-1 text-sm font-bold transition-transform duration-200"
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
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label={translationsUI.reset}
          title={translationsUI.reset}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>
      
      {/* Total cost */}
      <div className="text-lg font-bold mb-3">
        <span className="text-white/80">{translationsUI.total}: </span>
        <span className="text-white">
          {totalCost.toLocaleString()} {currencyLabel}
        </span>
      </div>
      
      {/* WhatsApp button */}
      <button 
        onClick={handleSendViaWhatsApp}
        className="
          w-full py-2 px-3 rounded-lg
          bg-green-600 hover:bg-green-700 
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
  );
}