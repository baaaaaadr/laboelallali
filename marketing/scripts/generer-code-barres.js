/**
 * Genere un code-barres Code 128 a partir d'un code patient, en PNG.
 *
 * Sert a tester le scan a l'accueil AVANT de developper la fonctionnalite
 * (ligne "Code patient en code-barres dans le profil" du devis) : on affiche
 * le PNG sur un telephone et on scanne avec le lecteur du comptoir. Si le
 * numero se tape tout seul dans la recherche patient de Qalam, c'est valide.
 *
 * Usage :
 *   node marketing/scripts/generer-code-barres.js 7587
 *   node marketing/scripts/generer-code-barres.js 7587 "EL ALLALI Hassan"
 *
 * Sorties dans marketing/output/code-barres/ :
 *   code-<code>.png         planche plein ecran telephone (1080x1920)
 *   code-<code>-tailles.png trois largeurs sur un meme ecran, pour trouver
 *                           celle que le lecteur accroche
 *
 * Pourquoi Code 128 : c'est le symbole que lisent par defaut tous les lecteurs
 * de comptoir, il encode les chiffres deux par deux (donc compact) et il ne
 * porte aucune contrainte de longueur fixe, contrairement a l'EAN-13.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OUT = path.resolve(__dirname, "..", "output", "code-barres");

// ─── Code 128 ────────────────────────────────────────────────────────────────
// Les 107 motifs du standard. Chaque motif est une suite de largeurs en
// modules, alternant barre / blanc / barre / blanc / barre / blanc.
// Index 0-102 = donnees, 103 = Start A, 104 = Start B, 105 = Start C, 106 = Stop.
const PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
];
const START_B = 104;
const START_C = 105;
const STOP = 106;
const CODE_C_FROM_B = 99; // bascule vers le jeu C depuis le jeu B

/**
 * Traduit une chaine en valeurs Code 128.
 * Chiffres uniquement -> jeu C (deux chiffres par symbole, deux fois plus court).
 * Longueur impaire -> le premier chiffre passe en jeu B, puis on bascule en C.
 * Tout le reste -> jeu B de bout en bout.
 */
function encodeValues(data) {
  const digitsOnly = /^\d+$/.test(data);
  const values = [];

  if (!digitsOnly) {
    values.push(START_B);
    for (const ch of data) {
      const code = ch.charCodeAt(0);
      if (code < 32 || code > 126) {
        throw new Error(`Caractere non supporte en Code 128 B : "${ch}"`);
      }
      values.push(code - 32);
    }
    return values;
  }

  let rest = data;
  if (data.length % 2 === 1) {
    values.push(START_B, data.charCodeAt(0) - 32, CODE_C_FROM_B);
    rest = data.slice(1);
  } else {
    values.push(START_C);
  }
  for (let i = 0; i < rest.length; i += 2) {
    values.push(parseInt(rest.slice(i, i + 2), 10));
  }
  return values;
}

/**
 * Cle de controle : Start + somme des valeurs ponderees par leur rang (1, 2, 3...),
 * modulo 103. Le lecteur la recalcule ; si elle ne tombe pas juste il ne bipe pas.
 */
function checksum(values) {
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += i * values[i];
  return sum % 103;
}

/** Largeurs des barres/blancs successifs, cle de controle et stop compris. */
function modules(data) {
  const values = encodeValues(data);
  values.push(checksum(values), STOP);
  const widths = [];
  for (const v of values) {
    for (const w of PATTERNS[v]) widths.push(Number(w));
  }
  return widths;
}

/**
 * Rend le symbole en SVG. Les blancs ne sont pas dessines : le fond blanc du
 * SVG les fournit. La zone de silence (10 modules de chaque cote) fait partie
 * du symbole — sans elle beaucoup de lecteurs refusent de decoder.
 */
