// Service Worker for LaboElAllali PWA
const CACHE_NAME = 'laboelallali-v6';
const OFFLINE_PAGE = '/offline.html';

// Install event - pre-cache the offline fallback, then take over immediately.
//
// ⚠ Le commentaire disait « cache the application shell », mais RIEN n'était
// mis en cache : `waitUntil(self.skipWaiting())` ne fait qu'activer le worker.
// Le repli hors connexion plus bas cherchait donc une page qui n'était jamais
// arrivée dans le cache — et qui, en plus, n'existait pas sur le serveur
// (`/offline.html` répondait 307 puis 404 en production, vérifié le
// 21/09/2026). Le patient sans réseau ne voyait que la page d'erreur du
// navigateur.
//
// ⚠ PAS de `cache.add()`, et ce n'est pas un détail. Firebase Hosting sert
// l'application avec des « URL propres » : `/offline.html` répond 301 vers
// `/offline` (vérifié en production le 21/09/2026). `cache.add` range alors
// bien la page — mais la réponse rangée porte le drapeau `redirected`, et une
// réponse marquée ainsi NE PEUT PAS répondre à une navigation : Chrome la
// refuse (« a redirected response was used for a request whose redirect mode
// is not follow »). Mesuré : réseau coupé, le patient obtenait « 404 This page
// could not be found » au lieu de la page de repli.
//
// On récupère donc la réponse nous-mêmes et on la RECONSTRUIT avant de la
// ranger : une `Response` neuve ne porte plus ce drapeau. La clé reste
// `/offline.html`, celle que cherche le repli de navigation plus bas.
//
// ⚠ Ne pas coder `/offline` en dur à la place : ce chemin n'existe que
// derrière Firebase Hosting. En développement (`next dev`), seul
// `/offline.html` répond.
//
// ⚠ Un échec de pré-cache ne doit JAMAIS empêcher l'installation du worker :
// sans le `.catch`, une coupure réseau au mauvais moment laisserait la PWA
// sans service worker du tout.
async function precacheOfflinePage() {
  const response = await fetch(OFFLINE_PAGE, { cache: 'reload', redirect: 'follow' });
  if (!response.ok) throw new Error('offline page HTTP ' + response.status);
  const body = await response.blob();
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    OFFLINE_PAGE,
    new Response(body, {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  );
}

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    precacheOfflinePage()
      .catch((error) => {
        console.warn('Service Worker: offline page not pre-cached', error);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('Service Worker: Removing old cache', name);
            return caches.delete(name);
          })
      ).then(() => self.clients.claim());
    })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and cross-origin requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip chrome-extension and dev tools
  if (event.request.url.includes('chrome-extension://') ||
      event.request.url.includes('sockjs-node') ||
      event.request.url.includes('__webpack_hmr')) {
    return;
  }

  // Skip /_next/ chunks entirely — Next.js handles caching via HTTP Cache-Control headers.
  // Cache-first here causes hydration mismatches: the SW serves stale JS while the server
  // returns fresh HTML, creating server/client render divergence on full-page navigations.
  if (event.request.url.includes('/_next/')) {
    return;
  }

  // Skip Next.js App Router data requests (RSC payloads + route prefetches). These carry
  // an `RSC: 1` header and a `?_rsc=` query and MUST always hit the network: if the SW
  // serves them cache-first (the branch below), the client router gets a stale/mismatched
  // response and falls back to a FULL-PAGE RELOAD on soft navigations — e.g. the language
  // switch, which re-mounts the app and re-runs the results API. This only bit the INSTALLED
  // PWA (where the SW controls every request); a normal browser tab navigated instantly.
  if (
    event.request.headers.get('RSC') === '1' ||
    event.request.headers.get('Next-Router-Prefetch') === '1' ||
    event.request.url.includes('_rsc=')
  ) {
    return;
  }

  // For navigation requests, try network first, then cache, then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200 || response.status === 0) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then((response) => response || caches.match(OFFLINE_PAGE));
        })
    );
    return;
  }

  // For other static assets (images, fonts, etc.), cache first then network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).then((response) => {
        if (response && (response.status === 200 || response.status === 0)) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});
