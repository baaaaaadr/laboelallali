/**
 * Unit-drives `lib/cyberlab/dossierDate.js`: the date shown for a dossier is the
 * one in its number (JJMMAA…), not the record's creation date (`date_dossier`).
 * Requires `npm run build`. No network.   node scripts/test-dossier-date.js
 */
const path = require("path");
const { dateFromDossierNumber, dossierDate, withDossierDates } = require(path.join(__dirname, "..", "lib/cyberlab/dossierDate"));

let failures = 0;
const assert = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };

console.log("\nDate lue dans le numéro");
const e = dateFromDossierNumber("081026013");
assert(e && e.y === 2026 && e.m === 10 && e.d === 8, "081026013 → 08/10/2026");
assert(dateFromDossierNumber("310226001") === null, "31/02 → pas une date");
assert(dateFromDossierNumber("D-9001-A") === null && dateFromDossierNumber("") === null, "numéro sans date → null");

console.log("\nDate à afficher");
assert(dossierDate("081026013", "2026-10-07T15:36:10Z") === "2026-10-08T11:00:00Z", "cas d'Aziz : devis du 07/10, dossier du 08/10 → 08/10 (midi, heure du labo)");
assert(dossierDate("071026005", "2026-10-07T15:36:10Z") === "2026-10-07T15:36:10Z", "même jour → date du labo inchangée (heure gardée)");
assert(dossierDate("081026013", "2026-10-07T23:30:00Z") === "2026-10-07T23:30:00Z", "23h30 UTC = 00h30 le 08 au Maroc → déjà le bon jour, inchangé");
assert(dossierDate("041125060", "2025-10-11T11:45:49Z") === "2025-11-04T11:00:00Z", "devis 3½ semaines avant → date du numéro");
assert(dossierDate("061026001", "2026-10-07T10:00:00Z") === "2026-10-07T10:00:00Z", "numéro ANTÉRIEUR à la création → inchangé (jamais vu, on ne devine pas)");
assert(dossierDate("080327001", "2026-10-07T10:00:00Z") === "2026-10-07T10:00:00Z", "plus de 120 jours d'écart → inchangé");
assert(dossierDate("D-9001-A", "2026-05-01T08:00:00Z") === "2026-05-01T08:00:00Z", "numéro sans date → inchangé");
assert(dossierDate("081026013", "pas une date") === "pas une date", "date_dossier illisible → inchangée");

console.log("\nRéponse complète");
const out = withDossierDates({ type: "patient", results: [
  { dossier_id: "081026013", date_dossier: "2026-10-07T15:36:10Z", etat: "Final" },
  { dossier_id: "071026005", date_dossier: "2026-10-07T09:00:00Z", etat: "Final" },
] });
assert(out.results[0].date_dossier === "2026-10-08T11:00:00Z" && out.results[0].date_creation === "2026-10-07T15:36:10Z", "date corrigée, date de création gardée à part");
assert(out.results[1].date_creation === undefined, "dossier déjà juste : rien ajouté");
assert(out.type === "patient", "le reste de la réponse est intact");

console.log(failures === 0 ? "\nTout est vert." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
