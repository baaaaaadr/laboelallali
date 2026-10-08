#!/usr/bin/env node
/**
 * Lance la batterie PURE « Emploi & Stage ».
 *
 *     node scripts/test-emploi.js
 *
 * Compile `scripts/emploi-battery.ts` avec l'API d'esbuild (jamais le binaire
 * `.cmd` : EINVAL sous Windows depuis Node 20), puis l'exécute sous Node.
 * Aucun navigateur, aucun réseau. La section A (mêmes règles que le serveur
 * déployé) lit `functions/lib` : lancer `npm --prefix functions run build`
 * avant.
 *
 * ⚠ La sortie va dans `node_modules/.cache/emploi-tests/` : Node doit pouvoir
 * remonter jusqu'au `node_modules` du projet.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'node_modules', '.cache', 'emploi-tests');
const outFile = path.join(outDir, 'emploi-battery.cjs');

fs.mkdirSync(outDir, { recursive: true });

require('esbuild').buildSync({
  entryPoints: [path.join(root, 'scripts', 'emploi-battery.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: outFile,
  logLevel: 'warning',
  // Only the type is used; the runtime of `write-excel-file` is never loaded here.
  external: ['write-excel-file/browser'],
});

try {
  execFileSync(process.execPath, [outFile], { stdio: 'inherit', cwd: root });
} catch (err) {
  process.exit(err.status || 1);
}
