/**
 * Produit le corps HTML du document « Textes des publications » destiné à être
 * créé comme Google Doc (le copier-coller y reste fidèle, arabe compris).
 * Usage : node marketing/scripts/textes-pour-drive.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "2026-09", "posts.json"), "utf8"));

const blocs = data.posts
  .map((p, i) => {
    const d = new Date(p.date + "T12:00:00Z");
    const date = `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
    const txt = (lang) => `${p[lang].caption}\n\n${(p[lang].hashtags || []).join(" ")}`;
    return [
      `<h2>${i + 1}. ${esc(date)} — ${esc(p.fr.title)}${p.risk === "orange" ? " (relecture conseillée)" : ""}</h2>`,
      `<p><i>Images : ${esc(p.slug)}-fr.png · -ar.png · -fr-story.png · -ar-story.png</i></p>`,
      `<h3>Texte français</h3><p>${esc(txt("fr"))}</p>`,
      `<h3>النص العربي</h3><p dir="rtl">${esc(txt("ar"))}</p>`,
    ].join("\n");
  })
  .join("\n<hr>\n");

console.log(
  `<h1>Textes des publications — septembre et octobre 2026</h1>
<p>Pour chaque publication, le texte à coller sous l'image, en français et en arabe, avec les hashtags. Sélectionnez le texte, copiez-le, collez-le dans Facebook ou Instagram. Publiez la version française et la version arabe séparément, jamais les deux sous la même image.</p>
<p><i>Laboratoire El Allali — pack de lancement, 18 publications.</i></p>
<hr>
${blocs}`
);
