/**
 * Apercu hors-ligne du tableau de bord /admin, a plusieurs largeurs.
 *
 *   node scripts/preview-admin-dashboard.js
 *
 * ── Pourquoi ce banc existe ───────────────────────────────────────────────
 * /admin est derriere une authentification ET un role (≥ admin pour cet
 * onglet). Aucun navigateur pilote ne peut donc l'ouvrir sans compte, et la
 * seule chose qui compte ici — la MISE EN PAGE — est precisement ce qu'un
 * `tsc --noEmit` ou un lint ne voient pas.
 *
 * `AdminDashboard` est purement presentationnel : des props entrent, du JSX
 * sort. On peut donc le rendre hors de l'application. Le banc empaquette le
 * VRAI composant avec esbuild, remplace seulement `react-i18next` (t() rend
 * la valeur par defaut, interpolee), compile la VRAIE feuille de style du
 * projet, et photographie a quatre largeurs.
 *
 * Ce n'est pas un test : rien n'est asserte, il n'echoue pas. C'est un
 * apercu a regarder, plus deux mesures imprimees qui, elles, se verifient :
 *   - le debordement horizontal, qui doit rester a 0 sur mobile ;
 *   - le nombre de colonnes de la premiere grille de graphiques, qui doit
 *     valoir 2 a partir de 1280 px et 1 en dessous.
 *
 * ── Limite a connaitre ────────────────────────────────────────────────────
 * Les donnees sont un jeu d'essai ecrit a la main (JEU ci-dessous). Si
 * l'interface `DashboardStats` gagne un champ, le banc ne le saura pas et
 * affichera « undefined » a l'endroit concerne — ce n'est pas un bug de la
 * page, c'est le jeu d'essai a completer.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const { chromium } = require('playwright');

const RACINE = path.resolve(__dirname, '..');
const SORTIE = path.join(os.tmpdir(), 'laboelallali-apercu-admin');

// Largeurs regardees. 1536 = point de rupture 2xl, 1280 = xl (celui qui
// ouvre les grilles a deux colonnes), 820 = tablette, 390 = telephone.
const LARGEURS = [
  ['bureau', 1536],
  ['portable', 1280],
  ['tablette', 820],
  ['mobile', 390],
];

const nom = (i) => ['Fatima Khorri', 'Ahmed Bensaid', 'Rachid Abzaou', 'Nadia Elmir', 'Youssef Talbi',
  'Samira Oubella', 'Hicham Naji', 'Loubna Fadili', 'Omar Sebti', 'Karima Ziani'][i % 10];
const compte = (i, jours) => ({
  uid: 'u' + i, fullName: nom(i), email: 'patient' + i + '@exemple.ma',
  createdAt: new Date(Date.now() - (i + 3) * 86400000).toISOString(),
  hasAccess: i % 3 !== 0,
  lastResultsAt: jours === null ? null : Date.now() - jours * 86400000,
});

const JEU = {
  totals: {
    accounts: 60, withAccess: 51, withoutAccess: 9, pendingRequests: 2,
    byType: { patient: 47, medecin: 3, correspondant: 1 },
  },
  teamAccounts: 4,
  includeTeam: false,
  usage: { active: 22, dormant: 29, rate: 43, windowDays: 30 },
  growth: {
    months: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((key, i) => ({
      key, created: [4, 6, 9, 7, 12, 17, 22][i], cumulative: [4, 10, 19, 26, 38, 55, 60][i],
    })),
  },
  monthDelta: { current: 22, previous: 17, pct: 29 },
  funnel: { created: 60, activated: 51, consulted: 22 },
  freshness: { d7: 9, d30: 13, d90: 11, older: 7, never: 11 },
  ages: [
    { key: '18-30', total: 12, active: 9, rate: 75 },
    { key: '31-45', total: 18, active: 11, rate: 61 },
    { key: '46-60', total: 14, active: 6, rate: 43 },
    { key: '61-75', total: 9, active: 3, rate: 33 },
    { key: '76+', total: 6, active: 1, rate: 17 },
  ],
  frequency: { once: 14, f2_5: 6, f6_15: 2, f16: 0 },
  firstView: { avgDays: 3.4, overWeekPct: 21, sample: 22 },
  relance: { relanced: 18, returned: 7, rate: 39, windowDays: 30 },
  activation: {
    avgDays: 1.6, sample: 34,
    weeks: ['S34', 'S35', 'S36', 'S37', 'S38'].map((label, i) => ({ label, avgDays: [2.4, 1.9, 1.2, 2.1, 1.1][i], n: 7 })),
  },
  requests: { fulfilled: 34, rejected: 3, pending: 2, oldestPendingDays: 2, oldestPendingName: 'Rachid Abzaou' },
  team: [
    { uid: 't1', name: 'Salma (accueil)', count: 14 },
    { uid: 't2', name: 'Imane (stagiaire)', count: 9 },
    { uid: 't3', name: 'Dr A. El Allali', count: 3 },
  ],
  weekly: ['S33', 'S34', 'S35', 'S36', 'S37', 'S38'].map((label, i) => ({ label, consultations: [12, 19, 24, 17, 31, 27][i] })),
  shares: { month: 11, signups: 22 },
  latestCreated: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => compte(i, null)),
  latestActive: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => compte(i, i + 1)),
  truncated: false,
};

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });

  // 1. faux react-i18next — t() rend la valeur par defaut, interpolee.
  const stub = path.join(SORTIE, 'i18n-stub.js');
  fs.writeFileSync(stub, `
exports.useTranslation = () => ({
  t: (cle, def) => {
    if (typeof def === 'string') return def;
    if (def && typeof def === 'object') {
      let s = def.defaultValue || cle;
      for (const k of Object.keys(def)) s = s.split('{{' + k + '}}').join(String(def[k]));
      return s;
    }
    return cle;
  },
});
`);

  // 2. rendu du vrai composant en HTML statique.
  const entree = path.join(SORTIE, 'entree.jsx');
  fs.writeFileSync(entree, `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminDashboard from '${RACINE.replace(/\\/g, '/')}/src/components/features/admin/AdminDashboard.tsx';
globalThis.__HTML__ = renderToStaticMarkup(React.createElement(AdminDashboard, {
  dash: ${JSON.stringify(JEU)},
  isArabic: false,
  usageSince: '2026-07-20',
  includeTeam: false,
  onToggleTeam: () => {},
  openSec: { active: true, created: true },
  onToggleSec: () => {},
  fmtDate: (s) => (s ? new Date(s).toLocaleDateString('fr-FR') : '—'),
  fmtWhen: (ms) => (ms ? new Date(ms).toLocaleDateString('fr-FR') : '—'),
}));
`);
  const bundle = path.join(SORTIE, 'bundle.js');
  await esbuild.build({
    entryPoints: [entree], bundle: true, outfile: bundle,
    platform: 'node', format: 'cjs', jsx: 'automatic',
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    alias: { 'react-i18next': stub },
    // Le point d'entree est genere dans le dossier temporaire du systeme,
    // hors du projet : esbuild y chercherait `react` a cote du fichier et ne
    // le trouverait pas. `nodePaths` lui donne le node_modules du projet.
    // (`absWorkingDir` ne joue que sur les chemins relatifs, pas sur la
    // resolution des paquets.)
    nodePaths: [path.join(RACINE, 'node_modules')],
    absWorkingDir: RACINE, logLevel: 'warning',
  });
  require(bundle);
  const corps = globalThis.__HTML__;

  // 3. la vraie feuille de style, pour que couleurs et points de rupture
  //    soient ceux de la page et non une approximation.
  const src = fs.readFileSync(path.join(RACINE, 'src/styles/index.css'), 'utf8');
  const css = (await postcss([tailwind()]).process(src, { from: path.join(RACINE, 'src/styles/index.css') })).css;

  // 4. le cadre de la page, reproduit a l'identique (conteneur + marges).
  const document_ = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
<body><div class="min-h-[80vh] py-12 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
  <div class="max-w-[1536px] mx-auto">
    <div class="mb-4">
      <h1 class="text-2xl font-bold text-[var(--color-bordeaux-primary)]">Espace administrateur</h1>
      <p class="text-[var(--text-secondary)] mt-1">Associer un identifiant de résultats à un compte patient.</p>
    </div>
    <div class="border-b border-[var(--border-default)] py-3 text-sm text-[var(--text-secondary)]">
      Tableau de bord · Patients · Demandes (2) · Relances (29) · Tester · Équipe
    </div>
    <div class="space-y-8 pt-8">${corps}</div>
  </div></div></body></html>`;

  const navigateur = await chromium.launch();
  console.log('largeur   hauteur   debordement   1re grille de graphiques');
  console.log('-'.repeat(64));
  for (const [etiquette, largeur] of LARGEURS) {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: 1000 } });
    await page.setContent(document_, { waitUntil: 'load' });
    const m = await page.evaluate(() => {
      const grille = [...document.querySelectorAll('div.grid')].find((e) => e.className.includes('xl:grid-cols-2'));
      const colonnes = grille
        ? new Set([...grille.children].map((c) => Math.round(c.getBoundingClientRect().left))).size
        : 0;
      return {
        hauteur: document.body.scrollHeight,
        deborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        colonnes,
      };
    });
    const fichier = path.join(SORTIE, `admin-${etiquette}-${largeur}.png`);
    await page.screenshot({ path: fichier, fullPage: true });
    await page.close();
    console.log(
      String(largeur).padStart(5) + ' px' +
      String(m.hauteur).padStart(9) + ' px' +
      String(m.deborde).padStart(12) + ' px' +
      ('   ' + m.colonnes + ' colonne' + (m.colonnes > 1 ? 's' : '')).padStart(16) +
      (m.deborde > 0 ? '   ⚠ DEBORDE' : '')
    );
  }
  await navigateur.close();
  console.log('\nImages : ' + SORTIE);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
