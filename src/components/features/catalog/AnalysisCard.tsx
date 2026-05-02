import React from "react";
import { useTranslation } from 'react-i18next';

// Legacy interface - kept for backward compatibility
export interface Analysis {
  id: string;
  name_fr: string;
  name_ar: string;
  price: number;
  category_fr: string;
  category_ar: string;
  preparation_fr: string;
  preparation_ar: string;
  description_fr?: string;
  description_ar?: string;
  technical_name?: string;
  is_active: boolean;
}

// New interface for individual analyses from the 'analyses' collection
export interface AnalyseItem {
  id: string; // Code_Interne (e.g., "C HBA1", "H NFS")
  Nom_Patient_FR: string;
  Nom_Patient_AR: string;
  Prix_Dhs: number;
  Categorie_FR: string;
  Categorie_AR: string;
  Pre_Analytique_FR: string;
  Pre_Analytique_AR: string;
  Tags_FR: string[];
  Tags_AR: string[];
  Description_Patient_FR?: string;
  Description_Patient_AR?: string;
  Nom_Technique?: string;
  Nombre_Demandes?: number;
}

// New interface for test packs/bilans from the 'bilans' collection
export interface BilanItem {
  id: string;
  Nom_Bilan_FR: string;
  Nom_Bilan_AR: string;
  Prix_Affiche_Dhs: number;
  Description_FR: string;
  Description_AR: string;
  Composition_Codes: string[]; // Array of analysis IDs (e.g., ["C HBA1", "C GLY"])
  Is_Featured: boolean;
  Icone: string; // Icon name (e.g., "heart_pulse", "battery_charging")
  Categorie: string;
}

// Union type for cart items (supports both analyses and bilans)
export type CartItem =
  | { type: 'analyse'; item: AnalyseItem }
  | { type: 'bilan'; item: BilanItem };

interface AnalysisCardProps {
  analysis: Analysis;
  lang: string;
  isSelected?: boolean;
  onSelect?: (analysis: Analysis) => void;
  onShowDetails?: (analysis: Analysis) => void;
}

export function AnalysisCard({ analysis, lang, isSelected = false, onSelect, onShowDetails }: AnalysisCardProps) {
  const { t } = useTranslation('catalog');
  const isArabic = lang === "ar";

  // Handle card click to show details modal
  const handleCardClick = () => {
    if (onShowDetails) {
      onShowDetails(analysis);
    }
  };

  // Handle selection (circular button)
  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(analysis);
    }
  };

  return (
    <div
      className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
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
      {/* Left: Name + Category */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-1 truncate">
          {isArabic ? analysis.name_ar : analysis.name_fr}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {isArabic ? analysis.category_ar : analysis.category_fr}
        </p>
      </div>

      {/* Right: Price + Circular Button */}
      <div className={`flex items-center gap-3 ${isArabic ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Price or "Sur Devis" Badge */}
        {analysis.price === 0 ? (
          <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg whitespace-nowrap">
            {t('on_quote', 'Sur Devis')}
          </span>
        ) : (
          <span className="text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">
            {analysis.price.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')} {t('card.price_currency', 'DH')}
          </span>
        )}

        {/* Circular Add Button */}
        <button
          onClick={handleSelectClick}
          className={`
            h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:ring-offset-2
            ${isSelected
              ? 'bg-white text-[var(--color-fuchsia-accent)] border-2 border-[var(--color-fuchsia-accent)] scale-110 shadow-md'
              : 'bg-[var(--color-fuchsia-accent)] text-white hover:scale-110 hover:bg-[var(--color-fuchsia-bright)]'
            }
          `}
          aria-label={isSelected ? t('card.selected', 'Retirer du panier') : t('card.select', 'Ajouter au panier')}
        >
          {isSelected ? '✓' : '+'}
        </button>
      </div>

    </div>
  );
}

export default AnalysisCard;