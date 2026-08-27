/**
 * Capture des screenshots frais du site en production (vue mobile), FR et AR,
 * pour le template service-app. À relancer quand l'app évolue.
 * Usage : node marketing/scripts/capture-app.js
 */
const path = require("path");
const { chromium } = require("playwright");

const OUT = path.resolve(__dirname, "..", "assets", "screenshots");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  // Les sollicitations (invite Google, bannière d'installation iOS) se rappellent
  // d'avoir été fermées via localStorage : on pré-remplit ces clés pour qu'elles
  // ne recouvrent pas la capture. Voir src/components/features/auth/GoogleSignInPrompt.tsx
  await page.addInitScript(() => {
    try {
      localStorage.setItem("googleSignInPromptDismissedAt", String(Date.now()));
      localStorage.setItem("iosInstallBannerDismissed", "1");
    } catch {}
  });

  for (const lang of ["fr", "ar"]) {
    const url = `https://www.laboelallali.com/${lang}`;
    console.log(`Capture ${url} ...`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500); // laisser hydrater (widget ouvert/fermé, bannières)
    const file = path.join(OUT, `mobile-home-${lang}.png`);
    await page.screenshot({ path: file });
    console.log(`OK  ${file}`);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
