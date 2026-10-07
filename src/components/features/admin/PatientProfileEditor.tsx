'use client';

/**
 * « Corriger le profil » — the front desk fixes what a patient mistyped at
 * signup (staff request, 07/10/2026): a wrong date of birth, a nickname or an
 * abbreviated name — which made the patient hard to find in the search —, a
 * wrong phone number.
 *
 * Shown in place of the identity block of the « Compte sélectionné » card, on
 * « Modifier le profil ». Presentational: the callable (`adminUpdateProfile`,
 * staff level, every correction traced server-side in `adminProfileEdits`)
 * lives in `/admin/page.tsx`.
 *
 * The e-mail is NOT editable: it is the patient's login.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2, Save } from 'lucide-react';

export interface ProfileFields {
  fullName: string;
  dateOfBirth: string;
  phone: string;
}

interface Props {
  initial: ProfileFields;
  email: string | null;
  busy: boolean;
  error: string | null;
  onSave: (fields: ProfileFields) => void;
  onCancel: () => void;
}

export default function PatientProfileEditor({ initial, email, busy, error, onSave, onCancel }: Props) {
  const { t } = useTranslation('common');
  const [draft, setDraft] = useState<ProfileFields>(initial);

  const name = draft.fullName.replace(/\s+/g, ' ').trim();
  const digits = draft.phone.replace(/\D+/g, '');
  const changed =
    name !== initial.fullName.trim() || draft.dateOfBirth !== initial.dateOfBirth || draft.phone.trim() !== initial.phone.trim();

  // A locked button always says why.
  let lockReason: string | null = null;
  if (name.length < 2) lockReason = t('admin.profile_need_name', 'Indiquez le nom complet.');
  else if (!draft.dateOfBirth) lockReason = t('admin.profile_need_dob', 'Indiquez la date de naissance.');
  else if (digits.length < 8) lockReason = t('admin.profile_need_phone', 'Indiquez un téléphone valide (au moins 8 chiffres).');
  else if (!changed) lockReason = t('admin.profile_no_change', 'Aucune modification pour l’instant.');

  const inputClass =
    'w-full rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm';
  const labelClass = 'block text-sm font-medium text-[var(--text-secondary)] mb-1';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!lockReason && !busy) onSave({ fullName: name, dateOfBirth: draft.dateOfBirth, phone: draft.phone.trim() });
      }}
      className="space-y-4 flex-1 min-w-0"
      data-testid="profile-editor"
    >
      <p className="text-sm text-[var(--text-secondary)]">
        {t(
          'admin.profile_hint',
          'Corrigez les fautes de saisie du patient : son nom complet (prénom et nom, sans surnom ni abréviation), sa date de naissance, son téléphone. La correction est enregistrée à votre nom.'
        )}
      </p>
      <div>
        <label htmlFor="profile-fullname" className={labelClass}>
          {t('admin.profile_name', 'Nom complet')}
        </label>
        <input
          id="profile-fullname"
          type="text"
          maxLength={80}
          value={draft.fullName}
          onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
          className={inputClass}
          autoComplete="off"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="profile-dob" className={labelClass}>
            {t('admin.dob_label', 'Date de naissance')}
          </label>
          <input
            id="profile-dob"
            type="date"
            value={draft.dateOfBirth}
            onChange={(e) => setDraft((d) => ({ ...d, dateOfBirth: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="profile-phone" className={labelClass}>
            {t('admin.profile_phone', 'Téléphone')}
          </label>
          <input
            id="profile-phone"
            type="tel"
            dir="ltr"
            maxLength={20}
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            className={inputClass}
            autoComplete="off"
          />
        </div>
      </div>
      {email && (
        <p className="text-xs text-[var(--text-secondary)]">
          {t('admin.profile_email_ro', 'E-mail : {{email}} — c’est l’identifiant de connexion du patient, il ne se modifie pas ici.', {
            email,
          })}
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-[var(--status-error)]">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={!!lockReason || busy}
            className="button-bordeaux justify-center flex items-center gap-2 w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
            data-testid="profile-save"
          >
            {busy ? <Loader2 size={18} className="animate-spin flex-shrink-0" /> : <Save size={18} className="flex-shrink-0" />}
            {busy ? t('admin.profile_saving', 'Enregistrement…') : t('admin.profile_save', 'Enregistrer les corrections')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[44px] px-4 rounded-lg text-sm text-[var(--text-secondary)]"
            data-testid="profile-cancel"
          >
            {t('cancel', 'Annuler')}
          </button>
        </div>
        {lockReason && !busy && (
          <p className="text-xs text-[var(--text-secondary)]" data-testid="profile-why">
            {lockReason}
          </p>
        )}
      </div>
    </form>
  );
}
