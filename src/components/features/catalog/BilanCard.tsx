"use client";

import React from "react";
import { useTranslation } from 'react-i18next';
import { BilanItem, AnalyseItem } from './AnalysisCard';
import { getIconComponent } from '@/utils/iconMapper';
import { Plus, Check, ChevronRight } from 'lucide-react';

interface BilanCardProps {
  bilan: BilanItem;
  lang: string;
  isSelected: boolean;
  onSelect: (bilan: BilanItem) => void;
  onShowDetails: (bilan: BilanItem) => void;
  normalizedAnalysesMap?: Map<string, AnalyseItem>;
}

export function BilanCard({
  bilan,
  lang,
  isSelected,
  onSelect,
  onShowDetails,
  normalizedAnalysesMap
}: BilanCardProps) {
  const { t } = useTranslation('catalog');
  const isArabic = lang === "ar";

  const IconComponent = getIconComponent(bilan.Icone);
  const bilanName = isArabic ? bilan.Nom_Bilan_AR : bilan.Nom_Bilan_FR;
  const bilanDescription = isArabic ? bilan.Description_AR : bilan.Description_FR;

  const computedPrice = normalizedAnalysesMap
    ? bilan.Composition_Codes.reduce((sum, code) => {
        const key = code.replace(/\s+/g, '').toUpperCase();
        return sum + (normalizedAnalysesMap.get(key)?.Prix_Dhs ?? 0);
      }, 0)
    : bilan.Prix_Affiche_Dhs;

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(bilan);
  };

  const handleShowDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShowDetails(bilan);
  };

  return (
    <div
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) {
          onShowDetails(bilan);
        }
      }}
      className="relative w-full rounded-lg overflow-hidden bg-[var(--background-card)] cursor-pointer transition-all hover-lift"
      style={{
        border: bilan.Is_Featured
          ? '2px solid color-mix(in srgb, var(--color-bordeaux-primary) 25%, transparent)'
          : '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Thin top accent bar for featured */}
      {bilan.Is_Featured && (
        <div 
          className="h-[3px] w-full" 
          style={{ background: 'linear-gradient(90deg, var(--color-bordeaux-primary), var(--color-bordeaux-light))' }} 
        />
      )}

      {/* Featured badge */}
      {bilan.Is_Featured && (
        <div className={`absolute top-5 ${isArabic ? 'left-5' : 'right-5'} z-10`}>
          <span
            className="text-white px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold shadow-sm bg-[var(--color-fuchsia-accent)] flex items-center gap-1.5"
          >
            <span className="text-[10px]">★</span> {t('featured_badge', 'Vedette')}
          </span>
        </div>
      )}

      {/* Icon with bordeaux pill background */}
      <div className="flex justify-center pt-6 pb-3">
        <div
          className="rounded-xl p-3 bg-[var(--color-bordeaux-pale)]"
        >
          <IconComponent
            className="h-10 w-10 text-[var(--color-bordeaux-primary)] dark:text-[var(--brand-accent)]"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-5 flex flex-col">
        <h3 className="text-lg font-bold mb-1 text-[var(--text-primary)] transition-colors">
          {bilanName}
        </h3>
        <p className="text-sm mb-4 line-clamp-2 text-[var(--text-secondary)] transition-colors">
          {bilanDescription}
        </p>

        {/* Price row + add button */}
        <div className={`flex items-center justify-between gap-3 mb-3 ${isArabic ? 'flex-row-reverse' : ''}`}>
          <div>
            <p className="text-xs text-[var(--text-secondary)] mb-0.5 transition-colors">
              {t('bilan.total_price', 'Total')}
            </p>
            <p className="text-xl font-bold text-[var(--text-primary)] transition-colors">
              {computedPrice.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')}
              <span className="text-sm font-medium text-[var(--text-secondary)] ml-1">
                {t('card.price_currency', 'MAD')}
              </span>
            </p>
          </div>

          <button
            onClick={handleSelectClick}
            className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all ${
              isSelected 
                ? 'bg-white text-[var(--color-fuchsia-accent)] border-2 border-[var(--color-fuchsia-accent)] scale-110 shadow-lg' 
                : 'bg-[var(--color-fuchsia-accent)] text-white border-2 border-transparent hover:scale-105 active:scale-95'
            }`}
            aria-label={isSelected ? t('card.selected', 'Retirer du panier') : t('card.select', 'Ajouter au panier')}
          >
            {isSelected
              ? <Check className="h-5 w-5" strokeWidth={2.5} />
              : <Plus className="h-5 w-5" strokeWidth={2.5} />
            }
          </button>
        </div>

        {/* Details button */}
        <button
          onClick={handleShowDetails}
          className="w-full py-2 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-1 border border-[var(--border-default)] text-[var(--color-bordeaux-primary)] dark:text-[var(--brand-accent)] bg-transparent hover:bg-[var(--color-bordeaux-pale)] transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
        >
          {t('show_details', 'Voir Détails')}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default BilanCard;
