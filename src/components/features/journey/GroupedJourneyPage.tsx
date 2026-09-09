"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileQuestion,
  ShoppingCart,
  Sparkles,
  ListChecks,
  ClipboardList,
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
import PrescriptionUploadPanel from './sections/PrescriptionUploadPanel';

import { useJourneyCart } from './hooks/useJourneyCart';
import { useJourneyForm } from './hooks/useJourneyForm';
import { usePrescriptionUpload } from './hooks/usePrescriptionUpload';
import { useJourneyDraft } from './hooks/useJourneyDraft';
import { useJourneySections } from './hooks/useJourneySections';
import { useJourneyGroups, countRemainingRequired } from './hooks/useJourneyGroups';
import { useJourneyPersistence } from './hooks/useJourneyPersistence';
import { useJourneySubmission } from './hooks/useJourneySubmission';

import { JOURNEY_V2_SEGMENT } from '@/lib/journey/route';
import { groupOfSection, type JourneyGroupId } from '@/lib/journey/groups';
import type { JourneyVariant } from '@/lib/journey/types';

/**
 * Le parcours patient en QUATRE blocs — la mise en page soumise au Dr Aziz le
 * 09/09/2026, en regard de `/test-rdv` qui en affiche huit.
 *
 * ### Ce qui change, et ce qui ne change pas
 * **Change** : la disposition, et elle seule. Quatre en-têtes dépliants au lieu
 * de huit, chacun portant en clair « Obligatoire » ou « Facultatif ».
 * **Ne change pas** : l'état (`useJourneyForm`), les résumés
 * (`useJourneySections`), le panier, le brouillon, la validation, l'écriture
 * Firestore, l'e-mail et le message WhatsApp — tout cela est PARTAGÉ avec
 * `PatientJourneyPage` via des hooks communs. Une demande envoyée depuis l'une
 * ou l'autre page produit exactement le même document et le même e-mail ; c'est
 * la condition pour que la comparaison porte sur la seule chose qu'on veut
 * arbitrer.
 *
 * ### Les deux cas fréquents, et où ils s'arrêtent
 * Groupe 1 (ce que je veux) → réponse immédiate → groupe 2 (comment me
 * joindre) → *Envoyer*. Le patient qui veut seulement un prix, des conditions
 * de jeûne et un délai n'a jamais à ouvrir les groupes 3 et 4. C'est le sens du
 * choix « Recevoir ma réponse d'abord », posé juste sous la réponse immédiate
 * et jamais dans un bloc replié.
 *
 * ### Sous-blocs, pas sous-accordéons
 * À l'intérieur d'un groupe, les anciennes sections deviennent de simples
 * sous-titres séparés par un filet. Emboîter un accordéon dans un accordéon
 * rendrait les dix étapes à nouveau visibles, une par une : exactement le
 * reproche auquel cette page répond.
 *
 * ⚠ Une seule chose se replie automatiquement : rien. Le patient seul ouvre et
 * ferme — SAUF quand `validate()` refuse l'envoi, auquel cas le bloc fautif
 * s'ouvre et la page y défile. Sans cela, « Merci d'indiquer votre nom »
 * s'affichait au-dessus de quatre blocs tous fermés.
 */
export interface GroupedJourneyPageProps {
  lang: string;
  variant: JourneyVariant;
}

export default function GroupedJourneyPage({ lang, variant }: GroupedJourneyPageProps) {
  return (
    <JourneyAuthGate lang={lang} variant={variant}>
      <GroupedJourneyBody lang={lang} variant={variant} />
    </JourneyAuthGate>
  );
}

/** Un sous-bloc à l'intérieur d'un groupe : un titre discret, puis le contenu. */
function SubSection({
  icon,
  title,
  divider = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  /** Filet de séparation au-dessus — omis pour le premier sous-bloc. */
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={divider ? 'mt-6 pt-5 border-t border-[var(--border-default)]' : ''}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
        <span className="flex-shrink-0 text-[var(--color-bordeaux-primary)]" aria-hidden="true">
          {icon}
        </span>
        <span>{title}</span>
      </h3>
      {children}
    </div>
  );
}

