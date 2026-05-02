'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { getAllMedecins } from '@/services/medecinsService';
import type { Medecin, MedecinFilters } from '@/types/medecin';
import MedecinCard from '@/components/features/medecins/MedecinCard';
import { Search, Filter, RotateCcw } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import MedicalLoader from "@/components/ui/MedicalLoader";

const ITEMS_PER_PAGE = 24;

export default function MedecinsPage() {
  const { lang } = useParams();
  const urlLang = typeof lang === 'string' ? lang : 'fr';

  const [allMedecins, setAllMedecins] = useState<Medecin[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Filtres
  const [filters, setFilters] = useState<MedecinFilters>({
    secteur: 'tous',
    specialite: '',
    commune: '',
    searchQuery: ''
  });

  // Charger TOUTES les données UNE SEULE FOIS au montage
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const medecinsData = await getAllMedecins();
        setAllMedecins(medecinsData);
      } catch (error) {
        console.error('Erreur lors du chargement des médecins:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Extraire les spécialités uniques
  const specialites = useMemo(() => {
    const uniqueSpecialites = new Set<string>();
    allMedecins.forEach((m) => {
      if (m?.specialite) {
        const spec = String(m.specialite).trim();
        if (spec) uniqueSpecialites.add(spec);
      }
    });
    return Array.from(uniqueSpecialites).sort();
  }, [allMedecins]);

  // Extraire les communes uniques
  const communes = useMemo(() => {
    const uniqueCommunes = new Set<string>();
    allMedecins.forEach((m) => {
      if (m?.commune) {
        const comm = String(m.commune).trim();
        if (comm) uniqueCommunes.add(comm);
      }
    });
    return Array.from(uniqueCommunes).sort();
  }, [allMedecins]);

  // Filtrer les médecins côté client
  const filteredMedecins = useMemo(() => {
    let filtered = allMedecins.slice();

    if (filters.secteur && filters.secteur !== 'tous') {
      filtered = filtered.filter(m => m?.secteur === filters.secteur);
    }

    if (filters.specialite) {
      filtered = filtered.filter(m =>
        m?.specialite && String(m.specialite).toLowerCase() === filters.specialite!.toLowerCase()
      );
    }

    if (filters.commune) {
      filtered = filtered.filter(m =>
        m?.commune && String(m.commune).toLowerCase() === filters.commune!.toLowerCase()
      );
    }

    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const searchTerm = filters.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(m => {
        if (!m) return false;
        const nom = m.nom ? String(m.nom).toLowerCase() : '';
        const prenom = m.prenom ? String(m.prenom).toLowerCase() : '';
        const specialite = m.specialite ? String(m.specialite).toLowerCase() : '';
        const commune = m.commune ? String(m.commune).toLowerCase() : '';
        return nom.includes(searchTerm) ||
          prenom.includes(searchTerm) ||
          specialite.includes(searchTerm) ||
          commune.includes(searchTerm);
      });
    }

    return filtered;
  }, [allMedecins, filters]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [filters]);

  const displayedMedecins = useMemo(() => {
    return filteredMedecins.slice(0, visibleCount);
  }, [filteredMedecins, visibleCount]);

  const handleFilterChange = (key: keyof MedecinFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      secteur: 'tous',
      specialite: '',
      commune: '',
      searchQuery: ''
    });
  };

  const loadMore = () => {
    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  };

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });

  useEffect(() => {
    if (inView && !loading && filteredMedecins.length > visibleCount) {
      loadMore();
    }
  }, [inView, loading, filteredMedecins.length, visibleCount]);

  return (
    <div className="min-h-screen bg-[var(--background-secondary)] pt-[80px] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* En-tête */}
        <div className="mb-8 text-center px-4">
          <h1 className="text-[var(--color-bordeaux-primary)] text-3xl sm:text-4xl md:text-5xl font-bold mb-3 transition-colors">
            {urlLang === 'ar' ? 'دليل الأطباء' : 'Annuaire des Médecins'}
          </h1>
          <p className="text-[var(--text-secondary)] text-base sm:text-lg transition-colors">
            {urlLang === 'ar'
              ? 'ابحث عن طبيب في أكادير والمنطقة'
              : 'Trouvez un médecin à Agadir et sa région'}
          </p>
        </div>

        {/* Filtres de recherche */}
        <div className="bg-[var(--background-card)] p-5 sm:p-8 rounded-2xl shadow-sm border border-[var(--border-default)] mb-8 transition-all">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

            {/* Recherche textuelle */}
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder={urlLang === 'ar' ? 'البحث بالاسم أو التخصص...' : 'Rechercher par nom ou spécialité...'}
                value={filters.searchQuery || ''}
                onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[var(--background-default)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] outline-none transition-all text-sm sm:text-base"
              />
            </div>

            {/* Filtre secteur */}
            <div className="relative">
              <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <select
                value={filters.secteur || 'tous'}
                onChange={(e) => handleFilterChange('secteur', e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[var(--background-default)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] outline-none transition-all text-sm sm:text-base appearance-none cursor-pointer"
              >
                <option value="tous">{urlLang === 'ar' ? 'كل القطاعات' : 'Tous les secteurs'}</option>
                <option value="public">{urlLang === 'ar' ? 'عمومي' : 'Public'}</option>
                <option value="privé">{urlLang === 'ar' ? 'خاص' : 'Privé'}</option>
              </select>
            </div>

            {/* Filtre spécialité */}
            <div className="relative">
              <select
                value={filters.specialite || ''}
                onChange={(e) => handleFilterChange('specialite', e.target.value)}
                className="w-full px-4 py-3 bg-[var(--background-default)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] outline-none transition-all text-sm sm:text-base cursor-pointer"
              >
                <option value="">{urlLang === 'ar' ? 'كل التخصصات' : 'Toutes les spécialités'}</option>
                {specialites.map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>

            {/* Filtre commune */}
            <div className="relative">
              <select
                value={filters.commune || ''}
                onChange={(e) => handleFilterChange('commune', e.target.value)}
                className="w-full px-4 py-3 bg-[var(--background-default)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] outline-none transition-all text-sm sm:text-base cursor-pointer"
              >
                <option value="">{urlLang === 'ar' ? 'كل المدن' : 'Toutes les communes'}</option>
                {communes.map(commune => (
                  <option key={commune} value={commune}>{commune}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={resetFilters}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-bordeaux-primary)] hover:bg-[var(--color-bordeaux-dark)] text-white rounded-xl transition-all font-bold shadow-sm"
          >
            <RotateCcw size={18} />
            {urlLang === 'ar' ? 'إعادة تعيين' : 'Réinitialiser les filtres'}
          </button>
        </div>

        {/* Résultats Count */}
        <div className="mb-6 px-2">
          <p className="text-[var(--text-secondary)] font-medium transition-colors">
            {loading
              ? (urlLang === 'ar' ? 'جاري التحميل...' : 'Chargement...')
              : `${filteredMedecins.length} ${urlLang === 'ar' ? 'طبيب' : 'médecin(s) trouvé(s)'}`
            }
          </p>
        </div>

        {/* Liste des médecins */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full">
              <MedicalLoader 
                label={urlLang === 'ar' ? 'جاري تحميل البيانات...' : 'Chargement des données...'} 
              />
            </div>
          ) : displayedMedecins.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-[var(--background-card)] rounded-2xl border border-[var(--border-default)]">
              <p className="text-[var(--text-secondary)] text-lg">
                {urlLang === 'ar'
                  ? 'لم يتم العثور على أطباء'
                  : 'Aucun médecin trouvé pour ces critères.'}
              </p>
            </div>
          ) : (
            displayedMedecins.map(medecin => (
              <MedecinCard 
                key={medecin.id} 
                medecin={medecin} 
                lang={urlLang} 
              />
            ))
          )}
        </div>

        {/* Infinite Scroll Trigger */}
        {!loading && filteredMedecins.length > visibleCount && (
          <div ref={ref} className="mt-12 flex flex-col items-center justify-center gap-4 py-8">
            <MedicalLoader size="sm" />
            <p className="text-sm text-[var(--text-tertiary)] transition-colors">
              {urlLang === 'ar' ? 'جاري تحميل المزيد...' : 'Chargement de plus de médecins...'}
            </p>
          </div>
        )}

        {!loading && filteredMedecins.length > 0 && filteredMedecins.length <= visibleCount && (
          <div className="mt-12 text-center py-8 opacity-50">
            <p className="text-sm text-[var(--text-tertiary)]">
              {urlLang === 'ar' ? 'نهاية القائمة' : 'Fin de la liste'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
