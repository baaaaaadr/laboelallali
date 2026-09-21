#!/usr/bin/env node
/**
 * Vérifie le mode HORS CONNEXION sur un site réellement servi.
 *
 *     npm run test:pwa:offline          # PRODUCTION — l'artefact en cache
 *     npm run test:pwa:offline:local    # SERVEUR LOCAL réellement tué
 *
 * ### Deux modes, parce qu'aucun seul ne suffit
 *
 * **Mode production** — le seul qui reproduise le piège des URL propres de
 * Firebase Hosting : `/offline.html` y répond 301 vers `/offline`, et la
 * réponse mise en cache porte alors le drapeau `redirected`. Une réponse
 * marquée ainsi ne peut pas répondre à une navigation ; Chrome la refuse
 * (« a redirected response was used for a request whose redirect mode is not
 * follow »). Ce mode inspecte donc l'ARTEFACT en cache : présent, statut 200,
 * les deux langues, et surtout PAS marqué redirigé.
 *
 * ⚠ Il ne peut PAS couper le réseau, et il ne prétend pas le faire. Mesuré le
 * 21/09/2026 : ni `context.setOffline(true)`, ni
 * `Network.emulateNetworkConditions` par CDP sur la page n'atteignent les
 * requêtes du service worker — celui-ci les émet depuis SON contexte, pas
 * celui de la page. Une première version de ce banc croyait tester hors
 * connexion alors que le worker atteignait tranquillement le réseau : elle
 * rapportait le 404 du serveur comme s'il venait du cache, et aurait validé
 * une fonctionnalité cassée. **Ne pas réintroduire cette illusion.**
 *
 * **Mode `--local`** — la vraie coupure. Le banc démarre lui-même `next start`,
 * laisse le service worker s'installer, puis **tue le serveur** et navigue vers
 * une adresse jamais visitée. Le `fetch` du worker échoue pour de bon, et le
 * repli est réellement exercé. Il vérifie d'abord que le serveur est bien
 * tombé — sans quoi la suite ne testerait rien.
 *
 * Seule limite de ce mode : en local `/offline.html` répond directement, sans
 * redirection. D'où les deux modes, complémentaires.
 *
 * Prérequis du mode local : un `npm run build` préalable (`next start` sert
 * `.next/`). Lecture seule : aucune écriture, aucun compte, aucune donnée
 * patient.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const net = require('net');

const LOCAL = process.argv.includes('--local');
const LOCAL_PORT = 3123;
const BASE = LOCAL
  ? `http://127.0.0.1:${LOCAL_PORT}`
  : (process.argv.find((a) => a.startsWith('http')) || 'https://www.laboelallali.com').replace(/\/$/, '');
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

/** Attend qu'un port accepte les connexions. */
function waitForPort(port, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error(`port ${port} injoignable`));
        else setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

/**
 * ⚠ `next start` crée des processus ENFANTS. Tuer le seul processus parent
 * laisse le port écouté, et la « coupure » n'a jamais lieu — le banc validerait
 * alors du vide. Sous Windows, `taskkill /T` est le seul moyen fiable
 * d'emporter l'arbre entier.
 */
function killTree(child) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' }).on('exit', () =>
        setTimeout(resolve, 1500)
      );
    } else {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
      setTimeout(resolve, 1500);
    }
  });
}

