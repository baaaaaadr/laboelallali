/**
 * La MATRICE de cas du parcours patient — partagée par toutes les vérifications.
 *
 * Un seul jeu de cas alimente les trois sorties d'une demande :
 *  - le document `appointmentRequests` (`buildFirestoreDoc`) ;
 *  - l'e-mail du laboratoire (`buildAppointmentEmail`) ;
 *  - le message WhatsApp pré-rempli (`buildWhatsAppMessage`).
 *
 * C'est délibéré : ces trois-là ont déjà divergé (l'ordre du nom différait
 * entre l'e-mail et WhatsApp, l'adresse n'atteignait que WhatsApp). Les faire
 * partir du MÊME instantané est ce qui rend la divergence détectable.
 *
 * Les deux premiers cas sont les DEUX CAS LES PLUS FRÉQUENTS d'après le
 * laboratoire (09/09/2026) : ordonnance en main, et pas d'ordonnance. Ils
 * ouvrent la liste parce que ce sont eux que la mise en page groupée
 * (`/test-rdv2`) est censée servir en priorité.
 *
 * Aucune dépendance React : ce fichier est compilé par esbuild et exécuté sous
 * Node par les scripts `test-*.js` voisins.
 */
import type {
  JourneyCartLine,
  JourneyCartTotals,
  JourneyFormSnapshot,
  JourneyPreparation,
} from '../src/lib/journey/types';
import { buildEmailPayload, buildFirestoreDoc } from '../src/lib/journey/buildSubmission';

const LINES: JourneyCartLine[] = [
  { code: 'NFS', name: 'Numération formule sanguine', nameAr: 'تعداد الدم الكامل', price: 65, type: 'analyse' },
  { code: 'FER', name: 'Ferritine', nameAr: 'الفيريتين', price: 120, type: 'analyse' },
  { code: 'TSH', name: 'TSH', nameAr: 'هرمون TSH', price: 130, type: 'analyse' },
];

const TOTALS: JourneyCartTotals = {
  uniqueAnalysesCount: 3,
  itemsTotal: 315,
  samplingFee: 20,
  total: 335,
};

const PREP: JourneyPreparation = {
  maxJeune: 12,
  maxDRR: 2,
  sampleTypes: ['Sang'],
  patientPreparation: ['Venir à jeun depuis 12 h', 'Apporter la carte CNSS'],
  technicalInstructions: ['Tube EDTA', 'Centrifuger dans les 2 h'],
};

/** Un instantané neutre ; chaque cas n'écrase que ce qui le distingue. */
function base(over: Partial<JourneyFormSnapshot> = {}): JourneyFormSnapshot {
  return {
    variant: 'neutral',
    lang: 'fr',
    uid: 'uid-test-001',
    nom: 'Fatima Zahra Benali',
    telephone: '0612345678',
    email: 'fatima.benali@example.com',
    hasPrescription: null,
    transmission: { upload: false, freetext: false, catalog: false },
    freeText: '',
    cartItems: [],
    cartLines: [],
    cartTotals: null,
    preparation: null,
    wantToKnow: { prix: false, delai: false, jeune: false, explication: false },
    samplingPlace: 'laboratoire',
    adresse: '',
    instructionsAcces: '',
    desiredDate: '',
    desiredTime: '',
    replyChannel: 'whatsapp',
    needsHumanAnswer: false,
    ordonnanceUrls: [],
    wantsAppointment: false,
    ...over,
  };
}

export interface JourneyCase {
  name: string;
  /** À quoi sert ce cas — repris tel quel dans le rapport. */
  why: string;
  snapshot: JourneyFormSnapshot;
  viaWhatsApp: boolean;
  /** La charge utile POSTée à /api/send-appointment. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  /** Le document écrit dans `appointmentRequests`. */
  doc: Record<string, unknown>;
}

function mk(
  name: string,
  why: string,
  snapshot: JourneyFormSnapshot,
  viaWhatsApp = false
): JourneyCase {
  return {
    name,
    why,
    snapshot,
    viaWhatsApp,
    payload: buildEmailPayload(snapshot, viaWhatsApp),
    doc: buildFirestoreDoc(snapshot, viaWhatsApp),
  };
}

