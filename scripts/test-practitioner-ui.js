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
 *  - le verrou de la carte admin « Accès médecin » ;
 *  - les points d'entrée (M11–M13) : « Résultats » divisé en « Moi et ma
 *    famille » et « Mes patients » (menu de la barre, sous-lignes du tiroir,
 *    sélecteur en haut des deux pages), l'accueil replié sans flash « Activer
 *    mon accès » pour un médecin sans dossier personnel, le profil sans carte
 *    médecin ;
 *  - l'onglet Patients de l'admin (M14) : une seule fiche par personne ;
 *  - la demande d'accès du médecin, avec son engagement de confidentialité
 *    (M15), et l'onglet « Médecins » de l'admin : demandes, invitation (M16),
 *    médecins ayant accès et leurs actions rapides (M18) ;
 *  - l'engagement demandé UNE fois, avant tout appel, au médecin activé
 *    directement par le labo (M17) ;
 *  - le tableau de bord « Les médecins » (M19) ;
 *  - l'admin : passer le dossier principal d'un compte en dossier d'un proche
 *    (M20 — un parent sans dossier, dont l'enfant avait été saisi comme lui) ;
 *  - l'admin : corriger le profil d'un patient — nom, date de naissance,
 *    téléphone (M21) ;
 *  - l'admin, onglet Demandes : valider l'accès « pour un proche » (M22).
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
  // Engagement de confidentialité déjà accepté : l'espace s'ouvre directement
  // (M17 éprouve le cas contraire).
  practitionerEngagement: { version: 1, via: 'request' },
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
  scenario('M5 — demande en attente, puis « Vérifier à nouveau » après l’activation par le labo');
  const plain = { uid: 'uid-sans-acces', fullName: 'Sans Accès', phone: '0600000002', email: 'x@example.test' };
  const p = await freshPage(browser, {
    page: 'mes-patients',
    profile: plain,
    server: doctorServer(),
    responses: { myPractitionerRequest: { status: 'pending', createdAt: Date.UTC(2026, 8, 24, 9, 30) } },
  });
  await p.waitForSelector('[data-testid="mp-request-pending"]', { timeout: 8000 });
  const text = await visibleText(p, '#app');
  ok('demande en attente : « Votre demande est bien arrivée », avec sa date', text.includes('Votre demande est bien arrivée') && text.includes('2026'));
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
  ok('l’autre compte voit le formulaire de demande d’accès médecin', text.includes('Demander votre accès médecin'));
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
// ── M11 — le menu ───────────────────────────────────────────────────────────
/** Les liens d'une zone de l'en-tête : la barre desktop ou le tiroir mobile. */
async function headerLinks(p, zone) {
  const sel = zone === 'desktop' ? 'nav.desktop-nav a' : '#mobile-menu-container nav a';
  return p.$$eval(sel, (els) =>
    els.map((a) => ({
      href: a.getAttribute('href'),
      text: (a.textContent || '').trim(),
      current: a.getAttribute('aria-current') === 'page',
    }))
  );
}
const hrefs = (links) => links.map((l) => l.href);

const PATIENT_ONLY = {
  uid: 'uid-patient-banc',
  fullName: 'Patient Banc',
  phone: '0600000004',
  email: 'patient.banc@example.test',
  requester_id: '900002',
  type: 'patient',
};
const MY_DOSSIERS = [
  { dossier_id: 'D-9001-A', patient_nom: '', patient_prenom: '', date_dossier: '2026-05-01T08:00:00Z', etat: 'Final', analyses_summary: 'C GLY' },
];
const DOCTOR_PATIENT = { ...DOCTOR, requester_id: '900001', type: 'patient' };
const doctorPatientServer = () =>
  doctorServer({ primary: '900001', identities: { '900001': { list: MY_DOSSIERS }, [CODE]: { list: ROSTER } } });
const patientServer = () => ({ primary: '900002', identities: { '900002': { list: MY_DOSSIERS } }, delayMs: 40 });

async function m11Menu(browser) {
  scenario('M11 — menu : pour un médecin, « Résultats » se divise en « Moi et ma famille » et « Mes patients »');
  // Un patient : le menu ne change pas.
  let p = await freshPage(browser, { page: 'header', profile: PATIENT_ONLY, server: patientServer(), pathname: '/fr' });
  await p.waitForSelector('nav.desktop-nav a');
  let desk = await headerLinks(p, 'desktop');
  let drawer = await headerLinks(p, 'drawer');
  ok('patient : « Résultats » reste un lien simple, sans menu',
    !(await p.$('[data-testid="results-nav-trigger"]')) && hrefs(desk).includes('/fr/resultats'));
  ok('patient : « Médecins » dans la barre', hrefs(desk).includes('/fr/medecins'), JSON.stringify(hrefs(desk)));
  ok('patient : aucun lien « Mes patients », ni barre ni tiroir', ![...desk, ...drawer].some((l) => l.href === '/fr/mes-patients'));
  ok('patient : pas de groupe « Résultats » dans le tiroir', !(await p.$('[data-testid="drawer-results-group"]')));
  await p.close();

  // Un médecin, sur sa page « Mes patients ».
  p = await freshPage(browser, { page: 'header', profile: DOCTOR, server: doctorServer(), pathname: '/fr/mes-patients' });
  await p.waitForSelector('[data-testid="results-nav-trigger"]');
  desk = await headerLinks(p, 'desktop');
  ok('médecin : la barre garde ses 7 entrées, « Médecins » compris', hrefs(desk).includes('/fr/medecins') && desk.length === 7, JSON.stringify(hrefs(desk)));
  ok('…« Mes patients » n’y est PAS un lien de plus', !hrefs(desk).includes('/fr/mes-patients'));
  const trigger = p.getByTestId('results-nav-trigger');
  ok('…« Résultats » annonce un menu, fermé',
    (await trigger.getAttribute('aria-haspopup')) === 'menu' && (await trigger.getAttribute('aria-expanded')) === 'false');
  ok('…et reste marqué « vous êtes ici » sur Mes patients', ((await trigger.getAttribute('class')) || '').split(/\s+/).includes('active'));
  await trigger.click();
  await p.waitForSelector('[data-testid="results-nav-menu"]', { timeout: 3000 });
  const items = await p.$$eval('[data-testid="results-nav-menu"] [role="menuitem"]', (els) =>
    els.map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim(), current: a.getAttribute('aria-current') === 'page' }))
  );
  ok('clic : le menu s’ouvre, deux entrées dans cet ordre', same(items.map((i) => i.href), ['/fr/resultats', '/fr/mes-patients']), JSON.stringify(items));
  ok('…« Moi et ma famille » puis « Mes patients »', !!items[0]?.text.startsWith('Moi et ma famille') && !!items[1]?.text.startsWith('Mes patients'));
  ok('…la page courante y est marquée', items[1]?.current === true && items[0]?.current === false);
  ok('…aria-expanded passe à true', (await trigger.getAttribute('aria-expanded')) === 'true');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  ok('Échap referme le menu', !(await p.$('[data-testid="results-nav-menu"]')));
  await trigger.click();
  await p.waitForSelector('[data-testid="results-nav-menu"]');
  await p.dispatchEvent('#mobile-menu-container', 'mousedown');
  await p.waitForTimeout(150);
  ok('un clic ailleurs le referme', !(await p.$('[data-testid="results-nav-menu"]')));
  // Tiroir mobile : un titre « Résultats » (pas un lien) et deux sous-lignes.
  const group = await p.$$eval('[data-testid="drawer-results-group"] a', (els) =>
    els.map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim(), current: a.getAttribute('aria-current') === 'page' }))
  );
  ok('tiroir : sous « Résultats », « Moi et ma famille » puis « Mes patients »',
    same(group.map((g) => g.href), ['/fr/resultats', '/fr/mes-patients']) && group[0]?.text === 'Moi et ma famille' && group[1]?.text === 'Mes patients',
    JSON.stringify(group));
  ok('…le titre « Résultats » n’est pas un lien', (await p.$eval('#drawer-results-caption', (el) => el.tagName)) === 'DIV');
  ok('…la sous-ligne de la page courante est marquée', group[1]?.current === true && group[0]?.current === false);
  drawer = await headerLinks(p, 'drawer');
  ok('tiroir : « Médecins » reste', hrefs(drawer).includes('/fr/medecins'));
  ok('le menu n’appelle jamais le serveur de résultats', (await calls(p)).length === 0);
  ok('aucune erreur JavaScript', realErrors(p).length === 0, realErrors(p).slice(0, 3).join(' | '));
  await p.close();

  // Un membre de l'équipe qui a aussi un accès médecin : le même menu, « Admin » en plus.
  p = await freshPage(browser, { page: 'header', profile: { ...DOCTOR, role: 'admin' }, server: doctorServer(), pathname: '/fr' });
  await p.waitForSelector('[data-testid="results-nav-trigger"]');
  desk = await headerLinks(p, 'desktop');
  ok('équipe + médecin : le même menu « Résultats », avec « Médecins » et « Admin »',
    hrefs(desk).includes('/fr/medecins') && hrefs(desk).includes('/fr/admin') && !hrefs(desk).includes('/fr/mes-patients'),
    JSON.stringify(hrefs(desk)));
  await p.close();

  // En arabe.
  p = await freshPage(browser, { lang: 'ar', page: 'header', profile: DOCTOR, server: doctorServer(), pathname: '/ar' });
  await p.waitForSelector('[data-testid="results-nav-trigger"]');
  await p.getByTestId('results-nav-trigger').click();
  await p.waitForSelector('[data-testid="results-nav-menu"]');
  const menuDir = await p.getAttribute('[data-testid="results-nav-menu"]', 'dir');
  const arText = await visibleText(p, '[data-testid="results-nav-menu"]');
  ok('arabe : menu de droite à gauche, « أنا وعائلتي » et « مرضاي »', menuDir === 'rtl' && arText.includes('أنا وعائلتي') && arText.includes('مرضاي'), arText);
  await p.close();
}

