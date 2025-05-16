"use client";

import React, { useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Analysis } from './AnalysisCard';
import { LAB_WHATSAPP_NUMBER } from '@/constants/contact';

interface TotalCalculatorProps {
  totalCost: number;
  selectedCount: number;
  onReset: () => void;
  currencyLabel: string;
  isRtl?: boolean;
  // We need access to the selected analyses for WhatsApp sharing
  selectedAnalyses?: Analysis[];
  // Les traductions sont maintenant gérées à l'intérieur du composant
}

/**
 * A floating bubble component that displays the running total of selected analyses
 * Appears fixed to the bottom of the viewport
 */
export default function TotalCalculator({
  totalCost,
  selectedCount,
  onReset,
  currencyLabel,
  isRtl = false,
  selectedAnalyses = []
}: TotalCalculatorProps) {
  // Direct DOM manipulation reference
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(selectedCount);
  
  // Manually flash the calculator when count changes
  useEffect(() => {
    console.log('[TotalCalculator] Previous count:', prevCountRef.current, 'New count:', selectedCount);
    
    // Skip initial render
    if (prevCountRef.current === undefined || containerRef.current === null) {
      prevCountRef.current = selectedCount;
      return;
    }
    
    // Only animate if count has changed
    if (prevCountRef.current !== selectedCount) {
      console.log('[TotalCalculator] Triggering color-only animation');
      
      const div = containerRef.current;
      
      // Get the original styles
      const originalBg = window.getComputedStyle(div).backgroundColor;
      
      // Create a sequence of colors for a wave effect
      // All colors are in the bordeaux/burgundy family
      const colorSequence = [
        '#8E2042', // Slightly lighter bordeaux
        '#A02A4D', // Even lighter bordeaux 
        '#B13558', // Brighter bordeaux
        '#973048', // Back toward original
        '#872238', // Almost back to original
        originalBg   // Back to original
      ];
      
      // Add a transition just for background color
      div.style.transition = 'background-color 0.25s ease-in-out';
      
      // Apply each color in sequence
      colorSequence.forEach((color, index) => {
        setTimeout(() => {
          div.style.backgroundColor = color;
          
          // Remove transition after all animations complete
          if (index === colorSequence.length - 1) {
            setTimeout(() => {
              div.style.transition = '';
            }, 250);
          }
        }, index * 150); // 150ms between each color change
      });
    }
    
    prevCountRef.current = selectedCount;
  }, [selectedCount]);
  const { t, i18n } = useTranslation('common');
  
  // Détermine la direction de la langue actuelle si isRtl n'est pas spécifié explicitement
  const isRtlDirection = isRtl || i18n.language === 'ar';
  
  // Translations as direct values rather than using useMemo for more stable typing
  const translationsUI = {
    selectedAnalyses: t('analyses_catalog.selection.analyses_selected', 'analyses sélectionnées'),
    total: t('analyses_catalog.selection.total', 'Total'),
    reset: t('analyses_catalog.selection.reset', 'Réinitialiser'),
    tooltip: t('analyses_catalog.selection.tooltip', 'Calcul automatique du coût total des analyses sélectionnées'),
    sendWhatsapp: t('analyses_catalog.selection.send_whatsapp', 'Envoyer via WhatsApp')
  };
  
  // WhatsApp message translations as direct values
  const whatsappTranslations = {
    greeting: t('analyses_catalog.selection.whatsapp_message.greeting', 'Bonjour Laboratoire El Allali,'),
    intro: t('analyses_catalog.selection.whatsapp_message.intro', 'Je suis intéressé(e) par les analyses suivantes :'),
    analysisItemPrefix: t('analyses_catalog.selection.whatsapp_message.analysis_item_prefix', '- '),
    totalLabel: t('analyses_catalog.selection.whatsapp_message.total_label', 'Total estimé :'),
    currency: t('analyses_catalog.selection.whatsapp_message.currency', 'MAD'),
    closingRemark: t('analyses_catalog.selection.whatsapp_message.closing_remark', 'Pouvez-vous me donner plus d\'informations ?'),
    websiteReference: t('analyses_catalog.selection.whatsapp_message.website_reference', 'Sélection faite depuis le site web.')
  };

  // Laboratory WhatsApp number is imported from constants file
  
  // Function to generate WhatsApp message
  const generateWhatsAppMessage = () => {
    // Create message in current language
    let message = `${whatsappTranslations.greeting}\n\n`;
    message += `${whatsappTranslations.intro}\n`;
    
    // Add list of selected analyses
    selectedAnalyses.forEach(analysis => {
      const analysisName = i18n.language === 'ar' ? analysis.name_ar : analysis.name_fr;
      message += `${whatsappTranslations.analysisItemPrefix}${analysisName}\n`;
    });
    
    // Add total cost
    message += `\n${whatsappTranslations.totalLabel} ${totalCost.toLocaleString()} ${whatsappTranslations.currency}\n\n`;
    
    // Add closing
    message += `${whatsappTranslations.closingRemark}\n\n`;
    message += whatsappTranslations.websiteReference;
    
    return message;
  };
  
  // Handler for WhatsApp button click
  const handleSendViaWhatsApp = () => {
    const message = generateWhatsAppMessage();
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${LAB_WHATSAPP_NUMBER}?text=${encodedMessage}`;
    
    // Open WhatsApp in a new tab
    window.open(whatsappUrl, '_blank');
  };
  
  // Only render the component if there are selected items
  if (selectedCount === 0) return null;

  return (
    <div 
      ref={containerRef}
      className="floating-total-calculator"
      dir={isRtlDirection ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        bottom: '1rem',
        [isRtlDirection ? 'left' : 'right']: '1rem',
        zIndex: 40,
        backgroundColor: 'var(--primary-bordeaux)',
        color: 'white',
        borderRadius: '1rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        padding: '0.75rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        minWidth: '230px',
        maxWidth: '330px',
        animation: 'fadeIn 0.3s ease-out forwards'
      }}
      title={translationsUI.tooltip}
      aria-live="polite"
    >
      {/* Selected count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            borderRadius: '9999px',
            padding: '0 0.5rem',
            marginRight: isRtlDirection ? 0 : '0.5rem',
            marginLeft: isRtlDirection ? '0.5rem' : 0,
            animation: 'countPulse 0.5s ease-out'
          }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
              {selectedCount}
            </span>
          </div>
          <span style={{ fontSize: '0.875rem', fontWeight: '500', marginLeft: '0.5rem' }}>
            {translationsUI.selectedAnalyses}
          </span>
        </div>
        
        {/* Reset button */}
        <button 
          onClick={onReset}
          style={{
            padding: '0.375rem',
            borderRadius: '9999px',
            transition: 'background-color 0.2s',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'white'
          }}
          aria-label={translationsUI.reset}
          title={translationsUI.reset}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>
      
      {/* Total cost */}
      <div style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>
        <span style={{ color: 'white' }}>{translationsUI.total}:</span> 
        <span style={{ color: 'var(--bordeaux-pale)' }}> {totalCost.toLocaleString()} {currencyLabel}</span>
      </div>
      
      {/* Send via WhatsApp button */}
      <button 
        onClick={handleSendViaWhatsApp}
        style={{
          marginTop: '0.75rem',
          padding: '0.5rem',
          borderRadius: '0.5rem',
          backgroundColor: 'transparent', // Transparent background
          color: 'white',
          border: '1px solid white', // White border
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          fontSize: '0.875rem',
          fontWeight: '500'
        }}  
        aria-label={translationsUI.sendWhatsapp}
        title={translationsUI.sendWhatsapp}
      >
        {/* WhatsApp Icon */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{ marginRight: isRtlDirection ? 0 : '0.5rem', marginLeft: isRtlDirection ? '0.5rem' : 0 }}
        >
          <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
          <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z" />
          <path d="M14 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z" />
          <path d="M8.5 13.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 0-1H9a.5.5 0 0 0-.5.5Z" />
        </svg>
        <span>{translationsUI.sendWhatsapp}</span>
      </button>
      
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* Animation removed - using direct DOM manipulation instead */
        
        @keyframes countPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        
        @media (min-width: 768px) {
          .floating-total-calculator {
            bottom: 2rem !important;
          }
          .floating-total-calculator[dir='rtl'] {
            left: 2rem !important;
          }
          .floating-total-calculator[dir='ltr'] {
            right: 2rem !important;
          }
        }
        
        /* WhatsApp button hover effect */
        .floating-total-calculator button:hover {
          background-color: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }
        
        /* Animation spéciale pour le focus des éléments interactifs */
        .floating-total-calculator button:focus {
          outline: 2px solid rgba(255, 255, 255, 0.6);
          box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2);
          border-radius: 9999px;
        }
      `}</style>
    </div>
  );
}
