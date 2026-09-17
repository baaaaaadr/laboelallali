#!/usr/bin/env node
/**
 * Lance la batterie de vérification du code-barres Code 128.
 *
 *     node scripts/test-barcode.js
 *
 * Même mécanique que `test-journey.js` : esbuild — déjà dans `node_modules` —
 * compile `scripts/barcode-battery.ts`, puis Node l'exécute. Rien à installer,
 * aucun réseau.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'node_modules', '.cache', 'barcode-tests');
const outFile = path.join(outDir, 'barcode-battery.cjs');

fs.mkdirSync(outDir, { recursive: true });

// ⚠ L'API JavaScript d'esbuild, PAS le binaire `node_modules/.bin/esbuild` :
// sous Windows, `execFileSync` sur un `.cmd` échoue en EINVAL depuis Node 20.
// Voir le commentaire détaillé dans `scripts/test-journey.js`.
require('esbuild').buildSync({
  entryPoints: [path.join(root, 'scripts', 'barcode-battery.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: outFile,
  logLevel: 'warning',
});

try {
  execFileSync(process.execPath, [outFile], { stdio: 'inherit', cwd: root });
} catch (err) {
  process.exit(err.status || 1);
}