// ── M12 — le panneau personnel de l'accueil ─────────────────────────────────
const HINT_KEY = 'laboElAllali_heroPanel';

async function heroSlot(p) {
  return p.$eval('.hero-panel-slot', (el) => ({
    collapsed: el.classList.contains('hero-panel-slot--collapsed'),
    panel: !!el.querySelector('.hero-panel'),
    text: el.textContent || '',
  }));
}
const storedHint = (p) => p.evaluate((k) => window.localStorage.getItem(k), HINT_KEY);

async function m12HomePanel(browser) {
  scenario('M12 — accueil : un médecin sans dossier personnel ne voit jamais « Activer mon accès »');
  // Première visite (aucun indice mémorisé) : l'authentification se résout.
  let p = await freshPage(browser, { page: 'home-panel', server: doctorServer(), authLoading: true });
  await p.waitForSelector('.hero-panel-slot', { state: 'attached' }); // replié = hauteur nulle, donc « invisible »
  await p.waitForTimeout(200);
  await p.evaluate((d) => window.__setAuth(d), DOCTOR);
  await p.waitForTimeout(400);
  let s = await heroSlot(p);
  ok('médecin seul : l’emplacement se replie', s.collapsed && !s.panel, JSON.stringify(s));
  ok('…jamais « Activer mon accès »', !s.text.includes('Activer'));
  ok('indice mémorisé : « none » — une catégorie, rien d’autre', (await storedHint(p)) === 'none', String(await storedHint(p)));
  ok('aucun appel au serveur de résultats', (await calls(p)).length === 0);
  await p.close();

  // Visite suivante : l'indice « none » replie AVANT que Firebase réponde.
  p = await freshPage(browser, { page: 'home-panel', server: doctorServer(), authLoading: true, storage: { [HINT_KEY]: 'none' } });
  await p.waitForSelector('.hero-panel-slot', { state: 'attached' }); // replié = hauteur nulle, donc « invisible »
  await p.waitForTimeout(300);
  s = await heroSlot(p);
  ok('pendant le chargement : déjà replié, aucun flash', s.collapsed && !s.panel, JSON.stringify(s));
  await p.evaluate((d) => window.__setAuth(d), DOCTOR);
  await p.waitForTimeout(300);
  ok('…et il le reste une fois le compte connu', (await heroSlot(p)).collapsed);
  await p.close();

  // Un médecin qui est AUSSI patient garde son panneau — sur SON dossier.
  p = await freshPage(browser, { page: 'home-panel', profile: DOCTOR_PATIENT, server: doctorPatientServer() });
  await p.waitForSelector('.hero-panel', { timeout: 8000 });
  await p.waitForTimeout(800);
  s = await heroSlot(p);
  ok('médecin ET patient : panneau affiché', !s.collapsed && s.panel, JSON.stringify(s));
  ok('…indice « linked »', (await storedHint(p)) === 'linked');
  ok('…aucun appel avec le code médecin', withCode(await calls(p)).length === 0, JSON.stringify(await calls(p)));
  ok('…aucun nom de ses patients', !/DÉMO|EXEMPLE|FICTIF|ESSAI/.test(s.text));
  await p.close();

  // Garde de non-régression : un compte sans AUCUN accès garde son invitation.
  const plain = { uid: 'uid-sans-acces', fullName: 'Sans Accès', phone: '0600000002', email: 'x@example.test' };
  p = await freshPage(browser, { page: 'home-panel', profile: plain, server: { identities: {} } });
  await p.waitForSelector('.hero-panel');
  s = await heroSlot(p);
  ok('compte sans aucun accès : « Activer mon accès », inchangé', s.text.includes('Activer mon accès'), s.text.slice(0, 120));
  ok('…indice « noaccess »', (await storedHint(p)) === 'noaccess');
  await p.close();
}

// ── M13 — le profil, et le sélecteur en haut des deux pages ─────────────────
async function m13ProfileAndSwitch(browser) {
  scenario('M13 — profil sans carte médecin ; « Moi et ma famille | Mes patients » en haut des deux pages');
  let p = await freshPage(browser, { page: 'profile', profile: DOCTOR, server: doctorServer() });
  await p.getByText('Médecin Banc Essai').first().waitFor({ timeout: 8000 });
  let text = await visibleText(p, '#app');
  ok('profil d’un médecin sans dossier : ni code patient, ni carte médecin',
    !text.includes('Mon code patient') && !text.includes('Espace médecin') && !text.includes('Mes patients'));
  ok('aucun appel au serveur de résultats', (await calls(p)).length === 0);
  assertClean(p, text);
  await p.close();

  p = await freshPage(browser, { page: 'profile', profile: DOCTOR_PATIENT, server: doctorPatientServer() });
  await p.getByText('Mon code patient').first().waitFor({ timeout: 8000 });
  text = await visibleText(p, '#app');
  ok('médecin ET patient : son code patient (900001), rien de l’espace médecin', text.includes('900001') && !text.includes('Mes patients'));
  await p.close();

  // /resultats d'un médecin : le sélecteur en tête, « Moi et ma famille » actif.
  p = await freshPage(browser, { page: 'resultats', profile: DOCTOR_PATIENT, server: doctorPatientServer() });
  await p.waitForSelector('[data-testid="results-space-switch"]', { timeout: 8000 });
  ok('/resultats : « Moi et ma famille » actif, « Mes patients » mène à /fr/mes-patients',
    (await p.getAttribute('[data-testid="results-space-mine"]', 'aria-current')) === 'page' &&
      (await p.getAttribute('[data-testid="results-space-patients"]', 'href')) === '/fr/mes-patients');
  ok('…c’est le PREMIER élément de la page',
    await p.evaluate(() => document.querySelector('#app .max-w-3xl > *')?.getAttribute('data-testid') === 'results-space-switch'));
  await p.waitForTimeout(600);
  ok('…sans jamais appeler le serveur avec son code', withCode(await calls(p)).length === 0);
  await p.close();

  // /mes-patients : le même sélecteur, « Mes patients » actif.
  p = await freshPage(browser, { page: 'mes-patients', profile: DOCTOR, server: doctorServer() });
  await waitForList(p);
  ok('/mes-patients : le même sélecteur, « Mes patients » actif',
    (await p.getAttribute('[data-testid="results-space-patients"]', 'aria-current')) === 'page' &&
      (await p.getAttribute('[data-testid="results-space-mine"]', 'href')) === '/fr/resultats');
  await p.close();

  // Un patient : aucun sélecteur.
  p = await freshPage(browser, { page: 'resultats', profile: PATIENT_ONLY, server: patientServer() });
  await p.getByText('Dossier D-9001-A').first().waitFor({ timeout: 8000 });
  ok('/resultats d’un patient : aucun sélecteur', !(await p.$('[data-testid="results-space-switch"]')));
  await p.close();
}

