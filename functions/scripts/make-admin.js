/**
 * Set (or remove) a team role on a user's Firestore profile.
 *
 * Role hierarchy: owner > admin > staff. Sets users/{uid}.role. This is the
 * out-of-band bootstrap for the FIRST owner(s); afterwards owners/admins manage
 * roles from the /admin space UI.
 *
 * Prereqs: the target must have logged into the app once (so the Auth user
 * exists) + GOOGLE_APPLICATION_CREDENTIALS pointing to a service-account key
 * (or `gcloud auth application-default login`).
 *
 * Run (PowerShell, from functions/):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\serviceAccountKey.json"
 *   node scripts/make-admin.js you@email.com owner     # owner | admin | staff
 *   node scripts/make-admin.js you@email.com revoke     # remove any role
 */
const path = require("path");
const admin = require("firebase-admin");

const ROLES = ["owner", "admin", "staff"];

async function main() {
  const email = process.argv[2];
  const arg = (process.argv[3] || "admin").toLowerCase();
  const revoke = arg === "revoke" || arg === "none";
  const role = revoke ? null : arg;

  if (!email) {
    console.error("Usage: node scripts/make-admin.js <email> [owner|admin|staff|revoke]");
    process.exit(1);
  }
  if (!revoke && !ROLES.includes(role)) {
    console.error(`Invalid role "${arg}". Use one of: ${ROLES.join(", ")}, revoke`);
    process.exit(1);
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT || "labo-el-allali-pwa";
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    admin.initializeApp({
      credential: admin.credential.cert(require(path.resolve(keyPath))),
      projectId,
    });
    console.log(`[make-admin] auth=service-account-key (${path.basename(keyPath)})`);
  } else {
    admin.initializeApp({ projectId });
    console.log("[make-admin] auth=ADC (GOOGLE_APPLICATION_CREDENTIALS not set)");
  }

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (e) {
    console.error(
      `[make-admin] No Auth user for ${email}. Log into the app once first. (${e.code || e.message})`
    );
    process.exit(1);
  }
  const uid = userRecord.uid;

  await admin.firestore().doc(`users/${uid}`).set({ role }, { merge: true });

  console.log(
    `[make-admin] OK — users/${uid}.role = ${role ?? "(removed)"} for ${email}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("[make-admin] FAILED:", e);
  process.exit(1);
});
