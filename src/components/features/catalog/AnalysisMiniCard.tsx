"use client";

import React from "react";
import { useTranslation } from 'react-i18next';
import { Plus, Check } from 'lucide-react';
import { AnalyseItem } from './AnalysisCard';

interface AnalysisMiniCardProps {
  analysis: AnalyseItem;
  lang: string;
  isSelected: boolean;
  onSelect: () => void;
  onShowDetails: () => void;
}

export function AnalysisMiniCard({
  analysis,
  lang,
  isSelected,
  onSelect,
  onShowDetails
}: AnalysisMiniCardProps) {
  const { t } = useTranslation('catalog');
  const isArabic = lang === "ar";

  // Get localized values
  const analysisName = isArabic ? analysis.Nom_Patient_AR : analysis.Nom_Patient_FR;
  const category = isArabic ? analysis.Categorie_AR : analysis.Categorie_FR;
  const description = isArabic ? analysis.Description_Patient_AR : analysis.Description_Patient_FR;

  // Handle card click to show details modal
  const handleCardClick = () => {
    onShowDetails();
  };

  // Handle selection (circular button)
  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  return (
    <div
      className={`
        flex items-center justify-between p-4
        bg-[var(--background-card)] rounded-xl shadow-sm
        border border-[var(--border-default)]
        hover:border-[#FF4081] hover:shadow-md
        transition-all duration-200
        cursor-pointer
      `}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      {/* Left: Name + Description */}
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-[var(--text-primary)] mb-0.5 truncate">
          {analysisName}
        </h4>
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
          {description || category}
        </p>
      </div>

      {/* Right: Price + Circular Button */}
      <div className={`flex items-center gap-3 ml-4 ${isArabic ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Price or "Sur Devis" Badge */}
        {analysis.Prix_Dhs === 0 ? (
          <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-full whitespace-nowrap">
            {t('on_quote', 'Sur Devis')}
          </span>
        ) : (
          <span className="font-bold text-[#E3004F] whitespace-nowrap">
            {analysis.Prix_Dhs.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')} {t('card.price_currency', 'MAD')}
          </span>
        )}

        {/* Circular Add Button */}
        <button
          onClick={(e) => {
            console.log(`🔍 ANALYSIS BUTTON DEBUG: "${analysis.Nom_Analyse_FR}"`, {
              isSelected: isSelected,
              buttonColor: '#E3004F (ROSE BRAND)',
              borderColor: 'white',
              iconType: isSelected ? 'Check' : 'Plus'
            });
            handleSelectClick(e);
          }}
          className={`
            w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0
            transition-all duration-200
            shadow-lg
            focus:outline-none focus:ring-2 focus:ring-offset-1
            ${isSelected
              ? 'bg-white text-[#E3004F] border-[3px] border-[#E3004F] scale-110 shadow-xl focus:ring-[#E3004F]'
              : 'bg-[#E3004F] text-white border-2 border-white hover:bg-[#c20042] hover:scale-105 focus:ring-[#E3004F]'
            }
          `}
          style={isSelected
            ? { backgroundColor: '#FFFFFF', color: '#E3004F', borderColor: '#E3004F', borderWidth: '3px' }
            : { backgroundColor: '#E3004F', color: 'white', borderColor: 'white' }
          }
          aria-label={isSelected ? t('card.selected', 'Retirer du panier') : t('card.select', 'Ajouter au panier')}
        >
          {isSelected ? <Check className="h-6 w-6" strokeWidth={2.5} /> : <Plus className="h-6 w-6" strokeWidth={2.5} />}
        </button>
      </div>
    </div>
  );
}

export default AnalysisMiniCard;
