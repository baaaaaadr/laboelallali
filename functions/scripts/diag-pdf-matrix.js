/**
 * diag-pdf-matrix.js — cartographie "quels dossiers ont un PDF ?"
 *
 * Pour chaque `requester_id` passé en argument : récupère la liste des dossiers
 * (sans PDF), puis demande CHAQUE dossier à l'unité (`dossier_id`) et note si le
 * serveur renvoie un PDF ou une chaîne vide. Sert à trancher entre :
 *   - problème isolé (un dossier / un patient), et
 *   - problème systémique (ex. réplique PDF figée à partir d'une certaine date).
 *
 * Confidentialité : n'imprime que des métadonnées (id de dossier, date, état,
 * taille du PDF). Jamais de nom, jamais de contenu d'analyse, jamais de PDF.
 *
 * Usage : node scripts/diag-pdf-matrix.js 7587 232527 219418 ...
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function loadEnvFile(file) {
  const out = {};
  try {
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq > 0) out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  } catch {
    /* absent */
  }
  return out;
}

const dir = path.join(__dirname, "..");
const secrets = loadEnvFile(path.join(dir, ".secret.local"));
const env = loadEnvFile(path.join(dir, ".env"));
const CFG = {
  apiUrl: process.env.CYBERLAB_API_URL || env.CYBERLAB_API_URL,
  apiKey: secrets.CYBERLAB_API_KEY || secrets.API_KEY,
  hmacSecret: secrets.CYBERLAB_HMAC_SECRET || secrets.HMAC_SECRET,
};
const BASE = (/^https?:\/\//i.test(CFG.apiUrl) ? CFG.apiUrl : `https://${CFG.apiUrl}`).replace(
  /\/+$/,
  ""
);

async function call(payload) {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const sig = crypto
    .createHmac("sha256", CFG.hmacSecret)
    .update(`${ts}.${nonce}.${body}`)
    .digest("hex");
  let res;
  try {
    res = await fetch(`${BASE}/api/v1/results`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CFG.apiKey}`,
        "Content-Type": "application/json",
        "X-Timestamp": ts,
        "X-Nonce": nonce,
        "X-Signature": sig,
      },
      body,
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    return { status: 0, err: String(e.message) };
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json, err: res.ok ? null : text.slice(0, 120) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!ids.length) {
    console.error("Usage: node scripts/diag-pdf-matrix.js <id> [<id> ...]");
    process.exit(1);
  }
  const rows = [];
  for (const rid of ids) {
    const list = await call({
      type: "patient",
      requester_id: rid,
      max_results: 50,
      include_pdf: "none",
    });
    if (list.status !== 200) {
      console.log(`\n### ${rid} — HTTP ${list.status} ${list.err || ""}`);
      continue;
    }
    const results = (list.json && list.json.results) || [];
    console.log(`\n### ${rid} — ${results.length} dossier(s)`);
    for (const r of results) {
      await sleep(150); // ne pas déclencher le rate-limit du serveur
      const one = await call({ type: "patient", requester_id: rid, dossier_id: r.dossier_id });
      const got = ((one.json || {}).results || [])[0];
      const b64 = got ? got.pdf_base64 : undefined;
      const bytes = b64 ? Buffer.from(b64, "base64").length : 0;
      const ok = bytes > 0;
      const date = (r.date_dossier || "").slice(0, 10);
      console.log(
        `   ${date}  ${r.dossier_id}  etat=${String(r.etat).padEnd(8)}  ` +
          `PDF ${ok ? `OK (${(bytes / 1024).toFixed(0)} Ko)` : `MANQUANT (HTTP ${one.status})`}`
      );
      rows.push({ rid, date, dossier: r.dossier_id, etat: r.etat, bytes });
    }
  }

  // Synthèse chronologique : y a-t-il une date de bascule ?
  console.log("\n\n===== SYNTHÈSE (tri chronologique) =====");
  rows.sort((a, b) => a.date.localeCompare(b.date));
  for (const r of rows) {
    console.log(
      `${r.date}  id=${String(r.rid).padEnd(8)} dossier=${r.dossier}  ${
        r.bytes ? "PDF ✓" : "PDF ✗ VIDE"
      }`
    );
  }
  const ko = rows.filter((r) => !r.bytes);
  const okRows = rows.filter((r) => r.bytes);
  console.log(
    `\nTotal: ${rows.length} dossiers | avec PDF: ${okRows.length} | sans PDF: ${ko.length}`
  );
  if (okRows.length)
    console.log(`  PDF le plus récent qui fonctionne : ${okRows[okRows.length - 1].date}`);
  if (ko.length) console.log(`  Le plus ancien sans PDF            : ${ko[0].date}`);
}

main().catch((e) => {
  console.error("Erreur:", e.message);
  process.exit(1);
});