function GroupedJourneyBody({ lang, variant }: GroupedJourneyPageProps) {
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
    segment: JOURNEY_V2_SEGMENT,
    form,
    draft,
    restoredUrls,
    setRestoredUrls,
  });

  // -- Accordéon à quatre portes ----------------------------------------------
  // Tout est replié à l'arrivée, SAUF le bloc 1 tant que l'intention n'est pas
  // exprimée.
  //
  // ⚠ La règle de `/test-rdv` était « ouvrir seulement si le panier est vide ».
  // Transposée ici, elle produisait un écran fautif, relevé au banc d'essai :
  // le patient qui arrive du catalogue A un panier, donc tout se replie — mais
  // les blocs 2, 3 et 4 n'existent pas encore (la vague 2 attend la réponse à
  // « avez-vous une ordonnance ? »). Il voyait donc UNE ligne fermée, et la
  // seule question qui lui restait à traiter était cachée dedans. On ouvre donc
  // sur l'INTENTION, pas sur le panier : dès qu'elle est exprimée, le sommaire
  // a quatre lignes résumées et se suffit.
  //
  // ⚠ Semis unique, au montage. Aucun repliage ni dépliage automatique ensuite
  // — le piège documenté sur `/test-rdv` : une version repliait tout dès que
  // l'intention devenait vraie, et l'étape 1 se refermait au nez du patient
  // avant qu'il ait choisi son mode de transmission.
  const [openGroup, setOpenGroup] = useState<JourneyGroupId | null>(null);
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !cart.hydrated) return;
    seeded.current = true;
    if (!form.intentDone) setOpenGroup('analyses');
  }, [cart.hydrated, form.intentDone]);

  const toggle = useCallback(
    (id: JourneyGroupId) => setOpenGroup((current) => (current === id ? null : id)),
    []
  );

  /**
   * Le bloc vers lequel il faut défiler après un refus de validation. Passer
   * par un état plutôt que d'appeler `scrollIntoView` dans le gestionnaire :
   * le bloc doit d'abord être OUVERT par React, sinon on défile vers un
   * en-tête replié et le champ fautif reste invisible.
   */
  const [focusGroup, setFocusGroup] = useState<JourneyGroupId | null>(null);
  useEffect(() => {
    if (!focusGroup) return;
    const node = document.getElementById(`journey-g-${focusGroup}`);
    setFocusGroup(null);
    if (!node) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, [focusGroup]);

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
      const group = problem.section ? groupOfSection(problem.section) : null;
      if (!group) return;
      setOpenGroup(group);
      setFocusGroup(group);
    }, []),
    t,
  });

  const { visible } = form;

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

  const groups = useJourneyGroups({
    sections,
    intentDone: form.intentDone,
    wantsAppointment: form.wantsAppointment,
    hasCart: cart.hasCart,
    t,
  });

  /** Props communes à chaque bloc : évite de répéter quatre fois les mêmes lignes. */
  const shell = (id: JourneyGroupId) => ({
    open: openGroup === id,
    onToggle: () => toggle(id),
    isRtl: isArabic,
    status: groups[id].status,
    summary: groups[id].summary,
    doneLabel: t('section.done_label'),
    incompleteLabel: t('section.incomplete_label'),
    obligationLabel:
      groups[id].obligation === 'required'
        ? t('section.required_label')
        : t('section.optional_label'),
    obligationTone: groups[id].obligation,
  });

  const remainingRequired = countRemainingRequired(groups);

  return (
    // `relative` : SubmitProgressModal est en `absolute inset-0`.
    <div className="relative max-w-3xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">{t('page_title')}</h1>
        <p className="mt-2 text-[var(--text-secondary)]">{t('page_subtitle')}</p>
        {/* La règle du jeu, écrite une fois pour toutes en haut de page. C'est
            la réponse directe à « que ça soit clair ce qu'ils peuvent zapper
            et ce qui est obligatoire ». */}
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            remainingRequired === 0
              ? 'bg-[var(--status-success)]/10 text-[var(--status-success)]'
              : 'bg-[var(--background-secondary)] text-[var(--text-secondary)]'
          }`}
        >
          {remainingRequired === 0 ? t('group.legend_ready') : t('group.legend')}
        </p>
      </header>

      <div className="space-y-3">
        {/* ── 1 · Vos analyses ─────────────────────────────────────────────
            Ordonnance + panier réunis : ce sont deux façons de répondre à la
            MÊME question (« qu'est-ce qu'on vous fait ? »), et le patient peut
            employer les deux à la fois. */}
        <SectionShell
          {...shell('analyses')}
          id="journey-g-analyses"
          step={1}
          title={t('group.analyses_title')}
          icon={<ClipboardList className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />}
          visible
        >
          <p className="mb-5 text-sm text-[var(--text-secondary)]">{t('group.analyses_intro')}</p>

          <SubSection
            icon={<FileQuestion className="h-4 w-4" />}
            title={t('prescription.question')}
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
          </SubSection>

          {visible.cart && (
            <SubSection
              divider
              icon={<ShoppingCart className="h-4 w-4" />}
              title={t('cart.title')}
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
            </SubSection>
          )}
        </SectionShell>

        {/* ── Votre réponse — HORS accordéon, jamais repliable ──────────────
            C'est la chose que le patient est venu chercher : elle ne doit pas
            coûter un clic. Elle porte aussi la porte de sortie du patient
            pressé (« recevoir ma réponse d'abord »), qui doit être VUE et non
            devinée. */}
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

        {/* ── 2 · Pour vous répondre ───────────────────────────────────────
            Le SEUL bloc obligatoire en plus du premier. Sans lui, le
            laboratoire ne peut rien renvoyer — y compris aux deux cas
            fréquents, qui s'arrêtent ici. */}
        <SectionShell
          {...shell('contact')}
          id="journey-g-contact"
          step={2}
          title={t('group.contact_title')}
          icon={<UserRound className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />}
          visible={visible.identity}
        >
          <p className="mb-5 text-sm text-[var(--text-secondary)]">{t('group.contact_intro')}</p>

          <SubSection icon={<UserRound className="h-4 w-4" />} title={t('identity.title')}>
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
          </SubSection>

          <SubSection
            divider
            icon={<MessageCircle className="h-4 w-4" />}
            title={t('channel.title')}
          >
            <ReplyChannelSection value={form.replyChannel} onChange={form.setReplyChannel} />
          </SubSection>
        </SectionShell>

        {/* ── 3 · Votre rendez-vous ────────────────────────────────────────
            Facultatif tant que le patient n'a pas choisi « réserver un créneau
            maintenant ». Le bloc reste VISIBLE dans les deux cas (règle non
            destructive de `useJourneyForm`) : masquer une section effacerait la
            saisie de qui revient sur ses pas. */}
        <SectionShell
          {...shell('rendezvous')}
          id="journey-g-rendezvous"
          step={3}
          title={t('group.rendezvous_title')}
          icon={<CalendarDays className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />}
          visible={visible.location}
        >
          <p className="mb-5 text-sm text-[var(--text-secondary)]">
            {form.wantsAppointment
              ? t('group.rendezvous_intro')
              : t('group.rendezvous_optional_note')}
          </p>

          <SubSection icon={<MapPin className="h-4 w-4" />} title={t('place.title')}>
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
          </SubSection>

          <SubSection divider icon={<CalendarDays className="h-4 w-4" />} title={t('when.title')}>
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
          </SubSection>
        </SectionShell>

        {/* ── 4 · Pour aller plus loin ─────────────────────────────────────
            Tout ce qui peut être ignoré sans aucune conséquence sur la
            demande. Placé en dernier, exprès. */}
        <SectionShell
          {...shell('plus')}
          id="journey-g-plus"
          step={4}
          title={t('group.plus_title')}
          icon={<ListChecks className="h-5 w-5 text-[var(--color-bordeaux-primary)]" />}
          visible={visible.wantToKnow}
        >
          <p className="mb-5 text-sm text-[var(--text-secondary)]">{t('group.plus_intro')}</p>

          <SubSection icon={<ListChecks className="h-4 w-4" />} title={t('want.title')}>
            <WantToKnowSection value={form.wantToKnow} onToggle={form.toggleWant} />
          </SubSection>

          <SubSection divider icon={<ShieldCheck className="h-4 w-4" />} title={t('access.title')}>
            <p className="mb-4 text-sm text-[var(--text-secondary)]">{t('access.subtitle')}</p>
            {/* `enabled` n'interroge le serveur que lorsque le bloc est
                réellement ouvert : la vérification d'accès est un appel
                authentifié, inutile tant que personne ne la regarde. */}
            <ResultsAccessSection lang={lang} enabled={openGroup === 'plus'} />
          </SubSection>
        </SectionShell>

        {/* ── Envoi — jamais repliable ─────────────────────────────────────
            Cacher le bouton derrière une flèche cacherait la seule chose que
            le patient est venu faire. */}
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
