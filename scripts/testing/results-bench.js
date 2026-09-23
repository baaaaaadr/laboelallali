/**
 * Mécanique commune des bancs navigateur « résultats » et « médecin »
 * (`scripts/test-results-ui.js`, `scripts/test-practitioner-ui.js`) :
 * compilation du point d'entrée avec ses doublures, page Playwright prête,
 * relevé des appels Firebase, petit cadre d'assertions.
 *
 * Voir `scripts/testing/README.md` § Banc « résultats » pour le pourquoi de
 * chaque doublure.
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'node_modules', '.cache', 'results-tests');
const BUNDLE = path.join(OUT_DIR, 'harness.js');
const SHOTS = path.join(OUT_DIR, 'captures');

/**
 * Compile `results-harness-entry.tsx`.
 * ⚠ L'API JavaScript d'esbuild (jamais le binaire `.cmd` : EINVAL sous Windows
 * depuis Node 20), et l'API ASYNCHRONE : `buildSync` refuse les greffons.
 */
async function build() {
  const T = (f) => path.join(ROOT, 'scripts', 'testing', f);
  const AUTH_STUB = T('stub-auth-store.tsx');
  fs.mkdirSync(SHOTS, { recursive: true });
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
        // (`./AuthContext`), qu'un alias ne sait pas intercepter.
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

/** Petit cadre d'assertions, partagé par un pilote. */
function createReporter() {
  let passed = 0;
  const failures = [];
  let ctx = '';
  return {
    scenario(name) {
      ctx = name;
      console.log(`\n  ${name}`);
    },
    ok(label, condition, detail = '') {
      if (condition) {
        passed++;
        console.log(`    · ${label}`);
        return true;
      }
      failures.push(`${ctx}\n      → ${label}${detail ? `\n        ${detail}` : ''}`);
      console.log(`    ✗ ${label}${detail ? ` — ${detail}` : ''}`);
      return false;
    },
    finish() {
      console.log('\n─────────────────────────────────────────────────────────────────');
      console.log(`${passed} vérifications passées, ${failures.length} en échec.`);
      console.log(`Captures : ${SHOTS}`);
      if (failures.length) {
        console.log('\nÉCHECS :');
        for (const f of failures) console.log(`\n  ✗ ${f}`);
        process.exit(1);
      }
      console.log('Tout est vert.');
    },
  };
}

const HTML = '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div></body></html>';

/**
 * Une page prête : banc chargé, langue, serveur simulé et compte posés, page
 * montée. Une VRAIE origine http (`labo.test`) : `localStorage` et l'historique
 * lèvent ou se comportent mal sur `about:blank`.
 */
async function freshPage(browser, { lang = 'fr', profile, server, page = 'resultats', width = 420 }) {
  const p = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // Les liens wa.me / tel: ne doivent jamais quitter le banc.
  await p.route('https://wa.me/**', (route) => route.abort());
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
    [lang, profile, server || { identities: {} }, page]
  );
  p.__errors = errors;
  return p;
}

/** Les appels à une fonction Firebase, dans l'ordre (arguments seulement). */
function calls(p, name = 'fetchResults') {
  return p.evaluate((n) => window.__calls.filter((c) => c.name === n).map((c) => c.args ?? null), name);
}

/** Le texte visible, sans les libellés réservés aux lecteurs d'écran. */
function visibleText(p, selector = 'body') {
  return p.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return '';
    const clone = root.cloneNode(true);
    clone.querySelectorAll('.sr-only,[aria-hidden="true"],style,script').forEach((n) => n.remove());
    return clone.innerText || clone.textContent || '';
  }, selector);
}

/**
 * Aucune erreur JavaScript. Un seul message écarté, artefact du BANC :
 * `TabsNavigation` utilise `<style jsx>` (styled-jsx), que Next compile et
 * qu'esbuild laisse tel quel — React signale un attribut `jsx` non booléen.
 */
function realErrors(p) {
  return p.__errors.filter(
    (e) => !/Download the React DevTools/.test(e) && !/non-boolean attribute[\s\S]*\bjsx\b/.test(e)
  );
}

/** Clés de traduction brutes (« mes_patients.title ») affichées à l'écran. */
function rawKeys(text) {
  return [
    ...new Set(
      (text.match(/\b[a-z_]+\.[a-z_]{3,}(?:\.[a-z_]+)?\b/g) || []).filter(
        (s) => !/\.(com|ma|fr|org|jpg|pdf|png|test)$/.test(s) && /^[a-z_]+(\.[a-z_]+)+$/.test(s)
      )
    ),
  ];
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

module.exports = { ROOT, SHOTS, build, createReporter, freshPage, calls, visibleText, realErrors, rawKeys, same };
