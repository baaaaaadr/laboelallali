#!/usr/bin/env node
/**
 * Banc navigateur « Emploi & Stage » (devis lignes 27 et 40, 08/10/2026).
 *
 *     node scripts/test-emploi-ui.js            (ajouter --head pour voir)
 *
 * Même harnais que les bancs « résultats » et « médecin » (voir
 * `scripts/testing/README.md`) : la VRAIE page `/emploi` et la VRAIE page
 * `/admin`, avec les seules frontières externes doublées. Chaque appel aux
 * fonctions Firebase est enregistré : on vérifie ce que la page ENVOIE.
 *
 *  F1 formulaire vide : rien ne part, tout est signalé d'un coup
 *  F2 les champs suivent le type de demande
 *  F3 une candidature complète : la charge envoyée, exacte, puis la confirmation
 *  F4 les fichiers : programme refusé, fichier trop lourd, photo convertie en JPEG
 *  F5 les refus du serveur : champ signalé, limite du jour
 *  F6 préremplissage d'un visiteur connecté, piège à robots invisible
 *  F7 arabe
 *  C1 stagiaire : pas d'onglet, aucun appel
 *  C2 admin : onglet, badge, une seule lecture, filtres, recherche
 *  C3 une fiche : décision, note, CV (PDF), lettre (photo), Word
 *  C4 effacement en deux clics, export Excel, lien de l'e-mail d'alerte
 *
 * ⚠ Données FICTIVES uniquement.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { unzipSync, strFromU8 } = require('fflate');
const {
  SHOTS,
  build,
  createReporter,
  freshPage,
  calls,
  visibleText,
  realErrors,
  rawKeys,
} = require('./testing/results-bench');

const HEADED = process.argv.includes('--head');
const { scenario, ok, finish } = createReporter();

const FAKE_PDF = Buffer.from(
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2c+PgplbmRvYmoKdHJhaWxlcgo8PC9Sb290IDEgMCBSPj4KJSVFT0YK',
  'base64'
);
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

function assertClean(p, text) {
  const real = realErrors(p);
  ok('aucune erreur JavaScript', real.length === 0, real.slice(0, 3).join(' | '));
  const raw = rawKeys(text);
  ok('aucune clé de traduction brute à l’écran', raw.length === 0, raw.join(', '));
}

const chip = (p, field, value) => p.click(`[data-testid="chips-${field}"] [data-value="${value}"]`);
const kind = (p, k) =>
  p.click(`[data-testid="emploi-kinds"] [role="radio"] >> nth=${['observation', 'preembauche', 'emploi', 'spontanee'].indexOf(k)}`);

async function attach(p, field, file) {
  await p.setInputFiles(`[data-testid="input-${field}"]`, file);
  await p.waitForFunction(
    (f) => !!document.querySelector(`[data-testid="file-${f}"]`) || !!document.getElementById(`${f}-error`),
    field,
    { timeout: 8000 }
  );
}

/** A complete, valid « candidature à un poste ». */
async function fillValid(p) {
  await kind(p, 'emploi');
  await chip(p, 'position', 'technicien');
  await chip(p, 'availability', 'immediate');
  await p.fill('#f-lastName', 'Démo');
  await p.fill('#f-firstName', 'Salma');
  await p.fill('#f-dateOfBirth', '2001-05-14');
  await p.fill('#f-phone', '06 12 34 56 78');
  await p.fill('#f-email', 'salma.demo@example.test');
  await p.fill('#f-city', 'Agadir');
  await p.fill('#f-district', 'Dakhla');
  await chip(p, 'diplomaLevel', 'bac2');
  await p.fill('#f-diplomaTitle', 'DTS analyses médicales');
  await p.fill('#f-diplomaYear', '2022');
  await p.fill('#f-school', 'IFMIAS Agadir');
  await chip(p, 'experience', '1_3');
  await p.fill('#f-lastEmployer', 'Laboratoire Exemple');
  await chip(p, 'license', 'yes');
  await chip(p, 'vehicle', 'moto');
  await chip(p, 'languages', 'francais');
  await chip(p, 'languages', 'arabe');
  await chip(p, 'source', 'facebook');
  await attach(p, 'cv', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: FAKE_PDF });
  await p.check('[data-testid="emploi-consent"]');
}

const submit = async (p) => {
  await p.click('[data-testid="emploi-submit"]');
  await p.waitForTimeout(400);
};

