#!/usr/bin/env node
/**
 * Pilote navigateur du parcours patient — ce que le patient VOIT et FAIT.
 *
 *     node scripts/test-journey-ui.js            # les deux mises en page
 *     node scripts/test-journey-ui.js v2         # seulement /test-rdv2
 *     node scripts/test-journey-ui.js v2 --head  # avec fenêtre visible
 *
 * Complément de `node scripts/test-journey.js`, qui vérifie ce que le
 * laboratoire REÇOIT. Les deux ont déjà divergé — d'où deux pilotes.
 *
 * Le composant monté est le code de production, sans modification ; seules six
 * frontières externes sont doublées. Voir `scripts/testing/README.md` pour la
 * liste exacte et la raison de chacune.
 *
 * ⚠ Aucune feuille de style n'est chargée : on vérifie la STRUCTURE et les
 * TEXTES, jamais l'apparence. Une assertion de position ou de couleur ici
 * serait un faux sentiment de sécurité.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'node_modules', '.cache', 'journey-tests');
const BUNDLE = path.join(OUT_DIR, 'harness.js');
const SHOTS = path.join(OUT_DIR, 'captures');

const args = process.argv.slice(2);
const HEADED = args.includes('--head');
const ONLY = args.find((a) => a === 'v1' || a === 'v2');

// ── Compilation du banc ──────────────────────────────────────────────────────
function build() {
  const T = (f) => path.join(ROOT, 'scripts', 'testing', f);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(SHOTS, { recursive: true });
  require('esbuild').buildSync({
    entryPoints: [path.join(ROOT, 'scripts', 'testing', 'harness-entry.tsx')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    outfile: BUNDLE,
    define: { 'process.env.NODE_ENV': '"development"' },
    // Certaines dépendances lisent `process` en dehors de `process.env.NODE_ENV`
    // (que `define` remplace littéralement). Hors bundler Next, la variable
    // n'existe pas dans le navigateur et le bundle lève avant même d'exposer
    // `window.__mount`.
    banner: {
      js: 'window.process = window.process || { env: { NODE_ENV: "development" }, browser: true };',
    },
    // `react-datepicker` importe sa propre CSS ; hors chaîne Next, on la vide.
    loader: { '.css': 'empty' },
    alias: {
      '@/contexts/AuthContext': T('stub-auth.tsx'),
      '@/config/firebase': T('stub-firebase.tsx'),
      '@/components/ui/MultiFileUploader': T('stub-uploader.tsx'),
      'firebase/firestore': T('stub-firebase.tsx'),
      'firebase/storage': T('stub-firebase.tsx'),
      'firebase/functions': T('stub-firebase.tsx'),
      'react-i18next': T('stub-i18n.tsx'),
      'react-hot-toast': T('stub-toast.tsx'),
      'next/navigation': T('stub-navigation.tsx'),
      'next/link': T('stub-link.tsx'),
    },
    logLevel: 'warning',
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

// ── Un panier réaliste, écrit dans localStorage avant le montage ─────────────
const CART_KEY = 'laboElAllali_selectedItems_v2';
const CART = [
  {
    type: 'analyse',
    item: {
      id: 'H NFS', Nom_Patient_FR: 'Numération formule sanguine', Nom_Patient_AR: 'تعداد الدم الكامل',
      Prix_Dhs: 65, Categorie_FR: 'Hématologie', Categorie_AR: 'أمراض الدم',
      Pre_Analytique_FR: 'Aucune préparation particulière', Pre_Analytique_AR: 'لا يتطلب تحضيرًا خاصًا',
      Tags_FR: [], Tags_AR: [], CPA_Type: 'Sang', CPA_Jeune_H: 0, DRR_Jours: 1,
    },
  },
  {
    type: 'analyse',
    item: {
      id: 'C GLY', Nom_Patient_FR: 'Glycémie à jeun', Nom_Patient_AR: 'السكر على الريق',
      Prix_Dhs: 40, Categorie_FR: 'Biochimie', Categorie_AR: 'الكيمياء الحيوية',
      Pre_Analytique_FR: 'Être à jeun depuis 12 heures', Pre_Analytique_AR: 'الصيام 12 ساعة',
      Tags_FR: [], Tags_AR: [], CPA_Type: 'Sang', CPA_Jeune_H: 12, DRR_Jours: 0,
      CPA_Instructions: 'Tube fluoré',
    },
  },
  {
    type: 'analyse',
    item: {
      id: 'C FER', Nom_Patient_FR: 'Ferritine', Nom_Patient_AR: 'الفيريتين',
      Prix_Dhs: 120, Categorie_FR: 'Biochimie', Categorie_AR: 'الكيمياء الحيوية',
      Pre_Analytique_FR: '', Pre_Analytique_AR: '',
      Tags_FR: [], Tags_AR: [], CPA_Type: 'Sang', CPA_Jeune_H: 0, DRR_Jours: 2,
    },
  },
];
/** 65 + 40 + 120 + 20 (frais de prélèvement) */
const CART_TOTAL = 245;

