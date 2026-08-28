/**
 * Rend les supports imprimes de marketing/imprimerie/*.html en deux formats :
 *   - PDF vectoriel aux dimensions reelles (ce qu'on envoie a l'imprimeur)
 *   - PNG 300 dpi (apercu pour validation par Dr Aziz)
 *
 * Usage : node marketing/scripts/render-imprimerie.js
 *
 * Chaque HTML declare ses dimensions de canevas (fond perdu compris) dans
 * FORMATS ci-dessous. Le PDF est genere a ces dimensions exactes : l'imprimeur
 * rogne ensuite au format fini en suivant le fond perdu.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "imprimerie");
const OUT = path.join(ROOT, "output", "imprimerie");

// Dimensions du canevas en mm, fond perdu inclus.
//
// `variantes` (optionnel) permet de tirer plusieurs sorties d'un meme HTML :
// la `query` est passee dans l'URL, le fichier lit `location.search` et se
// met en forme en consequence. Sans `variantes`, une seule sortie est rendue.
const FORMATS = {
  "papier-entete.html": { w: 216, h: 303, fini: "A4 210 × 297 mm", fp: 3 },
  // Planche technique : pas de fond perdu, elle s'imprime telle quelle a 100 %.
  "plan-fenetre-enveloppe.html": { w: 297, h: 210, fini: "A4 paysage 297 × 210 mm", fp: 0 },
  "enveloppe-c5.html": {
    w: 229, h: 162, fini: "C5 229 × 162 mm", fp: 0,
    variantes: [
      { suffixe: "", query: "", note: "quadri, degrade" },
      { suffixe: "-mono", query: "?ton=mono", note: "offset 1 couleur, bordeaux" },
      // Controle visuel : la fenetre est tracee. Apercu seulement, pas de PDF —
      // ce trace ne doit jamais partir a l'impression.
      { suffixe: "-controle", query: "?reperes=1", note: "apercu avec la fenetre", pdfNon: true },
    ],
  },
};

const MM_PER_IN = 25.4;
const DPI = 300;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".html"))) {
    const fmt = FORMATS[file];
    if (!fmt) {
      console.warn(`SKIP ${file} — format non declare dans FORMATS`);
      continue;
    }

    // Viewport en px CSS : 1 mm = 96/25.4 px. deviceScaleFactor porte le PNG a 300 dpi.
    const cssPx = (mm) => Math.round((mm * 96) / MM_PER_IN);
    const scale = DPI / 96;
    const page = await browser.newPage({
      viewport: { width: cssPx(fmt.w), height: cssPx(fmt.h) },
      deviceScaleFactor: scale,
    });

    const base = file.replace(".html", "");
    const url = pathToFileURL(path.join(DIR, file)).href;
    const pxW = Math.round((fmt.w / MM_PER_IN) * DPI);
    const pxH = Math.round((fmt.h / MM_PER_IN) * DPI);

    for (const v of fmt.variantes || [{ suffixe: "", query: "" }]) {
      await page.goto(url + v.query, { waitUntil: "load" });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          Array.from(document.images).map((i) => (i.decode ? i.decode().catch(() => {}) : null))
        );
      });

      const nom = base + v.suffixe;

      if (!v.pdfNon) {
        // PDF : vectoriel, aux dimensions exactes du canevas.
        await page.pdf({
          path: path.join(OUT, `${nom}.pdf`),
          width: `${fmt.w}mm`,
          height: `${fmt.h}mm`,
          printBackground: true,
          margin: { top: "0", right: "0", bottom: "0", left: "0" },
          preferCSSPageSize: false,
        });
        console.log(
          `OK  ${nom}.pdf  ${fmt.w}×${fmt.h} mm (fini ${fmt.fini}, fond perdu ${fmt.fp} mm)` +
            (v.note ? ` — ${v.note}` : "")
        );
      }

      // PNG : apercu 300 dpi.
      await page.screenshot({
        path: path.join(OUT, `${nom}.png`),
        clip: { x: 0, y: 0, width: cssPx(fmt.w), height: cssPx(fmt.h) },
      });
      console.log(`OK  ${nom}.png  ${pxW}×${pxH} px @${DPI} dpi`);
    }

    await page.close();
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
