"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLabSchedule } from '@/hooks/useLabSchedule';
import {
  FREETEXT_MAX,
  type JourneyVariant,
  type PrescriptionAnswer,
  type ReplyChannel,
  type SamplingPlace,
  type TransmissionMode,
  type TransmissionState,
  type WantToKnow,
  type WantToKnowKey,
} from '@/lib/journey/types';

/**
 * Tout l'état du parcours patient + les valeurs dérivées + la carte de
 * révélation des sections.
 *
 * ### Révélation en DEUX VAGUES, pas un assistant
 * Vague 1 = "que voulez-vous" (ordonnance ? -> mode -> contenu). Dès que
 * l'intention est exprimée — un fichier, un texte, ou un panier non vide —
 * la vague 2 apparaît D'UN COUP. Révéler les sections une par une reviendrait à
 * un assistant déguisé, ce que la maquette validée écarte explicitement.
 *
 * ### `wantsAppointment` — répondre d'abord, réserver ensuite (11/09/2026)
 * Les deux cas les plus fréquents (propriétaire, 09/09/2026) veulent une
 * RÉPONSE — prix, jeûne, délai — pas forcément un créneau dans la foulée.
 * `validate()` (`PatientJourneyPage.tsx`) exigeait pourtant TOUJOURS une date
 * et un créneau : ces deux patients ne pouvaient pas envoyer leur demande sans
 * réserver un rendez-vous dont ils ne voulaient pas encore. Ce booléen lève
 * cette obligation ; `place`/`when` restent VISIBLES (règle non destructive
 * ci-dessus) mais cessent d'être requis pour l'envoi. Le choix est présenté en
 * clair, à côté de la réponse immédiate — jamais caché dans une section
 * repliée, sous peine de reproduire le défaut relevé lors de la conception :
 * la porte de sortie du patient pressé doit être VUE, pas devinée.
 *
 * Défaut selon `variant` : `true` pour `'home'` (le lien GLABO présuppose déjà
 * un déplacement), `false` sinon — exactement le même principe que
 * `samplingPlace` juste en dessous.
 *
 * ### Règle non destructive
 * Masquer une section n'efface jamais sa saisie — le patient qui revient sur ses
 * pas retrouve tout. UNE exception : "j'ai une ordonnance" -> "je n'en ai pas"
 * vide les fichiers, sinon une ordonnance invisible partirait quand même avec
 * la demande.
 */
export interface UseJourneyFormOptions {
  variant: JourneyVariant;
  /** Le panier est-il non vide ? (vient de useJourneyCart) */
  hasCart: boolean;
  /** Nombre de fichiers d'ordonnance actuellement joints. */
  attachedFileCount: number;
  /** Nombre d'URL d'ordonnances restaurées depuis un brouillon. */
  restoredUrlCount: number;
  /** Vide les fichiers quand on passe de "oui" à "non". */
  onResetPrescriptionFiles: () => void;
}

