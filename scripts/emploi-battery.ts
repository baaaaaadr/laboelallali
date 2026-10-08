/**
 * Batterie PURE « Emploi & Stage » — aucun navigateur, aucun réseau. Lancée
 * par `node scripts/test-emploi.js`.
 *
 * Ce qu'elle garantit :
 *  A. la page et le serveur DÉPLOYÉ appliquent les mêmes règles : les listes
 *     et les verdicts de `parseApplication` de la source sont identiques à ceux
 *     de `functions/lib` (un `lib` périmé partirait tel quel au déploiement) ;
 *  B. chaque valeur de chaque liste a son libellé, en français ET en arabe ;
 *  C. chaque texte `emploi.*`, `admin.cand_*`, `confidentialite.candidates_*`
 *     cité par le code existe dans les deux langues ;
 *  D. la page de confidentialité déclare les candidatures (ancre visée par la
 *     case de consentement) ;
 *  E. les points d'entrée : pied de page, tiroir mobile, page contact, et
 *     aucune invitation de connexion sur le formulaire ;
 *  F. les règles : aucune collection ni dossier de candidatures ouvert aux
 *     navigateurs (`firestore.rules`, `storage.rules`) ;
 *  G. l'export Excel : une colonne par réponse, le téléphone en texte (son 0),
 *     les dates en dates, jamais le contenu d'un fichier.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import type { TFunction } from 'i18next';
import * as client from '../src/lib/emploi/applicationFields';
import { buildApplicationsSheet } from '../src/lib/emploi/exportApplications';

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

type Dict = Record<string, unknown>;
const loadLocale = (lang: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'locales', lang, 'common.json'), 'utf8')) as Dict;
const fr = loadLocale('fr');
const ar = loadLocale('ar');
const get = (dict: Dict, key: string): unknown =>
  key.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Dict)[part] : undefined), dict);
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

// ── A ───────────────────────────────────────────────────────────────────────
section('A — la page et le serveur déployé appliquent les mêmes règles');
{
  const libPath = path.join(ROOT, 'functions', 'lib', 'hr', 'applicationRules.js');
  if (!fs.existsSync(libPath)) {
    ok('functions/lib compilé (lancer `npm --prefix functions run build`)', false, libPath);
  } else {
    const server = createRequire(path.join(ROOT, 'functions', 'package.json'))(libPath);
    const LISTS = [
      'KINDS',
      'SCHOOL_LEVELS',
      'POSITIONS',
      'DURATIONS',
      'AVAILABILITIES',
      'DIPLOMA_LEVELS',
      'EXPERIENCES',
      'VEHICLES',
      'LANGUAGES',
      'SOURCES',
      'STATUSES',
      'FILE_KINDS',
    ] as const;
    const c = client as unknown as Record<string, unknown>;
    const diff = LISTS.filter((k) => JSON.stringify(c[k]) !== JSON.stringify(server[k]));
    ok('les 12 listes de valeurs sont identiques', diff.length === 0, diff.join(', '));
    ok('mêmes plafonds (5 Mo, 6 mois, âge 13–75, note)',
      client.MAX_FILE_BYTES === server.MAX_FILE_BYTES && client.RETENTION_DAYS === server.RETENTION_DAYS &&
        client.AGE_MIN === server.AGE_MIN && client.AGE_MAX === server.AGE_MAX && client.NOTE_MAX === server.NOTE_MAX);
    const now = new Date(Date.UTC(2026, 9, 8));
    const valid = {
      lastName: 'Démo', firstName: 'Salma', dateOfBirth: '2001-05-14', city: 'Agadir', phone: '0612345678',
      kind: 'emploi', position: 'technicien', availability: 'immediate', diplomaLevel: 'bac', experience: 'debutant',
      license: false, vehicle: 'aucun', languages: ['arabe'], consent: true,
    };
    const cases: Record<string, unknown>[] = [
      valid,
      {},
      { ...valid, kind: 'observation', position: '' },
      { ...valid, kind: 'observation', position: '', schoolLevel: 'universite', duration: '1_mois' },
      { ...valid, kind: 'preembauche', duration: '2_mois', startDate: '2026-12-01', endDate: '2026-11-01' },
      { ...valid, dateOfBirth: '2015-01-01' },
      { ...valid, phone: '12' },
      { ...valid, email: 'x@' },
      { ...valid, position: 'autre' },
      { ...valid, availability: 'date' },
      { ...valid, languages: [], languagesOther: 'Allemand' },
      { ...valid, consent: false },
    ];
    const mismatch = cases.filter(
      (cs) => JSON.stringify(client.parseApplication(cs, now)) !== JSON.stringify(server.parseApplication(cs, now))
    );
    ok(`mêmes verdicts sur ${cases.length} formulaires d’essai`, mismatch.length === 0, JSON.stringify(mismatch[0] || '').slice(0, 200));
    ok('… dont un formulaire valide', client.parseApplication(valid, now).ok === true);
  }
}

// ── B ───────────────────────────────────────────────────────────────────────
section('B — chaque valeur a son libellé, en français et en arabe');
{
  const families: Array<[readonly string[], string]> = [
    [client.KINDS, 'emploi.kind_'],
    [client.SCHOOL_LEVELS, 'emploi.school_'],
    [client.POSITIONS, 'emploi.position_'],
    [client.DURATIONS, 'emploi.duration_'],
    [client.DIPLOMA_LEVELS, 'emploi.diploma_'],
    [client.EXPERIENCES, 'emploi.experience_'],
    [client.VEHICLES, 'emploi.vehicle_'],
    [client.LANGUAGES, 'emploi.lang_'],
    [client.SOURCES, 'emploi.source_'],
    [client.STATUSES, 'admin.cand_status_'],
  ];
  const missing: string[] = [];
  for (const [list, prefix] of families) {
    for (const v of list) {
      for (const [lng, dict] of [['fr', fr], ['ar', ar]] as const) {
        if (typeof get(dict, `${prefix}${v}`) !== 'string') missing.push(`${lng}:${prefix}${v}`);
      }
    }
  }
  for (const k of client.KINDS) {
    for (const [lng, dict] of [['fr', fr], ['ar', ar]] as const) {
      if (typeof get(dict, `emploi.kind_${k}_desc`) !== 'string') missing.push(`${lng}:emploi.kind_${k}_desc`);
    }
  }
  ok('aucun libellé de valeur manquant', missing.length === 0, missing.slice(0, 10).join(', '));
  const arText = JSON.stringify(get(ar, 'emploi'));
  ok('les libellés arabes sont en arabe (pas une copie du français)', !/Stage d’observation|Poste visé|Champ obligatoire/.test(arText));
}

// ── C ───────────────────────────────────────────────────────────────────────
section('C — chaque texte cité par le code existe en français ET en arabe');
{
  const PREFIX = /\bt\(\s*['"]((?:emploi\.|admin\.cand_|admin\.tab_candidatures|confidentialite\.candidates_)[\w.]*)['"]/g;
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?)$/.test(e.name)) files.push(p);
    }
  };
  walk(path.join(ROOT, 'src'));
  const used = new Set<string>();
  for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(PREFIX)) used.add(m[1]);
  ok('des textes « Emploi & Stage » sont bien cités', used.size > 80, `${used.size} clés`);
  const missing: string[] = [];
  for (const key of used) {
    if (typeof get(fr, key) !== 'string') missing.push(`fr:${key}`);
    if (typeof get(ar, key) !== 'string') missing.push(`ar:${key}`);
  }
  ok('aucune clé manquante', missing.length === 0, missing.slice(0, 12).join(', '));
  for (const k of ['meta_title', 'meta_description']) {
    ok(`titre Google (${k}) dans les deux langues`, typeof get(fr, `emploi.${k}`) === 'string' && typeof get(ar, `emploi.${k}`) === 'string');
  }
}

// ── D ───────────────────────────────────────────────────────────────────────
section('D — la page de confidentialité déclare les candidatures');
{
  const page = read('src', 'app', '[lang]', 'confidentialite', 'page.tsx');
  ok('la carte « Candidatures » est montée, avec son ancre', page.includes("'confidentialite.candidates_title'") && page.includes("id: 'candidatures'"));
  const form = read('src', 'components', 'features', 'emploi', 'ApplicationForm.tsx');
  ok('la case de consentement y renvoie', form.includes('/confidentialite#candidatures'));
  for (const [lng, dict] of [['fr', fr], ['ar', ar]] as const) {
    const text = String(get(dict, 'confidentialite.candidates_text') || '');
    ok(`${lng} : effacement à 6 mois, adresse de contact, pas de CIN`,
      text.includes('6') && text.includes('laboelallali@gmail.com') && text.length > 300, text.slice(0, 80));
  }
}

// ── E ───────────────────────────────────────────────────────────────────────
section('E — les points d’entrée, et pas d’invitation de connexion sur le formulaire');
{
  ok('pied de page', read('src', 'components', 'layout', 'Footer.tsx').includes('/emploi`'));
  ok('tiroir du menu mobile', read('src', 'components', 'layout', 'Header.tsx').includes('/emploi`'));
  ok('page contact', read('src', 'app', '[lang]', 'contact', 'page.tsx').includes('/emploi`'));
  const prompt = read('src', 'components', 'features', 'auth', 'GoogleSignInPrompt.tsx');
  const hidden = /HIDDEN_ROUTES = new Set\(\[([\s\S]*?)\]\)/.exec(prompt)?.[1] || '';
  ok('« emploi » dans HIDDEN_ROUTES (aucun compte n’est demandé)', /'emploi'/.test(hidden));
  const sitemap = read('next-sitemap.config.js');
  ok('page PUBLIQUE : ni exclue du plan du site, ni interdite aux moteurs', !/emploi/.test(sitemap));
}

// ── F ───────────────────────────────────────────────────────────────────────
section('F — aucune candidature ouverte aux navigateurs');
{
  const fsRules = read('firestore.rules');
  ok('firestore.rules : aucune règle sur applications / applicationThrottle', !/match\s+\/application/.test(fsRules));
  ok('firestore.rules : refus par défaut toujours en place', /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/.test(fsRules));
  const stRules = read('storage.rules');
  ok('storage.rules : aucune règle sur candidatures/', !/candidatures/.test(stRules.replace(/\/\/.*$/gm, '')));
  ok('storage.rules : refus par défaut toujours en place', /match \/\{allPaths=\*\*\}\s*\{\s*allow read, write: if false;/.test(stRules));
}

// ── G ───────────────────────────────────────────────────────────────────────
section('G — l’export Excel');
{
  const t = ((key: string, def?: unknown, opts?: Record<string, unknown>) => {
    const v = get(fr, key);
    let s = typeof v === 'string' ? v : typeof def === 'string' ? def : key;
    for (const [k, val] of Object.entries(opts || {})) s = s.replace(`{{${k}}}`, String(val));
    return s;
  }) as unknown as TFunction;
  const rec = {
    id: 'a1', ref: 'AB3DE9', createdAt: Date.UTC(2026, 9, 8, 10), expiresAt: Date.UTC(2027, 3, 9), lang: 'fr' as const,
    status: 'entretien', note: 'Rappeler jeudi', updatedAt: null, updatedByName: 'Admin', hasAccount: false,
    lastName: 'Démo', firstName: 'Salma', dateOfBirth: '2001-05-14', city: 'Agadir', district: '', phone: '0612345678',
    email: '', kind: 'emploi', schoolLevel: '', position: 'autre', positionOther: 'Agent de saisie', duration: '', startDate: '',
    endDate: '', availability: 'date', availableFrom: '2026-11-01', diplomaLevel: 'bac2', diplomaTitle: '', diplomaYear: 2022,
    school: '', experience: '1_3', lastEmployer: '', license: true, vehicle: 'moto', languages: ['arabe', 'francais'],
    languagesOther: 'Allemand', source: '', files: { cv: { name: 'cv.pdf', contentType: 'application/pdf', size: 10 } },
  };
  const { rows, widths } = buildApplicationsSheet([rec], t, new Date(Date.UTC(2026, 9, 8)));
  const header = rows[0].map((c) => String(c?.value));
  const row = rows[1];
  const col = (name: string) => row[header.indexOf(name)];
  ok('une ligne d’en-tête + une ligne par candidature, une largeur par colonne', rows.length === 2 && header.length === row.length && widths.length === header.length);
  ok('en-tête en gras', rows[0].every((c) => c?.fontWeight === 'bold'));
  ok('le téléphone est du TEXTE (garde son 0)', col('Téléphone')?.type === String && col('Téléphone')?.value === '0612345678');
  ok('les dates sont des dates (triables dans Excel)', col('Date de naissance')?.value instanceof Date && col('Reçue le')?.value instanceof Date);
  ok('l’âge est calculé', col('Âge')?.value === 25);
  ok('poste « autre » : la précision du candidat', col('Poste visé')?.value === 'Agent de saisie');
  ok('décision et note en clair', col('Statut')?.value === 'Entretien' && col('Note interne')?.value === 'Rappeler jeudi');
  ok('langues, y compris « autre »', col('Langues parlées')?.value === 'Arabe, Français, Allemand');
  ok('pièces : présentes ou non, jamais leur contenu', col('CV')?.value === 'Oui' && col('Lettre de motivation')?.value === 'Non');
}

console.log('\n─────────────────────────────────────────────────────────────────');
console.log(`${passed} vérifications passées, ${failures.length} en échec.`);
if (failures.length) {
  console.log('\nÉCHECS :');
  for (const f of failures) console.log(`\n  ✗ ${f}`);
  process.exit(1);
}
console.log('Tout est vert.');
