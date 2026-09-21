#!/usr/bin/env node
/**
 * Banc d'essai de l'installation PWA.
 *
 *     node scripts/test-pwa.js           # tout
 *     node scripts/test-pwa.js --head    # avec fenêtre visible
 *
 * Deux parties :
 *
 *  1. **Détection de plateforme**, hors navigateur, sur de VRAIES chaînes
 *     d'agent utilisateur (`scripts/pwa-cases.ts`).
 *  2. **Les trois boutons**, pilotés dans un vrai Chromium, montés ENSEMBLE
 *     comme dans l'application — c'est leur interaction qui produisait le
 *     défaut signalé par un patient le 21/09/2026.
 *
 * ### La règle d'or, vérifiée à chaque scénario
 * **Aucun élément visible et cliquable ne doit rester sans effet.** Après
 * chaque clic, quelque chose doit avoir changé : le dialogue natif appelé, la
 * fiche d'aide ouverte, ou l'état des boutons modifié. C'est très exactement
 * ce que le patient a rencontré : « j'appuie ici, il ne se passe rien ».
 *
 * ### Ce que ce banc NE prouve PAS — à lire avant de conclure
 * L'événement `beforeinstallprompt` est SYNTHÉTIQUE : le pilote fabrique un
 * `Event` portant `prompt()` et `userChoice`, comme le fait Chrome. Le
 * dialogue natif d'installation d'Android n'est donc jamais réellement
 * affiché, et l'ajout à l'écran d'accueil d'un iPhone n'est jamais réellement
 * exécuté. Ce banc prouve que NOTRE code réagit correctement ; il ne prouve
 * pas la dernière étape, qui appartient au système d'exploitation et exige un
 * appareil réel.
 *
 * ⚠ Aucune feuille de style n'est chargée : structure et textes, pas apparence.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'node_modules', '.cache', 'pwa-tests');
const BUNDLE = path.join(OUT_DIR, 'pwa-harness.js');
const HEADED = process.argv.includes('--head');

const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const UA_FB_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,3;FBSV/17.5]';
const UA_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ── Cadre d'assertions ───────────────────────────────────────────────────────
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

// ── 1 · Détection de plateforme, sans navigateur ─────────────────────────────
function buildNodeBattery() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, 'platform-battery.cjs');
  require('esbuild').buildSync({
    entryPoints: [path.join(ROOT, 'scripts', 'testing', 'platform-battery.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: out,
    logLevel: 'warning',
  });
  return out;
}

function runPlatformBattery() {
  console.log('\n══ Détection de plateforme (vraies chaînes d’agent) ════════════');
  const results = JSON.parse(
    require('child_process').execFileSync(process.execPath, [buildNodeBattery()], {
      cwd: ROOT,
      encoding: 'utf8',
    })
  );
  for (const r of results) {
    scenario(r.name);
    ok(`plateforme = ${r.expectPlatform}`, r.platformOk, `obtenu : ${r.platform}`);
    ok(
      r.expectInApp ? 'reconnu comme navigateur intégré' : 'pas un navigateur intégré',
      r.inAppOk,
      `obtenu : ${r.inApp}`
    );
  }
}

// ── 2 · Les trois boutons dans un vrai navigateur ────────────────────────────
function buildHarness() {
  const T = (f) => path.join(ROOT, 'scripts', 'testing', f);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  require('esbuild').buildSync({
    entryPoints: [T('pwa-harness-entry.tsx')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    outfile: BUNDLE,
    define: { 'process.env.NODE_ENV': '"production"' },
    banner: { js: 'window.process = window.process || { env: { NODE_ENV: "production" } };' },
    loader: { '.css': 'empty' },
    alias: { 'react-i18next': T('stub-i18n.tsx') },
    logLevel: 'warning',
  });
}

const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div></body></html>`;

/**
 * @param opts.standalone `'display-mode'` simule une PWA installée sur Android /
 *   ordinateur, `'navigator'` simule un iPhone lancé depuis l'écran d'accueil.
 *   Les deux signaux existent et l'ancien code n'en consultait qu'un seul selon
 *   les fichiers.
 */
async function freshPage(browser, { ua = UA_ANDROID, lang = 'fr', standalone = null, early = false } = {}) {
  const context = await browser.newContext({
    userAgent: ua,
    viewport: { width: 400, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  if (standalone === 'display-mode') {
    // Playwright ne sait pas émuler `display-mode`. On enveloppe `matchMedia`
    // avant tout script de page : c'est la frontière exacte que lit
    // `isRunningStandalone()`.
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q) =>
        q.includes('display-mode: standalone')
          ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
          : real(q);
    });
  }
  if (standalone === 'navigator') {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
    });
  }
  if (ua === UA_IPAD) {
    // Un iPad se distingue d'un Mac par le seul `maxTouchPoints`.
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, configurable: true });
    });
  }

  await page.route('http://labo.test/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML })
  );
  await page.goto('http://labo.test/');
  await page.addScriptTag({ path: BUNDLE });
  await page.evaluate(
    ([l, seedEarly]) => {
      window.__lang = l;
      window.__reset();
      if (seedEarly) window.__seedEarlyPrompt();
      window.__mount();
    },
    [lang, early]
  );
  await page.waitForTimeout(150);
  page.__errors = errors;
  page.__context = context;
  return page;
}

