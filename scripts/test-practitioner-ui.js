#!/usr/bin/env node
/**
 * Banc « médecin » — l'espace « Mes patients » dans un vrai navigateur.
 *
 *     node scripts/test-practitioner-ui.js          # tous les scénarios
 *     node scripts/test-practitioner-ui.js --head   # avec fenêtre visible
 *
 * Même mécanique que le banc « résultats » (`scripts/testing/results-bench.js`) :
 * la page de PRODUCTION `/[lang]/mes-patients`, sous le vrai `ResultsProvider`,
 * avec un serveur de résultats simulé qui ENREGISTRE chaque appel.
 *
 * Ce qu'il prouve, au-delà de l'écran :
 *  - la liste coûte UN appel, sans PDF ; aucun PDF n'est chargé tant que le
 *    médecin n'a pas ouvert un patient ;
 *  - ouvrir un patient charge UN PDF — le plus récent de CE patient — et les
 *    anciens seulement à la demande ;
 *  - un médecin qui est aussi patient ne déclenche AUCUN appel avec son code
 *    médecin au démarrage (l'accès médecin n'est jamais l'identité par défaut) ;
 *  - changer de compte ne laisse rien du médecin à l'écran ;
 *  - le verrou de la carte admin « Accès médecin ».
 *
 * ⚠ Aucune feuille de style : les classes responsives (`hidden lg:block`) sont
 *   sans effet ici — on vérifie la structure, les textes et les appels.
 * ⚠ Données FICTIVES uniquement (codes DRDEMO, patients DÉMO, EXEMPLE…).
 */
const path = require('path');
const { chromium } = require('playwright');
const {
  SHOTS,
  build,
  createReporter,
  freshPage,
  calls,
  visibleText,
  realErrors,
  rawKeys,
  same,
} = require('./testing/results-bench');

const HEADED = process.argv.includes('--head');
const { scenario, ok, finish } = createReporter();

// ── Données fictives ─────────────────────────────────────────────────────────
const CODE = 'DRDEMO';
const DOCTOR = {
  uid: 'uid-medecin-banc',
  fullName: 'Médecin Banc Essai',
  phone: '0600000001',
  email: 'medecin.banc@example.test',
  practitioner: { requester_id: CODE, type: 'medecin', label: 'Dr Démo Banc' },
};
const ROSTER = [
  { dossier_id: '100926901', patient_nom: 'DÉMO', patient_prenom: 'Amina', date_dossier: '2026-09-10T08:15:00Z', etat: 'Final', analyses_summary: 'C GLY^C HBA1^C CHOL' },
  { dossier_id: '210826903', patient_nom: 'EXEMPLE', patient_prenom: 'Youssef', date_dossier: '2026-08-21T09:40:00Z', etat: 'Final', analyses_summary: 'H NFS^C CRP' },
  { dossier_id: '050726905', patient_nom: 'FICTIF', patient_prenom: 'Hanaé', date_dossier: '2026-07-05T07:55:00Z', etat: 'Final', analyses_summary: 'C GLY^C HBA1^C CR' },
  { dossier_id: '020326902', patient_nom: 'DÉMO', patient_prenom: 'Amina', date_dossier: '2026-03-02T08:05:00Z', etat: 'Final', analyses_summary: 'C GLY^C HBA1' },
  { dossier_id: '141125904', patient_nom: 'EXEMPLE', patient_prenom: 'Youssef', date_dossier: '2025-11-14T10:20:00Z', etat: 'Final', analyses_summary: 'N TSH^N T4L' },
  { dossier_id: '180625906', patient_nom: 'ESSAI', patient_prenom: 'Karim', date_dossier: '2025-06-18T08:30:00Z', etat: 'Final', analyses_summary: 'V VITD^C FERR' },
];
const EXPECTED_ORDER = ['DÉMO Amina', 'EXEMPLE Youssef', 'FICTIF Hanaé', 'ESSAI Karim'];

