import type { CartItem } from '@/components/features/catalog/AnalysisCard';

/**
 * Types du parcours patient unifié (ordonnance → prélèvement).
 * Voir docs/pages/test-rdv.md.
 *
 * ⚠ Les valeurs de ces unions partent TELLES QUELLES vers Firestore et vers
 * /api/send-appointment. Elles ne doivent jamais être traduites côté client :
 * un patient arabophone enverrait sinon des libellés arabes dans la boîte mail
 * française du laboratoire (incident documenté sur `lieuPrelevement`, 04/09/2026).
 * La traduction en libellés lisibles se fait côté serveur, dans route.ts.
 */

/** D'où vient le patient : détermine l'identité affichée sur l'écran d'accueil. */
export type JourneyVariant = 'lab' | 'home' | 'neutral';

/** Réponse à « avez-vous une ordonnance ? ». `null` = pas encore répondu. */
export type PrescriptionAnswer = null | 'yes' | 'no';

/** Modes de transmission — CUMULABLES (photo + catalogue, par exemple). */
export type TransmissionMode = 'upload' | 'freetext' | 'catalog';
export type TransmissionState = Record<TransmissionMode, boolean>;

/** Lieu du prélèvement. `travail` et `domicile` sont tous deux un service à domicile. */
export type SamplingPlace = 'laboratoire' | 'domicile' | 'travail';

/** Canal par lequel le patient souhaite la réponse. Aucun envoi automatique. */
export type ReplyChannel = 'whatsapp' | 'email' | 'call' | 'sms';

/** Ce que le patient souhaite savoir. */
export type WantToKnowKey = 'prix' | 'delai' | 'jeune' | 'explication';
export type WantToKnow = Record<WantToKnowKey, boolean>;

export const TRANSMISSION_MODES: readonly TransmissionMode[] = ['upload', 'freetext', 'catalog'];
export const SAMPLING_PLACES: readonly SamplingPlace[] = ['laboratoire', 'domicile', 'travail'];
export const REPLY_CHANNELS: readonly ReplyChannel[] = ['whatsapp', 'email', 'call', 'sms'];
export const WANT_TO_KNOW_KEYS: readonly WantToKnowKey[] = ['prix', 'delai', 'jeune', 'explication'];

/** Frais de prélèvement, identiques à ceux du catalogue (src/app/[lang]/analyses/page.tsx). */
export const SAMPLING_FEE = 20;

/** Longueur maximale du texte libre (protège la base et l'e-mail). */
export const FREETEXT_MAX = 1500;

/**
 * Brouillon sauvegardé en sessionStorage pour survivre à l'aller-retour vers
 * /login ou /analyses. Les objets `File` ne sont PAS sérialisables : seules les
 * URL déjà téléversées survivent.
 */
export interface JourneyDraft {
  v: 1;
  savedAt: number;
  variant: JourneyVariant;
  hasPrescription: PrescriptionAnswer;
  transmission: TransmissionState;
  freeText: string;
  wantToKnow: WantToKnow;
  samplingPlace: SamplingPlace;
  adresse: string;
  instructionsAcces: string;
  dateISO: string | null;
  time: string;
  replyChannel: ReplyChannel;
  nom: string;
  telephone: string;
  email: string;
  uploadedUrls: string[];
}

/** Durée de vie du brouillon : 2 h. Au-delà, on repart d'un formulaire vierge. */
export const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;
export const DRAFT_STORAGE_KEY = 'laboElAllali_journeyDraft_v1';

/** Une ligne d'analyse dénormalisée, telle qu'envoyée au labo (base + e-mail). */
export interface JourneyCartLine {
  code: string;
  name: string;
  nameAr: string;
  price: number;
  type: 'analyse' | 'bilan';
}

export interface JourneyCartTotals {
  uniqueAnalysesCount: number;
  itemsTotal: number;
  samplingFee: number;
  total: number;
}

export interface JourneyPreparation {
  maxJeune: number;
  maxDRR: number;
  sampleTypes: string[];
  /** Consignes destinées au PATIENT (`Pre_Analytique_FR`). */
  patientPreparation: string[];
  /**
   * Fiche technique destinée au PRÉLEVEUR (`CPA_Instructions`) : tubes,
   * centrifugation, congélation. Utile au laboratoire, JAMAIS montrée au
   * patient (elle n'existe même pas en arabe). Voir `usePreparationRules`.
   */
  technicalInstructions: string[];
}

/** Tout ce que le formulaire produit, avant transformation en document / e-mail / message. */
export interface JourneyFormSnapshot {
  variant: JourneyVariant;
  lang: string;
  uid: string;
  nom: string;
  telephone: string;
  email: string;
  hasPrescription: PrescriptionAnswer;
  transmission: TransmissionState;
  freeText: string;
  cartItems: CartItem[];
  cartLines: JourneyCartLine[];
  cartTotals: JourneyCartTotals | null;
  preparation: JourneyPreparation | null;
  wantToKnow: WantToKnow;
  samplingPlace: SamplingPlace;
  adresse: string;
  instructionsAcces: string;
  desiredDate: string;
  desiredTime: string;
  replyChannel: ReplyChannel;
  needsHumanAnswer: boolean;
  ordonnanceUrls: string[];
}
