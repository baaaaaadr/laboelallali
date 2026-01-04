/**
 * Interface TypeScript pour les médecins
 */

export interface Medecin {
  id: string;
  nom: string;
  prenom: string;
  specialite: string;
  secteur: 'public' | 'privé';
  gsm?: string; // Privé - pas affiché publiquement
  tel_professionnel?: string;
  adresse?: string;
  commune: string;
  province: string;
  email?: string;
  updated_at?: string;
  source?: string;
}

export interface MedecinFilters {
  specialite?: string;
  commune?: string;
  province?: string;
  secteur?: 'public' | 'privé' | 'tous';
  searchQuery?: string;
}

export interface MedecinSearchResult {
  medecins: Medecin[];
  totalCount: number;
  filteredCount: number;
}
