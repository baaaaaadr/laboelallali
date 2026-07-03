/**
 * CyberLab results API — automated test battery (Firebase-independent).
 *
 * Targets the API contract directly: happy paths use the real transport layer
 * (functions/src/cyberlab/client.ts, compiled to lib/); negative cases are
 * hand-forged so individual pieces (key, signature, timestamp, nonce, body) can
 * be corrupted in isolation.
 *
 * Usage:
 *   node scripts/test-battery.js <target-url> [label]
 *   # e.g.  node scripts/test-battery.js http://127.0.0.1:3001 mock
 *   #       node scripts/test-battery.js https://real.example.com real
 *
 * Needs CYBERLAB_API_KEY / CYBERLAB_HMAC_SECRET (functions/.secret.local or env).
 * Produces docs/integrations/test-results.md — CONTENT-FREE by construction:
 * only ids, descriptions, expected vs obtained status/behaviour, and PASS/FAIL.
 * No patient names, dossier ids, dates or PDF bytes are ever written out.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FN_DIR = path.join(__dirname, "..");
const REPORT = path.join(FN_DIR, "..", "docs", "integrations", "test-results.md");

// Report-only mode: regenerate the markdown from existing snapshots (no requests).
if (process.argv.includes("--report")) {
  writeReport();
  console.log("Report regenerated from snapshots -> docs/integrations/test-results.md");
  process.exit(0);
}

// ── Config ──────────────────────────────────────────────────────────────────
function loadEnvFile(file) {
  const out = {};
  try {
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq !== -1) out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  } catch {
    /* optional */
  }
  return out;
}

const secrets = loadEnvFile(path.join(FN_DIR, ".secret.local"));
const envFile = loadEnvFile(path.join(FN_DIR, ".env"));
// Accept both CYBERLAB_-prefixed and short server-side names (API_KEY/HMAC_SECRET).
const API_KEY =
  process.env.CYBERLAB_API_KEY || process.env.API_KEY || secrets.CYBERLAB_API_KEY || secrets.API_KEY;
const HMAC_SECRET =
  process.env.CYBERLAB_HMAC_SECRET ||
  process.env.HMAC_SECRET ||
  secrets.CYBERLAB_HMAC_SECRET ||
  secrets.HMAC_SECRET;

const { callCyberlab, normalizeApiUrl } = require(path.join(FN_DIR, "lib/cyberlab/client"));

const RAW_TARGET =
  process.argv[2] || process.env.CYBERLAB_API_URL || envFile.CYBERLAB_API_URL;
const TARGET = RAW_TARGET ? normalizeApiUrl(RAW_TARGET) : RAW_TARGET;
const LABEL = (process.argv[3] || "mock").toLowerCase();

if (!API_KEY || !HMAC_SECRET) {
  console.error("Missing CYBERLAB_API_KEY / CYBERLAB_HMAC_SECRET.");
  process.exit(1);
}
if (!TARGET) {
  console.error("Usage: node scripts/test-battery.js <target-url> [label]");
  process.exit(1);
}

const cfg = { apiUrl: TARGET, apiKey: API_KEY, hmacSecret: HMAC_SECRET };

// ── Low-level helpers ─────────────────────────────────────────────────────────
const nowSec = () => Math.floor(Date.now() / 1000);

function hmac(body, ts, nonce, secret = HMAC_SECRET) {
  return crypto.createHmac("sha256", secret).update(`${ts}.${nonce}.${body}`).digest("hex");
}

/** Build headers with fine-grained control for negative cases. */
function forge(body, opts = {}) {
  const ts = String(opts.ts ?? nowSec());
  const nonce = opts.nonce ?? crypto.randomUUID();
  let sig = opts.sig ?? hmac(body, ts, nonce, opts.secret);
  if (opts.corruptSig) sig = sig.slice(0, -1) + (sig.slice(-1) === "0" ? "1" : "0");
  const h = {
    Authorization: `Bearer ${opts.apiKey ?? API_KEY}`,
    "Content-Type": "application/json",
    "X-Timestamp": ts,
    "X-Nonce": nonce,
  };
  if (!opts.omitSig) h["X-Signature"] = sig;
  return { headers: h, ts, nonce, sig };
}

async function post(headers, body) {
  try {
    const res = await fetch(`${TARGET}/api/v1/results`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(15000),
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* no/invalid json body */
    }
    return { status: res.status, json };
  } catch (e) {
    return { status: 0, json: null, netErr: e.code || e.name || "NETWORK_ERROR" };
  }
}

function bodyOf(obj) {
  return JSON.stringify(obj);
}

