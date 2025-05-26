// src/app/[lang]/analyses/page.tsx
"use client";

import React, { useState, useEffect, useMemo, Suspense, useCallback } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/config/firebase";
import AnalysisCard, { Analysis } from "@/components/features/catalog/AnalysisCard";
import TotalCalculator from "@/components/features/catalog/TotalCalculator";
import { useTranslation } from 'react-i18next';

// Simplified data fetcher with stable implementation
const AnalysesCatalogDataFetcher = ({ 
  lang, 
  onDataFetched, 
  onErrorOccurred, 
  onLoadingStateChange 
}: {
  lang: string;
  onDataFetched: (data: Analysis[]) => void;
  onErrorOccurred: (errorMsg: string | null) => void;
  onLoadingStateChange: (isLoading: boolean) => void;
}) => {
  const { t } = useTranslation(['common', 'catalog']);

  const translations = useMemo(() => ({
    errorFetchingBase: t('catalog.error_fetching', 'Échec du chargement des analyses'),
    errorDbNotInitialized: t('firebase.db_not_initialized', 'Database connection error'),
    errorPermissions: t('catalog.error_permissions', 'Access denied'),
    errorOffline: t('catalog.error_offline', 'Cannot connect to database')
  }), [t]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchAnalyses = async () => {
      if (!isMounted) return;
      
      onLoadingStateChange(true);
      onErrorOccurred(null);
      
      try {
        if (!db) {
          throw new Error("Firestore is not initialized");
        }
        
        const analysesCollectionRef = collection(db, "analysisCatalog");
        const analysesQuery = query(
          analysesCollectionRef,
          where("is_active", "==", true),
          orderBy(lang === "ar" ? "name_ar" : "name_fr")
        );

        const querySnapshot = await getDocs(analysesQuery);
        
        if (!isMounted) return;
        
        const fetchedAnalyses: Analysis[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Analysis, "id">)
        }));
        
        onDataFetched(fetchedAnalyses);
      } catch (err) {
        if (!isMounted) return;
        
        console.error("Error fetching analyses:", err);
        let specificErrorMessage = translations.errorFetchingBase;
        
        if (err instanceof Error) {
          if (err.message.includes("Missing or insufficient permissions")) {
            specificErrorMessage = translations.errorPermissions;
          } else if (err.message.includes("offline") || err.message.includes("Failed to fetch")) {
            specificErrorMessage = translations.errorOffline;
          } else if (err.message.toLowerCase().includes("firestore is not initialized")) {
            specificErrorMessage = translations.errorDbNotInitialized;
          }
        }
        onErrorOccurred(specificErrorMessage);
      } finally {
        if (isMounted) {
          onLoadingStateChange(false);
        }
      }
    };
    
    fetchAnalyses();
    
    return () => {
      isMounted = false;
    };

  }, [lang, translations, onDataFetched, onErrorOccurred, onLoadingStateChange]);

  return null;
};

