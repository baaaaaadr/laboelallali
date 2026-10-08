/**
 * Unit-drives the identity of an attached relative (08/10/2026):
 * `lib/admin/relativeIdentity.js` (validation, name matching, the lab's
 * « NOM prénom » split) and `hintsFor` in `lib/admin/adminPatients.js` — the
 * « peut-être déjà connu comme proche » rule (the mother attached as « Maman »
 * of her daughter, who later creates her own account).
 * Requires `npm run build`. No network.   node scripts/test-relative-identity.js
 */
const path = require("path");
const R = require(path.join(__dirname, "..", "lib/admin/relativeIdentity"));
const { hintsFor } = require(path.join(__dirname, "..", "lib/admin/adminPatients"));

let failures = 0;
const assert = (c, m, extra) => {
  if (c) console.log(`  ✓ ${m}`);
  else {
    failures++;
    console.error(`  ✗ ${m}${extra ? ` — ${extra}` : ""}`);
  }
};
const TODAY = new Date(Date.UTC(2026, 9, 8));

console.log("\nIdentité saisie par l'accueil");
let r = R.parseRelativeIdentity({ lastName: "  NIA ", firstName: "Fatima   Zahra", dateOfBirth: "1955-03-02" }, TODAY);
assert(r.ok && r.value.lastName === "NIA" && r.value.firstName === "Fatima Zahra", "nom et prénom nettoyés");
assert(R.parseRelativeIdentity({ firstName: "Fatima", dateOfBirth: "1955-03-02" }, TODAY).field === "lastName", "nom manquant → signalé en premier");
assert(R.parseRelativeIdentity({ lastName: "NIA", firstName: "F", dateOfBirth: "1955-03-02" }, TODAY).field === "firstName", "prénom d'une lettre → refusé");
assert(R.parseRelativeIdentity({ lastName: "NIA", firstName: "Fatima", dateOfBirth: "1955-02-30" }, TODAY).field === "dateOfBirth", "30 février → refusé");
assert(R.parseRelativeIdentity({ lastName: "NIA", firstName: "Fatima", dateOfBirth: "2027-01-01" }, TODAY).field === "dateOfBirth", "date future → refusée");
assert(R.parseRelativeIdentity({ lastName: "NIA", firstName: "Fatima", dateOfBirth: "1899-12-31" }, TODAY).field === "dateOfBirth", "avant 1900 → refusée");
assert(R.parseRelativeIdentity(null, TODAY).ok === false, "rien d'envoyé → refusé");

console.log("\nRecherche par le nom du proche");
assert(R.queryMatchesName("fatima nia", "NIA Fatima"), "« fatima nia » trouve « NIA Fatima » (ordre libre)");
assert(R.queryMatchesName("Nïa", "NIA Fatima"), "accents et majuscules ignorés");
assert(R.queryMatchesName("fat", "NIA Fatima"), "un début de prénom suffit");
assert(!R.queryMatchesName("fatima benali", "NIA Fatima"), "un mot absent → pas trouvé");
assert(R.queryMatchesName("el allali", "EL-ALLALI Mohamed"), "le tiret ne gêne pas");
assert(R.queryMatchesName("فاطمة", "فاطمة نيا"), "écriture arabe conservée");
assert(!R.queryMatchesName("  ", "NIA Fatima"), "requête vide → rien");

console.log("\nLa recherche admin trouve le compte par son proche");
const links = [
  { requester_id: "183513", label: "Maman", lastName: "NIA", firstName: "Fatima", dateOfBirth: "1955-03-02" },
  { requester_id: "200001", label: "Papa" }, // rattaché avant le 08/10/2026 : sans identité
];
assert(R.relativeMatches("fatima nia", links).length === 1, "« fatima nia » → la ligne « Maman »");
assert(R.relativeMatches("1955", links).length === 1, "par année de naissance");
assert(R.relativeMatches("Papa", links).length === 0, "le libellé seul ne suffit pas (pas d'identité → introuvable par le nom)");
assert(R.relativeMatches("f", links).length === 0, "une seule lettre → rien");
assert(R.relativeMatches("benali", links).length === 0, "autre nom → rien");

