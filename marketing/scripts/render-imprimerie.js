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
// N.B. 3 mm de fond perdu est l'usage dominant, pas une norme : ni ISO ni
// PDF/X ne prescrivent de valeur. Compter 5 mm en grand format. Toujours
// doubler d'une zone tranquille (pas de texte a moins de 3-5 mm de la coupe).
//
// `variantes` (optionnel) permet de tirer plusieurs sorties d'un meme HTML :
// la `query` est passee dans l'URL, le fichier lit `location.search` et se
// met en forme en consequence. Sans `variantes`, une seule sortie est rendue.
const FORMATS = {
  "papier-entete.html": { w: 216, h: 303, fini: "A4 210 × 297 mm", fp: 3 },
  // Planche technique : pas de fond perdu, elle s'imprime telle quelle a 100 %.
  "plan-fenetre-enveloppe.html": { w: 297, h: 210, fini: "A4 paysage 297 × 210 mm", fp: 0 },
  // Bloc-notes carre. Pas de fond perdu : il est encolle en tete, les
  // premiers millimetres passent sous la colle et sous le carton de dos.
  //
  // La QUADRI est la version a tirer. La plaque et le calage d'une couleur
  // supplementaire sont un cout FIXE : ils pesent sur une petite serie et se
  // diluent sur un gros tirage. Un bloc partant par milliers, la quantite est
  // precisement ce qui rend la quadri abordable — et non l'inverse, comme
  // l'affirmait une premiere version de ce commentaire.
  "bloc-notes.html": {
    w: 90, h: 90, fini: "90 × 90 mm", fp: 0,
    variantes: [
      { suffixe: "", query: "", note: "quadri, dégradé — À TIRER" },
      { suffixe: "-mono", query: "?ton=mono", note: "offset 1 couleur, bordeaux — repli" },
    ],
  },
  // Carte de visite, ligne 55 du devis. Le PDF de l'imprimeur porte les DEUX
  // faces en 2 pages, fond perdu compris. La version « numerique » (sans fond
  // perdu, 85 x 55) est celle que l'application reutilise pour la carte
  // telechargeable (ligne 63) : un bandeau a fond perdu y deborderait.
  "carte-visite.html": {
    w: 91, h: 61, fini: "85 × 55 mm recto-verso", fp: 3,
    variantes: [
      { suffixe: "", query: "", note: "recto + verso, 2 pages — À IMPRIMER", pngNon: true },
      { suffixe: "-recto", query: "?face=fr", note: "recto, français", pdfNon: true },
      { suffixe: "-verso", query: "?face=ar", note: "verso, arabe", pdfNon: true },
      { suffixe: "-numerique", query: "?num=1", w: 85, h: 55, note: "sans fond perdu, 2 pages — application", pngNon: true },
      { suffixe: "-numerique-recto", query: "?num=1&face=fr", w: 85, h: 55, pdfNon: true },
      { suffixe: "-numerique-verso", query: "?num=1&face=ar", w: 85, h: 55, pdfNon: true },
    ],
  },
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
      // Une variante peut avoir son propre format (carte numerique sans fond perdu).
      const W = v.w || fmt.w, H = v.h || fmt.h;
      await page.setViewportSize({ width: cssPx(W), height: cssPx(H) });
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
        //
        // Chromium arrondit la taille de la PAGE au pixel CSS superieur
        // (216 mm = 816,38 px -> page de 817 px) mais pas le contenu, fixe en
        // mm : il restait une bande blanche de 0,2 a 0,4 mm a droite et en
        // bas de chaque PDF (mesuree par verifier-bords-pdf.js), alors que
        // l'apercu PNG etait juste. En impression, html et body epousent
        // donc la page : les aplats ancres a droite et en bas touchent le bord.
        await page.addStyleTag({
          content: "@media print { html, body { width: 100% !important; height: 100% !important; } }",
        });
        await page.pdf({
          path: path.join(OUT, `${nom}.pdf`),
          width: `${W}mm`,
          height: `${H}mm`,
          printBackground: true,
          margin: { top: "0", right: "0", bottom: "0", left: "0" },
          preferCSSPageSize: false,
        });
        console.log(
          `OK  ${nom}.pdf  ${W}×${H} mm (fini ${fmt.fini}, fond perdu ${fmt.fp} mm)` +
            (v.note ? ` — ${v.note}` : "")
        );
      }

      // PNG : apercu 300 dpi (sauf variantes multipages, sans sens en image).
      if (!v.pngNon) {
        await page.screenshot({
          path: path.join(OUT, `${nom}.png`),
          clip: { x: 0, y: 0, width: cssPx(W), height: cssPx(H) },
        });
        console.log(`OK  ${nom}.png  ${Math.round((W / MM_PER_IN) * DPI)}×${Math.round((H / MM_PER_IN) * DPI)} px @${DPI} dpi`);
      }
    }

    await page.close();
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
