/**
 * One-off REAL SMTP smoke test for the monitoring mailer.
 *
 * Sends a clearly-labeled "TEST — supervision serveur" email to ALERT_EMAILS,
 * to confirm the Gmail app password + recipients work BEFORE relying on the
 * scheduled monitor. Requires a build first (npm run build).
 *
 *   node scripts/send-test-email.js
 *
 * Reads SMTP_USER / SMTP_PASS from env or functions/.secret.local, and
 * ALERT_EMAILS from env or functions/.env (falls back to SMTP_USER only).
 * If SMTP creds are missing/placeholder, the mailer runs in simulated mode and
 * this script just logs — a real send needs the app password in place.
 */
const fs = require("fs");
const path = require("path");
const nodemailer = require(path.join(__dirname, "..", "node_modules", "nodemailer"));
const FN_DIR = path.join(__dirname, "..");
const { renderAlertEmail } = require(path.join(FN_DIR, "lib/email/mailer"));

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

const user = process.env.SMTP_USER || secrets.SMTP_USER;
const pass = process.env.SMTP_PASS || secrets.SMTP_PASS;
const recipientsRaw =
  process.env.ALERT_EMAILS || envFile.ALERT_EMAILS || user || "";
const recipients = recipientsRaw
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.includes("@"));

if (!user || !pass || !user.includes("@")) {
  console.error(
    "SMTP_USER / SMTP_PASS missing or placeholder — cannot send a real email.\n" +
      "Set them in env or functions/.secret.local (Gmail address + app password)."
  );
  process.exit(1);
}
if (recipients.length === 0) {
  console.error("No recipients (ALERT_EMAILS empty and no SMTP_USER).");
  process.exit(1);
}

(async () => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  const html = renderAlertEmail({
    title: "TEST — supervision serveur de résultats",
    lead:
      "Ceci est un email de TEST de la supervision automatique. Si vous le recevez, " +
      "les alertes de panne fonctionneront correctement.",
    rows: [["Date du test", new Date().toISOString()]],
    footer: "Aucune action requise. Vous pouvez ignorer ce message.",
  });
  const info = await transporter.sendMail({
    from: `"Supervision Labo El Allali" <${user}>`,
    to: recipients.join(", "),
    subject: "[Labo El Allali] TEST — supervision serveur de résultats",
    html,
  });
  console.log(`Sent to ${recipients.length} recipient(s). messageId=${info.messageId}`);
})().catch((err) => {
  console.error("Send failed:", err.message || err);
  process.exit(1);
});
