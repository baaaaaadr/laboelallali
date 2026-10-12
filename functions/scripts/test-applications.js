/**
 * Unit-drives the « Emploi & Stage » rules (`lib/hr/applicationRules.js`) and
 * e-mails (`lib/hr/applicationEmails.js`): which fields each type of request
 * requires, the files' REAL format, the anti-spam limits, the 6-month erasure,
 * and what the two e-mails may and may not contain.
 * Requires `npm run build`. No network.   node scripts/test-applications.js
 */
const path = require("path");
const R = require(path.join(__dirname, "..", "lib/hr/applicationRules"));
const E = require(path.join(__dirname, "..", "lib/hr/applicationEmails"));

let failures = 0;
const assert = (c, m, extra) => {
  if (c) console.log(`  ✓ ${m}`);
  else {
    failures++;
    console.error(`  ✗ ${m}${extra ? ` — ${extra}` : ""}`);
  }
};
const keys = (o) => Object.keys(o || {}).sort().join(",");

const NOW = new Date(Date.UTC(2026, 9, 8, 10, 0, 0)); // 08/10/2026
const base = {
  lastName: "Démo",
  firstName: "Salma",
  dateOfBirth: "2001-05-14",
  city: "Agadir",
  district: "Dakhla",
  phone: "06 12 34 56 78",
  email: "Salma.Demo@Example.test",
  kind: "emploi",
  position: "technicien",
  availability: "immediate",
  diplomaLevel: "bac2",
  diplomaTitle: "DTS analyses médicales",
  diplomaYear: 2022,
  school: "IFMIAS Agadir",
  experience: "1_3",
  lastEmployer: "Laboratoire Exemple",
  license: true,
  vehicle: "moto",
  languages: ["francais", "arabe", "amazighe"],
  source: "facebook",
  consent: true,
};
const parse = (over) => R.parseApplication({ ...base, ...over }, NOW);

console.log("\nFormulaire complet");
let r = parse({});
assert(r.ok, "une candidature à un poste complète est acceptée", JSON.stringify(r.errors));
assert(r.ok && r.value.email === "salma.demo@example.test", "e-mail ramené en minuscules");
assert(r.ok && r.value.languages.join() === "arabe,amazighe,francais", "langues dans l'ordre de la liste, sans doublon");
assert(r.ok && r.value.duration === "" && r.value.schoolLevel === "", "pas de durée de stage ni de scolarité pour un emploi");
assert(r.ok && !("consent" in r.value), "le consentement n'est pas recopié dans la fiche (il est la condition d'envoi)");

console.log("\nChamps obligatoires");
r = R.parseApplication({}, NOW);
assert(
  !r.ok &&
    keys(r.errors) ===
      ["city", "consent", "dateOfBirth", "diplomaLevel", "experience", "firstName", "kind", "languages", "lastName", "license", "phone", "vehicle"]
        .sort()
        .join(","),
  "formulaire vide : chaque champ obligatoire est signalé, d'un coup",
  keys(r.errors)
);
r = parse({ position: "" });
assert(!r.ok && r.errors.position === "required", "emploi sans poste visé → refusé");
r = parse({ availability: "" });
assert(!r.ok && r.errors.availability === "required", "emploi sans disponibilité → refusé");
r = parse({ availability: "date" });
assert(!r.ok && r.errors.availableFrom === "required", "« à partir du… » sans date → refusé");
r = parse({ availability: "date", availableFrom: "2026-11-01" });
assert(r.ok && r.value.availableFrom === "2026-11-01", "« à partir du 01/11/2026 » accepté");
r = parse({ position: "autre" });
assert(!r.ok && r.errors.positionOther === "required", "poste « autre » sans précision → refusé");
r = parse({ position: "autre", positionOther: "Agent de saisie" });
assert(r.ok && r.value.positionOther === "Agent de saisie", "poste « autre » précisé → accepté");

console.log("\nSelon le type de demande");
r = parse({ kind: "observation", position: "", availability: "" });
assert(!r.ok && keys(r.errors) === "duration,schoolLevel", "stage d'observation : scolarité et durée demandées, poste facultatif", keys(r.errors));
r = parse({ kind: "observation", position: "", schoolLevel: "college_lycee", duration: "1_semaine" });
assert(r.ok && r.value.position === "" && r.value.availability === "", "stage d'observation complet, sans poste ni disponibilité");
r = parse({ kind: "preembauche", duration: "" });
assert(!r.ok && r.errors.duration === "required", "stage pré-embauche sans durée → refusé");
r = parse({ kind: "preembauche", position: "", duration: "1_mois" });
assert(!r.ok && r.errors.position === "required", "stage pré-embauche sans poste → refusé");
r = parse({ kind: "preembauche", duration: "2_mois", startDate: "2026-11-02", endDate: "2026-10-01" });
assert(!r.ok && r.errors.endDate === "dates", "date de fin avant la date de début → refusé");
r = parse({ kind: "spontanee", duration: "1_mois" });
assert(r.ok && r.value.duration === "", "candidature spontanée : une durée envoyée par erreur est ignorée");

