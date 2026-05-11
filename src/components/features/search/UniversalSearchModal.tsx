"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { getAllMedecins } from '@/services/medecinsService';
import type { AnalyseItem, BilanItem } from '@/components/features/catalog/AnalysisCard';
import type { Medecin } from '@/types/medecin';
import { getIconComponent, getCategoryIcon } from '@/utils/iconMapper';
import { Search, X, Stethoscope } from 'lucide-react';
import MedicalLoader from '@/components/ui/MedicalLoader';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: string;
}

type ResultType = 'bilan' | 'analyse' | 'medecin';
interface FlatResult {
  type: ResultType;
  id: string;
}

function scoreMatch(primaryField: string, otherFields: string[], term: string): number {
  const t = term.toLowerCase();
  if (primaryField.toLowerCase().startsWith(t)) return 3;
  if (primaryField.toLowerCase().includes(t)) return 2;
  if (otherFields.some(f => f?.toLowerCase().includes(t))) return 1;
  return 0;
}

export default function UniversalSearchModal({ isOpen, onClose, lang }: Props) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const isArabic = lang === 'ar';

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const [analyses, setAnalyses] = useState<AnalyseItem[]>([]);
  const [bilans, setBilans] = useState<BilanItem[]>([]);
  const [medecins, setMedecins] = useState<Medecin[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const hasFetchedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Fetch all data once on first open
  useEffect(() => {
    if (!isOpen || hasFetchedRef.current) return;
    if (!db) return;
    hasFetchedRef.current = true;
    setIsLoading(true);
    Promise.all([
      getDocs(collection(db, 'analyses')),
      getDocs(collection(db, 'bilans')),
      getAllMedecins(),
    ]).then(([analysesSnap, bilansSnap, medecinsData]) => {
      setAnalyses(
        analysesSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as AnalyseItem))
          .filter(a => a.Nom_Patient_FR !== 'Nom_Patient_FR')
      );
      setBilans(
        bilansSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as BilanItem))
          .filter(b => b.Nom_Bilan_FR !== 'Nom_Bilan_FR')
      );
      setMedecins(medecinsData);
    }).catch(err => {
      console.error('[UniversalSearch] fetch error', err);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [isOpen]);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Scroll lock
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Auto-focus input
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      setQuery('');
      setActiveIndex(-1);
    }
  }, [isOpen]);

  // Filtered + scored results
  const results = useMemo(() => {
    const term = debouncedQuery.trim();
    if (!term) return { bilans: [], analyses: [], medecins: [], total: 0 };

    const scoredBilans = bilans
      .map(b => ({
        item: b,
        score: scoreMatch(
          isArabic ? b.Nom_Bilan_AR : b.Nom_Bilan_FR,
          [b.Nom_Bilan_FR, b.Nom_Bilan_AR, b.Description_FR, b.Description_AR, b.Categorie],
          term
        ),
      }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(x => x.item);

    const scoredAnalyses = analyses
      .map(a => ({
        item: a,
        score: scoreMatch(
          isArabic ? a.Nom_Patient_AR : a.Nom_Patient_FR,
          [
            a.Nom_Patient_FR, a.Nom_Patient_AR,
            a.Categorie_FR, a.Categorie_AR,
            ...(a.Tags_FR ?? []), ...(a.Tags_AR ?? []),
            a.Description_Patient_FR ?? '', a.Description_Patient_AR ?? '',
          ],
          term
        ),
      }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(x => x.item);

    const scoredMedecins = medecins
      .map(m => ({
        item: m,
        score: scoreMatch(
          `${m.prenom} ${m.nom}`,
          [m.nom, m.prenom, `${m.nom} ${m.prenom}`, m.specialite, m.commune],
          term
        ),
      }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(x => x.item);

    return {
      bilans: scoredBilans,
      analyses: scoredAnalyses,
      medecins: scoredMedecins,
      total: scoredBilans.length + scoredAnalyses.length + scoredMedecins.length,
    };
  }, [debouncedQuery, bilans, analyses, medecins, isArabic]);

  // Flat result list for keyboard navigation
  const allResults: FlatResult[] = useMemo(() => [
    ...results.bilans.map(b => ({ type: 'bilan' as const, id: b.id })),
    ...results.analyses.map(a => ({ type: 'analyse' as const, id: a.id })),
    ...results.medecins.map(m => ({ type: 'medecin' as const, id: m.id })),
  ], [results]);

  const handleResultClick = useCallback((type: ResultType, searchQuery?: string) => {
    onClose();
    if (type === 'medecin' && searchQuery) {
      router.push(`/${lang}/medecins?q=${encodeURIComponent(searchQuery)}`);
    } else {
      router.push(`/${lang}/analyses`);
    }
  }, [onClose, router, lang]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => {
          const next = Math.min(i + 1, allResults.length - 1);
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => {
          const next = Math.max(i - 1, -1);
          if (next === -1) inputRef.current?.focus();
          else itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      }
      if (e.key === 'Enter' && activeIndex >= 0) {
        const item = allResults[activeIndex];
        if (item) {
          if (item.type === 'medecin') {
            const m = results.medecins.find(x => x.id === item.id);
            handleResultClick('medecin', m ? `${m.prenom} ${m.nom}` : undefined);
          } else {
            handleResultClick(item.type);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, allResults, onClose, handleResultClick]);

  if (!isOpen) return null;

  const hasResults = results.total > 0;
  const hasQuery = debouncedQuery.trim().length > 0;

  let flatIndex = -1;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col items-center pt-16 sm:pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-2xl bg-[var(--background-card)] rounded-xl shadow-2xl border border-[var(--border-default)] flex flex-col overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 8rem)' }}
        role="dialog"
        aria-modal="true"
        aria-label={t('search.modal_label')}
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border-default)] flex-shrink-0">
          <Search size={20} className="text-[var(--text-tertiary)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(-1); }}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-base outline-none"
            dir={isArabic ? 'rtl' : 'ltr'}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setActiveIndex(-1); inputRef.current?.focus(); }}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
              aria-label="Effacer"
            >
              <X size={16} />
            </button>
          )}
          <div className="w-px h-5 bg-[var(--border-default)] flex-shrink-0" aria-hidden="true" />
          <button
            onClick={onClose}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0 p-1 rounded-md hover:bg-[var(--background-secondary)]"
            aria-label="Fermer la recherche"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <MedicalLoader size="sm" />
              <p className="text-sm text-[var(--text-secondary)]">{t('search.loading')}</p>
            </div>
          )}

          {/* Hint — no query yet */}
          {!isLoading && !hasQuery && (
            <div className="py-14 text-center">
              <Search size={36} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm text-[var(--text-secondary)]">{t('search.hint')}</p>
            </div>
          )}

          {/* No results */}
          {!isLoading && hasQuery && !hasResults && (
            <div className="py-14 text-center px-4">
              <p className="font-semibold text-[var(--text-primary)]">{t('search.no_results')}</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1 break-all">"{debouncedQuery}"</p>
            </div>
          )}

          {/* Results */}
          {!isLoading && hasResults && (
            <ul role="listbox">
              {/* Bilans section */}
              {results.bilans.length > 0 && (
                <>
                  <li className="px-4 pt-4 pb-1.5">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-tertiary)]">
                      {t('search.section_bilans')}
                    </span>
                  </li>
                  {results.bilans.map(bilan => {
                    flatIndex++;
                    const idx = flatIndex;
                    const isActive = activeIndex === idx;
                    const Icon = getIconComponent(bilan.Icone);
                    const name = isArabic ? bilan.Nom_Bilan_AR : bilan.Nom_Bilan_FR;
                    return (
                      <li key={`bilan-${bilan.id}`} role="option" aria-selected={isActive}>
                        <button
                          ref={el => { itemRefs.current[idx] = el; }}
                          onClick={() => handleResultClick('bilan')}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? 'ring-1 ring-inset ring-[var(--color-bordeaux-primary)]' : ''}`}
                          style={{ backgroundColor: isActive ? 'var(--color-bordeaux-pale)' : 'transparent' }}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: 'rgba(128,0,32,0.12)' }}
                          >
                            <Icon size={18} style={{ color: 'var(--color-bordeaux-primary)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{name}</p>
                            <p className="text-xs text-[var(--text-secondary)] truncate">{bilan.Categorie}</p>
                          </div>
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--color-bordeaux-primary)' }}>
                            {bilan.Prix_Affiche_Dhs} MAD
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </>
              )}

              {/* Analyses section */}
              {results.analyses.length > 0 && (
                <>
                  <li className="px-4 pt-4 pb-1.5">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-tertiary)]">
                      {t('search.section_analyses')}
                    </span>
                  </li>
                  {results.analyses.map(analyse => {
                    flatIndex++;
                    const idx = flatIndex;
                    const isActive = activeIndex === idx;
                    const Icon = getCategoryIcon(analyse.Categorie_FR);
                    const name = isArabic ? analyse.Nom_Patient_AR : analyse.Nom_Patient_FR;
                    const category = isArabic ? analyse.Categorie_AR : analyse.Categorie_FR;
                    return (
                      <li key={`analyse-${analyse.id}`} role="option" aria-selected={isActive}>
                        <button
                          ref={el => { itemRefs.current[idx] = el; }}
                          onClick={() => handleResultClick('analyse')}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? 'ring-1 ring-inset ring-[var(--color-bordeaux-primary)]' : ''}`}
                          style={{ backgroundColor: isActive ? 'var(--color-bordeaux-pale)' : 'transparent' }}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: 'rgba(255,64,129,0.1)' }}
                          >
                            <Icon size={18} style={{ color: 'var(--color-fuchsia-accent)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{name}</p>
                            <p className="text-xs text-[var(--text-secondary)] truncate">{category}</p>
                          </div>
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--color-bordeaux-primary)' }}>
                            {analyse.Prix_Dhs} MAD
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </>
              )}

              {/* Médecins section */}
              {results.medecins.length > 0 && (
                <>
                  <li className="px-4 pt-4 pb-1.5">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-tertiary)]">
                      {t('search.section_medecins')}
                    </span>
                  </li>
                  {results.medecins.map(medecin => {
                    flatIndex++;
                    const idx = flatIndex;
                    const isActive = activeIndex === idx;
                    const isPublic = medecin.secteur === 'public';
                    return (
                      <li key={`medecin-${medecin.id}`} role="option" aria-selected={isActive}>
                        <button
                          ref={el => { itemRefs.current[idx] = el; }}
                          onClick={() => handleResultClick('medecin', `${medecin.prenom} ${medecin.nom}`)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? 'ring-1 ring-inset ring-[var(--color-bordeaux-primary)]' : ''}`}
                          style={{ backgroundColor: isActive ? 'var(--color-bordeaux-pale)' : 'transparent' }}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: 'rgba(255,64,129,0.1)' }}
                          >
                            <Stethoscope size={18} style={{ color: 'var(--color-fuchsia-accent)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                              Dr. {medecin.prenom} {medecin.nom}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)] truncate">
                              {medecin.specialite}{medecin.commune ? ` · ${medecin.commune}` : ''}
                            </p>
                          </div>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: isPublic ? 'rgba(5,150,105,0.12)' : 'rgba(128,0,32,0.1)',
                              color: isPublic ? '#059669' : 'var(--color-bordeaux-primary)',
                            }}
                          >
                            {isPublic ? 'Public' : 'Privé'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </>
              )}

              <li className="h-3" aria-hidden="true" />
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
