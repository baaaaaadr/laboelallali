/**
 * Date and lab-status formatting for result screens. Same rules as the patient
 * page `/resultats` (whose own local copies are deliberately left as they are),
 * so a doctor and his patient read the same date the same way.
 */

/** « 17 août 2026 » / « 17 غشت 2026 » ; `short` → « 17 août 2026 » with an abbreviated month. */
export function formatDossierDate(iso: string, lang: string, style: 'long' | 'short' = 'long'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
    year: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
  });
}

/** Lab statuses come from CyberLab in English ("Final"); known ones have a translation key. */
const ETAT_LABEL_KEYS: Record<string, string> = {
  final: 'resultats.etat_final',
};

/** The i18n key for a lab status, or null to show the raw value as is. */
export function etatLabelKey(raw: string): string | null {
  return ETAT_LABEL_KEYS[raw.trim().toLowerCase()] ?? null;
}
