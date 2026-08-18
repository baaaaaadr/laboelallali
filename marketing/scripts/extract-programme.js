/**
 * Extrait le programme éditorial produit par le workflow vers un JSON de travail,
 * et affiche la liste compacte des corrections à appliquer.
 * Usage : node marketing/scripts/extract-programme.js <fichier-sortie-workflow.json>
 */
const fs = require("fs");
const path = require("path");

const src = process.argv[2];
if (!src) {
  console.error("Usage: node marketing/scripts/extract-programme.js <fichier.json>");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(src, "utf8"));
const trimestres = (raw.result || raw).trimestres;

const out = path.resolve(__dirname, "..", "content", "programme-editorial.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  JSON.stringify(
    { trimestres: trimestres.map((t) => ({ key: t.key, periode: t.periode, posts: t.posts })) },
    null,
    2
  ),
  "utf8"
);
console.log(`OK  ${path.relative(path.resolve(__dirname, ".."), out)} — ${trimestres.reduce((n, t) => n + t.posts.length, 0)} publications\n`);

for (const t of trimestres) {
  console.log(`\n===== ${t.key} (${t.periode}) — ${t.posts.length} publications, ${t.problemes.length} correction(s)`);
  t.posts.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. [${p.periode}] ${p.titre_fr}`));
  t.problemes.forEach((pb, i) => {
    console.log(`\n  --- correction ${i + 1} : ${pb.titre_concerne}`);
    console.log(`      PB  : ${pb.probleme.slice(0, 220)}`);
    console.log(`      FIX : ${pb.correction.slice(0, 400)}`);
  });
}