// ── M14 — admin, onglet Patients : une seule fiche par personne ─────────────
// Signalé par le propriétaire le 24/09/2026 : après une recherche, le résultat
// restait affiché au-dessus de la carte « Compte sélectionné », qui répète le
// même nom, e-mail et téléphone — « deux fiches pour une même personne ».
const STAFF = {
  uid: 'uid-stagiaire-banc',
  fullName: 'Stagiaire Banc',
  phone: '0600000009',
  email: 'stagiaire.banc@example.test',
  role: 'staff',
};

async function adminSearch(p, q) {
  await p.getByPlaceholder(/Email, nom/).fill(q);
  await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.waitForTimeout(400);
}
const occurrences = (text, needle) => text.split(needle).length - 1;

async function m14AdminOneCard(browser) {
  scenario('M14 — admin, onglet Patients : une seule fiche pour une même personne');
  const p = await freshPage(browser, { page: 'admin', profile: STAFF, server: { identities: {} } });
  // Recherche simulée : « amina » → 1 compte ; « demo » → 3 comptes (fictifs).
  await p.evaluate(() => {
    const acc = (uid, fullName, email, extra) => ({
      uid, fullName, email, hasProfile: true, phone: '060000' + uid.slice(-4),
      createdAt: '2026-05-21T10:00:00Z', dateOfBirth: '1984-04-22', links: [], linkedCount: 0, practitioner: null, ...extra,
    });
    const A = acc('u-banc-0011', 'DÉMO Amina', 'amina.demo@example.test', { requester_id: '900011', type: 'patient' });
    const B = acc('u-banc-0012', 'DÉMO Karim', 'karim.demo@example.test', {
      requester_id: '900012', type: 'patient',
      practitioner: { requester_id: 'DRDEMO', type: 'medecin', label: 'Dr Démo Banc', linkedAt: Date.UTC(2026, 8, 23), lastUsedAt: null },
    });
    const C = acc('u-banc-0013', 'DÉMO Salma', 'salma.demo@example.test', {});
    window.__callables.adminSearchPatients = (args) => {
      const q = String((args && args.query) || '').toLowerCase();
      if (q.includes('amina')) return { results: [A], truncated: false };
      if (q.includes('demo')) return { results: [A, B, C], truncated: false };
      return { results: [], truncated: false };
    };
  });
  await p.getByPlaceholder(/Email, nom/).waitFor({ timeout: 8000 });

  // Un seul résultat : la fiche est ouverte d'office, et c'est la SEULE.
  await adminSearch(p, 'amina.demo@example.test');
  let text = await visibleText(p, '#app');
  ok('1 résultat : la liste n’est pas affichée', !(await p.$('[data-testid="admin-results"]')));
  ok('…la fiche du compte est ouverte', !!(await p.$('[data-testid="admin-selected"]')));
  ok('…son e-mail n’apparaît qu’UNE fois à l’écran', occurrences(text, 'amina.demo@example.test') === 1, `${occurrences(text, 'amina.demo@example.test')} fois`);
  ok('…pas de bouton « Retour aux résultats » (il n’y a rien d’autre)', !(await p.$('[data-testid="admin-back-to-results"]')));

  // Plusieurs résultats : la liste, puis une seule fiche, puis retour à la liste.
  await adminSearch(p, 'demo');
  ok('3 résultats : la liste s’affiche, aucune fiche ouverte',
    (await p.$$('[data-testid="admin-results"] > button')).length === 3 && !(await p.$('[data-testid="admin-selected"]')));
  await p.getByText('DÉMO Karim').first().click();
  await p.waitForTimeout(300);
  text = await visibleText(p, '#app');
  ok('choisir un compte replie la liste', !(await p.$('[data-testid="admin-results"]')));
  ok('…une seule fiche : celle de Karim, e-mail présent UNE fois',
    text.includes('DÉMO Karim') && occurrences(text, 'karim.demo@example.test') === 1 && !text.includes('DÉMO Amina'));
  const back = p.getByTestId('admin-back-to-results');
  ok('…bouton « Retour aux résultats (3) »', (await back.textContent()).includes('Retour aux résultats (3)'));
  ok('…la carte « Accès médecin » de Karim montre son code', (await visibleText(p, '[data-testid="practitioner-card"]')).includes('DRDEMO'));
  await back.click();
  await p.waitForTimeout(300);
  ok('« Retour aux résultats » : les 3 comptes reviennent, plus de fiche ouverte',
    (await p.$$('[data-testid="admin-results"] > button')).length === 3 && !(await p.$('[data-testid="admin-selected"]')));
  assertClean(p, await visibleText(p, '#app'));
  await p.screenshot({ path: path.join(SHOTS, 'm14-admin-une-fiche.png'), fullPage: true });
  await p.close();
}

// ── M15 — le médecin demande son accès (lien d'invitation) ──────────────────
// Décision du propriétaire, 24/09/2026 : le labo envoie le lien /fr/mes-patients
// à un médecin sans compte ; il s'inscrit, puis demande. Demander n'ouvre RIEN.
async function m15DoctorRequest(browser) {
  scenario('M15 — médecin sans dossier au labo : il demande son accès depuis le lien d’invitation');
  // Un médecin qui n'a JAMAIS fait d'analyse au labo : ni dossier, ni proche.
  const newDoctor = { uid: 'uid-nouveau-medecin', fullName: 'Nouveau Banc', phone: '0600000031', email: 'nouveau.medecin@example.test' };
  let p = await freshPage(browser, {
    page: 'mes-patients',
    profile: newDoctor,
    server: { identities: {} },
    responses: { requestPractitionerAccess: { status: 'pending', createdAt: Date.UTC(2026, 8, 24, 10, 0) } },
  });
  await p.waitForSelector('[data-testid="mp-request-form"]', { timeout: 8000 });
  let text = await visibleText(p, '#app');
  ok('le formulaire « Demander votre accès médecin » s’affiche', text.includes('Demander votre accès médecin'));
  ok('son nom est prérempli avec « Dr »', (await p.inputValue('#mp-req-label')) === 'Dr Nouveau Banc');
  const terms = await visibleText(p, '[data-testid="mp-engagement-terms"]');
  ok('l’engagement de confidentialité est affiché, déplié, au-dessus de la case',
    terms.includes('Mon engagement de confidentialité') && terms.includes('secret médical') && terms.includes('ne laisser personne utiliser mon compte'),
    terms.slice(0, 160));
  ok('…et la case dit « Je suis médecin et j’accepte cet engagement »', text.includes('Je suis médecin et j’accepte cet engagement.'));
  const submit = p.getByTestId('mp-request-submit');
  ok('bouton verrouillé tant que la case n’est pas cochée…', await submit.isDisabled());
  ok('…et il dit pourquoi', (await p.textContent('[data-testid="mp-request-why"]')).includes('Cochez la case'));
  await p.fill('#mp-req-specialty', 'Cardiologie');
  await p.fill('#mp-req-place', 'Agadir');
  await p.getByTestId('mp-request-attest').check();
  ok('case cochée : bouton déverrouillé', !(await submit.isDisabled()));
  await submit.click();
  await p.waitForSelector('[data-testid="mp-request-pending"]', { timeout: 5000 });
  const sent = await calls(p, 'requestPractitionerAccess');
  ok('UNE demande envoyée, avec ses trois champs, la case et la version de l’engagement lu',
    sent.length === 1 && same(sent[0], { label: 'Dr Nouveau Banc', specialty: 'Cardiologie', place: 'Agadir', attest: true, engagement: 1 }),
    JSON.stringify(sent));
  ok('…puis « Votre demande est bien arrivée »', (await visibleText(p, '#app')).includes('Votre demande est bien arrivée'));
  ok('jamais d’appel au serveur de résultats', (await calls(p)).length === 0);
  assertClean(p, await visibleText(p, '#app'));
  await p.screenshot({ path: path.join(SHOTS, 'm15-demande-medecin.png'), fullPage: true });
  await p.close();

  // Demande refusée : le médecin peut en refaire une.
  p = await freshPage(browser, {
    page: 'mes-patients',
    profile: newDoctor,
    server: { identities: {} },
    responses: { myPractitionerRequest: { status: 'rejected', createdAt: Date.UTC(2026, 8, 20) } },
  });
  await p.waitForSelector('[data-testid="mp-request-rejected"]', { timeout: 8000 });
  ok('demande refusée : message clair', (await visibleText(p, '#app')).includes('n’a pas été acceptée'));
  await p.getByTestId('mp-request-again').click();
  ok('« Faire une nouvelle demande » rouvre le formulaire', !!(await p.$('[data-testid="mp-request-form"]')));
  await p.close();

  // En arabe : aucun texte manquant.
  p = await freshPage(browser, { lang: 'ar', page: 'mes-patients', profile: newDoctor, server: { identities: {} } });
  await p.waitForSelector('[data-testid="mp-request-form"]', { timeout: 8000 });
  text = await visibleText(p, '#app');
  ok('arabe : le formulaire en arabe (« طلب وصولي كطبيب »), engagement compris (« تعهّدي بالسرّية »)',
    text.includes('طلب وصولي كطبيب') && text.includes('تعهّدي بالسرّية'));
  assertClean(p, text);
  await p.close();
}

