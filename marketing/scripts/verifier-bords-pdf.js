/**
 * Les aplats a fond perdu vont-ils VRAIMENT jusqu'au bord de la page PDF ?
 *
 *   node marketing/scripts/verifier-bords-pdf.js
 *
 * Pourquoi : un apercu PNG peut etre juste alors que le PDF ne l'est pas.
 * Chromium arrondit la taille de page du PDF au pixel CSS SUPERIEUR
 * (216 mm = 816,38 px -> page de 817 px = 216,2 mm) : le contenu, lui, garde
 * ses 216 mm. Il restait donc une bande blanche de 0,2 mm a droite et en bas
 * de chaque PDF — invisible apres massicotage dans le fond perdu, mais bien
 * visible a l'ecran, et un imprimeur pointilleux la signale.
 *
 * Methode : on fait rendre chaque PDF par pdf.js (le moteur de Firefox, deja
 * present dans node_modules) dans Chromium, a 300 dpi, puis on lit les
 * pixels de la derniere colonne et de la derniere ligne la ou un aplat a
 * fond perdu doit toucher le bord.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "marketing", "output", "imprimerie");
const PDFJS = pathToFileURL(path.join(ROOT, "node_modules", "pdfjs-dist", "build", "pdf.mjs")).href;
const WORKER = pathToFileURL(path.join(ROOT, "node_modules", "pdfjs-dist", "build", "pdf.worker.mjs")).href;

// fichier, page, ou un aplat doit toucher le bord droit (y en % de la hauteur),
// et le bord bas (x en %), null si rien n'y touche par construction.
const CAS = [
  ["papier-entete.pdf", 1, { droite: 1.2, bas: null }],
  ["carte-visite.pdf", 1, { droite: 1.5, bas: 50 }],
  ["carte-visite-v2.pdf", 1, { droite: 1.5, bas: null }],
  ["carte-visite.pdf", 2, { droite: null, bas: null }],
  ["carte-visite-numerique.pdf", 1, { droite: 1.0, bas: 50 }],
];

(async () => {
  // Les modules ES ne se chargent pas depuis file:// sans ce drapeau.
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(OUT, "papier-entete.png")).href); // une origine file://
  let echecs = 0;

  for (const [fichier, n, attendu] of CAS) {
    const b64 = fs.readFileSync(path.join(OUT, fichier)).toString("base64");
    const r = await page.evaluate(async ({ b64, n, PDFJS, WORKER, attendu }) => {
      const pdfjs = await import(PDFJS);
      pdfjs.GlobalWorkerOptions.workerSrc = WORKER;
      const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const doc = await pdfjs.getDocument({ data }).promise;
      const p = await doc.getPage(n);
      const vp = p.getViewport({ scale: 300 / 72 });
      const cv = document.createElement("canvas");
      cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const ctx = cv.getContext("2d");
      await p.render({ canvasContext: ctx, viewport: vp }).promise;
      const px = (x, y) => { const d = ctx.getImageData(x, y, 1, 1).data; return d[0] + d[1] + d[2]; };
      // largeur de blanc a droite, mesuree sur la ligne ou l'aplat doit toucher
      const blanc = (y, sens) => {
        let k = 0;
        if (sens === "droite") { for (let x = cv.width - 1; x >= 0 && px(x, y) > 740; x--) k++; }
        else { for (let yy = cv.height - 1; yy >= 0 && px(y, yy) > 740; yy--) k++; }
        return k;
      };
      const out = { pages: doc.numPages, w: cv.width, h: cv.height };
      if (attendu.droite != null) out.droite = blanc(Math.round(cv.height * attendu.droite / 100), "droite");
      if (attendu.bas != null) out.bas = blanc(Math.round(cv.width * attendu.bas / 100), "bas");
      return out;
    }, { b64, n, PDFJS, WORKER, attendu });

    const mm = (k) => (k / 300 * 25.4).toFixed(2) + " mm";
    const defauts = [];
    if (r.droite != null && r.droite > 1) defauts.push("blanc a droite " + mm(r.droite));
    if (r.bas != null && r.bas > 1) defauts.push("blanc en bas " + mm(r.bas));
    if (defauts.length) echecs++;
    console.log((defauts.length ? "ECHEC  " : "OK     ") + (fichier + " p." + n).padEnd(24) +
      (r.w / 300 * 25.4).toFixed(2) + " x " + (r.h / 300 * 25.4).toFixed(2) + " mm" +
      (defauts.length ? "  — " + defauts.join(", ") : (r.droite != null || r.bas != null ? "  — l'aplat touche le bord" : "")));
  }
  await browser.close();
  if (echecs) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