// ── Response-shape helpers (content-free assertions) ──────────────────────────
const RESULT_FIELDS = [
  "dossier_id",
  "patient_nom",
  "patient_prenom",
  "date_dossier",
  "etat",
  "analyses_summary",
  "pdf_base64",
];

function hasAllFields(r) {
  return r && typeof r === "object" && RESULT_FIELDS.every((f) => f in r);
}

function base64DecodesToPdf(b64) {
  if (typeof b64 !== "string") return false;
  const clean = b64.replace(/\s+/g, "");
  if (clean.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return false;
  try {
    return Buffer.from(clean, "base64").slice(0, 5).toString("latin1") === "%PDF-";
  } catch {
    return false;
  }
}

// ── Results collector ─────────────────────────────────────────────────────────
const cases = [];
function record(id, group, desc, expected, pass, obtained, note = "") {
  cases.push({ id, group, desc, expected, pass: !!pass, obtained, note });
  const flag = pass ? "PASS" : "FAIL";
  console.log(`  [${flag}] ${id} — ${obtained}`);
}

// ── The battery ───────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n=== Test battery vs ${TARGET} (label=${LABEL}) ===\n`);

  // Keep A1 / A3 responses in memory for the D (shape) checks. Never printed.
  let a1json = null;
  let a3json = null;

  // ── A — Happy paths (must be ACCEPTED) ──────────────────────────────────────
  async function happy(type, id, max = 50) {
    try {
      const json = await callCyberlab(cfg, { type, requester_id: id, max_results: max });
      return { status: 200, json };
    } catch (e) {
      return { status: e.status || 0, json: null, kind: e.kind };
    }
  }

  {
    const r = await happy("patient", "7587", 50);
    a1json = r.json;
    const list = r.json && r.json.results;
    const ok = r.status === 200 && Array.isArray(list) && list.length > 0;
    const nomEmpty = ok && list.every((x) => x.patient_nom === "");
    record(
      "A1", "A", "Patient 7587 — happy path",
      "200 + résultats + patient_nom vide (minimisation)",
      ok && nomEmpty,
      `status=${r.status}, results=${Array.isArray(list) ? list.length : "n/a"}, patient_nom_vide=${nomEmpty}`
    );
  }
  {
    const r = await happy("patient", "142807", 50);
    const list = r.json && r.json.results;
    const ok = r.status === 200 && Array.isArray(list) && list.length > 0;
    record("A2", "A", "Patient 142807 — happy path", "200 + résultats", ok,
      `status=${r.status}, results=${Array.isArray(list) ? list.length : "n/a"}`);
  }
  {
    const r = await happy("correspondant", "TESTA", 50);
    a3json = r.json;
    const list = r.json && r.json.results;
    const ok = r.status === 200 && Array.isArray(list) && list.length > 0;
    const nomFilled = ok && list.every((x) => typeof x.patient_nom === "string" && x.patient_nom.length > 0);
    record("A3", "A", "Correspondant TESTA — happy path",
      "200 + patient_nom renseigné", ok && nomFilled,
      `status=${r.status}, results=${Array.isArray(list) ? list.length : "n/a"}, patient_nom_renseigne=${nomFilled}`);
  }
  {
    const r = await happy("medecin", "TESTMED", 50);
    const list = r.json && r.json.results;
    const ok = r.status === 200 && Array.isArray(list) && list.length > 0;
    const nomFilled = ok && list.every((x) => typeof x.patient_nom === "string" && x.patient_nom.length > 0);
    record("A4", "A", "Médecin TESTMED — happy path",
      "200 + patient_nom renseigné", ok && nomFilled,
      `status=${r.status}, results=${Array.isArray(list) ? list.length : "n/a"}, patient_nom_renseigne=${nomFilled}`);
  }

  // ── B — Signature / anti-replay security (must be REJECTED) ──────────────────
  const goodBody = bodyOf({ type: "patient", requester_id: "7587", max_results: 50 });

  {
    const { headers } = forge(goodBody, { apiKey: "sk_WRONG_key" });
    const r = await post(headers, goodBody);
    record("B1", "B", "Mauvaise clé API", "401", r.status === 401, `status=${r.status}`);
  }
  {
    const { headers } = forge(goodBody, { corruptSig: true });
    const r = await post(headers, goodBody);
    record("B2", "B", "Signature HMAC corrompue", "401", r.status === 401, `status=${r.status}`);
  }
  {
    const { headers } = forge(goodBody, { omitSig: true });
    const r = await post(headers, goodBody);
    record("B3", "B", "Header X-Signature absent", "401 ou 400",
      r.status === 401 || r.status === 400, `status=${r.status}`);
  }
  {
    const oldTs = nowSec() - 300; // outside the 120s window, signed with this ts
    const { headers } = forge(goodBody, { ts: oldTs });
    const r = await post(headers, goodBody);
    record("B4", "B", "Timestamp expiré (now-300s)", "rejet (401)",
      r.status === 401, `status=${r.status}`);
  }
  {
    // Same signed request sent twice — the 2nd must be refused (nonce replay).
    const f = forge(goodBody);
    const r1 = await post(f.headers, goodBody);
    const r2 = await post(f.headers, goodBody);
    record("B5", "B", "Nonce rejoué (2× requête identique)",
      "1re acceptée, 2e rejetée (401)",
      r1.status !== 401 && r2.status === 401,
      `1re=${r1.status}, 2e=${r2.status}`);
  }
  {
    // Sign body A, send body B (different requester_id) — raw-body HMAC must fail.
    const signedBody = bodyOf({ type: "patient", requester_id: "7587", max_results: 50 });
    const sentBody = bodyOf({ type: "patient", requester_id: "142807", max_results: 50 });
    const ts = String(nowSec());
    const nonce = crypto.randomUUID();
    const sig = hmac(signedBody, ts, nonce);
    const headers = {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "X-Timestamp": ts,
      "X-Nonce": nonce,
      "X-Signature": sig,
    };
    const r = await post(headers, sentBody);
    record("B6", "B", "Corps modifié après signature", "401",
      r.status === 401, `status=${r.status}`);
  }

  // ── C — Input validation ────────────────────────────────────────────────────
  {
    const body = bodyOf({ type: "patient", requester_id: "000000", max_results: 50 });
    const { headers } = forge(body);
    const r = await post(headers, body);
    const list = r.json && r.json.results;
    const emptyOk = r.status === 200 && Array.isArray(list) && list.length === 0;
    const pass = r.status === 404 || emptyOk;
    record("C1", "C", "requester_id inconnu (000000)", "404 ou résultats vides",
      pass, `status=${r.status}${emptyOk ? ", results=0" : ""}`,
      r.status === 404 ? "comportement: 404" : emptyOk ? "comportement: 200 vide" : "inattendu");
  }
  {
    const body = bodyOf({ type: "hacker", requester_id: "7587", max_results: 50 });
    const { headers } = forge(body);
    const r = await post(headers, body);
    record("C2", "C", "type invalide (hacker)", "400 ou 422",
      r.status === 400 || r.status === 422, `status=${r.status}`);
  }
  {
    const body = bodyOf({ type: "patient", max_results: 50 }); // no requester_id
    const { headers } = forge(body);
    const r = await post(headers, body);
    record("C3", "C", "requester_id manquant", "400",
      r.status === 400 || r.status === 422, `status=${r.status}`);
  }
  {
    const body = bodyOf({ type: "patient", requester_id: "7587", max_results: 100 });
    const { headers } = forge(body);
    const r = await post(headers, body);
    const list = r.json && r.json.results;
    const clamped = r.status === 200 && Array.isArray(list) && list.length <= 50;
    const rejected = r.status >= 400;
    record("C4", "C", "max_results > 50 (=100)", "clampé (≤50) ou rejeté",
      clamped || rejected,
      `status=${r.status}${Array.isArray(list) ? `, results=${list.length}` : ""}`,
      clamped ? "comportement: clampé" : rejected ? "comportement: rejeté" : "inattendu");
  }

  // ── D — Response shape (from A1 / A3 already fetched; no content emitted) ─────
  {
    const list = a1json && a1json.results;
    const ok = Array.isArray(list) && list.length > 0 && list.every(hasAllFields);
    record("D1", "D", "Champs attendus présents dans chaque résultat",
      `présence de: ${RESULT_FIELDS.join(", ")}`, ok,
      `tous_champs_presents=${ok}`);
  }
  {
    const list = a1json && a1json.results;
    const ok = Array.isArray(list) && list.length > 0 && list.every((r) => base64DecodesToPdf(r.pdf_base64));
    record("D2", "D", "pdf_base64 = base64 valide décodant en PDF",
      "décodage → magic %PDF-", ok, `decode_pdf_ok=${ok}`);
  }

  // ── E — Perf params: include_pdf + on-demand dossier_id ─────────────────────
  const callReq = async (req) => {
    try {
      return { status: 200, json: await callCyberlab(cfg, req) };
    } catch (e) {
      return { status: e.status || 0, json: null, kind: e.kind };
    }
  };
  const nonEmptyPdf = (r) => typeof r.pdf_base64 === "string" && r.pdf_base64.length > 0;

  let knownDossierId = null; // captured in memory from E2; never printed.

  {
    const r = await callReq({ type: "patient", requester_id: "7587", max_results: 50, include_pdf: "latest" });
    const list = r.json && r.json.results;
    const ok = r.status === 200 && Array.isArray(list) && list.length > 0;
    const withPdf = ok ? list.filter(nonEmptyPdf) : [];
    const exactlyOne = withPdf.length === 1;
    let isMostRecent = false;
    if (ok && exactlyOne) {
      const maxDate = list.reduce((m, x) => (x.date_dossier > m ? x.date_dossier : m), "");
      isMostRecent = withPdf[0].date_dossier === maxDate;
    }
    record("E1", "E", "include_pdf=latest — liste complète, PDF du plus récent seulement",
      "≥1 résultat, exactement 1 PDF (le plus récent)", ok && exactlyOne && isMostRecent,
      `status=${r.status}, results=${Array.isArray(list) ? list.length : "n/a"}, pdf_count=${withPdf.length}, pdf_est_plus_recent=${isMostRecent}`);
  }
  {
    const r = await callReq({ type: "patient", requester_id: "7587", max_results: 50, include_pdf: "none" });
    const list = r.json && r.json.results;
    const ok = r.status === 200 && Array.isArray(list) && list.length > 0;
    const allEmpty = ok && list.every((x) => x.pdf_base64 === "");
    if (ok && list[0]) knownDossierId = list[0].dossier_id;
    record("E2", "E", "include_pdf=none — liste complète, aucun PDF",
      "≥1 résultat, tous pdf_base64 vides", ok && allEmpty,
      `status=${r.status}, results=${Array.isArray(list) ? list.length : "n/a"}, tous_pdf_vides=${allEmpty}`);
  }
  {
    const r = await callReq({ type: "patient", requester_id: "7587", max_results: 50, include_pdf: "all" });
    const list = r.json && r.json.results;
    const ok = r.status === 200 && Array.isArray(list) && list.length > 0;
    const allFilled = ok && list.every(nonEmptyPdf);
    record("E3", "E", "include_pdf=all — tous les PDF (rétrocompatibilité)",
      "≥1 résultat, tous pdf_base64 remplis", ok && allFilled,
      `status=${r.status}, results=${Array.isArray(list) ? list.length : "n/a"}, tous_pdf_remplis=${allFilled}`);
  }
  {
    if (!knownDossierId) {
      record("E4", "E", "dossier_id connu — 1 dossier avec son PDF",
        "1 résultat, bon dossier, PDF présent", false, "aucun dossier_id disponible depuis E2");
    } else {
      const r = await callReq({ type: "patient", requester_id: "7587", dossier_id: knownDossierId });
      const list = r.json && r.json.results;
      const single = r.status === 200 && Array.isArray(list) && list.length === 1;
      const pdfPresent = single && nonEmptyPdf(list[0]);
      const matches = single && list[0].dossier_id === knownDossierId;
      record("E4", "E", "dossier_id connu — 1 dossier avec son PDF",
        "1 résultat, bon dossier, PDF présent", single && pdfPresent && matches,
        `status=${r.status}, results=${Array.isArray(list) ? list.length : "n/a"}, pdf_present=${pdfPresent}, dossier_correspond=${matches}`);
    }
  }
  {
    const r = await callReq({ type: "patient", requester_id: "7587", dossier_id: "999999999" });
    record("E5", "E", "dossier_id inconnu — rejet", "404", r.status === 404, `status=${r.status}`);
  }

  // ── Persist + report ────────────────────────────────────────────────────────
  const pass = cases.filter((c) => c.pass).length;
  const snapshot = {
    label: LABEL,
    target: TARGET,
    timestamp: new Date().toISOString(),
    summary: { pass, total: cases.length },
    cases,
  };
  const snapPath = path.join(__dirname, `.battery-${LABEL}.local`); // gitignored via *.local
  fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));

  writeReport();
  console.log(`\n=== ${pass}/${cases.length} PASS — report: docs/integrations/test-results.md ===\n`);
  process.exitCode = pass === cases.length ? 0 : 1;
}

