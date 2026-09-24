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
 *   - the patient-grouping key ignores accents, case and punctuation;
 *   - the doctor's own request form, and its confidentiality engagement;
 *   - the engagement record (current text only) and the per-doctor usage
 *     summary (days of visit, reports opened, « ce mois-ci »).
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
  assert(
    patientKey("", "", "D1") !== patientKey("", " ", "D2"),
    "deux bilans SANS nom → deux patients (jamais fusionnés, comme dans « Mes patients »)"
  );
  assert(patientKey("", "", "D1") === "#dossier:D1", "bilan sans nom → clé sur son numéro de dossier");
}

section("Demande d'accès faite par le médecin (parsePractitionerRequest)");
{
  const { parsePractitionerRequest } = require(path.join(FN_DIR, "lib/admin/practitionerRequests"));
  const codeOf = (fn) => {
    try {
      fn();
      return null;
    } catch (e) {
      return e.code || "erreur";
    }
  };
  assert(
    codeOf(() => parsePractitionerRequest({ label: "Dr Démo Banc" })) === "invalid-argument",
    "case « je suis médecin » non cochée → refusée"
  );
  assert(
    codeOf(() => parsePractitionerRequest({ label: "Dr Démo Banc", attest: "true" })) === "invalid-argument",
    "« attest » doit être un vrai booléen, pas le texte \"true\""
  );
  assert(codeOf(() => parsePractitionerRequest({ label: "Dr", attest: true })) === "invalid-argument", "nom trop court → refusé");
  const ok = parsePractitionerRequest({ label: "  Dr   Démo  Banc ", specialty: " Cardiologie ", place: "Agadir", attest: true });
  assert(
    ok.label === "Dr Démo Banc" && ok.specialty === "Cardiologie" && ok.place === "Agadir",
    "espaces nettoyés, les trois champs gardés"
  );
  const bare = parsePractitionerRequest({ label: "Dr Démo Banc", attest: true });
  assert(bare.specialty === "" && bare.place === "", "spécialité et ville facultatives");
  assert(
    codeOf(() => parsePractitionerRequest({ label: "Dr Démo Banc", specialty: "x".repeat(61), attest: true })) === "invalid-argument",
    "spécialité de plus de 60 caractères → refusée"
  );
  assert(
    codeOf(() => parsePractitionerRequest({ label: "Dr Démo Banc", place: "x".repeat(81), attest: true })) === "invalid-argument",
    "ville / cabinet de plus de 80 caractères → refusé"
  );
  // L'engagement de confidentialité coché sur le formulaire.
  const { PRACTITIONER_ENGAGEMENT_VERSION: V } = require(path.join(FN_DIR, "lib/admin/practitionerEngagement"));
  assert(
    parsePractitionerRequest({ label: "Dr Démo Banc", attest: true, engagement: V }).engagement === true,
    "engagement accepté pour le texte ACTUEL → enregistré"
  );
  assert(
    bare.engagement === false,
    "sans engagement (page d'avant) → la demande passe, l'engagement sera demandé à sa première visite"
  );
  assert(
    parsePractitionerRequest({ label: "Dr Démo Banc", attest: true, engagement: V - 1 }).engagement === false &&
      parsePractitionerRequest({ label: "Dr Démo Banc", attest: true, engagement: String(V) }).engagement === false,
    "ancienne version, ou version en texte → pas d'engagement enregistré"
  );
}

section("Engagement de confidentialité (engagementOf)");
{
  const { engagementOf, PRACTITIONER_ENGAGEMENT_VERSION: V } = require(path.join(FN_DIR, "lib/admin/practitionerEngagement"));
  const ts = (ms) => ({ toMillis: () => ms });
  const e = engagementOf({ practitionerEngagement: { version: V, acceptedAt: ts(1727170000000), via: "request" } });
  assert(e && e.version === V && e.acceptedAt === 1727170000000 && e.via === "request", "engagement actuel : version, date, origine");
  assert(engagementOf({ practitionerEngagement: { version: V - 1, acceptedAt: ts(1) } }) === null, "texte plus ancien → à redemander");
  assert(engagementOf({ practitionerEngagement: { version: String(V) } }) === null, "version en texte → ignorée");
  assert(
    engagementOf({ practitionerEngagement: [V] }) === null && engagementOf({}) === null && engagementOf(undefined) === null,
    "forme invalide ou absente → null, sans erreur"
  );
  const noDate = engagementOf({ practitionerEngagement: { version: V } });
  assert(noDate && noDate.acceptedAt === null, "date illisible → engagement reconnu, date null");
  const { readPractitionerDTO: dtoOf } = require(path.join(FN_DIR, "lib/admin/adminPractitioner"));
  const withE = dtoOf({
    practitioner: { requester_id: "DRDEMO", type: "medecin", label: "Dr Démo" },
    practitionerEngagement: { version: V, acceptedAt: ts(5) },
  });
  assert(withE && withE.engaged === true && withE.engagementAt === 5, "la carte admin voit l'engagement et sa date");
  const withoutE = dtoOf({ practitioner: { requester_id: "DRDEMO", type: "medecin", label: "Dr Démo" } });
  assert(withoutE && withoutE.engaged === false && withoutE.engagementAt === null, "…et son absence");
}

section("Utilisation par médecin (usageSummary, isNewDay)");
{
  const { usageSummary, isNewDay, dayKeyUTC } = require(path.join(FN_DIR, "lib/admin/practitionerUsage"));
  const ts = (ms) => ({ toMillis: () => ms });
  const now = new Date(Date.UTC(2026, 8, 24, 10, 0));
  const u = usageSummary(
    {
      days: 5,
      reports: 12,
      firstAt: ts(1),
      lastAt: ts(2),
      lastReportAt: ts(3),
      months: { "2026-08": { days: 2, reports: 4 }, "2026-09": { days: 3, reports: 8 } },
    },
    now
  );
  assert(u.days === 5 && u.reports === 12, "totaux depuis le début");
  assert(u.monthDays === 3 && u.monthReports === 8, "« ce mois-ci » = septembre 2026, pas août");
  assert(u.firstAt === 1 && u.lastAt === 2 && u.lastReportAt === 3, "dates en millisecondes");
  const empty = usageSummary(undefined, now);
  assert(
    empty.days === 0 && empty.reports === 0 && empty.monthDays === 0 && empty.lastAt === null,
    "médecin jamais venu → zéros et dates nulles"
  );
  const junk = usageSummary({ days: -3, reports: "7", months: { "2026-09": "x" } }, now);
  assert(junk.days === 0 && junk.reports === 0 && junk.monthReports === 0, "valeurs invalides → zéro, sans erreur");
  assert(dayKeyUTC(new Date(Date.UTC(2026, 8, 24, 23, 30))) === "2026-09-24", "jour compté en UTC (convention usageDaily)");
  assert(isNewDay(undefined, "2026-09-24") && isNewDay("2026-09-23", "2026-09-24"), "premier passage du jour → un jour de plus");
  assert(!isNewDay("2026-09-24", "2026-09-24"), "deuxième passage le même jour → pas de jour en plus");
}

console.log("");
if (failures === 0) {
  console.log("Tout est vert.");
} else {
  console.log(`${failures} assertion(s) en échec.`);
}
process.exit(failures === 0 ? 0 : 1);
