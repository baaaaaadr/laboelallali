/**
 * Local mock of the lab's CyberLab results server (proposal §7.4), upgraded into a
 * faithful full-contract reference so it can serve as an "all PASS" baseline for
 * the test battery.
 *
 * Implements: the 4 security checks (API key, 120s timestamp window, nonce,
 * HMAC-SHA256 over the RAW body), plus input validation (type, requester_id),
 * unknown-requester 404, max_results clamping to 50, and patient data
 * minimisation (patient_nom/prenom empty for type "patient").
 *
 * Uses only Node built-ins. Run:  node scripts/mock-cyberlab-server.js
 * Reads CYBERLAB_API_KEY / CYBERLAB_HMAC_SECRET from functions/.secret.local
 * (or the environment).
 */
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/** Minimal `KEY=value` parser for .secret.local / .env (no external dep). */
function loadEnvFile(file) {
  const out = {};
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  } catch {
    /* file may not exist — fall back to process.env */
  }
  return out;
}

const fileEnv = loadEnvFile(path.join(__dirname, "..", ".secret.local"));
// Accept both the CYBERLAB_-prefixed names and the short server-side names
// (API_KEY / HMAC_SECRET, as used in the proposal §7.5 secrets file).
const API_KEY =
  process.env.CYBERLAB_API_KEY || process.env.API_KEY || fileEnv.CYBERLAB_API_KEY || fileEnv.API_KEY;
const HMAC_SECRET =
  process.env.CYBERLAB_HMAC_SECRET ||
  process.env.HMAC_SECRET ||
  fileEnv.CYBERLAB_HMAC_SECRET ||
  fileEnv.HMAC_SECRET;

if (!API_KEY || !HMAC_SECRET) {
  console.error(
    "[mock] Missing CYBERLAB_API_KEY / CYBERLAB_HMAC_SECRET " +
      "(set them in functions/.secret.local or the environment)."
  );
  process.exit(1);
}

const REPLAY_WINDOW_SEC = 120;
const PORT = 3001;
const MAX_RESULTS_CAP = 50;
const usedNonces = new Map();

// Test identifiers provided by the lab editor, plus two FICTITIOUS prescribers
// (DRDEMO, DRAUTRE) with a realistic roster — see ROSTERS below.
const KNOWN = {
  patient: new Set(["7587", "142807"]),
  correspondant: new Set(["TESTA"]),
  medecin: new Set(["TESTMED", "DRDEMO", "DRAUTRE"]),
};
const VALID_TYPES = new Set(["patient", "medecin", "correspondant"]);
const VALID_INCLUDE_PDF = new Set(["latest", "none", "all"]);

/**
 * Realistic prescriber rosters, for developing and testing the "Mes patients"
 * space (/[lang]/mes-patients). ⚠ ALL NAMES ARE FICTITIOUS on purpose — never
 * put a real patient or doctor here.
 *
 * Mirrors what the REAL lab server showed on 23/09/2026 with a real prescriber
 * code: several dossiers per patient, names filled in, newest first, and each
 * prescriber confined to the dossiers he prescribed — a dossier of the SAME
 * patient prescribed by another doctor answers 404. Hence the homonym
 * "EXEMPLE Youssef" in both rosters, with different dossiers.
 *
 * `analyses_summary` uses the real format ("C GLY^C HBA1", section prefix + `^`).
 * `noPdf: true` = the lab has not attached the PDF yet (200 + empty base64).
 */
