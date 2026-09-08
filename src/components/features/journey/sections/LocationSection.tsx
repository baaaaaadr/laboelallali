"use client";

import React from 'react';
import { Building2, Home, Briefcase, MapPin, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ChoiceCard } from '../SectionShell';
import { SAMPLING_PLACES, type SamplingPlace } from '@/lib/journey/types';

/**
 * Où le patient veut être prélevé. Trois lieux, contre deux dans la maquette
 * initiale : le brief ajoute le lieu de travail, que /glabo gérait déjà via son
 * champ `lieuPrelevement` (`domicile` | `travail`).
 *
 * L'adresse et les indications d'accès n'apparaissent QUE pour domicile et
 * travail — c'est la demande explicite du brief, et cela évite de faire saisir
 * une adresse inutile aux trois quarts des patients.
 *
 * ⚠ Côté envoi, `travail` reste un service à domicile
 * (`type: 'home_service_appointment'`, `locationType: 'travail'`), exactement
 * comme aujourd'hui : le suivi du laboratoire s'appuie sur ces valeurs.
 */
export interface LocationSectionProps {
  place: SamplingPlace;
  onChange: (place: SamplingPlace) => void;
  showAddress: boolean;
  adresse: string;
  onAdresse: (value: string) => void;
  instructionsAcces: string;
  onInstructionsAcces: (value: string) => void;
  addressError?: string;
}

const ICONS: Record<SamplingPlace, React.ReactNode> = {
  laboratoire: <Building2 className="h-5 w-5" />,
  domicile: <Home className="h-5 w-5" />,
  travail: <Briefcase className="h-5 w-5" />,
};

export default function LocationSection({
  place,
  onChange,
  showAddress,
  adresse,
  onAdresse,
  instructionsAcces,
  onInstructionsAcces,
  addressError,
}: LocationSectionProps) {
  const { t } = useTranslation('journey');

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label={t('place.title')} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SAMPLING_PLACES.map((p) => (
          <ChoiceCard
            key={p}
            selected={place === p}
            onSelect={() => onChange(p)}
            title={t(`place.${p}`)}
            description={t(`place.${p}_desc`)}
            icon={ICONS[p]}
          />
        ))}
      </div>

      {showAddress && (
        <div className="space-y-4 pt-5 border-t border-[var(--border-default)]">
          <div>
            <label
              htmlFor="journey-adresse"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
            >
              <MapPin className="inline h-4 w-4 me-1.5 text-[var(--color-bordeaux-primary)]" aria-hidden="true" />
              {place === 'travail' ? t('place.address_label_work') : t('place.address_label_home')}
              <span className="text-[var(--status-error)] ms-1">*</span>
            </label>
            <input
              id="journey-adresse"
              type="text"
              required
              value={adresse}
              onChange={(e) => onAdresse(e.target.value)}
              autoComplete="street-address"
              placeholder={t('place.address_placeholder')}
              aria-invalid={Boolean(addressError)}
              className={`block w-full rounded-lg border bg-[var(--background-default)] text-[var(--text-primary)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] ${
                addressError ? 'border-[var(--status-error)]' : 'border-[var(--border-default)]'
              }`}
            />
            {addressError && (
              <p className="mt-1 text-xs text-[var(--status-error)]" role="alert">
                {addressError}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="journey-acces"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
            >
              <KeyRound className="inline h-4 w-4 me-1.5 text-[var(--color-bordeaux-primary)]" aria-hidden="true" />
              {t('place.access_label')}
            </label>
            <input
              id="journey-acces"
              type="text"
              value={instructionsAcces}
              onChange={(e) => onInstructionsAcces(e.target.value)}
              placeholder={t('place.access_placeholder')}
              className="block w-full rounded-lg border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)]"
            />
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{t('place.access_help')}</p>
          </div>

          <p className="text-xs text-[var(--text-tertiary)]">{t('place.fee_note')}</p>
        </div>
      )}
    </div>
  );
}
