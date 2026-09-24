/**
 * Batterie PURE de l'espace médecin (« Mes patients ») — aucun navigateur,
 * aucun réseau. Lancée par `node scripts/test-practitioner.js`.
 *
 * Ce qu'elle garantit :
 *  A. le regroupement des bilans par patient (accents, casse, homonymes,
 *     bilans sans nom jamais fusionnés, ordre) ;
 *  B. la recherche (ordre des mots, accents, numéro de dossier) ;
 *  C. l'affichage des noms, et l'avis « 50 bilans » ;
 *  D. le jumeau client de l'identité praticien : jamais une identité patient ;
 *  E. la parité de la clé de regroupement avec le serveur (le « Vérifier » de
 *     l'admin compte les patients avec la même règle) ;
 *  F. `firestore.rules` : « practitioner » et « practitionerEngagement » dans
 *     les DEUX listes verrouillées ;
 *  G. chaque texte de l'espace médecin existe en français ET en arabe — la
 *     doublure de traduction du banc navigateur retombe sur le texte français,
 *     elle ne peut donc pas voir une clé arabe manquante ;
 *  H. la page de confidentialité déclare l'accès des médecins (fr et ar) ;
 *  I. le lien d'invitation des médecins (reconnu au retour de connexion,
 *     numéros au format WhatsApp) ;
 *  J. l'engagement de confidentialité : le jumeau client (`hasEngagement`) et
 *     la MÊME version des deux côtés.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import type { CyberlabResult } from '../src/types/cyberlab';
import {
  displayName,
  groupByPatient,
  isCapped,
  LIST_CAP,
  matchesQuery,
  normalizeName,
  patientKey,
} from '../src/lib/practitioner/patients';
import {
  hasPatientIdentity,
  normalizePractitionerId,
  primaryIdentity,
  readPractitioner,
  resolveIdentities,
} from '../src/lib/results/identities';
import { doctorSpacePath, isDoctorSpacePath, waDigits, whatsappInviteLink } from '../src/lib/practitioner/invitation';
import { hasEngagement, PRACTITIONER_ENGAGEMENT_VERSION } from '../src/lib/practitioner/engagement';

const ROOT = path.resolve(__dirname, '..', '..', '..');

let passed = 0;
const failures: string[] = [];
let ctx = '';
function section(name: string) {
  ctx = name;
  console.log(`\n  ${name}`);
}
function ok(label: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`    · ${label}`);
  } else {
    failures.push(`${ctx}\n      → ${label}${detail ? `\n        ${detail}` : ''}`);
    console.log(`    ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Un bilan fictif. */
function d(id: string, nom: string, prenom: string, date: string, analyses = 'C GLY'): CyberlabResult {
  return {
    dossier_id: id,
    patient_nom: nom,
    patient_prenom: prenom,
    date_dossier: date,
    etat: 'Final',
    analyses_summary: analyses,
    pdf_base64: '',
  };
}