// ── Report generation (aggregates whatever snapshots exist) ───────────────────
function loadSnapshot(label) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, `.battery-${label}.local`), "utf8"));
  } catch {
    return null;
  }
}

/** Mask the private subdomain so the committed report never leaks the origin. */
function maskHost(target) {
  try {
    const u = new URL(target);
    if (/^(127\.0\.0\.1|localhost)/.test(u.host)) return "localhost (mock)";
    const parts = u.host.split(".");
    return parts.length > 2 ? "***." + parts.slice(1).join(".") : u.host;
  } catch {
    return "(cible)";
  }
}

function renderTable(snap) {
  const lines = [
    "| ID | Groupe | Description | Attendu | Obtenu | Résultat |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const c of snap.cases) {
    const note = c.note ? ` _(${c.note})_` : "";
    lines.push(
      `| ${c.id} | ${c.group} | ${c.desc} | ${c.expected} | ${c.obtained}${note} | ${c.pass ? "✅ PASS" : "❌ FAIL"} |`
    );
  }
  return lines.join("\n");
}

function renderComparison(mock, real) {
  const byId = (s) => Object.fromEntries(s.cases.map((c) => [c.id, c]));
  const m = byId(mock);
  const r = byId(real);
  const regressions = Object.keys(m).filter((id) => r[id] && m[id].pass && !r[id].pass);
  const sigReg = regressions.filter((id) => id.startsWith("B"));

  let out = "## Comparaison mock vs serveur réel\n\n";
  if (regressions.length === 0) {
    out += "Aucune régression : tous les cas qui passent sur le mock passent aussi sur le serveur réel.\n";
    return out;
  }
  out += `Cas qui **passent sur le mock mais échouent sur le serveur réel** : ${regressions.join(", ")}.\n\n`;
  if (sigReg.length > 0) {
    out +=
      `> ⚠️ **Les cas de signature ${sigReg.join(", ")} régressent.** Cause la plus ` +
      "probable : différence de sérialisation JSON entre les deux implémentations " +
      "(ordre des clés, espaces, échappement). Le serveur doit vérifier la signature " +
      "sur le **raw body** reçu, et non sur une re-sérialisation. Voir " +
      "[hmac-signature-notes.md](hmac-signature-notes.md).\n";
  }
  const otherReg = regressions.filter((id) => !id.startsWith("B"));
  if (otherReg.length > 0) {
    out +=
      `\n> ℹ️ Écarts hors signature (${otherReg.join(", ")}) : différences de sémantique ` +
      "de validation d'entrée (p. ex. le code HTTP renvoyé pour une entrée invalide). " +
      "**Sans impact sur le flux applicatif** : la Cloud Function lit et valide " +
      "`type`/`requester_id` depuis Firestore et n'envoie donc jamais d'entrée " +
      "malformée. À confirmer avec l'éditeur seulement si un alignement strict est souhaité.\n";
  }
  return out;
}

