/**
 * Batterie de vérification de l'encodeur Code 128 (`src/lib/barcode/code128.ts`).
 *
 * Lancée par `node scripts/test-barcode.js`. Aucun lanceur de tests dans ce
 * dépôt (cf. CLAUDE.md § Testing) : ce fichier est un programme qui compte ses
 * échecs et sort en code 1.
 *
 * La vérification qui compte est le **décodage inverse** : on relit les largeurs
 * produites, on les redécoupe en motifs, on retrouve les valeurs, on recalcule la
 * clé de contrôle et on reconstruit la chaîne de départ. Elle attrape les erreurs
 * d'indexation, d'ordre et de jeu de caractères — c'est-à-dire tout ce qui casse
 * en pratique. Elle ne prouve PAS que la table des 107 motifs est celle du
 * standard : c'est le rôle du recoupement indépendant de la clé de contrôle
 * (Code128-C « 1234 » → 82) et des ancres du standard vérifiées plus bas.
 *
 * Ce qu'aucun test automatisé ne peut faire : prouver qu'un lecteur de comptoir
 * lit le symbole sur un écran de téléphone. Ça, c'est cinq minutes avec le vrai
 * lecteur du labo.
 */
import {
  __patterns as PATTERNS,
  barcodeGeometry,
  checksum,
  Code128Error,
  encodeValues,
  fitModuleWidth,
  modules,
  QUIET_MODULES,
  totalModules,
} from '../src/lib/barcode/code128';

let failures = 0;