// ── M16 — l'admin : inviter un médecin, sa demande, « Ouvrir sa fiche » ─────
async function m16AdminDoctorRequests(browser) {
  scenario('M16 — admin, onglet « Médecins » : le lien d’invitation, la demande du médecin, « Ouvrir sa fiche » préremplit la carte');
  const ADMIN_USER = { uid: 'uid-admin-banc', fullName: 'Admin Banc', phone: '0600000010', email: 'admin.banc@example.test', role: 'admin' };
  const REQ = {
    uid: 'u-banc-0021',
    fullName: 'Médecin Invité',
    email: 'invite.medecin@example.test',
    phone: '0600000021',
    label: 'Dr Invité Banc',
    specialty: 'Cardiologie',
    place: 'Agadir',
    createdAt: Date.UTC(2026, 8, 24, 9, 0),
    engagementAt: Date.UTC(2026, 8, 24, 9, 0),
  };
  const p = await freshPage(browser, {
    page: 'admin',
    profile: ADMIN_USER,
    server: { identities: {} },
    responses: {
      adminDashboardStats: null,
      adminListStaff: { members: [], callerLevel: 2 },
      adminListPractitionerRequests: { requests: [REQ] },
      adminRejectPractitionerRequest: { ok: true },
      adminListPractitioners: { practitioners: [] },
      adminSearchPatients: {
        results: [
          { uid: REQ.uid, email: REQ.email, hasProfile: true, fullName: REQ.fullName, phone: REQ.phone, links: [], linkedCount: 0, practitioner: null },
        ],
        truncated: false,
      },
    },
  });
  await p.getByRole('button', { name: /Médecins/ }).first().click();
  await p.waitForSelector('[data-testid="invite-doctor-card"]', { timeout: 8000 });
  const tabs = await p.$$eval('button', (els) => els.map((b) => (b.textContent || '').trim()));
  ok('l’onglet « Médecins » porte le badge de la demande en attente', tabs.includes('Médecins(1)'), JSON.stringify(tabs.filter((x) => /Médecins|Demandes/.test(x))));
  ok('…et l’onglet « Demandes » ne la compte plus', !tabs.includes('Demandes(1)'));
  const link = await p.inputValue('[data-testid="invite-link"]');
  ok('le lien d’invitation est celui de l’espace médecin', link === 'http://labo.test/fr/mes-patients', link);
  let wa = await p.getAttribute('[data-testid="invite-whatsapp"]', 'href');
  ok('WhatsApp sans numéro : message prérempli qui contient le lien',
    wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa.split('text=')[1]).includes('http://labo.test/fr/mes-patients'), wa.slice(0, 80));
  await p.fill('#invite-phone', '06 12 34 56 78');
  wa = await p.getAttribute('[data-testid="invite-whatsapp"]', 'href');
  ok('…avec un numéro marocain : au format international', wa.startsWith('https://wa.me/212612345678?text='), wa.slice(0, 60));

  const reqText = await visibleText(p, '[data-testid="pract-request"]');
  ok('la demande montre son nom d’ordonnance, sa spécialité, sa ville, son compte',
    ['Dr Invité Banc', 'Cardiologie', 'Agadir', 'invite.medecin@example.test'].every((s) => reqText.includes(s)), reqText.slice(0, 160));
  ok('…et qu’il a accepté l’engagement de confidentialité', !!(await p.$('[data-testid="pract-request-engaged"]')));

  await p.getByTestId('pract-request-open').click();
  await p.waitForSelector('[data-testid="practitioner-card"]', { timeout: 5000 });
  const search = await calls(p, 'adminSearchPatients');
  ok('« Ouvrir sa fiche » : recherche par SON e-mail', search.length === 1 && search[0]?.query === REQ.email, JSON.stringify(search));
  ok('…onglet Patients, SON compte sélectionné', (await visibleText(p, '[data-testid="admin-selected"]')).includes(REQ.email));
  const label = await p.inputValue('[data-testid="practitioner-card"] input[placeholder="Ex. : Dr Nom Prénom"]');
  ok('…la carte « Accès médecin » préremplie avec son nom d’ordonnance', label === 'Dr Invité Banc', label);

  // Refus : deux clics, jamais un seul.
  await p.getByRole('button', { name: /Médecins/ }).first().click();
  await p.waitForSelector('[data-testid="pract-request-reject"]');
  await p.getByTestId('pract-request-reject').click();
  ok('« Refuser » demande une confirmation, rien n’est envoyé', (await calls(p, 'adminRejectPractitionerRequest')).length === 0);
  await p.getByTestId('pract-request-reject-confirm').click();
  await p.waitForTimeout(300);
  const rej = await calls(p, 'adminRejectPractitionerRequest');
  ok('…confirmé : le refus part pour CE compte', rej.length === 1 && rej[0]?.uid === REQ.uid, JSON.stringify(rej));
  assertClean(p, await visibleText(p, '#app'));
  await p.screenshot({ path: path.join(SHOTS, 'm16-admin-demandes-medecin.png'), fullPage: true });
  await p.close();
}