// ── A. Regroupement ─────────────────────────────────────────────────────────
section('A — regroupement des bilans par patient');
{
  const list = [
    d('D1', 'FICTIF', 'Hanaé', '2026-07-05T08:00:00Z'),
    d('D2', 'fictif', 'HANAE', '2026-02-01T08:00:00Z'),
    d('D3', 'DÉMO', 'Amina', '2026-09-10T08:00:00Z'),
    d('D4', 'DÉMO', 'Karim', '2026-01-01T08:00:00Z'),
    d('D5', '', '', '2026-08-01T08:00:00Z'),
    d('D6', '', '', '2026-08-02T08:00:00Z'),
    d('D7', 'EL  ALLALI', 'Hassan', '2025-05-05T08:00:00Z'),
    d('D8', 'El-Allali', 'hassan', '2025-06-06T08:00:00Z'),
  ];
  const groups = groupByPatient(list);
  const byName = (nom: string, prenom: string) =>
    groups.find((g) => normalizeName(g.nom) === normalizeName(nom) && normalizeName(g.prenom) === normalizeName(prenom));

  const hanae = byName('FICTIF', 'Hanaé');
  ok('accents et casse ignorés : « FICTIF Hanaé » = « fictif HANAE »', !!hanae && hanae.dossiers.length === 2);
  ok('ses bilans du plus récent au plus ancien', !!hanae && hanae.dossiers[0].dossier_id === 'D1');
  ok('son bilan le plus récent est bien retenu', !!hanae && hanae.newestDossierId === 'D1');
  ok('prénoms différents → patients différents (Amina ≠ Karim)', !!byName('DÉMO', 'Amina') && !!byName('DÉMO', 'Karim'));
  ok('espaces multiples et tiret ignorés (« EL  ALLALI » = « El-Allali »)', byName('EL ALLALI', 'Hassan')?.dossiers.length === 2);
  const nameless = groups.filter((g) => g.nameless);
  ok('bilans SANS nom : jamais fusionnés entre eux (2 bilans → 2 lignes)', nameless.length === 2);
  ok('patients triés par bilan le plus récent (DÉMO Amina, 10/09, en tête)', groups[0].key === patientKey(list[2]));
  ok('nombre total de patients', groups.length === 6, `${groups.length}`);
  ok('aucun bilan perdu ni dupliqué', groups.reduce((s, g) => s + g.dossiers.length, 0) === list.length);

  const tie = groupByPatient([d('X1', 'ZED', 'Anna', '2026-01-01T00:00:00Z'), d('X2', 'ABEL', 'Anna', '2026-01-01T00:00:00Z')]);
  ok('à date égale, ordre alphabétique (stable entre deux actualisations)', tie[0].nom === 'ABEL');
  ok('liste vide → aucun patient', groupByPatient([]).length === 0);
}

// ── B. Recherche ────────────────────────────────────────────────────────────
section('B — recherche');
{
  const [g] = groupByPatient([d('100926901', 'EL ALLALI', 'Hassan', '2026-09-10T08:00:00Z')]);
  const [h] = groupByPatient([d('050726905', 'FICTIF', 'Hanaé', '2026-07-05T08:00:00Z')]);
  ok('un mot du nom', matchesQuery(g, 'allali'));
  ok('ordre des mots indifférent (« hassan el allali »)', matchesQuery(g, 'hassan el allali'));
  ok('majuscules indifférentes', matchesQuery(g, 'HASSAN'));
  ok('accents indifférents (« hanae » trouve « Hanaé »)', matchesQuery(h, 'hanae'));
  ok('accent tapé par le médecin (« Hanaé ») aussi', matchesQuery(h, 'Hanaé'));
  ok('un mot absent exclut le patient (« allali hanae »)', !matchesQuery(g, 'allali hanae'));
  ok('début de numéro de dossier', matchesQuery(g, '1009'));
  ok('milieu de numéro de dossier : non (évite les faux positifs)', !matchesQuery(g, '926901'));
  ok('recherche vide → tout le monde', matchesQuery(g, '   '));
}

// ── C. Affichage ────────────────────────────────────────────────────────────
section('C — affichage des noms et plafond');
{
  ok('nom en capitales, prénom capitalisé', displayName({ nom: 'el allali', prenom: 'hassan' }) === 'EL ALLALI Hassan');
  ok('prénom composé', displayName({ nom: 'X', prenom: 'marie-claire' }) === 'X Marie-Claire');
  ok('prénom accentué conservé', displayName({ nom: 'FICTIF', prenom: 'hanaé' }) === 'FICTIF Hanaé');
  ok('nom seul', displayName({ nom: 'SEUL', prenom: '' }) === 'SEUL');
  const fifty = Array.from({ length: LIST_CAP }, (_, i) => d(`C${i}`, 'N', 'P', '2026-01-01T00:00:00Z'));
  ok(`${LIST_CAP} bilans → avis « seuls les plus récents »`, isCapped(fifty));
  ok(`${LIST_CAP - 1} bilans → pas d'avis`, !isCapped(fifty.slice(1)));
}

