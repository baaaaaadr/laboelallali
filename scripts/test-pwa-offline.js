#!/usr/bin/env node
/**
 * Vérifie le mode HORS CONNEXION sur un site RÉELLEMENT SERVI.
 *
 *     node scripts/test-pwa-offline.js                        # production
 *     node scripts/test-pwa-offline.js http://localhost:3000  # après npm start
 *
 * ### Pourquoi ce banc est séparé de `scripts/test-pwa.js`
 * Il lui faut un vrai serveur, parce que le défaut qu'il surveille n'existe
 * QUE derrière Firebase Hosting : celui-ci sert l'application en « URL
 * propres », si bien que `/offline.html` répond **301 vers `/offline`**.
 *
 * `cache.add('/offline.html')` range alors bien la page — le piège est
 * ailleurs, et il est sournois : la réponse rangée porte le drapeau
 * `redirected`, et une réponse marquée ainsi ne peut pas répondre à une
 * navigation. Chrome la refuse. Mesuré sur la production le 21/09/2026 :
 * réseau coupé, le patient obtenait « 404 This page could not be found » alors
 * que la page de repli était pourtant bien dans le cache. C'est pourquoi ce
 * banc ne se contente pas de vérifier la présence en cache — il coupe
 * réellement le réseau.
 *
 * Rien de tout cela n'apparaît en local, où `/offline.html` répond directement.
 * C'est pourquoi ce banc vise la PRODUCTION par défaut.
 *
 * ### Ce qu'il fait réellement
 * Il enregistre le service worker, attend son activation, vérifie que la page
 * de repli est bien DANS le cache, puis **coupe vraiment le réseau** et
 * navigue. C'est la seule preuve qui vaille : le reste n'est que de la lecture
 * de code.
 *
 * Lecture seule : aucune écriture, aucun compte, aucune donnée patient.
 */
const { chromium } = require('playwright');

const BASE = (process.argv.find((a) => a.startsWith('http')) || 'https://www.laboelallali.com').replace(/\/$/, '');
const HEADED = process.argv.includes('--head');

let passed = 0;
const failures = [];

function ok(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  · ${label}`);
    return true;
  }
  failures.push(`${label}${detail ? `\n      ${detail}` : ''}`);
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  return false;
}

(async () => {
  console.log(`\n══ Mode hors connexion — ${BASE} ═══════════════════════════════\n`);

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    viewport: { width: 400, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/fr`, { waitUntil: 'load', timeout: 60000 });

    // -- 1. Le service worker s'installe et prend la main --------------------
    const swReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      return reg ? 'ready' : 'none';
    });
    ok('le service worker est enregistré et actif', swReady === 'ready', `obtenu : ${swReady}`);

    // Laisse le temps à `install` de terminer son pré-cache.
    await page.waitForTimeout(2500);

    // -- 2. La page de repli est DANS le cache -------------------------------
    const cached = await page.evaluate(async () => {
      const names = await caches.keys();
      for (const name of names) {
        const cache = await caches.open(name);
        const hit = await cache.match('/offline.html');
        if (hit) {
          return {
            name,
            status: hit.status,
            // ⚠ NE PAS tronquer : le texte arabe vit après un bloc <style> de
            // plus de 3 000 caractères. Une coupure à 4 000 le faisait
            // « disparaître » et accusait l'application à tort.
            text: await hit.text(),
            redirected: hit.redirected,
            url: hit.url,
          };
        }
      }
      return { names };
    });

    ok(
      'la page de repli est pré-cachée',
      Boolean(cached.status),
      cached.status ? '' : `caches présents : ${JSON.stringify(cached.names)} — c'est le défaut de la redirection`
    );
    if (cached.status) {
      ok('sous le cache attendu', /laboelallali-v\d+/.test(cached.name), cached.name);
      ok('avec un statut 200', cached.status === 200, String(cached.status));
      ok('contenant le texte français', (cached.text || '').includes('hors connexion'));
      ok('et le texte arabe', (cached.text || '').includes('غير متصل'));
    }

    if (cached.status) {
      // Une réponse gardée « redirigée » ne peut pas être renvoyée à une
      // navigation : Chrome refuse avec « a redirected response was used for a
      // request whose redirect mode is not follow ». C'est ce que produit
      // `cache.add('/offline.html')` derrière les URL propres de Firebase.
      ok('la réponse cachée n’est pas marquée « redirigée »', cached.redirected === false,
        `redirected=${cached.redirected}, url=${cached.url}`);
    }

    // -- 3. LA VRAIE PREUVE : couper le réseau et naviguer -------------------
    // ⚠ Vers une adresse JAMAIS visitée. Le service worker sert les navigations
    // en « réseau d'abord, puis cache » : une page déjà vue s'affiche hors
    // connexion depuis le cache — ce qui est le bon comportement, mais ne teste
    // pas du tout le repli. Seule une adresse inconnue l'atteint.
    await context.setOffline(true);
    let offlineBody = '';
    let offlineUrl = '';
    try {
      await page.goto(`${BASE}/fr/page-jamais-visitee-${Date.now()}`, {
        waitUntil: 'load',
        timeout: 30000,
      });
      offlineBody = await page.evaluate(() => document.body.innerText || '');
      offlineUrl = page.url();
    } catch (err) {
      offlineBody = `ÉCHEC DE NAVIGATION : ${String(err).slice(0, 300)}`;
    }

    ok(
      'réseau coupé : une page utile s’affiche quand même',
      offlineBody.includes('hors connexion') || offlineBody.includes('غير متصل'),
      offlineBody.slice(0, 300).replace(/\s+/g, ' ')
    );
    ok(
      'le numéro du laboratoire y figure',
      offlineBody.includes('05 28 84 33 84') || offlineBody.includes('0528843384'),
      offlineBody.slice(0, 200).replace(/\s+/g, ' ')
    );
    // L'adresse ne doit PAS avoir changé : le repli est servi SOUS l'URL
    // demandée. Une redirection visible signalerait que le service worker a
    // laissé passer la requête au lieu d'y répondre.
    ok(
      'le repli est servi sous l’adresse demandée',
      offlineUrl.includes('/fr/page-jamais-visitee-'),
      offlineUrl
    );
    await context.setOffline(false);
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
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