// ── M17 — l'engagement, une fois, pour un médecin activé directement ────────
// Le cas « le labo a déjà son compte » : il n'est jamais passé par le
// formulaire de demande, où l'engagement se coche. Il le lit donc une fois,
// AVANT que la moindre donnée de patient ne soit demandée.
async function m17EngagementGate(browser) {
  scenario('M17 — médecin activé directement : l’engagement d’abord, une fois, et aucun appel avant');
  const { practitionerEngagement: _drop, ...notEngaged } = DOCTOR;
  let p = await freshPage(browser, {
    page: 'mes-patients',
    profile: notEngaged,
    server: doctorServer(),
    responses: { acceptPractitionerEngagement: { ok: true, already: false } },
  });
  await p.waitForSelector('[data-testid="mp-engagement-gate"]', { timeout: 8000 });
  await p.waitForTimeout(600);
  let text = await visibleText(p, '#app');
  ok('l’écran « Une dernière étape avant vos patients »', text.includes('Une dernière étape avant vos patients'));
  ok('…avec le texte de l’engagement', text.includes('Mon engagement de confidentialité') && text.includes('secret médical'));
  ok('AUCUN appel au serveur de résultats avant l’acceptation', (await calls(p)).length === 0, JSON.stringify(await calls(p)));
  ok('…ni liste, ni nom de patient à l’écran', !(await p.$('[data-testid="mp-patient"]')) && !/EXEMPLE|FICTIF|ESSAI/.test(text));
  ok('le sélecteur « Moi et ma famille | Mes patients » reste en haut', !!(await p.$('[data-testid="results-space-switch"]')));
  const submit = p.getByTestId('mp-engagement-submit');
  ok('« Accepter » verrouillé tant que la case n’est pas cochée…', await submit.isDisabled());
  ok('…et il dit pourquoi', (await p.textContent('[data-testid="mp-engagement-why"]')).includes('Cochez la case'));
  await p.getByTestId('mp-engagement-accept').check();
  ok('case cochée : déverrouillé', !(await submit.isDisabled()));
  await p.evaluate((doc) => {
    window.__profileOnRefresh = doc;
  }, DOCTOR);
  await submit.click();
  await waitForList(p);
  const accepted = await calls(p, 'acceptPractitionerEngagement');
  ok('UNE acceptation envoyée, avec la version du texte lu', accepted.length === 1 && same(accepted[0], { version: 1 }), JSON.stringify(accepted));
  ok('…le profil est relu une fois', (await p.evaluate(() => window.__refreshCount)) === 1);
  const c = await calls(p);
  ok('…puis l’espace s’ouvre : UN appel, la liste sans PDF', c.length === 1 && same(c[0], { include_pdf: 'none', requester_id: CODE }), JSON.stringify(c));
  ok('…avec ses 4 patients', (await patientNames(p)).length === 4);
  assertClean(p, await visibleText(p, '#app'));
  await p.screenshot({ path: path.join(SHOTS, 'm17-engagement.png'), fullPage: true });
  await p.close();

  // L'enregistrement échoue : il reste sur l'engagement, toujours sans appel.
  p = await freshPage(browser, { page: 'mes-patients', profile: notEngaged, server: doctorServer() });
  await p.waitForSelector('[data-testid="mp-engagement-gate"]', { timeout: 8000 });
  await p.evaluate(() => {
    window.__callables.acceptPractitionerEngagement = () => {
      const e = new Error('unavailable');
      e.code = 'functions/unavailable';
      throw e;
    };
  });
  await p.getByTestId('mp-engagement-accept').check();
  await p.getByTestId('mp-engagement-submit').click();
  await p.waitForTimeout(400);
  text = await visibleText(p, '#app');
  ok('échec de l’enregistrement : message clair, il reste sur l’engagement', text.includes('n’a pas pu être enregistrée') && !!(await p.$('[data-testid="mp-engagement-gate"]')));
  ok('…et toujours aucun appel au serveur de résultats', (await calls(p)).length === 0);
  await p.close();

  // En arabe.
  p = await freshPage(browser, { lang: 'ar', page: 'mes-patients', profile: notEngaged, server: doctorServer() });
  await p.waitForSelector('[data-testid="mp-engagement-gate"]', { timeout: 8000 });
  text = await visibleText(p, '#app');
  ok('arabe : « خطوة أخيرة… » et « تعهّدي بالسرّية »', text.includes('خطوة أخيرة قبل الاطّلاع على مرضاكم') && text.includes('تعهّدي بالسرّية'));
  const french = ['engagement', 'Accepter', 'secret médical', 'Cochez'].filter((w) => text.includes(w));
  ok('…aucun texte français oublié', french.length === 0, french.join(', '));
  assertClean(p, text);
  await p.close();
}

// ── M18 — l'onglet « Médecins » : ceux qui ont accès, et les actions rapides ─
const DOC_A = {
  uid: 'u-banc-0031',
  fullName: 'Médecin Actif Banc',
  email: 'actif.medecin@example.test',
  phone: '0600000031',
  requester_id: 'DRDEMO',
  type: 'medecin',
  label: 'Dr Actif Banc',
  linkedAt: Date.UTC(2026, 8, 20, 9, 0),
  linkedByName: 'Admin Banc',
  team: false,
  sharedWith: 0,
  engaged: true,
  engagementAt: Date.UTC(2026, 8, 20, 10, 0),
  lastVisitAt: Date.UTC(2026, 8, 24, 8, 0),
  usage: { days: 7, reports: 21, monthDays: 3, monthReports: 8, firstAt: Date.UTC(2026, 8, 20, 11, 0), lastAt: Date.UTC(2026, 8, 24, 8, 0), lastReportAt: Date.UTC(2026, 8, 24, 8, 5) },
};
const DOC_B = {
  uid: 'u-banc-0032',
  fullName: 'Secrétaire Banc',
  email: 'secretaire.banc@example.test',
  phone: '',
  requester_id: 'DRAUTRE',
  type: 'correspondant',
  label: 'Clinique Banc',
  linkedAt: Date.UTC(2026, 8, 22, 9, 0),
  linkedByName: '',
  team: true,
  sharedWith: 1,
  engaged: false,
  engagementAt: null,
  lastVisitAt: null,
  usage: { days: 0, reports: 0, monthDays: 0, monthReports: 0, firstAt: null, lastAt: null, lastReportAt: null },
};

async function m18AdminDoctorsTab(browser) {
  scenario('M18 — admin, onglet « Médecins » : les médecins ayant accès, leur usage, « Ouvrir sa fiche », WhatsApp, « Retirer »');
  const ADMIN_USER = { uid: 'uid-admin-banc', fullName: 'Admin Banc', phone: '0600000010', email: 'admin.banc@example.test', role: 'admin' };
  let p = await freshPage(browser, {
    page: 'admin',
    profile: ADMIN_USER,
    server: { identities: {} },
    width: 1100,
    responses: {
      adminDashboardStats: null,
      adminListStaff: { members: [], callerLevel: 2 },
      adminListPractitionerRequests: { requests: [] },
      adminListPractitioners: { practitioners: [DOC_A, DOC_B] },
      adminSetPractitioner: { ok: true, dryRun: false, practitioner: null },
      adminSearchPatients: {
        results: [
          {
            uid: DOC_A.uid, email: DOC_A.email, hasProfile: true, fullName: DOC_A.fullName, phone: DOC_A.phone, links: [], linkedCount: 0,
            practitioner: { requester_id: 'DRDEMO', type: 'medecin', label: 'Dr Actif Banc', linkedAt: DOC_A.linkedAt, lastUsedAt: null, engaged: true, engagementAt: DOC_A.engagementAt },
          },
        ],
        truncated: false,
      },
    },
  });
  await p.getByRole('button', { name: /Médecins/ }).first().waitFor({ timeout: 8000 });
  await p.waitForTimeout(300);
  ok('la liste n’est PAS chargée tant que l’onglet n’est pas ouvert', (await calls(p, 'adminListPractitioners')).length === 0);
  await p.getByRole('button', { name: /Médecins/ }).first().click();
  await p.waitForSelector('[data-testid="doctor-row"]', { timeout: 8000 });
  ok('onglet ouvert : UN appel', (await calls(p, 'adminListPractitioners')).length === 1);
  ok('sans demande en attente, la file des demandes ne s’affiche pas', !(await p.$('[data-testid="pract-requests"]')));
  const names = await p.$$eval('[data-testid="doctor-name"]', (els) => els.map((e) => e.textContent.trim()));
  ok('les deux médecins ayant accès', same(names, ['Dr Actif Banc', 'Clinique Banc']), JSON.stringify(names));
  const rows = p.locator('[data-testid="doctor-row"]');
  const rowA = await rows.nth(0).innerText();
  const rowB = await rows.nth(1).innerText();
  ok('médecin A : son code, son compte, son e-mail', ['DRDEMO', 'Médecin Actif Banc', 'actif.medecin@example.test'].every((x) => rowA.includes(x)), rowA.slice(0, 200));
  const usageA = await rows.nth(0).locator('[data-testid="doctor-usage"]').innerText();
  ok('…son usage : jours de visite et bilans ouverts ce mois-ci, bilans au total',
    usageA.includes('Jours de visite ce mois-ci') && /\b3\b/.test(usageA) && /\b8\b/.test(usageA) && /\b21\b/.test(usageA), usageA.replace(/\s+/g, ' '));
  ok('…activé par qui, et son engagement accepté (en vert)',
    rowA.includes('par Admin Banc') && !!(await rows.nth(0).locator('[data-testid="doctor-engaged"]').count()));
  ok('médecin B : « Pas encore venu », engagement « demandé à sa prochaine visite »',
    rowB.includes('Pas encore venu') && rowB.includes('prochaine visite'), rowB.slice(0, 300));
  ok('…étiquettes « Correspondant » et « Compte de l’équipe », code partagé signalé',
    rowB.includes('Correspondant') && rowB.includes('Compte de l’équipe') && rowB.includes('aussi sur d’autres comptes : 1'));
  const wa = await rows.nth(0).locator('[data-testid="doctor-whatsapp"]').getAttribute('href');
  ok('WhatsApp : son numéro au format international, message avec le lien de SON espace',
    wa.startsWith('https://wa.me/212600000031?text=') && decodeURIComponent(wa.split('text=')[1]).includes('http://labo.test/fr/mes-patients') && decodeURIComponent(wa.split('text=')[1]).includes('Dr Actif Banc'), wa.slice(0, 70));
  ok('…pas de bouton WhatsApp sans numéro', (await rows.nth(1).locator('[data-testid="doctor-whatsapp"]').count()) === 0);

  // Retirer : deux clics.
  await rows.nth(1).getByTestId('doctor-revoke').click();
  ok('« Retirer l’accès » demande une confirmation, rien n’est envoyé', (await calls(p, 'adminSetPractitioner')).length === 0);
  await rows.nth(1).getByTestId('doctor-revoke-confirm').click();
  await p.waitForTimeout(300);
  const set = await calls(p, 'adminSetPractitioner');
  ok('…confirmé : retrait de CE compte', set.length === 1 && same(set[0], { uid: DOC_B.uid, clear: true }), JSON.stringify(set));
  ok('…la ligne disparaît', (await p.$$('[data-testid="doctor-row"]')).length === 1);
  const doctorsText = await visibleText(p, '[data-testid="doctors-section"]');
  ok('…message de succès « Accès de Clinique Banc retiré. »', doctorsText.includes('Accès de Clinique Banc retiré.'));
  const msgClass = await p.$eval('[data-testid="doctors-section"] [role="status"]', (el) => el.className);
  ok('…en vert (succès)', msgClass.includes('--status-success'), msgClass);

  // Ouvrir sa fiche : onglet Patients, SON compte, la carte « Accès médecin ».
  await p.getByTestId('doctor-open').first().click();
  await p.waitForSelector('[data-testid="practitioner-card"]', { timeout: 5000 });
  const search = await calls(p, 'adminSearchPatients');
  ok('« Ouvrir sa fiche » : recherche par SON e-mail', search.length === 1 && search[0]?.query === DOC_A.email, JSON.stringify(search));
  ok('…onglet Patients, SON compte sélectionné', (await visibleText(p, '[data-testid="admin-selected"]')).includes(DOC_A.email));
  const card = await visibleText(p, '[data-testid="practitioner-card"]');
  ok('…la carte « Accès médecin » : son code et son engagement', card.includes('DRDEMO') && card.includes('Engagement de confidentialité accepté le'), card.slice(0, 240));
  assertClean(p, await visibleText(p, '#app'));
  await p.close();

  // Un stagiaire : il voit, il ne retire pas.
  p = await freshPage(browser, {
    page: 'admin',
    profile: STAFF,
    server: { identities: {} },
    responses: { adminListPractitionerRequests: { requests: [] }, adminListPractitioners: { practitioners: [DOC_A] } },
  });
  await p.getByRole('button', { name: /Médecins/ }).first().click();
  await p.waitForSelector('[data-testid="doctor-row"]', { timeout: 8000 });
  ok('stagiaire : la liste, « Ouvrir sa fiche »… mais pas « Retirer l’accès »',
    !!(await p.$('[data-testid="doctor-open"]')) && !(await p.$('[data-testid="doctor-revoke"]')));
  ok('…et il est dit pourquoi', (await visibleText(p, '[data-testid="doctors-section"]')).includes('Seul un administrateur'));
  await p.close();

  // Aucun médecin : un message qui dit quoi faire.
  p = await freshPage(browser, {
    page: 'admin',
    profile: STAFF,
    server: { identities: {} },
    responses: { adminListPractitionerRequests: { requests: [] }, adminListPractitioners: { practitioners: [] } },
  });
  await p.getByRole('button', { name: /Médecins/ }).first().click();
  await p.waitForSelector('[data-testid="doctors-empty"]', { timeout: 8000 });
  ok('aucun médecin : « Invitez-en un ci-dessous », et la carte d’invitation est là',
    (await visibleText(p, '[data-testid="doctors-empty"]')).includes('Invitez-en un ci-dessous') && !!(await p.$('[data-testid="invite-doctor-card"]')));
  await p.close();
}