function ok(condition: boolean, label: string, detail = ''): void {
  if (condition) {
    console.log(`  OK    ${label}`);
  } else {
    failures++;
    console.log(`  ECHEC ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

// ── Décodeur de contrôle ────────────────────────────────────────────────────
// Indépendant de l'encodeur : il ne partage que la table des motifs.
const byPattern = new Map<string, number>(PATTERNS.map((p, i) => [p as string, i]));

function decode(data: string): string {
  const widths = modules(data);
  const values: number[] = [];
  let i = 0;
  while (i < widths.length) {
    // Le motif Stop fait 7 éléments, tous les autres 6.
    const len = widths.length - i === 7 ? 7 : 6;
    const pattern = widths.slice(i, i + len).join('');
    const value = byPattern.get(pattern);
    if (value === undefined) throw new Error(`motif inconnu à ${i} : ${pattern}`);
    values.push(value);
    i += len;
  }

  const stop = values.pop();
  if (stop !== 106) throw new Error(`stop manquant, trouvé ${stop}`);
  const key = values.pop();
  if (key !== checksum(values)) throw new Error('clé de contrôle incohérente');

  const start = values.shift();
  let out = '';
  let mode: 'B' | 'C' = start === 105 ? 'C' : 'B';
  for (const v of values) {
    if (mode === 'B' && v === 99) {
      mode = 'C';
      continue;
    }
    out += mode === 'C' ? String(v).padStart(2, '0') : String.fromCharCode(v + 32);
  }
  return out;
}

// ── 1. Intégrité de la table ────────────────────────────────────────────────
section('Table des motifs');
ok(PATTERNS.length === 107, '107 motifs', `trouvé ${PATTERNS.length}`);
ok(PATTERNS.length === new Set(PATTERNS).size, 'aucun motif en double');
ok(PATTERNS[0] === '212222', 'valeur 0 = 212222');
ok(PATTERNS[103] === '211412', 'Start A = 211412');
ok(PATTERNS[104] === '211214', 'Start B = 211214');
ok(PATTERNS[105] === '211232', 'Start C = 211232');
ok(PATTERNS[106] === '2331112', 'Stop = 2331112 (7 chiffres, volontaire)');
ok(
  PATTERNS.slice(0, 106).every((p) => p.length === 6),
  'les 106 premiers motifs font 6 éléments'
);
ok(
  PATTERNS.every((p) => [...p].every((c) => c >= '1' && c <= '4')),
  'toutes les largeurs sont comprises entre 1 et 4 modules'
);

// ── 2. Décodage inverse ─────────────────────────────────────────────────────
section('Décodage inverse');
const cas = [
  '7587', // l'identifiant du dossier de test du labo — pair, jeu C
  '1234',
  '67305', // impair : jeu B puis bascule en C
  '5',
  '1',
  '123456789012',
  'ABC-12', // non numérique : jeu B de bout en bout
];
for (const c of cas) {
  try {
    const relu = decode(c);
    ok(relu === c, `"${c}" (${totalModules(c)} modules)`, `relu "${relu}"`);
  } catch (err) {
    ok(false, `"${c}"`, (err as Error).message);
  }
}

// ── 3. Recoupement indépendant de la clé de contrôle ────────────────────────
section('Clé de contrôle');
ok(checksum(encodeValues('1234')) === 82, 'Code128-C "1234" → 82 (valeur de référence)');
ok(checksum(encodeValues('7587')) === 45, 'Code128-C "7587" → 45');

// ── 4. Choix du jeu de caractères ───────────────────────────────────────────
section('Jeux de caractères');
ok(encodeValues('7587')[0] === 105, 'longueur paire de chiffres → Start C');
ok(encodeValues('67305')[0] === 104, 'longueur impaire de chiffres → Start B');
ok(encodeValues('67305')[2] === 99, 'puis bascule en jeu C');
ok(encodeValues('ABC-12')[0] === 104, 'non numérique → Start B');
ok(
  encodeValues('7587').length < encodeValues('7 5 8 7'.replace(/ /g, 'A')).length,
  'le jeu C est plus compact que le jeu B'
);

// ── 5. Refus de l'inencodable ───────────────────────────────────────────────
section('Entrées refusées');
let threwOnEmpty = false;
try {
  encodeValues('');
} catch (err) {
  threwOnEmpty = err instanceof Code128Error;
}
ok(threwOnEmpty, 'la chaîne vide lève Code128Error');
// Un symbole vide s'encode quand même en Start + clé + Stop et se scanne comme
// rien du tout : il faut échouer bruyamment, pas produire un code illisible.

let threwOnAccent = false;
try {
  encodeValues('Café');
} catch (err) {
  threwOnAccent = err instanceof Code128Error;
}
ok(threwOnAccent, 'un caractère hors ASCII imprimable lève Code128Error');

// ── 6. Géométrie ────────────────────────────────────────────────────────────
section('Géométrie');
const geo = barcodeGeometry('7587', { moduleWidth: 4, height: 200 });
ok(geo.width === totalModules('7587') * 4, 'la largeur inclut les deux zones de silence');
ok(geo.height === 200, 'la hauteur est celle demandée');
ok(geo.bars.length === Math.ceil(modules('7587').length / 2), 'une barre sur deux éléments');
ok(geo.bars[0].x === QUIET_MODULES * 4, 'la première barre commence après la zone de silence');
const derniere = geo.bars[geo.bars.length - 1];
ok(
  derniere.x + derniere.w === geo.width - QUIET_MODULES * 4,
  'la dernière barre finit avant la zone de silence de droite'
);
ok(
  geo.bars.every((b) => b.x >= 0 && b.x + b.w <= geo.width),
  'aucune barre ne déborde du cadre'
);
ok(
  geo.bars.every((b, i) => i === 0 || b.x >= geo.bars[i - 1].x + geo.bars[i - 1].w),
  'les barres ne se chevauchent pas'
);

// ── 7. Ajustement à la largeur ──────────────────────────────────────────────
section('Ajustement à la largeur');
for (const cible of [300, 480, 972, 1080]) {
  const mw = fitModuleWidth('7587', cible);
  const largeur = totalModules('7587') * mw;
  ok(
    Number.isInteger(mw) && mw >= 1 && largeur <= cible,
    `cible ${cible} px → module ${mw} px, symbole ${largeur} px`
  );
}
ok(fitModuleWidth('7587', 10) === 1, 'une cible minuscule retombe sur 1 px, jamais 0');
// Le seuil de bascule du composant : sous 2 px par module, le symbole n'est plus
// lisible et `ScanFullscreen` doit le pivoter de 90° pour viser la hauteur de
// l'écran. 18 chiffres font 154 modules, donc il faut moins de 308 px pour
// tomber sous 2 — un code long sur un téléphone étroit tenu en portrait.
const codeLong = '123456789012345678';
ok(totalModules(codeLong) === 154, `"${codeLong}" fait 154 modules`);
ok(fitModuleWidth(codeLong, 300) < 2, 'code long dans 300 px → sous 2 px, le composant doit pivoter');
ok(fitModuleWidth(codeLong, 320) >= 2, 'le même code dans 320 px reste rendu à plat');

// ── 8. Fidélité au script marketing ─────────────────────────────────────────
// `marketing/scripts/generer-code-barres.js` a produit les planches que le labo
// a réellement scannées : c'est la seule implémentation validée sur un lecteur
// physique. Le module de `src/lib/` en est un portage. Tant qu'ils produisent
// exactement les mêmes largeurs, la validation terrain vaut pour les deux.
// Si ce bloc casse, c'est que les deux ont divergé — et l'application affiche
// alors un symbole que personne n'a jamais scanné.
section('Fidélité au script marketing (source validée au scan)');
{
  const fs = require('fs') as typeof import('fs');
  const vm = require('vm') as typeof import('vm');
  const path = require('path') as typeof import('path');

  // ⚠ `process.cwd()`, pas `__dirname` : esbuild bundle ce fichier dans
  // node_modules/.cache/, donc __dirname n'y désigne plus scripts/. Le lanceur
  // `test-barcode.js` exécute toujours depuis la racine du dépôt (cwd: root).
  const src = fs.readFileSync(
    path.join(process.cwd(), 'marketing', 'scripts', 'generer-code-barres.js'),
    'utf8'
  );
  // On n'évalue que le bloc encodeur : le reste tire playwright.
  const body = src.slice(src.indexOf('const PATTERNS'), src.indexOf('function barcodeSvg'));
  const sandbox: Record<string, unknown> = { console };
  vm.createContext(sandbox);
  vm.runInContext(`${body}\nthis.__origine = { modules, PATTERNS };`, sandbox);
  const origine = (sandbox as { __origine: { modules: (s: string) => number[]; PATTERNS: string[] } })
    .__origine;

  ok(
    origine.PATTERNS.join('|') === (PATTERNS as readonly string[]).join('|'),
    'les deux tables de motifs sont identiques'
  );
  for (const c of cas) {
    ok(
      modules(c).join(',') === origine.modules(c).join(','),
      `"${c}" produit les mêmes largeurs de part et d'autre`
    );
  }
}

// ── Verdict ─────────────────────────────────────────────────────────────────
console.log('');
if (failures === 0) {
  console.log('Tout est vert.');
} else {
  console.log(`${failures} vérification(s) en échec.`);
}
process.exit(failures === 0 ? 0 : 1);