(async () => {
  console.log(
    `\n══ Mode hors connexion — ${LOCAL ? 'SERVEUR LOCAL (vraie coupure)' : 'PRODUCTION (artefact en cache)'} ══\n`
  );

  let server = null;
  if (LOCAL) {
    console.log(`  … démarrage de next start sur le port ${LOCAL_PORT}`);
    // ⚠ On lance le binaire Next PAR NODE, jamais via `npx`. Sous Windows,
    // `spawn` sur un fichier `.cmd` échoue en `EINVAL` depuis Node 20 — le
    // même piège que pour esbuild dans `scripts/test-journey.js`.
    server = spawn(
      process.execPath,
      [require.resolve('next/dist/bin/next'), 'start', '-p', String(LOCAL_PORT)],
      { cwd: process.cwd(), stdio: 'ignore', detached: process.platform !== 'win32' }
    );
    await waitForPort(LOCAL_PORT);
    console.log('  … serveur prêt');
  }

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    viewport: { width: 400, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/fr`, { waitUntil: 'load', timeout: 60000 });

    // ── 1. Le service worker s'installe et prend la main ───────────────────
    const swReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      return reg ? 'ready' : 'none';
    });
    ok('le service worker est enregistré et actif', swReady === 'ready', `obtenu : ${swReady}`);
    await page.waitForTimeout(2500);
    ok(
      'il contrôle bien la page',
      await page.evaluate(() => Boolean(navigator.serviceWorker.controller))
    );

    // ── 2. La page de repli est DANS le cache, et UTILISABLE ───────────────
    const cached = await page.evaluate(async () => {
      for (const name of await caches.keys()) {
        const hit = await (await caches.open(name)).match('/offline.html');
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
      return { names: await caches.keys() };
    });

    ok(
      'la page de repli est pré-cachée',
      Boolean(cached.status),
      cached.status ? '' : `caches présents : ${JSON.stringify(cached.names)}`
    );
    if (cached.status) {
      ok('sous le cache du worker', /laboelallali-v\d+/.test(cached.name), cached.name);
      ok('avec un statut 200', cached.status === 200, String(cached.status));
      ok('contenant le texte français', (cached.text || '').includes('hors connexion'));
      ok('et le texte arabe', (cached.text || '').includes('غير متصل'));
      ok('portant le numéro du laboratoire', (cached.text || '').includes('0528843384'));
      // LE point qui bloquait : une réponse marquée « redirigée » ne peut pas
      // répondre à une navigation, même présente dans le cache.
      ok(
        'PAS marquée « redirigée » — sinon inutilisable pour une navigation',
        cached.redirected === false,
        `redirected=${cached.redirected}, url=${cached.url}`
      );
    }

    // ── 3. La vraie coupure, seulement en mode --local ─────────────────────
    if (LOCAL) {
      console.log('  … arrêt du serveur');
      await killTree(server);
      server = null;

      const stillUp = await page
        .evaluate(async (base) => {
          try {
            await fetch(`${base}/sonde-${Date.now()}`, { cache: 'no-store' });
            return true;
          } catch {
            return false;
          }
        }, BASE)
        .catch(() => false);
      ok(
        'le serveur est réellement tombé',
        stillUp === false,
        'sinon la suite ne teste RIEN — c’est le piège de la première version'
      );

      // ⚠ Vers une adresse JAMAIS visitée. Le worker sert les navigations en
      // « réseau d'abord, puis cache » : une page déjà vue s'affiche hors
      // connexion depuis le cache — bon comportement, mais qui ne teste pas le
      // repli. Seule une adresse inconnue l'atteint.
      let body = '';
      try {
        await page.goto(`${BASE}/fr/page-jamais-visitee-${Date.now()}`, {
          waitUntil: 'load',
          timeout: 30000,
        });
        body = await page.evaluate(() => document.body.innerText || '');
      } catch (err) {
        body = `ÉCHEC DE NAVIGATION : ${String(err).slice(0, 300)}`;
      }

      ok(
        'réseau coupé : la page de repli s’affiche',
        body.includes('hors connexion') || body.includes('غير متصل'),
        body.slice(0, 300).replace(/\s+/g, ' ')
      );
      ok(
        'avec le numéro du laboratoire',
        body.includes('05 28 84 33 84') || body.includes('0528843384'),
        body.slice(0, 200).replace(/\s+/g, ' ')
      );
    } else {
      console.log(
        '\n  ⚠ Coupure réseau NON testée dans ce mode : ni setOffline ni CDP\n' +
          '    n’atteignent les requêtes du service worker. Lancer\n' +
          '    `npm run test:pwa:offline:local` pour l’exercer pour de vrai.'
      );
    }
  } finally {
    await browser.close();
    if (server) await killTree(server);
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