// ── Aides de pilotage ────────────────────────────────────────────────────────
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div></body></html>`;

async function freshPage(browser, { lang, layout, seedCart, width = 420 }) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  // Sur mobile, `handleWhatsApp` fait `window.location.href = …` — la page
  // quitterait le banc et emporterait tous les témoins avec elle. On intercepte
  // la requête sortante : l'adresse est enregistrée, la navigation avortée.
  page.__waNavigations = [];
  await page.route('https://wa.me/**', (route) => {
    page.__waNavigations.push(route.request().url());
    route.abort();
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // Une VRAIE origine http est nécessaire : `localStorage` et `sessionStorage`
  // lèvent sur `about:blank`, et le parcours s'en sert pour le panier et le
  // brouillon. Rien n'est servi sur le réseau — la réponse est fabriquée ici.
  await page.route('http://labo.test/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML })
  );
  await page.goto('http://labo.test/');
  await page.addScriptTag({ path: BUNDLE });
  await page.evaluate(
    ([l, ly, cart, key]) => {
      window.__lang = l;
      window.__layout = ly;
      window.localStorage.clear();
      window.sessionStorage.clear();
      if (cart) window.localStorage.setItem(key, JSON.stringify(cart));
      window.__mount();
    },
    [lang, layout, seedCart ? CART : null, CART_KEY]
  );
  await page.waitForSelector('h1');
  await page.waitForTimeout(150);
  page.__errors = errors;
  return page;
}

/** Le texte visible, sans les libellés réservés aux lecteurs d'écran. */
async function visibleText(page) {
  return page.evaluate(() => {
    const clone = document.getElementById('app').cloneNode(true);
    clone.querySelectorAll('.sr-only,[aria-hidden="true"]').forEach((n) => n.remove());
    return clone.innerText || clone.textContent || '';
  });
}

/** Les en-têtes de l'accordéon : titre + puce d'obligation + résumé. */
async function headers(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('section.card > div > button[aria-expanded]')).map((b) => ({
      text: (b.innerText || b.textContent || '').replace(/\s+/g, ' ').trim(),
      expanded: b.getAttribute('aria-expanded') === 'true',
      sectionId: b.closest('section').id,
    }))
  );
}

/** Les titres des blocs non repliables (réponse immédiate, envoi). */
async function staticBlocks(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('section.card'))
      .filter((s) => !s.querySelector(':scope > div > button[aria-expanded]'))
      .map((s) => ({ id: s.id, title: (s.querySelector('h2')?.textContent || '').trim() }))
  );
}

async function openSection(page, sectionId) {
  await page.click(`#${sectionId} button[aria-expanded]`);
  await page.waitForTimeout(120);
}

async function clickText(page, text, { exact = false } = {}) {
  const locator = page.getByText(text, { exact });
  await locator.first().click();
  await page.waitForTimeout(120);
}

/**
 * ⚠ Le TITRE de la section d'envoi et le BOUTON portent le même libellé
 * (« Envoyer ma demande » = `submit.title` = `submit.send_request`).
 * `getByText` attrapait le `<h2>`, le clic ne faisait rien, et le pilote
 * concluait à tort que l'envoi avait échoué. Toujours viser le bouton.
 */
async function clickSubmit(page, which = 'form') {
  const label = which === 'whatsapp' ? /WhatsApp|واتساب/ : /Envoyer ma demande|إرسال طلبي/;
  await page.locator('#journey-submit button').filter({ hasText: label }).first().click();
  await page.waitForTimeout(120);
}

