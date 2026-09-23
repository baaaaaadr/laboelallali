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
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'node_modules', '.cache', 'results-tests');
const BUNDLE = path.join(OUT_DIR, 'harness.js');
const SHOTS = path.join(OUT_DIR, 'captures');
const HEADED = process.argv.includes('--head');

// ── Compilation ──────────────────────────────────────────────────────────────
async function build() {
  const T = (f) => path.join(ROOT, 'scripts', 'testing', f);
  const AUTH_STUB = T('stub-auth-store.tsx');
  fs.mkdirSync(SHOTS, { recursive: true });
  // ⚠ Toujours l'API JavaScript d'esbuild : lancer le binaire `.cmd` par
  // `spawn` échoue en EINVAL sous Windows depuis Node 20. Et l'API ASYNCHRONE :
  // `buildSync` refuse les greffons, or il en faut un (voir plus bas).
  await require('esbuild').build({
    entryPoints: [T('results-harness-entry.tsx')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    outfile: BUNDLE,
    define: { 'process.env.NODE_ENV': '"development"' },
    banner: {
      js: 'window.process = window.process || { env: { NODE_ENV: "development" }, browser: true };',
    },
    loader: { '.css': 'empty' },
    alias: {
      '@/config/firebase': T('stub-firebase-results.tsx'),
      'firebase/functions': T('stub-firebase-results.tsx'),
      'firebase/firestore': T('stub-firebase-results.tsx'),
      'firebase/analytics': T('stub-firebase-results.tsx'),
      'react-pdf': T('stub-react-pdf.tsx'),
      'react-i18next': T('stub-i18n-stable.tsx'),
      'react-hot-toast': T('stub-toast.tsx'),
      'next/navigation': T('stub-navigation-stable.tsx'),
      'next/link': T('stub-link.tsx'),
    },
    plugins: [
      {
        // `ResultsContext` importe l'authentification par un chemin RELATIF
        // (`./AuthContext`), qu'un alias ne sait pas intercepter. Sans ce
        // greffon, le vrai contexte d'authentification serait embarqué, avec
        // un Firebase Auth qui n'existe pas dans le banc.
        name: 'auth-context-stub',
        setup(b) {
          b.onResolve({ filter: /(^|\/)AuthContext$/ }, (a) => {
            if (a.path === '@/contexts/AuthContext') return { path: AUTH_STUB };
            if (a.path === './AuthContext' && /[\\/]src[\\/]contexts[\\/]/.test(a.importer)) {
              return { path: AUTH_STUB };
            }
            return undefined;
          });
        },
      },
    ],
    logLevel: 'error',
  });
}

// ── Petit cadre d'assertions ─────────────────────────────────────────────────
let passed = 0;
const failures = [];
let ctx = '';

function scenario(name) {
  ctx = name;
  console.log(`\n  ${name}`);
}
function ok(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`    · ${label}`);
    return true;
  }
  failures.push(`${ctx}\n      → ${label}${detail ? `\n        ${detail}` : ''}`);
  console.log(`    ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  return false;
}

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

// ── Pilotage ─────────────────────────────────────────────────────────────────
const HTML = '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div></body></html>';

async function freshPage(browser, { lang = 'fr', profile = PATIENT, server = serverFor(), page = 'resultats', width = 420 } = {}) {
  const p = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await p.route('http://labo.test/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML })
  );
  await p.goto('http://labo.test/');
  await p.addScriptTag({ path: BUNDLE });
  await p.evaluate(
    ([l, prof, srv, pg]) => {
      window.__lang = l;
      window.__server = srv;
      window.__pathname = `/${l}/${pg}`;
      window.__setAuth(prof);
      window.__mount(pg);
    },
    [lang, profile, server, page]
  );
  p.__errors = errors;
  return p;
}

/** Les appels à une fonction Firebase, dans l'ordre. */
function calls(p, name = 'fetchResults') {
  return p.evaluate((n) => window.__calls.filter((c) => c.name === n).map((c) => c.args ?? null), name);
}

async function visibleText(p) {
  return p.evaluate(() => {
    const clone = document.getElementById('app').cloneNode(true);
    clone.querySelectorAll('.sr-only,[aria-hidden="true"]').forEach((n) => n.remove());
    return clone.innerText || clone.textContent || '';
  });
}

/**
 * Aucune erreur JavaScript pendant le scénario.
 *
 * Un seul message est écarté, et c'est un artefact du BANC : `TabsNavigation`
 * utilise `<style jsx>` (styled-jsx), que Next compile mais qu'esbuild laisse
 * tel quel — React signale alors un attribut `jsx` non booléen. En production
 * le message n'existe pas.
 */
function assertNoErrors(p) {
  const real = p.__errors.filter(
    (e) => !/Download the React DevTools/.test(e) && !/non-boolean attribute[\s\S]*\bjsx\b/.test(e)
  );
  return ok('aucune erreur JavaScript', real.length === 0, real.slice(0, 3).join(' | '));
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Scénarios ────────────────────────────────────────────────────────────────
async function s1PatientNominal(browser) {
  scenario('S1 — patient : la liste sans PDF, puis le PDF du plus récent, et rien d’autre');
  const p = await freshPage(browser);
  await p.getByText(`Dossier ${NEWEST}`).first().waitFor({ timeout: 8000 });
  await p.waitForTimeout(1200);
  const c = await calls(p);
  ok('exactement 2 appels au serveur de résultats', c.length === 2, JSON.stringify(c));
  ok('1er appel : la liste seule, sans PDF, sans identifiant (le serveur résout le primaire)',
    same(c[0], { include_pdf: 'none' }), JSON.stringify(c[0]));
  ok(`2e appel : le PDF du dossier le PLUS RÉCENT (${NEWEST}), pas le premier de la liste`,
    same(c[1], { dossier_id: NEWEST }), JSON.stringify(c[1]));
  const text = await visibleText(p);
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
  const p = await freshPage(browser, { lang: 'ar' });
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
  const p = await freshPage(browser, { server: serverFor({ listError: code, delayMs: 30 }) });
  await p.waitForTimeout(3000);
  const at3 = (await calls(p)).length;
  await p.waitForTimeout(7000);
  const at10 = (await calls(p)).length;
  // Attendu : l'appel initial, puis au plus deux relances automatiques espacées
  // (4 s puis 8 s, identité principale seulement — voir `load` dans
  // ResultsContext). Une page qui relance à chaque aller-retour dépasse ces
  // bornes de plusieurs ordres de grandeur.
  ok('au plus 1 appel dans les 3 premières secondes', at3 <= 1, `${at3} appels`);
  ok('au plus 3 appels en 10 secondes', at10 <= 3, `${at10} appels`);
  const text = await visibleText(p);
  ok('un message d’erreur est affiché (pas un écran vide)', text.trim().length > 40);
  await p.close();
  return { at3, at10 };
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

  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log(`${passed} vérifications passées, ${failures.length} en échec.`);
  console.log(`Captures : ${SHOTS}`);
  if (failures.length) {
    console.log('\nÉCHECS :');
    for (const f of failures) console.log(`\n  ✗ ${f}`);
    process.exit(1);
  }
  console.log('Tout est vert.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
