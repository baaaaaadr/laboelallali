/**
 * diag-dossier.js — diagnostic "pourquoi ce dossier ne renvoie pas de PDF ?"
 *
 * Interroge DIRECTEMENT le serveur CyberLab (pas de Firebase, pas de Firestore)
 * avec la même signature HMAC que la Cloud Function, et compare plusieurs
 * stratégies de récupération pour un `requester_id` donné :
 *
 *   1. liste seule            (include_pdf: "none")
 *   2. PDF du plus récent     (include_pdf: "latest")
 *   3. tous les PDF           (include_pdf: "all")
 *   4. legacy                 (aucun include_pdf → comportement historique)
 *   5. un dossier à la demande(dossier_id: <id>) — ce que fait le bouton "Voir"
 *
 * Confidentialité : n'imprime QUE des métadonnées (id de dossier, état, date,
 * taille du PDF, entête magique). Jamais le contenu d'un PDF ni le détail des
 * analyses. Aucun résultat n'est écrit sur disque (sauf --save-pdf, explicite).
 *
 * Usage :
 *   node scripts/diag-dossier.js <requester_id> [--type patient] [--dossier <id>]
 *                                [--compare 7587] [--save-pdf]
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
      if (eq === -1) continue;
      out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  } catch {
    /* absent */
  }
  return out;
}

const functionsDir = path.join(__dirname, "..");
const secrets = loadEnvFile(path.join(functionsDir, ".secret.local"));
const env = loadEnvFile(path.join(functionsDir, ".env"));
const CFG = {
  apiUrl: process.env.CYBERLAB_API_URL || env.CYBERLAB_API_URL,
  apiKey: secrets.CYBERLAB_API_KEY || secrets.API_KEY,
  hmacSecret: secrets.CYBERLAB_HMAC_SECRET || secrets.HMAC_SECRET,
};

function normalizeApiUrl(url) {
  const t = String(url || "").trim();
  const w = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  return w.replace(/\/+$/, "");
}