const ROSTERS = {
  "medecin:DRDEMO": [
    { dossier_id: "100926901", nom: "DÉMO", prenom: "Amina", date: "2026-09-10T08:15:00Z", analyses: "C GLY^C HBA1^C CHOL^C HDL^C LDL^C TRIG" },
    { dossier_id: "210826903", nom: "EXEMPLE", prenom: "Youssef", date: "2026-08-21T09:40:00Z", analyses: "H NFS^C CRP" },
    { dossier_id: "050726905", nom: "FICTIF", prenom: "Hanaé", date: "2026-07-05T07:55:00Z", analyses: "C GLY^C HBA1^C CR^C U", noPdf: true },
    { dossier_id: "020326902", nom: "DÉMO", prenom: "Amina", date: "2026-03-02T08:05:00Z", analyses: "C GLY^C HBA1" },
    { dossier_id: "141125904", nom: "EXEMPLE", prenom: "Youssef", date: "2025-11-14T10:20:00Z", analyses: "N TSH^N T4L" },
    { dossier_id: "180625906", nom: "ESSAI", prenom: "Karim", date: "2025-06-18T08:30:00Z", analyses: "V VITD^C FERR" },
  ],
  "medecin:DRAUTRE": [
    { dossier_id: "300526907", nom: "EXEMPLE", prenom: "Youssef", date: "2026-05-30T09:10:00Z", analyses: "S HVC^S HBV" },
    { dossier_id: "120426908", nom: "TÉMOIN", prenom: "Salma", date: "2026-04-12T08:45:00Z", analyses: "H NFS" },
  ],
};

/** Codes of prescribers and correspondents are matched like the real server: trimmed, case-insensitive. */
function canonicalRequester(type, id) {
  const t = String(id).trim();
  return type === "patient" ? t : t.toUpperCase();
}

// Minimal valid PDF ("%PDF-1.4 …") for the response-shape tests.
const CANNED_PDF_B64 =
  "JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2c+PgplbmRvYmoK";

