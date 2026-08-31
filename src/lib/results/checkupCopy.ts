/**
 * The one place that turns "months since the last bilan" into an i18n key.
 *
 * Shared by the results page reminder (`CheckupReminder`) and the home hero panel
 * (`HeroPersonalPanel`). Those two show the SAME sentence in two very different
 * skins; the thresholds and the keys are the only thing they have in common, so
 * they live here rather than being written twice and drifting apart.
 *
 * No React, no `'use client'` — pure, like `./stats`.
 *
 * ⚠ Adding a bucket means adding **12 locale entries**: French needs `_one` and
 * `_other`, Arabic needs the six CLDR forms (`_zero`, `_one`, `_two`, `_few`,
 * `_many`, `_other`). The existing `checkup_title_months` / `_years` keys already
 * carry all of them — copy their shape.
 */

export interface CheckupTitle {
  /** i18n key, namespace `common`. */
  key: string;
  /** Interpolated as `{{count}}`; also drives plural selection. */
  count?: number;
}

/**
 * Pick the title for a bilan that is `months` old.
 *
 * Returns `null` when `months` is null (unparseable or future `date_dossier`) —
 * callers decide what to do with that: `/resultats` hides the reminder entirely,
 * the home panel falls back to its dataless generic message.
 */
export function checkupTitle(months: number | null): CheckupTitle | null {
  if (months === null) return null;
  if (months === 0) return { key: 'resultats.checkup_title_recent' };
  if (months < 12) return { key: 'resultats.checkup_title_months', count: months };
  if (months < 24) return { key: 'resultats.checkup_title_year' };
  return { key: 'resultats.checkup_title_years', count: Math.floor(months / 12) };
}
