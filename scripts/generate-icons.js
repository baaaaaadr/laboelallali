#!/usr/bin/env node
/**
 * Regenere les icones de l'application (PWA, favicon, en-tete, PDF de devis)
 * a partir du logo vectoriel officiel.
 *
 *   node scripts/generate-icons.js
 *
 * Source : marketing/assets/logos/*.svg — produits par
 * marketing/scripts/extract-logo-svg.js a partir de « Logo Labo EL ALLALI
 * 2025.pdf » (Adobe Illustrator). Ce PDF fait autorite pour la geometrie et
 * pour les couleurs : degrade #FF4081 (fuchsia) -> #800020 (bordeaux).
 *
 * Historique : les PNG livres avant cette regeneration utilisaient un degrade
 * different (#E01849 -> #9C3585), qui ne correspondait ni au logo officiel ni
 * aux jetons de la charte. Ils plafonnaient aussi a 512 px.
 *
 * N.B. public/images/icons/ios-share-icon.png est le glyphe « Partager » d'iOS,
 * pas notre logo : il n'est volontairement pas regenere.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const LOGOS = path.join(ROOT, 'marketing', 'assets', 'logos');
const ICONS = path.join(ROOT, 'public', 'images', 'icons');

const ARRONDI = path.join(LOGOS, 'logo-icone-degrade.svg'); // carre arrondi + L blanc
const PLEIN = path.join(LOGOS, 'logo-plein-degrade.svg'); // carre a bord franc
const L_BLANC = path.join(LOGOS, 'logo-l-blanc.svg');

/**
 * Icones « any » : le carre arrondi tel quel, fond transparent aux angles.
 * logo-footer.png passe de 80 a 256 px — il alimente l'en-tete, le pied de page
 * ET le PDF de devis, qui le redessine a 160 px (donc flou depuis une source
 * de 80 px). Les dimensions d'affichage sont fixees en CSS / dans le PDF :
 * augmenter la resolution de la source est sans effet de bord.
 */
const ANY = [
  ['icon-192x192.png', 192],
  ['icon-512x512.png', 512],
  ['logo-footer.png', 256],
  ['logo-header.png', 1080],
  ['logo-splash.png', 1080],
];

/** Tailles des icones Android « maskable ». */
const MASKABLE = [
  ['icon-192x192-maskable.png', 192],
  ['icon-512x512-maskable.png', 512],
];

/**
 * Construit une icone maskable : fond degrade a bord franc + le L centre,
 * reduit pour tenir dans la zone sure.
 *
 * Android rogne les icones maskable selon une forme variable (cercle, goutte,
 * squircle...). Seul un disque central de 80 % du cote est garanti visible.
 * Le L mesure 493x695, soit une diagonale de 852 : pour qu'il tienne dans ce
 * disque il faut une hauteur <= 0,652 x cote. On prend 58 % pour garder de
 * l'air. Les deux fichiers -maskable livres precedemment etaient des copies
 * octet pour octet des icones normales : leurs angles arrondis se faisaient
 * donc rogner une seconde fois par le systeme.
 */
async function maskable(size) {
  const svgL = fs.readFileSync(L_BLANC, 'utf8');
  const viewBox = svgL.match(/viewBox="([^"]+)"/)[1];
  const d = svgL.match(/ d="([^"]+)"/)[1];

  const hauteur = Math.round(size * 0.58);
  const [, , vbW, vbH] = viewBox.split(/\s+/).map(Number);
  const largeur = Math.round((hauteur * vbW) / vbH);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FF4081"/>
      <stop offset="1" stop-color="#800020"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" fill="url(#g)"/>
  <svg x="${Math.round((size - largeur) / 2)}" y="${Math.round((size - hauteur) / 2)}"
       width="${largeur}" height="${hauteur}" viewBox="${viewBox}">
    <path d="${d}" fill="#FFFFFF"/>
  </svg>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Rend un SVG a la taille voulue, en rasterisant a la bonne densite. */
function rendu(svgPath, size) {
  // densite = 96 dpi x (taille voulue / 1080 du viewBox) pour eviter un
  // rendu a basse resolution suivi d'un agrandissement.
  return sharp(svgPath, { density: Math.max(72, Math.ceil((96 * size) / 1080) * 4) })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 });
}

(async () => {
  if (!fs.existsSync(ARRONDI) || !fs.existsSync(PLEIN)) {
    console.error(
      'Logos SVG absents. Lance d\'abord :\n  node marketing/scripts/extract-logo-svg.js'
    );
    process.exit(1);
  }
  fs.mkdirSync(ICONS, { recursive: true });

  for (const [nom, size] of ANY) {
    await rendu(ARRONDI, size).toFile(path.join(ICONS, nom));
    console.log(`OK  ${nom}  ${size}x${size}`);
  }

  for (const [nom, size] of MASKABLE) {
    fs.writeFileSync(path.join(ICONS, nom), await maskable(size));
    console.log(`OK  ${nom}  ${size}x${size}  (zone sure 58 %)`);
  }

  // apple-touch-icon : iOS applique son propre arrondi et ne gere pas la
  // transparence — on livre donc un carre plein, opaque, a bord franc.
  await sharp(PLEIN, { density: 288 })
    .resize(180, 180)
    .flatten({ background: '#800020' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ICONS, 'apple-touch-icon.png'));
  console.log('OK  apple-touch-icon.png  180x180  (opaque, bord franc)');

  // Le vectoriel lui-meme, servi par l'app (favicon moderne, rendu net partout).
  fs.copyFileSync(ARRONDI, path.join(ICONS, 'logo.svg'));
  console.log('OK  logo.svg  (vectoriel)');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