// ── D. Jumeau client de l'identité praticien ────────────────────────────────
section('D — identité praticien côté client : jamais une identité patient');
{
  const PRO = { requester_id: 'drdemo', type: 'medecin' as const, label: ' Dr Démo ' };
  const both = { requester_id: '7587', type: 'patient' as const, practitioner: PRO };
  ok('lecture : code canonique en majuscules', readPractitioner(both)?.requester_id === 'DRDEMO');
  ok('lecture : libellé nettoyé', readPractitioner(both)?.label === 'Dr Démo');
  ok('médecin-patient : identité principale = SON dossier', primaryIdentity(both, 'Moi')?.requester_id === '7587');
  ok('le code médecin n’entre JAMAIS dans les identités patient', resolveIdentities(both, 'Moi').every((i) => i.requester_id !== 'DRDEMO'));
  const proOnly = { practitioner: PRO };
  ok('médecin sans dossier : aucune identité patient', resolveIdentities(proOnly, 'Moi').length === 0);
  ok('…donc aucune identité principale (rien à précharger à la connexion)', primaryIdentity(proOnly, 'Moi') === null);
  ok('hasPatientIdentity : faux pour un médecin seul', !hasPatientIdentity(proOnly));
  ok('hasPatientIdentity : vrai pour un médecin-patient', hasPatientIdentity(both));
  const bad: [string, unknown][] = [
    ['type patient', { requester_id: 'X1', type: 'patient' }],
    ['code vide', { requester_id: '  ', type: 'medecin' }],
    ['tableau', [PRO]],
    ['chaîne', 'DRDEMO'],
  ];
  for (const [label, value] of bad) {
    ok(`${label} → aucun accès (même règle que le serveur)`, readPractitioner({ practitioner: value }) === null);
  }
  ok('normalisation identique au serveur (« mous tzou » → MOUSTZOU)', normalizePractitionerId(' mous tzou ') === 'MOUSTZOU');
}

// ── E. Parité avec le serveur ───────────────────────────────────────────────
section('E — même clé de regroupement que le serveur (compte des patients de l’admin)');
{
  let server: { patientKey: (nom: unknown, prenom: unknown, dossierId?: unknown) => string } | null = null;
  try {
    const req = createRequire(path.join(ROOT, 'functions', 'package.json'));
    server = req(path.join(ROOT, 'functions', 'lib', 'admin', 'adminPractitioner.js'));
  } catch {
    server = null;
  }
  if (!server) {
    ok('functions/lib compilé (lancer « npm --prefix functions run build »)', false);
  } else {
    const fixtures: [string, string][] = [
      ['FICTIF', 'Hanaé'],
      ['EL  ALLALI', 'Hassan'],
      ['El-Allali', 'hassan'],
      ["O'NEIL", 'Marie-Claire'],
      ['DÉMO', 'Ámina'],
    ];
    for (const [nom, prenom] of fixtures) {
      ok(`« ${nom} ${prenom} » → même clé`, server.patientKey(nom, prenom, 'x') === patientKey({ patient_nom: nom, patient_prenom: prenom, dossier_id: 'x' }));
    }
    // Un bilan SANS nom n'est jamais fusionné — une ligne chacun dans « Mes
    // patients », donc un patient chacun dans le compte « Vérifier » de l'admin.
    ok(
      'bilan sans nom → même clé (sur son n° de dossier)',
      server.patientKey('', ' ', '050726905') === patientKey({ patient_nom: '', patient_prenom: ' ', dossier_id: '050726905' })
    );
  }
}

// ── F. Règles Firestore ─────────────────────────────────────────────────────
section('F — firestore.rules : « practitioner » et son engagement verrouillés en création ET en mise à jour');
{
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  const block = rules.slice(rules.indexOf('match /users/{userId}'));
  const lists = [...block.matchAll(/hasAny\(\[([\s\S]*?)\]\)/g)].slice(0, 2).map((m) =>
    m[1]
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter(Boolean)
      .sort()
  );
  ok('deux listes trouvées dans le bloc users', lists.length === 2);
  ok('« practitioner » dans la liste de création', !!lists[0]?.includes('practitioner'));
  ok('« practitioner » dans la liste de mise à jour', !!lists[1]?.includes('practitioner'));
  // L'engagement est la preuve du laboratoire : un client ne doit ni en forger la
  // date, ni sauter le texte en l'écrivant lui-même.
  ok(
    '« practitionerEngagement » dans les deux listes',
    !!lists[0]?.includes('practitionerEngagement') && !!lists[1]?.includes('practitionerEngagement')
  );
  ok('les deux listes sont identiques', JSON.stringify(lists[0]) === JSON.stringify(lists[1]), JSON.stringify(lists));
}

