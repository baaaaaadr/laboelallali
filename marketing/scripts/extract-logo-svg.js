#!/usr/bin/env node
/**
 * Extrait le logo vectoriel depuis « Logo Labo EL ALLALI 2025.pdf » (Adobe Illustrator 26.5)
 * et genere les declinaisons SVG utilisees par le site, la PWA et l'imprimerie.
 *
 *   node marketing/scripts/extract-logo-svg.js
 *
 * Le PDF fait autorite pour la geometrie ET les couleurs :
 *   degrade axial #800020 (bordeaux) -> #FF4081 (fuchsia), diagonale haut-gauche -> bas-droit.
 *
 * Sorties dans marketing/assets/logos/ :
 *   logo-icone-degrade.svg   carre degrade + L blanc   (icone PWA / favicon / reseaux)
 *   logo-icone-claire.svg    carre blanc + L degrade   (fonds colores clairs)
 *   logo-icone-bordeaux.svg  1 ton #800020             (offset 1 couleur, tampon, kraft)
 *   logo-icone-blanc.svg     1 ton blanc               (defonce sur fond fonce)
 *   logo-l-degrade.svg       le L seul, degrade        (filigrane, signaletique)
 *   logo-l-bordeaux.svg      le L seul, 1 ton          (filigrane, gravure, tampon)
 *   logo-l-blanc.svg         le L seul, blanc          (defonce sur fond fonce)
 *
 * Les variantes « L seul » sont recadrees au plus juste (viewBox = boite du L),
 * pour se positionner sans marge parasite.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..', '..');
const PDF = path.join(ROOT, 'imprimerie', 'Logo Labo EL ALLALI 2025.pdf');
const OUT = path.join(ROOT, 'marketing', 'assets', 'logos');

const SIZE = 1080; // MediaBox du PDF
const BORDEAUX = '#800020';
const FUCHSIA = '#FF4081';

// ---------------------------------------------------------------- PDF streams

function inflateStreams(buf) {
  const s = buf.toString('latin1');
  const out = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      out.push(zlib.inflateSync(buf.slice(start, end)).toString('latin1'));
    } catch {
      /* pas un flux compresse : on ignore */
    }
  }
  return out;
}

// ------------------------------------------------------- operateurs -> chemins

/**
 * Rejoue les operateurs de trace d'un flux de contenu PDF et renvoie les
 * sous-chemins, en coordonnees SVG (origine en haut a gauche).
 *
 * On suit `cm` (matrice courante) avec la pile q/Q, parce que les chemins du
 * PDF sont exprimes dans des reperes translates.
 */
function extractPaths(stream) {
  const toks = stream.split(/\s+/).filter(Boolean);
  const nums = [];
  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];

  const paths = []; // { d, fill:boolean, clip:boolean }
  let cur = [];
  let curClip = false;

  const apply = (x, y) => [
    ctm[0] * x + ctm[2] * y + ctm[4],
    ctm[1] * x + ctm[3] * y + ctm[5],
  ];
  // PDF a l'axe Y vers le haut, SVG vers le bas
  const P = (x, y) => {
    const [dx, dy] = apply(x, y);
    return [round(dx), round(SIZE - dy)];
  };
  const round = (v) => Math.round(v * 1000) / 1000;

  const flush = (fill) => {
    if (cur.length) paths.push({ d: cur.join(' '), fill, clip: curClip });
    cur = [];
    curClip = false;
  };

  for (const t of toks) {
    if (/^[-+]?[\d.]+$/.test(t)) {
      nums.push(parseFloat(t));
      continue;
    }
    switch (t) {
      case 'q':
        stack.push(ctm.slice());
        break;
      case 'Q':
        ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
        break;
      case 'cm': {
        const [a, b, c, d, e, f] = nums.slice(-6);
        ctm = [
          a * ctm[0] + b * ctm[2],
          a * ctm[1] + b * ctm[3],
          c * ctm[0] + d * ctm[2],
          c * ctm[1] + d * ctm[3],
          e * ctm[0] + f * ctm[2] + ctm[4],
          e * ctm[1] + f * ctm[3] + ctm[5],
        ];
        break;
      }
      case 'm': {
        const [x, y] = nums.slice(-2);
        cur.push('M', ...P(x, y));
        break;
      }
      case 'l': {
        const [x, y] = nums.slice(-2);
        cur.push('L', ...P(x, y));
        break;
      }
      case 'c': {
        const [x1, y1, x2, y2, x3, y3] = nums.slice(-6);
        cur.push('C', ...P(x1, y1), ...P(x2, y2), ...P(x3, y3));
        break;
      }
      case 're': {
        const [x, y, w, h] = nums.slice(-4);
        cur.push('M', ...P(x, y), 'L', ...P(x + w, y), 'L', ...P(x + w, y + h), 'L', ...P(x, y + h), 'Z');
        break;
      }
      case 'h':
        cur.push('Z');
        break;
      case 'W':
        curClip = true;
        break;
      case 'f':
      case 'f*':
      case 'F':
        flush(true);
        break;
      case 'n':
        flush(false);
        break;
      case 'S':
      case 's':
      case 'B':
      case 'b':
        flush(true);
        break;
      default:
        break;
    }
    if (!/^[-+]?[\d.]+$/.test(t)) nums.length = 0;
  }
  flush(false);
  return paths;
}

