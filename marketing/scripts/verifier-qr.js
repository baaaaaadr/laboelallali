/**
 * Verifie qu'un QR code REELLEMENT IMPRIME sur un support encode la bonne
 * adresse, et que chaque module sortira franc a l'impression.
 *
 *   node marketing/scripts/verifier-qr.js
 *
 * Pourquoi ce controle existe. Un QR est la seule chose sur un support
 * imprime qu'aucune relecture humaine ne peut valider : il est juste ou il
 * est faux, et on ne s'en apercoit qu'apres le tirage. Deux defauts
 * classiques, tous deux invisibles a l'oeil :
 *
 *   1. le code pointe vers la mauvaise adresse (fichier obsolete recopie
 *      d'un support precedent) ;
 *   2. les modules sont trop petits ou delaves — le code est « joli » mais
 *      aucun telephone ne l'accroche.
 *
 * La methode : on redemande a la bibliotheque la matrice attendue pour
 * l'URL voulue, on echantillonne l'image rendue au CENTRE de chaque module,
 * et on compare. Si les deux coincident, le fichier livre encode bien cette
 * URL — sans avoir besoin d'un decodeur.
 *
 * On mesure au passage la taille du module en millimetres. Reperes d'usage
 * pour un QR lu au telephone a bout de bras : 0,4 mm par module est un
 * plancher raisonnable, 0,5 mm confortable. En dessous de 0,3 mm, la trame
 * d'impression et la mise au point de l'appareil commencent a manger les
 * modules.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const QRCode = require("qrcode");

const ROOT = path.resolve(__dirname, "..");
const DPI = 300; // les apercus de render-imprimerie.js sont a 300 dpi

// Chaque entree decrit ou se trouve le QR sur le support, en mm, tel que la
// mise en page le pose. A tenir a jour si la mise en page bouge.
const CONTROLES = [
  {
    apercu: "output/imprimerie/bloc-notes-mono.png",
    support: "Bloc-notes 90 × 90 mm (1 couleur)",
    url: "https://www.laboelallali.com",
    x: 7, y: 68, taille: 15, largeurSupport: 90,
  },
  {
    apercu: "output/imprimerie/bloc-notes.png",
    support: "Bloc-notes 90 × 90 mm (quadri)",
    url: "https://www.laboelallali.com",
    x: 7, y: 68, taille: 15, largeurSupport: 90,
  },
];

(async () => {
  let echecs = 0;

  for (const c of CONTROLES) {
    const fichier = path.join(ROOT, c.apercu);
    if (!fs.existsSync(fichier)) {
      console.log("SKIP " + c.apercu + " — apercu absent");
      continue;
    }

    // Matrice attendue pour cette URL, memes options que generer-qr.js.
    const attendu = QRCode.create(c.url, { errorCorrectionLevel: "M" });
    const n = attendu.modules.size;          // cote du code, hors marge
    const bits = attendu.modules.data;

    const { data, info } = await sharp(fichier)
      .flatten({ background: "#FFFFFF" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // px par mm dans l'apercu (il peut avoir ete rendu a une autre echelle
    // que la nominale : on se cale sur la largeur reelle de l'image)
    const pxParMm = info.width / c.largeurSupport;

    // La boite CSS fait `taille` mm et contient n + 2 modules (marge de 1).
    const modMm = c.taille / (n + 2);
    const mod = modMm * pxParMm;
    const x0 = (c.x + modMm) * pxParMm; // on saute la marge d'un module
    const y0 = (c.y + modMm) * pxParMm;

    let faux = 0, flous = 0;
    for (let l = 0; l < n; l++) {
      for (let col = 0; col < n; col++) {
        const px = Math.round(x0 + (col + 0.5) * mod);
        const py = Math.round(y0 + (l + 0.5) * mod);
        const v = data[py * info.width + px];
        const noirAttendu = !!bits[l * n + col];
        const noirLu = v < 128;
        if (noirLu !== noirAttendu) faux++;
        if (v > 60 && v < 195) flous++; // ni franchement noir ni franchement blanc
      }
    }

    const ok = faux === 0;
    if (!ok) echecs++;
    console.log(c.support);
    console.log("   " + c.url);
    console.log(
      "   " + n + " × " + n + " modules · " + modMm.toFixed(3) + " mm par module" +
      "   (" + (modMm >= 0.5 ? "confortable" : modMm >= 0.4 ? "correct" : "TROP PETIT") + ")"
    );
    console.log(
      "   " + (ok
        ? "OK — les " + n * n + " modules correspondent a cette adresse"
        : "ECHEC — " + faux + " modules sur " + n * n + " ne correspondent pas") +
      (flous ? " · " + flous + " modules a contraste douteux" : "")
    );
    console.log("");
  }

  if (echecs) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
