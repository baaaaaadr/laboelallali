/**
 * Produit l'en-tete de la feuille de resultats dans les formats que le
 * logiciel du laboratoire peut ingerer, et mesure le poids de chacun.
 *
 *   node marketing/scripts/render-entete-resultats.js
 *
 * ── Ce que la revue de septembre 2026 a corrige ────────────────────────
 *
 * 1. PNG 24 BITS, PLUS DE PALETTE. On demandait `colours: 128` a sharp,
 *    qui arrondit a la puissance de 2 inferieure : les fichiers sortaient
 *    en 4 bits / 16 couleurs. Consequence mesuree : le fuchsia de charte
 *    #FF4081 n'existait dans AUCUN fichier (teinte la plus proche
 *    #EE3975), et le degrade du logo tombait a une douzaine de tons. Le
 *    PNG indexe 4 bits est en outre le plus mal lu par les vieilles
 *    bibliotheques d'images Windows — exactement le risque a eviter chez
 *    l'integrateur.
 *
 * 2. LISSAGE SOUS-PIXEL DESACTIVE. Six des seize entrees de palette
 *    etaient des franges ClearType : creme, bleus, oranges, violet, sur
 *    un en-tete cense n'etre que bordeaux, gris et blanc.
 *
 * 3. DENSITE TAMPONNEE. Les fichiers sortaient a 72 dpi. Un logiciel qui
 *    place l'image a sa taille physique l'aurait posee sur 421 mm de
 *    large. Le rapport compte autant que la valeur : la densite du 2x
 *    doit valoir exactement le double de celle du 1x, faute de quoi le
 *    fichier « double resolution » n'est pas un repli interchangeable.
 *    A recalculer des que l'integrateur donne la largeur reelle du cadre.
 *
 * 4. JPEG DE SECOURS. Le seul format dont on sache avec certitude qu'il
 *    est ingere est le JPEG : c'est ce qui tourne aujourd'hui. On emporte
 *    donc un repli. En 4:4:4 — le flou du JPEG actuel ne vient pas du
 *    format mais du sous-echantillonnage chroma 4:2:0, dont le rouge est
 *    le pire cas.
 *
 * ── Reserve importante ────────────────────────────────────────────────
 * Les trois images du PDF de reference sont en /DCTDecode, y compris la
 * courbe 1200x400 que le logiciel dessine lui-meme. S'il compresse en
 * JPEG son propre vectoriel, il re-encodera probablement ce qu'on lui
 * donne. Tant que le test d'insertion n'est pas fait, le poids annonce
 * ici n'est pas celui du PDF final.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "imprimerie", "entete-resultats.html");
const OUT = path.join(ROOT, "output", "entete");

const LARGEUR = 1194;
const HAUTEUR = 226;

// Largeur du cadre sur la page, en mm. C'est elle qui fixe la densite
// inscrite dans le fichier.
//
// L'integrateur avait repondu « la largeur d'une A4 » le 03/09/2026, d'ou
// la valeur 210 retenue d'abord. La mesure faite le 11/09/2026 dans les
// PDF eux-memes la corrige : apres dechiffrement (RC4 128 bits, mot de
// passe vide), la matrice de placement donne, dans les CINQ comptes rendus
// du dossier d'echantillons,
//
//     184,9 x 35,0 mm, bord haut a 1,7 mm du haut de page.
//
// 1194 px sur 184,9 mm font donc 164 dpi, non 144.
const CADRE_MM = 184.9;
const DPI_1X = Math.round(LARGEUR / (CADRE_MM / 25.4));

const ko = (o) => (o / 1024).toFixed(1) + " Ko";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // Sans lissage sous-pixel : les contours restent gris neutres au lieu de
  // se teinter de bleu et d'orange.
  const browser = await chromium.launch({
    args: [
      "--disable-lcd-text",
      "--disable-font-subpixel-positioning",
      "--force-color-profile=srgb",
    ],
  });
  const url = pathToFileURL(SRC).href;

  const prise = async (query, scale) => {
    const page = await browser.newPage({
      viewport: { width: LARGEUR, height: HAUTEUR },
      deviceScaleFactor: scale,
    });
    await page.goto(url + query, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((i) => (i.decode ? i.decode().catch(() => {}) : null))
      );
    });
    const buf = await page.screenshot({ clip: { x: 0, y: 0, width: LARGEUR, height: HAUTEUR } });
    await page.close();
    return buf;
  };

  const travaux = [
    { base: "entete", query: "", scale: 1, note: "remplacement direct" },
    { base: "entete", query: "", scale: 2, note: "double resolution" },
    { base: "entete-mono", query: "?ton=mono", scale: 1, note: "logo 1 couleur" },
    { base: "entete-mono", query: "?ton=mono", scale: 2, note: "logo 1 couleur, double res." },
  ];

  console.log("Actuel : JPEG 1194x226, 56,9 Ko dans le PDF de reference.\n");
  console.log("fichier                        dimensions      poids   densite");
  console.log("-".repeat(66));

  for (const t of travaux) {
    const brut = await prise(t.query, t.scale);
    const dpi = DPI_1X * t.scale;
    const dim = LARGEUR * t.scale + "x" + HAUTEUR * t.scale;

    const png = path.join(OUT, t.base + "-" + LARGEUR * t.scale + ".png");
    await sharp(brut)
      .withMetadata({ density: dpi })
      .png({ compressionLevel: 9, effort: 10, palette: false })
      .toFile(png);

    // Repli, a emporter mais pas a livrer par defaut. 4:4:4 : pas de
    // sous-echantillonnage chroma, donc pas de bavure sur le texte rouge.
    const jpg = path.join(OUT, t.base + "-" + LARGEUR * t.scale + ".jpg");
    await sharp(brut)
      .withMetadata({ density: dpi })
      .flatten({ background: "#FFFFFF" })
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toFile(jpg);

    console.log(
      path.basename(png).padEnd(30) + dim.padEnd(14) +
      ko(fs.statSync(png).size).padStart(8) + "   " + dpi + " dpi   (" + t.note + ")"
    );
    console.log(
      path.basename(jpg).padEnd(30) + dim.padEnd(14) +
      ko(fs.statSync(jpg).size).padStart(8) + "   " + dpi + " dpi   (repli)"
    );
  }

  // ── Planche de controle ────────────────────────────────────────────
  // Montre l'en-tete a l'echelle 1:1, pose la ou le logiciel le pose, avec
  // par-dessus les lignes que le logiciel ecrit lui-meme. C'est la preuve
  // que le chevauchement signale par le laboratoire est degage. Ce n'est
  // pas un fichier a livrer a l'integrateur.
  const CTRL = path.join(ROOT, "imprimerie", "controle-entete-resultats.html");
  if (fs.existsSync(CTRL)) {
    const p = await browser.newPage({ viewport: { width: 794, height: 280 }, deviceScaleFactor: 2 });
    await p.goto(pathToFileURL(CTRL).href, { waitUntil: "load" });
    await p.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((i) => (i.decode ? i.decode().catch(() => {}) : null))
      );
    });
    const ctrl = path.join(OUT, "controle-entete-en-situation.png");
    await p.screenshot({ path: ctrl, clip: { x: 0, y: 0, width: 794, height: 280 } });
    await p.close();
    console.log("\nplanche de controle           " + ko(fs.statSync(ctrl).size).trim() +
      "   " + path.basename(ctrl));
  }

  await browser.close();
  console.log("\nOrdre a proposer a l'integrateur : 1) PNG 24 bits  2) JPEG q90 4:4:4  3) BMP");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
