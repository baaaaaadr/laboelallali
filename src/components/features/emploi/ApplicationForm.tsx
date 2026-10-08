"use client";

/**
 * The « Emploi & Stage » application form (devis line 27, Dr Aziz, 08/10/2026).
 *
 * One screen in five numbered blocks — the request first (it decides which
 * fields follow), then the person, the path, what weighs in the decision
 * (licence, vehicle, languages), the documents. NO account (owner's decision);
 * a signed-in visitor gets his phone, e-mail and date of birth pre-filled.
 *
 * Validation = the SERVER's rules, imported (`@/lib/emploi/applicationFields`
 * re-exports `functions/src/hr/applicationRules.ts`): what the page accepts is
 * exactly what `submitApplication` accepts. The submit button is never locked —
 * a click on an incomplete form shows every problem at once, scrolls to the
 * first one, and lists them under the button (« a visible clickable element
 * always does something »).
 *
 * Anti-spam, invisible to a person: a trap field (`website`) hidden off-screen,
 * and the time spent on the page (`elapsedMs`) — both judged by the server.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { Send } from 'lucide-react';
import { getClientFunctions } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ChoiceCard } from '@/components/features/journey/SectionShell';
import VerdictPanel from '@/components/ui/VerdictPanel';
import {
  AGE_MAX,
  AGE_MIN,
  DIPLOMA_LEVELS,
  DURATIONS,
  EXPERIENCES,
  FIELD_ORDER,
  KINDS,
  LANGUAGES,
  POSITIONS,
  SCHOOL_LEVELS,
  SOURCES,
  VEHICLES,
  ageOn,
  cvRequired,
  filesError,
  isInternship,
  needsPosition,
  parseApplication,
  type FileKind,
  type Kind,
} from '@/lib/emploi/applicationFields';
import { FILE_ACCEPT, formatSize, prepareFile, type PreparedFile } from '@/lib/emploi/prepareFile';
import { Chips, FieldError, FilePicker, Section, TextField } from './formParts';

interface Values {
  kind: string;
  position: string;
  positionOther: string;
  schoolLevel: string;
  duration: string;
  startDate: string;
  endDate: string;
  availability: string;
  availableFrom: string;
  lastName: string;
  firstName: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  city: string;
  district: string;
  diplomaLevel: string;
  diplomaTitle: string;
  diplomaYear: string;
  school: string;
  experience: string;
  lastEmployer: string;
  license: '' | 'yes' | 'no';
  vehicle: string;
  languages: string[];
  languagesOther: string;
  source: string;
}

const EMPTY: Values = {
  kind: '',
  position: '',
  positionOther: '',
  schoolLevel: '',
  duration: '',
  startDate: '',
  endDate: '',
  availability: '',
  availableFrom: '',
  lastName: '',
  firstName: '',
  dateOfBirth: '',
  phone: '',
  email: '',
  city: '',
  district: '',
  diplomaLevel: '',
  diplomaTitle: '',
  diplomaYear: '',
  school: '',
  experience: '',
  lastEmployer: '',
  license: '',
  vehicle: '',
  languages: [],
  languagesOther: '',
  source: '',
};

/** The label of each field, for the « il manque… » list under the button. */
const FIELD_LABEL: Record<string, [string, string]> = {
  kind: ['emploi.kind_label', 'Votre demande'],
  position: ['emploi.position_label', 'Poste visé'],
  positionOther: ['emploi.position_other_label', 'Précisez le poste'],
  schoolLevel: ['emploi.school_level_label', 'Vous êtes'],
  duration: ['emploi.duration_label', 'Durée souhaitée'],
  startDate: ['emploi.start_date', 'Du'],
  endDate: ['emploi.end_date', 'Au'],
  availability: ['emploi.availability_label', 'Disponibilité'],
  availableFrom: ['emploi.available_from', 'Disponible à partir du'],
  lastName: ['emploi.last_name', 'Nom'],
  firstName: ['emploi.first_name', 'Prénom'],
  dateOfBirth: ['emploi.dob', 'Date de naissance'],
  phone: ['emploi.phone', 'Téléphone'],
  email: ['emploi.email', 'E-mail'],
  city: ['emploi.city', 'Ville'],
  district: ['emploi.district', 'Quartier'],
  diplomaLevel: ['emploi.diploma_level_label', 'Niveau d’études'],
  diplomaTitle: ['emploi.diploma_title', 'Intitulé du diplôme'],
  diplomaYear: ['emploi.diploma_year', 'Année d’obtention'],
  school: ['emploi.school', 'Établissement'],
  experience: ['emploi.experience_label', 'Expérience'],
  lastEmployer: ['emploi.last_employer', 'Dernier employeur'],
  license: ['emploi.license_label', 'Permis de conduire'],
  vehicle: ['emploi.vehicle_label', 'Véhicule'],
  languages: ['emploi.languages_label', 'Langues parlées'],
  languagesOther: ['emploi.languages_other', 'Autre langue'],
  source: ['emploi.source_label', 'Comment nous avez-vous connus ?'],
  cv: ['emploi.cv_label', 'CV'],
  letter: ['emploi.letter_label', 'Lettre de motivation'],
  consent: ['emploi.consent_short', 'Consentement'],
};

