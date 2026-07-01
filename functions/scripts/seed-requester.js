/**
 * Seed a patient's CyberLab identity onto their Firestore profile.
 *
 * Finds the Firebase Auth user by email, then MERGES { requester_id, type }
 * into users/{uid} — so you never have to edit the Firestore console by hand.
 * Uses merge:true, so it never clobbers name/phone/etc. already on the doc.
 *
 * Prereqs:
 *   1. Log into the app once with this email (creates the Auth user; completing
 *      the profile also creates the users/{uid} doc).
 *   2. Admin creds to prod Firestore/Auth, either:
 *        a. Service-account key (no gcloud needed):
 *           $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\serviceAccountKey.json"
 *           (Firebase Console → Project settings → Service accounts → Generate
 *            new private key). Keep the file OUTSIDE the repo.
 *        b. Or, if gcloud is installed: `gcloud auth application-default login`.
 *
 * Run (PowerShell, from the functions/ folder):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\serviceAccountKey.json"
 *   node scripts/seed-requester.js you@email.com                 # defaults: 7587 / patient
 *   node scripts/seed-requester.js you@email.com 7587 patient
 */
const path = require("path");
const admin = require("firebase-admin");

const VALID_TYPES = ["patient", "medecin", "correspondant"];

async function main() {
  const email = process.argv[2];
  const requesterId = process.argv[3] || "7587";
  const type = process.argv[4] || "patient";

  if (!email) {
    console.error("Usage: node scripts/seed-requester.js <email> [requester_id] [type]");
    process.exit(1);
  }
  if (!VALID_TYPES.includes(type)) {
    console.error(`Invalid type "${type}". Must be one of: ${VALID_TYPES.join(", ")}`);
    process.exit(1);
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT || "labo-el-allali-pwa";
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    admin.initializeApp({
      credential: admin.credential.cert(require(path.resolve(keyPath))),
      projectId,
    });
    console.log(`[seed] auth=service-account-key (${path.basename(keyPath)})`);
  } else {
    admin.initializeApp({ projectId });
    console.log("[seed] auth=ADC (GOOGLE_APPLICATION_CREDENTIALS not set)");
  }
  console.log(`[seed] project=${projectId} email=${email} requester_id=${requesterId} type=${type}`);

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (e) {
    console.error(
      `[seed] No Auth user found for ${email}. Log into the app once first, then re-run. ` +
        `(${e.code || e.message})`
    );
    process.exit(1);
  }
  const uid = userRecord.uid;

  const ref = admin.firestore().doc(`users/${uid}`);
  const before = await ref.get();
  if (!before.exists) {
    console.warn(`[seed] users/${uid} does not exist yet — creating it with only requester_id/type.`);
    console.warn("[seed] Tip: complete your profile in the app so the doc also has name/phone.");
  }

  await ref.set({ requester_id: String(requesterId), type }, { merge: true });

  const after = (await ref.get()).data() || {};
  console.log(`[seed] OK — users/${uid}: type=${after.type} requester_id=${after.requester_id}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[seed] FAILED:", e);
  process.exit(1);
});