/** Ce que porte chaque emplacement : présent ? cliquable ? quel libellé ? */
async function slots(page) {
  return page.evaluate(() => {
    const read = (id) => {
      const host = document.getElementById(id);
      const el = host && host.firstElementChild;
      if (!el) return { present: false };
      return {
        present: true,
        clickable: el.getAttribute('role') === 'button' || el.tagName === 'BUTTON',
        text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
      };
    };
    return { footer: read('slot-footer'), icon: read('slot-icon'), tile: read('slot-tile') };
  });
}

async function dialogText(page) {
  return page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d ? (d.innerText || d.textContent || '').replace(/\s+/g, ' ').trim() : null;
  });
}

async function closeDialog(page) {
  const btn = page.locator('[role="dialog"] button').last();
  if (await btn.count()) await btn.click();
  await page.waitForTimeout(120);
}

/**
 * LA RÈGLE D'OR. Clique l'emplacement et exige qu'il se soit passé quelque
 * chose : dialogue natif appelé, fiche d'aide ouverte, ou état des boutons
 * modifié.
 */
async function clickAndExpectEffect(page, slotId, label) {
  const before = {
    prompts: await page.evaluate(() => window.__promptCalls),
    slots: JSON.stringify(await slots(page)),
    dialog: await dialogText(page),
  };
  await page.click(`#${slotId} [role="button"], #${slotId} button`);
  await page.waitForTimeout(250);
  const after = {
    prompts: await page.evaluate(() => window.__promptCalls),
    slots: JSON.stringify(await slots(page)),
    dialog: await dialogText(page),
  };
  const changed =
    after.prompts !== before.prompts || after.slots !== before.slots || after.dialog !== before.dialog;
  ok(`${label} : le clic produit un effet`, changed, 'aucun changement — c’est le défaut du patient');
  return after;
}