function doctorServer(overrides = {}) {
  return {
    primary: null, // médecin sans dossier personnel : rien à précharger
    identities: { [CODE]: { list: ROSTER, noPdf: ['050726905'] } },
    delayMs: 40,
    ...overrides,
  };
}

const withCode = (c) => c.filter((a) => a && a.requester_id === CODE);

function assertClean(p, text) {
  const real = realErrors(p);
  ok('aucune erreur JavaScript', real.length === 0, real.slice(0, 3).join(' | '));
  const raw = rawKeys(text);
  ok('aucune clé de traduction brute à l’écran', raw.length === 0, raw.join(', '));
}

async function patientNames(p) {
  return p.$$eval('[data-testid="mp-patient-name"]', (els) => els.map((e) => e.textContent.trim()));
}

async function waitForList(p) {
  await p.waitForSelector('[data-testid="mp-patient"]', { timeout: 8000 });
  await p.waitForTimeout(300);
}

// ── M1 — le parcours complet, sur téléphone ────────────────────────────────
async function m1Journey(browser) {
  scenario('M1 — liste, ouverture d’un patient, ancien bilan, bouton retour (téléphone)');
  const p = await freshPage(browser, { page: 'mes-patients', profile: DOCTOR, server: doctorServer() });
  await waitForList(p);
  await p.waitForTimeout(500);
  let c = await calls(p);
  ok('la liste : exactement UN appel', c.length === 1, JSON.stringify(c));
  ok('…avec le code médecin comme sélecteur, SANS PDF', same(c[0], { include_pdf: 'none', requester_id: CODE }), JSON.stringify(c[0]));
  ok('aucun PDF chargé tant qu’aucun patient n’est ouvert', c.every((a) => !a.dossier_id));

  const text = await visibleText(p, '#app');
  ok('titre « Mes patients »', text.includes('Mes patients'));
  ok('le nom du médecin dans le sous-titre', text.includes('Dr Démo Banc'));
  ok('résumé : 4 patients · 6 bilans', /4 patients/.test(text) && /6 bilans/.test(text), text.slice(0, 200));
  ok('patients triés par bilan le plus récent', same(await patientNames(p), EXPECTED_ORDER), JSON.stringify(await patientNames(p)));
  ok('pas d’avis « 50 bilans » pour 6 bilans', !(await p.$('[data-testid="mp-capped"]')));

  await p.getByText('EXEMPLE Youssef').first().click();
  await p.waitForSelector('[data-testid="mp-patient-detail"]', { timeout: 5000 });
  await p.waitForTimeout(600);
  c = await calls(p);
  ok('ouvrir un patient : UN appel de plus', c.length === 2, JSON.stringify(c));
  ok('…pour le PDF de SON bilan le plus récent (210826903)', same(c[1], { dossier_id: '210826903', requester_id: CODE }), JSON.stringify(c[1]));
  const detailText = await visibleText(p, '[data-testid="mp-patient-detail"]');
  ok('la fiche : son nom et ses 2 bilans', detailText.includes('EXEMPLE Youssef') && /2 bilans/.test(detailText));
  const dossiers = await p.$$eval('[data-testid="mp-dossier"]', (els) => els.map((e) => e.getAttribute('data-dossier-id')));
  ok('ses bilans du plus récent au plus ancien', same(dossiers, ['210826903', '141125904']), JSON.stringify(dossiers));
  ok('« Dernier bilan » sur le plus récent', /Dernier bilan/.test(detailText));
  ok('téléphone : une entrée d’historique ajoutée (bouton retour)', await p.evaluate(() => window.history.state?.mpDetail === 1));
  ok('…sans rien d’identifiant dans l’historique', await p.evaluate(() => !JSON.stringify(window.history.state).includes('Youssef')));

  const old = p.locator('[data-dossier-id="141125904"]');
  await old.getByRole('button', { name: 'Voir' }).click();
  await p.waitForSelector('[role="dialog"]', { timeout: 5000 });
  c = await calls(p);
  ok('« Voir » un ancien bilan : son PDF est demandé à ce moment-là', same(c[2], { dossier_id: '141125904', requester_id: CODE }), JSON.stringify(c[2]));
  ok('3 appels au total — jamais plus que ce que le médecin a demandé', c.length === 3, JSON.stringify(c));
  const dialogText = await visibleText(p, '[role="dialog"]');
  ok('la visionneuse porte le nom du patient et le n° de dossier', dialogText.includes('EXEMPLE Youssef') && dialogText.includes('141125904'));
  await p.getByRole('button', { name: 'Fermer' }).click();
  await p.waitForTimeout(200);
  ok('la visionneuse se ferme', !(await p.$('[role="dialog"]')));

  await p.evaluate(() => window.history.back());
  await p.waitForTimeout(400);
  ok('bouton retour du téléphone : retour à la liste', !(await p.$('[data-testid="mp-patient-detail"]')));
  ok('…la liste est toujours là', (await patientNames(p)).length === 4);
  ok('…sans nouvel appel au serveur', (await calls(p)).length === 3);

  assertClean(p, await visibleText(p, '#app'));
  await p.screenshot({ path: path.join(SHOTS, 'm1-mes-patients.png'), fullPage: true });
  await p.close();
}

