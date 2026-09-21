/**
 * Éprouve `src/lib/pwa/platform.ts` sur les agents de `scripts/pwa-cases.ts`.
 *
 * Écrit son résultat en JSON sur la sortie standard : c'est
 * `scripts/test-pwa.js` qui le lit et met en forme. Le partage du même cadre
 * d'affichage évite d'avoir deux formats de rapport pour un seul banc.
 */
import { detectPlatform, isInAppBrowser } from '../../src/lib/pwa/platform';
import { PLATFORM_CASES } from '../pwa-cases';

const results = PLATFORM_CASES.map((c) => {
  const platform = detectPlatform(c.userAgent, c.maxTouchPoints);
  const inApp = isInAppBrowser(c.userAgent);
  return {
    name: c.name,
    why: c.why,
    platform,
    inApp,
    expectPlatform: c.expectPlatform,
    expectInApp: c.expectInApp,
    platformOk: platform === c.expectPlatform,
    inAppOk: inApp === c.expectInApp,
  };
});

process.stdout.write(JSON.stringify(results));
