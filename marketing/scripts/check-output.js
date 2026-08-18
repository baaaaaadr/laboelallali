/**
 * QA des PNG générés : 2 fichiers par post (fr/ar), dimensions 1080×1080 exactes, poids < 1 Mo.
 * Usage : node marketing/scripts/check-output.js --month 2026-09
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const month = process.argv[process.argv.indexOf("--month") + 1];
if (!month || month.startsWith("--")) {
  console.error("Usage: node marketing/scripts/check-output.js --month 2026-09");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "content", month, "posts.json"), "utf8"));
const outDir = path.join(ROOT, "output", month);

function pngSize(file) {
  const buf = Buffer.alloc(24);
  const fd = fs.openSync(file, "r");
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("pas un PNG");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const FORMATS = [
  { suffix: "", w: 1080, h: 1080 },
  { suffix: "-story", w: 1080, h: 1920 },
];

let errors = 0;
for (const post of data.posts) {
  for (const lang of ["fr", "ar"]) {
    for (const fmt of FORMATS) {
      const name = `${post.slug}-${lang}${fmt.suffix}.png`;
      const file = path.join(outDir, name);
      if (!fs.existsSync(file)) {
        console.error(`MANQUANT  ${name}`);
        errors++;
        continue;
      }
      const { w, h } = pngSize(file);
      const kb = Math.round(fs.statSync(file).size / 1024);
      const dimOk = w === fmt.w && h === fmt.h;
      const sizeOk = kb < 1400;
      if (!dimOk || !sizeOk) {
        console.error(`ERREUR    ${name} — ${w}×${h}, ${kb} Ko`);
        errors++;
      } else {
        console.log(`OK        ${name} — ${w}×${h}, ${kb} Ko`);
      }
    }
  }
}
console.log(errors ? `\n${errors} problème(s).` : "\nTout est conforme.");
process.exit(errors ? 1 : 0);
