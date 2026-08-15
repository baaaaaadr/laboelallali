/**
 * `checkCyberlabHealth` — scheduled (every 5 min) probe of the lab's CyberLab
 * results server, with transition-only email alerts to the lab staff and the
 * patient "notify me when it's back" waitlist drain.
 *
 * Born from the 13–14/08/2026 outages (power failures at the lab → Cloudflare
 * 522/523): patients saw "Panne temporaire" but nobody was told. See
 * docs/integrations/server-monitoring.md for the runbook.
 *
 * REGION — `europe-west1`, NOT the `europe-southwest1` used by the callables:
 * Cloud Scheduler has no europe-southwest1 location (same constraint as
 * `cleanupExpiredPrescriptions` in index.ts — do not "align" this).
 *
 * Design (see monitoring/stateMachine.ts for the pure logic + invariants):
 *  - probe = the lab-blessed test id 7587, list-only, 1 result, no PDFs —
 *    zero medical content;
 *  - a failed probe is re-checked 20 s later before declaring the check down
 *    (blip filter); the second opinion wins;
 *  - state lives in `systemStatus/cyberlab`; emails fire on transitions only,
 *    with at-least-once semantics and a 30-min flap guard;
 *  - on recovery: waitlisted patients are emailed FIRST (the promise), their
 *    addresses deleted, one `outages/{id}` history doc is written (evidence
 *    for the lab's server provider), then the staff recovery email goes out.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { callCyberlab, CyberlabConfig, CyberlabError } from "../cyberlab/client";
import {
  classifyProbe,
  defaultState,
  evaluate,
  HealthAction,
  HealthState,
  ProbeOutcome,
} from "./stateMachine";
import {
  alertRecipients,
  APP_URL,
  fmtCasablanca,
  fmtDuration,
  isSmtpConfigured,
  renderAlertEmail,
  sendMail,
  SMTP_PASS,
  SMTP_USER,
} from "../email/mailer";

// Same Secret Manager entries as the callables (defineSecret is idempotent by name).
const CYBERLAB_API_KEY = defineSecret("CYBERLAB_API_KEY");
const CYBERLAB_HMAC_SECRET = defineSecret("CYBERLAB_HMAC_SECRET");
const CYBERLAB_API_URL = defineString("CYBERLAB_API_URL");
// The lab-editor-blessed test patient (also used by the test battery / mock).
const HEALTHCHECK_REQUESTER_ID = defineString("HEALTHCHECK_REQUESTER_ID", {
  default: "7587",
});

export const STATE_DOC = "systemStatus/cyberlab";
const WAITLIST_COLLECTION = "outageWaitlist";
const OUTAGES_COLLECTION = "outages";
const RECHECK_DELAY_MS = 20_000;
const WAITLIST_MAX_ATTEMPTS = 3;

/** State-doc fields stored as Firestore Timestamps (millis in the pure layer). */
const DATE_FIELDS = new Set([
  "since",
  "lastCheckAt",
  "lastOkAt",
  "downSince",
  "lastDownAlertAt",
  "lastReminderAt",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toMillis(v: unknown): number | null {
  const ts = v as admin.firestore.Timestamp | undefined;
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
}

/** Firestore doc → pure-layer state (dates as millis). */
function docToState(data: FirebaseFirestore.DocumentData | undefined): HealthState {
  const d = data ?? {};
  const base = defaultState();
  return {
    up: typeof d.up === "boolean" ? d.up : base.up,
    reason: d.reason === "server" || d.reason === "config" ? d.reason : null,
    since: toMillis(d.since),
    lastCheckAt: toMillis(d.lastCheckAt),
    lastOkAt: toMillis(d.lastOkAt),
    lastError:
      d.lastError && typeof d.lastError.kind === "string"
        ? { kind: d.lastError.kind, status: d.lastError.status ?? null }
        : null,
    downSince: toMillis(d.downSince),
    downAlertPending: Boolean(d.downAlertPending),
    lastDownAlertAt: toMillis(d.lastDownAlertAt),
    lastReminderAt: toMillis(d.lastReminderAt),
    patientsImpacted: typeof d.patientsImpacted === "number" ? d.patientsImpacted : 0,
    waitlistPending: Boolean(d.waitlistPending),
  };
}

/** Pure-layer patch (millis) → Firestore merge patch (Timestamps). */
function patchToDoc(patch: Partial<HealthState>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (DATE_FIELDS.has(key) && typeof value === "number") {
      out[key] = admin.firestore.Timestamp.fromMillis(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** One probe attempt → outcome (null error = success). */
async function probeOnce(cfg: CyberlabConfig): Promise<ProbeOutcome> {
  try {
    await callCyberlab(cfg, {
      type: "patient",
      requester_id: HEALTHCHECK_REQUESTER_ID.value(),
      max_results: 1,
      include_pdf: "none",
    });
    return classifyProbe(null);
  } catch (err) {
    if (err instanceof CyberlabError) {
      return classifyProbe({ kind: err.kind, status: err.status });
    }
    return classifyProbe({ kind: "unexpected" });
  }
}

/** Human explanation of a probe error, for the staff emails (French). */
function errorLabel(error: { kind: string; status: number | null }): string {
  if (error.kind === "network") {
    return "Serveur injoignable — aucune réponse (délai dépassé ou connexion refusée)";
  }
  if (error.kind === "server") {
    if (error.status === 522) {
      return "Code 522 — Cloudflare n'obtient pas de réponse du serveur du laboratoire (probable coupure de courant ou serveur éteint)";
    }
    if (error.status === 523) {
      return "Code 523 — Cloudflare ne trouve plus le serveur du laboratoire (probable coupure de courant ou réseau)";
    }
    return `Erreur serveur (code ${error.status ?? "inconnu"})`;
  }
  if (error.kind === "unauthorized") {
    return "Clé API refusée (401) — problème de configuration, PAS une coupure de courant";
  }
  return "Erreur interne inattendue de la supervision";
}

// ── Staff emails ─────────────────────────────────────────────────────────────

function downAlertEmail(
  reason: "server" | "config",
  error: { kind: string; status: number | null },
  nowMs: number
): { subject: string; html: string } {
  if (reason === "config") {
    return {
      subject: "[Labo El Allali] ALERTE — Accès aux résultats refusé (configuration)",
      html: renderAlertEmail({
        title: "Accès aux résultats refusé (configuration)",
        lead:
          "Le serveur de résultats répond, mais il rejette la clé d'accès de l'application. " +
          "Les patients ne peuvent pas consulter leurs résultats.",
        rows: [
          ["Détecté le", `${fmtCasablanca(nowMs)} (heure du Maroc)`],
          ["Détail technique", errorLabel(error)],
        ],
        todo:
          "Ce n'est PAS une coupure de courant. Contacter le prestataire CyberLab / vérifier la " +
          "configuration des clés. Un email de rétablissement suivra automatiquement.",
        footer:
          "Supervision automatique (test toutes les 5 minutes). Email envoyé uniquement aux changements d'état.",
      }),
    };
  }
  return {
    subject: "[Labo El Allali] ALERTE — Serveur de résultats injoignable",
    html: renderAlertEmail({
      title: "Serveur de résultats injoignable",
      lead:
        "Le serveur de résultats du laboratoire ne répond plus. Les patients qui ouvrent " +
        "« Mes Résultats » voient actuellement « Panne temporaire ».",
      rows: [
        ["Détecté le", `${fmtCasablanca(nowMs)} (heure du Maroc)`],
        ["Détail technique", errorLabel(error)],
      ],
      todo:
        "À vérifier au laboratoire : le courant électrique, le serveur de résultats (allumé ?) " +
        "et la box internet. Vous recevrez automatiquement un email dès le rétablissement, " +
        "et un rappel toutes les 6 h si la panne persiste.",
      footer:
        "Supervision automatique (test toutes les 5 minutes, confirmé par un second test 20 s plus tard). " +
        "Email envoyé uniquement aux changements d'état — pas de spam.",
    }),
  };
}

function reminderEmail(downSinceMs: number, patientsImpacted: number, waitlistCount: number, nowMs: number): { subject: string; html: string } {
  const duration = fmtDuration(nowMs - downSinceMs);
  return {
    subject: `[Labo El Allali] RAPPEL — Serveur de résultats en panne depuis ${duration}`,
    html: renderAlertEmail({
      title: "Panne toujours en cours",
      lead: "Le serveur de résultats est toujours injoignable.",
      rows: [
        ["Panne depuis", `${fmtCasablanca(downSinceMs)} (${duration})`],
        ["Tentatives de patients bloquées", String(patientsImpacted)],
        ["Patients en attente d'être prévenus", String(waitlistCount)],
      ],
      todo: "Prochain rappel dans 6 h si la panne persiste. Email automatique au rétablissement.",
      footer: "Supervision automatique (test toutes les 5 minutes).",
    }),
  };
}

function recoveryEmail(outage: {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  patientsImpacted: number;
  waitlistNotified: number;
  waitlistFailed: number;
}): { subject: string; html: string } {
  const rows: Array<[string, string]> = [
    ["Début de la panne", `${fmtCasablanca(outage.startedAt)} (heure du Maroc)`],
    ["Rétablissement", fmtCasablanca(outage.endedAt)],
    ["Durée", fmtDuration(outage.durationMs)],
    ["Tentatives de patients pendant la panne", String(outage.patientsImpacted)],
    ["Patients prévenus par email", String(outage.waitlistNotified)],
  ];
  if (outage.waitlistFailed > 0) {
    rows.push(["Emails patients en échec", String(outage.waitlistFailed)]);
  }
  return {
    subject: `[Labo El Allali] Serveur de résultats rétabli — panne de ${fmtDuration(outage.durationMs)}`,
    html: renderAlertEmail({
      title: "Serveur de résultats rétabli",
      lead: "Le serveur de résultats répond de nouveau normalement. Les patients peuvent consulter leurs résultats.",
      rows,
      footer:
        "Cette panne est archivée (durée + impact) — utile comme historique chiffré pour le prestataire du serveur. " +
        "Supervision automatique du site.",
    }),
  };
}

// ── Patient waitlist ─────────────────────────────────────────────────────────

function patientRecoveryEmail(lang: "fr" | "ar"): { subject: string; html: string } {
  const url = `${APP_URL.value()}/${lang}/resultats`;
  if (lang === "ar") {
    return {
      subject: "مختبر العلالي — نتائجكم متاحة من جديد",
      html: renderAlertEmail({
        rtl: true,
        title: "نتائجكم متاحة من جديد",
        lead:
          "عاد خادم النتائج للعمل بشكل طبيعي. يمكنكم الآن الاطلاع على نتائج تحاليلكم في التطبيق.",
        rows: [["الرابط", url]],
        todo: "كما وعدناكم: تم حذف عنوان بريدكم الإلكتروني من قائمة الانتظار بعد إرسال هذا الإشعار.",
        footer: "مختبر العلالي للتحاليل الطبية — رسالة آلية، لا حاجة للرد عليها.",
      }),
    };
  }
  return {
    subject: "Laboratoire El Allali — Vos résultats sont de nouveau accessibles",
    html: renderAlertEmail({
      title: "Vos résultats sont de nouveau accessibles",
      lead:
        "Le serveur de résultats du laboratoire est rétabli. Vous pouvez de nouveau consulter " +
        "vos résultats d'analyses dans l'application.",
      rows: [["Lien", url]],
      todo:
        "Comme promis : votre adresse email a été supprimée de la liste d'attente juste après " +
        "l'envoi de ce message.",
      footer: "Laboratoire El Allali — message automatique, il n'est pas nécessaire d'y répondre.",
    }),
  };
}

/** How many waitlist pages to drain in one run (safety cap on a runaway loop). */
const WAITLIST_PAGE_SIZE = 200;
const WAITLIST_MAX_PAGES = 50; // 10k patients — far beyond any real waitlist

/**
 * Email every waitlisted patient that the server is back, then delete their
 * entry (that deletion IS the retention policy). A failed send is retried on
 * the next check (entry kept, attempts+1) up to WAITLIST_MAX_ATTEMPTS.
 * Returns counts for the staff recovery email / outage history.
 *
 * Never destroys an entry without a REAL delivery: in simulated SMTP mode the
 * drain is skipped and `waitlistPending` is left true, so entries survive until
 * the Gmail secret is configured and a later run can actually notify them.
 */
async function drainWaitlist(): Promise<{ notified: number; failed: number; skipped: boolean }> {
  const db = admin.firestore();

  // M3 guard: a simulated send delivers nothing — deleting entries here would
  // silently drop patients who were promised an email. Keep them for later.
  if (!isSmtpConfigured()) {
    await db.doc(STATE_DOC).set({ waitlistPending: true }, { merge: true });
    logger.warn("healthCheck: waitlist drain skipped (SMTP simulated mode)");
    return { notified: 0, failed: 0, skipped: true };
  }

  let notified = 0;
  let failed = 0;
  let kept = 0;

  // Paginate until the collection is drained (or the safety cap is hit).
  for (let page = 0; page < WAITLIST_MAX_PAGES; page++) {
    const snap = await db.collection(WAITLIST_COLLECTION).limit(WAITLIST_PAGE_SIZE).get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const data = doc.data();
      const email = typeof data.email === "string" ? data.email : "";
      const lang: "fr" | "ar" = data.lang === "ar" ? "ar" : "fr";
      if (!email.includes("@")) {
        // Not a real address — remove it (nothing to notify).
        try {
          await doc.ref.delete();
        } catch {
          /* leave it; harmless, retried next drain */
        }
        continue;
      }

      let sent = false;
      try {
        const mail = patientRecoveryEmail(lang);
        await sendMail({ to: [email], subject: mail.subject, html: mail.html });
        sent = true;
      } catch {
        // Send failed → bump attempts, keep for retry (or purge after N tries).
        const attempts = (typeof data.attempts === "number" ? data.attempts : 0) + 1;
        failed += 1;
        try {
          if (attempts >= WAITLIST_MAX_ATTEMPTS) {
            await doc.ref.delete();
          } else {
            await doc.ref.set({ attempts }, { merge: true });
            kept += 1;
          }
        } catch {
          kept += 1; // couldn't update → still there, drained next time
        }
      }

      if (sent) {
        // Delete OUTSIDE the send try/catch: a delete failure must NOT be
        // mistaken for a send failure (m3). A surviving already-notified entry
        // would just be re-emailed on the next drain — accept that over spamming
        // "send failed".
        try {
          await doc.ref.delete();
          notified += 1;
        } catch {
          notified += 1;
          kept += 1; // best-effort; a rare duplicate email beats a lost delete
        }
      }
    }

    // A short page means the collection is (near) empty; stop paging.
    if (snap.size < WAITLIST_PAGE_SIZE) break;
  }

  // Only downgrade the flag when nothing is left to retry (m1). A concurrent
  // opt-in either was drained above or set the flag true after our read; the
  // steady-up sweep will catch the latter.
  await db.doc(STATE_DOC).set({ waitlistPending: kept > 0 }, { merge: true });
  logger.info("healthCheck: waitlist drained", { notified, failed, kept });
  return { notified, failed, skipped: false };
}

// ── Scheduled entry point ────────────────────────────────────────────────────

export const checkCyberlabHealth = onSchedule(
  {
    schedule: "*/5 * * * *",
    timeZone: "Africa/Casablanca",
    region: "europe-west1", // Cloud Scheduler constraint — see header comment.
    memory: "256MiB",
    timeoutSeconds: 300, // probe (20 s max) + 20 s wait + re-probe + emails
    maxInstances: 1,
    secrets: [CYBERLAB_API_KEY, CYBERLAB_HMAC_SECRET, SMTP_USER, SMTP_PASS],
  },
  async () => {
    const cfg: CyberlabConfig = {
      apiUrl: CYBERLAB_API_URL.value(),
      apiKey: CYBERLAB_API_KEY.value(),
      hmacSecret: CYBERLAB_HMAC_SECRET.value(),
    };

    let outcome = await probeOnce(cfg);
    if (!outcome.up) {
      // Blip filter: confirm 20 s later before declaring the check down.
      await sleep(RECHECK_DELAY_MS);
      outcome = await probeOnce(cfg);
    }

    const db = admin.firestore();
    const ref = db.doc(STATE_DOC);
    const now = Date.now();

    // Read + evaluate + patch atomically (fetchResults increments
    // patientsImpacted concurrently via FieldValue.increment — compatible).
    let actions: HealthAction[] = [];
    let stateBefore: HealthState = defaultState();
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      stateBefore = docToState(snap.data());
      const ev = evaluate(stateBefore, outcome, now);
      actions = ev.actions;
      tx.set(ref, patchToDoc(ev.patch), { merge: true });
    });

    if (!outcome.up) {
      logger.warn("healthCheck: probe down", {
        reason: outcome.reason,
        kind: outcome.error.kind,
        status: outcome.error.status,
      });
    }

    for (const action of actions) {
      if (action.type === "alert_down") {
        try {
          const mail = downAlertEmail(action.reason, action.error, now);
          await sendMail({ to: alertRecipients(), subject: mail.subject, html: mail.html });
          await ref.set(
            patchToDoc({ downAlertPending: false, lastDownAlertAt: now }),
            { merge: true }
          );
        } catch (err) {
          // downAlertPending stays true → retried on the next check.
          logger.error("healthCheck: down alert send failed", {
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } else if (action.type === "reminder") {
        try {
          const waitlistCount = (await db.collection(WAITLIST_COLLECTION).count().get()).data().count;
          const mail = reminderEmail(action.downSince, action.patientsImpacted, waitlistCount, now);
          await sendMail({ to: alertRecipients(), subject: mail.subject, html: mail.html });
          await ref.set(patchToDoc({ lastReminderAt: now }), { merge: true });
        } catch (err) {
          logger.error("healthCheck: reminder send failed", {
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } else if (action.type === "recover") {
        // 1. Patients first — that's the promise made by the opt-in button.
        //    Guarded (M2): a drain failure must NOT abort the run, or the
        //    one-time history doc + staff recovery email below would be lost
        //    forever (the state is already committed up:true).
        let counts = { notified: 0, failed: 0, skipped: false };
        try {
          counts = await drainWaitlist();
        } catch (err) {
          logger.error("healthCheck: waitlist drain failed", {
            message: err instanceof Error ? err.message : String(err),
          });
        }
        // 2. One history doc per outage (evidence for the server provider).
        try {
          await db.collection(OUTAGES_COLLECTION).add({
            startedAt: admin.firestore.Timestamp.fromMillis(action.outage.startedAt),
            endedAt: admin.firestore.Timestamp.fromMillis(action.outage.endedAt),
            durationMs: action.outage.durationMs,
            reason: action.outage.reason,
            lastError: action.outage.lastError,
            patientsImpacted: action.outage.patientsImpacted,
            waitlistNotified: counts.notified,
            waitlistFailed: counts.failed,
          });
        } catch (err) {
          logger.error("healthCheck: outage history write failed", {
            message: err instanceof Error ? err.message : String(err),
          });
        }
        // 3. Staff summary.
        try {
          const mail = recoveryEmail({ ...action.outage, waitlistNotified: counts.notified, waitlistFailed: counts.failed });
          await sendMail({ to: alertRecipients(), subject: mail.subject, html: mail.html });
        } catch (err) {
          logger.error("healthCheck: recovery email send failed", {
            message: err instanceof Error ? err.message : String(err),
          });
        }
        logger.info("healthCheck: recovered", {
          durationMs: action.outage.durationMs,
          patientsImpacted: action.outage.patientsImpacted,
          waitlistNotified: counts.notified,
        });
      } else if (action.type === "sweep_waitlist") {
        await drainWaitlist();
      }
    }
  }
);