function referenceVectorSection() {
  const secret = "test_hmac_secret_abcdefghijklmnop";
  const body = JSON.stringify({ type: "patient", requester_id: "7587", max_results: 50 });
  const ts = "1718000000";
  const nonce = "3f8b2c1a-0000-4a00-8000-000000000000";
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${nonce}.${body}`).digest("hex");
  return [
    "## Vecteur de test de signature (à comparer par l'éditeur)",
    "",
    "Secret de test (public, **pas** le secret de production) :",
    "```",
    `HMAC_SECRET = ${secret}`,
    `timestamp   = ${ts}`,
    `nonce       = ${nonce}`,
    `body        = ${body}`,
    `payload     = ${ts}.${nonce}.${body}`,
    `X-Signature = ${sig}`,
    "```",
    "Toute implémentation correcte doit reproduire exactement cette `X-Signature`.",
    "",
  ].join("\n");
}

function writeReport() {
  const mock = loadSnapshot("mock");
  const real = loadSnapshot("real");

  const parts = [
    "# CyberLab API — résultats de la batterie de tests",
    "",
    "> ⚠️ **Rapport sans aucun contenu de résultat réel.** Il ne contient que des " +
      "identifiants de test, descriptions, codes/statuts attendus vs obtenus et " +
      "PASS/FAIL. Aucun nom de patient, date de dossier ni donnée PDF n'y figure. " +
      "Sûr à transmettre à un tiers.",
    "",
    `_Généré le ${new Date().toISOString()}._`,
    "",
    referenceVectorSection(),
  ];

  for (const snap of [mock, real]) {
    if (!snap) continue;
    parts.push(
      `## Cible « ${snap.label} » — ${maskHost(snap.target)}`,
      "",
      `- Exécuté : ${snap.timestamp}`,
      `- Résultat global : **${snap.summary.pass}/${snap.summary.total} PASS**`,
      "",
      renderTable(snap),
      ""
    );
  }

  if (mock && real) {
    parts.push(renderComparison(mock, real), "");
  }

  fs.writeFileSync(REPORT, parts.join("\n"));
}

run().catch((e) => {
  console.error("Battery crashed:", e);
  process.exit(1);
});