type Files = Record<FileKind, PreparedFile | null>;

/** A copy of `o` without `key` (a field the person just corrected). */
function without(o: Record<string, string>, key: string): Record<string, string> {
  const copy = { ...o };
  delete copy[key];
  return copy;
}

interface CallableError {
  code?: string;
  details?: { fields?: Record<string, string> };
}

export default function ApplicationForm({ lang }: { lang: string }) {
  const { t } = useTranslation('common');
  const { user, userProfile } = useAuth();
  const [values, setValues] = useState<Values>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<Files>({ cv: null, letter: null });
  const [fileBusy, setFileBusy] = useState<Record<FileKind, boolean>>({ cv: false, letter: false });
  const [fileErrors, setFileErrors] = useState<Partial<Record<FileKind, string>>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string; firstName: string; email: string } | null>(null);
  const [hp, setHp] = useState('');
  const [prefilled, setPrefilled] = useState(false);
  const startedAt = useRef(Date.now());
  const touched = useRef<Set<string>>(new Set());

  const opt = t('emploi.optional', 'facultatif');
  const kind = (values.kind || '') as Kind | '';

  // Pre-fill once the account is known — never over what he already typed.
  useEffect(() => {
    if (!user && !userProfile) return;
    const fill: Partial<Values> = {};
    const phone = userProfile?.phone || '';
    const email = userProfile?.email || user?.email || '';
    const dob = userProfile?.dateOfBirth || '';
    if (phone && !touched.current.has('phone')) fill.phone = phone;
    if (email && !touched.current.has('email')) fill.email = email;
    if (dob && !touched.current.has('dateOfBirth')) fill.dateOfBirth = dob;
    if (!Object.keys(fill).length) return;
    setValues((v) => ({
      ...v,
      phone: v.phone || fill.phone || '',
      email: v.email || fill.email || '',
      dateOfBirth: v.dateOfBirth || fill.dateOfBirth || '',
    }));
    setPrefilled(true);
  }, [user, userProfile]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    touched.current.add(key);
    setValues((v) => ({ ...v, [key]: value }));
    if (serverErrors[key]) setServerErrors((e) => without(e, key));
  };
  const toggleOne = (key: keyof Values) => (v: string) => set(key, (values[key] === v ? '' : v) as never);
  const toggleLanguage = (l: string) =>
    set('languages', values.languages.includes(l) ? values.languages.filter((x) => x !== l) : [...values.languages, l]);

  /** The form as the server reads it. */
  const formPayload = useMemo(
    () => ({
      ...values,
      license: values.license === 'yes' ? true : values.license === 'no' ? false : undefined,
      diplomaYear: /^\d{4}$/.test(values.diplomaYear.trim()) ? Number(values.diplomaYear.trim()) : values.diplomaYear.trim() || undefined,
      consent,
    }),
    [values, consent]
  );

  const errors = useMemo(() => {
    const res = parseApplication(formPayload, new Date());
    const out: Record<string, string> = res.ok ? {} : { ...res.errors };
    if (kind) {
      const missing = filesError(kind, { cv: !!files.cv, letter: !!files.letter });
      if (missing) out[missing] = 'required';
    }
    for (const [k, v] of Object.entries(fileErrors)) if (v) out[k] = v;
    return { ...out, ...serverErrors };
  }, [formPayload, kind, files, fileErrors, serverErrors]);

  const errText = (field: string): string | null => {
    const code = errors[field];
    if (!code) return null;
    if (!showErrors && !fileErrors[field as FileKind] && !serverErrors[field]) return null;
    if (code === 'required') {
      if (field === 'consent') return t('emploi.err_consent', 'Cochez la case pour envoyer votre candidature.');
      if (field === 'cv' || field === 'letter') return t('emploi.file_err_required', 'Ajoutez votre CV.');
      return t('emploi.err_required', 'Champ obligatoire.');
    }
    if (code === 'age') return t('emploi.err_age', 'Âge accepté : de {{min}} à {{max}} ans.', { min: AGE_MIN, max: AGE_MAX });
    if (code === 'dates') return t('emploi.err_dates', 'La date de fin doit suivre la date de début.');
    if (code === 'too_long') return t('emploi.err_too_long', 'Texte trop long.');
    if (code === 'too_big') return t('emploi.file_err_too_big', 'Fichier trop lourd (5 Mo au plus). Pour une photo, reprenez-la ; pour un PDF, compressez-le.');
    if (code === 'format') return t('emploi.file_err_format', 'Format non accepté : PDF, Word, JPEG ou PNG.');
    if (code === 'read') return t('emploi.file_err_read', 'Ce fichier n’a pas pu être lu. Réessayez.');
    if (field === 'phone') return t('emploi.err_phone', 'Numéro invalide (ex. : 06 12 34 56 78).');
    if (field === 'email') return t('emploi.err_email', 'Adresse e-mail invalide.');
    return t('emploi.err_invalid', 'Valeur invalide.');
  };

  const pickFile = async (k: FileKind, f: File) => {
    setFileBusy((b) => ({ ...b, [k]: true }));
    setFileErrors((e) => ({ ...e, [k]: undefined }));
    setServerErrors((e) => without(e, k));
    const res = await prepareFile(f);
    setFileBusy((b) => ({ ...b, [k]: false }));
    if ('error' in res) {
      setFiles((x) => ({ ...x, [k]: null }));
      setFileErrors((e) => ({ ...e, [k]: res.error }));
      return;
    }
    setFiles((x) => ({ ...x, [k]: res }));
  };
  const clearFile = (k: FileKind) => {
    setFiles((x) => ({ ...x, [k]: null }));
    setFileErrors((e) => ({ ...e, [k]: undefined }));
  };

  const errorFields = FIELD_ORDER.filter((f) => errors[f]);
  const scrollToField = (field: string) => {
    const el = document.querySelector(`[data-field="${field}"]`);
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || fileBusy.cv || fileBusy.letter) return;
    setShowErrors(true);
    setSendError(null);
    if (errorFields.length) {
      scrollToField(errorFields[0]);
      return;
    }
    setSending(true);
    try {
      const functions = await getClientFunctions();
      if (!functions) throw new Error('functions-unavailable');
      const fn = httpsCallable<object, { ok: boolean; ref: string }>(functions, 'submitApplication', { timeout: 120_000 });
      const payloadFiles: Partial<Record<FileKind, { name: string; data: string }>> = {};
      if (files.cv) payloadFiles.cv = { name: files.cv.name, data: files.cv.data };
      if (files.letter) payloadFiles.letter = { name: files.letter.name, data: files.letter.data };
      const res = await fn({
        lang,
        hp,
        elapsedMs: Date.now() - startedAt.current,
        form: formPayload,
        files: payloadFiles,
      });
      setDone({ ref: res.data?.ref || '', firstName: values.firstName.trim(), email: values.email.trim() });
      window.scrollTo({ top: 0 });
    } catch (err) {
      const ce = err as CallableError;
      if (ce?.code === 'functions/invalid-argument' && ce.details?.fields) {
        setServerErrors(ce.details.fields);
        const first = FIELD_ORDER.find((f) => ce.details?.fields?.[f]);
        if (first) scrollToField(first);
        setSendError(t('emploi.err_server_fields', 'Le laboratoire n’a pas pu accepter certaines réponses : corrigez les champs signalés en rouge.'));
      } else if (ce?.code === 'functions/resource-exhausted') {
        setSendError(t('emploi.err_throttled', 'Vous avez déjà envoyé une candidature aujourd’hui. Pour la compléter ou la corriger, appelez le laboratoire.'));
      } else {
        setSendError(t('emploi.err_send', 'L’envoi n’a pas abouti. Vérifiez votre connexion puis réessayez : vos réponses sont conservées.'));
      }
    } finally {
      setSending(false);
    }
  };

  // ── Sent ──────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div data-testid="emploi-done">
        <VerdictPanel
          tone="success"
          title={t('emploi.done_title', 'Candidature envoyée')}
          body={t('emploi.done_body', 'Merci {{name}}. Votre référence : {{ref}}. Nous étudions chaque candidature ; si votre profil correspond, nous vous appellerons.', {
            name: done.firstName,
            ref: done.ref,
          })}
          todo={
            done.email
              ? t('emploi.done_todo_email', 'Un accusé de réception part à {{email}}.', { email: done.email })
              : t('emploi.done_todo_noemail', 'Notez votre référence : elle vous sera demandée si vous appelez le laboratoire.')
          }
          actions={
            <Link href={`/${lang}`} className="button-bordeaux justify-center flex items-center gap-2">
              {t('emploi.done_home', 'Retour à l’accueil')}
            </Link>
          }
        />
      </div>
    );
  }

  const kindOptions = KINDS.map((k) => ({
    value: k,
    title: t(`emploi.kind_${k}`, k),
    description: t(`emploi.kind_${k}_desc`, ''),
  }));
  const options = (list: readonly string[], prefix: string) =>
    list.map((v) => ({ value: v, label: t(`emploi.${prefix}_${v}`, v) }));
  const age = values.dateOfBirth ? ageOn(values.dateOfBirth, new Date()) : null;
  const sizeOf = (k: FileKind) => (files[k] ? formatSize(files[k]!.size, lang) : undefined);

  return (
    <form onSubmit={submit} noValidate className="space-y-6" data-testid="emploi-form">
      {/* Trap for robots: off-screen, out of the tab order, ignored by screen readers. */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
      >
        <label htmlFor="f-website">{t('emploi.hp_label', 'Ne pas remplir')}</label>
        <input id="f-website" name="website" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
      </div>

      <p className="text-sm text-[var(--text-secondary)]">
        {t('emploi.required_note', 'Les champs marqués d’un astérisque (*) sont obligatoires.')}
      </p>

      {/* 1 — The request: it decides the fields that follow. */}
      <Section id="emploi-request" step={1} title={t('emploi.s_request', 'Votre demande')}>
        <div data-field="kind">
          <div role="radiogroup" aria-label={t('emploi.kind_label', 'Votre demande')} className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="emploi-kinds">
            {kindOptions.map((o) => (
              <ChoiceCard
                key={o.value}
                selected={values.kind === o.value}
                onSelect={() => set('kind', o.value)}
                title={o.title}
                description={o.description}
              />
            ))}
          </div>
          <FieldError id="kind" error={errText('kind')} />
        </div>

        {kind && (
          <>
            {kind === 'observation' && (
              <Chips
                id="schoolLevel"
                label={t('emploi.school_level_label', 'Vous êtes')}
                options={options(SCHOOL_LEVELS, 'school')}
                value={values.schoolLevel}
                onToggle={toggleOne('schoolLevel')}
                required
                error={errText('schoolLevel')}
              />
            )}
            <Chips
              id="position"
              label={
                needsPosition(kind)
                  ? t('emploi.position_label', 'Poste visé')
                  : t('emploi.position_label_optional', 'Service qui vous intéresse')
              }
              options={options(POSITIONS, 'position')}
              value={values.position}
              onToggle={toggleOne('position')}
              required={needsPosition(kind)}
              optional={needsPosition(kind) ? undefined : opt}
              error={errText('position')}
            />
            {values.position === 'autre' && (
              <TextField
                id="positionOther"
                label={t('emploi.position_other_label', 'Précisez le poste')}
                value={values.positionOther}
                onChange={(v) => set('positionOther', v)}
                required
                error={errText('positionOther')}
              />
            )}
            {isInternship(kind) ? (
              <>
                <Chips
                  id="duration"
                  label={t('emploi.duration_label', 'Durée souhaitée')}
                  options={options(DURATIONS, 'duration')}
                  value={values.duration}
                  onToggle={toggleOne('duration')}
                  required
                  error={errText('duration')}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    id="startDate"
                    type="date"
                    label={t('emploi.start_date', 'Du')}
                    value={values.startDate}
                    onChange={(v) => set('startDate', v)}
                    optional={opt}
                    error={errText('startDate')}
                  />
                  <TextField
                    id="endDate"
                    type="date"
                    label={t('emploi.end_date', 'Au')}
                    value={values.endDate}
                    onChange={(v) => set('endDate', v)}
                    optional={opt}
                    error={errText('endDate')}
                  />
                </div>
                <p className="-mt-2 text-xs text-[var(--text-tertiary)]">
                  {t('emploi.dates_help', 'Si votre établissement impose des dates, indiquez-les.')}
                </p>
              </>
            ) : (
              <>
                <Chips
                  id="availability"
                  label={t('emploi.availability_label', 'Disponibilité')}
                  options={[
                    { value: 'immediate', label: t('emploi.availability_immediate', 'Immédiate') },
                    { value: 'date', label: t('emploi.availability_date', 'À partir d’une date') },
                  ]}
                  value={values.availability}
                  onToggle={toggleOne('availability')}
                  required
                  error={errText('availability')}
                />
                {values.availability === 'date' && (
                  <TextField
                    id="availableFrom"
                    type="date"
                    label={t('emploi.available_from', 'Disponible à partir du')}
                    value={values.availableFrom}
                    onChange={(v) => set('availableFrom', v)}
                    required
                    error={errText('availableFrom')}
                  />
                )}
              </>
            )}
          </>
        )}
      </Section>

      {/* 2 — The person. */}
      <Section id="emploi-you" step={2} title={t('emploi.s_you', 'Vous')}>
        {prefilled && (
          <p className="text-xs text-[var(--text-tertiary)]">
            {t('emploi.prefilled', 'Certains champs viennent de votre compte : vous pouvez les modifier.')}
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField id="lastName" label={t('emploi.last_name', 'Nom')} value={values.lastName} onChange={(v) => set('lastName', v)} required autoComplete="family-name" error={errText('lastName')} />
          <TextField id="firstName" label={t('emploi.first_name', 'Prénom')} value={values.firstName} onChange={(v) => set('firstName', v)} required autoComplete="given-name" error={errText('firstName')} />
          <TextField
            id="dateOfBirth"
            type="date"
            label={t('emploi.dob', 'Date de naissance')}
            value={values.dateOfBirth}
            onChange={(v) => set('dateOfBirth', v)}
            required
            autoComplete="bday"
            help={age !== null && age >= 0 ? t('emploi.age_value', 'Âge : {{age}} ans', { age }) : undefined}
            error={errText('dateOfBirth')}
          />
          <TextField
            id="phone"
            type="tel"
            label={t('emploi.phone', 'Téléphone')}
            value={values.phone}
            onChange={(v) => set('phone', v)}
            required
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="06 12 34 56 78"
            maxLength={20}
            error={errText('phone')}
          />
          <TextField
            id="email"
            type="email"
            label={t('emploi.email', 'E-mail')}
            value={values.email}
            onChange={(v) => set('email', v)}
            optional={opt}
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            maxLength={120}
            help={t('emploi.email_help', 'Pour recevoir l’accusé de réception.')}
            error={errText('email')}
          />
          <div className="hidden sm:block" aria-hidden="true" />
          <TextField id="city" label={t('emploi.city', 'Ville')} value={values.city} onChange={(v) => set('city', v)} required autoComplete="address-level2" error={errText('city')} />
          <TextField id="district" label={t('emploi.district', 'Quartier')} value={values.district} onChange={(v) => set('district', v)} optional={opt} error={errText('district')} />
        </div>
      </Section>

      {/* 3 — The path. */}
      <Section id="emploi-path" step={3} title={t('emploi.s_path', 'Votre parcours')}>
        <Chips
          id="diplomaLevel"
          label={t('emploi.diploma_level_label', 'Niveau d’études')}
          options={options(DIPLOMA_LEVELS, 'diploma')}
          value={values.diplomaLevel}
          onToggle={toggleOne('diplomaLevel')}
          required
          error={errText('diplomaLevel')}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            id="diplomaTitle"
            label={t('emploi.diploma_title', 'Intitulé du diplôme')}
            value={values.diplomaTitle}
            onChange={(v) => set('diplomaTitle', v)}
            optional={opt}
            placeholder={t('emploi.diploma_title_placeholder', 'Ex. : DTS analyses médicales')}
            maxLength={100}
            error={errText('diplomaTitle')}
          />
          <TextField
            id="diplomaYear"
            label={t('emploi.diploma_year', 'Année d’obtention')}
            value={values.diplomaYear}
            onChange={(v) => set('diplomaYear', v.replace(/[^\d]/g, '').slice(0, 4))}
            optional={opt}
            inputMode="numeric"
            dir="ltr"
            placeholder="2024"
            maxLength={4}
            error={errText('diplomaYear')}
          />
        </div>
        <TextField
          id="school"
          label={t('emploi.school', 'Établissement')}
          value={values.school}
          onChange={(v) => set('school', v)}
          optional={opt}
          maxLength={100}
          error={errText('school')}
        />
        <Chips
          id="experience"
          label={t('emploi.experience_label', 'Expérience')}
          options={options(EXPERIENCES, 'experience')}
          value={values.experience}
          onToggle={toggleOne('experience')}
          required
          error={errText('experience')}
        />
        <TextField
          id="lastEmployer"
          label={t('emploi.last_employer', 'Dernier employeur')}
          value={values.lastEmployer}
          onChange={(v) => set('lastEmployer', v)}
          optional={opt}
          maxLength={100}
          error={errText('lastEmployer')}
        />
      </Section>

      {/* 4 — What also weighs in the decision. */}
      <Section id="emploi-more" step={4} title={t('emploi.s_more', 'Ce qui compte aussi')}>
        <Chips
          id="license"
          label={t('emploi.license_label', 'Permis de conduire')}
          options={[
            { value: 'yes', label: t('emploi.yes', 'Oui') },
            { value: 'no', label: t('emploi.no', 'Non') },
          ]}
          value={values.license}
          onToggle={(v) => set('license', (values.license === v ? '' : v) as Values['license'])}
          required
          error={errText('license')}
        />
        <Chips
          id="vehicle"
          label={t('emploi.vehicle_label', 'Véhicule')}
          options={options(VEHICLES, 'vehicle')}
          value={values.vehicle}
          onToggle={toggleOne('vehicle')}
          required
          help={t('emploi.vehicle_help', 'Utile pour le prélèvement à domicile.')}
          error={errText('vehicle')}
        />
        <Chips
          id="languages"
          label={t('emploi.languages_label', 'Langues parlées')}
          options={options(LANGUAGES, 'lang')}
          value={values.languages}
          onToggle={toggleLanguage}
          multiple
          required
          error={errText('languages')}
        />
        <TextField
          id="languagesOther"
          label={t('emploi.languages_other', 'Autre langue')}
          value={values.languagesOther}
          onChange={(v) => set('languagesOther', v)}
          optional={opt}
          error={errText('languagesOther')}
        />
        <Chips
          id="source"
          label={t('emploi.source_label', 'Comment nous avez-vous connus ?')}
          options={options(SOURCES, 'source')}
          value={values.source}
          onToggle={toggleOne('source')}
          optional={opt}
          error={errText('source')}
        />
      </Section>

      {/* 5 — Documents, consent, sending. */}
      <Section id="emploi-files" step={5} title={t('emploi.s_files', 'Vos documents')}>
        <p className="text-sm text-[var(--text-secondary)]">
          {kind === 'observation'
            ? t('emploi.observation_files_help', 'Pour un stage d’observation, votre CV ou la lettre de votre établissement suffit.')
            : t('emploi.files_help', 'PDF, Word ou photo — 5 Mo au plus. Une photo nette de votre CV papier convient.')}
        </p>
        {(['cv', 'letter'] as FileKind[]).map((k) => (
          <FilePicker
            key={k}
            id={k}
            label={k === 'cv' ? t('emploi.cv_label', 'CV') : t('emploi.letter_label', 'Lettre de motivation')}
            required={k === 'cv' && (!kind || cvRequired(kind))}
            optional={k === 'letter' || (kind && !cvRequired(kind)) ? opt : undefined}
            accept={FILE_ACCEPT}
            file={files[k]}
            sizeLabel={sizeOf(k)}
            busy={fileBusy[k]}
            error={errText(k)}
            onPick={(f) => void pickFile(k, f)}
            onClear={() => clearFile(k)}
            chooseLabel={t('emploi.file_choose', 'Choisir un fichier')}
            replaceLabel={t('emploi.file_replace', 'Remplacer')}
            removeLabel={t('emploi.file_remove', 'Retirer')}
            busyLabel={t('emploi.file_preparing', 'Préparation…')}
          />
        ))}

        <div data-field="consent">
          <label className="flex items-start gap-3 text-sm text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setServerErrors((e) => without(e, 'consent'));
              }}
              className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[var(--color-bordeaux-primary)]"
              data-testid="emploi-consent"
            />
            <span>
              {t(
                'emploi.consent_text',
                'J’accepte que le Laboratoire El Allali utilise ces informations pour étudier ma candidature. Elles sont effacées au bout de 6 mois.'
              )}{' '}
              <Link
                href={`/${lang}/confidentialite#candidatures`}
                target="_blank"
                style={{ color: 'var(--color-bordeaux-primary)', fontWeight: 600 }}
              >
                {t('emploi.consent_link', 'En savoir plus')}
              </Link>
            </span>
          </label>
          <FieldError id="consent" error={errText('consent')} />
        </div>

        <div className="space-y-2">
          <button
            type="submit"
            disabled={sending}
            className="button-bordeaux justify-center flex items-center gap-2 w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
            data-testid="emploi-submit"
          >
            <Send size={18} className="flex-shrink-0" />
            {sending
              ? files.cv || files.letter
                ? t('emploi.sending_files', 'Envoi de vos documents…')
                : t('emploi.sending', 'Envoi en cours…')
              : t('emploi.submit', 'Envoyer ma candidature')}
          </button>
          {showErrors && errorFields.length > 0 && (
            <p className="text-sm text-[var(--status-error)]" data-testid="emploi-missing">
              {t('emploi.missing', 'À compléter ou corriger : {{list}}.', {
                list: errorFields.map((f) => t(FIELD_LABEL[f][0], FIELD_LABEL[f][1])).join(', '),
              })}
            </p>
          )}
          {sendError && (
            <p className="text-sm text-[var(--status-error)]" role="alert" data-testid="emploi-send-error">
              {sendError}
            </p>
          )}
        </div>
      </Section>
    </form>
  );
}
