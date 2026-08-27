/**
 * Prépare les lignes des deux calendriers destinés au laboratoire :
 *  1. le calendrier de publication du pack de lancement (septembre-octobre) ;
 *  2. le programme des 9 mois suivants (titres seulement, sans les contenus).
 * Sortie : JSON prêt à être écrit dans Google Sheets.
 * Usage : node marketing/scripts/build-calendriers.js [1|2]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const TYPE_PAR_TEMPLATE = {
  "service-info": "Informatif",
  "service-app": "Informatif",
  annonce: "Informatif",
  "preparation-examen": "Instructif",
  "le-saviez-vous": "Médical",
  "journee-mondiale": "Médical",
};

const quel = process.argv[2] || "0";

if (quel === "1" || quel === "0") {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "2026-09", "posts.json"), "utf8"));
  const rows = [["Date", "Jour", "Publication", "Fichiers image (4 versions)", "Type", "À vérifier avant", "Publié ?"]];
  for (const p of data.posts) {
    const d = new Date(p.date + "T12:00:00Z");
    rows.push([
      `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`,
      JOURS[d.getUTCDay()],
      p.fr.title,
      `${p.slug}-fr / -ar / -fr-story / -ar-story`,
      TYPE_PAR_TEMPLATE[p.template] || "",
      p.risk === "orange" ? "Oui — relecture conseillée" : "Non",
      "",
    ]);
  }
  if (quel === "1") console.log(JSON.stringify(rows));
  else console.log(`Calendrier 1 : ${rows.length - 1} publications`);
}

if (quel === "2" || quel === "0") {
  // Version corrigée uniquement : le fichier brut contient des titres écartés par la relecture.
  const prog = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "programme-editorial-final.json"), "utf8"));
  const LIB = { T2: "Pack 1 · nov. 2026 – janv. 2027", T3: "Pack 2 · févr. – avr. 2027", T4: "Pack 3 · mai – juil. 2027" };
  const rows = [["Pack", "Quand", "Publication", "Type"]];
  for (const t of prog.trimestres) {
    if (t.key === "T1") continue; // déjà couvert par le calendrier de lancement
    for (const p of t.posts) {
      rows.push([LIB[t.key] || t.key, p.periode, p.titre_fr, p.type.charAt(0).toUpperCase() + p.type.slice(1)]);
    }
  }
  if (quel === "2") console.log(JSON.stringify(rows));
  else console.log(`Calendrier 2 : ${rows.length - 1} publications`);
}