// ── M2 — la recherche ───────────────────────────────────────────────────────
async function m2Search(browser) {
  scenario('M2 — recherche : accents, ordre des mots, n° de dossier');
  const p = await freshPage(browser, { page: 'mes-patients', profile: DOCTOR, server: doctorServer(), width: 1280 });
  await waitForList(p);
  const search = p.locator('[data-testid="mp-search"]');
  const cases = [
    ['hanae', ['FICTIF Hanaé']],
    ['youssef exemple', ['EXEMPLE Youssef']],
    ['2108', ['EXEMPLE Youssef']],
    ['DÉMO', ['DÉMO Amina']],
  ];
  for (const [q, expected] of cases) {
    await search.fill(q);
    await p.waitForTimeout(120);
    ok(`« ${q} » → ${expected.join(', ')}`, same(await patientNames(p), expected), JSON.stringify(await patientNames(p)));
  }
  await search.fill('zzz');
  await p.waitForTimeout(120);
  ok('aucun résultat → message explicite', !!(await p.$('[data-testid="mp-no-match"]')));
  await p.getByRole('button', { name: 'Effacer la recherche' }).click();
  await p.waitForTimeout(120);
  ok('effacer → les 4 patients reviennent', (await patientNames(p)).length === 4);
  ok('la recherche ne coûte aucun appel', (await calls(p)).length === 1);
  ok('le champ ne mémorise pas les noms (autocomplete off)', (await search.getAttribute('autocomplete')) === 'off');
  await p.close();
}

// ── M3 — PDF pas encore joint ───────────────────────────────────────────────
async function m3NoPdf(browser) {
  scenario('M3 — bilan dont le laboratoire n’a pas encore joint le PDF');
  const p = await freshPage(browser, { page: 'mes-patients', profile: DOCTOR, server: doctorServer() });
  await waitForList(p);
  await p.getByText('FICTIF Hanaé').first().click();
  await p.waitForSelector('[data-testid="mp-patient-detail"]');
  await p.waitForTimeout(600);
  const t = await visibleText(p, '[data-testid="mp-patient-detail"]');
  ok('message calme, pas une erreur', t.includes("n'a pas encore joint le PDF"));
  ok('le bouton devient « Réessayer »', t.includes('Réessayer'));
  await p.close();
}

