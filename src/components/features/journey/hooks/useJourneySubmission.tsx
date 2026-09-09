"use client";

import { useCallback, useRef, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { TFunction } from 'i18next';

import { db } from '@/config/firebase';
import { validatePhone } from '@/utils/phone';
import { LAB_CONTACT } from '@/constants/contact';
import type { SubmitState } from '@/components/ui/SubmitProgressModal';
import type { CartItem } from '@/components/features/catalog/AnalysisCard';

import type { JourneyFormSnapshot, JourneyVariant } from '@/lib/journey/types';
import {
  buildEmailPayload,
  buildFirestoreDoc,
  cartLinesFrom,
  cartTotalsFrom,
  preparationFrom,
} from '@/lib/journey/buildSubmission';
import { buildWhatsAppMessage } from '@/lib/journey/buildWhatsAppMessage';

import type { JourneyForm } from './useJourneyForm';
import type { UseJourneyCartResult } from './useJourneyCart';
import type { UsePrescriptionUploadResult } from './usePrescriptionUpload';

/**
 * Validation, instantané, écriture Firestore, e-mail au laboratoire et message
 * WhatsApp — tout ce qui se passe APRÈS que le patient a cliqué.
 *
 * ### Pourquoi c'est un hook partagé et non du code dans la page
 * Deux mises en page coexistent le temps de la validation par le laboratoire :
 * `/test-rdv` (huit blocs numérotés) et `/test-rdv2` (quatre groupes). Elles ne
 * diffèrent QUE par la disposition. Recopier ces deux cents lignes dans la
 * seconde garantissait qu'un correctif appliqué à l'une manque à l'autre — et
 * le chemin d'envoi est exactement l'endroit où ça ne pardonne pas : un
 * rendez-vous perdu, une adresse absente, un devis sous-évalué.
 *
 * ### `validate()` nomme la SECTION fautive
 * Elle ne renvoie plus seulement un message. Avec un accordéon entièrement
 * replié, « Merci d'indiquer votre nom et votre téléphone » s'affichait
 * au-dessus de blocs tous fermés : le patient devait deviner lequel ouvrir.
 * L'appelant reçoit maintenant l'identifiant de la section, ouvre le bloc
 * correspondant et y fait défiler la page.
 *
 * ### Deux garde-fous à ne pas déplacer
 *  - **WhatsApp sur ordinateur** : la fenêtre est ouverte de façon SYNCHRONE,
 *    avant tout `await`, sinon le bloqueur de fenêtres surgissantes mange la
 *    redirection (le navigateur ne la relie plus au clic).
 *  - **Écrire en base et envoyer l'e-mail AVANT de naviguer** : sur mobile,
 *    `location.href` détruit la page et peut tuer une requête en vol.
 */
export interface JourneyValidationProblem {
  /** Message déjà traduit, affiché en toast et sous le bouton. */
  message: string;
  /**
   * La section de `useJourneySections` à ouvrir. `null` quand l'anomalie
   * n'appartient à aucune section (téléversement encore en cours).
   */
  section: string | null;
}

export interface UseJourneySubmissionArgs {
  lang: string;
  variant: JourneyVariant;
  uid: string;
  form: JourneyForm;
  cart: UseJourneyCartResult;
  upload: UsePrescriptionUploadResult;
  /** URL d'ordonnances restaurées d'un brouillon (les `File` ne survivent pas). */
  restoredUrls: string[];
  setRestoredUrls: (urls: string[]) => void;
  clearDraft: () => void;
  /**
   * Appelé quand la validation refuse l'envoi : à l'appelant d'ouvrir la
   * section (ou le groupe) fautive et d'y faire défiler la page.
   */
  onValidationProblem?: (problem: JourneyValidationProblem) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: TFunction<any, any>;
}

export interface UseJourneySubmissionResult {
  submitState: SubmitState;
  isWhatsappLoading: boolean;
  submitError: string | null;
  /** Message d'erreur porté par le champ « adresse » lui-même. */
  addressError: string;
  handleSubmit: () => void;
  handleWhatsApp: () => void;
}

export function useJourneySubmission({
  lang,
  variant,
  uid,
  form,
  cart,
  upload,
  restoredUrls,
  setRestoredUrls,
  clearDraft,
  onValidationProblem,
  t,
}: UseJourneySubmissionArgs): UseJourneySubmissionResult {
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [isWhatsappLoading, setIsWhatsappLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string>('');
  /** Panier vidé après envoi, gardé en mémoire pour le bouton « Annuler ». */
  const clearedCartRef = useRef<CartItem[] | null>(null);

  // -- validation --------------------------------------------------------------
  const validate = useCallback((): JourneyValidationProblem | null => {
    setAddressError('');
    form.setPhoneError('');
    if (!form.intentDone) {
      return { message: t('submit.required_intent'), section: 'prescription' };
    }
    if (!form.nom.trim() || !form.telephone.trim()) {
      return { message: t('submit.required_identity'), section: 'identity' };
    }
    if (!validatePhone(form.telephone)) {
      const msg = t('appointment:invalidPhone', 'Numéro invalide');
      form.setPhoneError(msg);
      return { message: msg, section: 'identity' };
    }
    // Date, créneau et adresse ne sont exigés QUE si le patient a choisi de
    // réserver maintenant (`intent.book_now_title`, à côté de la réponse
    // immédiate). Sinon la demande part sans créneau — voir
    // docs/pages/test-rdv.md §« Répondre d'abord, réserver ensuite ».
    if (form.wantsAppointment) {
      if (!form.selectedDate || !form.selectedTime) {
        return { message: t('submit.required_datetime'), section: 'when' };
      }
      if (form.isHomeService && !form.adresse.trim()) {
        setAddressError(t('place.address_required'));
        return { message: t('submit.required_address'), section: 'place' };
      }
    }
    if (upload.isUploading) return { message: t('submit.wait_upload'), section: null };
    return null;
  }, [form, t, upload.isUploading]);

  /** Signale l'anomalie de la même façon pour les deux boutons. */
  const reportProblem = useCallback(
    (problem: JourneyValidationProblem) => {
      setSubmitError(problem.message);
      toast.error(problem.message);
      onValidationProblem?.(problem);
    },
    [onValidationProblem]
  );

  const buildSnapshot = useCallback(
    (ordonnanceUrls: string[]): JourneyFormSnapshot => ({
      variant,
      lang,
      uid,
      nom: form.nom.trim(),
      telephone: form.telephone.trim(),
      email: form.email.trim(),
      hasPrescription: form.hasPrescription,
      transmission: form.transmission,
      freeText: form.freeText.trim(),
      cartItems: cart.cartItems,
      cartLines: cart.hasCart ? cartLinesFrom(cart.cartView) : [],
      // ⚠ Les TOTAUX ne partent QUE si le devis est complet. Quand la
      // composition d'un bilan n'a pas pu etre resolue, `computeCartView` la
      // valorise a 0 : envoyer ces totaux ferait annoncer au laboratoire un
      // prix sous-evalue, dans le corps de l'e-mail ET dans son objet. Les
      // LIGNES partent quand meme (le personnel voit quoi chiffrer), le montant
      // non. `answerComplete` pilotait l'affichage ; il pilote maintenant aussi
      // l'envoi.
      cartTotals: cart.hasCart && cart.answerComplete ? cartTotalsFrom(cart.cartView) : null,
      preparation: cart.hasCart ? preparationFrom(cart.preparation) : null,
      wantToKnow: form.wantToKnow,
      samplingPlace: form.samplingPlace,
      adresse: form.adresse.trim(),
      instructionsAcces: form.instructionsAcces.trim(),
      // ⚠ Conditionné à `wantsAppointment`, et pas seulement à la présence
      // d'une date. `useLabSchedule` SÈME `selectedDate` sur le prochain jour
      // ouvrable dès le montage (pour que le calendrier ne s'ouvre pas sur un
      // dimanche) : sans ce garde-fou, un patient qui déclare ne pas vouloir
      // de créneau envoyait quand même une date en base — une date qu'il n'a
      // jamais regardée. L'e-mail, lui, la masquait déjà ; le document
      // Firestore, non. Relevé au banc d'essai (scripts/test-journey-ui.js).
      desiredDate:
        form.wantsAppointment && form.selectedDate
          ? format(form.selectedDate, 'dd/MM/yyyy')
          : '',
      desiredTime: form.wantsAppointment ? form.selectedTime : '',
      replyChannel: form.replyChannel,
      needsHumanAnswer: form.needsHumanAnswer,
      ordonnanceUrls,
      wantsAppointment: form.wantsAppointment,
    }),
    [variant, lang, uid, form, cart]
  );

  /** Vide le panier avec une notification qui permet d'annuler. */
  const clearCartWithUndo = useCallback(() => {
    if (!cart.hasCart) return;
    clearedCartRef.current = cart.cartItems;
    cart.clear();
    toast(
      (toastRef) => (
        <span className="flex items-center gap-3">
          <span className="text-sm">{t('cart.cleared_toast')}</span>
          <button
            type="button"
            onClick={() => {
              if (clearedCartRef.current) cart.restore(clearedCartRef.current);
              clearedCartRef.current = null;
              toast.dismiss(toastRef.id);
              toast.success(t('cart.cleared_restored'));
            }}
            className="text-sm font-semibold text-[var(--color-bordeaux-primary)] underline flex-shrink-0"
          >
            {t('cart.cleared_undo')}
          </button>
        </span>
      ),
      { duration: 8000 }
    );
  }, [cart, t]);

  const finishSuccess = useCallback(() => {
    clearDraft();
    setRestoredUrls([]);
    upload.reset();
    form.resetAfterSubmit();
    clearCartWithUndo();
  }, [clearDraft, setRestoredUrls, upload, form, clearCartWithUndo]);

  /** Envoi de l'e-mail au laboratoire. Best-effort : ne fait jamais échouer la demande. */
  const sendEmail = useCallback(async (snapshot: JourneyFormSnapshot, viaWhatsApp: boolean) => {
    try {
      await fetch('/api/send-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEmailPayload(snapshot, viaWhatsApp)),
      });
    } catch (err) {
      console.warn('Notification e-mail au laboratoire échouée', err);
    }
  }, []);

  // -- envoi classique ---------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    const problem = validate();
    if (problem) {
      reportProblem(problem);
      return;
    }
    setSubmitError(null);

    try {
      setSubmitState('uploading_image');
      const uploaded = await upload.resolveUrls();
      const urls = [...restoredUrls, ...uploaded];
      const snapshot = buildSnapshot(urls);

      setSubmitState('saving_database');
      if (db) {
        await addDoc(collection(db, 'appointmentRequests'), {
          ...buildFirestoreDoc(snapshot, false),
          submittedAt: serverTimestamp(),
        });
      }

      setSubmitState('sending_email');
      await sendEmail(snapshot, false);

      setSubmitState('success');
      toast.success(t('submit.success'));
      window.setTimeout(() => {
        setSubmitState('idle');
        finishSuccess();
      }, 1800);
    } catch (err) {
      console.error('Envoi de la demande échoué', err);
      setSubmitState('idle');
      setSubmitError(t('submit.error'));
      toast.error(t('submit.error'));
    }
  }, [validate, reportProblem, upload, restoredUrls, buildSnapshot, sendEmail, t, finishSuccess]);

  // -- envoi WhatsApp ----------------------------------------------------------
  const handleWhatsApp = useCallback(async () => {
    const problem = validate();
    if (problem) {
      reportProblem(problem);
      return;
    }
    setSubmitError(null);

    // ⚠ Sur ordinateur, la fenêtre DOIT être ouverte de façon SYNCHRONE, avant
    // tout `await` : sinon le bloqueur de fenêtres surgissantes mange la
    // redirection (le navigateur ne la relie plus au clic).
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth < 768;
    let popup: Window | null = null;
    if (!isMobile) {
      popup = window.open('', '_blank');
      if (!popup) {
        const msg = t('submit.whatsapp_popup_blocked');
        setSubmitError(msg);
        toast.error(msg);
        return;
      }
    }

    setIsWhatsappLoading(true);
    try {
      const uploaded = await upload.resolveUrls();
      const urls = [...restoredUrls, ...uploaded];
      const snapshot = buildSnapshot(urls);

      // ⚠ On écrit en base ET on envoie l'e-mail AVANT de naviguer : sur mobile,
      // `location.href` détruit la page et peut tuer une requête en vol.
      if (db) {
        await addDoc(collection(db, 'appointmentRequests'), {
          ...buildFirestoreDoc(snapshot, true),
          submittedAt: serverTimestamp(),
        });
      }
      await sendEmail(snapshot, true);

      const link = `https://wa.me/${LAB_CONTACT.WHATSAPP_ID}?text=${encodeURIComponent(
        buildWhatsAppMessage(snapshot)
      )}`;
      if (popup) popup.location.href = link;
      else window.location.href = link;

      finishSuccess();
    } catch (err) {
      console.error('Envoi WhatsApp échoué', err);
      popup?.close();
      setSubmitError(t('submit.error'));
      toast.error(t('submit.error'));
    } finally {
      setIsWhatsappLoading(false);
    }
  }, [validate, reportProblem, upload, restoredUrls, buildSnapshot, sendEmail, t, finishSuccess]);

  return {
    submitState,
    isWhatsappLoading,
    submitError,
    addressError,
    handleSubmit: useCallback(() => void handleSubmit(), [handleSubmit]),
    handleWhatsApp: useCallback(() => void handleWhatsApp(), [handleWhatsApp]),
  };
}
