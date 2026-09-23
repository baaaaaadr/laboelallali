/**
 * Unit-drives the PURE decision rules of `adminSetPractitioner`
 * (lib/admin/adminPractitioner.js) — the gate that gives an account a doctor's
 * whole roster of named results.
 *
 * What it asserts:
 *   - a prescriber code is validated and canonicalised (capitals, no spaces);
 *   - a patient type is never a practitioner type;
 *   - the displayed label is bounded;
 *   - a code equal to one of the account's patient ids is detected;
 *   - the activation gate: a lab outage always refuses, an unknown code or a
 *     code already held elsewhere refuses unless explicitly confirmed;
 *   - the admin screen only ever sees a VALID access (same test as fetchResults);
 *   - the patient-grouping key ignores accents, case and punctuation.
 *
 * Requires a build first (npm run build) so lib/ exists. No network, no Firebase.
 *   node scripts/test-practitioner-admin.js
 * Exits non-zero when any assertion failed.
 */
const path = require("path");
const FN_DIR = path.join(__dirname, "..");
const {
  parsePractitionerInput,
  collidesWithPatientIds,
  activationRefusal,
  readPractitionerDTO,
  patientKey,
} = require(path.join(FN_DIR, "lib/admin/adminPractitioner"));

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
/** The HttpsError message, or null when nothing was thrown. */
function thrown(fn) {
  try {
    fn();
    return null;
  } catch (e) {
    return String(e && e.message);
  }
}

section("Code du médecin : validation et forme canonique");
{
  const ok = parsePractitionerInput({ requester_id: "MOUSTZOU", label: "Dr Moustadraf Zouhair" });
  assert(ok.code === "MOUSTZOU" && ok.type === "medecin", "code Qalam valide, type médecin par défaut");
  assert(
    parsePractitionerInput({ requester_id: " mous tzou ", label: "Dr X Y" }).code === "MOUSTZOU",
    "minuscules et espaces : ramené à la forme canonique"
  );
  assert(
    parsePractitionerInput({ requester_id: "TESTA", type: "correspondant", label: "Clinique" }).type ===
      "correspondant",
    "un correspondant (clinique) est accepté"
  );
  assert(thrown(() => parsePractitionerInput({ label: "Dr X Y" })) !== null, "code absent → refusé");
  assert(
    thrown(() => parsePractitionerInput({ requester_id: "MOUST'ZOU", label: "Dr X Y" })) !== null,
    "caractère interdit (apostrophe) → refusé"
  );
  assert(
    thrown(() => parsePractitionerInput({ requester_id: "M", label: "Dr X Y" })) !== null,
    "code d'un seul caractère → refusé"
  );
  assert(
    thrown(() => parsePractitionerInput({ requester_id: "A".repeat(33), label: "Dr X Y" })) !== null,
    "code de plus de 32 caractères → refusé"
  );
}

section("Type et libellé");
{
  assert(
    thrown(() => parsePractitionerInput({ requester_id: "MOUSTZOU", type: "patient", label: "Dr X Y" })) !==
      null,
    "le type « patient » n'est JAMAIS un accès praticien"
  );
  assert(
    thrown(() => parsePractitionerInput({ requester_id: "MOUSTZOU", type: "chirurgien", label: "Dr X Y" })) !==
      null,
    "type inconnu → refusé"
  );
  assert(thrown(() => parsePractitionerInput({ requester_id: "MOUSTZOU", label: "Dr" })) !== null, "libellé trop court → refusé");
  assert(thrown(() => parsePractitionerInput({ requester_id: "MOUSTZOU" })) !== null, "libellé absent → refusé pour écrire");
  assert(
    parsePractitionerInput({ requester_id: "MOUSTZOU" }, false).code === "MOUSTZOU",
    "…mais accepté pour une simple vérification (dry run)"
  );
  assert(
    thrown(() => parsePractitionerInput({ requester_id: "MOUSTZOU", label: "Dr" }, false)) !== null,
    "un libellé saisi reste contrôlé même en vérification"
  );
  assert(
    thrown(() => parsePractitionerInput({ requester_id: "MOUSTZOU", label: "x".repeat(61) })) !== null,
    "libellé de plus de 60 caractères → refusé"
  );
}

