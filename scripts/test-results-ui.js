#!/usr/bin/env node
/**
 * Banc « résultats » — ce que la page /resultats DEMANDE au serveur, et ce
 * qu'elle AFFICHE.
 *
 *     node scripts/test-results-ui.js          # tous les scénarios
 *     node scripts/test-results-ui.js --head   # avec fenêtre visible
 *
 * La page montée est le code de PRODUCTION, sous le vrai `ResultsProvider`.
 * Seules les frontières externes sont doublées (voir `scripts/testing/README.md`) ;
 * la doublure de Firebase ENREGISTRE chaque appel de fonction. On vérifie donc
 * le nombre, l'ordre et les arguments des appels — pas seulement l'écran.
 *
 * Pourquoi ce banc existe : c'est la garde de non-régression du parcours
 * patient avant l'arrivée de l'espace médecin, qui modifie le contexte partagé
 * des résultats (`src/contexts/ResultsContext.tsx`). Et c'est lui qui a mis en
 * évidence la boucle d'appels après une erreur (scénario S2).
 *
 * ⚠ Aucune feuille de style : structure et textes seulement, jamais l'apparence.
 * ⚠ Données fictives uniquement — aucun nom ni numéro de vrai patient.
 */
const path = require('path');
const { chromium } = require('playwright');
const { SHOTS, build, createReporter, freshPage, calls, visibleText, realErrors, same } = require('./testing/results-bench');

const HEADED = process.argv.includes('--head');
const { scenario, ok, finish } = createReporter();

// ── Données fictives ─────────────────────────────────────────────────────────
const PATIENT = {
  uid: 'uid-patient-banc',
  fullName: 'Patient Banc Essai',
  phone: '0600000000',
  email: 'patient.banc@example.test',
  requester_id: '900001',
  type: 'patient',
};

/** Trois bilans, volontairement PAS dans l'ordre chronologique. */
const PATIENT_DOSSIERS = [
  { dossier_id: 'D-9001-B', patient_nom: '', patient_prenom: '', date_dossier: '2025-03-10T08:00:00Z', etat: 'Final', analyses_summary: 'H NFS^C GLY' },
  { dossier_id: 'D-9001-C', patient_nom: '', patient_prenom: '', date_dossier: '2026-06-02T08:00:00Z', etat: 'Final', analyses_summary: 'C HBA1' },
  { dossier_id: 'D-9001-A', patient_nom: '', patient_prenom: '', date_dossier: '2024-11-20T08:00:00Z', etat: 'Final', analyses_summary: 'N TSH' },
];
const NEWEST = 'D-9001-C';

function serverFor(overrides = {}) {
  return {
    primary: PATIENT.requester_id,
    identities: { [PATIENT.requester_id]: { list: PATIENT_DOSSIERS } },
    delayMs: 40,
    ...overrides,
  };
}

function assertNoErrors(p) {
  const real = realErrors(p);
  return ok('aucune erreur JavaScript', real.length === 0, real.slice(0, 3).join(' | '));
}

// ── Scénarios ────────────────────────────────────────────────────────────────
async function s1PatientNominal(browser) {
  scenario('S1 — patient : la liste sans PDF, puis le PDF du plus récent, et rien d’autre');
  const p = await freshPage(browser, { profile: PATIENT, server: serverFor() });
  await p.getByText(`Dossier ${NEWEST}`).first().waitFor({ timeout: 8000 });
  await p.waitForTimeout(1200);
  const c = await calls(p);
  ok('exactement 2 appels au serveur de résultats', c.length === 2, JSON.stringify(c));
  ok('1er appel : la liste seule, sans PDF, sans identifiant (le serveur résout le primaire)',
    same(c[0], { include_pdf: 'none' }), JSON.stringify(c[0]));
  ok(`2e appel : le PDF du dossier le PLUS RÉCENT (${NEWEST}), pas le premier de la liste`,
    same(c[1], { dossier_id: NEWEST }), JSON.stringify(c[1]));
  const text = await visibleText(p, '#app');
  // Les années sont repliables et seule la plus récente est ouverte par défaut :
  // on vérifie les trois en-têtes d'année, et le bilan de l'année ouverte.
  ok('les trois années de bilans sont présentes (2026, 2025, 2024)', ['2026', '2025', '2024'].every((y) => text.includes(y)));
  ok('le bilan le plus récent est visible', text.includes(NEWEST));
  ok('le badge « Dernier résultat » est présent', /Dernier résultat/.test(text));
  assertNoErrors(p);
  await p.screenshot({ path: path.join(SHOTS, 's1-patient.png'), fullPage: true });
  await p.close();
}