// ── G. Traductions ──────────────────────────────────────────────────────────
section('G — chaque texte de l’espace médecin existe en français ET en arabe');
{
  type Dict = Record<string, unknown>;
  const load = (lang: string) =>
    JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'locales', lang, 'common.json'), 'utf8')) as Dict;
  const fr = load('fr');
  const ar = load('ar');
  const get = (dict: Dict, key: string): unknown =>
    key.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Dict)[part] : undefined), dict);

  // Toutes les clés que le CODE utilise, trouvées dans les sources.
  const PREFIX = /\bt\(\s*['"]((?:mes_patients\.|admin\.pract_|admin\.dash_pract_|admin\.dash_sec_doctors|admin\.doctors_|admin\.tab_doctors|admin\.invite_|confidentialite\.practitioner_|resultats\.practitioner_)[\w.]+)['"]\s*(,\s*\{[^}]*\bcount\b)?/g;
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?)$/.test(e.name)) files.push(p);
    }
  };
  walk(path.join(ROOT, 'src'));
  const used = new Map<string, boolean>(); // clé → utilisée avec un compte (pluriel)
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(PREFIX)) used.set(m[1], used.get(m[1]) || !!m[2]);
  }
  ok('des clés de l’espace médecin sont bien utilisées dans le code', used.size > 20, `${used.size} clés`);

  const AR_PLURALS = ['zero', 'one', 'two', 'few', 'many', 'other'];
  const missing: string[] = [];
  for (const [key, plural] of used) {
    if (plural) {
      if (typeof get(fr, `${key}_one`) !== 'string' || typeof get(fr, `${key}_other`) !== 'string') missing.push(`fr:${key}_one/_other`);
      for (const f of AR_PLURALS) if (typeof get(ar, `${key}_${f}`) !== 'string') missing.push(`ar:${key}_${f}`);
    } else {
      if (typeof get(fr, key) !== 'string') missing.push(`fr:${key}`);
      if (typeof get(ar, key) !== 'string') missing.push(`ar:${key}`);
    }
  }
  ok('aucune clé manquante (fr et ar, six formes plurielles en arabe)', missing.length === 0, missing.slice(0, 12).join(', '));
}

// ── H. La déclaration de confidentialité ────────────────────────────────────
// La page cite ses clés dans un tableau (`t(s.title)`), hors de portée du
// relevé de G : on vérifie donc la carte et ses deux textes directement.
section('H — la page de confidentialité déclare l’accès des médecins (fr et ar)');
{
  type Dict = Record<string, unknown>;
  const page = fs.readFileSync(path.join(ROOT, 'src', 'app', '[lang]', 'confidentialite', 'page.tsx'), 'utf8');
  ok(
    'la carte « Accès des médecins prescripteurs » est montée',
    page.includes("'confidentialite.practitioner_title'") && page.includes("'confidentialite.practitioner_text'")
  );
  for (const lang of ['fr', 'ar']) {
    const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'locales', lang, 'common.json'), 'utf8')) as Dict;
    const c = (all.confidentialite ?? {}) as Dict;
    ok(
      `${lang} : titre et texte présents`,
      typeof c.practitioner_title === 'string' && typeof c.practitioner_text === 'string' && c.practitioner_text.length > 200
    );
  }
}

