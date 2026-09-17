'use client';

/**
 * "Who are you consulting for?" — picks between the account holder's own lab
 * dossier and the relatives' dossiers the lab has attached to the account.
 *
 * Shared by `/resultats` (the results list) and `/profile` (the patient-code
 * card), so the two can never disagree about who is selected or how it is
 * labelled.
 *
 * Renders nothing for a single identity: a selector with one option is noise,
 * and every account had exactly one identity before this feature existed.
 *
 * Up to three identities it reuses `TabsNavigation`, whose compact mode spreads
 * the tabs across the full width — the real-world case is "me + my two parents",
 * and tabs make the current choice visible without a tap. Beyond three, that
 * component falls back to a scrollable rail whose arrows are `hidden lg:flex`,
 * i.e. no affordance at all on a phone, so we switch to a plain labelled
 * `<select>` instead.
 */

import React from 'react';
import { User, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import TabsNavigation, { type TabItem } from '@/components/features/catalog/TabsNavigation';
import type { Identity } from '@/lib/results/identities';

/** Above this many identities, tabs stop being usable on a phone. */
const MAX_TABS = 3;

export interface IdentitySelectorProps {
  identities: Identity[];
  /** Currently selected `requester_id`. */
  value: string;
  onChange: (requesterId: string) => void;
  isRtl?: boolean;
  /** Overrides the default "Pour qui consultez-vous ?" label. */
  label?: string;
  className?: string;
}

export function IdentitySelector({
  identities,
  value,
  onChange,
  isRtl = false,
  label,
  className,
}: IdentitySelectorProps) {
  const { t } = useTranslation('common');

  if (identities.length <= 1) return null;

  const legend = label ?? t('identity.selector_label', 'Pour qui consultez-vous ?');

  if (identities.length <= MAX_TABS) {
    const tabs: TabItem[] = identities.map((identity) => ({
      id: identity.requester_id,
      label: identity.label,
      // TabsNavigation requires an icon; the holder's own dossier gets the solo
      // silhouette so "me" is recognisable before reading the label.
      icon: identity.isSelf ? User : Users,
    }));

    return (
      <div className={className} role="group" aria-label={legend}>
        <p className="text-sm font-medium mb-2 text-[var(--text-secondary)]">{legend}</p>
        <TabsNavigation tabs={tabs} activeTab={value} onTabChange={onChange} isRtl={isRtl} />
      </div>
    );
  }

  return (
    <div className={className}>
      <label
        htmlFor="identity-selector"
        className="block text-sm font-medium mb-2 text-[var(--text-secondary)]"
      >
        {legend}
      </label>
      <select
        id="identity-selector"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[44px] rounded-lg border border-[var(--border-default)] bg-[var(--background-card)] px-3 py-2 text-[var(--text-primary)]"
      >
        {identities.map((identity) => (
          <option key={identity.requester_id} value={identity.requester_id}>
            {identity.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default IdentitySelector;