console.log("\nValeurs refusées");
assert(parse({ kind: "cdi" }).errors?.kind === "invalid", "type inconnu → invalide");
assert(parse({ vehicle: "camion" }).errors?.vehicle === "invalid", "véhicule inconnu → invalide");
assert(parse({ languages: ["klingon"] }).errors?.languages === "invalid", "langue inconnue → invalide");
assert(parse({ languages: [] }).errors?.languages === "required", "aucune langue → demandée");
assert(parse({ languages: [], languagesOther: "Allemand" }).ok, "aucune langue cochée mais une autre précisée → accepté");
assert(parse({ dateOfBirth: "2014-01-01" }).errors?.dateOfBirth === "age", "12 ans → refusé (âge)");
assert(parse({ dateOfBirth: "1950-01-01" }).errors?.dateOfBirth === "age", "76 ans → refusé (âge)");
assert(parse({ dateOfBirth: "2001-02-31" }).errors?.dateOfBirth === "invalid", "31 février → date invalide");
assert(parse({ phone: "12 34" }).errors?.phone === "invalid", "téléphone trop court → invalide");
assert(parse({ email: "salma@" }).errors?.email === "invalid", "e-mail mal formé → invalide");
assert(parse({ email: "" }).ok, "e-mail facultatif");
assert(parse({ lastName: "X".repeat(61) }).errors?.lastName === "too_long", "nom de 61 caractères → trop long");
assert(parse({ diplomaYear: 1950 }).errors?.diplomaYear === "invalid", "diplôme de 1950 → année invalide");
assert(parse({ license: "oui" }).errors?.license === "required", "permis non booléen → demandé");
assert(parse({ consent: "true" }).errors?.consent === "required", "consentement : seul `true` compte");
r = parse({ city: "  Inezgane \n  Ait   Melloul " });
assert(r.ok && r.value.city === "Inezgane Ait Melloul", "espaces et retours à la ligne nettoyés");

console.log("\nPièces jointes exigées");
assert(R.filesError("emploi", { cv: false, letter: true }) === "cv", "emploi : la lettre seule ne suffit pas, il faut le CV");
assert(R.filesError("emploi", { cv: true, letter: false }) === null, "emploi : le CV seul suffit");
assert(R.filesError("observation", { cv: false, letter: true }) === null, "stage d'observation : la lettre de l'établissement suffit");
assert(R.filesError("observation", { cv: false, letter: false }) === "cv", "stage d'observation sans aucune pièce → refusé");

console.log("\nVrai format des fichiers (premiers octets)");
const bytes = (...xs) => Uint8Array.from(xs.flat());
const ascii = (s) => Array.from(s, (c) => c.charCodeAt(0));
assert(R.sniffFile(bytes(ascii("%PDF-1.7\n"))) === "pdf", "PDF reconnu");
assert(R.sniffFile(bytes([0xff, 0xd8, 0xff, 0xe0])) === "jpeg", "JPEG reconnu");
assert(R.sniffFile(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) === "png", "PNG reconnu");
assert(R.sniffFile(bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) === "doc", "Word 97-2003 reconnu");
assert(R.sniffFile(bytes([0x50, 0x4b, 0x03, 0x04], ascii("....word/document.xml...."))) === "docx", "Word (.docx) reconnu");
assert(R.sniffFile(bytes([0x50, 0x4b, 0x03, 0x04], ascii("....setup.exe...."))) === null, "une archive zip quelconque → refusée");
assert(R.sniffFile(bytes(ascii("MZ\x90\x00"))) === null, "un programme Windows renommé en .pdf → refusé");
assert(R.sniffFile(bytes(ascii("<html><script>"))) === null, "une page web → refusée");
assert(R.sniffFile(new Uint8Array(0)) === null, "fichier vide → refusé");
assert(R.safeFileName("mon CV.exe", "pdf") === "mon CV.pdf", "l'extension suit le VRAI format, pas le nom");
assert(R.safeFileName("../../etc/passwd\r\n", "pdf") === ".. .. etc passwd.pdf", "chemins et caractères de contrôle neutralisés", R.safeFileName("../../etc/passwd\r\n", "pdf"));
assert(R.safeFileName("", "jpeg") === "document.jpg", "nom absent → « document »");

console.log("\nTéléphone, âge, conservation, référence");
assert(R.phoneKey("06 12 34 56 78") === "0612345678", "06 12 34 56 78 → 0612345678");
assert(R.phoneKey("+212 6 12 34 56 78") === "0612345678", "+212 6… → même clé");
assert(R.phoneKey("00212612345678") === "0612345678", "00212… → même clé");
assert(R.ageOn("2000-10-09", NOW) === 25, "la veille de ses 26 ans : 25 ans");
assert(R.ageOn("2000-10-08", NOW) === 26, "le jour de ses 26 ans : 26 ans");
const created = Date.UTC(2026, 9, 8);
assert(R.expiryFrom(created) - created === 183 * 86400000, "effacement 183 jours (6 mois) après l'envoi");
assert(R.applicationRef("aB3dE9fGhIjK") === "AB3DE9", "référence : 6 caractères en majuscules");

