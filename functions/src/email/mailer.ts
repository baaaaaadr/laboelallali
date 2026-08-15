/**
 * Shared alert mailer — the ONLY place SMTP lives in the functions codebase.
 *
 * Used by the CyberLab server monitoring (`monitoring/healthCheck.ts`) and the
 * patient-impact hook in `cyberlab/fetchResults.ts`. Appointment emails are a
 * separate system (Next.js API route `src/app/api/send-appointment/route.ts`)
 * and deliberately stay there.
 *
 * Simulated mode: when SMTP_USER/SMTP_PASS are missing or placeholders (any
 * value that is not an email address), `sendMail` logs the subject and returns
 * as if it succeeded. This lets the monitoring deploy and run BEFORE the Gmail
 * app password exists, and keeps emulator/local runs inert.
 *
 * Privacy: never log a recipient patient email — subjects and counts only.
 */
import { defineSecret, defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as nodemailer from "nodemailer";

// Exported so every function that sends mail can bind them in its `secrets:`
// array (defineSecret is idempotent by name across files).
export const SMTP_USER = defineSecret("SMTP_USER");
export const SMTP_PASS = defineSecret("SMTP_PASS");

// Non-secret config — real values live in functions/.env; the code defaults
// below also prevent interactive prompts during scripted deploys.
export const ALERT_EMAILS = defineString("ALERT_EMAILS", {
  default:
    "azizelallali@gmail.com,laboelallali@gmail.com," +
    "communication.labo.elallali@gmail.com,hassanelallali@gmail.com",
});
export const APP_URL = defineString("APP_URL", {
  default: "https://www.laboelallali.com",
});

/** Escape a value before interpolating it into email HTML. Always use this. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The lab staff alert recipients (comma-separated in ALERT_EMAILS). */
export function alertRecipients(): string[] {
  return ALERT_EMAILS.value()
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

/** "14/08/2026 à 11:43" in Morocco time — what the staff reads on their phone. */
export function fmtCasablanca(ms: number): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Africa/Casablanca",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(new Date(ms))
      .replace(", ", " à ");
  } catch {
    return new Date(ms).toISOString();
  }
}

/** "3 j 4 h", "2 h 35 min", "45 min" — durations for outage summaries. */
export function fmtDuration(ms: number): string {
  const totalMin = Math.max(1, Math.round(ms / 60000));
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const min = totalMin % 60;
  if (days > 0) return `${days} j ${hours} h`;
  if (hours > 0) return min > 0 ? `${hours} h ${min} min` : `${hours} h`;
  return `${min} min`;
}

/**
 * Shared layout for every alert email: bordeaux header (brand), a lead line,
 * detail rows, and a footer note. Every dynamic value MUST already be escaped
 * by the caller (or passed through `escapeHtml` here where marked).
 */
export function renderAlertEmail(opts: {
  title: string;
  lead: string;
  rows?: Array<[string, string]>;
  todo?: string;
  footer?: string;
  rtl?: boolean;
}): string {
  const rows = (opts.rows ?? [])
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;color:#222;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");
  return `
  <div dir="${opts.rtl ? "rtl" : "ltr"}" style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
    <div style="background:#800020;color:#ffffff;padding:16px 20px;">
      <h1 style="margin:0;font-size:18px;">${escapeHtml(opts.title)}</h1>
    </div>
    <div style="padding:20px;background:#ffffff;">
      <p style="margin:0 0 14px;color:#222;font-size:15px;line-height:1.5;">${escapeHtml(opts.lead)}</p>
      ${rows ? `<table style="border-collapse:collapse;font-size:14px;margin:0 0 14px;">${rows}</table>` : ""}
      ${
        opts.todo
          ? `<p style="margin:0 0 14px;padding:10px 14px;border-left:4px solid #FF4081;background:#fff5f8;color:#222;font-size:14px;line-height:1.5;">${escapeHtml(opts.todo)}</p>`
          : ""
      }
      ${
        opts.footer
          ? `<p style="margin:0;color:#888;font-size:12px;line-height:1.5;">${escapeHtml(opts.footer)}</p>`
          : ""
      }
    </div>
  </div>`;
}

function smtpConfigured(user: string, pass: string): boolean {
  // A placeholder secret (e.g. "PLACEHOLDER") keeps deploys working before the
  // real Gmail app password exists — anything that is not an email address
  // means "simulated mode".
  return Boolean(user && pass && user.includes("@"));
}

/**
 * True when real SMTP creds are present (not simulated mode). Callers that would
 * DESTROY state on a "successful" send (e.g. deleting a waitlist entry) must
 * check this first — a simulated send logs but delivers nothing.
 */
export function isSmtpConfigured(): boolean {
  return smtpConfigured(SMTP_USER.value(), SMTP_PASS.value());
}

/**
 * Send one email. Throws on transport failure (callers decide whether a failed
 * send should be retried — the health-check state machine does). In simulated
 * mode it logs and returns normally, counting as sent.
 */
export async function sendMail(opts: {
  to: string[];
  subject: string;
  html: string;
  cc?: string[];
  replyTo?: string;
  /** Display name in the From header (default: monitoring). */
  fromName?: string;
}): Promise<void> {
  const user = SMTP_USER.value();
  const pass = SMTP_PASS.value();

  if (!smtpConfigured(user, pass)) {
    logger.warn("mailer: SMTP not configured — simulated send", {
      subject: opts.subject,
      recipients: opts.to.length,
    });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"${opts.fromName || "Supervision Labo El Allali"}" <${user}>`,
    to: opts.to.join(", "),
    cc: opts.cc && opts.cc.length ? opts.cc.join(", ") : undefined,
    replyTo: opts.replyTo || undefined,
    subject: opts.subject,
    html: opts.html,
  });

  logger.info("mailer: sent", {
    subject: opts.subject,
    recipients: opts.to.length + (opts.cc ? opts.cc.length : 0),
  });
}

/** The Gmail account address (also the default primary recipient / From). */
export function smtpUserValue(): string {
  return SMTP_USER.value();
}
