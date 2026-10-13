/**
 * Verifie le QR « Scannez-moi » TEL QU'IL EST IMPRIME sur chaque support.
 *
 *   node marketing/scripts/verifier-qr.js
 *
 * Un QR est la seule chose d'un imprime qu'aucune relecture humaine ne
 * valide : il est juste ou faux, et on s'en apercoit apres le tirage.
 *
 * Pour chaque support, le script :
 *   1. rend la page a 300 dpi dans Chromium ;
 *   2. RETROUVE LUI-MEME le QR dans la page (l'image dont la source est le
 *      QR « Scannez-moi ») — plus de coordonnees recopiees a la main, qui
 *      devenaient fausses des que la mise en page bougeait ;
 *   3. redemande a la bibliotheque la matrice attendue pour l'adresse et
 *      la compare, au CENTRE de chaque module, a l'image rendue ;
 *   4. controle les regles du referentiel : 20 mm minimum, modules francs
 *      (ni gris ni bave), fond clair autour.
 *
 * Code de sortie 1 au moindre ecart : a lancer avant tout envoi a
 * l'imprimeur.
 */
const path = require("path");
const { pathToFileURL } = require("url");
const sharp = require("sharp");
const QRCode = require("qrcode");
const { chromium } = require("playwright");

const URL_QR = "https://laboelallali.com/qr";
const ROOT = path.resolve(__dirname, "..");
const DPI = 300;
const PX_MM = DPI / 25.4;

// support, fichier, variante, dimensions du canevas en mm
const SUPPORTS = [
  ["Carte de visite, recto", "imprimerie/carte-visite.html", "?face=fr", 91, 61],
  ["Carte de visite numerique", "imprimerie/carte-visite.html", "?num=1&face=fr", 85, 55],
  ["Enveloppe C5, quadri", "imprimerie/enveloppe-c5.html", "", 229, 162],
  ["Enveloppe C5, 1 couleur", "imprimerie/enveloppe-c5.html", "?ton=mono", 229, 162],
  ["Papier a en-tete A4", "imprimerie/papier-entete.html", "", 216, 303],
  ["Bloc-notes, quadri", "imprimerie/bloc-notes.html", "", 90, 90],
  ["Bloc-notes, 1 couleur", "imprimerie/bloc-notes.html", "?ton=mono", 90, 90],
  ["Affiche « Resultats »", "affiches/affiche-resultats.html", "", 210, 297],
];

(async () => {
  const attendu = QRCode.create(URL_QR, { errorCorrectionLevel: "Q" });
  const n = attendu.modules.size;
  const bits = attendu.modules.data;
  const browser = await chromium.launch();
  let echecs = 0;

  console.log("Adresse attendue : " + URL_QR + " (niveau Q, " + n + " x " + n + " modules)\n");

  for (const [nom, fichier, query, w, h] of SUPPORTS) {
    const page = await browser.newPage({
      viewport: { width: Math.round((w * 96) / 25.4), height: Math.round((h * 96) / 25.4) },
      deviceScaleFactor: DPI / 96,
    });
    await page.goto(pathToFileURL(path.join(ROOT, fichier)).href + query, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
    });

    const boites = await page.evaluate(() =>
      [...document.images]
        .filter((i) => i.getAttribute("src").includes("qr-scannez-moi"))
        .map((i) => { const r = i.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; })
    );
    if (!boites.length) {
      console.log("ECHEC  " + nom + " — aucun QR « Scannez-moi » dans la page\n");
      echecs++; await page.close(); continue;
    }

    const png = await page.screenshot({ fullPage: true });
    await page.close();
    const { data, info } = await sharp(png).flatten({ background: "#fff" }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const lum = (x, y) => data[Math.round(y) * info.width + Math.round(x)];
    const echelle = DPI / 96;

    for (const b of boites) {
      // La boite contient n + 2 modules (marge d'un module dans nos gabarits).
      const tailleMm = (b.w * 25.4) / 96;
      const modPx = (b.w * echelle) / (n + 2);
      const x0 = b.x * echelle + modPx, y0 = b.y * echelle + modPx;
      let faux = 0, flous = 0;
      for (let l = 0; l < n; l++) for (let c = 0; c < n; c++) {
        const v = lum(x0 + (c + 0.5) * modPx, y0 + (l + 0.5) * modPx);
        if ((v < 128) !== !!bits[l * n + c]) faux++;
        if (v > 70 && v < 190) flous++;
      }
      // Fond autour : on echantillonne une couronne a 1 module a l'exterieur.
      let fonce = 0, total = 0;
      const bx = b.x * echelle, by = b.y * echelle, bw = b.w * echelle;
      for (let k = 0; k <= 40; k++) {
        for (const [px, py] of [[bx - modPx * 0.5, by + (bw * k) / 40], [bx + bw + modPx * 0.5, by + (bw * k) / 40],
                                 [bx + (bw * k) / 40, by - modPx * 0.5], [bx + (bw * k) / 40, by + bw + modPx * 0.5]]) {
          if (px < 0 || py < 0 || px >= info.width || py >= info.height) continue;
          total++; if (lum(px, py) < 200) fonce++;
        }
      }
      const modMm = tailleMm / (n + 2);
      const ok = faux === 0 && flous === 0 && tailleMm >= 19.95 && fonce === 0;
      if (!ok) echecs++;
      console.log((ok ? "OK     " : "ECHEC  ") + nom);
      console.log("       " + tailleMm.toFixed(1) + " mm" + (tailleMm < 19.95 ? " (SOUS LE MINIMUM DE 20 mm)" : "") +
        " · " + modMm.toFixed(2) + " mm par module · " +
        (faux ? faux + " modules faux" : "les " + n * n + " modules concordent") +
        (flous ? " · " + flous + " modules gris" : "") +
        (fonce ? " · fond NON blanc autour (" + fonce + "/" + total + ")" : " · fond blanc autour") + "\n");
    }
  }

  await browser.close();
  console.log(echecs ? echecs + " ECHEC(S) — ne pas envoyer a l'imprimeur." : "Tous les QR sont conformes.");
  if (echecs) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
