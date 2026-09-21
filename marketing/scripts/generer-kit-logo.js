/**
 * Produit le kit logo complet, dans tous les formats dont un prestataire
 * peut avoir besoin — imprimeur comme developpeur.
 *
 *   node marketing/scripts/generer-kit-logo.js
 *
 * Source : marketing/assets/logos/*.svg, eux-memes extraits du fichier
 * Illustrator d'origine par extract-logo-svg.js. Tout se regenere donc si
 * le logo evolue.
 *
 * Formats produits pour chaque declinaison :
 *   .svg   vectoriel — le meilleur choix partout ou il est accepte
 *   .pdf   vectoriel — ce que demandent la plupart des imprimeurs
 *   .png   512 px    — usage courant a l'ecran
 *   .png   2048 px   — grand format, presentations, impression de secours
 *
 * Les PNG ont un fond TRANSPARENT, sauf la variante « claire » et la
 * variante « plein », qui portent leur propre fond par construction.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "assets", "logos");
const OUT = path.join(ROOT, "output", "kit-logo");

// Taille physique du PDF, en mm. Le carre est genereux pour rester net a
// l'agrandissement ; le « L » seul garde ses proportions (493 x 695).
const PDF_MM = 60;

const DECLINAISONS = [
  { f: "logo-icone-degrade", nom: "Icone degrade", carre: true },
  { f: "logo-icone-claire", nom: "Icone claire", carre: true },
  { f: "logo-icone-bordeaux", nom: "Icone 1 couleur", carre: true },
  { f: "logo-icone-blanc", nom: "Logo tout blanc", carre: true },
  { f: "logo-plein-degrade", nom: "Bord franc", carre: true },
  { f: "logo-l-degrade", nom: "Le L seul, degrade", carre: false },
  { f: "logo-l-bordeaux", nom: "Le L seul, bordeaux", carre: false },
  { f: "logo-l-blanc", nom: "Le L seul, blanc", carre: false },
];

const ko = (o) => (o / 1024).toFixed(1) + " Ko";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log("fichier                          svg      pdf      512px    2048px");
  console.log("-".repeat(72));

  for (const d of DECLINAISONS) {
    const svgPath = path.join(SRC, d.f + ".svg");
    if (!fs.existsSync(svgPath)) {
      console.warn("SKIP " + d.f + " — source absente");
      continue;
    }
    const svg = fs.readFileSync(svgPath, "utf8");

    // 1. le SVG, recopie tel quel
    fs.copyFileSync(svgPath, path.join(OUT, d.f + ".svg"));

    // 2. le PDF vectoriel, aux dimensions physiques reelles
    const vb = svg.match(/viewBox="([\d.\s-]+)"/)[1].trim().split(/\s+/).map(Number);
    const rapport = vb[3] / vb[2];
    const largeurMm = PDF_MM;
    const hauteurMm = +(PDF_MM * rapport).toFixed(2);
    await page.setContent(
      '<style>html,body{margin:0;padding:0}svg{display:block;width:' + largeurMm +
      "mm;height:" + hauteurMm + 'mm}</style>' + svg
    );
    const pdf = path.join(OUT, d.f + ".pdf");
    await page.pdf({
      path: pdf,
      width: largeurMm + "mm",
      height: hauteurMm + "mm",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    // 3. les PNG, fond transparent
    const tailles = {};
    for (const px of [512, 2048]) {
      const dest = path.join(OUT, d.f + "-" + px + ".png");
      await sharp(Buffer.from(svg), { density: Math.ceil((96 * px) / vb[2]) * 4 })
        .resize(px, Math.round(px * rapport), {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9, effort: 10, palette: false })
        .toFile(dest);
      tailles[px] = fs.statSync(dest).size;
    }

    console.log(
      d.f.padEnd(30) +
        ko(fs.statSync(svgPath).size).padStart(8) +
        ko(fs.statSync(pdf).size).padStart(9) +
        ko(tailles[512]).padStart(9) +
        ko(tailles[2048]).padStart(9)
    );
  }

  await browser.close();
  const n = fs.readdirSync(OUT).length;
  console.log("\n" + n + " fichiers dans " + path.relative(path.resolve(ROOT, ".."), OUT));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