section("Collision avec les dossiers patient du compte");
{
  const user = { requester_id: "7587", linkedRequesterIds: ["1001", "ab12"] };
  assert(collidesWithPatientIds("7587", user), "code = dossier propre → collision");
  assert(collidesWithPatientIds("AB12", user), "code = proche (casse différente) → collision");
  assert(!collidesWithPatientIds("MOUSTZOU", user), "code sans rapport → pas de collision");
  assert(!collidesWithPatientIds("MOUSTZOU", {}), "compte sans dossier → pas de collision");
  assert(
    collidesWithPatientIds("67305", { requester_id: "67 305" }),
    "dossier propre pollué d'espaces (« 67 305 ») → collision détectée quand même"
  );
}

section("Porte d'activation");
{
  const ok = { status: "ok", dossierCount: 5, patientCount: 3 };
  const unknown = { status: "unknown", dossierCount: 0, patientCount: 0 };
  const down = { status: "error", dossierCount: 0, patientCount: 0 };
  const other = [{ uid: "u2", fullName: "Secrétaire", email: null }];

  assert(activationRefusal(ok, [], {}) === null, "code reconnu, non partagé → activé");
  assert(activationRefusal(unknown, [], {}) === "unknown_code", "code inconnu du labo → refusé");
  assert(activationRefusal(unknown, [], { allowUnknown: true }) === null, "…sauf confirmation explicite");
  assert(activationRefusal(ok, other, {}) === "shared_code", "code déjà sur un autre compte → refusé");
  assert(activationRefusal(ok, other, { allowShared: true }) === null, "…sauf confirmation explicite (cas par cas)");
  assert(
    activationRefusal(down, [], { allowUnknown: true, allowShared: true }) === "lab_error",
    "serveur du labo en panne → refusé, AUCUNE case ne permet de passer outre"
  );
  assert(
    activationRefusal(unknown, other, { allowUnknown: true }) === "shared_code",
    "les deux confirmations sont indépendantes"
  );
}

section("Ce que l'écran admin voit de l'accès");
{
  const dto = readPractitionerDTO({
    practitioner: { requester_id: "moustzou", type: "medecin", label: "Dr Moustadraf Zouhair" },
  });
  assert(dto && dto.requester_id === "MOUSTZOU", "accès valide → code canonique");
  assert(dto && dto.label === "Dr Moustadraf Zouhair", "…avec son libellé");
  assert(dto && dto.linkedAt === null && dto.lastUsedAt === null, "dates absentes → null, sans erreur");
  assert(readPractitionerDTO({ practitioner: { requester_id: "X1", type: "patient" } }) === null, "type patient → aucun accès affiché");
  assert(readPractitionerDTO({ practitioner: { type: "medecin" } }) === null, "code absent → aucun accès affiché");
  assert(readPractitionerDTO({}) === null && readPractitionerDTO(undefined) === null, "pas de champ → null");
}

section("Clé de regroupement par patient (même règle que l'app)");
{
  assert(patientKey("FICTIF", "Hanaé") === patientKey("fictif", "HANAE"), "accents et casse ignorés");
  assert(patientKey("EL  ALLALI", "Aya") === patientKey("El-Allali", "aya"), "espaces multiples et tiret ignorés");
  assert(patientKey("DÉMO", "Amina") !== patientKey("DÉMO", "Karim"), "prénoms différents → patients différents");
}

console.log("");
if (failures === 0) {
  console.log("Tout est vert.");
} else {
  console.log(`${failures} assertion(s) en échec.`);
}
process.exit(failures === 0 ? 0 : 1);
