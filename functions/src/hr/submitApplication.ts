/**
 * `submitApplication` — the public « Emploi & Stage » form sends a job or
 * internship application here (devis line 27, 08/10/2026). NO account needed
 * (owner's decision: an account would cost candidates and mix them with the
 * patients in the access requests and the dashboard).
 *
 * Everything goes through the server — the browser writes nothing itself:
 *  1. bots: the invisible trap field and an inhuman filling speed get a normal
 *     « ok » and nothing is stored (a refusal would teach them to adapt);
 *  2. the form and the files are validated by `applicationRules` (files by
 *     their REAL format, read from their first bytes, 5 MB max each);
 *  3. rate limits per 24 h, in one transaction: per network address (hashed,
 *     never stored in clear), per phone number, and ONE acknowledgement e-mail
 *     per address — else the form could flood a third party's mailbox;
 *  4. the files go to Storage `candidatures/{id}/`, the application to
 *     `applications/{id}` — both server-only, erased after 6 months by
 *     `cleanupExpiredApplications`;
 *  5. the lab's alert and the candidate's acknowledgement, best-effort: a
 *     failed e-mail never loses an application.
 *
 * Privacy: logs carry the application id and type only — never a name, phone,
 * e-mail or file name.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { createHash, randomBytes } from "crypto";
import { REGION, RH_ROLE } from "../admin/roles";
import { APP_URL, SMTP_USER, SMTP_PASS, alertRecipients, fmtCasablanca, sendMail } from "../email/mailer";
import {
  APPLICATIONS,
  FILE_FORMATS,
  FILE_KINDS,
  FileFormat,
  FileKind,
  LIMITS,
  MAX_FILE_BYTES,
  MIN_FILL_MS,
  STORAGE_PREFIX,
  THROTTLE,
  applicationRef,
  expiryFrom,
  filesError,
  parseApplication,
  phoneKey,
  safeFileName,
  sniffFile,
  throttle,
} from "./applicationRules";
import { renderAck, renderStaffAlert } from "./applicationEmails";

interface FileInput {
  name?: unknown;
  data?: unknown; // base64
}
interface SubmitInput {
  lang?: unknown;
  hp?: unknown;
  elapsedMs?: unknown;
  form?: unknown;
  files?: { cv?: FileInput; letter?: FileInput };
}

interface Decoded {
  buf: Buffer;
  format: FileFormat;
  name: string;
}

/** base64 length of a MAX_FILE_BYTES file, with a little slack. */
const MAX_B64 = Math.ceil((MAX_FILE_BYTES * 4) / 3) + 8;

function decodeFile(input: FileInput): Decoded | "too_big" | "format" | "invalid" {
  if (typeof input?.data !== "string" || !input.data) return "invalid";
  const b64 = input.data.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (b64.length > MAX_B64) return "too_big";
  const buf = Buffer.from(b64, "base64");
  if (!buf.length) return "invalid";
  if (buf.length > MAX_FILE_BYTES) return "too_big";
  const format = sniffFile(new Uint8Array(buf.buffer, buf.byteOffset, buf.length));
  if (!format) return "format";
  return { buf, format, name: safeFileName(input.name, format) };
}

const hashKey = (v: string): string =>
  createHash("sha256").update(`laboelallali/candidatures|${v}`).digest("hex").slice(0, 40);

