/**
 * Times the two loading strategies against the configured server, to decide
 * between them empirically. CONTENT-FREE output: only timings (ms), PDF counts
 * and payload sizes (KB). No patient data is printed.
 *
 *   Approach A (1 call):  include_pdf="latest"  → list + newest PDF together
 *   Approach B (2 calls): include_pdf="none" (list) then dossier_id=newest (PDF)
 *
 * Run (real server, reads functions/.env + functions/.secret.local):
 *   node scripts/time-approaches.js
 */
const fs = require("fs");
const path = require("path");
const FN = path.join(__dirname, "..");
const { callCyberlab } = require(path.join(FN, "lib/cyberlab/client"));

function loadEnv(file) {
  const out = {};
  try {
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const l = raw.trim();
      if (!l || l.startsWith("#")) continue;
      const eq = l.indexOf("=");
      if (eq !== -1) out[l.slice(0, eq).trim()] = l.slice(eq + 1).trim();
    }
  } catch {
    /* optional */
  }
  return out;
}

const secrets = loadEnv(path.join(FN, ".secret.local"));
const env = loadEnv(path.join(FN, ".env"));
const cfg = {
  apiUrl: process.env.CYBERLAB_API_URL || env.CYBERLAB_API_URL,
  apiKey: process.env.CYBERLAB_API_KEY || process.env.API_KEY || secrets.CYBERLAB_API_KEY || secrets.API_KEY,
  hmacSecret: process.env.CYBERLAB_HMAC_SECRET || process.env.HMAC_SECRET || secrets.CYBERLAB_HMAC_SECRET || secrets.HMAC_SECRET,
};
const ID = process.argv[2] || "7587";
const ROUNDS = 3;

const pdfCount = (r) => (r.results || []).filter((x) => x.pdf_base64 && x.pdf_base64.length > 0).length;
const sizeKB = (r) => Math.round((r.results || []).reduce((n, x) => n + (x.pdf_base64 || "").length, 0) / 1024);

async function timed(fn) {
  const t = performance.now();
  const r = await fn();
  return { ms: Math.round(performance.now() - t), r };
}

async function main() {
  if (!cfg.apiUrl || !cfg.apiKey || !cfg.hmacSecret) {
    console.error("Missing config (functions/.env + functions/.secret.local).");
    process.exit(1);
  }
  console.log(`Timing patient ${ID} — ${ROUNDS} rounds (after 1 warm-up)\n`);

  // Warm-up (TLS handshake / any cold path) — discarded.
  await callCyberlab(cfg, { type: "patient", requester_id: ID, max_results: 50, include_pdf: "none" });

  const rows = [];
  for (let i = 1; i <= ROUNDS; i++) {
    const A = await timed(() =>
      callCyberlab(cfg, { type: "patient", requester_id: ID, max_results: 50, include_pdf: "latest" })
    );
    const B1 = await timed(() =>
      callCyberlab(cfg, { type: "patient", requester_id: ID, max_results: 50, include_pdf: "none" })
    );
    const newest = (B1.r.results || []).reduce((m, x) => (!m || x.date_dossier > m.date_dossier ? x : m), null);
    const B2 = await timed(() =>
      callCyberlab(cfg, { type: "patient", requester_id: ID, dossier_id: newest.dossier_id })
    );

    rows.push({
      A_ms: A.ms, A_pdfs: pdfCount(A.r), A_kb: sizeKB(A.r),
      B_list_ms: B1.ms, B_pdf_ms: B2.ms, B_total_ms: B1.ms + B2.ms, B_kb: sizeKB(B2.r),
    });
    console.log(
      `Round ${i}: ` +
        `A(latest)=${A.ms}ms [${pdfCount(A.r)} pdf, ${sizeKB(A.r)}KB]  |  ` +
        `B: list=${B1.ms}ms  newestPDF=${B2.ms}ms  total=${B1.ms + B2.ms}ms`
    );
  }

  const avg = (k) => Math.round(rows.reduce((s, r) => s + r[k], 0) / rows.length);
  console.log("\n── Averages ──");
  console.log(`A (1 call, "latest"):   everything visible after ~${avg("A_ms")}ms`);
  console.log(`B (2 calls):            LIST visible after ~${avg("B_list_ms")}ms,  newest PDF after ~${avg("B_total_ms")}ms`);
  console.log(
    `\nList appears ${avg("A_ms") - avg("B_list_ms")}ms sooner with B; ` +
      `newest PDF is ${avg("B_total_ms") - avg("A_ms")}ms ${avg("B_total_ms") >= avg("A_ms") ? "later" : "sooner"} with B.`
  );
  console.log("(Note: real app adds ~1 extra Firebase callable hop for B's 2nd call.)");
}

main().catch((e) => {
  console.error("Timing failed:", e.message || e);
  process.exit(1);
});
