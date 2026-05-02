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

  const analysisName = isArabic ? analysis.Nom_Patient_AR : analysis.Nom_Patient_FR;
  const category = isArabic ? analysis.Categorie_AR : analysis.Categorie_FR;
  const description = isArabic ? analysis.Description_Patient_AR : analysis.Description_Patient_FR;

  const handleCardClick = () => onShowDetails();

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  return (
    <div
      className={`flex items-start justify-between p-4 bg-[var(--background-card)] rounded-lg cursor-pointer transition-all border ${
        isSelected 
          ? 'border-[var(--color-bordeaux-primary)] shadow-sm scale-[1.02]' 
          : 'border-[var(--border-default)] shadow-none hover:border-[var(--color-bordeaux-light)]'
      }`}
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
      <div className="flex-1 min-w-0 pr-3">
        <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-0.5 leading-snug">
          {analysisName}
        </h4>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          {description || category}
        </p>
      </div>

      {/* Right: Price + Add button */}
      <div className={`flex items-center gap-3 flex-shrink-0 ${isArabic ? 'flex-row-reverse' : ''}`}>
        {/* Price */}
        {analysis.Prix_Dhs === 0 ? (
          <span
            className="px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap"
            style={{
              backgroundColor: 'var(--background-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)'
            }}
          >
            {t('on_quote', 'Sur Devis')}
          </span>
        ) : (
          <div className="text-right">
            <span className="font-bold text-sm text-[var(--text-primary)] whitespace-nowrap">
              {analysis.Prix_Dhs.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')}
            </span>
            <span className="text-xs text-[var(--text-secondary)] ml-1">
              {t('card.price_currency', 'MAD')}
            </span>
          </div>
        )}

        {/* Add button */}
        <button
          onClick={handleSelectClick}
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all ${
            isSelected
              ? 'bg-white text-[var(--color-fuchsia-accent)] border-2 border-[var(--color-fuchsia-accent)] scale-105 shadow-md'
              : 'bg-[var(--color-fuchsia-accent)] text-white border-2 border-transparent hover:scale-105 active:scale-95'
          }`}
          aria-label={isSelected ? t('card.selected', 'Retirer du panier') : t('card.select', 'Ajouter au panier')}
        >
          {isSelected
            ? <Check className="h-4 w-4" strokeWidth={2.5} />
            : <Plus className="h-4 w-4" strokeWidth={2.5} />
          }
        </button>
      </div>
    </div>
  );
}

export default AnalysisMiniCard;
