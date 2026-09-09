"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
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

import { useAuth } from '@/contexts/AuthContext';

import JourneyAuthGate from './JourneyAuthGate';
import SectionShell, { ChoiceCard } from './SectionShell';
import PrescriptionSection from './sections/PrescriptionSection';
import PrescriptionUploadPanel from './sections/PrescriptionUploadPanel';
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
import { useJourneyPersistence } from './hooks/useJourneyPersistence';
import { useJourneySubmission } from './hooks/useJourneySubmission';

import { JOURNEY_SEGMENT } from '@/lib/journey/route';
import type { JourneyVariant } from '@/lib/journey/types';

/**
 * Parcours patient unifié : de "avez-vous une ordonnance ?" jusqu'à l'activation
 * de l'accès aux résultats, sur une seule page qui se déroule.
 *
 * Remplace à terme `/rendez-vous` et `/glabo`, qui sont aujourd'hui deux copies
 * divergentes du même formulaire de 700 lignes et n'ont aucun lien avec le
 * panier du catalogue. Voir `docs/pages/test-rdv.md`.
 *
 * ⚠ Cette page est la mise en page à HUIT blocs numérotés. Une seconde,
 * `GroupedJourneyPage` (`/test-rdv2`), pose exactement les mêmes questions en
 * QUATRE groupes ; le laboratoire arbitre entre les deux. Tout ce qui n'est pas
 * de la disposition — état, résumés, brouillon, validation, envoi — vit dans
 * des hooks PARTAGÉS (`useJourneyForm`, `useJourneySections`,
 * `useJourneyPersistence`, `useJourneySubmission`). Ne jamais réintroduire ici
 * une logique d'envoi locale : la page perdante disparaîtra, et avec elle tout
 * correctif qui n'aurait vécu que dans l'une des deux.
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
  const isArabic = lang === 'ar';
  const locale = isArabic ? 'ar-MA' : 'fr-MA';
  const currencyLabel = t('catalog:card.price_currency', 'DH');

  const cart = useJourneyCart();
  const upload = usePrescriptionUpload();
  const draft = useJourneyDraft();

  /** URL d'ordonnances restaurées d'un brouillon (les `File` ne survivent pas). */
  const [restoredUrls, setRestoredUrls] = useState<string[]>([]);

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

  const { openCatalog } = useJourneyPersistence({
    lang,
    variant,
    segment: JOURNEY_SEGMENT,
    form,
    draft,
    restoredUrls,
    setRestoredUrls,
  });

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
  // choisir un mode de transmission. Le patient seul ouvre et ferme — la SEULE
  // exception est un refus de validation, qui ouvre la section fautive.
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

  /** Défile vers la section fautive UNE FOIS que React l'a ouverte. */
  const [focusSection, setFocusSection] = useState<string | null>(null);
  useEffect(() => {
    if (!focusSection) return;
    const node = document.getElementById(`journey-${focusSection}`);
    setFocusSection(null);
    if (!node) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, [focusSection]);

  const submission = useJourneySubmission({
    lang,
    variant,
    uid: user?.uid ?? '',
    form,
    cart,
    upload,
    restoredUrls,
    setRestoredUrls,
    clearDraft: draft.clear,
    onValidationProblem: useCallback((problem: { section: string | null }) => {
      if (!problem.section) return;
      setOpenSection(problem.section);
      setFocusSection(problem.section);
    }, []),
    t,
  });

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
              <PrescriptionUploadPanel
                upload={upload}
                restoredUrls={restoredUrls}
                onDiscardRestored={() => setRestoredUrls([])}
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
            addressError={submission.addressError}
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
            submitState={submission.submitState}
            isWhatsappLoading={submission.isWhatsappLoading}
            isPreUploading={upload.isUploading}
            hasFiles={upload.files.length > 0}
            submitError={submission.submitError}
            onSubmit={submission.handleSubmit}
            onWhatsApp={submission.handleWhatsApp}
          />
        </SectionShell>
      </div>
    </div>
  );
}
