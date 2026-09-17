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

console.log("");
if (failures === 0) {
  console.log("Tout est vert.");
} else {
  console.log(`${failures} assertion(s) en échec.`);
}
process.exit(failures === 0 ? 0 : 1);