async function suiteButtons(browser) {
  console.log('\n══ Les trois boutons, montés ensemble ══════════════════════════');

  // ── 1. iPhone Safari : aucun signal d'installation n'existe sur iOS ───────
  {
    scenario('iPhone Safari — aucune installation automatique possible');
    const page = await freshPage(browser, { ua: UA_IPHONE });
    const s = await slots(page);
    ok('le bouton du bas de page EXISTE (il était absent sur iPhone)', s.footer.present);
    ok("l'icône du menu existe", s.icon.present);
    ok('la tuile existe', s.tile.present);
    ok('les trois sont cliquables', s.footer.clickable && s.icon.clickable && s.tile.clickable);
    ok('la tuile propose le geste iOS', s.tile.text.includes("écran d'accueil"), s.tile.text);

    await clickAndExpectEffect(page, 'slot-footer', 'bas de page');
    const d = await dialogText(page);
    ok('la fiche d’aide s’ouvre', Boolean(d));
    ok('elle donne le geste iOS (Partager)', (d || '').includes('Partager'), d || '');
    ok('elle explique que c’est une règle d’Apple', (d || '').includes('Apple'));
    ok('aucune clé de traduction brute', !/pwa\.help\./.test(d || ''), d || '');
    ok('aucune erreur JavaScript', page.__errors.length === 0, page.__errors.join(' | '));
    await page.__context.close();
  }

  // ── 2. Android sans signal (le signal peut n'être jamais émis) ────────────
  {
    scenario('Android — aucun signal reçu');
    const page = await freshPage(browser, { ua: UA_ANDROID });
    await clickAndExpectEffect(page, 'slot-footer', 'bas de page');
    const d = await dialogText(page);
    ok('la fiche d’aide donne le geste Android (menu ⋮)', (d || '').includes('⋮'), d || '');
    ok('elle ne parle PAS de Partager (ce serait iOS)', !(d || '').includes('Partager'));
    await page.__context.close();
  }

  // ── 3. Navigateur intégré Facebook ───────────────────────────────────────
  {
    scenario('iPhone — lien ouvert depuis Facebook');
    const page = await freshPage(browser, { ua: UA_FB_IOS });
    const s = await slots(page);
    ok('le bouton n’a PAS disparu (l’ancien code le croyait installé)', s.footer.present);
    await clickAndExpectEffect(page, 'slot-footer', 'bas de page');
    const d = await dialogText(page);
    ok('la fiche dit d’abord d’ouvrir dans le navigateur', (d || '').includes('navigateur'), d || '');
    await page.__context.close();
  }

  // ── 4. iPad moderne ──────────────────────────────────────────────────────
  {
    scenario('iPad (iPadOS 17, qui s’annonce « Macintosh »)');
    const page = await freshPage(browser, { ua: UA_IPAD });
    await clickAndExpectEffect(page, 'slot-footer', 'bas de page');
    const d = await dialogText(page);
    ok('reconnu comme iOS : geste Partager', (d || '').includes('Partager'), d || '');
    await page.__context.close();
  }

  // ── 5. Android, signal reçu APRÈS le montage ─────────────────────────────
  {
    scenario('Android — signal reçu après le montage');
    const page = await freshPage(browser, { ua: UA_ANDROID });
    await page.evaluate(() => window.__fireInstallPrompt());
    await page.waitForTimeout(200);
    const s = await slots(page);
    ok('les trois boutons basculent ENSEMBLE', s.footer.present && s.icon.present && s.tile.present);
    ok('la tuile annonce l’installation', s.tile.text.includes("écran d'accueil"), s.tile.text);

    await clickAndExpectEffect(page, 'slot-footer', 'bas de page');
    ok('le dialogue natif a été appelé', (await page.evaluate(() => window.__promptCalls)) === 1);
    ok('aucune fiche d’aide inutile', (await dialogText(page)) === null);
    await page.__context.close();
  }

  // ── 6. Capture PRÉCOCE — le signal arrive avant React ────────────────────
  {
    scenario('Android — signal capté AVANT le montage (capture précoce)');
    const page = await freshPage(browser, { ua: UA_ANDROID, early: true });
    await clickAndExpectEffect(page, 'slot-icon', 'icône du menu');
    ok(
      'le dialogue natif est appelé : la capture précoce n’a pas été perdue',
      (await page.evaluate(() => window.__promptCalls)) === 1
    );
    await page.__context.close();
  }

  // ── 7. LE DÉFAUT DU PATIENT : refus, puis nouvel appui ───────────────────
  {
    scenario('Android — le patient REFUSE, puis réappuie (le défaut signalé)');
    const page = await freshPage(browser, { ua: UA_ANDROID });
    await page.evaluate(() => {
      window.__nextOutcome = 'dismissed';
      window.__fireInstallPrompt();
    });
    await page.waitForTimeout(200);

    await page.click('#slot-footer [role="button"]');
    await page.waitForTimeout(300);
    ok('le dialogue natif a bien été proposé', (await page.evaluate(() => window.__promptCalls)) === 1);

    const s = await slots(page);
    ok('le bouton est toujours là après le refus', s.footer.present);

    // Le second appui : c'est là que l'ancien code ne faisait plus rien.
    await clickAndExpectEffect(page, 'slot-footer', 'bas de page, SECOND appui');
    const d = await dialogText(page);
    ok('la fiche d’aide prend le relais', Boolean(d));
    ok(
      'elle explique qu’il faut recharger pour revoir la proposition',
      (d || '').includes('Recharge') || (d || '').includes('recharge'),
      d || ''
    );
    ok('le dialogue natif n’est PAS rappelé à vide', (await page.evaluate(() => window.__promptCalls)) === 1);
    await page.__context.close();
  }

  // ── 8. Acceptation ───────────────────────────────────────────────────────
  {
    scenario('Android — le patient ACCEPTE');
    const page = await freshPage(browser, { ua: UA_ANDROID });
    await page.evaluate(() => {
      window.__nextOutcome = 'accepted';
      window.__fireInstallPrompt();
    });
    await page.waitForTimeout(150);
    await page.click('#slot-footer [role="button"]');
    await page.waitForTimeout(350);
    const s = await slots(page);
    ok('le bouton du bas de page disparaît', !s.footer.present);
    ok('l’icône du menu disparaît', !s.icon.present);
    ok('la tuile reste, et dit « installée »', s.tile.present && s.tile.text.includes('install'), s.tile.text);
    ok('la tuile n’est plus cliquable', !s.tile.clickable);
    await page.__context.close();
  }

  // ── 9. Installation faite ailleurs (événement appinstalled) ──────────────
  {
    scenario('Installation confirmée par le système (appinstalled)');
    const page = await freshPage(browser, { ua: UA_ANDROID });
    await page.evaluate(() => window.__fireInstallPrompt());
    await page.waitForTimeout(150);
    ok('avant : le bouton est là', (await slots(page)).footer.present);
    await page.evaluate(() => window.__fireAppInstalled());
    await page.waitForTimeout(200);
    const s = await slots(page);
    ok('après : les trois points d’entrée ont pris acte', !s.footer.present && !s.icon.present);
    ok('la tuile dit « installée »', s.tile.text.includes('install'), s.tile.text);
    await page.__context.close();
  }

  // ── 10. Application déjà installée, les deux signaux ─────────────────────
  {
    scenario('Déjà installée — Android (display-mode: standalone)');
    const page = await freshPage(browser, { ua: UA_ANDROID, standalone: 'display-mode' });
    const s = await slots(page);
    ok('aucun bouton d’installation dans le bas de page', !s.footer.present);
    ok('aucune icône dans le menu', !s.icon.present);
    ok('la tuile dit « installée »', s.tile.present && s.tile.text.includes('install'), s.tile.text);
    await page.__context.close();
  }
  {
    scenario('Déjà installée — iPhone (navigator.standalone)');
    const page = await freshPage(browser, { ua: UA_IPHONE, standalone: 'navigator' });
    const s = await slots(page);
    ok(
      'reconnu installée par le signal iOS, que l’ancien bouton ne consultait pas',
      !s.footer.present && !s.icon.present
    );
    ok('la tuile dit « installée »', s.tile.text.includes('install'), s.tile.text);
    await page.__context.close();
  }

  // ── 11. LE DÉFAUT DU MONTAGE CROISÉ ──────────────────────────────────────
  {
    scenario('Retour sur l’accueil — la tuile se remonte (défaut du montage croisé)');
    const page = await freshPage(browser, { ua: UA_ANDROID });
    await page.evaluate(() => window.__fireInstallPrompt());
    await page.waitForTimeout(150);

    // Démonter puis remonter la tuile : c'est ce que fait une navigation vers
    // l'accueil. L'ancien code exécutait alors `window.deferredPrompt = null`.
    await page.evaluate(() => window.__setTileMounted(false));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.__setTileMounted(true));
    await page.waitForTimeout(150);

    const s = await slots(page);
    ok('le bouton du bas de page est intact', s.footer.present && s.footer.clickable);
    await page.click('#slot-footer [role="button"]');
    await page.waitForTimeout(300);
    ok(
      'il lance TOUJOURS le dialogue natif — la capture n’a pas été effacée',
      (await page.evaluate(() => window.__promptCalls)) === 1,
      'c’est la cause n° 2 du défaut signalé'
    );
    await page.__context.close();
  }

  // ── 12. Version arabe ────────────────────────────────────────────────────
  {
    scenario('Version arabe — fiche d’aide traduite');
    const page = await freshPage(browser, { ua: UA_IPHONE, lang: 'ar' });
    await clickAndExpectEffect(page, 'slot-footer', 'bas de page');
    const d = await dialogText(page);
    ok('la fiche est en arabe', /[؀-ۿ]/.test(d || ''), d || '');
    ok('aucune clé de traduction brute', !/pwa\.help\./.test(d || ''), d || '');
    ok('aucun texte français resté en dur', !/Appuyez sur|Faites défiler/.test(d || ''), d || '');
    await page.__context.close();
  }

  // ── 13. La règle d’or, appliquée partout ─────────────────────────────────
  {
    scenario('Règle d’or : aucun élément cliquable sans effet');
    for (const [name, ua] of [
      ['iPhone', UA_IPHONE],
      ['Android', UA_ANDROID],
      ['iPad', UA_IPAD],
      ['Facebook iOS', UA_FB_IOS],
      ['Ordinateur', UA_DESKTOP],
    ]) {
      const page = await freshPage(browser, { ua });
      for (const slot of ['slot-footer', 'slot-icon', 'slot-tile']) {
        const s = await slots(page);
        const key = slot.replace('slot-', '');
        if (!s[key].present || !s[key].clickable) continue;
        await clickAndExpectEffect(page, slot, `${name} · ${key}`);
        await closeDialog(page);
      }
      await page.__context.close();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  runPlatformBattery();
  buildHarness();
  const browser = await chromium.launch({ headless: !HEADED });
  try {
    await suiteButtons(browser);
  } finally {
    await browser.close();
  }

  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log(`${passed} vérifications passées, ${failures.length} en échec.`);
  if (failures.length) {
    console.log('\nÉCHECS :');
    for (const f of failures) console.log(`\n  ✗ ${f}`);
    process.exit(1);
  }
  console.log('Tout est vert.');
  console.log(
    '\n⚠ Rappel : l’événement d’installation est SIMULÉ. Ce banc prouve que notre\n' +
      '  code réagit correctement ; il ne remplace pas un essai sur un vrai Android\n' +
      '  et un vrai iPhone, seuls capables d’afficher le dialogue du système.'
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
