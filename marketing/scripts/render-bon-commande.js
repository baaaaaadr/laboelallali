/**
 * Rend les documents comptables de marketing/docs/*.html en PDF A4 + PNG.
 *
 * Usage : node marketing/scripts/render-bon-commande.js
 *
 * Contrairement a render-imprimerie.js (un canevas unique aux dimensions
 * reelles du support), ces documents sont multipages : chaque bloc .page
 * fait 210 x 297 mm et porte un break-after:page. On rend donc en format
 * A4 sans marge, en laissant Chromium paginer.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "docs");
const OUT = path.join(ROOT, "output", "compta");

// Documents a rendre. `apercus` = nombre de PNG de controle (1 par page).
const DOCS = {
  "bon-commande-02.html": { pages: 2, note: "bon de commande complementaire + annexe" },
};

const A4 = { w: 210, h: 297 };
const MM_PER_IN = 25.4;
const DPI = 150; // suffisant pour une relecture a l'ecran

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const [file, meta] of Object.entries(DOCS)) {
    const src = path.join(DIR, file);
    if (!fs.existsSync(src)) {
      console.warn(`SKIP ${file} — introuvable dans ${DIR}`);
      continue;
    }

    const cssPx = (mm) => Math.round((mm * 96) / MM_PER_IN);
    const page = await browser.newPage({
      viewport: { width: cssPx(A4.w), height: cssPx(A4.h) },
      deviceScaleFactor: DPI / 96,
    });

    await page.goto(pathToFileURL(src).href, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const base = file.replace(".html", "");

    await page.pdf({
      path: path.join(OUT, `${base}.pdf`),
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
    });
    console.log(`OK  ${base}.pdf  A4 (${meta.pages} pages attendues) — ${meta.note}`);

    // PNG de controle, une par bloc .page, media print pour voir le rendu final.
    await page.emulateMedia({ media: "print" });
    const blocs = await page.locator(".page").all();
    for (let i = 0; i < blocs.length; i++) {
      const out = path.join(OUT, `${base}-p${i + 1}.png`);
      await blocs[i].screenshot({ path: out });
      console.log(`OK  ${base}-p${i + 1}.png`);
    }

    await page.close();
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
