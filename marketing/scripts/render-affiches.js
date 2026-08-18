/**
 * Génère les affiches A4 d'accueil (option A du devis) en PNG 2480×3508 (300 dpi).
 * 1. Génère les QR codes (package `qrcode` déjà présent à la racine du repo).
 * 2. Rend marketing/affiches/*.html via Playwright.
 * Usage : node marketing/scripts/render-affiches.js
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const QRCode = require("qrcode");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "affiches");
const OUT = path.join(ROOT, "output", "affiches");

const QRS = [
  { file: "qr-site.png", url: "https://www.laboelallali.com" },
  // Lien Maps du labo — à remplacer par le lien « demander des avis » exact du
  // tableau de bord Google Business Profile dès que Dr Aziz le fournit.
  { file: "qr-avis.png", url: "https://maps.app.goo.gl/NUiSsY2AQjeNHcDeA" },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const q of QRS) {
    await QRCode.toFile(path.join(DIR, q.file), q.url, {
      width: 1000,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#600018", light: "#FFFFFF" },
    });
    console.log(`OK  QR ${q.file} → ${q.url}`);
  }

  const browser = await chromium.launch();
  // 1240×1754 (A4 à 150 dpi) × deviceScaleFactor 2 = 2480×3508 px (300 dpi)
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 2 });
  for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith(".html"))) {
    await page.goto(pathToFileURL(path.join(DIR, f)).href, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
    });
    const out = path.join(OUT, f.replace(".html", ".png"));
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1240, height: 1754 } });
    console.log(`OK  ${path.relative(ROOT, out)} (2480×3508 @300dpi)`);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