// ── M19 — le tableau de bord : « Les médecins » ─────────────────────────────
function dashFixture(practitioners) {
  const month = (key, created, cumulative) => ({ key, created, cumulative });
  return {
    totals: { accounts: 60, withAccess: 51, withoutAccess: 9, pendingRequests: 2, byType: { patient: 51, medecin: 0, correspondant: 0 } },
    teamAccounts: 4,
    includeTeam: false,
    usage: { active: 22, dormant: 29, rate: 43, windowDays: 30 },
    growth: { months: [month('2026-08', 17, 55), month('2026-09', 5, 60)] },
    monthDelta: { current: 5, previous: 17, pct: -71 },
    funnel: { created: 60, activated: 51, consulted: 22 },
    freshness: { d7: 9, d30: 13, d90: 11, older: 7, never: 11 },
    ages: [{ key: '31-45', total: 18, active: 11, rate: 61 }],
    frequency: { once: 14, f2_5: 6, f6_15: 2, f16: 0 },
    firstView: { avgDays: 3.4, overWeekPct: 21, sample: 22 },
    relance: { relanced: 0, returned: 0, rate: 0, windowDays: 60 },
    activation: { avgDays: 1.6, sample: 3, weeks: [{ label: '09-17', avgDays: 1.6, n: 3 }] },
    requests: { fulfilled: 34, rejected: 3, pending: 2, oldestPendingDays: 0, oldestPendingName: '' },
    team: [],
    weekly: [{ label: '09-17', consultations: 12 }],
    shares: { month: 0, signups: 0 },
    practitioners,
    latestCreated: [],
    latestActive: [],
    truncated: false,
  };
}

async function m19Dashboard(browser) {
  scenario('M19 — tableau de bord : « Les médecins », une ligne par médecin, des nombres seulement');
  const ADMIN_USER = { uid: 'uid-admin-banc', fullName: 'Admin Banc', phone: '0600000010', email: 'admin.banc@example.test', role: 'admin' };
  const row = (uid, label, code, lastVisitAt, monthDays, monthReports, reports) => ({
    uid, label, fullName: label, requester_id: code, team: false, engaged: true, linkedAt: Date.UTC(2026, 8, 1), lastVisitAt,
    days: monthDays + 2, reports, monthDays, monthReports,
  });
  let p = await freshPage(browser, {
    page: 'admin',
    profile: ADMIN_USER,
    server: { identities: {} },
    width: 1300,
    responses: {
      adminListStaff: { members: [], callerLevel: 2 },
      adminListPractitionerRequests: { requests: [] },
      adminDashboardStats: dashFixture({
        accounts: 2, active: 1, consultations30d: 5, monthDays: 3, monthReports: 8, teamExcluded: 1,
        list: [
          row('u1', 'Dr Actif Banc', 'DRDEMO', Date.UTC(2026, 8, 24, 8), 3, 8, 21),
          row('u2', 'Dr Jamais Banc', 'DRAUTRE', null, 0, 0, 0),
        ],
      }),
    },
  });
  await p.waitForSelector('[data-testid="dash-doctors"]', { timeout: 8000 });
  const figures = await p.$$eval('[data-testid="dash-doctors-figures"] > div', (els) =>
    els.map((d) => [d.querySelector('dt').textContent.trim(), d.querySelector('dd').textContent.trim()])
  );
  ok('trois chiffres : médecins activés, actifs sur 30 jours, bilans ouverts ce mois-ci',
    same(figures, [['Médecins activés', '2'], ['Actifs ces 30 jours', '1'], ['Bilans ouverts ce mois-ci', '8']]), JSON.stringify(figures));
  const rows = await p.$$eval('[data-testid="dash-doctor-row"]', (els) => els.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())));
  ok('une ligne par médecin, dans l’ordre reçu (le plus récent d’abord)', rows.length === 2 && rows[0][0].startsWith('Dr Actif Banc') && rows[1][0].startsWith('Dr Jamais Banc'), JSON.stringify(rows));
  ok('…jours et bilans du mois, bilans au total', same(rows[0].slice(2), ['3', '8', '21']), JSON.stringify(rows[0]));
  ok('…« jamais » pour un médecin qui n’est pas venu', rows[1][1] === 'jamais', JSON.stringify(rows[1]));
  ok('les comptes de l’équipe laissés de côté sont annoncés, avec la case à cocher',
    (await visibleText(p, '[data-testid="dash-doctors-team"]')).includes('Comptes de l’équipe non comptés ici : 1'));
  const text = await visibleText(p, '#app');
  ok('aucun nom de PATIENT, aucun n° de dossier sur le tableau de bord des médecins', !/DÉMO|EXEMPLE|FICTIF|ESSAI|100926901/.test(text));
  assertClean(p, text);
  await p.screenshot({ path: path.join(SHOTS, 'm19-tableau-medecins.png'), fullPage: true });
  await p.close();

  // Seul médecin = un compte de l'équipe : ni « aucun médecin activé », ni silence.
  p = await freshPage(browser, {
    page: 'admin',
    profile: ADMIN_USER,
    server: { identities: {} },
    width: 1300,
    responses: {
      adminListStaff: { members: [], callerLevel: 2 },
      adminListPractitionerRequests: { requests: [] },
      adminDashboardStats: dashFixture({ accounts: 0, active: 0, consultations30d: 0, monthDays: 0, monthReports: 0, teamExcluded: 1, list: [] }),
    },
  });
  await p.waitForSelector('[data-testid="dash-doctors-team"]', { timeout: 8000 });
  const t2 = await visibleText(p, '#app');
  ok('seul médecin sur un compte de l’équipe : « Aucun médecin en dehors des comptes de l’équipe » + la case à cocher',
    t2.includes('Aucun médecin en dehors des comptes de l’équipe.') && t2.includes('Inclure les comptes de l’équipe'));
  await p.close();
}