// ── M4 — les états bloqués ──────────────────────────────────────────────────
async function m4States(browser) {
  const states = [
    ['code encore inconnu du laboratoire (404)', doctorServer({ notFound: [CODE] }), 'pas encore actif côté laboratoire'],
    ['aucun bilan', doctorServer({ identities: { [CODE]: { list: [] } } }), 'Aucun bilan pour le moment'],
    ['accès retiré par le laboratoire', doctorServer({ identities: {} }), 'retiré ou modifié'],
    ['panne du serveur', doctorServer({ listError: 'internal' }), 'Panne temporaire'],
    ['trop de demandes (429)', doctorServer({ listError: 'resource-exhausted' }), 'Trop de demandes'],
  ];
  for (const [label, server, expected] of states) {
    scenario(`M4 — ${label}`);
    const p = await freshPage(browser, { page: 'mes-patients', profile: DOCTOR, server });
    await p.waitForFunction(() => window.__calls.length > 0, null, { timeout: 8000 });
    await p.waitForTimeout(500);
    const text = await visibleText(p, '#app');
    ok(`message : « ${expected} »`, text.includes(expected), text.slice(0, 240).replace(/\s+/g, ' '));
    ok('aucune liste de patients affichée', !(await p.$('[data-testid="mp-patient"]')));
    if (label === 'panne du serveur') {
      const before = (await calls(p)).length;
      await p.getByRole('button', { name: 'Réessayer' }).first().click();
      await p.waitForTimeout(400);
      ok('« Réessayer » relance UN appel', (await calls(p)).length === before + 1);
      await p.waitForTimeout(2500);
      ok('…et pas de boucle ensuite', (await calls(p)).length <= before + 1, `${(await calls(p)).length} appels`);
    }
    assertClean(p, text);
    await p.close();
  }
}

// ── M5 — compte sans accès, puis accès donné par le labo ────────────────────
async function m5NoAccess(browser) {
  scenario('M5 — compte sans accès médecin, puis « Vérifier à nouveau » après activation');
  const plain = { uid: 'uid-sans-acces', fullName: 'Sans Accès', phone: '0600000002', email: 'x@example.test' };
  const p = await freshPage(browser, { page: 'mes-patients', profile: plain, server: doctorServer() });
  await p.waitForSelector('[data-testid="mp-recheck"]', { timeout: 8000 });
  const text = await visibleText(p, '#app');
  ok('explication : espace réservé aux médecins partenaires', text.includes('réservé aux médecins partenaires'));
  ok('aucun appel au serveur de résultats', (await calls(p)).length === 0);
  await p.evaluate((doc) => {
    window.__profileOnRefresh = doc;
  }, { ...DOCTOR, uid: plain.uid });
  await p.getByTestId('mp-recheck').click();
  await waitForList(p);
  ok('« Vérifier à nouveau » relit le profil (1 relecture)', (await p.evaluate(() => window.__refreshCount)) === 1);
  ok('…et l’espace s’ouvre, avec sa liste', (await patientNames(p)).length === 4);
  assertClean(p, await visibleText(p, '#app'));
  await p.close();
}

// ── M6 — code médecin égal à un dossier patient du compte ───────────────────
async function m6Collision(browser) {
  scenario('M6 — code médecin = un dossier patient du compte : message, aucun appel avec le code');
  const clash = {
    ...DOCTOR,
    requester_id: CODE,
    type: 'patient',
  };
  const server = doctorServer({ primary: CODE, identities: { [CODE]: { list: ROSTER } } });
  const p = await freshPage(browser, { page: 'mes-patients', profile: clash, server });
  await p.waitForTimeout(1200);
  const text = await visibleText(p, '#app');
  ok('message « Accès médecin à corriger »', text.includes('Accès médecin à corriger'));
  ok('aucun appel avec le code comme sélecteur médecin', withCode(await calls(p)).length === 0, JSON.stringify(await calls(p)));
  await p.close();
}