function reject(res, status, error) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify({ error }));
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/api/v1/results") {
    return reject(res, 404, "not_found");
  }

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 50 * 1024) req.destroy(); // mirror express json 50kb limit
  });
  req.on("end", () => {
    // ── The four security layers ────────────────────────────────────────────
    // 1. API key
    const auth = req.headers["authorization"];
    if (!auth || !auth.startsWith("Bearer ") || auth.slice(7) !== API_KEY) {
      return reject(res, 401, "invalid_api_key");
    }
    // 2. Timestamp window
    const ts = parseInt(req.headers["x-timestamp"], 10);
    const now = Math.floor(Date.now() / 1000);
    if (!ts || Math.abs(now - ts) > REPLAY_WINDOW_SEC) {
      return reject(res, 401, "timestamp_out_of_window");
    }
    // 3. Nonce
    const nonce = req.headers["x-nonce"];
    if (!nonce || usedNonces.has(nonce)) {
      return reject(res, 401, "nonce_reused_or_missing");
    }
    // 4. HMAC signature over the RAW body: `ts + "." + nonce + "." + raw`.
    //    Verifying the raw body (not a re-serialization) is the recommended,
    //    serialization-agnostic approach — see docs hmac-signature-notes.md.
    const expected = crypto
      .createHmac("sha256", HMAC_SECRET)
      .update(`${ts}.${nonce}.${raw}`)
      .digest("hex");
    const provided = String(req.headers["x-signature"] || "");
    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
    ) {
      return reject(res, 401, "invalid_signature");
    }
    // Only consume the nonce once the request is fully authenticated.
    usedNonces.set(nonce, now);

    // ── Input validation ────────────────────────────────────────────────────
    let payload = {};
    try {
      payload = JSON.parse(raw || "{}");
    } catch {
      return reject(res, 400, "bad_json");
    }
    const { type, max_results, include_pdf, dossier_id } = payload;

    if (!VALID_TYPES.has(type)) {
      return reject(res, 400, "invalid_type");
    }
    if (typeof payload.requester_id !== "string" || payload.requester_id.trim() === "") {
      return reject(res, 400, "missing_requester_id");
    }
    const requester_id = canonicalRequester(type, payload.requester_id);
    if (!KNOWN[type].has(requester_id)) {
      return reject(res, 404, "requester_not_found");
    }
    // Like the real server (measured 23/09/2026): an unknown value is refused,
    // never silently treated as "all" — which would embed every PDF.
    if (include_pdf !== undefined && !VALID_INCLUDE_PDF.has(include_pdf)) {
      return reject(res, 400, "invalid_include_pdf");
    }

    // max_results: clamp to [1, 50]; default 50 if absent/invalid.
    let n = Number.isInteger(max_results) && max_results > 0 ? max_results : 50;
    if (n > MAX_RESULTS_CAP) n = MAX_RESULTS_CAP;

    // ── Fictitious prescriber rosters: newest first, confined per prescriber ──
    const roster = ROSTERS[`${type}:${requester_id}`];
    if (roster) {
      const toResult = (d, withPdf) => ({
        dossier_id: d.dossier_id,
        patient_nom: d.nom,
        patient_prenom: d.prenom,
        date_dossier: d.date,
        etat: "Final",
        analyses_summary: d.analyses,
        pdf_base64: withPdf && !d.noPdf ? CANNED_PDF_B64 : "",
      });
      let rosterResults;
      if (dossier_id !== undefined) {
        // Only THIS prescriber's dossiers: another doctor's dossier → 404, even
        // for the same patient (the rule the real server enforces).
        const one = roster.find((d) => d.dossier_id === dossier_id);
        if (!one) return reject(res, 404, "dossier_not_found");
        rosterResults = [toResult(one, true)];
      } else {
        const mode = include_pdf === undefined ? "all" : include_pdf;
        rosterResults = [...roster]
          .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
          .slice(0, n)
          .map((d, i) => toResult(d, mode === "all" || (mode === "latest" && i === 0)));
      }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ type, requester_id, results: rosterResults }));
      console.log(`[mock] 200 ${type}/${requester_id} — roster, ${rosterResults.length} result(s)`);
      return;
    }

    // patient_nom/prenom filled only for medecin/correspondant (§7.3).
    const isPatient = type === "patient";
    const DAY_MS = 24 * 60 * 60 * 1000;
    const makeDossier = (i, withPdf) => ({
      dossier_id: `9990000${String(i).padStart(3, "0")}`, // fake, non-real
      patient_nom: isPatient ? "" : "TEST_NOM",
      patient_prenom: isPatient ? "" : "TEST_PRENOM",
      // Distinct descending dates so "most recent" is well-defined (index 0
      // newest). Real date arithmetic: the old `2026-04-${15 - i}` produced
      // "2026-04-00" and "2026-04--1…" from i = 15, and a list call asks for 50.
      date_dossier: new Date(Date.UTC(2026, 3, 15, 8, 52, 20) - i * DAY_MS).toISOString(),
      etat: "Final",
      analyses_summary: "NFS, GLY, HBA1C, U, CR",
      pdf_base64: withPdf ? CANNED_PDF_B64 : "",
    });

    let results;
    if (dossier_id !== undefined) {
      // Single-dossier on-demand fetch: return only that dossier (with its PDF).
      const all = Array.from({ length: n }, (_, i) => makeDossier(i, false));
      const one = all.find((d) => d.dossier_id === dossier_id);
      if (!one) return reject(res, 404, "dossier_not_found");
      one.pdf_base64 = CANNED_PDF_B64;
      results = [one];
    } else {
      // include_pdf: "latest" | "none" | "all" (default "all").
      const mode = include_pdf === undefined ? "all" : include_pdf;
      // index 0 has the newest date_dossier, so it is "the latest".
      results = Array.from({ length: n }, (_, i) =>
        makeDossier(i, mode === "all" || (mode === "latest" && i === 0))
      );
    }

    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ type, requester_id, results }));
    console.log(
      `[mock] 200 ${type}/${requester_id} — ${results.length} result(s)` +
        `${dossier_id !== undefined ? " (single dossier)" : `, include_pdf=${include_pdf || "all"}`}, signature OK`
    );
  });
});

// Periodic nonce cleanup (mirror server behaviour).
setInterval(() => {
  const cutoff = Math.floor(Date.now() / 1000) - REPLAY_WINDOW_SEC * 2;
  for (const [n, t] of usedNonces.entries()) {
    if (t < cutoff) usedNonces.delete(n);
  }
}, 60 * 1000);

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock] CyberLab mock API listening on http://127.0.0.1:${PORT}`);
});