async function s1Arabic(browser) {
  scenario('S1 (ar) — même comportement en arabe');
  const p = await freshPage(browser, { lang: 'ar', profile: PATIENT, server: serverFor() });
  await p.waitForFunction(() => window.__calls.filter((c) => c.name === 'fetchResults').length >= 2, null, { timeout: 8000 });
  await p.waitForTimeout(800);
  const c = await calls(p);
  ok('exactement 2 appels', c.length === 2, JSON.stringify(c));
  const dir = await p.evaluate(() => document.querySelector('#app > div')?.getAttribute('dir'));
  ok('sens de lecture de droite à gauche', dir === 'rtl');
  assertNoErrors(p);
  await p.close();
}

async function s2ErrorNoStorm(browser, code) {
  scenario(`S2 — erreur permanente « ${code} » : pas de boucle d'appels`);
  const p = await freshPage(browser, { profile: PATIENT, server: serverFor({ listError: code, delayMs: 30 }) });
  await p.waitForTimeout(3000);
  const at3 = (await calls(p)).length;
  await p.waitForTimeout(7000);
  const at10 = (await calls(p)).length;
  // Attendu : l'appel initial, puis au plus deux relances automatiques espacées
  // (4 s puis 8 s, identité principale seulement — voir `load` dans
  // ResultsContext). Avant la correction du 23/09/2026 : ~80 appels en 3 s.
  ok('au plus 1 appel dans les 3 premières secondes', at3 <= 1, `${at3} appels`);
  ok('au plus 3 appels en 10 secondes', at10 <= 3, `${at10} appels`);
  const text = await visibleText(p, '#app');
  ok('un message d’erreur est affiché (pas un écran vide)', text.trim().length > 40);
  await p.close();
}

async function s3Relative(browser) {
  scenario('S3 — proche rattaché : chargé à la demande, avec son identifiant, son PDF le plus récent');
  const profile = {
    ...PATIENT,
    linkedRequesters: [{ requester_id: '900002', type: 'patient', label: 'Maman' }],
    linkedRequesterIds: ['900002'],
  };
  const relDossiers = [
    { dossier_id: 'D-9002-A', patient_nom: '', patient_prenom: '', date_dossier: '2026-01-05T08:00:00Z', etat: 'Final', analyses_summary: 'C GLY' },
    { dossier_id: 'D-9002-B', patient_nom: '', patient_prenom: '', date_dossier: '2026-04-05T08:00:00Z', etat: 'Final', analyses_summary: 'C CR' },
  ];
  const server = serverFor({
    identities: { [PATIENT.requester_id]: { list: PATIENT_DOSSIERS }, '900002': { list: relDossiers } },
  });
  const p = await freshPage(browser, { profile, server });
  await p.getByText(`Dossier ${NEWEST}`).first().waitFor({ timeout: 8000 });
  await p.waitForTimeout(600);
  ok('au démarrage : seul le dossier principal est chargé (2 appels)', (await calls(p)).length === 2);
  await p.getByText('Maman').first().click();
  await p.getByText('Dossier D-9002-B').first().waitFor({ timeout: 8000 });
  await p.waitForTimeout(800);
  const c = (await calls(p)).slice(2);
  ok('le proche : 2 appels de plus', c.length === 2, JSON.stringify(c));
  ok('liste du proche : avec SON identifiant, sans PDF', same(c[0], { include_pdf: 'none', requester_id: '900002' }), JSON.stringify(c[0]));
  ok('puis le PDF de SON bilan le plus récent', same(c[1], { dossier_id: 'D-9002-B', requester_id: '900002' }), JSON.stringify(c[1]));
  assertNoErrors(p);
  await p.close();
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n══ Banc « résultats » — /resultats sous le vrai ResultsProvider ══');
  await build();
  const browser = await chromium.launch({ headless: !HEADED });
  try {
    await s1PatientNominal(browser);
    await s1Arabic(browser);
    await s2ErrorNoStorm(browser, 'internal');
    await s2ErrorNoStorm(browser, 'resource-exhausted');
    await s3Relative(browser);
  } finally {
    await browser.close();
  }
  finish();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