// ── M7 — médecin qui est aussi patient, sur /resultats ──────────────────────
async function m7DoctorIsPatient(browser) {
  scenario('M7 — médecin qui est aussi patient : au démarrage, JAMAIS d’appel avec son code médecin');
  const both = { ...DOCTOR, requester_id: '900001', type: 'patient' };
  const mine = [
    { dossier_id: 'D-9001-A', patient_nom: '', patient_prenom: '', date_dossier: '2026-05-01T08:00:00Z', etat: 'Final', analyses_summary: 'C GLY' },
  ];
  const server = doctorServer({ primary: '900001', identities: { '900001': { list: mine }, [CODE]: { list: ROSTER } } });
  const p = await freshPage(browser, { page: 'resultats', profile: both, server });
  await p.getByText('Dossier D-9001-A').first().waitFor({ timeout: 8000 });
  await p.waitForTimeout(800);
  const c = await calls(p);
  ok('ses propres résultats : 2 appels (liste, puis son PDF le plus récent)', c.length === 2, JSON.stringify(c));
  ok('aucun appel avec le code médecin', withCode(c).length === 0);
  const text = await visibleText(p, '#app');
  ok('aucun nom de patient du médecin sur sa page Résultats', !/EXEMPLE|FICTIF|ESSAI/.test(text));
  await p.close();
}

// ── M8 — changement de compte ───────────────────────────────────────────────
async function m8AccountSwitch(browser) {
  scenario('M8 — changement de compte : rien du médecin ne reste à l’écran');
  const p = await freshPage(browser, { page: 'mes-patients', profile: DOCTOR, server: doctorServer() });
  await waitForList(p);
  await p.getByText('EXEMPLE Youssef').first().click();
  await p.waitForSelector('[data-testid="mp-patient-detail"]');
  await p.waitForTimeout(500);
  const before = (await calls(p)).length;
  await p.evaluate(() =>
    window.__setAuth({ uid: 'uid-autre', fullName: 'Autre Compte', phone: '0600000003', email: 'autre@example.test' })
  );
  await p.waitForTimeout(800);
  const text = await visibleText(p, '#app');
  ok('plus aucun nom de patient du médecin', !/EXEMPLE|DÉMO|FICTIF|ESSAI/.test(text));
  ok('l’autre compte voit l’explication « réservé aux médecins »', text.includes('réservé aux médecins partenaires'));
  ok('aucun appel avec le code médecin après le changement', withCode((await calls(p)).slice(before)).length === 0);
  await p.close();
}

// ── M9 — arabe ──────────────────────────────────────────────────────────────
async function m9Arabic(browser) {
  scenario('M9 — arabe : sens de lecture, pluriels, aucun texte français oublié');
  const p = await freshPage(browser, { lang: 'ar', page: 'mes-patients', profile: DOCTOR, server: doctorServer() });
  await waitForList(p);
  const dir = await p.evaluate(() => document.querySelector('#app > div')?.getAttribute('dir'));
  ok('sens de lecture de droite à gauche', dir === 'rtl');
  const text = await visibleText(p, '#app');
  ok('titre « مرضاي »', text.includes('مرضاي'));
  ok('pluriel arabe : « 4 مرضى » et « 6 فحوصات »', text.includes('4 مرضى') && text.includes('6 فحوصات'), text.slice(0, 200));
  const french = ['Mes patients', 'bilans', 'Rechercher', 'Dernier bilan', 'Actualiser'].filter((w) => text.includes(w));
  ok('aucun texte français oublié', french.length === 0, french.join(', '));
  await p.getByText('EXEMPLE Youssef').first().click();
  await p.waitForSelector('[data-testid="mp-patient-detail"]');
  await p.waitForTimeout(300);
  const detail = await visibleText(p, '[data-testid="mp-patient-detail"]');
  ok('la fiche en arabe (« فحصان » pour 2 bilans)', detail.includes('فحصان'));
  assertClean(p, text);
  await p.screenshot({ path: path.join(SHOTS, 'm9-mes-patients-ar.png'), fullPage: true });
  await p.close();
}

