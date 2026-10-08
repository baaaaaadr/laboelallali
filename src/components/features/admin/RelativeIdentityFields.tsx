'use client';

/**
 * The three fields of a relative's identity — last name, first name, date of
 * birth — typed AS IN QALAM when a relative's dossier is attached (Dr Aziz,
 * 08/10/2026). The lab server never sends a patient's name, so these are the
 * only way to find « Maman » by her own name in the admin search, and to
 * recognise her when she later creates her own account.
 *
 * Presentational: the value lives in the caller (page or card), like every
 * admin draft. When the dossier was probed (« Tester »), the name the lab
 * returned (« NIA fatima ») is offered in one click — split on its capitals.
 * Used by `LinkedRequestersCard` (attach, move, complete), the Demandes tab
 * (« Accès pour : un proche ») and `RelativeRequestsSection`.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import { splitLabName, type IdentityField, type RelativeIdentity } from '@/lib/results/relativeIdentity';

interface Props {
  /** Prefix of the inputs' ids and test ids (unique on the page). */
  idPrefix: string;
  value: RelativeIdentity;
  onChange: (patch: Partial<RelativeIdentity>) => void;
  /** The name the lab returned for this dossier, when it was probed. */
  labName?: string;
  /** The field to point at (refused by the form or the server). */
  invalid?: IdentityField | null;
  /** Show the « why » line under the fields (once per form). */
  showWhy?: boolean;
}

export default function RelativeIdentityFields({ idPrefix, value, onChange, labName, invalid, showWhy = true }: Props) {
  const { t } = useTranslation('common');
  const split = labName ? splitLabName(labName) : null;
  const canCopy =
    !!split && (split.lastName !== value.lastName.trim() || split.firstName !== value.firstName.trim());
  const today = new Date().toISOString().slice(0, 10);
  const inputClass = (field: IdentityField) =>
    `w-full rounded-lg px-3 py-2.5 border bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm ${
      invalid === field ? 'border-[var(--status-error)]' : 'border-[var(--border-default)]'
    }`;
  const label = 'block text-sm font-medium text-[var(--text-secondary)] mb-1';

  return (
    <div className="space-y-2" data-testid={`${idPrefix}-identity`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor={`${idPrefix}-last`} className={label}>
            {t('admin.rel_last_name', 'Nom du proche')}
          </label>
          <input
            id={`${idPrefix}-last`}
            type="text"
            maxLength={60}
            value={value.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            placeholder={t('admin.rel_last_name_placeholder', 'Ex. : NIA')}
            aria-invalid={invalid === 'lastName'}
            className={inputClass('lastName')}
            data-testid={`${idPrefix}-last`}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-first`} className={label}>
            {t('admin.rel_first_name', 'Prénom du proche')}
          </label>
          <input
            id={`${idPrefix}-first`}
            type="text"
            maxLength={60}
            value={value.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            placeholder={t('admin.rel_first_name_placeholder', 'Ex. : Fatima')}
            aria-invalid={invalid === 'firstName'}
            className={inputClass('firstName')}
            data-testid={`${idPrefix}-first`}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-dob`} className={label}>
            {t('admin.rel_dob', 'Date de naissance du proche')}
          </label>
          <input
            id={`${idPrefix}-dob`}
            type="date"
            max={today}
            min="1900-01-01"
            value={value.dateOfBirth}
            onChange={(e) => onChange({ dateOfBirth: e.target.value })}
            aria-invalid={invalid === 'dateOfBirth'}
            className={inputClass('dateOfBirth')}
            data-testid={`${idPrefix}-dob`}
          />
        </div>
      </div>
      {canCopy && split && (
        <button
          type="button"
          onClick={() => onChange({ lastName: split.lastName, firstName: split.firstName })}
          className="flex items-center gap-1.5 min-h-[40px] text-sm font-medium underline text-[var(--text-primary)]"
          style={{ background: 'transparent' }}
          data-testid={`${idPrefix}-labname`}
        >
          <Copy size={14} className="flex-shrink-0" />
          {t('admin.rel_copy_lab_name', 'Reprendre le nom renvoyé par le laboratoire : {{name}}', { name: labName })}
        </button>
      )}
      {showWhy && (
        <p className="text-xs text-[var(--text-secondary)]">
          {t(
            'admin.rel_identity_why',
            'Comme dans Qalam. C’est ce qui permet de retrouver ce proche dans la recherche, et de le reconnaître s’il crée un jour son propre compte.'
          )}
        </p>
      )}
    </div>
  );
}