/** POST signé, renvoie {status, ms, json, rawLen, parseError}. */
async function call(payload) {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const signature = crypto
    .createHmac("sha256", CFG.hmacSecret)
    .update(`${timestamp}.${nonce}.${body}`)
    .digest("hex");
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`${normalizeApiUrl(CFG.apiUrl)}/api/v1/results`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CFG.apiKey}`,
        "Content-Type": "application/json",
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
        "X-Signature": signature,
      },
      body,
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, netError: String(e && e.message) };
  }
  const text = await res.text();
  let json = null;
  let parseError = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    parseError = String(e && e.message);
  }
  return {
    status: res.status,
    ms: Date.now() - t0,
    rawLen: text.length,
    json,
    parseError,
    // Sur erreur, le corps est court et non médical → utile à afficher.
    errBody: res.ok ? null : text.slice(0, 300),
    contentType: res.headers.get("content-type"),
  };
}

/** Décrit un pdf_base64 sans jamais l'imprimer. */
function describePdf(v) {
  if (v === undefined) return "champ ABSENT";
  if (v === null) return "null";
  if (typeof v !== "string") return `type inattendu (${typeof v})`;
  if (v.length === 0) return "chaîne VIDE";
  let buf;
  try {
    buf = Buffer.from(v, "base64");
  } catch {
    return `${v.length} car. base64 INVALIDE`;
  }
  const magic = buf.slice(0, 5).toString("latin1");
  const tail = buf.slice(-1024).toString("latin1");
  const ok = magic.startsWith("%PDF");
  const eof = tail.includes("%%EOF");
  return (
    `${v.length} car. b64 → ${buf.length} o | entête="${magic.replace(/[^\x20-\x7e]/g, ".")}"` +
    ` ${ok ? "PDF ✓" : "PAS UN PDF ✗"} | %%EOF ${eof ? "✓" : "✗"}`
  );
}

function summarize(label, r, opts = {}) {
  console.log(`\n=== ${label} ===`);
  if (r.netError) {
    console.log(`  ERREUR RÉSEAU: ${r.netError} (${r.ms} ms)`);
    return;
  }
  console.log(
    `  HTTP ${r.status} | ${r.ms} ms | corps ${r.rawLen} o | ${r.contentType || "?"}`
  );
  if (r.status !== 200) {
    console.log(`  corps d'erreur: ${r.errBody}`);
    return;
  }
  if (r.parseError) {
    console.log(`  JSON INVALIDE: ${r.parseError}`);
    return;
  }
  const j = r.json || {};
  console.log(`  clés racine: ${Object.keys(j).join(", ")}`);
  const results = Array.isArray(j.results) ? j.results : [];
  console.log(`  results: ${results.length}`);
  for (const [i, res] of results.entries()) {
    if (opts.limit && i >= opts.limit) {
      console.log(`  … (${results.length - opts.limit} autres masqués)`);
      break;
    }
    const keys = Object.keys(res).join(",");
    console.log(
      `   [${i}] dossier=${res.dossier_id} | date=${res.date_dossier} | etat="${res.etat}"` +
        ` | nb_analyses~${String(res.analyses_summary || "").split(/[,;]/).filter(Boolean).length}`
    );
    console.log(`        pdf: ${describePdf(res.pdf_base64)}`);
    if (opts.showKeys) console.log(`        champs: ${keys}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const requesterId = args[0];
  if (!requesterId) {
    console.error(
      "Usage: node scripts/diag-dossier.js <requester_id> [--type patient] [--dossier <id>] [--compare <id>] [--save-pdf]"
    );
    process.exit(1);
  }
  const getFlag = (name, def) => {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : def;
  };
  const type = getFlag("type", "patient");
  const compareId = getFlag("compare", null);
  const savePdf = args.includes("--save-pdf");
  let dossierId = getFlag("dossier", null);

  for (const [k, v] of Object.entries(CFG)) {
    if (!v) {
      console.error(`Config manquante: ${k} (functions/.env / .secret.local)`);
      process.exit(1);
    }
  }
  const host = normalizeApiUrl(CFG.apiUrl).replace(/^https?:\/\//, "");
  console.log(`serveur: ${host.replace(/^[^.]+/, "***")} | type=${type} | id=${requesterId}`);

  // 1) Liste seule — exactement ce que fait l'app en phase 1.
  const list = await call({ type, requester_id: requesterId, max_results: 50, include_pdf: "none" });
  summarize("1. liste seule (include_pdf:none)", list, { showKeys: true });

  const results = (list.json && list.json.results) || [];
  if (!dossierId && results.length) dossierId = results[0].dossier_id;

  // 2) latest — PDF du plus récent uniquement.
  summarize(
    '2. include_pdf:"latest"',
    await call({ type, requester_id: requesterId, max_results: 50, include_pdf: "latest" })
  );

  // 3) all — tous les PDF.
  const all = await call({
    type,
    requester_id: requesterId,
    max_results: 50,
    include_pdf: "all",
  });
  summarize('3. include_pdf:"all"', all);

  // 4) legacy — sans include_pdf (comportement historique du serveur).
  summarize(
    "4. legacy (aucun include_pdf)",
    await call({ type, requester_id: requesterId, max_results: 50 })
  );

  // 5) dossier_id — exactement ce que fait le bouton "Voir le PDF".
  if (dossierId) {
    const one = await call({ type, requester_id: requesterId, dossier_id: dossierId });
    summarize(`5. dossier_id="${dossierId}" (bouton « Voir »)`, one);

    // 5b) variantes de format d'identifiant (typage, espaces, zéro initial).
    const variants = [
      ["nombre JSON", Number(dossierId)],
      ["espaces autour", ` ${dossierId} `],
      ["zéro initial", `0${dossierId}`],
    ];
    for (const [name, val] of variants) {
      if (typeof val === "number" && !Number.isFinite(val)) continue;
      const r = await call({ type, requester_id: requesterId, dossier_id: val });
      const n = ((r.json || {}).results || []).length;
      const pdf = n ? describePdf(r.json.results[0].pdf_base64) : "—";
      console.log(`  variante ${name}: HTTP ${r.status}, results=${n}, pdf=${pdf}`);
    }

    // 5c) sans max_results ni include_pdf, avec dossier_id + include_pdf:"all"
    const forced = await call({
      type,
      requester_id: requesterId,
      dossier_id: dossierId,
      include_pdf: "all",
    });
    summarize(`5c. dossier_id + include_pdf:"all"`, forced);

    if (savePdf) {
      const src =
        ((forced.json || {}).results || [])[0] ||
        ((all.json || {}).results || []).find((r) => r.dossier_id === dossierId);
      if (src && src.pdf_base64) {
        const out = path.join(functionsDir, `diag-${dossierId}.pdf`);
        fs.writeFileSync(out, Buffer.from(src.pdf_base64, "base64"));
        console.log(`\n  PDF écrit: ${out}`);
      } else {
        console.log("\n  (rien à sauvegarder : aucun pdf_base64 non vide)");
      }
    }
  } else {
    console.log("\n5. dossier_id — ignoré (aucun dossier trouvé en phase 1)");
  }

  // 6) Témoin de comparaison — prouve que le serveur sait renvoyer des PDF.
  if (compareId) {
    console.log(`\n\n########## TÉMOIN: ${compareId} ##########`);
    const cList = await call({
      type,
      requester_id: compareId,
      max_results: 50,
      include_pdf: "none",
    });
    summarize(`T1. liste témoin ${compareId}`, cList, { limit: 5 });
    const cAll = await call({
      type,
      requester_id: compareId,
      max_results: 5,
      include_pdf: "latest",
    });
    summarize(`T2. témoin ${compareId} include_pdf:"latest"`, cAll, { limit: 5 });
    const cRes = (cList.json && cList.json.results) || [];
    if (cRes.length) {
      const cid = cRes[0].dossier_id;
      summarize(
        `T3. témoin ${compareId} dossier_id="${cid}"`,
        await call({ type, requester_id: compareId, dossier_id: cid })
      );
    }
  }
}

main().catch((e) => {
  console.error("Erreur inattendue:", e && e.message);
  process.exit(1);
});
