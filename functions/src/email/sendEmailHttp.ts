/**
 * `sendEmail` — the single transactional-email endpoint for the whole app.
 *
 * WHY: email used to live in two disconnected places — the Next.js appointment
 * route (nodemailer + SMTP creds baked into the hosting build) and the
 * monitoring mailer (Secret Manager). This HTTPS function is the ONE sender:
 * the appointment/glabo route calls it, the monitoring calls the same underlying
 * `sendMail` in-process. Credentials live ONLY in Secret Manager.
 *
 * AUTH: server-to-server only. Callers must present the shared `INTERNAL_EMAIL_TOKEN`
 * (Secret Manager) in the `X-Internal-Token` header. This is NOT a public email
 * relay — the token gates every send. Constant-time comparison; body is validated.
 */
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { createHmac, timingSafeEqual } from "crypto";
import { sendMail, SMTP_USER, SMTP_PASS } from "./mailer";

export const INTERNAL_EMAIL_TOKEN = defineSecret("INTERNAL_EMAIL_TOKEN");

/** Constant-time string compare (avoids leaking the token via timing). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return ha.length === hb.length && timingSafeEqual(ha, hb);
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.includes("@"));
  if (typeof v === "string" && v.includes("@")) {
    return v.split(",").map((s) => s.trim()).filter((s) => s.includes("@"));
  }
  return [];
}

export const sendEmail = onRequest(
  {
    region: "europe-west1",
    memory: "256MiB",
    secrets: [SMTP_USER, SMTP_PASS, INTERNAL_EMAIL_TOKEN],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    const expected = INTERNAL_EMAIL_TOKEN.value();
    const provided = String(req.get("X-Internal-Token") || "");
    if (!expected || !provided || !safeEqual(provided, expected)) {
      logger.warn("sendEmail: rejected (bad or missing token)");
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const body = (req.body || {}) as {
      to?: unknown;
      cc?: unknown;
      replyTo?: unknown;
      subject?: unknown;
      html?: unknown;
      fromName?: unknown;
    };
    const to = asStringArray(body.to);
    const cc = asStringArray(body.cc);
    const subject = typeof body.subject === "string" ? body.subject : "";
    const html = typeof body.html === "string" ? body.html : "";
    const replyTo =
      typeof body.replyTo === "string" && body.replyTo.includes("@") ? body.replyTo : undefined;
    const fromName = typeof body.fromName === "string" ? body.fromName : undefined;

    if (to.length === 0 || !subject || !html) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }

    try {
      await sendMail({ to, cc, replyTo, subject, html, fromName });
      res.status(200).json({ ok: true });
    } catch (err) {
      logger.error("sendEmail: send failed", {
        message: err instanceof Error ? err.message : String(err),
      });
      res.status(502).json({ error: "send_failed" });
    }
  }
);
