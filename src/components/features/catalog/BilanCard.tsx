"use client";

import React from "react";
import { useTranslation } from 'react-i18next';
import { BilanItem } from './AnalysisCard';
import { getIconComponent } from '@/utils/iconMapper';
import { Plus, Check } from 'lucide-react';

interface BilanCardProps {
  bilan: BilanItem;
  lang: string;
  isSelected: boolean;
  onSelect: (bilan: BilanItem) => void;
  onShowDetails: (bilan: BilanItem) => void;
}

export function BilanCard({
  bilan,
  lang,
  isSelected,
  onSelect,
  onShowDetails
}: BilanCardProps) {
  const { t } = useTranslation('catalog');
  const isArabic = lang === "ar";

  // Get icon component
  const IconComponent = getIconComponent(bilan.Icone);

  // Get localized name and description
  const bilanName = isArabic ? bilan.Nom_Bilan_AR : bilan.Nom_Bilan_FR;
  const bilanDescription = isArabic ? bilan.Description_AR : bilan.Description_FR;

  // Handle selection
  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(bilan);
  };

  // Handle show details
  const handleShowDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShowDetails(bilan);
  };

  return (
    <div
      onClick={(e) => {
        // Only trigger if not clicking on buttons
        const target = e.target as HTMLElement;
        if (!target.closest('button')) {
          onShowDetails(bilan);
        }
      }}
      className={`
        relative w-full rounded-lg overflow-hidden
        bg-[var(--background-card)]
        transition-all duration-300
        cursor-pointer
        ${bilan.Is_Featured
          ? 'shadow-lg shadow-pink-500/10 border-2 border-pink-100 dark:border-[var(--border-accent)]'
          : 'shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-[var(--border-default)] hover:shadow-[0_8px_30px_-2px_rgba(0,0,0,0.1)]'
        }
      `}
    >
      {/* Featured Badge */}
      {bilan.Is_Featured && (
        <div className={`absolute top-3 ${isArabic ? 'left-3' : 'right-3'} z-10`}>
          <span className="bg-gradient-to-r from-[#E3004F] to-[#FF4081] text-white px-3 py-1 rounded-lg text-xs font-semibold shadow-md">
            ⭐ {t('featured_badge', 'Vedette')}
          </span>
        </div>
      )}

      {/* Icon - Centered at top */}
      <div className="flex justify-center pt-6 pb-4">
        <IconComponent
          className="h-12 w-12 text-[#E3004F]"
        />
      </div>

      {/* Content */}
      <div className="px-6 pb-5 flex flex-col">
        <h3 className="text-xl font-bold mb-2 text-[var(--text-primary)]">
          {bilanName}
        </h3>

        <p className="text-sm mb-4 line-clamp-2 text-[var(--text-secondary)]">
          {bilanDescription}
        </p>

        {/* Price and Circular Button Row */}
        <div className={`flex items-center justify-between gap-4 mb-3 ${isArabic ? 'flex-row-reverse' : 'flex-row'}`}>
          <p className="text-2xl font-bold text-[#E3004F]">
            {bilan.Prix_Affiche_Dhs.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')} {t('card.price_currency', 'MAD')}
          </p>

          {/* Circular Add Button - Like AnalysisMiniCard */}
          <button
            onClick={handleSelectClick}
            className={`
              w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0
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

        {/* Button to show details */}
        <div>
          <button
            onClick={handleShowDetails}
            className="
              w-full py-2 px-4 rounded-lg font-medium transition-all
              border border-[var(--border-default)]
              text-[var(--text-primary)]
              hover:bg-[var(--background-hover)]
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E3004F]
            "
          >
            {t('show_details', 'Voir Détails')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BilanCard;