console.log("\nLimites anti-spam (fenêtre glissante de 24 h)");
const now = Date.UTC(2026, 9, 8, 12);
const H = 3600000;
let t = R.throttle([now - 2 * H, now - H], now, R.LIMITS.windowMs, R.LIMITS.perPhone);
assert(!t.allowed, "2 envois du même téléphone dans la journée → le 3e est refusé");
t = R.throttle([now - 30 * H, now - H], now, R.LIMITS.windowMs, R.LIMITS.perPhone);
assert(t.allowed && t.kept.length === 1, "un envoi d'avant-hier ne compte plus");
t = R.throttle([now - H], now, R.LIMITS.windowMs, R.LIMITS.ackPerEmail);
assert(!t.allowed, "un seul accusé de réception par adresse e-mail et par 24 h");
t = R.throttle("pas un tableau", now, R.LIMITS.windowMs, 2);
assert(t.allowed && t.kept.length === 0, "compteur illisible → repart de zéro");
assert(R.LIMITS.perAddress >= 10, "une adresse réseau partagée (opérateur mobile) laisse passer au moins 10 envois");

console.log("\nE-mail d'alerte au laboratoire");
const form = parse({}).value;
const mail = E.renderStaffAlert(
  { ...form, firstName: "Salma\r\nBcc: victime@example.test", city: "<script>alert(1)</script>" },
  { ref: "AB3DE9", nowMs: NOW.getTime(), when: "08/10/2026 à 11:00", adminUrl: "https://www.laboelallali.com/fr/admin?tab=candidatures", files: { cv: true, letter: false } }
);
assert(!/[\r\n]/.test(mail.subject), "objet sur une seule ligne (pas d'en-tête injecté)", mail.subject);
assert(mail.subject.startsWith("Nouvelle candidature — Candidature à un poste — Technicien(ne) de laboratoire"), "objet : type et poste d'abord", mail.subject);
assert(!mail.html.includes("<script>") && mail.html.includes("&lt;script&gt;"), "les saisies du candidat sont échappées");
assert(mail.html.includes("24 ans") || mail.html.includes("25 ans"), "l'âge est calculé");
assert(mail.html.includes("admin?tab=candidatures"), "lien direct vers l'onglet Candidatures");
assert(mail.html.includes("permis : oui — véhicule : moto / scooter"), "permis et véhicule lisibles d'un coup d'œil");
assert(mail.html.includes("CV") && !mail.html.includes("base64"), "les pièces sont citées, jamais jointes");

console.log("\nAccusé de réception au candidat");
const fr = E.renderAck({ ...form, lastName: "NOM-SECRET", city: "VILLE-SECRETE" }, "fr", { ref: "AB3DE9", when: "08/10/2026 à 11:00" });
assert(fr.html.includes("Bonjour Salma") && fr.html.includes("AB3DE9"), "français : prénom et référence");
assert(!fr.html.includes("NOM-SECRET") && !fr.html.includes("VILLE-SECRETE"), "seul le prénom est repris — rien d'autre de ce qu'il a tapé");
assert(fr.html.includes("6 mois"), "il est prévenu de l'effacement à 6 mois");
const longName = E.renderAck({ ...form, firstName: "X".repeat(60) }, "fr", { ref: "R", when: "w" });
assert(!longName.html.includes("X".repeat(31)), "prénom coupé à 30 caractères (pas de message glissé dedans)");
const ar = E.renderAck(form, "ar", { ref: "AB3DE9", when: "08/10/2026 à 11:00" });
assert(ar.html.includes('dir="rtl"') && ar.subject.includes("مختبر العلالي"), "arabe : de droite à gauche");
assert(!ar.html.includes(" à "), "arabe : pas de « à » français dans la date");

console.log("\nQui voit les candidatures (rôle « RH », 12/10/2026)");
const Roles = require(path.join(__dirname, "..", "lib/admin/roles"));
assert(Roles.canReadApplications("owner") && Roles.canReadApplications("admin"), "propriétaires et admins : oui");
assert(Roles.canReadApplications("rh"), "rôle « RH » : oui");
assert(!Roles.canReadApplications("staff"), "stagiaire : non (décision du propriétaire)");
assert(!Roles.canReadApplications("") && !Roles.canReadApplications(undefined), "patient sans rôle : non");
assert(!Roles.canReadApplications("RH") && !Roles.canReadApplications("rh "), "valeur approchante (« RH », « rh  ») : non");
assert(Roles.levelOf("rh") === 0, "« RH » reste HORS de l'échelle : toute fonction « stagiaire et plus » le refuse (patients, résultats, médecins, équipe)");

console.log(failures === 0 ? "\nTout est vert." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
