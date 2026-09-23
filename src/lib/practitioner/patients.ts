/**
 * « Mes patients » — turning a doctor's list of lab dossiers into patients.
 *
 * The lab server answers a prescriber's code with a flat list of dossiers
 * (newest first, at most 50), each carrying `patient_nom` / `patient_prenom` —
 * and NO patient identifier (measured 23/09/2026; `patient_id` is ignored).
 * Grouping is therefore done on the NAME, here, in one place.
 *
 * Pure, no React — unit-tested by `scripts/test-practitioner.js`. The server has
 * a twin of `patientKey` (functions/src/admin/adminPractitioner.ts) that counts
 * distinct patients for the admin's « Vérifier » — keep the two identical.
 *
 * ⚠ Known limit, stated in the UI and the docs rather than hidden: two
 * different patients with exactly the same family name and first name are
 * shown as one. Each report keeps its own date and dossier number, which is
 * what the doctor must check. A stable patient id from the lab would remove it.
 */
import type { CyberlabResult } from '@/types/cyberlab';
import { compareDossierDateDesc } from '@/lib/results/dossiers';

/** The lab server's cap for one list: past it, only the most recent reports come back. */
export const LIST_CAP = 50;

/** Accents off, capitals, any punctuation as a space, spaces collapsed. */
export function normalizeName(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * The grouping key of a dossier. Dossiers WITHOUT any name are never merged
 * together — each is its own "patient", keyed on its dossier number: grouping
 * them would put unrelated people's results under one line.
 */
export function patientKey(
  r: Pick<CyberlabResult, 'patient_nom' | 'patient_prenom' | 'dossier_id'>
): string {
  const nom = normalizeName(r.patient_nom);
  const prenom = normalizeName(r.patient_prenom);
  if (!nom && !prenom) return `#dossier:${r.dossier_id}`;
  return `${nom}|${prenom}`;
}

export interface PatientGroup {
  key: string;
  /** As the lab typed them (from the most recent dossier), trimmed. */
  nom: string;
  prenom: string;
  /** Newest first. */
  dossiers: CyberlabResult[];
  /** ISO date of the most recent report. */
  newestDate: string;
  newestDossierId: string;
  /** No name at all on these dossiers. */
  nameless: boolean;
}

/**
 * « EL ALLALI Hassan » — family name in capitals (how the lab and doctors write
 * it), first name capitalised word by word.
 */
export function displayName(g: { nom: string; prenom: string }): string {
  const nom = g.nom.trim().toUpperCase();
  const prenom = g.prenom
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
  return [nom, prenom].filter(Boolean).join(' ');
}

/**
 * One entry per patient, most recent report first; ties broken by name so the
 * order never flickers between two refreshes.
 */
export function groupByPatient(results: CyberlabResult[]): PatientGroup[] {
  const byKey = new Map<string, CyberlabResult[]>();
  for (const r of results) {
    const k = patientKey(r);
    const list = byKey.get(k);
    if (list) list.push(r);
    else byKey.set(k, [r]);
  }
  const groups: PatientGroup[] = [];
  for (const [key, list] of byKey) {
    const dossiers = [...list].sort(compareDossierDateDesc);
    const first = dossiers[0];
    groups.push({
      key,
      nom: (first.patient_nom || '').trim(),
      prenom: (first.patient_prenom || '').trim(),
      dossiers,
      newestDate: first.date_dossier,
      newestDossierId: first.dossier_id,
      nameless: key.startsWith('#dossier:'),
    });
  }
  groups.sort((a, b) => {
    if (a.newestDate !== b.newestDate) return a.newestDate > b.newestDate ? -1 : 1;
    return displayName(a).localeCompare(displayName(b));
  });
  return groups;
}

/**
 * Does a patient match what the doctor typed? Accent- and case-insensitive,
 * word order does not matter (« hassan el allali » finds « EL ALLALI Hassan »):
 * EVERY typed word must appear in the name, or start a dossier number.
 */
export function matchesQuery(g: PatientGroup, query: string): boolean {
  const tokens = normalizeName(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return true;
  const name = ` ${normalizeName(g.nom)} ${normalizeName(g.prenom)} `;
  const ids = g.dossiers.map((d) => d.dossier_id.toUpperCase());
  return tokens.every((t) => name.includes(t) || ids.some((id) => id.startsWith(t)));
}

/** The list reached the lab server's cap: older reports were left out. */
export function isCapped(results: CyberlabResult[]): boolean {
  return results.length >= LIST_CAP;
}
