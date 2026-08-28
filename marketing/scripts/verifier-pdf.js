/**
 * Controle de conformite des PDF destines a l'imprimeur.
 *
 *   node marketing/scripts/verifier-pdf.js
 *
 * Verifie, pour chaque PDF de marketing/output/imprimerie/ :
 *   - dimensions de la page (MediaBox) en mm ;
 *   - que TOUTES les polices sont soit embarquees (/FontFile*), soit des
 *     polices Type3 dont les glyphes sont des traces vectoriels — dans les
 *     deux cas rien ne sera substitue chez l'imprimeur ;
 *   - la resolution effective des images bitmap (les QR codes).
 *
 * Chromium convertit les polices VARIABLES (Inter) en Type3 : c'est du
 * vectoriel, mais certains outils de prepresse le signalent. C'est attendu.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIR = path.resolve(__dirname, '..', 'output', 'imprimerie');
const PT_MM = 25.4 / 72;

function objets(buf, s) {
  const starts = [];
  const re = /(\d+)\s+0\s+obj/g;
  let m;
  while ((m = re.exec(s))) starts.push({ num: m[1], at: m.index, bodyAt: m.index + m[0].length });
  starts.sort((a, b) => a.at - b.at);
  const out = {};
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].at : s.length;
    out[starts[i].num] = { txt: s.slice(starts[i].bodyAt, end), from: starts[i].bodyAt };
  }
  return out;
}

function flux(buf, s, o) {
  const i = s.indexOf('stream', o.from);
  if (i < 0) return null;
  let b = i + 6;
  while (s[b] === '\r' || s[b] === '\n') b++;
  const e = s.indexOf('endstream', b);
  try { return zlib.inflateSync(buf.slice(b, e)).toString('latin1'); } catch { return null; }
}

let souci = 0;

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.pdf')).sort()) {
  const buf = fs.readFileSync(path.join(DIR, f));
  const s = buf.toString('latin1');
  const objs = objets(buf, s);

  const mb = s.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  const dim = mb
    ? `${(mb[3] * PT_MM).toFixed(1)} × ${(mb[4] * PT_MM).toFixed(1)} mm`
    : '?';

  const lignes = [];

  // --- polices ---------------------------------------------------------
  for (const [num, o] of Object.entries(objs)) {
    const sub = o.txt.match(/\/Subtype\s*\/(Type0|Type1|TrueType|Type3)/);
    if (!sub) continue;
    const bf = (o.txt.match(/\/BaseFont\s*\/([A-Za-z0-9+#,-]+)/) || [])[1];

    if (sub[1] === 'Type3') {
      const cp = o.txt.match(/\/CharProcs\s*<<([\s\S]*?)>>/);
      if (!cp) { lignes.push(`  ! Type3 obj ${num} sans CharProcs`); souci++; continue; }
      const refs = [...cp[1].matchAll(/\/[A-Za-z0-9._]+\s+(\d+)\s+0\s+R/g)];
      let bmp = 0;
      for (const r of refs) {
        const g = flux(buf, s, objs[r[1]] || {});
        if (g && (/(^|\s)(BI|ID)\s/.test(g) || /\/Subtype\s*\/Image/.test(g))) bmp++;
      }
      if (bmp) { lignes.push(`  ! Type3 obj ${num} : ${bmp} glyphes bitmap`); souci++; }
      continue;
    }
    // Type0 : le fichier de police est sur la descendante
    const desc = o.txt.match(/\/DescendantFonts\s*\[\s*(\d+)\s+0\s+R/);
    const cible = desc ? objs[desc[1]] : o;
    const fdRef = (cible.txt.match(/\/FontDescriptor\s+(\d+)\s+0\s+R/) || [])[1];
    const fd = fdRef ? objs[fdRef] : null;
    if (!fd || !/\/FontFile/.test(fd.txt)) {
      lignes.push(`  ! police NON embarquee : ${bf || '?'} (obj ${num})`);
      souci++;
    }
  }

  // --- images bitmap ---------------------------------------------------
  const imgs = [...s.matchAll(/\/Subtype\s*\/Image[\s\S]{0,300}?\/Width\s+(\d+)[\s\S]{0,300}?\/Height\s+(\d+)/g)];
  const infoImg = imgs.length
    ? imgs.map((i) => `${i[1]}×${i[2]} px`).join(', ')
    : 'aucune';

  const t3 = (s.match(/\/Subtype\s*\/Type3/g) || []).length;
  console.log(`${f}`);
  console.log(`   page ${dim} · polices Type3 vectorielles : ${t3} · images : ${infoImg}`);
  lignes.forEach((l) => console.log(l));
  if (!lignes.length) console.log('   OK — rien ne sera substitue a l\'impression');
  console.log('');
}

process.exit(souci ? 1 : 0);
