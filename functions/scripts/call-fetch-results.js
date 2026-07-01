/**
 * Local test harness for the CyberLab bridge — exercises the real core logic
 * (Firestore profile read → HMAC signing → HTTP call → response) without needing
 * the callable/auth plumbing or the emulator.
 *
 * Prereqs:
 *   1. `npm run build` (compiles src → lib).
 *   2. A `users/{uid}` doc in prod Firestore with `requester_id` + `type`.
 *   3. `functions/.secret.local` with CYBERLAB_API_KEY / CYBERLAB_HMAC_SECRET.
 *   4. `functions/.env` with CYBERLAB_API_URL (the mock or the real origin).
 *   5. Credentials to read prod Firestore — either:
 *      a. A service account key (no gcloud needed): set
 *         GOOGLE_APPLICATION_CREDENTIALS=<absolute path to serviceAccountKey.json>
 *         (Firebase Console → Project settings → Service accounts → Generate key).
 *         Keep the key OUTSIDE the repo (e.g. your private secrets folder).
 *      b. Or, if gcloud is installed: `gcloud auth application-default login`.
 *
 * Run (PowerShell example, service-account key):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\serviceAccountKey.json"
 *   node scripts/call-fetch-results.js <uid>
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

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
    /* file may not exist */
  }
  return out;
}

async function main() {
  const uid = process.argv[2];
  if (!uid) {
    console.error("Usage: node scripts/call-fetch-results.js <uid>");
    process.exit(1);
  }

  const functionsDir = path.join(__dirname, "..");
  const secrets = loadEnvFile(path.join(functionsDir, ".secret.local"));
  const env = loadEnvFile(path.join(functionsDir, ".env"));

  const cfg = {
    apiUrl: process.env.CYBERLAB_API_URL || env.CYBERLAB_API_URL,
    apiKey:
      process.env.CYBERLAB_API_KEY || process.env.API_KEY || secrets.CYBERLAB_API_KEY || secrets.API_KEY,
    hmacSecret:
      process.env.CYBERLAB_HMAC_SECRET ||
      process.env.HMAC_SECRET ||
      secrets.CYBERLAB_HMAC_SECRET ||
      secrets.HMAC_SECRET,
  };
  const missing = Object.entries(cfg)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    console.error(
      `Missing config: ${missing.join(", ")} ` +
        "(check functions/.env and functions/.secret.local)."
    );
    process.exit(1);
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT || "labo-el-allali-pwa";
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    // Explicit service account key (no gcloud required).
    admin.initializeApp({
      credential: admin.credential.cert(require(path.resolve(keyPath))),
      projectId,
    });
    console.log(`[test] auth=service-account-key (${path.basename(keyPath)})`);
  } else {
    // Fall back to Application Default Credentials (e.g. gcloud login).
    admin.initializeApp({ projectId });
    console.log("[test] auth=ADC (GOOGLE_APPLICATION_CREDENTIALS not set)");
  }
  console.log(`[test] project=${projectId} apiUrl=${cfg.apiUrl} uid=${uid}`);

  // Compiled core (run `npm run build` first).
  const { fetchResultsForUser } = require("../lib/cyberlab/fetchResults");

  try {
    const response = await fetchResultsForUser(uid, cfg);
    console.log("[test] SUCCESS — response:");
    console.log(JSON.stringify(response, null, 2));
  } catch (err) {
    console.error(`[test] FAILED — ${err.name || "Error"}: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