// ── M20 — passer le dossier principal en dossier d'un proche ────────────────
// 06/10/2026 : un père qui n'a jamais fait d'analyse vient avec sa fille ; à
// l'accueil, le numéro de la fille est validé comme SON dossier. Ça marche, mais
// l'application présente les résultats de sa fille comme les siens. Le bouton
// déplace le numéro vers « Dossiers d'un proche », avec un libellé.
async function m20MoveOwnToRelative(browser) {
  scenario('M20 — admin : « Le passer en dossier d’un proche » (parent sans dossier, enfant saisi comme lui)');
  const PARENT = {
    uid: 'u-banc-0041', email: 'parent.banc@example.test', hasProfile: true, fullName: 'Parent Banc', phone: '0600000041',
    createdAt: '2026-10-06T12:00:00Z', dateOfBirth: '1982-02-11', requester_id: '900041', type: 'patient',
    links: [], linkedCount: 0, practitioner: null,
  };
  const p = await freshPage(browser, {
    page: 'admin',
    profile: STAFF,
    server: { identities: {} },
    responses: {
      adminSearchPatients: { results: [PARENT], truncated: false },
      adminLinkRequester: {
        success: true,
        links: [{ requester_id: '900041', type: 'patient', label: 'Ma fille — Démo', linkedAt: Date.UTC(2026, 9, 7, 9, 0) }],
        holderNotified: false,
      },
    },
  });
  await p.getByPlaceholder(/Email, nom/).waitFor({ timeout: 8000 });
  await adminSearch(p, 'parent.banc@example.test');
  await p.waitForSelector('[data-testid="link-move-own"]', { timeout: 5000 });
  ok('la carte « Dossiers d’un proche » propose de déplacer le dossier principal (900041)',
    (await visibleText(p, '[data-testid="link-move-own"]')).includes('900041'));
  ok('le champ du dossier principal porte 900041 avant', (await p.inputValue('input[placeholder="Ex. : 12345"]')) === '900041');
  await p.getByTestId('link-move-open').click();
  const confirm = p.getByTestId('link-move-confirm');
  ok('sans libellé : bouton verrouillé', await confirm.isDisabled());
  await p.fill('#link-move-label', 'Ma fille — Démo');
  ok('libellé saisi : déverrouillé', !(await confirm.isDisabled()));
  await confirm.click();
  await p.waitForTimeout(400);
  const sent = await calls(p, 'adminLinkRequester');
  ok('UN appel : ce compte, ce numéro, type patient, le libellé, fromOwn',
    sent.length === 1 && same(sent[0], { uid: PARENT.uid, requester_id: '900041', type: 'patient', label: 'Ma fille — Démo', fromOwn: true }),
    JSON.stringify(sent));
  const text = await visibleText(p, '#app');
  ok('message de succès : rattaché comme « Ma fille — Démo », dossier principal vide',
    text.includes('Le dossier 900041 est maintenant rattaché comme « Ma fille — Démo »'));
  ok('le proche apparaît dans la liste', text.includes('Ma fille — Démo'));
  ok('le champ du dossier principal est vide', (await p.inputValue('input[placeholder="Ex. : 12345"]')) === '');
  ok('la proposition de déplacement disparaît (plus de dossier principal)', !(await p.$('[data-testid="link-move-own"]')));
  assertClean(p, await visibleText(p, '#app'));
  await p.close();
}

// ── M21 — l'accueil corrige le profil d'un patient ──────────────────────────
// Demande de l'équipe (07/10/2026) : des patients saisissent un surnom, un nom
// abrégé ou une mauvaise date de naissance, et deviennent introuvables.
async function m21EditProfile(browser) {
  scenario('M21 — admin : « Modifier le profil » (nom, date de naissance, téléphone)');
  const P = {
    uid: 'u-banc-0051', email: 'patient.surnom@example.test', hasProfile: true, fullName: 'Momo', phone: '0600000051',
    createdAt: '2026-10-01T10:00:00Z', dateOfBirth: '1990-01-01', requester_id: '900051', type: 'patient',
    links: [], linkedCount: 0, practitioner: null,
  };
  const p = await freshPage(browser, {
    page: 'admin',
    profile: STAFF,
    server: { identities: {} },
    responses: {
      adminSearchPatients: { results: [P], truncated: false },
      adminUpdateProfile: { changed: ['fullName', 'dateOfBirth'], fullName: 'Mohamed Démo', dateOfBirth: '1991-01-10', phone: '0600000051' },
    },
  });
  await p.getByPlaceholder(/Email, nom/).waitFor({ timeout: 8000 });
  await adminSearch(p, 'momo');
  await p.waitForSelector('[data-testid="profile-edit"]', { timeout: 5000 });
  await p.getByTestId('profile-edit').click();
  await p.waitForSelector('[data-testid="profile-editor"]');
  const save = p.getByTestId('profile-save');
  ok('formulaire prérempli avec le profil actuel',
    (await p.inputValue('#profile-fullname')) === 'Momo' && (await p.inputValue('#profile-dob')) === '1990-01-01' && (await p.inputValue('#profile-phone')) === '0600000051');
  ok('rien de modifié : bouton verrouillé, et il dit pourquoi',
    (await save.isDisabled()) && (await p.textContent('[data-testid="profile-why"]')).includes('Aucune modification'));
  ok('l’e-mail est affiché mais pas modifiable (identifiant de connexion)',
    (await visibleText(p, '[data-testid="profile-editor"]')).includes('identifiant de connexion') && !(await p.$('[data-testid="profile-editor"] input[type="email"]')));
  await p.fill('#profile-fullname', 'O');
  ok('nom trop court : verrouillé', await save.isDisabled());
  await p.fill('#profile-fullname', '  Mohamed   Démo ');
  await p.fill('#profile-dob', '1991-01-10');
  ok('nom et date corrigés : déverrouillé', !(await save.isDisabled()));
  await save.click();
  await p.waitForSelector('[data-testid="profile-notice"]', { timeout: 5000 });
  const sent = await calls(p, 'adminUpdateProfile');
  ok('UN appel : ce compte, nom nettoyé, date, téléphone',
    sent.length === 1 && same(sent[0], { uid: P.uid, fullName: 'Mohamed Démo', dateOfBirth: '1991-01-10', phone: '0600000051' }),
    JSON.stringify(sent));
  const card = await visibleText(p, '[data-testid="admin-selected"]');
  ok('la fiche affiche le nom corrigé, et « Profil corrigé » en vert',
    card.includes('Mohamed Démo') && card.includes('Profil corrigé') && !(await p.$('[data-testid="profile-editor"]')));
  // Annuler ne change rien.
  await p.getByTestId('profile-edit').click();
  await p.fill('#profile-fullname', 'Autre Nom');
  await p.getByTestId('profile-cancel').click();
  ok('« Annuler » : formulaire fermé, aucun nouvel appel', !(await p.$('[data-testid="profile-editor"]')) && (await calls(p, 'adminUpdateProfile')).length === 1);
  assertClean(p, await visibleText(p, '#app'));
  await p.close();
}

