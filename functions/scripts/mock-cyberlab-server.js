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

// Test identifiers provided by the lab editor.
const KNOWN = {
  patient: new Set(["7587", "142807"]),
  correspondant: new Set(["TESTA"]),
  medecin: new Set(["TESTMED"]),
};
const VALID_TYPES = new Set(["patient", "medecin", "correspondant"]);

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
    const { type, requester_id, max_results, include_pdf, dossier_id } = payload;

    if (!VALID_TYPES.has(type)) {
      return reject(res, 400, "invalid_type");
    }
    if (typeof requester_id !== "string" || requester_id.trim() === "") {
      return reject(res, 400, "missing_requester_id");
    }
    if (!KNOWN[type].has(requester_id)) {
      return reject(res, 404, "requester_not_found");
    }

    // max_results: clamp to [1, 50]; default 50 if absent/invalid.
    let n = Number.isInteger(max_results) && max_results > 0 ? max_results : 50;
    if (n > MAX_RESULTS_CAP) n = MAX_RESULTS_CAP;

    // patient_nom/prenom filled only for medecin/correspondant (§7.3).
    const isPatient = type === "patient";
    const makeDossier = (i, withPdf) => ({
      dossier_id: `9990000${String(i).padStart(3, "0")}`, // fake, non-real
      patient_nom: isPatient ? "" : "TEST_NOM",
      patient_prenom: isPatient ? "" : "TEST_PRENOM",
      // Distinct descending dates so "most recent" is well-defined (index 0 newest).
      date_dossier: `2026-04-${String(15 - i).padStart(2, "0")}T08:52:20Z`,
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