// ── M10 — le verrou de la carte admin ───────────────────────────────────────
async function m10AdminCard(browser) {
  scenario('M10 — carte admin « Accès médecin » : « Activer » verrouillé tant que rien n’est vérifié');
  const p = await freshPage(browser, { page: 'practitioner-card', profile: DOCTOR, width: 900 });
  await p.waitForSelector('[data-testid="practitioner-card"]');
  const activate = p.getByRole('button', { name: /Activer l'accès médecin/ });
  const card = () => visibleText(p, '[data-testid="practitioner-card"]');
  const setCheck = (c) => p.evaluate((x) => window.__setPractCheck(x), c);
  const probe = (status, dossierCount = 6, patientCount = 4) => ({ status, dossierCount, patientCount });

  ok('vide : verrouillé', await activate.isDisabled());
  ok('…et il dit pourquoi', (await card()).includes('Saisissez le code du médecin.'));
  await p.getByPlaceholder('Ex. : DRCODE').fill('drdemo');
  await p.getByPlaceholder('Ex. : Dr Nom Prénom').fill('Dr Démo');
  ok('code et nom saisis, pas vérifiés : verrouillé', await activate.isDisabled());
  ok('…« Vérifiez d’abord le code »', (await card()).includes("Vérifiez d'abord le code."));
  await p.getByRole('button', { name: 'Vérifier le code' }).click();
  ok('« Vérifier » est bien demandé à la page', (await p.evaluate(() => window.__practActions)).includes('check'));

  await setCheck({ code: CODE, type: 'medecin', probe: probe('ok'), sharedWith: [], pendingAccessRequest: false });
  ok('vérification OK pour CE code : déverrouillé', !(await activate.isDisabled()));
  ok('les comptes du labo, jamais un nom', (await card()).includes('6 bilan(s), 4 patient(s)'));

  await p.getByPlaceholder('Ex. : DRCODE').fill('DRDEMOX');
  ok('code modifié après vérification : de nouveau verrouillé', await activate.isDisabled());
  await p.getByPlaceholder('Ex. : DRCODE').fill('DRDEMO');
  ok('code rétabli : déverrouillé', !(await activate.isDisabled()));

  await setCheck({ code: CODE, type: 'medecin', probe: probe('unknown', 0, 0), sharedWith: [], pendingAccessRequest: false });
  ok('code inconnu du labo : verrouillé sans confirmation', await activate.isDisabled());
  await p.getByLabel(/Activer quand même/).check();
  ok('…déverrouillé après la case', !(await activate.isDisabled()));

  await setCheck({
    code: CODE,
    type: 'medecin',
    probe: probe('ok'),
    sharedWith: [{ uid: 'u2', fullName: 'Secrétaire Banc', email: null }],
    pendingAccessRequest: true,
  });
  ok('code déjà sur un autre compte : le compte est nommé', (await card()).includes('Secrétaire Banc'));
  ok('…et la demande patient en attente est signalée', (await card()).includes("demande d'accès patient en attente"));
  ok('…verrouillé sans confirmation de partage', await activate.isDisabled());
  await p.getByLabel(/Je confirme : ce compte aura aussi accès/).check();
  ok('…déverrouillé après la case', !(await activate.isDisabled()));
  await activate.click();
  ok('« Activer » transmis à la page', (await p.evaluate(() => window.__practActions)).includes('activate'));

  await setCheck({ code: CODE, type: 'medecin', probe: probe('error', 0, 0), sharedWith: [], pendingAccessRequest: false });
  ok('serveur du labo en panne : verrouillé, aucune case ne débloque', await activate.isDisabled());

  await p.getByRole('combobox').selectOption('correspondant');
  ok('type changé après vérification : verrouillé', await activate.isDisabled());
  assertClean(p, await card());
  await p.close();
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n══ Banc « médecin » — /mes-patients sous le vrai ResultsProvider ══');
  await build();
  const browser = await chromium.launch({ headless: !HEADED });
  try {
    await m1Journey(browser);
    await m2Search(browser);
    await m3NoPdf(browser);
    await m4States(browser);
    await m5NoAccess(browser);
    await m6Collision(browser);
    await m7DoctorIsPatient(browser);
    await m8AccountSwitch(browser);
    await m9Arabic(browser);
    await m10AdminCard(browser);
  } finally {
    await browser.close();
  }
  finish();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
