#!/usr/bin/env node
/**
 * Lance la batterie de vérification du parcours patient.
 *
 *     node scripts/test-journey.js
 *
 * Le dépôt n'a AUCUN lanceur de tests (voir CLAUDE.md § Testing) : ce script
 * compile `scripts/journey-battery.ts` avec esbuild — déjà présent dans
 * `node_modules` — puis l'exécute sous Node. Aucune dépendance à installer,
 * aucun réseau, aucun e-mail réellement envoyé.
 *
 * ⚠ La sortie compilée va dans `node_modules/.cache/journey-tests/` et non dans
 * un dossier temporaire du système : Node doit pouvoir remonter jusqu'au
 * `node_modules` du projet pour résoudre les rares dépendances externes.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'node_modules', '.cache', 'journey-tests');
const outFile = path.join(outDir, 'journey-battery.cjs');

fs.mkdirSync(outDir, { recursive: true });

// ⚠ L'API JavaScript d'esbuild, PAS le binaire `node_modules/.bin/esbuild`.
// Sous Windows, `execFileSync` sur un `.cmd` échoue en `EINVAL` depuis Node 20
// (les fichiers de commande exigent un shell) — et passer par un shell
// rouvrirait la question de l'échappement des chemins contenant des espaces,
// ce qui est précisément le cas ici (« OneDrive\Documents »).
require('esbuild').buildSync({
  entryPoints: [path.join(root, 'scripts', 'journey-battery.ts')],
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