function barcodeSvg(data, { moduleWidth = 3, height = 120, quiet = 10 } = {}) {
  const widths = modules(data);
  const total = widths.reduce((a, b) => a + b, 0) + quiet * 2;
  const w = total * moduleWidth;

  let x = quiet * moduleWidth;
  let rects = "";
  widths.forEach((width, i) => {
    const px = width * moduleWidth;
    if (i % 2 === 0) {
      // Indices pairs = barres. shape-rendering=crispEdges evite que le
      // navigateur lisse les bords : un bord flou fait rater le decodage.
      rects += `<rect x="${x}" y="0" width="${px}" height="${height}" fill="#000" shape-rendering="crispEdges"/>`;
    }
    x += px;
  });

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-label="Code ${data}">${rects}</svg>`,
    width: w,
  };
}

// ─── Planches ────────────────────────────────────────────────────────────────
const SCREEN_W = 1080;
const SCREEN_H = 1920;

/** Largeur de module qui fait tenir le symbole sur `targetPx`, en pixels entiers. */
function fitModuleWidth(data, targetPx, quiet = 10) {
  const totalModules = modules(data).reduce((a, b) => a + b, 0) + quiet * 2;
  // Entier obligatoire : un module a 7,4 px produit des barres de largeurs
  // inegales une fois rasterisees, et le lecteur lit de travers.
  return Math.max(1, Math.floor(targetPx / totalModules));
}

const SHELL = (title, body) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title><style>
  @page { size: ${SCREEN_W}px ${SCREEN_H}px; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0; width: ${SCREEN_W}px; height: ${SCREEN_H}px; background: #fff;
    font-family: "Segoe UI", Arial, sans-serif; color: #111;
    display: flex; flex-direction: column; align-items: center;
  }
  .entete { padding: 64px 60px 0; text-align: center; }
  .labo { font-size: 34px; letter-spacing: .22em; text-transform: uppercase; color: #800020; font-weight: 700; }
  .titre { font-size: 56px; font-weight: 700; margin-top: 18px; }
  .sous { font-size: 32px; color: #444; margin-top: 16px; line-height: 1.45; }
  .zone { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; width: 100%; }
  .chiffres { font-size: 92px; font-weight: 700; letter-spacing: .14em; font-variant-numeric: tabular-nums; }
  .pied { padding: 0 60px 70px; text-align: center; font-size: 27px; color: #555; line-height: 1.5; }
  .etiquette { font-size: 30px; color: #800020; font-weight: 700; letter-spacing: .05em; }
  .bloc { display: flex; flex-direction: column; align-items: center; gap: 14px; }
</style></head><body>${body}</body></html>`;

function plancheSimple(code, nom) {
  const mw = fitModuleWidth(code, Math.round(SCREEN_W * 0.9));
  const { svg } = barcodeSvg(code, { moduleWidth: mw, height: 420 });
  return SHELL(
    `Code patient ${code}`,
    `<div class="entete">
       <div class="labo">Laboratoire El Allali</div>
       <div class="titre">Code patient</div>
       ${nom ? `<div class="sous">${nom}</div>` : ""}
     </div>
     <div class="zone">
       ${svg}
       <div class="chiffres">${code}</div>
     </div>
     <div class="pied">
       Test du lecteur de l'accueil.<br>
       Placer le curseur dans la recherche patient de Qalam, puis scanner cet écran :
       le numéro doit se taper tout seul.
     </div>`
  );
}

function plancheTailles(code) {
  // Trois largeurs : si seule la plus grande passe, le lecteur est limite et il
  // faudra imposer une taille minimale a l'ecran du patient.
  const tailles = [
    { pct: 0.45, label: "Petit" },
    { pct: 0.68, label: "Moyen" },
    { pct: 0.92, label: "Grand" },
  ];
  const blocs = tailles
    .map(({ pct, label }) => {
      const mw = fitModuleWidth(code, Math.round(SCREEN_W * pct));
      const { svg } = barcodeSvg(code, { moduleWidth: mw, height: 260 });
      return `<div class="bloc">
        <div class="etiquette">${label}</div>
        ${svg}
      </div>`;
    })
    .join("");

  return SHELL(
    `Code patient ${code} — tailles`,
    `<div class="entete">
       <div class="titre">Quelle taille passe ?</div>
       <div class="sous">Même code (${code}), trois largeurs.<br>Scanner les trois et noter celles qui bipent.</div>
     </div>
     <div class="zone">${blocs}</div>
     <div class="pied">
       Si seul « Grand » est lu, le lecteur de l'accueil est peu sensible :
       l'application devra afficher le code-barres en grand et forcer la luminosité de l'écran.
     </div>`
  );
}

// ─── Rendu ───────────────────────────────────────────────────────────────────
async function main() {
  const code = (process.argv[2] || "").trim();
  const nom = (process.argv[3] || "").trim();

  if (!code) {
    console.error("Usage : node marketing/scripts/generer-code-barres.js <code> [nom]");
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  // deviceScaleFactor 1 : le SVG est deja dessine a la taille finale en pixels.
  // Le rehausser ne rajouterait aucune information et pourrait reintroduire
  // du lissage sur les bords des barres.
  const page = await browser.newPage({
    viewport: { width: SCREEN_W, height: SCREEN_H },
    deviceScaleFactor: 1,
  });

  const planches = [
    { nom: `code-${code}.png`, html: plancheSimple(code, nom) },
    { nom: `code-${code}-tailles.png`, html: plancheTailles(code) },
  ];

  for (const p of planches) {
    await page.setContent(p.html, { waitUntil: "load" });
    const dest = path.join(OUT, p.nom);
    await page.screenshot({ path: dest });
    console.log(`  ${p.nom}  ->  ${dest}`);
  }

  await browser.close();

  const vals = encodeValues(code);
  console.log(`\nCode 128 pour "${code}" : jeu ${/^\d+$/.test(code) && code.length % 2 === 0 ? "C" : /^\d+$/.test(code) ? "B puis C" : "B"}, ` +
    `${vals.length - 1} symboles de donnees, cle de controle ${checksum(vals)}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