// ── F1 ──────────────────────────────────────────────────────────────────────
async function f1Empty(browser) {
  scenario('F1 — formulaire vide : rien ne part, chaque manque est signalé d’un coup');
  const p = await freshPage(browser, { page: 'emploi', responses: { submitApplication: { ok: true, ref: 'AB3DE9' } } });
  await p.waitForSelector('[data-testid="emploi-form"]', { timeout: 8000 });
  const text = await visibleText(p, '#app');
  ok('titre, introduction « sans créer de compte »', text.includes('Emploi & Stage') && text.includes('sans créer de compte'));
  ok('quatre types de demande', (await p.$$('[data-testid="emploi-kinds"] [role="radio"]')).length === 4);
  ok('le bouton d’envoi est cliquable (jamais verrouillé)', !(await p.isDisabled('[data-testid="emploi-submit"]')));
  await submit(p);
  ok('AUCUN appel au serveur', (await calls(p, 'submitApplication')).length === 0);
  const missing = (await p.textContent('[data-testid="emploi-missing"]')) || '';
  ok(
    'la liste dit ce qui manque, dans l’ordre du formulaire',
    missing.startsWith('À compléter ou corriger : Votre demande, Nom, Prénom, Date de naissance, Téléphone, Ville'),
    missing.slice(0, 140)
  );
  ok('… jusqu’au consentement', missing.includes('CV') === false && missing.includes('Consentement'), missing);
  ok('les champs fautifs sont marqués', (await p.$$('[aria-invalid="true"]')).length >= 8);
  assertClean(p, text);
  await p.screenshot({ path: path.join(SHOTS, 'emploi-f1-vide.png'), fullPage: true });
  await p.close();
}

// ── F2 ──────────────────────────────────────────────────────────────────────
async function f2Conditional(browser) {
  scenario('F2 — les champs suivent le type de demande');
  const p = await freshPage(browser, { page: 'emploi' });
  await p.waitForSelector('[data-testid="emploi-form"]', { timeout: 8000 });
  ok('avant le choix : ni poste, ni durée, ni disponibilité', !(await p.$('[data-testid="chips-position"]')) && !(await p.$('[data-testid="chips-duration"]')));
  await kind(p, 'emploi');
  ok('poste : « Poste visé » obligatoire + disponibilité, pas de durée',
    (await p.textContent('[data-field="position"]')).includes('Poste visé*') &&
      !!(await p.$('[data-testid="chips-availability"]')) &&
      !(await p.$('[data-testid="chips-duration"]')));
  await chip(p, 'availability', 'date');
  ok('« À partir d’une date » ouvre la date', !!(await p.$('#f-availableFrom')));
  await chip(p, 'position', 'autre');
  ok('poste « Autre » : il faut le préciser', !!(await p.$('#f-positionOther')));
  await kind(p, 'observation');
  const pos = await p.textContent('[data-field="position"]');
  ok('stage d’observation : scolarité + durée + dates, poste FACULTATIF',
    !!(await p.$('[data-testid="chips-schoolLevel"]')) &&
      !!(await p.$('[data-testid="chips-duration"]')) &&
      !!(await p.$('#f-startDate')) &&
      pos.includes('Service qui vous intéresse') && pos.includes('(facultatif)'),
    pos);
  ok('… le CV devient facultatif (lettre de l’établissement acceptée)',
    (await p.textContent('[data-field="cv"]')).includes('(facultatif)') &&
      (await visibleText(p, '#app')).includes('la lettre de votre établissement suffit'));
  await kind(p, 'preembauche');
  ok('stage pré-embauche : durée ET poste obligatoire, pas de scolarité',
    !!(await p.$('[data-testid="chips-duration"]')) && !(await p.$('[data-testid="chips-schoolLevel"]')) &&
      (await p.textContent('[data-field="position"]')).includes('Poste visé*'));
  await p.fill('#f-startDate', '2026-11-10');
  await p.fill('#f-endDate', '2026-11-01');
  await submit(p);
  ok('date de fin avant le début → signalée', ((await p.textContent('[data-field="endDate"]')) || '').includes('doit suivre'));
  await p.fill('#f-dateOfBirth', '2001-05-14');
  ok('l’âge s’affiche sous la date de naissance', /Âge : \d+ ans/.test(await p.textContent('[data-field="dateOfBirth"]')));
  assertClean(p, await visibleText(p, '#app'));
  await p.close();
}

