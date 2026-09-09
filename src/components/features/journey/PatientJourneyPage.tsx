"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  FileQuestion,
  ShoppingCart,
  Sparkles,
  ListChecks,
  MapPin,
  CalendarDays,
  MessageCircle,
  UserRound,
  ShieldCheck,
  Send,
} from 'lucide-react';

import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { validatePhone } from '@/utils/phone';
import { LAB_CONTACT } from '@/constants/contact';
import MultiFileUploader from '@/components/ui/MultiFileUploader';
import type { SubmitState } from '@/components/ui/SubmitProgressModal';
import type { CartItem } from '@/components/features/catalog/AnalysisCard';

import JourneyAuthGate from './JourneyAuthGate';
import SectionShell, { ChoiceCard } from './SectionShell';
import PrescriptionSection from './sections/PrescriptionSection';
import FreeTextPanel from './sections/FreeTextPanel';
import JourneyCartSection from './sections/JourneyCartSection';
import ImmediateAnswerCard from './sections/ImmediateAnswerCard';
import WantToKnowSection from './sections/WantToKnowSection';
import LocationSection from './sections/LocationSection';
import DateTimeSection from './sections/DateTimeSection';
import ReplyChannelSection from './sections/ReplyChannelSection';
import IdentitySection from './sections/IdentitySection';
import ResultsAccessSection from './sections/ResultsAccessSection';
import SubmitSection from './sections/SubmitSection';

import { useJourneyCart } from './hooks/useJourneyCart';
import { useJourneyForm } from './hooks/useJourneyForm';
import { usePrescriptionUpload } from './hooks/usePrescriptionUpload';
import { useJourneyDraft } from './hooks/useJourneyDraft';
import { useJourneySections } from './hooks/useJourneySections';

import { catalogPathFromJourney } from '@/lib/journey/route';
import type { JourneyFormSnapshot, JourneyVariant } from '@/lib/journey/types';
import {
  buildEmailPayload,
  buildFirestoreDoc,
  cartLinesFrom,
  cartTotalsFrom,
  preparationFrom,
} from '@/lib/journey/buildSubmission';
import { buildWhatsAppMessage } from '@/lib/journey/buildWhatsAppMessage';

/**
 * Parcours patient unifié : de "avez-vous une ordonnance ?" jusqu'à l'activation
 * de l'accès aux résultats, sur une seule page qui se déroule.
 *
 * Remplace à terme `/rendez-vous` et `/glabo`, qui sont aujourd'hui deux copies
 * divergentes du même formulaire de 700 lignes et n'ont aucun lien avec le
 * panier du catalogue. Voir `docs/pages/test-rdv.md`.
 */
export interface PatientJourneyPageProps {
  lang: string;
  variant: JourneyVariant;
}

export default function PatientJourneyPage({ lang, variant }: PatientJourneyPageProps) {
  return (
    <JourneyAuthGate lang={lang} variant={variant}>
      <JourneyBody lang={lang} variant={variant} />
    </JourneyAuthGate>
  );
}

