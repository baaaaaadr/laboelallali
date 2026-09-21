/**
 * Produit les QR codes du laboratoire en VECTORIEL.
 *
 *   node marketing/scripts/generer-qr.js
 *
 * Pourquoi : les QR de marketing/affiches/ sont des PNG 1000 px a 72 dpi.
 * Sur un ecran c'est sans importance, a l'impression non : un PNG pose sur
 * 18 mm doit etre re-echantillonne, et le re-echantillonnage d'un damier
 * noir et blanc est exactement le cas ou l'interpolation fabrique du gris
 * sur les bords des modules. Un scanner y perd son seuil de contraste.
 *
 * Le SVG n'a pas ce probleme : chaque module reste un carre net a toute
 * taille, et le fichier pese quelques kilo-octets.
 *
 * Niveau de correction M : ~15 % de redondance. Suffisant pour du papier
 * qui ne sera ni plie ni sali a cet endroit, et cela garde le code en
 * version 2 (25 x 25 modules) — donc des modules larges, donc lisibles
 * meme imprimes petit.
 */
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const OUT = path.resolve(__dirname, "..", "assets", "qr");

const CODES = [
  { fichier: "qr-site.svg", url: "https://www.laboelallali.com", quoi: "site et resultats en ligne" },
  { fichier: "qr-avis.svg", url: "https://g.page/r/Ce6V_SOBrPJxEAE/review", quoi: "avis Google" },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  for (const c of CODES) {
    const svg = await QRCode.toString(c.url, {
      type: "svg",
      errorCorrectionLevel: "M",
      // Zone de silence : 1 module au lieu des 4 de la norme. Ce n'est pas
      // une entorse — la norme demande 4 modules de BLANC autour du code,
      // et la mise en page en fournit deja plus de 2 mm de tous cotes. Les
      // porter dans le fichier reviendrait a les compter deux fois et a
      // retrecir les modules utiles, qui sont ce qui decide de la lecture.
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    // Le SVG sort avec width/height fixes en px ; on ne garde que le
    // viewBox pour qu'il se mette a l'echelle demandee par la mise en page.
    const nettoye = svg
      .replace(/ width="[^"]*"/, "")
      .replace(/ height="[^"]*"/, "")
      .replace("<svg ", '<svg width="100%" height="100%" ');

    const dest = path.join(OUT, c.fichier);
    fs.writeFileSync(dest, nettoye);

    const modules = (nettoye.match(/viewBox="0 0 (\d+)/) || [, "?"])[1];
    console.log(
      c.fichier.padEnd(16) +
        (modules + " modules").padEnd(14) +
        (fs.statSync(dest).size / 1024).toFixed(1).padStart(5) + " Ko   " +
        c.quoi
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