// ── F3 ──────────────────────────────────────────────────────────────────────
async function f3Complete(browser) {
  scenario('F3 — une candidature complète : exactement ce qui part, puis la confirmation');
  const p = await freshPage(browser, { page: 'emploi', responses: { submitApplication: { ok: true, ref: 'AB3DE9' } } });
  await p.waitForSelector('[data-testid="emploi-form"]', { timeout: 8000 });
  await fillValid(p);
  ok('le CV joint s’affiche avec son poids', /cv\.pdf/.test(await p.textContent('[data-testid="file-cv"]')));
  await submit(p);
  await p.waitForSelector('[data-testid="emploi-done"]', { timeout: 8000 });
  const sent = await calls(p, 'submitApplication');
  ok('UN appel', sent.length === 1, String(sent.length));
  const a = sent[0] || {};
  ok('langue, piège vide, temps passé mesuré', a.lang === 'fr' && a.hp === '' && typeof a.elapsedMs === 'number' && a.elapsedMs >= 0);
  const f = a.form || {};
  ok(
    'le formulaire tel que le serveur le lit',
    f.kind === 'emploi' && f.position === 'technicien' && f.availability === 'immediate' &&
      f.lastName === 'Démo' && f.firstName === 'Salma' && f.dateOfBirth === '2001-05-14' &&
      f.phone === '06 12 34 56 78' && f.email === 'salma.demo@example.test' && f.city === 'Agadir' &&
      f.diplomaLevel === 'bac2' && f.diplomaYear === 2022 && f.experience === '1_3' &&
      f.license === true && f.vehicle === 'moto' && JSON.stringify(f.languages) === '["francais","arabe"]' &&
      f.source === 'facebook' && f.consent === true,
    JSON.stringify(f).slice(0, 400)
  );
  ok('pas de numéro de CIN demandé ni envoyé', !/cin/i.test(Object.keys(f).join(',')));
  ok('le CV part en base64, avec son nom', a.files?.cv?.name === 'cv.pdf' && String(a.files?.cv?.data).startsWith('JVBER') && !a.files?.letter);
  const done = await visibleText(p, '[data-testid="emploi-done"]');
  ok('confirmation : prénom, référence, accusé de réception annoncé',
    done.includes('Merci Salma') && done.includes('AB3DE9') && done.includes('salma.demo@example.test'), done);
  assertClean(p, done);
  await p.screenshot({ path: path.join(SHOTS, 'emploi-f3-envoyee.png'), fullPage: true });
  await p.close();
}

