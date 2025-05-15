import React, { useState } from "react";

// Define Analysis interface for type safety
export interface Analysis {
  id: string;
  name_fr: string;
  name_ar: string;
  price: number;
  category_fr: string;
  category_ar: string;
  preparation_fr: string;
  preparation_ar: string;
  delay_fr: string;
  delay_ar: string;
  is_active: boolean;
}

// AnalysisCard component for displaying individual analysis information
interface AnalysisCardProps {
  analysis: Analysis;
  lang: string;
}

export function AnalysisCard({ analysis, lang }: AnalysisCardProps) {
  const isArabic = lang === "ar";
  const [showPreparation, setShowPreparation] = useState(false);
  
  // Get the preparation text based on the current language
  const preparationText = isArabic ? analysis.preparation_ar : analysis.preparation_fr;
  const hasPreparation = preparationText && preparationText.trim().length > 0;
  
  // Toggle preparation visibility
  const togglePreparation = () => {
    setShowPreparation(prev => !prev);
  };
  
  // Manual translations based on language
  const translations = {
    categoryLabel: isArabic ? "التصنيف:" : "Catégorie:",
    delayLabel: isArabic ? "المدة:" : "Délai:",
    priceCurrency: isArabic ? "درهم" : "MAD",
    showPreparation: isArabic ? "عرض التحضير" : "Voir Préparation",
    hidePreparation: isArabic ? "إخفاء التحضير" : "Masquer Préparation",
    preparationLabel: isArabic ? "تعليمات التحضير:" : "Instructions de préparation:",
    noPreparation: isArabic ? "لا توجد تعليمات تحضير محددة." : "Aucune préparation spécifique."
  };
  
  return (
    <div className="bg-white shadow-lg rounded-lg p-4 mb-4 border border-gray-200 hover:shadow-xl transition-shadow duration-300">
      <h3 className="text-xl font-semibold text-[var(--primary-bordeaux)] mb-2">
        {isArabic ? analysis.name_ar : analysis.name_fr}
      </h3>
      
      <div className="mt-2 space-y-1">
        <p className="text-gray-600">
          <span className="font-medium">{translations.categoryLabel} </span>
          {isArabic ? analysis.category_ar : analysis.category_fr}
        </p>
        
        <p className="text-gray-600">
          <span className="font-medium">{translations.delayLabel} </span>
          {isArabic ? analysis.delay_ar : analysis.delay_fr}
        </p>
        
        <p className="text-[var(--accent-fuchsia)] font-bold mt-2">
          {analysis.price.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')} {translations.priceCurrency}
        </p>
        
        {/* Preparation toggle button - only show if the analysis has preparation instructions */}
        {hasPreparation && (
          <div className="mt-3">
            <button 
              onClick={togglePreparation}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors duration-200"
              aria-expanded={showPreparation}
            >
              {showPreparation 
                ? translations.hidePreparation
                : translations.showPreparation
              }
            </button>
          </div>
        )}
        
        {/* Preparation details section - conditionally rendered */}
        {showPreparation && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <h4 className="font-medium text-sm mb-1 text-gray-700">
              {translations.preparationLabel}
            </h4>
            <p className="text-gray-700 text-sm whitespace-pre-line">
              {hasPreparation 
                ? preparationText 
                : translations.noPreparation
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalysisCard;