/** Aucune clé i18n brute (« group.plus_title », « submit.error »…) à l'écran. */
function assertNoRawKeys(page, text) {
  const suspects = (text.match(/\b[a-z_]+\.[a-z_]{3,}(?:\.[a-z_]+)?\b/g) || []).filter(
    (s) =>
      !s.includes('@') &&
      !/\.(com|ma|fr|org|jpg|pdf|png)$/.test(s) &&
      // Les vrais textes contiennent des points suivis d'espace ; les clés, non.
      /^[a-z_]+(\.[a-z_]+)+$/.test(s)
  );
  return ok(
    'aucune clé de traduction brute affichée',
    suspects.length === 0,
    suspects.length ? `trouvées : ${[...new Set(suspects)].join(', ')}` : ''
  );
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  build();
  const browser = await chromium.launch({ headless: !HEADED });

  try {
    if (ONLY !== 'v1') await suiteV2(browser);
    if (ONLY !== 'v2') await suiteV1(browser);
    await suiteComparaison(browser);
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

// ═════════════════════════════════════════════════════════════════════════════
// /test-rdv2 — la mise en page à quatre blocs
// ═════════════════════════════════════════════════════════════════════════════
async function suiteV2(browser) {
  console.log('\n══ /test-rdv2 · quatre blocs ═══════════════════════════════════');

  // ── 1. Écran d'arrivée, page vierge ────────────────────────────────────────
  {
    scenario('Arrivée sur une page vierge (aucun panier)');
    const page = await freshPage(browser, { lang: 'fr', layout: 'v2', seedCart: false });
    const h = await headers(page);
    const text = await visibleText(page);

    ok('un seul bloc dépliant à l\'arrivée (les autres n\'existent pas encore)', h.length === 1,
      `blocs : ${h.map((x) => x.sectionId).join(', ')}`);
    ok('c\'est « Vos analyses »', h[0]?.text.includes('Vos analyses'), h[0]?.text);
    ok('il est OUVERT — sinon l\'écran est mort', h[0]?.expanded === true);
    ok('la règle du jeu est annoncée en haut de page',
      text.includes('Seuls les blocs marqués') && text.includes('Vous pouvez ignorer les autres'),
      "c'est la réponse directe à « que ça soit clair ce qu'ils peuvent zapper »");
    ok('le bloc porte la puce « Obligatoire »', h[0]?.text.includes('Obligatoire'));
    ok('aucun bouton d\'envoi tant que rien n\'est demandé', !text.includes('Envoyer ma demande'));
    assertNoRawKeys(page, text);
    ok('aucune erreur JavaScript', page.__errors.length === 0, page.__errors.join(' | '));
    await page.screenshot({ path: path.join(SHOTS, 'v2-01-arrivee-vierge.png'), fullPage: true });
    await page.close();
  }

  // ── 2. CAS FRÉQUENT n°2 : arrivée avec un panier ──────────────────────────
  {
    scenario('CAS FRÉQUENT n°2 — arrive du catalogue avec 3 analyses');
    const page = await freshPage(browser, { lang: 'fr', layout: 'v2', seedCart: true });
    // -- premier temps : la vague 2 attend encore la réponse « ordonnance ? » --
    let h = await headers(page);
    let text = await visibleText(page);

    ok(`le total ${CART_TOTAL} DH s'affiche AVANT tout clic`, text.includes(String(CART_TOTAL)));
    ok('le bloc 1 est ouvert : la dernière question obligatoire ne doit pas être cachée',
      h[0].expanded === true,
      'sinon le patient voit une seule ligne fermée et ne sait pas quoi faire');
    ok('la question « avez-vous une ordonnance ? » est visible',
      text.includes('Avez-vous une ordonnance'));

    // -- second temps : il répond, la vague 2 apparaît d'un coup --------------
    await clickText(page, "Non, je n'en ai pas");
    h = await headers(page);
    text = await visibleText(page);

    ok('EXACTEMENT 4 blocs dépliants — la demande du Dr Aziz', h.length === 4,
      `obtenu ${h.length} : ${h.map((x) => x.sectionId).join(', ')}`);
    ok('dans l\'ordre : analyses, contact, rendez-vous, plus',
      h.map((x) => x.sectionId).join(',') ===
        'journey-g-analyses,journey-g-contact,journey-g-rendezvous,journey-g-plus',
      h.map((x) => x.sectionId).join(','));

    const obligations = h.map((x) => (x.text.includes('Obligatoire') ? 'req' : x.text.includes('Facultatif') ? 'opt' : '?'));
    ok('2 obligatoires, 2 facultatifs — clair au premier coup d\'œil',
      obligations.join(',') === 'req,req,opt,opt', obligations.join(','));

    ok('le bloc 2 résume déjà les coordonnées pré-remplies',
      h[1].text.includes('Fatima') && h[1].text.includes('0612345678'), h[1].text);
    ok('le bloc 3 dit pourquoi il est vide', h[2].text.includes('Aucun créneau demandé'), h[2].text);
    ok('le bloc 1 ne s\'est PAS refermé au nez du patient', h[0].expanded === true,
      'piège documenté sur /test-rdv');

    // Le résumé d'un bloc n'existe QUE replié — c'est le contrat de
    // `Disclosure` : déplié, le contenu se suffit et le répéter ferait doublon.
    await openSection(page, 'journey-g-analyses');
    h = await headers(page);
    ok('une fois replié, le bloc 1 résume le panier',
      h[0].text.includes('3 analyses') && h[0].text.includes('245'), h[0].text);
    ok('et il porte la coche verte', await page.evaluate(() =>
      Boolean(document.querySelector('#journey-g-analyses svg.text-\\[var\\(--status-success\\)\\]'))));
    await openSection(page, 'journey-g-analyses'); // on le rouvre, état d'origine

    const blocks = await staticBlocks(page);
    ok('la réponse immédiate est HORS accordéon',
      blocks.some((b) => b.id === 'journey-answer'), JSON.stringify(blocks));
    ok('le bouton d\'envoi est HORS accordéon aussi',
      blocks.some((b) => b.id === 'journey-submit'));
    ok('le jeûne s\'affiche sans un clic', text.includes('12 h'));
    ok('le délai s\'affiche sans un clic', /2 jours/.test(text));
    ok('le choix « réponse d\'abord / réserver » est visible d\'emblée',
      text.includes('Recevoir ma réponse d\'abord') && text.includes('Réserver un créneau maintenant'));
    assertNoRawKeys(page, text);
    ok('aucune erreur JavaScript', page.__errors.length === 0, page.__errors.join(' | '));
    await page.screenshot({ path: path.join(SHOTS, 'v2-02-avec-panier.png'), fullPage: true });

    // -- envoi sans réserver de créneau -------------------------------------
    scenario('CAS FRÉQUENT n°2 — envoi SANS réserver');
    await clickSubmit(page);
    await page.waitForTimeout(600);

    const sent = await page.evaluate(() => window.__sent);
    const docs = await page.evaluate(() => window.__firestore);
    ok('la demande est partie sans exiger de date', sent.length === 1,
      `toasts : ${JSON.stringify(await page.evaluate(() => window.__toasts))}`);
    if (sent.length === 1) {
      const b = sent[0].body;
      ok('la charge utile dit qu\'aucun créneau n\'est voulu', b.wantsAppointment === false);
      ok('date et heure sont vides, pas inventées', b.date_souhaitee === '' && b.heure_souhaitee === '');
      ok('les 3 analyses partent au laboratoire', b.analyses?.length === 3);
      ok(`le total annoncé est ${CART_TOTAL} DH`, b.cartTotals?.total === CART_TOTAL, JSON.stringify(b.cartTotals));
      ok('les consignes de préparation partent aussi', b.preparation?.maxJeune === 12);
      ok('la source est bien le parcours', b.source === 'journey');
    }
    ok('un document est écrit dans appointmentRequests', docs.length === 1);
    if (docs.length === 1) {
      ok('collection correcte', docs[0].collection === 'appointmentRequests');
      ok('statut contractuel', docs[0].doc.status === 'new_appointment_request', String(docs[0].doc.status));
    }
    await page.close();
  }

  // ── 3. CAS FRÉQUENT n°1 : ordonnance photographiée ────────────────────────
  {
    scenario('CAS FRÉQUENT n°1 — ordonnance photographiée, veut prix/jeûne/délai');
    const page = await freshPage(browser, { lang: 'fr', layout: 'v2', seedCart: false });

    await clickText(page, "Oui, j'ai une ordonnance");
    await clickText(page, 'Photo ou PDF');
    await page.click('[data-testid="uploader-add"]');
    await page.waitForTimeout(200);

    const text = await visibleText(page);
    const h = await headers(page);
    ok('les 4 blocs apparaissent d\'un coup, pas un par un', h.length === 4, String(h.length));
    ok('la réponse humaine est annoncée', text.includes('réponse du biologiste'));
    ok('aucun devis inventé sur une photo', !text.includes('Total estimé'));
    ok('le bouton d\'envoi est là', text.includes('Envoyer ma demande'));
    assertNoRawKeys(page, text);
    await page.screenshot({ path: path.join(SHOTS, 'v2-03-ordonnance.png'), fullPage: true });

    await clickSubmit(page);
    await page.waitForTimeout(600);
    const sent = await page.evaluate(() => window.__sent);
    ok('la demande part sans créneau ni panier', sent.length === 1);
    if (sent.length === 1) {
      const b = sent[0].body;
      ok('l\'ordonnance téléversée accompagne la demande', b.ordonnanceUrls?.length === 1, JSON.stringify(b.ordonnanceUrls));
      ok('le laboratoire sait qu\'une réponse humaine est attendue', b.needsHumanAnswer === true);
      ok('mode de transmission transmis en clé brute', JSON.stringify(b.transmissionModes) === '["upload"]');
      ok('pas de créneau', b.wantsAppointment === false);
    }
    ok('aucune erreur JavaScript', page.__errors.length === 0, page.__errors.join(' | '));
    await page.close();
  }

  // ── 4. Réserver un créneau : le bloc 3 redevient obligatoire ──────────────
  {
    scenario('Bascule « Réserver un créneau maintenant »');
    const page = await freshPage(browser, { lang: 'fr', layout: 'v2', seedCart: true });
    await clickText(page, "Non, je n'en ai pas");

    let h = await headers(page);
    ok('avant la bascule, le rendez-vous est facultatif', h[2].text.includes('Facultatif'));

    await clickText(page, 'Réserver un créneau maintenant');
    h = await headers(page);
    ok('après la bascule, il devient obligatoire', h[2].text.includes('Obligatoire'), h[2].text);
    ok('les trois autres blocs n\'ont pas changé de statut',
      h[0].text.includes('Obligatoire') && h[1].text.includes('Obligatoire') && h[3].text.includes('Facultatif'));
    await page.screenshot({ path: path.join(SHOTS, 'v2-04-reserver.png'), fullPage: true });

    // Envoi sans avoir choisi de date : doit être refusé ET ouvrir le bloc.
    scenario('Refus de validation : le bloc fautif s\'ouvre tout seul');
    await clickSubmit(page);
    await page.waitForTimeout(400);
    const toasts = await page.evaluate(() => window.__toasts);
    const sent = await page.evaluate(() => window.__sent);
    ok('rien n\'est parti', sent.length === 0);
    ok('le patient est prévenu', toasts.some((t) => t.kind === 'error'), JSON.stringify(toasts));
    h = await headers(page);
    ok('le bloc « Votre rendez-vous » s\'est ouvert de lui-même',
      h[2].expanded === true,
      'sinon le message flotte au-dessus de quatre blocs fermés');
    ok('les autres restent fermés (un seul ouvert à la fois)',
      [h[0], h[1], h[3]].every((x) => !x.expanded));

    // Choisir une date puis renvoyer.
    scenario('Créneau choisi, la demande part');
    const dateOk = await page.evaluate(() => {
      const input = document.querySelector('#journey-g-rendezvous input.react-datepicker-ignore-onclickoutside, #journey-g-rendezvous .react-datepicker__input-container input');
      return Boolean(input);
    });
    ok('le sélecteur de date est présent dans le bloc 3', dateOk);
    const slot = await page.evaluate(() => {
      const sel = document.querySelector('#journey-g-rendezvous select');
      if (!sel) return null;
      const opt = Array.from(sel.options).find((o) => o.value);
      if (!opt) return null;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, opt.value);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return opt.value;
    });
    ok('un créneau est proposé et sélectionnable', Boolean(slot), String(slot));
    await page.waitForTimeout(200);
    await clickSubmit(page);
    await page.waitForTimeout(700);
    const sent2 = await page.evaluate(() => window.__sent);
    ok('la demande part une fois le créneau choisi', sent2.length === 1,
      JSON.stringify(await page.evaluate(() => window.__toasts)));
    if (sent2.length === 1) {
      const b = sent2[0].body;
      ok('wantsAppointment est vrai', b.wantsAppointment === true);
      ok('la date est au format jj/mm/aaaa', /^\d{2}\/\d{2}\/\d{4}$/.test(b.date_souhaitee || ''), b.date_souhaitee);
      ok('l\'heure correspond au créneau choisi', b.heure_souhaitee === slot, `${b.heure_souhaitee} vs ${slot}`);
    }
    ok('aucune erreur JavaScript', page.__errors.length === 0, page.__errors.join(' | '));
    await page.close();
  }

  // ── 5. Prélèvement à domicile ─────────────────────────────────────────────
  {
    scenario('Prélèvement à domicile — l\'adresse doit atteindre le laboratoire');
    const page = await freshPage(browser, { lang: 'fr', layout: 'v2', seedCart: true });
    await clickText(page, "Non, je n'en ai pas");
    await clickText(page, 'Réserver un créneau maintenant');
    await openSection(page, 'journey-g-rendezvous');
    await clickText(page, 'À mon domicile');
    await page.waitForTimeout(150);

    const adresse = '12 rue Ibn Battouta, Talborjt, Agadir';
    await page.fill('#journey-g-rendezvous textarea, #journey-g-rendezvous input[type="text"]:not([readonly])', adresse).catch(async () => {
      await page.fill('#journey-g-rendezvous textarea', adresse);
    });
    await page.waitForTimeout(100);

    const slot = await page.evaluate(() => {
      const sel = document.querySelector('#journey-g-rendezvous select');
      const opt = sel && Array.from(sel.options).find((o) => o.value);
      if (!opt) return null;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, opt.value);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return opt.value;
    });
    ok('un créneau est disponible', Boolean(slot));
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, 'v2-05-domicile.png'), fullPage: true });

    await clickSubmit(page);
    await page.waitForTimeout(700);
    const sent = await page.evaluate(() => window.__sent);
    ok('la demande à domicile part', sent.length === 1,
      JSON.stringify(await page.evaluate(() => window.__toasts)));
    if (sent.length === 1) {
      const b = sent[0].body;
      ok('l\'adresse est dans la charge utile — le bug de lancement', (b.adresse || '').includes('Ibn Battouta'), String(b.adresse));
      ok('le lieu part en CLÉ BRUTE, jamais traduit', b.lieuPrelevement === 'domicile', String(b.lieuPrelevement));
      ok('isHomeService est vrai', b.isHomeService === true);
      ok('les frais de déplacement sont inclus dans le total', b.cartTotals?.total === CART_TOTAL);
    }
    const docs = await page.evaluate(() => window.__firestore);
    ok('le document Firestore porte le bon type',
      docs[0]?.doc.type === 'home_service_appointment', String(docs[0]?.doc.type));
    ok('et le bon statut', docs[0]?.doc.status === 'new_home_service_request', String(docs[0]?.doc.status));
    ok('aucune erreur JavaScript', page.__errors.length === 0, page.__errors.join(' | '));
    await page.close();
  }

  // ── 6. Envoi par WhatsApp ─────────────────────────────────────────────────
  // ⚠ Deux chemins de code, selon la largeur. Sous 768 px, `handleWhatsApp`
  // navigue (`window.location.href`) ; au-dessus, il ouvre une fenêtre de façon
  // SYNCHRONE avant tout `await`, pour que le bloqueur de fenêtres surgissantes
  // ne mange pas la redirection. Les deux doivent être vérifiés.
  {
    scenario('Envoi par WhatsApp — ordinateur (fenêtre surgissante)');
    const page = await freshPage(browser, { lang: 'fr', layout: 'v2', seedCart: true, width: 1024 });
    await clickText(page, "Non, je n'en ai pas");
    await clickSubmit(page, 'whatsapp');
    await page.waitForTimeout(800);

    const url = await page.evaluate(() => window.__whatsappUrl);
    const sent = await page.evaluate(() => window.__sent);
    const docs = await page.evaluate(() => window.__firestore);

    ok('WhatsApp est ouvert avec un message pré-rempli', Boolean(url && url.includes('wa.me')), String(url));
    ok('l\'e-mail part AUSSI (le personnel ne travaille que depuis sa boîte)', sent.length === 1);
    ok('la base est écrite AVANT la navigation', docs.length === 1);
    if (sent.length === 1) ok('l\'e-mail signale l\'arrivée par WhatsApp', sent[0].body.sentViaWhatsApp === true);

    if (url) {
      const msg = decodeURIComponent(url.split('text=')[1] || '');
      ok('le message porte le nom du patient', msg.includes('Fatima Zahra Benali'));
      ok('le message porte le téléphone', msg.includes('0612345678'));
      ok('les 3 analyses sont listées', msg.includes('Numération') && msg.includes('Ferritine'));
      ok(`le total ${CART_TOTAL} DH est annoncé`, msg.includes(String(CART_TOTAL)));
      ok('avec sa réserve « estimation »', msg.includes('estimation, tarif à confirmer'));
      ok('pas de ligne « Date souhaitée » vide', !msg.includes('Date souhaitée'));
      ok('le message explique pourquoi il n\'y a pas de créneau',
        msg.includes("Je n'ai pas encore choisi de créneau"));
      ok('aucun « undefined »', !msg.includes('undefined'));
      ok('aucune clé i18n brute', !msg.includes('journey.'));
    }
    ok('aucune erreur JavaScript', page.__errors.length === 0, page.__errors.join(' | '));
    await page.close();
  }

  {
    scenario('Envoi par WhatsApp — téléphone (navigation directe)');
    const page = await freshPage(browser, { lang: 'fr', layout: 'v2', seedCart: true, width: 390 });
    await clickText(page, "Non, je n'en ai pas");
    await clickSubmit(page, 'whatsapp');
    await page.waitForTimeout(900);

    ok('la navigation vers wa.me a bien lieu', page.__waNavigations.length === 1,
      JSON.stringify(page.__waNavigations));
    if (page.__waNavigations.length === 1) {
      const msg = decodeURIComponent((page.__waNavigations[0].split('text=')[1] || ''));
      ok('le message est complet sur mobile aussi', msg.includes('Fatima Zahra Benali') && msg.includes(String(CART_TOTAL)));
    }
    await page.close();
  }

  // ── 7. Coordonnées manquantes ─────────────────────────────────────────────
  {
    scenario('Coordonnées effacées — le bloc 2 s\'ouvre et rien ne part');
    const page = await freshPage(browser, { lang: 'fr', layout: 'v2', seedCart: true });
    await clickText(page, "Non, je n'en ai pas");
    await openSection(page, 'journey-g-contact');
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('#journey-g-contact input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      inputs.forEach((i) => {
        setter.call(i, '');
        i.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    await page.waitForTimeout(200);
    await page.click('#journey-g-contact button[aria-expanded]'); // referme
    await page.waitForTimeout(150);
    await clickSubmit(page);
    await page.waitForTimeout(400);

    const sent = await page.evaluate(() => window.__sent);
    const h = await headers(page);
    ok('rien n\'est parti sans nom ni téléphone', sent.length === 0);
    ok('le bloc « Pour vous répondre » s\'ouvre de lui-même', h[1].expanded === true);
    ok('et il porte la pastille « information manquante »',
      await page.evaluate(() => Boolean(document.querySelector('#journey-g-contact [aria-label*="manquante"], #journey-g-contact svg.text-\\[var\\(--status-warning\\)\\]'))));
    await page.screenshot({ path: path.join(SHOTS, 'v2-07-coordonnees-manquantes.png'), fullPage: true });

    // Téléphone invalide.
    scenario('Téléphone invalide');
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('#journey-g-contact input'));
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inputs[0], 'Nom Test');
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(inputs[1], '123');
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(150);
    await clickSubmit(page);
    await page.waitForTimeout(300);
    ok('un numéro invalide bloque aussi l\'envoi',
      (await page.evaluate(() => window.__sent)).length === 0);
    ok('aucune erreur JavaScript', page.__errors.length === 0, page.__errors.join(' | '));
    await page.close();
  }

  // ── 8. Arabe / RTL ────────────────────────────────────────────────────────
  {
    scenario('Version arabe — aucune clé brute, aucun mot français oublié');
    const page = await freshPage(browser, { lang: 'ar', layout: 'v2', seedCart: true });
    await clickText(page, 'لا، ليست لدي وصفة');
    const text = await visibleText(page);
    const h = await headers(page);

    ok('4 blocs comme en français', h.length === 4, String(h.length));
    ok('les titres sont traduits', h[0].text.includes('تحاليلك'), h[0].text);
    ok('la puce « obligatoire » est traduite', h[0].text.includes('إجباري'), h[0].text);
    ok('la puce « facultatif » est traduite', h[2].text.includes('اختياري'), h[2].text);
    ok('le choix d\'intention est traduit', text.includes('الحصول على الجواب أولًا'));
    ok('la règle du jeu est traduite', text.includes('إجباري') && text.includes('اختياري'));
    assertNoRawKeys(page, text);
    ok('aucun libellé français resté en dur',
      !/Obligatoire|Facultatif|Envoyer ma demande|Vos analyses/.test(text),
      (text.match(/Obligatoire|Facultatif|Envoyer ma demande|Vos analyses/g) || []).join(', '));
    await page.screenshot({ path: path.join(SHOTS, 'v2-08-arabe.png'), fullPage: true });

    await clickSubmit(page);
    await page.waitForTimeout(600);
    const sent = await page.evaluate(() => window.__sent);
    ok('la demande arabe part', sent.length === 1);
    if (sent.length === 1) {
      const b = sent[0].body;
      ok('la langue est transmise au laboratoire', b.locale === 'ar');
      ok('le lieu reste en clé brute latine, jamais en arabe',
        b.lieuPrelevement === '' || /^[a-z]+$/.test(b.lieuPrelevement), String(b.lieuPrelevement));
      ok('le type de demande est en français dans l\'e-mail',
        b.type_analyse === 'Rendez-vous Laboratoire', String(b.type_analyse));
    }
    ok('aucune erreur JavaScript', page.__errors.length === 0, page.__errors.join(' | '));
    await page.close();
  }

  // ── 9. Aller-retour vers le catalogue ─────────────────────────────────────
  {
    scenario('Aller-retour vers le catalogue : le brouillon est sauvé, le retour vise /test-rdv2');
    const page = await freshPage(browser, { lang: 'fr', layout: 'v2', seedCart: false });
    await clickText(page, "Non, je n'en ai pas");
    await clickText(page, 'Choisir dans le catalogue');
    await page.waitForTimeout(150);
    await clickText(page, 'Ouvrir le catalogue');
    await page.waitForTimeout(200);

    const nav = await page.evaluate(() => window.__nav);
    const draft = await page.evaluate(() =>
      JSON.parse(window.sessionStorage.getItem('laboElAllali_journeyDraft_v1') || 'null')
    );
    const origin = await page.evaluate(() => window.sessionStorage.getItem('laboElAllali_journeyOrigin'));

    ok('la navigation part vers le catalogue', nav.some((u) => u.includes('/analyses')), JSON.stringify(nav));
    ok('elle indique d\'où elle vient', nav.some((u) => u.includes('from=test-rdv2')), JSON.stringify(nav));
    ok('le brouillon est enregistré', Boolean(draft));
    ok('il retient la réponse « pas d\'ordonnance »', draft?.hasPrescription === 'no');
    ok('il retient le mode catalogue', draft?.transmission?.catalog === true);
    ok('il retient l\'intention de créneau', typeof draft?.wantsAppointment === 'boolean');
    ok('l\'origine mémorisée ramènera bien ici', origin === 'test-rdv2', String(origin));
    ok('aucune erreur JavaScript', page.__errors.length === 0, page.__errors.join(' | '));
    await page.close();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// /test-rdv — la mise en page à huit blocs, qui ne doit pas avoir régressé
// ═════════════════════════════════════════════════════════════════════════════
async function suiteV1(browser) {
  console.log('\n══ /test-rdv · huit blocs (non-régression) ═════════════════════');

  {
    scenario('Huit blocs, panier rapporté du catalogue');
    const page = await freshPage(browser, { lang: 'fr', layout: 'v1', seedCart: true });

    // État d'ARRIVÉE, avant tout clic : c'est là que se voit la différence de
    // parti pris entre les deux mises en page.
    const arrivee = await headers(page);
    ok('à l\'arrivée, /test-rdv montre 2 lignes fermées (ordonnance + panier)',
      arrivee.length === 2 && arrivee.every((x) => !x.expanded),
      arrivee.map((x) => `${x.sectionId}:${x.expanded}`).join(', '));
    ok('la question obligatoire restante y est CACHÉE — c\'est ce que /test-rdv2 corrige',
      arrivee[0].expanded === false);

    await openSection(page, 'journey-prescription');
    await clickText(page, "Non, je n'en ai pas");
    const h = await headers(page);
    const text = await visibleText(page);

    ok('8 blocs dépliants', h.length === 8, `obtenu ${h.length} : ${h.map((x) => x.sectionId).join(', ')}`);
    ok('la réponse immédiate est hors accordéon',
      (await staticBlocks(page)).some((b) => b.id === 'journey-answer'));
    ok(`le total ${CART_TOTAL} DH est visible sans clic`, text.includes(String(CART_TOTAL)));
    ok('le choix d\'intention est visible', text.includes('Recevoir ma réponse d\'abord'));
    assertNoRawKeys(page, text);
    ok('aucune erreur JavaScript', page.__errors.length === 0, page.__errors.join(' | '));
    await page.screenshot({ path: path.join(SHOTS, 'v1-01-huit-blocs.png'), fullPage: true });
    await page.close();
  }

  {
    scenario('Envoi depuis l\'ancienne mise en page');
    const page = await freshPage(browser, { lang: 'fr', layout: 'v1', seedCart: true });
    await openSection(page, 'journey-prescription');
    await clickText(page, "Non, je n'en ai pas");
    await clickSubmit(page);
    await page.waitForTimeout(600);
    const sent = await page.evaluate(() => window.__sent);
    ok('la demande part', sent.length === 1,
      JSON.stringify(await page.evaluate(() => window.__toasts)));
    if (sent.length === 1) {
      ok('même charge utile que la nouvelle page', sent[0].body.source === 'journey');
      ok('pas de créneau exigé non plus', sent[0].body.wantsAppointment === false);
    }
    await page.close();
  }

  {
    scenario('Refus de validation : la SECTION fautive s\'ouvre (v1)');
    const page = await freshPage(browser, { lang: 'fr', layout: 'v1', seedCart: true });
    await openSection(page, 'journey-prescription');
    await clickText(page, "Non, je n'en ai pas");
    await openSection(page, 'journey-identity');
    await page.evaluate(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      document.querySelectorAll('#journey-identity input').forEach((i) => {
        setter.call(i, '');
        i.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    await page.click('#journey-identity button[aria-expanded]');
    await page.waitForTimeout(150);
    await clickSubmit(page);
    await page.waitForTimeout(400);
    const h = await headers(page);
    const identity = h.find((x) => x.sectionId === 'journey-identity');
    ok('rien n\'est parti', (await page.evaluate(() => window.__sent)).length === 0);
    ok('« Vos coordonnées » s\'est rouverte', identity?.expanded === true);
    await page.close();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Les deux mises en page doivent produire EXACTEMENT la même demande
// ═════════════════════════════════════════════════════════════════════════════
async function suiteComparaison(browser) {
  console.log('\n══ Les deux pages produisent la même demande ═══════════════════');
  scenario('Même panier, même envoi : charges utiles identiques');

  const capture = async (layout) => {
    const page = await freshPage(browser, { lang: 'fr', layout, seedCart: true });
    if (layout === 'v1') await openSection(page, 'journey-prescription');
    await clickText(page, "Non, je n'en ai pas");
    await clickSubmit(page);
    await page.waitForTimeout(700);
    const sent = await page.evaluate(() => window.__sent);
    const docs = await page.evaluate(() => window.__firestore);
    await page.close();
    return { body: sent[0]?.body ?? null, doc: docs[0]?.doc ?? null };
  };

  const v1 = await capture('v1');
  const v2 = await capture('v2');

  ok('les deux ont bien envoyé', Boolean(v1.body) && Boolean(v2.body));
  if (v1.body && v2.body) {
    ok(
      'charge utile e-mail identique — la disposition ne change RIEN à ce que reçoit le laboratoire',
      JSON.stringify(v1.body) === JSON.stringify(v2.body),
      premiereDifference(v1.body, v2.body)
    );
  }
  if (v1.doc && v2.doc) {
    // `expiresAt` vaut `Date.now() + 30 j` : deux envois séparés d'une seconde
    // ne peuvent pas produire la même valeur. On le compare donc à la journée
    // près, et on exige l'égalité stricte sur tout le reste.
    const sansDate = (d) => {
      const c = { ...d };
      delete c.expiresAt;
      return c;
    };
    ok(
      'document Firestore identique (hors horodatage)',
      JSON.stringify(sansDate(v1.doc)) === JSON.stringify(sansDate(v2.doc)),
      premiereDifference(sansDate(v1.doc), sansDate(v2.doc))
    );
    ok(
      'les deux fixent la même date d\'expiration (30 jours)',
      String(v1.doc.expiresAt).slice(0, 10) === String(v2.doc.expiresAt).slice(0, 10),
      `${v1.doc.expiresAt} vs ${v2.doc.expiresAt}`
    );
  }
}

function premiereDifference(a, b) {
  const keys = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])];
  for (const k of keys) {
    const x = JSON.stringify(a?.[k]);
    const y = JSON.stringify(b?.[k]);
    if (x !== y) return `champ « ${k} » : v1=${x} vs v2=${y}`;
  }
  return '';
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