// Main page component
export function AnalysesCatalogPageContents({ params: langParams }: { params: { lang: string } }) {
  const STORAGE_KEY = 'laboElAllali_selectedAnalyses';
  const { t } = useTranslation(['common', 'catalog']);
  const lang = langParams.lang;
  const isArabic = lang === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  
  // State variables
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedAnalyses, setSelectedAnalyses] = useState<Analysis[]>([]);
  
  // Stable callbacks to prevent unnecessary re-renders
  const handleDataFetched = useCallback((data: Analysis[]) => {
    setAnalyses(data);
  }, []);
  
  const handleErrorOccurred = useCallback((errorMsg: string | null) => {
    setError(errorMsg);
  }, []);
  
  const handleLoadingStateChange = useCallback((isLoading: boolean) => {
    setLoading(isLoading);
  }, []);
  
  // Load selected analyses from localStorage on component mount
  useEffect(() => {
    try {
      const savedSelections = localStorage.getItem(STORAGE_KEY);
      if (savedSelections) {
        const parsedSelections = JSON.parse(savedSelections);
        if (Array.isArray(parsedSelections) && parsedSelections.length > 0) {
          if (parsedSelections.every(item => item && typeof item === 'object' && 'id' in item)) {
            setSelectedAnalyses(parsedSelections);
          }
        }
      }
    } catch (error) {
      console.error('Error restoring selections from localStorage:', error);
    }
  }, []);
  
  // Save selections to localStorage
  const saveSelectionsToStorage = useCallback((selections: Analysis[]) => {
    try {
      const serializedData = JSON.stringify(selections);
      localStorage.setItem(STORAGE_KEY, serializedData);
    } catch (error) {
      console.error('Error saving selections to localStorage:', error);
    }
  }, []);
  
  // Save selected analyses to localStorage when they change
  useEffect(() => {
    saveSelectionsToStorage(selectedAnalyses);
  }, [selectedAnalyses, saveSelectionsToStorage]);
  
  // Calculate total cost
  const getTotalCost = useCallback((): number => {
    return selectedAnalyses.reduce((total, analysis) => total + analysis.price, 0);
  }, [selectedAnalyses]);

  const translations = useMemo(() => ({
    title: t('common:navigation.analyses_catalog', isArabic ? 'دليل التحاليل' : 'Catalogue des Analyses'),
    searchLabel: t('catalog:search_label', isArabic ? 'البحث عن تحليل' : 'Rechercher une analyse'),
    searchPlaceholder: t('catalog:search_placeholder', isArabic ? 'اكتب اسم التحليل...' : "Tapez le nom d'une analyse..."),
    categoryLabel: t('catalog:category_label', isArabic ? 'التصنيف' : 'Catégorie'),
    allCategories: t('catalog:all_categories', isArabic ? 'جميع التصنيفات' : 'Toutes les catégories'),
    noResults: t('catalog:no_results', isArabic ? 'لا توجد نتائج مطابقة لمعايير البحث.' : 'Aucun résultat trouvé.'),
    clearFilters: t('catalog:clear_filters', isArabic ? 'مسح عوامل التصفية' : 'Effacer les filtres'),
    noAnalyses: t('catalog:no_analyses', isArabic ? 'لا توجد تحاليل متاحة حاليًا.' : 'Aucune analyse disponible.'),
    loadingText: t('catalog:loading', isArabic ? 'جاري التحميل...' : 'Chargement des analyses...'),
    errorTitle: t('common:error.title', isArabic ? 'خطأ' : 'Erreur'),
    costUnit: isArabic ? 'درهم' : 'MAD'
  }), [t, isArabic]);

  const categories = useMemo(() => {
    const categoryField = lang === "ar" ? "category_ar" : "category_fr";
    const uniqueCategories = new Set<string>();
    analyses.forEach((analysis) => {
      const category = analysis[categoryField as keyof Analysis] as string;
      if (category && category.trim()) uniqueCategories.add(category.trim());
    });
    return Array.from(uniqueCategories).sort();
  }, [analyses, lang]);

  // Toggle selection status of an analysis
  const handleToggleSelection = useCallback((analysis: Analysis) => {
    setSelectedAnalyses(prev => {
      const isSelected = prev.some(item => item.id === analysis.id);
      
      if (isSelected) {
        return prev.filter(item => item.id !== analysis.id);
      } else {
        return [...prev, analysis];
      }
    });
  }, []);

  // Check if an analysis is selected - using useCallback for stability
  const isAnalysisSelected = useCallback((analysisId: string): boolean => {
    return selectedAnalyses.some(analysis => analysis.id === analysisId);
  }, [selectedAnalyses]);

  // Clear all selections
  const clearAllSelections = useCallback(() => {
    setSelectedAnalyses([]);
  }, []);

  const filteredAnalyses = useMemo(() => {
    return analyses.filter((analysis) => {
      const nameField = lang === "ar" ? "name_ar" : "name_fr";
      const categoryField = lang === "ar" ? "category_ar" : "category_fr";
      const nameMatches = !searchTerm || (analysis[nameField as keyof Analysis] as string).toLowerCase().includes(searchTerm.toLowerCase());
      const categoryMatches = !selectedCategory || (analysis[categoryField as keyof Analysis] as string) === selectedCategory;
      return nameMatches && categoryMatches;
    });
  }, [analyses, searchTerm, selectedCategory, lang]);

  return (
    <div className="min-h-screen bg-[var(--background-default)] transition-colors duration-200">
      <div className={`container mx-auto px-4 py-8 ${isArabic ? 'rtl-content' : ''}`} dir={dir}>
        <AnalysesCatalogDataFetcher 
          lang={lang}
          onDataFetched={handleDataFetched}
          onErrorOccurred={handleErrorOccurred}
          onLoadingStateChange={handleLoadingStateChange}
        />
        
        <h1 className="text-3xl font-bold text-[var(--color-bordeaux-primary)] mb-6 text-center">
          {translations.title}
        </h1>
        
        {/* Filter section */}
        {!loading && analyses.length > 0 && (
          <div className="mb-6">
            <div className={`p-4 bg-[var(--background-secondary)] rounded-lg border border-[var(--border-default)] shadow-sm ${isArabic ? 'rtl-filter-section' : ''}`}>
              <div className={`flex flex-col md:flex-row gap-4 ${isArabic ? 'md:flex-row-reverse' : ''}`}>
                <div className={`flex-1 ${isArabic ? 'text-right' : ''}`}>
                  <label htmlFor="search" className={`block text-sm font-medium text-[var(--text-primary)] mb-1 ${isArabic ? 'text-right' : ''}`}>
                    {translations.searchLabel}
                  </label>
                  <input
                    type="text"
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={translations.searchPlaceholder}
                    style={isArabic ? {textAlign: 'right', direction: 'rtl'} : {}}
                    className={`
                      w-full p-2 border border-[var(--border-default)] rounded-md 
                      focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent 
                      bg-[var(--background-default)] text-[var(--text-primary)]
                      placeholder:text-[var(--text-tertiary)]
                      ${isArabic ? 'text-right' : ''}
                    `}
                  />
                </div>
                <div className={`md:w-1/3 ${isArabic ? 'text-right' : ''}`}>
                  <label htmlFor="category" className={`block text-sm font-medium text-[var(--text-primary)] mb-1 ${isArabic ? 'text-right' : ''}`}>
                    {translations.categoryLabel}
                  </label>
                  <select
                    id="category"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={isArabic ? {textAlign: 'right', direction: 'rtl'} : {}}
                    className={`
                      w-full p-2 border border-[var(--border-default)] rounded-md 
                      focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent 
                      bg-[var(--background-default)] text-[var(--text-primary)]
                      ${isArabic ? 'text-right' : ''}
                    `}
                  >
                    <option value="">{translations.allCategories}</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="loading"></div>
            <span className="ml-3 text-[var(--text-secondary)]">{translations.loadingText}</span>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-6 shadow-md" role="alert">
            <strong className="font-bold">{translations.errorTitle}: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && analyses.length === 0 && (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            <p>{translations.noAnalyses}</p>
          </div>
        )}

        {/* Floating Total Calculator */}
        <TotalCalculator
          totalCost={getTotalCost()}
          selectedCount={selectedAnalyses.length}
          onReset={clearAllSelections}
          currencyLabel={translations.costUnit}
          isRtl={isArabic}
          selectedAnalyses={selectedAnalyses}
        />

        {/* Analysis cards - FIXED GRID with proper z-index */}
        {!loading && !error && analyses.length > 0 && (
          <>
            {filteredAnalyses.length > 0 ? (
              <div 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative"
                style={{ zIndex: 1 }}
              >
                {filteredAnalyses.map((analysis: Analysis) => (
                  <AnalysisCard 
                    key={`analysis-card-${analysis.id}`}
                    analysis={analysis} 
                    lang={lang} 
                    isSelected={isAnalysisSelected(analysis.id)}
                    onSelect={handleToggleSelection}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[var(--background-secondary)] rounded-lg border border-[var(--border-default)]">
                <p className="text-[var(--text-secondary)] text-lg mb-3">{translations.noResults}</p>
                <button 
                  onClick={() => { setSearchTerm(""); setSelectedCategory(""); }}
                  className="button-bordeaux"
                >
                  {translations.clearFilters}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Suspense Boundary for Client Component
const AnalysesCatalogPageWithSuspense: React.FC<{ params: { lang: string } | Promise<{ lang: string }> }> = ({params}) => {
  const resolvedParams = 'then' in params ? React.use(params) : params;

  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen bg-[var(--background-default)]">
        <div className="loading"></div>
        <span className="ml-2 text-[var(--text-secondary)]">Loading Catalog...</span>
      </div>
    }>
      <AnalysesCatalogPageContents params={resolvedParams} />
    </Suspense>
  );
};

export default AnalysesCatalogPageWithSuspense;