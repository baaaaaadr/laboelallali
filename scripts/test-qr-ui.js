#!/usr/bin/env node
/**
 * Banc « Scannez-moi » + carte de visite (devis lignes 63, 64, 65 — 12/10/2026).
 *
 *     node scripts/test-qr-ui.js            (ajouter --head pour voir)
 *
 *  Q0 la langue choisie pour un téléphone qui scanne (règle pure du middleware)
 *  Q1 la page : toutes les tuiles, les bons liens (WhatsApp du Dr, avis Google,
 *     itinéraire, appel, connexion qui ramène aux résultats…)
 *  Q2 le compteur anonyme : UN scan (et l'adresse nettoyée), un clic par tuile
 *  Q3 visiteur connecté : « Voir mes résultats » ; arabe
 *  K1 la carte : recto/verso, contact téléphone (.vcf), image, PDF, coordonnées
 *  K2 le fichier contact lui-même (vCard 3.0 lisible par iPhone et Android)
 *
 * Même harnais que les autres bancs (scripts/testing/README.md).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { build, createReporter, freshPage, calls, visibleText, realErrors, rawKeys } = require('./testing/results-bench');

const ROOT = path.resolve(__dirname, '..');
const HEADED = process.argv.includes('--head');
const { scenario, ok, finish } = createReporter();

function assertClean(p, text) {
  const real = realErrors(p);
  ok('aucune erreur JavaScript', real.length === 0, real.slice(0, 3).join(' | '));
  const raw = rawKeys(text);
  ok('aucune clé de traduction brute à l’écran', raw.length === 0, raw.join(', '));
}
const href = (p, key) => p.getAttribute(`[data-qr="${key}"]`, 'href');

async function q0Language() {
  scenario('Q0 — la langue du téléphone qui scanne');
  const out = path.join(ROOT, 'node_modules', '.cache', 'results-tests', 'qr-language.cjs');
  await require('esbuild').build({ entryPoints: [path.join(ROOT, 'src/lib/qr/qrLanguage.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error' });
  const { qrLanguage, QR_KEYS } = require(out);
  ok('téléphone en français (fr-MA) → français', qrLanguage('fr-MA,fr;q=0.9,ar;q=0.8') === 'fr');
  ok('téléphone en arabe (ar-MA) → arabe', qrLanguage('ar-MA,ar;q=0.9,fr;q=0.8') === 'ar');
  ok('anglais puis français → français', qrLanguage('en-US,en;q=0.9,fr;q=0.7') === 'fr');
  ok('rien d’exploitable → arabe (défaut du site)', qrLanguage('en-US') === 'ar' && qrLanguage(null) === 'ar');
  const server = fs.readFileSync(path.join(ROOT, 'functions/src/qr/qrStats.ts'), 'utf8');
  const serverKeys = /QR_KEYS = \[([\s\S]*?)\] as const/.exec(server)[1].match(/"([a-z]+)"/g).map((k) => k.replace(/"/g, ''));
  ok('les clés des tuiles = la liste blanche du compteur serveur', JSON.stringify(serverKeys) === JSON.stringify([...QR_KEYS]), serverKeys.join(','));
}

async function q1Tiles(browser) {
  scenario('Q1 — la page « Scannez-moi » : toutes les tuiles, les bons liens');
  const p = await freshPage(browser, { page: 'qr' });
  await p.waitForSelector('[data-testid="qr-hub"]', { timeout: 8000 });
  const keys = await p.$$eval('[data-qr]', (els) => els.map((e) => e.getAttribute('data-qr')));
  ok('15 tuiles + l’installation de l’application', keys.length === 15 && !!(await p.$('[data-testid="qr-group-more"] .hero-tile:last-child')), keys.join(','));
  ok('premier groupe : les résultats', (await p.$$eval('[data-testid^="qr-group-"]', (e) => e.map((x) => x.getAttribute('data-testid'))))[0] === 'qr-group-results');
  ok('« Recevoir mes résultats » → connexion qui ramène aux résultats', (await href(p, 'results')) === '/fr/login?redirect=/fr/resultats');
  ok('« Parler au Dr El Allali » → son WhatsApp', (await href(p, 'doctor')) === 'https://wa.me/212661291411');
  ok('WhatsApp du laboratoire', (await href(p, 'whatsapp')) === 'https://wa.me/212654079592');
  ok('appel du fixe', (await href(p, 'call')) === 'tel:0528843384');
  ok('itinéraire Google Maps', (await href(p, 'directions')).startsWith('https://maps.app.goo.gl/'));
  ok('avis Google : le formulaire de la fiche du labo', (await href(p, 'review')) === 'https://g.page/r/Ce6V_SOBrPJxEAE/review');
  ok('carte de visite → /fr/carte', (await href(p, 'card')) === '/fr/carte');
  ok('services : RDV, domicile, prix, emploi, médecins',
    (await href(p, 'rdv')) === '/fr/rendez-vous' && (await href(p, 'glabo')) === '/fr/glabo' && (await href(p, 'prices')) === '/fr/analyses' &&
      (await href(p, 'jobs')) === '/fr/emploi' && (await href(p, 'doctors')) === '/fr/mes-patients');
  ok('les liens externes s’ouvrent à part', (await p.getAttribute('[data-qr="doctor"]', 'target')) === '_blank');
  ok('bascule vers l’arabe', (await p.getAttribute('[data-testid="qr-lang"]', 'href')) === '/ar/qr');
  ok('aucun scan compté sans ?scan=1 (visite depuis l’application)', (await calls(p, 'recordQrEvent')).length === 0);
  assertClean(p, await visibleText(p, '#app'));
  await p.close();
}

async function q2Counter(browser) {
  scenario('Q2 — compteur anonyme : un scan, un clic');
  const p = await freshPage(browser, { page: 'qr', search: '?scan=1', responses: { recordQrEvent: { ok: true } } });
  await p.waitForSelector('[data-testid="qr-hub"]', { timeout: 8000 });
  await p.waitForTimeout(300);
  let ev = await calls(p, 'recordQrEvent');
  ok('UN scan, sans autre donnée', ev.length === 1 && JSON.stringify(ev[0]) === '{"event":"scan"}', JSON.stringify(ev));
  ok('?scan=1 retiré de l’adresse (un rechargement ne recompte pas)', !(await p.evaluate(() => window.location.search)).includes('scan'));
  await p.evaluate(() => document.querySelector('[data-qr="review"]').addEventListener('click', (e) => e.preventDefault()));
  await p.click('[data-qr="review"]');
  await p.waitForTimeout(200);
  ev = await calls(p, 'recordQrEvent');
  ok('un clic sur « avis Google » → {event:"click", key:"review"}', ev.length === 2 && JSON.stringify(ev[1]) === '{"event":"click","key":"review"}', JSON.stringify(ev));
  await p.close();
}

async function q3SignedInArabic(browser) {
  scenario('Q3 — visiteur connecté ; arabe');
  let p = await freshPage(browser, { page: 'qr', profile: { uid: 'u-qr', fullName: 'Patient QR', email: 'p.qr@example.test', phone: '0600000099' } });
  await p.waitForSelector('[data-testid="qr-hub"]', { timeout: 8000 });
  ok('connecté : « Voir mes résultats » → /fr/resultats', (await href(p, 'results')) === '/fr/resultats' && (await visibleText(p, '[data-qr="results"]')).includes('Voir mes résultats'));
  await p.close();
  p = await freshPage(browser, { lang: 'ar', page: 'qr' });
  await p.waitForSelector('[data-testid="qr-hub"]', { timeout: 8000 });
  const text = await visibleText(p, '#app');
  ok('arabe : tuiles traduites', text.includes('استلام نتائجي على هاتفي') && text.includes('التحدث مع الدكتور العلالي'));
  ok('arabe : aucun libellé resté en français', !/Recevoir mes résultats|Itinéraire|Prendre rendez-vous/.test(text));
  ok('bascule vers le français', (await p.getAttribute('[data-testid="qr-lang"]', 'href')) === '/fr/qr');
  assertClean(p, text);
  await p.close();
}

async function k1Card(browser) {
  scenario('K1 — la carte de visite');
  const p = await freshPage(browser, { page: 'carte' });
  await p.waitForSelector('[data-testid="carte"]', { timeout: 8000 });
  const imgs = await p.$$eval('[data-testid="carte"] img', (els) => els.map((e) => e.getAttribute('src')));
  ok('recto et verso affichés', JSON.stringify(imgs) === '["/carte-visite/carte-recto.png","/carte-visite/carte-verso.png"]', JSON.stringify(imgs));
  ok('« Enregistrer dans mes contacts » → fichier .vcf', (await p.getAttribute('[data-testid="carte-vcf"]', 'href')) === '/carte-visite/laboratoire-el-allali.vcf');
  ok('image et PDF téléchargeables', (await p.getAttribute('[data-testid="carte-png"]', 'download')) !== null && (await p.getAttribute('[data-testid="carte-pdf"]', 'href')).endsWith('.pdf'));
  const row = (k) => p.getAttribute(`[data-row="${k}"]`, 'href');
  ok('coordonnées cliquables : fixe, WhatsApp, Dr (WhatsApp + appel), e-mail, site, itinéraire',
    (await row('landline')) === 'tel:0528843384' && (await row('whatsapp')) === 'https://wa.me/212654079592' &&
      (await row('doctor')) === 'https://wa.me/212661291411' && (await row('doctor_call')) === 'tel:0661291411' &&
      (await row('email')) === 'mailto:laboelallali@gmail.com' && (await row('site')) === 'https://www.laboelallali.com' &&
      (await row('address')).startsWith('https://maps.app.goo.gl/'));
  const text = await visibleText(p, '#app');
  ok('horaires : samedi jusqu’à 13 h, dimanche fermé', text.includes('13h00') && text.includes('Dimanche fermé'));
  for (const f of ['carte-recto.png', 'carte-verso.png', 'carte-visite-laboratoire-el-allali.pdf', 'laboratoire-el-allali.vcf']) {
    ok(`fichier public présent : ${f}`, fs.existsSync(path.join(ROOT, 'public', 'carte-visite', f)));
  }
  // The site's own address (« www.laboelallali.com ») looks like a key to rawKeys.
  assertClean(p, text.replace(/www\.laboelallali\.com/g, ' '));
  await p.close();
}

function k2Vcard() {
  scenario('K2 — le fichier contact (vCard)');
  const v = fs.readFileSync(path.join(ROOT, 'public/carte-visite/laboratoire-el-allali.vcf'), 'utf8');
  const unfolded = v.replace(/\r\n /g, '');
  ok('vCard 3.0, fins de ligne CRLF', v.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n') && v.trimEnd().endsWith('END:VCARD') && !/[^\r]\n/.test(v));
  ok('aucune ligne de plus de 75 octets', v.split('\r\n').every((l) => Buffer.byteLength(l, 'utf8') <= 75));
  ok('les trois numéros au format international', ['+212528843384', '+212654079592', '+212661291411'].every((n) => unfolded.includes(n)));
  ok('adresse, e-mail, site, logo', unfolded.includes('Rue de Marrakech') && unfolded.includes('laboelallali@gmail.com') && unfolded.includes('URL:https://www.laboelallali.com') && unfolded.includes('PHOTO;ENCODING=b;TYPE=PNG:'));
  ok('horaires dans la note : samedi 13h00', unfolded.includes('sam 7h30–13h00'));
}

async function main() {
  console.log('\n══ Banc « Scannez-moi » + carte de visite ══');
  await build();
  await q0Language();
  const browser = await chromium.launch({ headless: !HEADED });
  try {
    await q1Tiles(browser);
    await q2Counter(browser);
    await q3SignedInArabic(browser);
    await k1Card(browser);
  } finally {
    await browser.close();
  }
  k2Vcard();
  finish();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