/** Les cas issus du parcours unifié (`source: 'journey'`). */
export const JOURNEY_CASES: JourneyCase[] = [
  mk(
    'A · ordonnance photographiée, sans créneau',
    "CAS FRÉQUENT n°1 : le patient a son ordonnance et veut le prix, le jeûne et le délai. Il ne doit RIEN avoir à réserver.",
    base({
      hasPrescription: 'yes',
      transmission: { upload: true, freetext: false, catalog: false },
      needsHumanAnswer: true,
      ordonnanceUrls: ['https://storage.example.com/ordonnances/1-ordo.jpg'],
      wantToKnow: { prix: true, delai: true, jeune: true, explication: false },
      wantsAppointment: false,
    })
  ),
  mk(
    'A2 · ordonnance photographiée, avec créneau',
    'Le même patient qui, lui, veut réserver tout de suite : date et heure doivent apparaître.',
    base({
      hasPrescription: 'yes',
      transmission: { upload: true, freetext: false, catalog: false },
      needsHumanAnswer: true,
      ordonnanceUrls: ['https://storage.example.com/ordonnances/1-ordo.jpg'],
      desiredDate: '15/09/2026',
      desiredTime: '08:30',
      wantsAppointment: true,
    })
  ),
  mk(
    'B · catalogue, sans créneau',
    "CAS FRÉQUENT n°2 : pas d'ordonnance, il choisit lui-même. Devis chiffré, aucun rendez-vous.",
    base({
      hasPrescription: 'no',
      transmission: { upload: false, freetext: false, catalog: true },
      cartLines: LINES,
      cartTotals: TOTALS,
      preparation: PREP,
      wantToKnow: { prix: true, delai: false, jeune: true, explication: false },
      wantsAppointment: false,
    })
  ),
  mk(
    'B2 · catalogue, avec créneau au laboratoire',
    'Le parcours complet le plus courant une fois le patient décidé.',
    base({
      hasPrescription: 'no',
      transmission: { upload: false, freetext: false, catalog: true },
      cartLines: LINES,
      cartTotals: TOTALS,
      preparation: PREP,
      desiredDate: '16/09/2026',
      desiredTime: '09:00',
      wantsAppointment: true,
      replyChannel: 'email',
    })
  ),
  mk(
    'C · demande écrite en texte libre',
    "Le patient décrit son besoin sans ordonnance ni catalogue : rien n'est chiffrable.",
    base({
      hasPrescription: 'no',
      transmission: { upload: false, freetext: true, catalog: false },
      freeText: 'Je voudrais un bilan sanguin général.\nEt un contrôle de la thyroïde.',
      needsHumanAnswer: true,
      replyChannel: 'call',
    })
  ),
  mk(
    'D · domicile complet',
    "Prélèvement à domicile réservé : l'adresse doit atteindre le laboratoire (le bug de lancement).",
    base({
      variant: 'home',
      hasPrescription: 'no',
      transmission: { upload: false, freetext: false, catalog: true },
      cartLines: LINES,
      cartTotals: TOTALS,
      preparation: PREP,
      samplingPlace: 'domicile',
      adresse: "12 rue Ibn Battouta\nQuartier Talborjt\nAgadir",
      instructionsAcces: 'Code immeuble 4512, 3e étage, porte gauche',
      desiredDate: '17/09/2026',
      desiredTime: '07:30',
      wantsAppointment: true,
    })
  ),
  mk(
    'E · lieu de travail',
    "« travail » est un service à domicile mais NE doit pas être annoncé comme « Domicile du patient ».",
    base({
      hasPrescription: 'no',
      transmission: { upload: false, freetext: false, catalog: true },
      cartLines: LINES,
      cartTotals: TOTALS,
      preparation: PREP,
      samplingPlace: 'travail',
      adresse: 'Zone industrielle Tassila, lot 42, Agadir',
      desiredDate: '18/09/2026',
      desiredTime: '10:00',
      wantsAppointment: true,
    })
  ),
  mk(
    'F · domicile SANS adresse, sans créneau',
    "Le cas que le lot « réponse d'abord » a créé : l'absence d'adresse est NORMALE, elle ne doit pas déclencher l'alerte rouge « rappeler le patient ».",
    base({
      variant: 'home',
      hasPrescription: 'yes',
      transmission: { upload: true, freetext: false, catalog: false },
      needsHumanAnswer: true,
      ordonnanceUrls: ['https://storage.example.com/ordonnances/2-ordo.pdf'],
      samplingPlace: 'domicile',
      wantsAppointment: false,
    })
  ),
  mk(
    'G · domicile SANS adresse, AVEC créneau',
    "Ne devrait jamais franchir validate(), mais si ça arrive l'alerte rouge doit revenir.",
    base({
      samplingPlace: 'domicile',
      hasPrescription: 'no',
      transmission: { upload: false, freetext: false, catalog: true },
      cartLines: LINES,
      cartTotals: TOTALS,
      desiredDate: '19/09/2026',
      desiredTime: '08:00',
      wantsAppointment: true,
    })
  ),
  mk(
    'H · patient arabophone',
    "La langue doit être annoncée au personnel, et AUCUN mot arabe ne doit atterrir dans l'e-mail français.",
    base({
      lang: 'ar',
      nom: 'محمد الإدريسي',
      hasPrescription: 'no',
      transmission: { upload: false, freetext: false, catalog: true },
      cartLines: LINES,
      cartTotals: TOTALS,
      preparation: PREP,
      samplingPlace: 'domicile',
      adresse: 'حي الداخلة، زنقة 12، أكادير',
      desiredDate: '20/09/2026',
      desiredTime: '08:00',
      wantsAppointment: true,
    })
  ),
  mk(
    'I · bilan non résolu — devis incomplet',
    "Le catalogue est injoignable : les LIGNES partent, le MONTANT non. Un total sous-évalué ne doit jamais être annoncé.",
    base({
      hasPrescription: 'no',
      transmission: { upload: false, freetext: false, catalog: true },
      cartLines: LINES,
      cartTotals: null,
      preparation: PREP,
      wantsAppointment: false,
    })
  ),
  mk(
    'J · ordonnance ET catalogue',
    "Le devis ne couvre qu'une partie : l'avertissement doit le dire, sans démentir le total affiché juste au-dessus.",
    base({
      hasPrescription: 'yes',
      transmission: { upload: true, freetext: true, catalog: true },
      freeText: 'Ajouter aussi une vitamine D si possible.',
      needsHumanAnswer: true,
      ordonnanceUrls: ['https://storage.example.com/ordonnances/3-a.jpg', 'https://storage.example.com/ordonnances/3-b.jpg'],
      cartLines: LINES,
      cartTotals: TOTALS,
      preparation: PREP,
      desiredDate: '21/09/2026',
      desiredTime: '11:00',
      wantsAppointment: true,
    })
  ),
  mk(
    'K · tentative d\'injection HTML',
    "Tout ce que le patient tape est du texte, jamais du balisage.",
    base({
      nom: '<script>alert("xss")</script> O\'Brien & fils',
      email: 'x"y@example.com',
      hasPrescription: 'no',
      transmission: { upload: false, freetext: true, catalog: false },
      freeText: '<img src=x onerror=alert(1)>\nLigne 2 & "guillemets"',
      needsHumanAnswer: true,
      samplingPlace: 'domicile',
      adresse: '<b>12 rue</b>\n<i>Agadir</i>',
      instructionsAcces: "</div><script>evil()</script>",
      desiredDate: '22/09/2026',
      desiredTime: '08:00',
      wantsAppointment: true,
    })
  ),
  mk(
    'L · panier de 70 lignes',
    "Le tableau est plafonné à 60 lignes et annonce le reste, plutôt qu'un e-mail illisible.",
    base({
      hasPrescription: 'no',
      transmission: { upload: false, freetext: false, catalog: true },
      cartLines: Array.from({ length: 70 }, (_, i) => ({
        code: `C${i}`,
        name: `Analyse ${i + 1}`,
        nameAr: `تحليل ${i + 1}`,
        price: 50 + i,
        type: 'analyse' as const,
      })),
      cartTotals: { uniqueAnalysesCount: 70, itemsTotal: 5915, samplingFee: 20, total: 5935 },
      wantsAppointment: false,
    })
  ),
  mk(
    'M · envoyé par WhatsApp',
    "Le laboratoire doit voir que la demande est aussi arrivée sur WhatsApp, et n'avoir rien à redemander.",
    base({
      hasPrescription: 'no',
      transmission: { upload: false, freetext: false, catalog: true },
      cartLines: LINES,
      cartTotals: TOTALS,
      preparation: PREP,
      desiredDate: '23/09/2026',
      desiredTime: '09:30',
      wantsAppointment: true,
    }),
    true
  ),
  mk(
    'N · sans e-mail patient',
    "Champ facultatif : ni bloc Email, ni replyTo cassé.",
    base({
      email: '',
      hasPrescription: 'no',
      transmission: { upload: false, freetext: false, catalog: true },
      cartLines: LINES,
      cartTotals: TOTALS,
      wantsAppointment: false,
    })
  ),
];

