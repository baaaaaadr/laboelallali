#!/usr/bin/env node
/**
 * Writes the lab's contact card for phones — `public/carte-visite/laboratoire-el-allali.vcf`
 * (vCard 3.0, read by iPhone and Android: « Enregistrer dans mes contacts »
 * on the /carte page, devis line 63, 12/10/2026).
 *
 *     node scripts/generate-vcard.js
 *
 * Re-run it whenever a number, the address or the hours change (and keep
 * `src/constants/contact.ts` + `src/constants/labHours.ts` in step). The logo
 * is the app icon, embedded so the contact shows it.
 *
 * vCard rules that bite: CRLF line ends, lines folded at 75 octets (a folded
 * line starts with ONE space), commas and semicolons escaped in text values.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'carte-visite', 'laboratoire-el-allali.vcf');
const LOGO = path.join(ROOT, 'public', 'images', 'icons', 'icon-192x192.png');

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');

/** Fold at 75 octets (UTF-8), continuation lines start with a space. */
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out = [];
  let chunk = '';
  let size = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch, 'utf8');
    const limit = out.length === 0 ? 75 : 74;
    if (size + n > limit) {
      out.push(chunk);
      chunk = '';
      size = 0;
    }
    chunk += ch;
    size += n;
  }
  out.push(chunk);
  return out.join('\r\n ');
}

const lines = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  `N:;${esc('Laboratoire El Allali')};;;`,
  `FN:${esc('Laboratoire El Allali')}`,
  `ORG:${esc('Laboratoire El Allali de biologie médicale')}`,
  `TITLE:${esc('Dr Mohamed Aziz El Allali — Pharmacien biologiste')}`,
  'TEL;TYPE=WORK,VOICE:+212528843384',
  'item1.TEL;TYPE=CELL:+212654079592',
  `item1.X-ABLabel:${esc('WhatsApp laboratoire')}`,
  'item2.TEL;TYPE=CELL:+212661291411',
  `item2.X-ABLabel:${esc('Dr El Allali')}`,
  'EMAIL;TYPE=INTERNET,WORK:laboelallali@gmail.com',
  'URL:https://www.laboelallali.com',
  `ADR;TYPE=WORK:;;${esc('61 Bis, Rue de Marrakech')};Agadir;;80020;${esc('Maroc')}`,
  `NOTE:${esc('Lun–ven 7h30–18h30, sam 7h30–13h00, dimanche fermé. WhatsApp du laboratoire : 06 54 07 95 92. Dr El Allali : 06 61 29 14 11. مختبر العلالي للتحليلات الطبية، زنقة مراكش، أكادير.')}`,
];
if (fs.existsSync(LOGO)) {
  lines.push(`PHOTO;ENCODING=b;TYPE=PNG:${fs.readFileSync(LOGO).toString('base64')}`);
}
lines.push('END:VCARD');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.map(fold).join('\r\n') + '\r\n', 'utf8');
console.log(`${OUT} — ${fs.statSync(OUT).size} octets`);
