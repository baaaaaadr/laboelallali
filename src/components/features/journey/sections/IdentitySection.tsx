"use client";

import React from 'react';
import { User, Phone, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Coordonnées du patient, pré-remplies depuis son profil Firestore et
 * modifiables (il peut prendre rendez-vous pour un proche, ou donner un autre
 * numéro que celui de son compte).
 *
 * ⚠ Le pré-remplissage ne doit jamais écraser une saisie en cours : c'est
 * `identityTouched` dans `useJourneyForm` qui le garantit, le profil Firestore
 * pouvant arriver après que le patient a commencé à taper.
 */
export interface IdentitySectionProps {
  nom: string;
  telephone: string;
  email: string;
  phoneError: string;
  onNom: (value: string) => void;
  onTelephone: (value: string) => void;
  onEmail: (value: string) => void;
  prefilledFromProfile: boolean;
}

export default function IdentitySection({
  nom,
  telephone,
  email,
  phoneError,
  onNom,
  onTelephone,
  onEmail,
  prefilledFromProfile,
}: IdentitySectionProps) {
  const { t } = useTranslation(['journey', 'appointment', 'common']);

  const inputClass =
    'block w-full ps-10 pe-3 py-3 rounded-lg border bg-[var(--background-default)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)]';

  return (
    <div className="space-y-4">
      {prefilledFromProfile && (
        <p className="text-xs text-[var(--text-tertiary)]">{t('identity.prefilled_note')}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="journey-nom"
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            {t('appointment:fullName', 'Nom complet')}
            <span className="text-[var(--status-error)] ms-1">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-[var(--text-tertiary)]" aria-hidden="true" />
            </div>
            <input
              id="journey-nom"
              type="text"
              required
              autoComplete="name"
              value={nom}
              onChange={(e) => onNom(e.target.value)}
              placeholder="Ahmed Benali"
              className={`${inputClass} border-[var(--border-default)]`}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="journey-tel"
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            {t('appointment:phoneNumber', 'Téléphone')}
            <span className="text-[var(--status-error)] ms-1">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
              <Phone className="h-5 w-5 text-[var(--text-tertiary)]" aria-hidden="true" />
            </div>
            <input
              id="journey-tel"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              value={telephone}
              onChange={(e) => onTelephone(e.target.value)}
              placeholder="06 XX XX XX XX / +212..."
              aria-invalid={Boolean(phoneError)}
              className={`${inputClass} ${
                phoneError ? 'border-[var(--status-error)]' : 'border-[var(--border-default)]'
              }`}
            />
          </div>
          {phoneError && (
            <p className="mt-1 text-xs text-[var(--status-error)]" role="alert">
              {phoneError}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="journey-email"
          className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
        >
          {t('appointment:email', 'E-mail')}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
            <Mail className="h-5 w-5 text-[var(--text-tertiary)]" aria-hidden="true" />
          </div>
          <input
            id="journey-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="exemple@email.com"
            className={`${inputClass} border-[var(--border-default)]`}
          />
        </div>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{t('identity.email_help')}</p>
      </div>
    </div>
  );
}
