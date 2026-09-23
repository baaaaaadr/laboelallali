/**
 * diag-practitioner.js — sonde EN LECTURE SEULE d'un code prescripteur
 * (espace « Mes patients », voir docs/pages/mes-patients.md).
 *
 * Interroge DIRECTEMENT le serveur de résultats du laboratoire, avec le
 * transport signé de la Cloud Function (lib/cyberlab/client.js) — sans
 * Firebase, sans Firestore — et répond aux questions de la mise en service
 * d'un médecin :
 *   - le code est-il connu du serveur ? (200, ou 404 = aucun dossier encore
 *     envoyé par Qalam pour ce prescripteur) ;
 *   - combien de bilans, combien de patients (MÊME règle de regroupement que
 *     la carte admin « Vérifier » et que l'écran du médecin), de quand à quand ;
 *   - la limite de 50 bilans est-elle atteinte ?
 *   - des bilans arrivent-ils sans nom (envoi incomplet côté Qalam) ?
 *   - option --dossier <n°> : ce dossier est-il visible pour CE code ?
 *     (cloisonnement : un dossier prescrit par un confrère doit répondre 404) ;
 *   - option --pdf : temps et taille du PDF du bilan le plus récent.
 *
 * CONFIDENTIALITÉ : n'affiche JAMAIS un nom de patient — seulement des
 * INITIALES (« D. A. »), des numéros de dossier, des dates, des tailles. Ni le
 * contenu d'un PDF, ni le détail des analyses. Rien n'est écrit sur disque.
 * Ne pas coller la sortie dans un outil externe : les numéros de dossier
 * restent des identifiants du laboratoire.
 *
 * Prérequis : `npm run build` (lib/), `functions/.env` (CYBERLAB_API_URL) et
 * `functions/.secret.local` (clé + secret HMAC), comme diag-dossier.js.
 *
 * Usage :
 *   node scripts/diag-practitioner.js <CODE> [--type medecin|correspondant]
 *        [--dossier <n°>] [--pdf] [--max <1-50>]
 */
const fs = require("fs");
const path = require("path");

const FN_DIR = path.join(__dirname, "..");
const { callCyberlab, CyberlabError } = require(path.join(FN_DIR, "lib/cyberlab/client"));
const { normalizePractitionerId } = require(path.join(FN_DIR, "lib/cyberlab/identities"));
const { patientKey } = require(path.join(FN_DIR, "lib/admin/adminPractitioner"));

