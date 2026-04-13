'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { getAllMedecins } from '@/services/medecinsService';
import type { Medecin, MedecinFilters } from '@/types/medecin';
import theme from '@/styles/theme';

export default function MedecinsPage() {
  const { lang } = useParams();

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
        console.error('Erreur lors du chargement des médecins:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Extraire les spécialités uniques (côté client, instantané)
  const specialites = useMemo(() => {
    const uniqueSpecialites = new Set<string>();
    allMedecins.forEach((m) => {
      if (m?.specialite) {
        const spec = String(m.specialite).trim();
        if (spec) {
          uniqueSpecialites.add(spec);
        }
      }
    });
    return Array.from(uniqueSpecialites).sort();
  }, [allMedecins]);

  // Extraire les communes uniques (côté client, instantané)
  const communes = useMemo(() => {
    const uniqueCommunes = new Set<string>();
    allMedecins.forEach((m) => {
      if (m?.commune) {
        const comm = String(m.commune).trim();
        if (comm) {
          uniqueCommunes.add(comm);
        }
      }
    });
    return Array.from(uniqueCommunes).sort();
  }, [allMedecins]);

  // Filtrer les médecins côté client (instantané, pas de requête Firebase)
  const filteredMedecins = useMemo(() => {
    let filtered = allMedecins.slice();

    // Filtre par secteur
    if (filters.secteur && filters.secteur !== 'tous') {
      filtered = filtered.filter(m => m?.secteur === filters.secteur);
    }

    // Filtre par spécialité
    if (filters.specialite) {
      filtered = filtered.filter(m =>
        m?.specialite && String(m.specialite).toLowerCase() === filters.specialite!.toLowerCase()
      );
    }

    // Filtre par commune
    if (filters.commune) {
      filtered = filtered.filter(m =>
        m?.commune && String(m.commune).toLowerCase() === filters.commune!.toLowerCase()
      );
    }

    // Recherche textuelle (nom, prénom, spécialité, commune)
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
    <div className="min-h-screen" style={{ background: 'var(--background-secondary)', paddingTop: '80px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '15px' }}>

        {/* En-tête */}
        <div style={{ marginBottom: '20px', textAlign: 'center', padding: '0 10px' }}>
          <h1 className="text-[var(--color-bordeaux-primary)]" style={{
            fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
            marginBottom: '10px',
            fontWeight: 700
          }}>
            {lang === 'ar' ? 'دليل الأطباء' : 'Annuaire des Médecins'}
          </h1>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: 'clamp(0.9rem, 3vw, 1.1rem)' }}>
            {lang === 'ar'
              ? 'ابحث عن طبيب في أكادير والمنطقة'
              : 'Trouvez un médecin à Agadir et sa région'}
          </p>
        </div>

        {/* Filtres de recherche */}
        <div style={{
          background: 'var(--background-card)',
          padding: 'clamp(12px, 3vw, 25px)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '20px',
          border: '1px solid var(--border-default)'
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
                background: 'var(--background-default)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                padding: '10px 12px',
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
                background: 'var(--background-default)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
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
                background: 'var(--background-default)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
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
                background: 'var(--background-default)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
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
              background: 'var(--color-bordeaux-primary)',
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
          <p className="text-[var(--text-secondary)]" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)' }}>
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
              <p className="text-[var(--text-secondary)]" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)' }}>
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
                  background: 'var(--background-card)',
                  padding: 'clamp(12px, 3vw, 20px)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  height: 'fit-content',
                  border: '1px solid var(--border-default)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 auto', minWidth: '0' }}>
                    <h3 style={{
                      fontSize: 'clamp(1.1rem, 3.5vw, 1.3rem)',
                      color: 'var(--color-fuchsia-accent)',
                      marginBottom: '5px',
                      fontWeight: 700,
                      wordBreak: 'break-word'
                    }}>
                      Dr. {medecin.prenom} {medecin.nom}
                    </h3>
                    <p style={{
                      fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                      color: 'var(--color-bordeaux-primary)',
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
                    background: medecin.secteur === 'public'
                      ? 'color-mix(in srgb, var(--status-success) 20%, var(--background-default))'
                      : 'color-mix(in srgb, var(--status-info) 20%, var(--background-default))',
                    color: medecin.secteur === 'public' ? 'var(--status-success)' : 'var(--status-info)',
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
                    <p className="text-[var(--text-primary)]" style={{
                      fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)',
                      margin: '0',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word'
                    }}>
                      📍 {medecin.adresse}
                    </p>
                  )}
                  <p className="text-[var(--text-secondary)]" style={{
                    fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)',
                    margin: '0',
                    wordBreak: 'break-word'
                  }}>
                    🏙️ {medecin.commune}, {medecin.province}
                  </p>
                  {medecin.tel_professionnel && (
                    <p className="text-[var(--text-primary)]" style={{
                      fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)',
                      margin: '0'
                    }}>
                      📞 <a
                        href={`tel:${medecin.tel_professionnel}`}
                        style={{
                          color: 'var(--color-bordeaux-primary)',
                          textDecoration: 'none',
                          wordBreak: 'break-all'
                        }}
                      >
                        {medecin.tel_professionnel}
                      </a>
                    </p>
                  )}
                  {medecin.email && (
                    <p className="text-[var(--text-primary)]" style={{
                      fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)',
                      margin: '0'
                    }}>
                      ✉️ <a
                        href={`mailto:${medecin.email}`}
                        style={{
                          color: 'var(--color-bordeaux-primary)',
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
