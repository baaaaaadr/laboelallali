/**
 * Grant allUsers the Cloud Run invoker role on every gen2 Cloud Function service
 * in the region, so the Firebase callable SDK can reach them from the browser.
 *
 * WHY: gen2 callables (onCall) enforce auth INSIDE the function (Firebase ID
 * token), so their Cloud Run service must allow unauthenticated invocation. When
 * it doesn't, the browser's CORS preflight gets a 403 with no Access-Control
 * headers → "blocked by CORS policy". `firebase deploy` does not reliably set
 * this for newly-created gen2 functions, so run this AFTER deploying new ones.
 *
 * Run from functions/ (needs google-auth-library, a firebase-admin dep):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\serviceAccountKey.json"
 *   $env:NODE_OPTIONS="--use-system-ca"
 *   node scripts/grant-invoker.js
 */
const { GoogleAuth } = require("google-auth-library");

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "labo-el-allali-pwa";
const REGION = "europe-southwest1";

async function main() {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const base = `https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services`;

  const services = (await client.request({ url: base })).data.services || [];
  if (!services.length) {
    console.log("No Cloud Run services found in", REGION);
    return;
  }
  for (const s of services) {
    const name = s.name.split("/").pop();
    const res = `${base}/${name}`;
    try {
      const pol = (await client.request({ url: `${res}:getIamPolicy` })).data || {};
      pol.bindings = pol.bindings || [];
      let b = pol.bindings.find((x) => x.role === "roles/run.invoker");
      if (!b) {
        b = { role: "roles/run.invoker", members: [] };
        pol.bindings.push(b);
      }
      if (b.members.includes("allUsers")) {
        console.log(`- ${name}: already public`);
        continue;
      }
      b.members.push("allUsers");
      await client.request({ url: `${res}:setIamPolicy`, method: "POST", data: { policy: pol } });
      console.log(`- ${name}: allUsers invoker granted`);
    } catch (e) {
      console.log(`- ${name}: FAILED — ${e.response?.data?.error?.message || e.message}`);
    }
  }
}

main().catch((e) => {
  console.error("FAILED:", e.response?.data || e.message);
  process.exit(1);
});