// ── F4 ──────────────────────────────────────────────────────────────────────
async function f4Files(browser) {
  scenario('F4 — les fichiers : programme refusé, fichier trop lourd, photo convertie');
  const p = await freshPage(browser, { page: 'emploi', responses: { submitApplication: { ok: true, ref: 'PHOTO1' } } });
  await p.waitForSelector('[data-testid="emploi-form"]', { timeout: 8000 });
  await attach(p, 'letter', { name: 'lettre.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ\x90\x00programme') });
  ok('un programme → « Format non accepté », rien n’est joint',
    ((await p.textContent('[data-field="letter"]')) || '').includes('Format non accepté') && !(await p.$('[data-testid="file-letter"]')));
  await attach(p, 'letter', { name: 'gros.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([FAKE_PDF, Buffer.alloc(5.2 * 1024 * 1024)]) });
  ok('plus de 5 Mo → « Fichier trop lourd »', ((await p.textContent('[data-field="letter"]')) || '').includes('Fichier trop lourd'));
  // A real image: a screenshot of the page itself (PNG).
  const png = await p.screenshot();
  await attach(p, 'letter', { name: 'photo-lettre.png', mimeType: 'image/png', buffer: png });
  ok('une photo → jointe, renommée en .jpg (redessinée, métadonnées retirées)',
    ((await p.textContent('[data-testid="file-letter"]')) || '').includes('photo-lettre.jpg'));
  await p.click('[data-testid="remove-letter"]');
  ok('« Retirer » enlève la pièce', !(await p.$('[data-testid="file-letter"]')));
  await attach(p, 'letter', { name: 'photo-lettre.png', mimeType: 'image/png', buffer: png });
  await fillValid(p);
  await submit(p);
  await p.waitForSelector('[data-testid="emploi-done"]', { timeout: 8000 });
  const a = (await calls(p, 'submitApplication'))[0] || {};
  ok('la photo part en JPEG', String(a.files?.letter?.data).startsWith('/9j/') && a.files?.letter?.name === 'photo-lettre.jpg');
  assertClean(p, await visibleText(p, '#app'));
  await p.close();
}

// ── F5 ──────────────────────────────────────────────────────────────────────
async function f5Refusals(browser) {
  scenario('F5 — les refus du serveur : le champ est montré, les réponses restent');
  let p = await freshPage(browser, { page: 'emploi' });
  await p.waitForSelector('[data-testid="emploi-form"]', { timeout: 8000 });
  await p.evaluate(() => {
    window.__callables.submitApplication = () => {
      const e = new Error('invalid-argument');
      e.code = 'functions/invalid-argument';
      e.details = { fields: { cv: 'format' } };
      throw e;
    };
  });
  await fillValid(p);
  await submit(p);
  ok('pièce refusée par le serveur (vrai format) → signalée sous le CV',
    ((await p.textContent('[data-field="cv"]')) || '').includes('Format non accepté'));
  ok('… et un message général', ((await p.textContent('[data-testid="emploi-send-error"]')) || '').includes('corrigez les champs'));
  ok('les réponses sont toujours là', (await p.inputValue('#f-lastName')) === 'Démo');
  await p.close();

  p = await freshPage(browser, { page: 'emploi' });
  await p.waitForSelector('[data-testid="emploi-form"]', { timeout: 8000 });
  await p.evaluate(() => {
    window.__callables.submitApplication = () => {
      const e = new Error('resource-exhausted');
      e.code = 'functions/resource-exhausted';
      throw e;
    };
  });
  await fillValid(p);
  await submit(p);
  ok('déjà envoyée aujourd’hui → « appelez le laboratoire »',
    ((await p.textContent('[data-testid="emploi-send-error"]')) || '').includes('appelez le laboratoire'));
  await p.evaluate(() => {
    window.__callables.submitApplication = () => {
      throw new Error('network');
    };
  });
  await submit(p);
  ok('panne réseau → « vos réponses sont conservées »',
    ((await p.textContent('[data-testid="emploi-send-error"]')) || '').includes('vos réponses sont conservées'));
  assertClean(p, await visibleText(p, '#app'));
  await p.close();
}

// ── F6 ──────────────────────────────────────────────────────────────────────
async function f6Prefill(browser) {
  scenario('F6 — visiteur connecté : préremplissage ; piège à robots invisible');
  const profile = {
    uid: 'uid-candidat-banc',
    fullName: 'Candidat Banc',
    phone: '0600000077',
    email: 'candidat.banc@example.test',
    dateOfBirth: '1999-03-02',
  };
  const p = await freshPage(browser, { page: 'emploi', profile });
  await p.waitForSelector('[data-testid="emploi-form"]', { timeout: 8000 });
  await p.waitForTimeout(200);
  ok('téléphone, e-mail et date de naissance préremplis',
    (await p.inputValue('#f-phone')) === '0600000077' &&
      (await p.inputValue('#f-email')) === 'candidat.banc@example.test' &&
      (await p.inputValue('#f-dateOfBirth')) === '1999-03-02');
  ok('… et il le sait', (await visibleText(p, '#app')).includes('viennent de votre compte'));
  ok('le nom n’est PAS deviné depuis le compte', (await p.inputValue('#f-lastName')) === '');
  const trap = await p.$('#f-website');
  const box = trap ? await trap.boundingBox() : null;
  ok('piège : hors écran, hors tabulation, caché aux lecteurs d’écran',
    !!trap && (!box || box.x < -1000) && (await trap.getAttribute('tabindex')) === '-1' &&
      (await p.$eval('#f-website', (el) => el.closest('[aria-hidden="true"]') !== null)));
  assertClean(p, await visibleText(p, '#app'));
  await p.close();
}

// ── F7 ──────────────────────────────────────────────────────────────────────
async function f7Arabic(browser) {
  scenario('F7 — arabe : de droite à gauche, aucun texte manquant');
  const p = await freshPage(browser, { lang: 'ar', page: 'emploi', responses: { submitApplication: { ok: true, ref: 'AR0001' } } });
  await p.waitForSelector('[data-testid="emploi-form"]', { timeout: 8000 });
  await kind(p, 'observation');
  await submit(p);
  const text = await visibleText(p, '#app');
  ok('titre arabe', text.includes('التوظيف والتدريب'));
  ok('choix et erreurs en arabe', text.includes('تدريب استطلاعي') && text.includes('حقل إلزامي'));
  ok('aucun libellé resté en français', !/Poste visé|Votre demande|Champ obligatoire|Envoyer ma candidature/.test(text));
  assertClean(p, text);
  await p.screenshot({ path: path.join(SHOTS, 'emploi-f7-arabe.png'), fullPage: true });
  await p.close();
}

// ── L'onglet admin ──────────────────────────────────────────────────────────
const DAY = 86400000;
const NOW = Date.now();
const base = {
  expiresAt: NOW + 180 * DAY,
  lang: 'fr',
  note: '',
  updatedAt: null,
  updatedByName: '',
  hasAccount: false,
  district: '',
  email: '',
  schoolLevel: '',
  positionOther: '',
  duration: '',
  startDate: '',
  endDate: '',
  availability: '',
  availableFrom: '',
  diplomaTitle: '',
  diplomaYear: null,
  school: '',
  lastEmployer: '',
  languagesOther: '',
  source: '',
};
const APPS = [
  {
    ...base,
    id: 'appAAAAAAAAAAAAAAAA1',
    ref: 'APPAAA',
    createdAt: NOW - 2 * DAY,
    status: 'a_etudier',
    lastName: 'DÉMO',
    firstName: 'Salma',
    dateOfBirth: '2001-05-14',
    city: 'Agadir',
    district: 'Dakhla',
    phone: '06 12 34 56 78',
    email: 'salma.demo@example.test',
    kind: 'emploi',
    position: 'technicien',
    availability: 'immediate',
    diplomaLevel: 'bac2',
    diplomaTitle: 'DTS analyses médicales',
    diplomaYear: 2022,
    experience: '1_3',
    license: true,
    vehicle: 'moto',
    languages: ['arabe', 'francais'],
    source: 'facebook',
    files: { cv: { name: 'cv.pdf', contentType: 'application/pdf', size: 1200 } },
  },
  {
    ...base,
    id: 'appBBBBBBBBBBBBBBBB2',
    ref: 'APPBBB',
    createdAt: NOW - 40 * DAY,
    status: 'a_etudier',
    lastName: 'EXEMPLE',
    firstName: 'Youssef',
    dateOfBirth: '2010-02-01',
    city: 'Inezgane',
    phone: '0700000002',
    kind: 'observation',
    schoolLevel: 'college_lycee',
    duration: '1_semaine',
    startDate: '2026-11-02',
    endDate: '2026-11-06',
    diplomaLevel: 'aucun',
    experience: 'debutant',
    license: false,
    vehicle: 'aucun',
    languages: ['arabe', 'amazighe'],
    files: { letter: { name: 'lettre.jpg', contentType: 'image/jpeg', size: 9000 } },
  },
  {
    ...base,
    id: 'appCCCCCCCCCCCCCCCC3',
    ref: 'APPCCC',
    createdAt: NOW - 5 * DAY,
    status: 'entretien',
    note: 'Appelé le 07/10',
    updatedAt: NOW - DAY,
    updatedByName: 'Admin Banc',
    lastName: 'ESSAI',
    firstName: 'Karim',
    dateOfBirth: '1995-08-20',
    city: 'Agadir',
    phone: '0600000003',
    kind: 'spontanee',
    position: 'coursier',
    availability: 'date',
    availableFrom: '2026-11-01',
    diplomaLevel: 'bac',
    experience: 'plus_3',
    license: true,
    vehicle: 'voiture',
    languages: ['arabe'],
    files: { cv: { name: 'cv.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 20000 } },
  },
];
const ADMIN_USER = { uid: 'uid-admin-banc', fullName: 'Admin Banc', phone: '0600000010', email: 'admin.banc@example.test', role: 'admin' };
const STAFF = { uid: 'uid-stagiaire-banc', fullName: 'Stagiaire Banc', phone: '0600000009', email: 'stagiaire.banc@example.test', role: 'staff' };
const adminResponses = (extra = {}) => ({
  adminDashboardStats: null,
  adminListStaff: { members: [], callerLevel: 2 },
  adminListPractitionerRequests: { requests: [] },
  adminListPractitioners: { practitioners: [] },
  adminListApplications: { applications: APPS, truncated: false },
  adminUpdateApplication: { ok: true, updatedAt: NOW, updatedByName: 'Admin Banc' },
  adminDeleteApplication: { ok: true },
  ...extra,
});
const names = (p) => p.$$eval('[data-testid="cand-name"]', (els) => els.map((e) => e.textContent.trim()));
const openTab = (p) => p.getByRole('button', { name: /Candidatures/ }).first().click();

async function c1Staff(browser) {
  scenario('C1 — stagiaire : pas d’onglet « Candidatures », aucune lecture');
  const p = await freshPage(browser, { page: 'admin', profile: STAFF, responses: adminResponses() });
  await p.waitForTimeout(800);
  ok('aucun onglet « Candidatures »', (await p.getByRole('button', { name: /Candidatures/ }).count()) === 0);
  ok('aucun appel à adminListApplications', (await calls(p, 'adminListApplications')).length === 0);
  await p.close();
}

async function c2List(browser) {
  scenario('C2 — admin : onglet et badge, une seule lecture, filtres et recherche');
  const p = await freshPage(browser, { page: 'admin', profile: ADMIN_USER, width: 1100, responses: adminResponses() });
  await p.waitForTimeout(700);
  const tabText = (await p.getByRole('button', { name: /Candidatures/ }).first().textContent()) || '';
  ok('badge = candidatures « à étudier » (2), chargé dès l’ouverture de l’admin', /Candidatures\s*\(?2\)?/.test(tabText), tabText);
  await openTab(p);
  await p.waitForSelector('[data-testid="cand-card"]', { timeout: 8000 });
  const order = (await names(p)).map((n) => n.split(' ')[0]);
  ok('les trois fiches, dans l’ordre reçu du serveur (le plus récent d’abord)', JSON.stringify(order) === '["DÉMO","EXEMPLE","ESSAI"]', JSON.stringify(order));
  ok('l’âge à côté du nom', /DÉMO Salma · \d+ ans/.test((await names(p))[0]));
  ok('le lien public à partager', (await p.inputValue('[data-testid="cand-public-link"]')).endsWith('/fr/emploi'));
  await p.getByRole('button', { name: /Patients/ }).first().click();
  await p.waitForTimeout(200);
  await openTab(p);
  ok('changer d’onglet ne relit pas la liste (UNE lecture)', (await calls(p, 'adminListApplications')).length === 1);

  await p.click('[data-testid="cand-f-kind"] [data-value="observation"]');
  ok('filtre « Stage d’observation » → EXEMPLE seul', (await names(p)).length === 1 && (await names(p))[0].startsWith('EXEMPLE'));
  ok('l’export suit le filtre (1)', ((await p.textContent('[data-testid="cand-export"]')) || '').includes('(1)'));
  await p.click('[data-testid="cand-f-kind"] [data-value="all"]');
  await p.click('[data-testid="cand-f-period"] [data-value="30"]');
  ok('« 30 derniers jours » écarte la candidature d’il y a 40 jours', (await names(p)).length === 2);
  await p.click('[data-testid="cand-f-period"] [data-value="all"]');
  const statusRow = (await p.textContent('[data-testid="cand-f-status"]')) || '';
  ok('les décisions sont comptées', statusRow.includes('À étudier (2)') && statusRow.includes('Entretien (1)'), statusRow);
  await p.click('[data-testid="cand-f-status"] [data-value="entretien"]');
  ok('filtre « Entretien » → ESSAI seul', (await names(p)).length === 1 && (await names(p))[0].startsWith('ESSAI'));
  await p.click('[data-testid="cand-f-status"] [data-value="all"]');
  await p.fill('[data-testid="cand-search"]', 'demo');
  ok('recherche sans accents : « demo » trouve DÉMO', (await names(p)).length === 1 && (await names(p))[0].startsWith('DÉMO'));
  await p.fill('[data-testid="cand-search"]', '0700000002');
  ok('recherche par téléphone', (await names(p)).length === 1 && (await names(p))[0].startsWith('EXEMPLE'));
  await p.fill('[data-testid="cand-search"]', 'zzz');
  ok('aucun résultat → le dit', !!(await p.$('[data-testid="cand-none"]')));
  assertClean(p, await visibleText(p, '#app'));
  await p.close();
}

async function c3Card(browser) {
  scenario('C3 — une fiche : tout le formulaire, décision, note, CV, lettre, Word');
  const p = await freshPage(browser, {
    page: 'admin',
    profile: ADMIN_USER,
    width: 1100,
    responses: adminResponses({
      adminGetApplicationFile: { base64: FAKE_PDF.toString('base64'), contentType: 'application/pdf', fileName: 'cv.pdf' },
    }),
  });
  await p.waitForTimeout(600);
  await openTab(p);
  await p.waitForSelector('[data-testid="cand-card"]', { timeout: 8000 });
  await p.click('[data-id="appAAAAAAAAAAAAAAAA1"] [data-testid="cand-toggle"]');
  const det = await visibleText(p, '[data-id="appAAAAAAAAAAAAAAAA1"] [data-testid="cand-details"]');
  ok('les réponses en clair (poste, diplôme, permis, langues, origine)',
    det.includes('Technicien(ne) de laboratoire') && det.includes('DTS analyses médicales — 2022') &&
      det.includes('Moto / scooter') && det.includes('Arabe, Français') && det.includes('Facebook'), det.slice(0, 300));
  ok('date d’effacement prévue affichée', det.includes('Effacement prévu le'));
  ok('Appeler / WhatsApp / E-mail',
    (await p.getAttribute('[data-id="appAAAAAAAAAAAAAAAA1"] [data-testid="cand-whatsapp"]', 'href')) === 'https://wa.me/212612345678' &&
      (await p.getAttribute('[data-id="appAAAAAAAAAAAAAAAA1"] [data-testid="cand-call"]', 'href')) === 'tel:0612345678');

  await p.click('[data-id="appAAAAAAAAAAAAAAAA1"] [data-testid="cand-decision"] [data-value="entretien"]');
  await p.waitForTimeout(300);
  let up = await calls(p, 'adminUpdateApplication');
  ok('décision : UN appel {id, status}', up.length === 1 && up[0].id === 'appAAAAAAAAAAAAAAAA1' && up[0].status === 'entretien' && !('note' in up[0]), JSON.stringify(up));
  ok('la pastille suit', ((await p.textContent('[data-id="appAAAAAAAAAAAAAAAA1"] [data-testid="cand-status"]')) || '').includes('Entretien'));
  const tabText = (await p.getByRole('button', { name: /Candidatures/ }).first().textContent()) || '';
  ok('le badge descend à 1', /Candidatures\s*\(?1\)?/.test(tabText), tabText);

  ok('note inchangée → « Enregistrer » inactif', await p.isDisabled('[data-id="appAAAAAAAAAAAAAAAA1"] [data-testid="cand-note-save"]'));
  await p.fill('[data-id="appAAAAAAAAAAAAAAAA1"] [data-testid="cand-note"]', '  Entretien jeudi 10 h  ');
  await p.click('[data-id="appAAAAAAAAAAAAAAAA1"] [data-testid="cand-note-save"]');
  await p.waitForTimeout(300);
  up = await calls(p, 'adminUpdateApplication');
  ok('note : UN appel {id, note} nettoyée', up.length === 2 && up[1].note === 'Entretien jeudi 10 h' && !('status' in up[1]), JSON.stringify(up[1]));
  ok('qui et quand', ((await p.textContent('[data-id="appAAAAAAAAAAAAAAAA1"] [data-testid="cand-updated"]')) || '').includes('Admin Banc'));

  await p.click('[data-id="appAAAAAAAAAAAAAAAA1"] [data-testid="cand-open-cv"]');
  await p.waitForTimeout(500);
  const files = await calls(p, 'adminGetApplicationFile');
  ok('« Voir le CV » : UN appel {id, kind: cv}', files.length === 1 && files[0].id === 'appAAAAAAAAAAAAAAAA1' && files[0].kind === 'cv');
  ok('le CV s’ouvre dans la visionneuse de l’app, titré', (await visibleText(p, 'body')).includes('CV — DÉMO Salma'));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  if ((await visibleText(p, 'body')).includes('CV — DÉMO Salma')) {
    const close = p.getByRole('button', { name: /Fermer/ }).first();
    if (await close.count()) await close.click();
  }

  await p.evaluate((jpeg) => {
    window.__callables.adminGetApplicationFile = () => ({ base64: jpeg, contentType: 'image/jpeg', fileName: 'lettre.jpg' });
  }, TINY_JPEG_B64);
  await p.click('[data-id="appBBBBBBBBBBBBBBBB2"] [data-testid="cand-toggle"]');
  await p.click('[data-id="appBBBBBBBBBBBBBBBB2"] [data-testid="cand-open-letter"]');
  await p.waitForSelector('[data-testid="cand-image-viewer"]', { timeout: 5000 });
  ok('une lettre en photo s’ouvre en grand', !!(await p.$('[data-testid="cand-image-viewer"] img')));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  ok('Échap la referme', !(await p.$('[data-testid="cand-image-viewer"]')));

  await p.evaluate(() => {
    window.__callables.adminGetApplicationFile = () => ({
      base64: btoa('PK\u0003\u0004 word/document.xml'),
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileName: 'cv.docx',
    });
  });
  await p.click('[data-id="appCCCCCCCCCCCCCCCC3"] [data-testid="cand-toggle"]');
  const [dl] = await Promise.all([
    p.waitForEvent('download', { timeout: 5000 }),
    p.click('[data-id="appCCCCCCCCCCCCCCCC3"] [data-testid="cand-open-cv"]'),
  ]);
  ok('un CV Word se télécharge, sous son nom', dl.suggestedFilename() === 'cv.docx', dl.suggestedFilename());
  assertClean(p, await visibleText(p, '#app'));
  await p.screenshot({ path: path.join(SHOTS, 'emploi-c3-fiche.png'), fullPage: true });
  await p.close();
}

async function c4DeleteExport(browser) {
  scenario('C4 — effacer en deux clics, export Excel, lien de l’e-mail d’alerte');
  const p = await freshPage(browser, { page: 'admin', profile: ADMIN_USER, width: 1100, responses: adminResponses(), search: '?tab=candidatures' });
  await p.waitForSelector('[data-testid="cand-card"]', { timeout: 8000 });
  ok('« ?tab=candidatures » (lien de l’e-mail) ouvre directement l’onglet', await p.isVisible('[data-testid="cand-list"]'));

  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click('[data-testid="cand-export"]')]);
  ok('fichier .xlsx daté', /^candidatures-\d{4}-\d{2}-\d{2}\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const file = await dl.path();
  const zip = unzipSync(new Uint8Array(fs.readFileSync(file)));
  const xml = Object.entries(zip)
    .filter(([n]) => /xl\/(worksheets\/sheet\d+|sharedStrings)\.xml$/.test(n))
    .map(([, v]) => strFromU8(v))
    .join('\n');
  ok('un vrai classeur Excel (feuille + en-tête)', !!zip['xl/workbook.xml'] && xml.includes('Reçue le') && xml.includes('Poste visé'));
  ok('toutes les candidatures, en clair', xml.includes('DÉMO') && xml.includes('EXEMPLE') && xml.includes('ESSAI') && xml.includes('Technicien(ne) de laboratoire'));
  ok('le téléphone garde son 0 (texte, pas nombre)', xml.includes('06 12 34 56 78') && xml.includes('0700000002'));
  ok('jamais le contenu d’un CV', !xml.includes('JVBER'));

  await p.click('[data-id="appCCCCCCCCCCCCCCCC3"] [data-testid="cand-toggle"]');
  await p.click('[data-id="appCCCCCCCCCCCCCCCC3"] [data-testid="cand-delete"]');
  ok('1er clic : une confirmation, rien d’effacé', !!(await p.$('[data-testid="cand-delete-confirm"]')) && (await calls(p, 'adminDeleteApplication')).length === 0);
  await p.click('[data-testid="cand-delete-yes"]');
  await p.waitForTimeout(300);
  const del = await calls(p, 'adminDeleteApplication');
  ok('2e clic : UN appel {id}', del.length === 1 && del[0].id === 'appCCCCCCCCCCCCCCCC3');
  ok('la fiche disparaît, le message le dit',
    !(await p.$('[data-id="appCCCCCCCCCCCCCCCC3"]')) && ((await p.textContent('[data-testid="cand-notice"]')) || '').includes('Karim ESSAI'));
  assertClean(p, await visibleText(p, '#app'));
  await p.close();
}

async function c5Rh(browser) {
  scenario('C5 — rôle « RH » : uniquement l’onglet Candidatures ; l’équipe l’attribue');
  const RH = { uid: 'uid-rh-banc', fullName: 'RH Banc', phone: '0600000012', email: 'rh.banc@example.test', role: 'rh' };
  let p = await freshPage(browser, { page: 'admin', profile: RH, width: 1100, responses: adminResponses() });
  await p.waitForSelector('[data-testid="cand-card"]', { timeout: 8000 });
  const tabs = await p.$$eval('[role="tablist"] button, nav button', (els) => els.map((e) => e.textContent.trim()).filter(Boolean));
  const text = await visibleText(p, '#app');
  ok('titre « Espace recrutement », onglet Candidatures ouvert d’office', text.includes('Espace recrutement') && (await p.isVisible('[data-testid="cand-list"]')));
  ok('aucun autre onglet (Patients, Demandes, Médecins, Équipe…)', !/Patients|Demandes|Médecins|Relances|Vue patient|Équipe|Tableau de bord/.test(tabs.join(' ')), tabs.join(' | '));
  const other = ['adminListAccessRequests', 'adminListDormant', 'adminListRelativeRequests', 'adminListPractitionerRequests', 'adminDashboardStats', 'adminListStaff'];
  const made = [];
  for (const n of other) if ((await calls(p, n)).length) made.push(n);
  ok('aucun appel aux données patients / équipe', made.length === 0, made.join(', '));
  ok('pas de liens « Parcours (test) »', !text.includes('Parcours patient unifié'));
  assertClean(p, text);
  await p.close();

  p = await freshPage(browser, {
    page: 'admin', profile: ADMIN_USER, width: 1100,
    responses: adminResponses({
      adminListStaff: { members: [{ uid: 'u1', email: 'rh.banc@example.test', fullName: 'RH Banc', role: 'rh' }], callerLevel: 2 },
      adminSetRh: { success: true },
    }),
  });
  await p.waitForTimeout(600);
  await p.getByRole('button', { name: /Équipe/ }).first().click();
  await p.waitForSelector('[data-testid="team-add-rh"]', { timeout: 5000 });
  ok('le membre RH apparaît avec le badge « RH »', (await visibleText(p, '#app')).includes('RH Banc'));
  await p.fill('[data-testid="team-add-rh"] input', 'nouvelle.rh@example.test');
  await p.click('[data-testid="team-add-rh"] button[type="submit"]');
  await p.waitForTimeout(400);
  const set = await calls(p, 'adminSetRh');
  ok('« Ajouter un compte RH » : adminSetRh {email, grant: true}', set.length === 1 && set[0].email === 'nouvelle.rh@example.test' && set[0].grant === true, JSON.stringify(set));
  await p.close();
}

async function main() {
  console.log('\n══ Banc « Emploi & Stage » — la page publique et l’onglet admin ══');
  await build();
  const browser = await chromium.launch({ headless: !HEADED });
  try {
    await f1Empty(browser);
    await f2Conditional(browser);
    await f3Complete(browser);
    await f4Files(browser);
    await f5Refusals(browser);
    await f6Prefill(browser);
    await f7Arabic(browser);
    await c1Staff(browser);
    await c2List(browser);
    await c3Card(browser);
    await c4DeleteExport(browser);
    await c5Rh(browser);
  } finally {
    await browser.close();
  }
  finish();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