// ── I. Le lien d'invitation des médecins ────────────────────────────────────
section('I — le lien d’invitation : reconnu au retour de connexion, prêt pour WhatsApp');
{
  ok('lien de l’espace médecin par langue', doctorSpacePath('fr') === '/fr/mes-patients' && doctorSpacePath('ar') === '/ar/mes-patients');
  ok('langue inconnue → français', doctorSpacePath('xx') === '/fr/mes-patients');
  ok('retour de connexion vers l’espace médecin : reconnu', isDoctorSpacePath('/fr/mes-patients') && isDoctorSpacePath('/ar/mes-patients?x=1'));
  // Ce test décide si la page de connexion inscrit ou non le compte dans la file
  // des demandes PATIENT : un faux positif priverait un patient de son accueil.
  ok('…mais pas /resultats, /profile, ni une page voisine au nom proche',
    !isDoctorSpacePath('/fr/resultats') && !isDoctorSpacePath('/fr/profile') && !isDoctorSpacePath('/fr/mes-patients-old') && !isDoctorSpacePath('/mes-patients'));
  ok('téléphone marocain « 06 12 34 56 78 » → 212612345678', waDigits('06 12 34 56 78') === '212612345678');
  ok('« +212 6… » et « 00212 6… » → 2126…', waDigits('+212 612-345-678') === '212612345678' && waDigits('00212612345678') === '212612345678');
  ok('sans numéro → vide (WhatsApp laisse choisir le contact)', waDigits('') === '' && whatsappInviteLink('', 'x').startsWith('https://wa.me/?text='));
  const link = whatsappInviteLink('0612345678', 'Ouvrez : https://www.laboelallali.com/fr/mes-patients');
  ok('message encodé, lien intact une fois décodé',
    link.startsWith('https://wa.me/212612345678?text=') &&
      decodeURIComponent(link.split('text=')[1]) === 'Ouvrez : https://www.laboelallali.com/fr/mes-patients');
}

// ── J. L'engagement de confidentialité ──────────────────────────────────────
section('J — l’engagement de confidentialité : jumeau client et même version que le serveur');
{
  const V = PRACTITIONER_ENGAGEMENT_VERSION;
  ok('engagement de la version actuelle → accepté', hasEngagement({ practitionerEngagement: { version: V } }));
  ok('…une version plus récente aussi', hasEngagement({ practitionerEngagement: { version: V + 1 } }));
  ok(
    'absent, ancienne version, version en texte, tableau → pas encore accepté',
    !hasEngagement({}) &&
      !hasEngagement(null) &&
      !hasEngagement({ practitionerEngagement: { version: V - 1 } }) &&
      !hasEngagement({ practitionerEngagement: { version: String(V) } }) &&
      !hasEngagement({ practitionerEngagement: [V] })
  );
  let server: { PRACTITIONER_ENGAGEMENT_VERSION: number; engagementOf: (d: unknown) => unknown } | null = null;
  try {
    const req = createRequire(path.join(ROOT, 'functions', 'package.json'));
    server = req(path.join(ROOT, 'functions', 'lib', 'admin', 'practitionerEngagement.js'));
  } catch {
    server = null;
  }
  if (!server) {
    ok('functions/lib compilé (lancer « npm --prefix functions run build »)', false);
  } else {
    // Un client en avance serait refusé par le serveur ; un client en retard
    // sauterait un nouveau texte. Les deux constantes changent ensemble.
    ok(`même version côté client et côté serveur (${V})`, server.PRACTITIONER_ENGAGEMENT_VERSION === V, `serveur : ${server.PRACTITIONER_ENGAGEMENT_VERSION}`);
    const cases = [{ version: V }, { version: V - 1 }, { version: String(V) }, undefined];
    ok(
      'même verdict des deux côtés sur quatre formes',
      cases.every((e) => (server!.engagementOf({ practitionerEngagement: e }) !== null) === hasEngagement({ practitionerEngagement: e }))
    );
  }
}

console.log('\n─────────────────────────────────────────────────────────────────');
console.log(`${passed} vérifications passées, ${failures.length} en échec.`);
if (failures.length) {
  console.log('\nÉCHECS :');
  for (const f of failures) console.log(`\n  ✗ ${f}`);
  process.exit(1);
}
console.log('Tout est vert.');
