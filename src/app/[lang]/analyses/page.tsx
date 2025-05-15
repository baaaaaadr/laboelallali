"use client";

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/config/firebase";
import AnalysisCard, { Analysis } from "@/components/features/catalog/AnalysisCard";


export default function AnalysesCatalogPage({
  params
}: {
  params: { lang: string } | Promise<{ lang: string }>
}) {
  // Unwrap params using React.use() to prevent hydration errors
  const resolvedParams = 'then' in params ? React.use(params) : params;
  const lang = resolvedParams.lang;
  
  // Manual translations based on language
  const translations = {
    title: lang === "ar" ? "دليل التحاليل" : "Catalogue des Analyses",
    searchLabel: lang === "ar" ? "البحث عن تحليل" : "Rechercher une analyse",
    searchPlaceholder: lang === "ar" ? "اكتب اسم التحليل..." : "Tapez le nom d'une analyse...",
    categoryLabel: lang === "ar" ? "التصنيف" : "Catégorie",
    allCategories: lang === "ar" ? "جميع التصنيفات" : "Toutes les catégories",
    noResults: lang === "ar" ? "لا توجد نتائج مطابقة لمعايير البحث." : "Aucun résultat trouvé pour ces critères de recherche.",
    clearFilters: lang === "ar" ? "مسح عوامل التصفية" : "Effacer les filtres",
    noAnalyses: lang === "ar" ? "لا توجد تحاليل متاحة حاليًا." : "Aucune analyse disponible pour le moment.",
    loading: lang === "ar" ? "جاري التحميل..." : "Chargement en cours...",
    errorFetching: lang === "ar" ? "فشل في تحميل التحاليل" : "Échec du chargement des analyses"
  };
  
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>(""); // Empty string means "All Categories"

  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        setLoading(true);
        
        // Create a query to get all active analyses
        const analysesCollection = collection(db, "analysisCatalog");
        const analysesQuery = query(
          analysesCollection,
          where("is_active", "==", true),
          orderBy(lang === "ar" ? "name_ar" : "name_fr")
        );

        const querySnapshot = await getDocs(analysesQuery);
        const fetchedAnalyses: Analysis[] = [];

        querySnapshot.forEach((doc) => {
          fetchedAnalyses.push({
            id: doc.id,
            ...(doc.data() as Omit<Analysis, "id">)
          });
        });

        setAnalyses(fetchedAnalyses);
        setError(null);
      } catch (err) {
        console.error("Error fetching analyses:", err);
        setError(`Failed to fetch analyses: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    // Wrap in try/catch to prevent unhandled errors during Firebase initialization
    try {
      fetchAnalyses();
    } catch (initError) {
      console.error("Firebase initialization error:", initError);
      setError(`Firebase initialization error: ${initError instanceof Error ? initError.message : String(initError)}`);
      setLoading(false);
    }
  }, [lang]); // Re-fetch when language changes

  // Set direction based on language
  const dir = lang === "ar" ? "rtl" : "ltr";
  
  // Extract unique categories from analyses
  const categories = useMemo(() => {
    const categoryField = lang === "ar" ? "category_ar" : "category_fr";
    const uniqueCategories = new Set<string>();
    
    analyses.forEach((analysis) => {
      const category = analysis[categoryField as keyof Analysis] as string;
      if (category && category.trim()) {
        uniqueCategories.add(category.trim());
      }
    });
    
    return Array.from(uniqueCategories).sort();
  }, [analyses, lang]);
  
  // Filter analyses based on search term and selected category
  const filteredAnalyses = useMemo(() => {
    if (!searchTerm && !selectedCategory) {
      return analyses; // No filters applied
    }
    
    return analyses.filter((analysis) => {
      const nameField = lang === "ar" ? "name_ar" : "name_fr";
      const categoryField = lang === "ar" ? "category_ar" : "category_fr";
      
      // Check name matches search term (case insensitive)
      const nameMatches = !searchTerm || 
        (analysis[nameField as keyof Analysis] as string)
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      
      // Check category matches selected category (if any)
      const categoryMatches = !selectedCategory || 
        (analysis[categoryField as keyof Analysis] as string) === selectedCategory;
      
      return nameMatches && categoryMatches;
    });
  }, [analyses, searchTerm, selectedCategory, lang]);

  return (
    <div className="container mx-auto px-4 py-8" dir={dir}>
      <h1 className="text-3xl font-bold text-[#800020] mb-6">
        {translations.title}
      </h1>
      
      {/* Search and Filter UI */}
      {!loading && analyses.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search input */}
            <div className="flex-1">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                {translations.searchLabel}
              </label>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={translations.searchPlaceholder}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--accent-fuchsia)] focus:border-transparent"
              />
            </div>
            
            {/* Category filter */}
            <div className="md:w-1/3">
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                {translations.categoryLabel}
              </label>
              <select
                id="category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--accent-fuchsia)] focus:border-transparent"
              >
                <option value="">
                  {translations.allCategories}
                </option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF4081]"></div>
          <span className="ml-3 text-gray-600">{translations.loading}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {translations.errorFetching}: {error}
        </div>
      )}

      {!loading && !error && analyses.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-600">
            {translations.noAnalyses}
          </p>
        </div>
      )}

      {!loading && analyses.length > 0 && (
        <>
          {filteredAnalyses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAnalyses.map((analysis) => (
                <AnalysisCard 
                  key={analysis.id} 
                  analysis={analysis} 
                  lang={lang} 
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600">
                {translations.noResults}
              </p>
              <button 
                onClick={() => { setSearchTerm(""); setSelectedCategory(""); }}
                className="mt-3 px-4 py-2 bg-[var(--primary-bordeaux)] text-white rounded-md hover:bg-[color:var(--primary-bordeaux-dark)] transition-colors duration-200"
              >
                {translations.clearFilters}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
