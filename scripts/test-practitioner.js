#!/usr/bin/env node
/**
 * Lance la batterie PURE de l'espace médecin (« Mes patients »).
 *
 *     node scripts/test-practitioner.js
 *
 * Compile `scripts/practitioner-battery.ts` avec l'API d'esbuild (jamais le
 * binaire `.cmd` : EINVAL sous Windows depuis Node 20), puis l'exécute sous
 * Node. Aucun navigateur, aucun réseau. La section E (parité avec le serveur)
 * lit `functions/lib` : lancer `npm --prefix functions run build` avant.
 *
 * ⚠ La sortie va dans `node_modules/.cache/practitioner-tests/` : Node doit
 * pouvoir remonter jusqu'au `node_modules` du projet.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'node_modules', '.cache', 'practitioner-tests');
const outFile = path.join(outDir, 'practitioner-battery.cjs');

fs.mkdirSync(outDir, { recursive: true });

require('esbuild').buildSync({
  entryPoints: [path.join(root, 'scripts', 'practitioner-battery.ts')],
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
