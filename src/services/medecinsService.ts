/**
 * Service pour gérer les médecins depuis Firestore
 */

import { collection, getDocs, query, where, orderBy, Query, DocumentData } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Medecin, MedecinFilters, MedecinSearchResult } from '@/types/medecin';

const MEDECINS_COLLECTION = 'medecins';

/**
 * Récupère tous les médecins depuis Firestore
 */
export async function getAllMedecins(): Promise<Medecin[]> {
  try {
    const medecinsRef = collection(db, MEDECINS_COLLECTION);
    const q = query(medecinsRef, orderBy('nom'), orderBy('prenom'));
    const querySnapshot = await getDocs(q);

    const medecins: Medecin[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      medecins.push({
        id: doc.id,
        nom: data.nom || '',
        prenom: data.prenom || '',
        specialite: data.specialite || '',
        secteur: data.secteur || 'public',
        gsm: data.gsm, // Stocké mais pas affiché
        tel_professionnel: data.tel_professionnel,
        adresse: data.adresse,
        commune: data.commune || '',
        province: data.province || '',
        email: data.email,
        updated_at: data.updated_at,
        source: data.source
      });
    });

    return medecins;
  } catch (error) {
    console.error('Erreur lors de la récupération des médecins:', error);
    throw error;
  }
}

/**
 * Recherche et filtre les médecins
 */
export async function searchMedecins(filters: MedecinFilters): Promise<MedecinSearchResult> {
  try {
    let allMedecins = await getAllMedecins();
    const totalCount = allMedecins.length;

    // Appliquer les filtres côté client pour plus de flexibilité
    let filteredMedecins = allMedecins;

    // Filtre par secteur
    if (filters.secteur && filters.secteur !== 'tous') {
      filteredMedecins = filteredMedecins.filter(m => m.secteur === filters.secteur);
    }

    // Filtre par spécialité
    if (filters.specialite) {
      filteredMedecins = filteredMedecins.filter(m =>
        m.specialite.toLowerCase() === filters.specialite!.toLowerCase()
      );
    }

    // Filtre par commune
    if (filters.commune) {
      filteredMedecins = filteredMedecins.filter(m =>
        m.commune.toLowerCase() === filters.commune!.toLowerCase()
      );
    }

    // Filtre par province
    if (filters.province) {
      filteredMedecins = filteredMedecins.filter(m =>
        m.province.toLowerCase() === filters.province!.toLowerCase()
      );
    }

    // Recherche textuelle (nom, prénom, spécialité, commune)
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const searchTerm = filters.searchQuery.toLowerCase().trim();
      filteredMedecins = filteredMedecins.filter(m =>
        m.nom.toLowerCase().includes(searchTerm) ||
        m.prenom.toLowerCase().includes(searchTerm) ||
        m.specialite.toLowerCase().includes(searchTerm) ||
        m.commune.toLowerCase().includes(searchTerm)
      );
    }

    return {
      medecins: filteredMedecins,
      totalCount,
      filteredCount: filteredMedecins.length
    };
  } catch (error) {
    console.error('Erreur lors de la recherche des médecins:', error);
    throw error;
  }
}

/**
 * Récupère la liste des spécialités uniques
 */
export async function getSpecialites(): Promise<string[]> {
  try {
    const medecins = await getAllMedecins();
    const specialites = new Set(medecins.map(m => m.specialite).filter(Boolean));
    return Array.from(specialites).sort();
  } catch (error) {
    console.error('Erreur lors de la récupération des spécialités:', error);
    return [];
  }
}

/**
 * Récupère la liste des communes uniques
 */
export async function getCommunes(): Promise<string[]> {
  try {
    const medecins = await getAllMedecins();
    const communes = new Set(medecins.map(m => m.commune).filter(Boolean));
    return Array.from(communes).sort();
  } catch (error) {
    console.error('Erreur lors de la récupération des communes:', error);
    return [];
  }
}

/**
 * Récupère la liste des provinces uniques
 */
export async function getProvinces(): Promise<string[]> {
  try {
    const medecins = await getAllMedecins();
    const provinces = new Set(medecins.map(m => m.province).filter(Boolean));
    return Array.from(provinces).sort();
  } catch (error) {
    console.error('Erreur lors de la récupération des provinces:', error);
    return [];
  }
}