// ── M22 — Demandes : valider l'accès « pour un proche » en une fois ─────────
// 08/10/2026 : un parent sans dossier à lui vient avec son enfant. Sa demande
// d'inscription se valide directement en rattachant l'enfant comme proche.
async function m22RequestForRelative(browser) {
  scenario('M22 — Demandes : « Accès pour : un proche » rattache l’enfant et clôt la demande');
  const REQ = { uid: 'u-banc-0061', fullName: 'Parent Demande', email: 'parent.demande@example.test', phone: '0600000061', dateOfBirth: '1982-02-11', createdAt: Date.UTC(2026, 9, 7, 16, 25) };
  const p = await freshPage(browser, {
    page: 'admin',
    profile: STAFF,
    server: { identities: {} },
    responses: { adminListAccessRequests: { requests: [REQ] }, adminFulfillAccessRequest: { success: true, forRelative: true, holderNotified: false } },
  });
  await p.getByRole('button', { name: /Demandes/ }).first().click();
  await p.waitForSelector('[data-testid="ar-for"]', { timeout: 8000 });
  ok('la carte montre la date de naissance et l’âge, pour retrouver le bon patient',
    /Né\(e\) le 11 février 1982 \(\d+ ans\)/.test(await p.textContent('[data-testid="ar-dob"]')), await p.textContent('[data-testid="ar-dob"]'));
  ok('par défaut : accès pour lui-même, sans champs proche',
    (await p.getAttribute('[data-testid="ar-for-self"]', 'aria-checked')) === 'true' && !(await p.$('[data-testid="ar-relative-fields"]')));
  await p.getByPlaceholder('Identifiant patient (requester_id)').first().fill('900061');
  await p.getByTestId('ar-for-relative').click();
  const validate = p.getByRole('button', { name: /Valider l'accès/ }).first();
  ok('« un proche » : libellé et justificatif apparaissent, bouton verrouillé', !!(await p.$('[data-testid="ar-relative-fields"]')) && (await validate.isDisabled()));
  ok('…et il dit pourquoi (libellé)', (await p.textContent('[data-testid="ar-why"]')).includes('de qui'));
  await p.fill('[data-testid="ar-label"]', 'Ma fille — Démo');
  ok('libellé saisi, pas de justificatif : verrouillé, « sur quelle base »', (await validate.isDisabled()) && (await p.textContent('[data-testid="ar-why"]')).includes('base'));
  await p.getByTestId('ar-proof-autorite_parentale').click();
  ok('justificatif touché : déverrouillé', !(await validate.isDisabled()));
  await validate.click();
  await p.waitForTimeout(400);
  const sent = await calls(p, 'adminFulfillAccessRequest');
  ok('UN appel : ce compte, ce numéro, patient, proche avec libellé et justificatif',
    sent.length === 1 && same(sent[0], { uid: REQ.uid, requester_id: '900061', type: 'patient', forRelative: { label: 'Ma fille — Démo', proof: 'autorite_parentale' } }),
    JSON.stringify(sent));
  ok('message : « voit maintenant « Ma fille — Démo » »', (await visibleText(p, '#app')).includes('voit maintenant « Ma fille — Démo »'));
  assertClean(p, await visibleText(p, '#app'));
  await p.close();
}

// ── M23 — « Vue patient » : voir l'application comme le patient ─────────────
// 08/10/2026 (Dr Aziz) : l'onglet « Tester » devient « Vue patient ». On cherche
// un compte, puis on navigue SES vrais écrans, en lecture seule.
async function m23ViewAs(browser) {
  scenario('M23 — Vue patient : ses résultats, ses proches, « Mes patients » pour un médecin, en lecture seule');
  const ADMIN_USER = { uid: 'uid-admin-banc', fullName: 'Admin Banc', phone: '0600000010', email: 'admin.banc@example.test', role: 'admin' };
  const VIEWED = {
    uid: 'uid-vu-banc', email: 'vu.banc@example.test', hasProfile: true, fullName: 'Patient Vu Banc', phone: '0600000023',
    requester_id: '900001', type: 'patient',
    links: [{ requester_id: '900003', type: 'patient', label: 'Ma fille Démo' }],
    practitioner: { requester_id: CODE, type: 'medecin', label: 'Dr Démo Banc' },
  };
  const server = doctorServer({
    primary: '900001',
    identities: { '900001': { list: MY_DOSSIERS }, '900003': { list: [{ ...MY_DOSSIERS[0], dossier_id: 'D-9003-A' }] }, [CODE]: { list: ROSTER } },
  });
  let p = await freshPage(browser, { page: 'admin', profile: ADMIN_USER, server, width: 1100, responses: { adminDashboardStats: null, adminListStaff: { members: [], callerLevel: 2 }, adminListPractitionerRequests: { requests: [] }, adminListPractitioners: { practitioners: [] }, adminSearchPatients: { results: [VIEWED], truncated: false } } });
  await p.getByRole('button', { name: /Vue patient/ }).first().click();
  await p.waitForSelector('[data-testid="viewas-search"]', { timeout: 8000 });
  ok('l’onglet garde le test du serveur sans compte, en dessous', (await visibleText(p, '#app')).includes('Tester un numéro sans compte'));
  await p.fill('[data-testid="viewas-query"]', 'Patient Vu');
  await p.locator('[data-testid="viewas-search"] button[type="submit"]').click();
  await p.waitForSelector('[data-testid="viewas-banner"]', { timeout: 8000 });
  await p.waitForTimeout(800);
  ok('un seul compte trouvé : il s’ouvre directement, bandeau « lecture seule » à son nom',
    /comme Patient Vu Banc.*lecture seule/.test(await p.textContent('[data-testid="viewas-banner"]')));
  const first = await calls(p, 'adminViewAs');
  ok('ses résultats passent par adminViewAs, pour CE compte — jamais fetchResults',
    first.length >= 1 && first.every((c) => c.uid === 'uid-vu-banc') && (await calls(p, 'fetchResults')).length === 0, JSON.stringify(first));
  ok('jamais son code médecin au démarrage', withCode(first).length === 0);
  const text = await visibleText(p, '[data-testid="viewas"]');
  ok('l’onglet de son proche est là', text.includes('Ma fille Démo'));
  ok('aucune action à son nom (partage, ajout d’un proche, alerte panne)',
    !(await p.$('[data-testid="share-access-card"]')) && !/Ajouter un proche/.test(text));
  await p.getByTestId('viewas-tab-patients').click();
  await waitForList(p);
  ok('« Mes patients » : sa liste, un appel sans PDF avec son code', withCode(await calls(p, 'adminViewAs')).some((c) => c.include_pdf === 'none'));
  ok('…ses 4 patients', (await patientNames(p)).length === 4);
  assertClean(p, await visibleText(p, '#app'));
  await p.getByTestId('viewas-close').click();
  ok('« Changer de compte » revient à la recherche', !!(await p.$('[data-testid="viewas-search"]')));
  await p.close();

  // Un stagiaire : la patientèle d'un médecin reste fermée.
  p = await freshPage(browser, { page: 'admin', profile: STAFF, server, responses: { adminSearchPatients: { results: [VIEWED], truncated: false } } });
  await p.getByRole('button', { name: /Vue patient/ }).first().click();
  await p.fill('[data-testid="viewas-query"]', 'Patient Vu');
  await p.locator('[data-testid="viewas-search"] button[type="submit"]').click();
  await p.waitForSelector('[data-testid="viewas-banner"]', { timeout: 8000 });
  await p.getByTestId('viewas-tab-patients').click();
  await p.waitForTimeout(300);
  ok('stagiaire : « Mes patients » d’un médecin réservé aux administrateurs, aucun appel avec son code',
    !!(await p.$('[data-testid="viewas-doctor-locked"]')) && withCode(await calls(p, 'adminViewAs')).length === 0);
  await p.close();
}

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
    await m11Menu(browser);
    await m12HomePanel(browser);
    await m13ProfileAndSwitch(browser);
    await m14AdminOneCard(browser);
    await m15DoctorRequest(browser);
    await m16AdminDoctorRequests(browser);
    await m17EngagementGate(browser);
    await m18AdminDoctorsTab(browser);
    await m19Dashboard(browser);
    await m20MoveOwnToRelative(browser);
    await m21EditProfile(browser);
    await m22RequestForRelative(browser);
    await m23ViewAs(browser);
  } finally {
    await browser.close();
  }
  finish();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
