/**
 * Assemble le dossier de livraison remis au laboratoire :
 * les documents en PDF (mise en page conservée) et les images rangées par dossier.
 * Le dossier obtenu se dépose tel quel dans Google Drive.
 * Usage : node marketing/scripts/build-livraison.js
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "livraison");

const DOCS = [
  { src: "guide-publication.html", nom: "1 - Guide de publication.pdf" },
  { src: "strategie-2026.html", nom: "2 - Strategie de communication.pdf" },
  { src: "todo-labo.html", nom: "3 - Actions a mener au laboratoire.pdf" },
  { src: "reponses-whatsapp.html", nom: "4 - Reponses WhatsApp.pdf" },
  { src: "programme-editorial.html", nom: "5 - Programme editorial jusqu'en juillet 2027.pdf" },
];

// Les affiches relèvent de l'option A, non validée : elles ne sont incluses
// que si on le demande explicitement (--avec-affiches).
const avecAffiches = process.argv.includes("--avec-affiches");

const COPIES = [
  { from: path.join(ROOT, "output", "2026-09"), to: "Images des publications", filtre: (f) => f.endsWith(".png") },
  { from: path.join(ROOT, "output", "modeles-vierges"), to: "Modeles vierges", filtre: (f) => f.endsWith(".png") },
  ...(avecAffiches
    ? [{ from: path.join(ROOT, "output", "affiches"), to: "Affiches pour l'accueil", filtre: (f) => f.endsWith(".png") }]
    : []),
];

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const doc of DOCS) {
    const src = path.join(ROOT, "docs", doc.src);
    if (!fs.existsSync(src)) {
      console.warn(`ATTENTION : ${doc.src} introuvable, ignoré`);
      continue;
    }
    // forcer le thème clair : le PDF est destiné à l'impression
    await page.emulateMedia({ colorScheme: "light", media: "print" });
    await page.goto(pathToFileURL(src).href, { waitUntil: "networkidle" });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.pdf({
      path: path.join(OUT, doc.nom),
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });
    console.log(`PDF  ${doc.nom}`);
  }
  await browser.close();

  for (const c of COPIES) {
    if (!fs.existsSync(c.from)) {
      console.warn(`ATTENTION : ${c.from} introuvable, ignoré`);
      continue;
    }
    const dest = path.join(OUT, c.to);
    fs.mkdirSync(dest, { recursive: true });
    const fichiers = fs.readdirSync(c.from).filter(c.filtre);
    fichiers.forEach((f) => fs.copyFileSync(path.join(c.from, f), path.join(dest, f)));
    console.log(`IMG  ${c.to} — ${fichiers.length} fichier(s)`);
  }

  const total = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? total(path.join(dir, e.name)) : 1), 0);
  const poids = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).reduce(
      (n, e) => n + (e.isDirectory() ? poids(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size),
      0
    );
  console.log(`\nDossier prêt : ${path.relative(path.resolve(ROOT, ".."), OUT)}`);
  console.log(`${total(OUT)} fichiers, ${(poids(OUT) / 1024 / 1024).toFixed(1)} Mo`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