/**
 * Les charges utiles des DEUX ANCIENNES PAGES, telles qu'elles les envoient
 * aujourd'hui. Elles n'ont aucun champ du parcours : leur e-mail doit rester
 * inchangé tant que ces pages existent.
 */
export const LEGACY_CASES: JourneyCase[] = [
  {
    name: 'Z1 · ancienne page /rendez-vous',
    why: "Aucun champ du parcours : l'e-mail historique ne doit pas bouger d'un octet.",
    snapshot: base(),
    viaWhatsApp: false,
    doc: {},
    payload: {
      nom: 'Benali',
      prenom: 'Fatima',
      telephone: '0612345678',
      email: 'fatima@example.com',
      date_souhaitee: '15/09/2026',
      heure_souhaitee: '08:30',
      type_analyse: 'Rendez-vous Laboratoire',
      commentaires: 'Merci de me rappeler le matin.',
      ordonnanceUrls: [],
      isHomeService: false,
    },
  },
  {
    name: 'Z2 · ancienne page /glabo',
    why: "Le bloc « Lieu de prélèvement » doit porter l'adresse — c'est le bug de lancement corrigé le 03/09.",
    snapshot: base(),
    viaWhatsApp: false,
    doc: {},
    payload: {
      nom: 'Idrissi',
      prenom: 'Youssef',
      telephone: '0655443322',
      email: '',
      date_souhaitee: '16/09/2026',
      heure_souhaitee: '07:30',
      type_analyse: 'Prélèvement à Domicile',
      commentaires: '',
      ordonnanceUrls: ['https://storage.example.com/ordonnances/legacy.jpg'],
      isHomeService: true,
      adresse: '5 avenue Hassan II, Agadir',
      lieuPrelevement: 'domicile',
      instructionsAcces: 'Sonner deux fois',
    },
  },
];

export const CASES: JourneyCase[] = [...JOURNEY_CASES, ...LEGACY_CASES];
