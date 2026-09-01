/**
 * Development-only fixture for the hero panel.
 *
 * `?heroPanel=reminder` forces the STATE but not the DATA: without a real
 * CyberLab account there is no counter to watch, no PDF to open and no analyses
 * to expand — so the richest state of the widget would be untestable.
 *
 * Loaded through a dynamic `import()` inside the `NODE_ENV === 'development'`
 * branch of `HeroPersonalPanel`, so none of this reaches a production bundle.
 * Verify after `npm run build` by grepping `.next/static` for FIXTURE_MARKER.
 *
 * The PDF is generated with jsPDF (already a dependency, used by the quote
 * generator) rather than embedded as a base64 blob: nothing to review, nothing
 * to accidentally ship, and obviously not a real patient document.
 */

import type { CyberlabResult } from '@/types/cyberlab';

export const FIXTURE_MARKER = 'HERO_PANEL_DEV_FIXTURE';

/** 4 months, 12 days, 6 h, 31 min and 44 s ago — a recognisable counter. */
function demoDateIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 4);
  d.setDate(d.getDate() - 12);
  d.setHours(d.getHours() - 6, d.getMinutes() - 31, d.getSeconds() - 44);
  return d.toISOString();
}

/**
 * Real-world `analyses_summary` shape: caret-separated, prefixed codes with
 * internal spaces. Includes a code the catalog cannot resolve, to exercise the
 * "show the raw code" fallback.
 */
const DEMO_SUMMARY =
  'H NFS^T GRS^C GLY^C HBA1^C CR^C ACU^C CHOL^C TRIG^EZASAT^EZALAT^S HVC^S HBV^ZZZ INCONNU';

export const DEMO_RESULT: CyberlabResult = {
  dossier_id: '999999999',
  patient_nom: '',
  patient_prenom: '',
  date_dossier: demoDateIso(),
  etat: 'Final',
  analyses_summary: DEMO_SUMMARY,
  pdf_base64: '',
};

/** Builds a throwaway 1-page PDF. Never a real medical document. */
export async function demoPdfBase64(): Promise<string> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('DEMO — ' + FIXTURE_MARKER, 20, 30);
  doc.setFontSize(11);
  doc.text('Document factice de developpement.', 20, 45);
  doc.text('Aucune donnee patient.', 20, 55);
  return doc.output('datauristring').split(',')[1] ?? '';
}