function loadEnvFile(file) {
  const out = {};
  try {
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  } catch {
    /* absent */
  }
  return out;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** « D. A. » — la première lettre du nom et du prénom, rien d'autre. */
function initials(nom, prenom) {
  const first = (s) => {
    const c = String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .charAt(0)
      .toUpperCase();
    return c ? `${c}.` : "?";
  };
  return `${first(nom)} ${first(prenom)}`;
}

const kb = (n) => (n < 1024 ? `${n} o` : `${Math.round(n / 1024)} Ko`);

const day = (iso) => String(iso || "").slice(0, 10) || "date ?";

function describeError(err) {
  if (err instanceof CyberlabError) {
    if (err.kind === "not_found") return "404 — inconnu du serveur de résultats";
    if (err.kind === "unauthorized") return "401 — signature ou clé refusée (vérifier .secret.local)";
    if (err.kind === "rate_limited") return "429 — trop de requêtes, réessayer dans une minute";
    if (err.kind === "network") return "réseau — serveur injoignable ou délai de 20 s dépassé";
    return `erreur serveur${err.status ? ` (HTTP ${err.status})` : ""}`;
  }
  return `inattendu : ${err && err.message}`;
}

async function timed(fn) {
  const t0 = Date.now();
  try {
    return { ok: true, value: await fn(), ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, err, ms: Date.now() - t0 };
  }
}

async function main() {
  const rawCode = process.argv[2];
  if (!rawCode || rawCode.startsWith("--")) {
    console.error("Usage : node scripts/diag-practitioner.js <CODE> [--type medecin|correspondant] [--dossier <n°>] [--pdf] [--max <1-50>]");
    process.exit(1);
  }
  const code = normalizePractitionerId(rawCode);
  const type = arg("--type") || "medecin";
  if (type !== "medecin" && type !== "correspondant") {
    console.error("--type : « medecin » ou « correspondant » (jamais « patient »).");
    process.exit(1);
  }
  const max = Math.min(50, Math.max(1, Number(arg("--max")) || 50));
  const dossier = arg("--dossier");
  const withPdf = process.argv.includes("--pdf");

  const secrets = loadEnvFile(path.join(FN_DIR, ".secret.local"));
  const env = loadEnvFile(path.join(FN_DIR, ".env"));
  const cfg = {
    apiUrl: process.env.CYBERLAB_API_URL || env.CYBERLAB_API_URL,
    apiKey: secrets.CYBERLAB_API_KEY || secrets.API_KEY,
    hmacSecret: secrets.CYBERLAB_HMAC_SECRET || secrets.HMAC_SECRET,
  };
  const missing = Object.entries(cfg).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`Configuration manquante : ${missing.join(", ")} (functions/.env, functions/.secret.local).`);
    process.exit(1);
  }

  console.log(`\nCode ${code} — type ${type}${code !== rawCode ? ` (saisi « ${rawCode} », normalisé)` : ""}`);

  // 1. La liste, sans PDF — exactement l'appel de l'écran du médecin.
  const list = await timed(() =>
    callCyberlab(cfg, { type, requester_id: code, max_results: max, include_pdf: "none" })
  );
  if (!list.ok) {
    console.log(`\nListe : ${describeError(list.err)} (${list.ms} ms)`);
    if (list.err instanceof CyberlabError && list.err.kind === "not_found") {
      console.log(
        "  → Le serveur ne connaît pas encore ce code : aucun dossier n'a été envoyé par Qalam pour ce\n" +
          "    prescripteur. Vérifier « Serveur Résultat » sur sa fiche, ré-enregistrer un de ses dossiers,\n" +
          "    puis la file « Attentes » → « Envois ». Compter ~5 min après l'envoi."
      );
    }
    process.exit(2);
  }
  const results = Array.isArray(list.value.results) ? list.value.results : [];
  console.log(`\nListe : ${results.length} bilan(s) en ${list.ms} ms (sans PDF)`);
  if (results.length === 0) {
    console.log("  → Code connu, aucun bilan pour l'instant.");
    return;
  }

  // 2. Regroupement — la règle de la carte admin et de l'écran du médecin.
  const groups = new Map();
  let nameless = 0;
  const etats = new Map();
  for (const r of results) {
    const key = patientKey(r.patient_nom, r.patient_prenom, r.dossier_id);
    if (key.startsWith("#dossier:")) nameless += 1;
    if (!groups.has(key)) groups.set(key, { ini: initials(r.patient_nom, r.patient_prenom), list: [] });
    groups.get(key).list.push(r);
    etats.set(r.etat || "?", (etats.get(r.etat || "?") || 0) + 1);
  }
  const dates = results.map((r) => day(r.date_dossier)).sort();
  console.log(`Patients : ${groups.size} · du ${dates[0]} au ${dates[dates.length - 1]}`);
  console.log(`États : ${[...etats].map(([e, n]) => `${e} ×${n}`).join(", ")}`);
  if (results.length >= max) {
    console.log(`⚠ Limite atteinte (${max}) : seuls les ${max} bilans les plus récents sont renvoyés.`);
  }
  if (nameless) {
    console.log(`⚠ ${nameless} bilan(s) SANS nom de patient — chacun apparaît sur sa propre ligne.`);
  }

  console.log("\nPatients (initiales seulement), du bilan le plus récent au plus ancien :");
  const rows = [...groups.values()]
    .map((g) => ({ ...g, list: g.list.slice().sort((a, b) => String(b.date_dossier).localeCompare(String(a.date_dossier))) }))
    .sort((a, b) => String(b.list[0].date_dossier).localeCompare(String(a.list[0].date_dossier)));
  rows.forEach((g, i) => {
    const ids = g.list.map((r) => r.dossier_id).join(", ");
    console.log(
      `  ${String(i + 1).padStart(2)}. ${g.ini.padEnd(6)} ${String(g.list.length).padStart(2)} bilan(s) · dernier ${day(g.list[0].date_dossier)} · dossiers ${ids}`
    );
  });

  // 3. Un dossier précis : visible pour CE code ?
  if (dossier) {
    const one = await timed(() => callCyberlab(cfg, { type, requester_id: code, dossier_id: String(dossier) }));
    if (one.ok) {
      const r = (one.value.results || [])[0];
      const size = r && r.pdf_base64 ? Buffer.from(r.pdf_base64, "base64").length : 0;
      console.log(
        `\nDossier ${dossier} : VISIBLE pour ${code} (${one.ms} ms) — ` +
          (size ? `PDF ${kb(size)}` : "pas de PDF joint par le laboratoire")
      );
    } else {
      console.log(`\nDossier ${dossier} : ${describeError(one.err)} (${one.ms} ms)`);
      if (one.err instanceof CyberlabError && one.err.kind === "not_found") {
        console.log("  → Normal s'il a été prescrit par un autre médecin : le serveur ne le montre qu'à son prescripteur.");
      }
    }
  }

  // 4. Le PDF du bilan le plus récent : ce que coûte l'ouverture d'un patient.
  if (withPdf) {
    const newest = rows[0].list[0];
    const pdf = await timed(() =>
      callCyberlab(cfg, { type, requester_id: code, dossier_id: String(newest.dossier_id) })
    );
    if (pdf.ok) {
      const r = (pdf.value.results || [])[0];
      const size = r && r.pdf_base64 ? Buffer.from(r.pdf_base64, "base64").length : 0;
      console.log(
        `\nPDF du bilan le plus récent (${newest.dossier_id}) : ${pdf.ms} ms, ` +
          (size ? kb(size) : "aucun PDF joint")
      );
    } else {
      console.log(`\nPDF du bilan le plus récent : ${describeError(pdf.err)} (${pdf.ms} ms)`);
    }
  }
  console.log("");
}

main().catch((e) => {
  console.error(`Échec : ${e && e.message}`);
  process.exit(1);
});