// ------------------------------------------------------------------- rendu SVG

const GRAD = `  <defs>
    <linearGradient id="g" x1="69.6" y1="69.6" x2="1010.4" y2="1010.3" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${FUCHSIA}"/>
      <stop offset="1" stop-color="${BORDEAUX}"/>
    </linearGradient>
  </defs>`;

const wrap = (body, defs = '', box = null) => {
  const vb = box
    ? `${box.x} ${box.y} ${box.w} ${box.h}`
    : `0 0 ${SIZE} ${SIZE}`;
  const w = box ? Math.round(box.w) : SIZE;
  const h = box ? Math.round(box.h) : SIZE;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">
${defs ? defs + '\n' : ''}${body}
</svg>
`;
};

/** Boite englobante d'un chemin SVG (les données ne contiennent que des paires x/y). */
function bbox(d) {
  const n = d.match(/-?[\d.]+/g).map(Number);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < n.length; i += 2) {
    x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]);
    y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function main() {
  if (!fs.existsSync(PDF)) {
    console.error('PDF introuvable :', PDF);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const streams = inflateStreams(fs.readFileSync(PDF));
  if (streams.length < 2) {
    console.error('Flux de contenu attendus : 2, trouves :', streams.length);
    process.exit(1);
  }

  // Flux 0 : carre blanc rempli (f) + L en chemin de decoupe (W n) rempli par le degrade.
  // Flux 1 : carre en chemin de decoupe + degrade, puis les deux barres blanches du L.
  const a = extractPaths(streams[0]);
  const b = extractPaths(streams[1]);

  // Le carre arrondi : le seul chemin rempli du flux 0 qui couvre toute la zone.
  const square = a.filter((p) => p.fill).sort((x, y) => y.d.length - x.d.length)[0];
  // Le L d'un seul tenant : le chemin de decoupe du flux 0 (hors rectangle de page).
  const lSolid = a
    .filter((p) => p.clip && !/^M 0 0 L 1080 0/.test(p.d))
    .sort((x, y) => y.d.length - x.d.length)[0];
  // Les deux barres du L, tracees en blanc dans le flux 1.
  const lBars = b.filter((p) => p.fill && p.d.length < 400);

  if (!square || !lSolid || lBars.length !== 2) {
    console.error('Extraction incomplete', {
      square: !!square,
      lSolid: !!lSolid,
      bars: lBars.length,
    });
    process.exit(1);
  }

  const sq = `  <path d="${square.d}"`;
  const bars = lBars.map((p) => `    <path d="${p.d}"/>`).join('\n');
  const lBox = bbox(lSolid.d);
  console.log(
    'boite du L :',
    `x=${Math.round(lBox.x)} y=${Math.round(lBox.y)} ${Math.round(lBox.w)}×${Math.round(lBox.h)}`
  );

  const files = {
    // Icone : carre degrade, L evide en blanc
    'logo-icone-degrade.svg': wrap(
      `${sq} fill="url(#g)"/>\n  <g fill="#FFFFFF">\n${bars}\n  </g>`,
      GRAD
    ),
    // Variante claire : carre blanc, L en degrade
    'logo-icone-claire.svg': wrap(
      `${sq} fill="#FFFFFF"/>\n  <path d="${lSolid.d}" fill="url(#g)"/>`,
      GRAD
    ),
    // Aplat 1 ton bordeaux (offset 1 couleur, tampon, kraft)
    'logo-icone-bordeaux.svg': wrap(
      `${sq} fill="${BORDEAUX}"/>\n  <g fill="#FFFFFF">\n${bars}\n  </g>`
    ),
    // Defonce blanche (fonds fonces)
    'logo-icone-blanc.svg': wrap(`  <path d="${lSolid.d}" fill="#FFFFFF"/>`),

    // Carre plein a bord franc (pas de coins arrondis) : base des icones
    // Android « maskable » et de l'apple-touch-icon, ou le systeme applique
    // lui-meme son masque. Arrondir ici donnerait un double arrondi.
    'logo-plein-degrade.svg': wrap(
      `  <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="url(#g)"/>\n  <g fill="#FFFFFF">\n${bars}\n  </g>`,
      GRAD
    ),

    // --- Le L seul, recadre au plus juste ---
    'logo-l-degrade.svg': wrap(`  <path d="${lSolid.d}" fill="url(#g)"/>`, GRAD, lBox),
    'logo-l-bordeaux.svg': wrap(`  <path d="${lSolid.d}" fill="${BORDEAUX}"/>`, '', lBox),
    'logo-l-blanc.svg': wrap(`  <path d="${lSolid.d}" fill="#FFFFFF"/>`, '', lBox),
  };

  for (const [name, svg] of Object.entries(files)) {
    fs.writeFileSync(path.join(OUT, name), svg, 'utf8');
    console.log('ecrit', name, `(${svg.length} o)`);
  }
}

main();
