'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { getAllMedecins } from '@/services/medecinsService';
import type { Medecin, MedecinFilters } from '@/types/medecin';
const theme = require('@/styles/theme');

export default function MedecinsPage() {
  const { lang } = useParams();
  const { t } = useTranslation('common');

  const [allMedecins, setAllMedecins] = useState<Medecin[]>([]);
  const [loading, setLoading] = useState(true);

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
        console.error('Erreur lors du chargement des données:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Extraire les spécialités uniques (côté client, instantané)
  const specialites = useMemo(() => {
    const uniqueSpecialites = new Set(allMedecins.map(m => m.specialite).filter(Boolean));
    return Array.from(uniqueSpecialites).sort();
  }, [allMedecins]);

  // Extraire les communes uniques (côté client, instantané)
  const communes = useMemo(() => {
    const uniqueCommunes = new Set(allMedecins.map(m => m.commune).filter(Boolean));
    return Array.from(uniqueCommunes).sort();
  }, [allMedecins]);

  // Filtrer les médecins côté client (instantané, pas de requête Firebase)
  const filteredMedecins = useMemo(() => {
    let filtered = [...allMedecins];

    // Filtre par secteur
    if (filters.secteur && filters.secteur !== 'tous') {
      filtered = filtered.filter(m => m.secteur === filters.secteur);
    }

    // Filtre par spécialité
    if (filters.specialite) {
      filtered = filtered.filter(m =>
        m.specialite.toLowerCase() === filters.specialite!.toLowerCase()
      );
    }

    // Filtre par commune
    if (filters.commune) {
      filtered = filtered.filter(m =>
        m.commune.toLowerCase() === filters.commune!.toLowerCase()
      );
    }

    // Recherche textuelle (nom, prénom, spécialité, commune)
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const searchTerm = filters.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(m =>
        m.nom.toLowerCase().includes(searchTerm) ||
        m.prenom.toLowerCase().includes(searchTerm) ||
        m.specialite.toLowerCase().includes(searchTerm) ||
        m.commune.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  }, [allMedecins, filters]);

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

  return (
    <div style={{ minHeight: '100vh', background: theme.colors.gray[100], paddingTop: '80px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '15px' }}>

        {/* En-tête */}
        <div style={{ marginBottom: '20px', textAlign: 'center', padding: '0 10px' }}>
          <h1 style={{
            fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
            color: theme.colors.bordeaux.primary,
            marginBottom: '10px',
            fontWeight: 700
          }}>
            {lang === 'ar' ? 'دليل الأطباء' : 'Annuaire des Médecins'}
          </h1>
          <p style={{ fontSize: 'clamp(0.9rem, 3vw, 1.1rem)', color: theme.colors.gray[800] }}>
            {lang === 'ar'
              ? 'ابحث عن طبيب في أكادير والمنطقة'
              : 'Trouvez un médecin à Agadir et sa région'}
          </p>
        </div>

        {/* Filtres de recherche */}
        <div style={{
          background: 'white',
          padding: 'clamp(12px, 3vw, 25px)',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '15px'
          }}>

            {/* Recherche textuelle */}
            <input
              type="text"
              placeholder={lang === 'ar' ? 'البحث بالاسم أو التخصص...' : 'Rechercher par nom ou spécialité...'}
              value={filters.searchQuery || ''}
              onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
              style={{
                padding: '10px 12px',
                border: `1px solid ${theme.colors.gray[300]}`,
                borderRadius: '8px',
                fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />

            {/* Filtre secteur */}
            <select
              value={filters.secteur || 'tous'}
              onChange={(e) => handleFilterChange('secteur', e.target.value)}
              style={{
                padding: '10px 12px',
                border: `1px solid ${theme.colors.gray[300]}`,
                borderRadius: '8px',
                fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                background: 'white',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <option value="tous">{lang === 'ar' ? 'كل القطاعات' : 'Tous les secteurs'}</option>
              <option value="public">{lang === 'ar' ? 'عمومي' : 'Public'}</option>
              <option value="privé">{lang === 'ar' ? 'خاص' : 'Privé'}</option>
            </select>

            {/* Filtre spécialité */}
            <select
              value={filters.specialite || ''}
              onChange={(e) => handleFilterChange('specialite', e.target.value)}
              style={{
                padding: '10px 12px',
                border: `1px solid ${theme.colors.gray[300]}`,
                borderRadius: '8px',
                fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                background: 'white',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <option value="">{lang === 'ar' ? 'كل التخصصات' : 'Toutes les spécialités'}</option>
              {specialites.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>

            {/* Filtre commune */}
            <select
              value={filters.commune || ''}
              onChange={(e) => handleFilterChange('commune', e.target.value)}
              style={{
                padding: '10px 12px',
                border: `1px solid ${theme.colors.gray[300]}`,
                borderRadius: '8px',
                fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                background: 'white',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <option value="">{lang === 'ar' ? 'كل المدن' : 'Toutes les communes'}</option>
              {communes.map(commune => (
                <option key={commune} value={commune}>{commune}</option>
              ))}
            </select>
          </div>

          <button
            onClick={resetFilters}
            style={{
              padding: '10px 20px',
              background: theme.colors.bordeaux.light,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: 'clamp(0.875rem, 2.5vw, 0.95rem)',
              fontWeight: 600,
              width: '100%'
            }}
          >
            {lang === 'ar' ? 'إعادة تعيين' : 'Réinitialiser'}
          </button>
        </div>

        {/* Résultats */}
        <div style={{ marginBottom: '20px', padding: '0 5px' }}>
          <p style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)', color: theme.colors.gray[800] }}>
            {loading
              ? (lang === 'ar' ? 'جاري التحميل...' : 'Chargement...')
              : `${filteredMedecins.length} ${lang === 'ar' ? 'طبيب' : 'médecin(s) trouvé(s)'}`
            }
          </p>
        </div>

        {/* Liste des médecins */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 500px), 1fr))',
          gap: '15px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', gridColumn: '1 / -1' }}>
              <p>{lang === 'ar' ? 'جاري التحميل...' : 'Chargement...'}</p>
            </div>
          ) : filteredMedecins.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', gridColumn: '1 / -1' }}>
              <p style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)', color: theme.colors.gray[800] }}>
                {lang === 'ar'
                  ? 'لم يتم العثور على أطباء'
                  : 'Aucun médecin trouvé'}
              </p>
            </div>
          ) : (
            filteredMedecins.map(medecin => (
              <div
                key={medecin.id}
                style={{
                  background: 'white',
                  padding: 'clamp(12px, 3vw, 20px)',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  height: 'fit-content'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 auto', minWidth: '0' }}>
                    <h3 style={{
                      fontSize: 'clamp(1.1rem, 3.5vw, 1.3rem)',
                      color: theme.colors.bordeaux.primary,
                      marginBottom: '5px',
                      fontWeight: 700,
                      wordBreak: 'break-word'
                    }}>
                      Dr. {medecin.prenom} {medecin.nom}
                    </h3>
                    <p style={{
                      fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                      color: theme.colors.fuchsia.accent,
                      marginBottom: '0',
                      fontWeight: 600,
                      wordBreak: 'break-word'
                    }}>
                      {medecin.specialite}
                    </p>
                  </div>

                  <span style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    background: medecin.secteur === 'public' ? '#D1FAE5' : '#DBEAFE',
                    color: medecin.secteur === 'public' ? theme.colors.functional.success : theme.colors.functional.info,
                    borderRadius: '20px',
                    fontSize: 'clamp(0.75rem, 2vw, 0.85rem)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}>
                    {medecin.secteur === 'public'
                      ? (lang === 'ar' ? 'عمومي' : 'Public')
                      : (lang === 'ar' ? 'خاص' : 'Privé')
                    }
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {medecin.adresse && (
                    <p style={{
                      fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)',
                      color: theme.colors.gray[900],
                      margin: '0',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word'
                    }}>
                      📍 {medecin.adresse}
                    </p>
                  )}
                  <p style={{
                    fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)',
                    color: theme.colors.gray[800],
                    margin: '0',
                    wordBreak: 'break-word'
                  }}>
                    🏙️ {medecin.commune}, {medecin.province}
                  </p>
                  {medecin.tel_professionnel && (
                    <p style={{
                      fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)',
                      color: theme.colors.gray[900],
                      margin: '0'
                    }}>
                      📞 <a
                        href={`tel:${medecin.tel_professionnel}`}
                        style={{
                          color: theme.colors.bordeaux.primary,
                          textDecoration: 'none',
                          wordBreak: 'break-all'
                        }}
                      >
                        {medecin.tel_professionnel}
                      </a>
                    </p>
                  )}
                  {medecin.email && (
                    <p style={{
                      fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)',
                      color: theme.colors.gray[900],
                      margin: '0'
                    }}>
                      ✉️ <a
                        href={`mailto:${medecin.email}`}
                        style={{
                          color: theme.colors.bordeaux.primary,
                          textDecoration: 'none',
                          wordBreak: 'break-all',
                          overflowWrap: 'break-word'
                        }}
                      >
                        {medecin.email}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
