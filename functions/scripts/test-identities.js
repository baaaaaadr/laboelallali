/**
 * Unit-drives the PURE identity resolver (lib/cyberlab/identities.js) — the
 * authorization boundary of the "ayant droit" feature.
 *
 * What it asserts:
 *   - the own dossier always comes first;
 *   - an account with no dossier of its own falls back to its first relative;
 *   - an explicit id is honoured only when it is in the authorized list;
 *   - an unauthorized id is refused, and is indistinguishable from an unknown one;
 *   - whitespace-corrupted ids ("67 305") still match on both sides;
 *   - malformed rows are skipped, never fatal;
 *   - the cap on attached dossiers holds.
 *
 * Requires a build first (npm run build) so lib/ exists. No network, no Firebase.
 *   node scripts/test-identities.js
 * Exits non-zero when any assertion failed.
 */
const path = require("path");
const FN_DIR = path.join(__dirname, "..");
const {
  authorizedIdentities,
  resolveIdentity,
  wasRefused,
  practitionerIdentity,
  hasAnyIdentity,
  normalizePractitionerId,
  PRACTITIONER_TYPES,
  MAX_LINKED_REQUESTERS,
} = require(path.join(FN_DIR, "lib/cyberlab/identities"));

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${msg}`);
  }
}
function section(title) {
  console.log(`\n${title}`);
}

const link = (id, label = "Proche", type = "patient") => ({
  requester_id: id,
  type,
  label,
  linkedBy: "staff-uid",
});

// ── 1. Own dossier only (the behaviour that existed before this feature) ─────
section("Compte avec son seul dossier");
{
  const data = { requester_id: "7587", type: "patient" };
  const ids = authorizedIdentities(data);
  assert(ids.length === 1, "une seule identité");
  assert(ids[0].requester_id === "7587" && ids[0].isSelf, "c'est bien la sienne");
  assert(resolveIdentity(data).requester_id === "7587", "sans sélecteur → la sienne");
  assert(resolveIdentity(data, "7587").requester_id === "7587", "avec son propre id → la sienne");
  assert(resolveIdentity(data, "9999") === null, "un autre id est refusé");
  assert(wasRefused(data, "9999"), "et le refus est signalé comme tel");
  assert(!wasRefused(data), "aucun refus quand rien n'est demandé");
}

// ── 2. Own dossier + relatives ──────────────────────────────────────────────
section("Compte avec son dossier et deux proches");
{
  const data = {
    requester_id: "7587",
    type: "patient",
    linkedRequesters: [link("1001", "Papa"), link("1002", "Maman")],
  };
  const ids = authorizedIdentities(data);
  assert(ids.length === 3, "trois identités");
  assert(ids[0].requester_id === "7587" && ids[0].isSelf, "la sienne en tête");
  assert(ids[1].requester_id === "1001" && !ids[1].isSelf, "puis Papa, non-self");
  assert(ids[2].requester_id === "1002", "puis Maman, dans l'ordre du labo");
  assert(resolveIdentity(data).requester_id === "7587", "par défaut → la sienne");
  assert(resolveIdentity(data, "1002").requester_id === "1002", "sélection d'un proche autorisée");
  assert(resolveIdentity(data, "1003") === null, "un proche non rattaché est refusé");
}

// ── 3. Helper-only account — the decision that drives the home page ──────────
section("Compte sans dossier propre (aidant seul)");
{
  const data = { linkedRequesters: [link("1001", "Papa"), link("1002", "Maman")] };
  const ids = authorizedIdentities(data);
  assert(ids.length === 2, "deux identités, aucune self");
  assert(ids.every((x) => !x.isSelf), "aucune n'est marquée self");
  assert(resolveIdentity(data).requester_id === "1001", "le premier proche devient le principal");
  assert(resolveIdentity(data, "1002").requester_id === "1002", "l'autre reste sélectionnable");
}

// ── 4. Nothing at all ───────────────────────────────────────────────────────
section("Compte sans rien");
{
  assert(authorizedIdentities({}).length === 0, "aucune identité");
  assert(resolveIdentity({}) === null, "rien à résoudre");
  assert(resolveIdentity({}, "7587") === null, "et aucun id ne passe");
  assert(authorizedIdentities({ requester_id: "7587" }).length === 0, "id sans type → ignoré");
  assert(
    authorizedIdentities({ requester_id: "7587", type: "chirurgien" }).length === 0,
    "type inconnu → ignoré"
  );
}

// ── 5. Whitespace — the bug that already hit a real patient ─────────────────
section("Identifiants pollués par des espaces");
{
  const data = { requester_id: "67 305", type: "patient" };
  assert(authorizedIdentities(data)[0].requester_id === "67305", "l'id stocké est normalisé");
  assert(resolveIdentity(data, "67305").requester_id === "67305", "un id propre retrouve l'id sale");
  assert(resolveIdentity(data, "67 305").requester_id === "67305", "et inversement");

  const linked = { linkedRequesters: [link("1 001", "Papa")] };
  assert(resolveIdentity(linked, "1001").requester_id === "1001", "vaut aussi pour les proches");
}

// ── 6. Malformed rows must never lock a patient out ─────────────────────────
section("Lignes malformées");
{
  const data = {
    requester_id: "7587",
    type: "patient",
    linkedRequesters: [
      null,
      "pas un objet",
      { type: "patient" }, // id manquant
      { requester_id: "1001" }, // type manquant
      { requester_id: "1002", type: "inconnu" }, // type invalide
      link("1003", "Papa"), // la seule valide
    ],
  };
  const ids = authorizedIdentities(data);
  assert(ids.length === 2, "seules la sienne et la ligne valide survivent");
  assert(ids[1].requester_id === "1003", "la ligne valide est bien retenue");
  assert(resolveIdentity(data).requester_id === "7587", "le dossier propre reste accessible");

  assert(
    authorizedIdentities({ requester_id: "7587", type: "patient", linkedRequesters: "oups" })
      .length === 1,
    "un champ non-tableau est ignoré sans casser"
  );
}

// ── 7. Duplicates and the cap ───────────────────────────────────────────────
section("Doublons et plafond");
{
  const dup = {
    requester_id: "7587",
    type: "patient",
    linkedRequesters: [link("7587", "Moi en double"), link("1001", "Papa")],
  };
  const ids = authorizedIdentities(dup);
  assert(ids.length === 2, "un proche égal au dossier propre est dédoublonné");
  assert(ids[0].isSelf, "et c'est la version self qui gagne");

  const many = {
    requester_id: "7587",
    type: "patient",
    linkedRequesters: Array.from({ length: MAX_LINKED_REQUESTERS + 5 }, (_, i) =>
      link(String(2000 + i), `Proche ${i}`)
    ),
  };
  assert(
    authorizedIdentities(many).length === MAX_LINKED_REQUESTERS + 1,
    `le plafond de ${MAX_LINKED_REQUESTERS} proches est appliqué à la lecture`
  );
}

// ── 8. No enumeration oracle ────────────────────────────────────────────────
section("Pas d'oracle d'énumération");
{
  const data = { requester_id: "7587", type: "patient", linkedRequesters: [link("1001")] };
  // Un id qui existe ailleurs au labo et un id qui n'existe nulle part doivent
  // produire exactement la même réponse : null, sans distinction observable.
  assert(resolveIdentity(data, "1002") === null, "id d'un autre patient → null");
  assert(resolveIdentity(data, "999999") === null, "id inexistant → null");
  assert(
    wasRefused(data, "1002") === wasRefused(data, "999999"),
    "les deux refus sont indiscernables"
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Accès PRATICIEN (médecin prescripteur) — ajouté le 23/09/2026.
// Le risque : un code médecin ouvre les résultats NOMINATIFS de toute sa
// patientèle. Il ne doit JAMAIS devenir l'identité par défaut (l'accueil
// afficherait le bilan d'un patient comme « VOTRE dernier bilan »), et ne doit
// répondre qu'à une demande explicite et exacte.
// ═════════════════════════════════════════════════════════════════════════════
const PRO = { requester_id: "DRDEMO", type: "medecin", label: "Dr Démo" };

// ── 9. Jamais l'identité par défaut ─────────────────────────────────────────
section("Praticien : jamais l'identité par défaut");
{
  const both = { requester_id: "7587", type: "patient", practitioner: PRO };
  assert(resolveIdentity(both).requester_id === "7587", "médecin-patient : par défaut, SON dossier");
  assert(resolveIdentity(both).kind === "self", "…de nature « self »");
  assert(
    authorizedIdentities(both).every((x) => x.kind !== "practitioner"),
    "la liste des identités patient ne contient jamais le praticien"
  );
  const proOnly = { practitioner: PRO };
  assert(resolveIdentity(proOnly) === null, "médecin sans dossier : aucun dossier par défaut");
  assert(authorizedIdentities(proOnly).length === 0, "…et aucune identité patient");
  const withRelative = { practitioner: PRO, linkedRequesters: [link("1001", "Papa")] };
  assert(
    resolveIdentity(withRelative).requester_id === "1001",
    "médecin avec un proche : le proche reste le principal, pas le code médecin"
  );
}

// ── 10. Sélection explicite ─────────────────────────────────────────────────
section("Praticien : seulement sur sélection explicite et exacte");
{
  const data = { requester_id: "7587", type: "patient", practitioner: PRO };
  const r = resolveIdentity(data, "DRDEMO");
  assert(r && r.kind === "practitioner", "le code exact → l'identité praticien");
  assert(r && r.type === "medecin" && !r.isSelf, "de type médecin, jamais « self »");
  assert(resolveIdentity(data, " drdemo ")?.requester_id === "DRDEMO", "casse et espaces tolérés");
  assert(resolveIdentity(data, "DRAUTRE") === null, "le code d'un autre médecin est refusé");
  assert(
    wasRefused(data, "DRAUTRE") === wasRefused(data, "INCONNU"),
    "refus indiscernable d'un code inexistant (pas d'oracle)"
  );
  assert(resolveIdentity(data, "7587").kind === "self", "son propre dossier reste accessible");
}

// ── 11. Compte médecin seul ─────────────────────────────────────────────────
section("Praticien : compte médecin sans dossier personnel");
{
  const proOnly = { practitioner: PRO };
  assert(hasAnyIdentity(proOnly), "le compte a bien un accès");
  assert(resolveIdentity(proOnly, "DRDEMO")?.kind === "practitioner", "son code fonctionne");
  assert(!hasAnyIdentity({}), "un compte vide n'a aucun accès");
}

// ── 12. Accès retiré ────────────────────────────────────────────────────────
section("Praticien : accès retiré par le laboratoire");
{
  const revoked = { requester_id: "7587", type: "patient" };
  assert(resolveIdentity(revoked, "DRDEMO") === null, "le code ne passe plus");
  assert(practitionerIdentity(revoked) === null, "plus d'identité praticien");
  const cleared = { practitioner: null };
  assert(practitionerIdentity(cleared) === null, "un champ vidé (null) est sans effet");
}

// ── 13. Valeurs malformées ──────────────────────────────────────────────────
section("Praticien : valeurs malformées ignorées, jamais fatales");
{
  const bad = [
    ["type patient", { requester_id: "DRDEMO", type: "patient" }],
    ["type absent", { requester_id: "DRDEMO" }],
    ["type inconnu", { requester_id: "DRDEMO", type: "chirurgien" }],
    ["code vide", { requester_id: "   ", type: "medecin" }],
    ["tableau", [PRO]],
    ["chaîne", "DRDEMO"],
    ["nombre", 42],
  ];
  for (const [label, value] of bad) {
    assert(practitionerIdentity({ practitioner: value }) === null, `${label} → ignoré`);
  }
  const data = { requester_id: "7587", type: "patient", practitioner: [PRO] };
  assert(resolveIdentity(data).requester_id === "7587", "le dossier propre reste accessible");
  assert(!PRACTITIONER_TYPES.includes("patient"), "« patient » n'est jamais un type praticien");
  assert(
    practitionerIdentity({ practitioner: { requester_id: "TESTA", type: "correspondant" } })?.type ===
      "correspondant",
    "un correspondant (clinique) est accepté"
  );
  assert(normalizePractitionerId(" mous tzou ") === "MOUSTZOU", "normalisation : espaces retirés, majuscules");
}

// ── 14. Collisions : le côté patient l'emporte ──────────────────────────────
section("Praticien : collision avec un dossier patient");
{
  const own = { requester_id: "ABC1", type: "patient", practitioner: { requester_id: "abc1", type: "medecin" } };
  assert(resolveIdentity(own, "ABC1").kind === "self", "code = dossier propre → le dossier propre");
  const rel = {
    requester_id: "7587",
    type: "patient",
    linkedRequesters: [link("XY9", "Papa")],
    practitioner: { requester_id: "XY9", type: "medecin" },
  };
  assert(resolveIdentity(rel, "XY9").kind === "linked", "code = proche → le proche, jamais la patientèle");
}

// ── 15. La nature des identités patient ─────────────────────────────────────
section("Nature des identités (télémétrie)");
{
  const data = { requester_id: "7587", type: "patient", linkedRequesters: [link("1001")] };
  const ids = authorizedIdentities(data);
  assert(ids[0].kind === "self" && ids[0].isSelf, "le dossier propre est « self »");
  assert(ids[1].kind === "linked" && !ids[1].isSelf, "un proche est « linked »");
}

console.log("");
if (failures === 0) {
  console.log("Tout est vert.");
} else {
  console.log(`${failures} assertion(s) en échec.`);
}
process.exit(failures === 0 ? 0 : 1);