function JourneyBody({ lang, variant }: PatientJourneyPageProps) {
  const { t } = useTranslation(['journey', 'appointment', 'catalog', 'common']);
  const { user } = useAuth();
  const router = useRouter();
  const isArabic = lang === 'ar';
  const locale = isArabic ? 'ar-MA' : 'fr-MA';
  const currencyLabel = t('catalog:card.price_currency', 'DH');

  const cart = useJourneyCart();
  const upload = usePrescriptionUpload();
  const draft = useJourneyDraft();

  /** URL d'ordonnances restaurées d'un brouillon (les `File` ne survivent pas). */
  const [restoredUrls, setRestoredUrls] = useState<string[]>([]);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [isWhatsappLoading, setIsWhatsappLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string>('');
  /** Panier vidé après envoi, gardé en mémoire pour le bouton "Annuler". */
  const clearedCartRef = useRef<CartItem[] | null>(null);

  const form = useJourneyForm({
    variant,
    hasCart: cart.hasCart,
    attachedFileCount: upload.files.length,
    restoredUrlCount: restoredUrls.length,
    onResetPrescriptionFiles: () => {
      upload.reset();
      setRestoredUrls([]);
    },
  });

  // -- brouillon : restauration au montage ------------------------------------
  const { load: loadDraft, save: saveDraft, clear: clearDraft } = draft;
  const { setHasPrescription, setTransmission, setWantToKnow } = form;
  useEffect(() => {
    const d = loadDraft();
    if (!d) return;
    setHasPrescription(d.hasPrescription);
    setTransmission(d.transmission);
    setWantToKnow(d.wantToKnow);
    form.setFreeText(d.freeText);
    form.setSamplingPlace(d.samplingPlace);
    form.setAdresse(d.adresse);
    form.setInstructionsAcces(d.instructionsAcces);
    form.setReplyChannel(d.replyChannel);
    // Absent des brouillons enregistrés avant ce lot : la valeur par défaut du
    // hook (selon `variant`) reste alors en place, jamais écrasée par `undefined`.
    if (typeof d.wantsAppointment === 'boolean') form.setWantsAppointment(d.wantsAppointment);
    if (d.time) form.setTime(d.time);
    if (d.dateISO) form.setDate(new Date(d.dateISO));
    if (d.nom) form.setNom(d.nom);
    if (d.telephone) form.setTelephone(d.telephone);
    if (d.email) form.setEmail(d.email);
    setRestoredUrls(d.uploadedUrls || []);
    // Restauration unique au montage : `loadDraft` se garde lui-même.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snapshotDraft = useCallback(
    (uploadedUrls: string[]) => ({
      variant,
      hasPrescription: form.hasPrescription,
      transmission: form.transmission,
      freeText: form.freeText,
      wantToKnow: form.wantToKnow,
      samplingPlace: form.samplingPlace,
      adresse: form.adresse,
      instructionsAcces: form.instructionsAcces,
      dateISO: form.selectedDate ? form.selectedDate.toISOString() : null,
      time: form.selectedTime,
      replyChannel: form.replyChannel,
      wantsAppointment: form.wantsAppointment,
      nom: form.nom,
      telephone: form.telephone,
      email: form.email,
      uploadedUrls,
    }),
    [variant, form]
  );

  const openCatalog = useCallback(() => {
    saveDraft(snapshotDraft(restoredUrls));
    router.push(catalogPathFromJourney(lang));
  }, [saveDraft, snapshotDraft, restoredUrls, router, lang]);

  // -- validation --------------------------------------------------------------
  const validate = useCallback((): string | null => {
    setAddressError('');
    form.setPhoneError('');
    if (!form.intentDone) return t('submit.required_intent');
    if (!form.nom.trim() || !form.telephone.trim()) return t('submit.required_identity');
    if (!validatePhone(form.telephone)) {
      form.setPhoneError(t('appointment:invalidPhone', 'Numéro invalide'));
      return t('appointment:invalidPhone', 'Numéro invalide');
    }
    // Date, créneau et adresse ne sont exigés QUE si le patient a choisi de
    // réserver maintenant (`intent.book_now_title`, à côté de la réponse
    // immédiate). Sinon la demande part sans créneau — voir
    // docs/pages/test-rdv.md §« Répondre d'abord, réserver ensuite ».
    if (form.wantsAppointment) {
      if (!form.selectedDate || !form.selectedTime) return t('submit.required_datetime');
      if (form.isHomeService && !form.adresse.trim()) {
        setAddressError(t('place.address_required'));
        return t('submit.required_address');
      }
    }
    if (upload.isUploading) return t('submit.wait_upload');
    return null;
  }, [form, t, upload.isUploading]);

  const buildSnapshot = useCallback(
    (ordonnanceUrls: string[]): JourneyFormSnapshot => ({
      variant,
      lang,
      uid: user?.uid ?? '',
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
      desiredDate: form.selectedDate ? format(form.selectedDate, 'dd/MM/yyyy') : '',
      desiredTime: form.selectedTime,
      replyChannel: form.replyChannel,
      needsHumanAnswer: form.needsHumanAnswer,
      ordonnanceUrls,
      wantsAppointment: form.wantsAppointment,
    }),
    [variant, lang, user, form, cart]
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
  }, [clearDraft, upload, form, clearCartWithUndo]);

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
      setSubmitError(problem);
      toast.error(problem);
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
  }, [validate, upload, restoredUrls, buildSnapshot, sendEmail, t, finishSuccess]);

  // -- envoi WhatsApp ----------------------------------------------------------
  const handleWhatsApp = useCallback(async () => {
    const problem = validate();
    if (problem) {
      setSubmitError(problem);
      toast.error(problem);
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
  }, [validate, upload, restoredUrls, buildSnapshot, sendEmail, t, finishSuccess]);

  const { visible } = form;

  // -- Accordeon --------------------------------------------------------------
  // Une seule section ouverte a la fois. Demande du proprietaire (08/09/2026) :
  // « tout doit être collapsé par défaut, comme ça le user voit la suite logique
  // des grandes étapes et déplie juste ce qu'il veut/doit éditer ».
  //
  // Tout est replie a l'arrivee — SAUF quand la page est vierge (pas de panier
  // rapporte du catalogue). Sans cela le patient tomberait sur UNE seule ligne
  // fermee, sans rien a resumer : un ecran mort. Quand il arrive du catalogue,
  // en revanche, chaque ligne porte deja son resume et le sommaire se suffit.
  //
  // ⚠ Il n'y a AUCUN repliage automatique en cours de route. Une premiere
  // version repliait tout des que l'intention etait exprimee ; arriver AVEC un
  // panier (le parcours principal !) rendait l'intention vraie a la premiere
  // reponse, et l'etape 1 se refermait au nez du patient avant qu'il ait pu
  // choisir un mode de transmission. Le patient seul ouvre et ferme.
  const [openSection, setOpenSection] = useState<string | null>(null);
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !cart.hydrated) return;
    seeded.current = true;
    if (!cart.hasCart) setOpenSection('prescription');
  }, [cart.hydrated, cart.hasCart]);

  const toggle = useCallback(
    (id: string) => setOpenSection((current) => (current === id ? null : id)),
    []
  );

  const sections = useJourneySections({
    form,
    hasCart: cart.hasCart,
    cartView: cart.cartView,
    preparation: cart.preparation,
    answerComplete: cart.answerComplete,
    attachedFileCount: upload.files.length,
    restoredUrlCount: restoredUrls.length,
    accessLabel: t('access.summary_hint'),
    locale,
    currencyLabel,
    t,
  });

  /** Props communes a chaque etape : evite de repeter 9 fois les memes 5 lignes. */
  const shell = (id: string) => {
    const obligation = sections[id]?.obligation;
    return {
      open: openSection === id,
      onToggle: () => toggle(id),
      isRtl: isArabic,
      status: sections[id]?.status ?? ('none' as const),
      summary: sections[id]?.summary,
      doneLabel: t('section.done_label'),
      incompleteLabel: t('section.incomplete_label'),
      // Le mot écrit d'avance (« Obligatoire »/« Facultatif ») : voir
      // Disclosure.tsx. `place`/`when` en changent quand `wantsAppointment`
      // change — calculé dans useJourneySections.ts.
      obligationLabel:
        obligation === 'required'
          ? t('section.required_label')
          : obligation === 'optional'
            ? t('section.optional_label')
            : undefined,
      obligationTone: obligation,
    };
  };

  return (
    // `relative` : SubmitProgressModal est en `absolute inset-0`.
    <div className="relative max-w-3xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">{t('page_title')}</h1>
        <p className="mt-2 text-[var(--text-secondary)]">{t('page_subtitle')}</p>
      </header>

      <div className="space-y-3">
        <SectionShell
          {...shell('prescription')}
          id="journey-prescription"
          step={1}
          title={t('prescription.question')}
          icon={<FileQuestion className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />}
          visible
        >
          <PrescriptionSection
            hasPrescription={form.hasPrescription}
            onAnswer={form.answerPrescription}
            transmission={form.transmission}
            onToggleTransmission={form.toggleTransmission}
            modesVisible={visible.modes}
          />

          {visible.upload && (
            <div className="mt-6 pt-5 border-t border-[var(--border-default)]">
              {restoredUrls.length > 0 && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[var(--status-success)]/40 bg-[var(--status-success)]/5 px-3 py-2">
                  <span className="text-sm text-[var(--text-primary)]">
                    {t('cart.count', { count: restoredUrls.length })} — {t('prescription.already_sent')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRestoredUrls([])}
                    className="text-sm font-medium text-[var(--color-bordeaux-primary)] underline flex-shrink-0"
                  >
                    {t('prescription.replace')}
                  </button>
                </div>
              )}
              <MultiFileUploader
                files={upload.files}
                filePreviews={upload.filePreviews}
                setFiles={upload.setFiles}
                setFilePreviews={upload.setFilePreviews}
                error={upload.fileError}
                setError={upload.setFileError}
                fileUploadStates={upload.fileUploadStates}
              />
            </div>
          )}

          {visible.freetext && (
            <div className="mt-6 pt-5 border-t border-[var(--border-default)]">
              <FreeTextPanel
                value={form.freeText}
                onChange={form.setFreeText}
                hasPrescription={form.hasPrescription}
              />
            </div>
          )}
        </SectionShell>

        <SectionShell
          {...shell('cart')}
          id="journey-cart"
          step={2}
          title={t('cart.title')}
          icon={<ShoppingCart className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />}
          visible={visible.cart}
        >
          <JourneyCartSection
            lang={lang}
            isRtl={isArabic}
            hydrated={cart.hydrated}
            mapPending={cart.mapPending}
            mapFailed={cart.mapFailed}
            hasCart={cart.hasCart}
            cartView={cart.cartView}
            cartItems={cart.cartItems}
            onRemoveItem={cart.removeItem}
            onToggleBilanComposition={cart.toggleBilanComposition}
            onOpenCatalog={openCatalog}
            onClearCart={cart.clear}
          />
        </SectionShell>

        {/* Ne se replie JAMAIS : c'est la chose que le patient est venu
            chercher, elle ne doit pas coûter un clic. Voir docs/pages/test-rdv.md
            §« Répondre d'abord, réserver ensuite ». */}
        <SectionShell
          id="journey-answer"
          title={t('answer.title')}
          icon={<Sparkles className="h-5 w-5 text-[var(--color-fuchsia-accent)]" />}
          visible={visible.answer}
          collapsible={false}
          open
          onToggle={() => undefined}
        >
          <ImmediateAnswerCard
            isArabic={isArabic}
            hasCart={cart.hasCart}
            complete={cart.answerComplete}
            needsHumanAnswer={form.needsHumanAnswer}
            cartView={cart.cartView}
            preparation={cart.preparation}
            locale={locale}
            currencyLabel={currencyLabel}
          />

          {/* La porte de sortie du patient pressé DOIT être vue, pas devinée
              — c'est le défaut relevé lors de la conception : un précédent
              essai la cachait dans une section repliée marquée « Facultatif »,
              là où personne ne la trouvait. Posée ici, à côté de la réponse,
              jamais avant que la vague 2 soit visible (visible.datetime ==
              intentDone) : le lieu et la date n'existent pas encore avant ça. */}
          {visible.datetime && (
            <div className="mt-5 pt-5 border-t border-[var(--border-default)]">
              <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
                {t('intent.title')}
              </p>
              <div
                role="radiogroup"
                aria-label={t('intent.title')}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <ChoiceCard
                  selected={!form.wantsAppointment}
                  onSelect={() => form.setWantsAppointment(false)}
                  title={t('intent.answer_first_title')}
                  description={t('intent.answer_first_desc')}
                  icon={<Sparkles className="h-5 w-5" />}
                />
                <ChoiceCard
                  selected={form.wantsAppointment}
                  onSelect={() => form.setWantsAppointment(true)}
                  title={t('intent.book_now_title')}
                  description={t('intent.book_now_desc')}
                  icon={<CalendarDays className="h-5 w-5" />}
                />
              </div>
            </div>
          )}
        </SectionShell>

        <SectionShell
          {...shell('want')}
          id="journey-want"
          step={3}
          title={t('want.title')}
          icon={<ListChecks className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />}
          visible={visible.wantToKnow}
        >
          <WantToKnowSection value={form.wantToKnow} onToggle={form.toggleWant} />
        </SectionShell>

        <SectionShell
          {...shell('place')}
          id="journey-place"
          step={4}
          title={t('place.title')}
          icon={<MapPin className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />}
          visible={visible.location}
        >
          <LocationSection
            place={form.samplingPlace}
            onChange={form.setSamplingPlace}
            showAddress={visible.address}
            adresse={form.adresse}
            onAdresse={form.setAdresse}
            instructionsAcces={form.instructionsAcces}
            onInstructionsAcces={form.setInstructionsAcces}
            addressError={addressError}
            addressRequired={form.wantsAppointment}
          />
        </SectionShell>

        <SectionShell
          {...shell('when')}
          id="journey-when"
          step={5}
          title={t('when.title')}
          icon={<CalendarDays className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />}
          visible={visible.datetime}
        >
          <DateTimeSection
            lang={lang}
            selectedDate={form.selectedDate}
            selectedTime={form.selectedTime}
            timeSlots={form.timeSlots}
            isDayBookable={form.isDayBookable}
            onDateChange={form.setDate}
            onTimeChange={form.setTime}
            showHomeMorningNote={form.isHomeService}
            required={form.wantsAppointment}
          />
        </SectionShell>

        <SectionShell
          {...shell('channel')}
          id="journey-channel"
          step={6}
          title={t('channel.title')}
          icon={<MessageCircle className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />}
          visible={visible.channel}
        >
          <ReplyChannelSection value={form.replyChannel} onChange={form.setReplyChannel} />
        </SectionShell>

        <SectionShell
          {...shell('identity')}
          id="journey-identity"
          step={7}
          title={t('identity.title')}
          icon={<UserRound className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />}
          visible={visible.identity}
        >
          <IdentitySection
            nom={form.nom}
            telephone={form.telephone}
            email={form.email}
            phoneError={form.phoneError}
            onNom={form.setNom}
            onTelephone={form.setTelephone}
            onEmail={form.setEmail}
            prefilledFromProfile={form.prefilledFromProfile}
          />
        </SectionShell>

        <SectionShell
          {...shell('access')}
          id="journey-access"
          step={8}
          title={t('access.title')}
          icon={<ShieldCheck className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />}
          visible={visible.access}
        >
          <p className="mb-4 text-sm text-[var(--text-secondary)]">{t('access.subtitle')}</p>
          <ResultsAccessSection lang={lang} enabled={visible.access && openSection === 'access'} />
        </SectionShell>

        {/* L'envoi ne se replie JAMAIS : cacher le bouton derriere une fleche
            cacherait la seule chose que le patient est venu faire. */}
        <SectionShell
          id="journey-submit"
          title={t('submit.title')}
          icon={<Send className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />}
          visible={visible.submit}
          collapsible={false}
          open
          onToggle={() => undefined}
        >
          <SubmitSection
            submitState={submitState}
            isWhatsappLoading={isWhatsappLoading}
            isPreUploading={upload.isUploading}
            hasFiles={upload.files.length > 0}
            submitError={submitError}
            onSubmit={() => void handleSubmit()}
            onWhatsApp={() => void handleWhatsApp()}
          />
        </SectionShell>
      </div>
    </div>
  );
}