export function useJourneyForm({
  variant,
  hasCart,
  attachedFileCount,
  restoredUrlCount,
  onResetPrescriptionFiles,
}: UseJourneyFormOptions) {
  const { user, userProfile } = useAuth();
  const schedule = useLabSchedule();

  // -- identité --------------------------------------------------------------
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [phoneError, setPhoneError] = useState('');
  /** Empêche un chargement tardif du profil d'écraser ce que le patient tape. */
  const [identityTouched, setIdentityTouched] = useState(false);

  useEffect(() => {
    if (identityTouched) return;
    if (userProfile?.fullName) setNom((c) => c || userProfile.fullName);
    if (userProfile?.phone) setTelephone((c) => c || userProfile.phone || '');
    const mail = userProfile?.email || user?.email || '';
    if (mail) setEmail((c) => c || mail);
  }, [userProfile, user, identityTouched]);

  // -- section 1 : ordonnance ------------------------------------------------
  const [hasPrescription, setHasPrescription] = useState<PrescriptionAnswer>(null);
  const [transmission, setTransmission] = useState<TransmissionState>({
    upload: false,
    freetext: false,
    catalog: false,
  });
  const [freeText, setFreeText] = useState('');

  const answerPrescription = useCallback(
    (answer: 'yes' | 'no') => {
      setHasPrescription((previous) => {
        if (previous === answer) return previous;
        if (answer === 'no') {
          // Seule exception à la règle non destructive.
          onResetPrescriptionFiles();
          setTransmission((t) => ({ ...t, upload: false }));
        }
        return answer;
      });
    },
    [onResetPrescriptionFiles]
  );

  const toggleTransmission = useCallback(
    (mode: TransmissionMode) => {
      setTransmission((prev) => {
        if (mode === 'upload' && prev.upload) onResetPrescriptionFiles();
        return { ...prev, [mode]: !prev[mode] };
      });
    },
    [onResetPrescriptionFiles]
  );

  // -- sections 3 à 7 --------------------------------------------------------
  const [wantToKnow, setWantToKnow] = useState<WantToKnow>({
    prix: false,
    delai: false,
    jeune: false,
    explication: false,
  });
  const toggleWant = useCallback((key: WantToKnowKey) => {
    setWantToKnow((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const [samplingPlace, setSamplingPlace] = useState<SamplingPlace>(
    variant === 'home' ? 'domicile' : 'laboratoire'
  );
  const [adresse, setAdresse] = useState('');
  const [instructionsAcces, setInstructionsAcces] = useState('');
  const [replyChannel, setReplyChannel] = useState<ReplyChannel>('whatsapp');
  /** Voir le commentaire de tête. `true` par défaut pour le variant GLABO. */
  const [wantsAppointment, setWantsAppointment] = useState<boolean>(variant === 'home');

  // -- valeurs dérivées ------------------------------------------------------
  const needsHumanAnswer = transmission.upload || transmission.freetext;
  const isHomeService = samplingPlace !== 'laboratoire';
  const hasAttachment = attachedFileCount + restoredUrlCount > 0;

  /** L'intention est exprimée : la vague 2 peut apparaître. */
  const intentDone = useMemo(() => {
    if (hasPrescription === null) return false;
    const described = freeText.trim() !== '' || hasCart;
    if (hasPrescription === 'yes') return hasAttachment || described;
    return described;
  }, [hasPrescription, freeText, hasCart, hasAttachment]);

  const visible = useMemo(
    () => ({
      prescription: true,
      modes: hasPrescription !== null,
      upload: hasPrescription === 'yes' && transmission.upload,
      freetext: transmission.freetext,
      cart: transmission.catalog || hasCart,
      answer: hasCart || needsHumanAnswer,
      wantToKnow: intentDone,
      location: intentDone,
      address: intentDone && isHomeService,
      datetime: intentDone,
      channel: intentDone,
      identity: intentDone,
      access: intentDone,
      submit: intentDone,
    }),
    [hasPrescription, transmission, hasCart, needsHumanAnswer, intentDone, isHomeService]
  );

  const setFreeTextCapped = useCallback((value: string) => {
    setFreeText(value.slice(0, FREETEXT_MAX));
  }, []);

  const setNomTouched = useCallback((v: string) => {
    setIdentityTouched(true);
    setNom(v);
  }, []);
  const setTelephoneTouched = useCallback((v: string) => {
    setIdentityTouched(true);
    setTelephone(v);
  }, []);
  const setEmailTouched = useCallback((v: string) => {
    setIdentityTouched(true);
    setEmail(v);
  }, []);

  const { setTime } = schedule;
  const resetAfterSubmit = useCallback(() => {
    setHasPrescription(null);
    setTransmission({ upload: false, freetext: false, catalog: false });
    setFreeText('');
    setWantToKnow({ prix: false, delai: false, jeune: false, explication: false });
    setSamplingPlace(variant === 'home' ? 'domicile' : 'laboratoire');
    setAdresse('');
    setInstructionsAcces('');
    setReplyChannel('whatsapp');
    setWantsAppointment(variant === 'home');
    setTime('');
    setPhoneError('');
  }, [variant, setTime]);

  return {
    // identité
    nom,
    telephone,
    email,
    phoneError,
    setPhoneError,
    setNom: setNomTouched,
    setTelephone: setTelephoneTouched,
    setEmail: setEmailTouched,
    prefilledFromProfile: Boolean(userProfile?.fullName || userProfile?.phone),

    // section 1
    hasPrescription,
    answerPrescription,
    transmission,
    toggleTransmission,
    freeText,
    setFreeText: setFreeTextCapped,

    // sections 3-7
    wantToKnow,
    toggleWant,
    samplingPlace,
    setSamplingPlace,
    adresse,
    setAdresse,
    instructionsAcces,
    setInstructionsAcces,
    replyChannel,
    setReplyChannel,
    wantsAppointment,
    setWantsAppointment,

    // date / créneau (via useLabSchedule)
    ...schedule,

    // dérivés
    needsHumanAnswer,
    isHomeService,
    intentDone,
    visible,

    // restauration de brouillon / réinitialisation
    setHasPrescription,
    setTransmission,
    setWantToKnow,
    resetAfterSubmit,
  };
}

export type JourneyForm = ReturnType<typeof useJourneyForm>;
