/**
 * Le QR code unique du laboratoire — page « Scannez-moi ».
 *
 *   node marketing/scripts/generer-kit-qr.js
 *
 * Decision de Dr Aziz (12/10/2026) : UN seul QR sur tous les supports
 * imprimes. Il ouvre https://laboelallali.com/qr, une page de l'application
 * (resultats, contact, itineraire, rendez-vous, carte de visite...). L'adresse
 * est definitive : la page peut changer sans rien reimprimer.
 *
 * Deux familles de fichiers, qui ne different que par la zone de silence :
 *
 *  1. marketing/assets/qr/  — utilises PAR NOS MISES EN PAGE. Marge d'un
 *     module : chaque gabarit laisse lui-meme du blanc autour du code (la
 *     regle du referentiel), le compter deux fois retrecirait les modules.
 *
 *  2. marketing/output/kit-qr/  — remis TELS QUELS a un prestataire, qui le
 *     posera ou il voudra. On ne controle plus son entourage : la zone de
 *     silence normalisee (4 modules) est donc DANS le fichier.
 *
 * Niveau de correction Q (~25 %). Il donne la meme version que M pour cette
 * adresse (version 3, 29 x 29 modules) : la robustesse en plus est gratuite.
 * Utile sur une enveloppe manipulee ou une affiche plastifiee qui reflete.
 *
 * Regles d'impression (referentiel, chap. 07) : 20 mm minimum, bordeaux ou
 * noir sur fond BLANC, jamais inverse (clair sur fonce), marge blanche.
 */
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const sharp = require("sharp");
const { chromium } = require("playwright");

const URL_QR = "https://laboelallali.com/qr";
const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "assets", "qr");
const KIT = path.join(ROOT, "output", "kit-qr");

const TEINTES = { noir: "#000000", bordeaux: "#800020" };
const PDF_MM = 30; // taille physique du PDF du kit, zone de silence comprise

async function svg(couleur, marge) {
  const brut = await QRCode.toString(URL_QR, {
    type: "svg",
    errorCorrectionLevel: "Q",
    margin: marge,
    color: { dark: couleur, light: "#FFFFFF" },
  });
  return brut
    .replace(/ width="[^"]*"/, "")
    .replace(/ height="[^"]*"/, "")
    .replace("<svg ", '<svg width="100%" height="100%" ');
}

const ko = (f) => (fs.statSync(f).size / 1024).toFixed(1) + " Ko";

(async () => {
  fs.mkdirSync(ASSETS, { recursive: true });
  fs.mkdirSync(KIT, { recursive: true });

  const q = QRCode.create(URL_QR, { errorCorrectionLevel: "Q" });
  console.log(URL_QR + "  ->  version " + q.version + ", " + q.modules.size + " x " + q.modules.size + " modules\n");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const [nom, couleur] of Object.entries(TEINTES)) {
    // 1. pour nos gabarits
    const a = path.join(ASSETS, "qr-scannez-moi-" + nom + ".svg");
    fs.writeFileSync(a, await svg(couleur, 1));

    // 2. le kit prestataire
    const s = await svg(couleur, 4);
    const fSvg = path.join(KIT, "qr-scannez-moi-" + nom + ".svg");
    fs.writeFileSync(fSvg, s);

    const fPng = path.join(KIT, "qr-scannez-moi-" + nom + "-2048.png");
    await sharp(Buffer.from(s), { density: 2400 })
      .resize(2048, 2048, { kernel: "nearest" }) // damier : aucun gris interpole
      .png({ compressionLevel: 9, palette: true, colours: 2 })
      .toFile(fPng);

    const fPdf = path.join(KIT, "qr-scannez-moi-" + nom + ".pdf");
    await page.setContent(
      "<style>html,body{margin:0}svg{display:block;width:" + PDF_MM + "mm;height:" + PDF_MM + "mm}</style>" + s
    );
    await page.pdf({
      path: fPdf, width: PDF_MM + "mm", height: PDF_MM + "mm",
      printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    console.log(nom.padEnd(9) + "svg " + ko(fSvg).padStart(7) + "   png 2048 " + ko(fPng).padStart(7) + "   pdf " + PDF_MM + " mm " + ko(fPdf).padStart(7));
  }

  await browser.close();
  console.log("\nGabarits : " + path.relative(path.resolve(ROOT, ".."), ASSETS));
  console.log("Kit      : " + path.relative(path.resolve(ROOT, ".."), KIT));
})().catch((e) => { console.error(e); process.exit(1); });
