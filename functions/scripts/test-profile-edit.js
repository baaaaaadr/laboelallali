/**
 * Unit-drives the PURE rules of `adminUpdateProfile`
 * (lib/admin/profileEdit.js) — the front desk correcting a patient's name,
 * date of birth or phone.
 *
 * Requires a build first (npm run build) so lib/ exists. No network, no Firebase.
 *   node scripts/test-profile-edit.js
 * Exits non-zero when any assertion failed.
 */
const path = require("path");
const { parseProfileEdit, profileDiff } = require(path.join(__dirname, "..", "lib/admin/profileEdit"));

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${msg}`);
  }
}
const codeOf = (fn) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e.code || "erreur";
  }
};
const TODAY = new Date(Date.UTC(2026, 9, 7));

console.log("\nNom complet");
assert(parseProfileEdit({ fullName: "  Otman   El  Mai " }, TODAY).fullName === "Otman El Mai", "espaces nettoyés");
assert(codeOf(() => parseProfileEdit({ fullName: "O" }, TODAY)) === "invalid-argument", "une lettre → refusé");
assert(codeOf(() => parseProfileEdit({ fullName: "x".repeat(81) }, TODAY)) === "invalid-argument", "plus de 80 caractères → refusé");
assert(codeOf(() => parseProfileEdit({ fullName: 42 }, TODAY)) === "invalid-argument", "pas du texte → refusé");

console.log("\nDate de naissance");
assert(parseProfileEdit({ dateOfBirth: "1982-02-11" }, TODAY).dateOfBirth === "1982-02-11", "date valide gardée telle quelle");
assert(codeOf(() => parseProfileEdit({ dateOfBirth: "11/02/1982" }, TODAY)) === "invalid-argument", "format jj/mm/aaaa → refusé (le champ date envoie aaaa-mm-jj)");
assert(codeOf(() => parseProfileEdit({ dateOfBirth: "1982-02-30" }, TODAY)) === "invalid-argument", "30 février → refusé");
assert(codeOf(() => parseProfileEdit({ dateOfBirth: "2026-10-08" }, TODAY)) === "invalid-argument", "date future → refusée");
assert(parseProfileEdit({ dateOfBirth: "2026-10-07" }, TODAY).dateOfBirth === "2026-10-07", "né aujourd'hui → accepté");
assert(codeOf(() => parseProfileEdit({ dateOfBirth: "1899-12-31" }, TODAY)) === "invalid-argument", "avant 1900 → refusée");

console.log("\nTéléphone");
assert(parseProfileEdit({ phone: "06 61 74 72 44" }, TODAY).phone === "06 61 74 72 44", "format marocain avec espaces accepté");
assert(parseProfileEdit({ phone: "+212661747244" }, TODAY).phone === "+212661747244", "format international accepté");
assert(codeOf(() => parseProfileEdit({ phone: "0661" }, TODAY)) === "invalid-argument", "moins de 8 chiffres → refusé");
assert(codeOf(() => parseProfileEdit({ phone: "06 61 abc 44" }, TODAY)) === "invalid-argument", "lettres → refusé");

console.log("\nChamps présents seulement");
const only = parseProfileEdit({ fullName: "Otman Mai" }, TODAY);
assert(Object.keys(only).join(",") === "fullName", "seul le nom envoyé → seul le nom corrigé");
assert(Object.keys(parseProfileEdit({}, TODAY)).length === 0, "rien envoyé → rien (le callable répond « Rien à corriger »)");

console.log("\nDifférences");
const cur = { fullName: "Otmn", dateOfBirth: "1982-02-11", phone: "0661747244" };
const diff = profileDiff(cur, { fullName: "Otman Mai", dateOfBirth: "1982-02-11", phone: "0661747244" });
assert(Object.keys(diff).join(",") === "fullName", "seul ce qui change est enregistré");
assert(diff.fullName.from === "Otmn" && diff.fullName.to === "Otman Mai", "ancienne et nouvelle valeur gardées pour la trace");
assert(Object.keys(profileDiff(cur, { phone: "0661747244" })).length === 0, "même valeur → aucune modification");
assert(profileDiff({}, { phone: "0661747244" }).phone.from === "", "champ absent avant → « » comme ancienne valeur");

console.log("");
console.log(failures === 0 ? "Tout est vert." : `${failures} assertion(s) en échec.`);
process.exit(failures === 0 ? 0 : 1);