console.log("\nNom renvoyé par le laboratoire (« NOM prénom »)");
let s = R.splitLabName("EL ALLALI mohamed aziz");
assert(s && s.lastName === "EL ALLALI" && s.firstName === "mohamed aziz", "« EL ALLALI mohamed aziz » → nom EL ALLALI, prénom mohamed aziz");
s = R.splitLabName("NIA fatima");
assert(s && s.lastName === "NIA" && s.firstName === "fatima", "« NIA fatima »");
assert(R.splitLabName("fatima nia") === null, "tout en minuscules → on ne devine pas");
assert(R.splitLabName("NIA FATIMA") === null, "tout en majuscules → on ne devine pas");
assert(R.splitLabName("NIA fatima ZAHRA") === null, "majuscules mêlées → on ne devine pas");

console.log("\nNoms proches, dates de naissance");
assert(R.namesOverlap("NIA Fatima", "Fatima Nia"), "mêmes mots → même nom possible");
assert(!R.namesOverlap("EL Fatima", "EL Hassania"), "« el » seul ne compte pas (trop court)");
assert(JSON.stringify(R.relativeDobs([{ dateOfBirth: "1955-03-02" }, {}, { dateOfBirth: "1955-03-02" }, { dateOfBirth: "2012-01-09" }])) === '["1955-03-02","2012-01-09"]', "dates de naissance aplaties, sans doublon");
assert(R.identityLabel({ lastName: "NIA", firstName: "Fatima" }) === "NIA Fatima", "affichage « NOM Prénom »");

console.log("\nLa maman crée ensuite son propre compte");
const entry = (over) => ({
  requester_id: "183513", type: "patient", label: "Maman", linkedAt: null,
  lastName: "NIA", firstName: "Fatima", dateOfBirth: "1955-03-02",
  holderUid: "uid-hassania", holderName: "Hassania2026 Nia", ...over,
});
const mom = { uid: "uid-maman", fullName: "Fatima Nia", dateOfBirth: "1955-03-02", requester_id: "" };
let h = hintsFor(mom, [entry({})]);
assert(h.length === 1 && h[0].nameMatch && !h[0].shared && h[0].requester_id === "183513", "même nom + même date → « peut-être déjà connue comme proche », dossier 183513");
h = hintsFor({ ...mom, fullName: "فاطمة نيا" }, [entry({})]);
assert(h.length === 1 && !h[0].nameMatch, "nom écrit en arabe, même date, pas encore de dossier → proposé quand même (à vérifier)");
h = hintsFor({ ...mom, requester_id: "900001" }, [entry({ lastName: "AUTRE", firstName: "Personne" })]);
assert(h.length === 0, "même date seulement, mais elle a déjà SON dossier → rien (simple coïncidence)");
h = hintsFor({ ...mom, requester_id: "183513", dateOfBirth: "" }, [entry({ lastName: "", firstName: "", dateOfBirth: "" })]);
assert(h.length === 1 && h[0].shared, "son propre dossier est rattaché ailleurs → signalé (certain), même sans identité");
h = hintsFor({ ...mom, uid: "uid-hassania" }, [entry({})]);
assert(h.length === 0, "jamais un indice qui renvoie au compte lui-même");
h = hintsFor({ ...mom, dateOfBirth: "1960-01-01" }, [entry({})]);
assert(h.length === 0, "autre date de naissance → rien");
const many = Array.from({ length: 8 }, (_, i) => entry({ holderUid: `u${i}`, requester_id: `1000${i}` }));
assert(hintsFor(mom, many).length === 5, "5 indices au plus");
h = hintsFor({ ...mom, requester_id: "" }, [entry({ lastName: "X", firstName: "Y", holderUid: "a" }), entry({ holderUid: "b" })]);
assert(h[0].holderUid === "b" && h[0].nameMatch, "le plus probable d'abord");

console.log(failures === 0 ? "\nTout est vert." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