/** The caller's address as Cloud Run sees it — only ever stored hashed. */
function clientAddress(request: CallableRequest): string {
  const raw = request.rawRequest;
  const xff = raw?.headers?.["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff || "").split(",")[0].trim();
  return first || raw?.ip || "";
}

const withTimeout = (p: Promise<unknown>, ms: number): Promise<unknown> =>
  Promise.race([p, new Promise<void>((resolve) => setTimeout(resolve, ms))]);

export const submitApplication = onCall(
  {
    region: REGION,
    // Bound for the two e-mails: without them `.value()` is empty and the
    // mailer silently SIMULATES the send (the trap the « pour un proche »
    // notification fell into).
    secrets: [SMTP_USER, SMTP_PASS],
    memory: "512MiB",
    timeoutSeconds: 60,
  },
  async (request: CallableRequest<SubmitInput>) => {
    const d = (request.data || {}) as SubmitInput;
    const nowMs = Date.now();
    const lang: "fr" | "ar" = d.lang === "ar" ? "ar" : "fr";

    // 1. Bots — a normal-looking answer, nothing stored, nothing sent.
    const trapped = typeof d.hp === "string" && d.hp.trim() !== "";
    const tooFast = !(Number(d.elapsedMs) >= MIN_FILL_MS);
    if (trapped || tooFast) {
      logger.info("submitApplication: dropped", { reason: trapped ? "trap" : "speed" });
      return { ok: true, ref: applicationRef(randomBytes(6).toString("hex")) };
    }

    // 2. The form, then the files.
    const parsed = parseApplication(d.form, new Date(nowMs));
    if (!parsed.ok) {
      throw new HttpsError("invalid-argument", "Formulaire incomplet ou invalide.", { fields: parsed.errors });
    }
    const form = parsed.value;
    const files: Partial<Record<FileKind, Decoded>> = {};
    const fileErrors: Record<string, string> = {};
    for (const kind of FILE_KINDS) {
      const input = d.files?.[kind];
      if (!input) continue;
      const res = decodeFile(input);
      if (typeof res === "string") fileErrors[kind] = res;
      else files[kind] = res;
    }
    const missing = filesError(form.kind, { cv: !!files.cv, letter: !!files.letter });
    if (missing && !fileErrors[missing]) fileErrors[missing] = "required";
    if (Object.keys(fileErrors).length) {
      throw new HttpsError("invalid-argument", "Pièce jointe manquante ou refusée.", { fields: fileErrors });
    }

    // 3. Rate limits — one transaction, so two parallel sends cannot both pass.
    const db = admin.firestore();
    const address = clientAddress(request);
    const addressRef = address ? db.doc(`${THROTTLE}/a_${hashKey(address)}`) : null;
    const phoneRef = db.doc(`${THROTTLE}/p_${hashKey(phoneKey(form.phone))}`);
    const emailRef = form.email ? db.doc(`${THROTTLE}/e_${hashKey(form.email)}`) : null;
    let sendAck = false;
    await db.runTransaction(async (tx) => {
      const [aSnap, pSnap, eSnap] = await Promise.all([
        addressRef ? tx.get(addressRef) : Promise.resolve(null),
        tx.get(phoneRef),
        emailRef ? tx.get(emailRef) : Promise.resolve(null),
      ]);
      const a = throttle(aSnap?.data()?.hits, nowMs, LIMITS.windowMs, LIMITS.perAddress);
      const p = throttle(pSnap.data()?.hits, nowMs, LIMITS.windowMs, LIMITS.perPhone);
      if (!a.allowed || !p.allowed) {
        throw new HttpsError(
          "resource-exhausted",
          "Vous avez déjà envoyé une candidature récemment. Pour la corriger, appelez le laboratoire."
        );
      }
      const stamp = admin.firestore.Timestamp.fromMillis(nowMs);
      if (addressRef) tx.set(addressRef, { hits: [...a.kept, nowMs], updatedAt: stamp });
      tx.set(phoneRef, { hits: [...p.kept, nowMs], updatedAt: stamp });
      if (emailRef) {
        const e = throttle(eSnap?.data()?.hits, nowMs, LIMITS.windowMs, LIMITS.ackPerEmail);
        sendAck = e.allowed;
        if (e.allowed) tx.set(emailRef, { hits: [...e.kept, nowMs], updatedAt: stamp });
      }
    });

    // 4. Files first, then the application — a failed write removes the files.
    const docRef = db.collection(APPLICATIONS).doc();
    const ref = applicationRef(docRef.id);
    const bucket = admin.storage().bucket();
    const stored: Record<string, { path: string; name: string; contentType: string; size: number }> = {};
    try {
      for (const kind of FILE_KINDS) {
        const f = files[kind];
        if (!f) continue;
        const { mime, ext } = FILE_FORMATS[f.format];
        const path = `${STORAGE_PREFIX}/${docRef.id}/${kind}.${ext}`;
        await bucket.file(path).save(f.buf, {
          resumable: false,
          contentType: mime,
          metadata: { cacheControl: "private, max-age=0" },
        });
        stored[kind] = { path, name: f.name, contentType: mime, size: f.buf.length };
      }
      await docRef.set({
        ...form,
        lang,
        files: stored,
        ref,
        status: "a_etudier",
        note: "",
        uid: request.auth?.uid || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(expiryFrom(nowMs)),
      });
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error("submitApplication: store failed", { id: docRef.id });
      try {
        await bucket.deleteFiles({ prefix: `${STORAGE_PREFIX}/${docRef.id}/` });
      } catch {
        /* the daily cleanup only sees documents — nothing more to do here */
      }
      throw new HttpsError("internal", "Votre candidature n'a pas pu être enregistrée. Réessayez dans un instant.");
    }
    logger.info("submitApplication: stored", { id: docRef.id, kind: form.kind });

    // 5. E-mails — best-effort, bounded: the candidate already has his answer's data.
    const when = fmtCasablanca(nowMs);
    const sends: Promise<unknown>[] = [];
    try {
      const alert = renderStaffAlert(form, {
        ref,
        nowMs,
        when,
        adminUrl: `${APP_URL.value()}/fr/admin?tab=candidatures`,
        files: { cv: !!stored.cv, letter: !!stored.letter },
      });
      // The « RH » accounts are the people who process the applications: they
      // get the alert too (12/10/2026), on top of the usual lab list.
      let to = alertRecipients();
      try {
        const rh = await db.collection("users").where("role", "==", RH_ROLE).limit(20).get();
        const extra = rh.docs
          .map((d) => String(d.data().email || "").trim().toLowerCase())
          .filter((e) => e.includes("@"));
        to = [...new Set([...to.map((e) => e.toLowerCase()), ...extra])];
      } catch {
        logger.warn("submitApplication: RH recipients unavailable", { id: docRef.id });
      }
      sends.push(
        sendMail({
          to,
          subject: alert.subject,
          html: alert.html,
          replyTo: form.email || undefined,
          fromName: "Labo El Allali — Candidatures",
        }).catch(() => logger.error("submitApplication: staff alert failed", { id: docRef.id }))
      );
      if (form.email && sendAck) {
        const ack = renderAck(form, lang, { ref, when });
        sends.push(
          sendMail({
            to: [form.email],
            subject: ack.subject,
            html: ack.html,
            fromName: lang === "ar" ? "مختبر العلالي" : "Laboratoire El Allali",
          }).catch(() => logger.error("submitApplication: acknowledgement failed", { id: docRef.id }))
        );
      }
      await withTimeout(Promise.all(sends), 12_000);
    } catch {
      logger.error("submitApplication: e-mails not prepared", { id: docRef.id });
    }

    return { ok: true, ref };
  }
);
