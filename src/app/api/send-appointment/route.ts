import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { buildAppointmentEmail } from '@/lib/email/appointmentEmail';

/**
 * Appointment / home-service (glabo) notification email.
 *
 * Sending is CENTRALIZED: the primary path POSTs to the shared `sendEmail` Cloud
 * Function (credentials in Secret Manager — the single source of truth, also used
 * by the server-monitoring alerts). If that call fails or its config is missing,
 * we FALL BACK to sending directly via SMTP here, so a booking notification can
 * never be lost during/after the migration. See docs/integrations/server-monitoring.md.
 *
 * ⚠ Cette route ne CONSTRUIT plus l'e-mail : objet et HTML viennent de
 * `src/lib/email/appointmentEmail.ts`, une fonction pure. Le rendu vivait ici,
 * entre la lecture du corps de la requête et l'appel au transporteur, donc
 * impossible à exécuter sans serveur Next et sans envoyer un vrai e-mail — pour
 * le seul document que le personnel lise réellement. Il est désormais couvert
 * par `scripts/test-appointment-email.js`. Ne pas réintroduire de balisage ici.
 *
 * All patient-supplied values are HTML-escaped before interpolation (see the
 * `esc`/`escMultiline`/`num` helpers in that module).
 */

const LAB_CC = [
  'baaaaaadr@gmail.com',
  'azizelallali@gmail.com',
  'communication.labo.elallali@gmail.com',
];

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const labMail = process.env.SMTP_USER || 'laboelallali@gmail.com';
    const { subject, html: htmlContent, replyTo } = buildAppointmentEmail(data, labMail);

    // ── PRIMARY: the central sendEmail Cloud Function (Secret Manager creds) ──
    const fnUrl = process.env.SEND_EMAIL_FN_URL;
    const fnToken = process.env.INTERNAL_EMAIL_TOKEN;
    if (fnUrl && fnToken) {
      try {
        const r = await fetch(fnUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Token': fnToken },
          body: JSON.stringify({
            to: [labMail],
            cc: LAB_CC,
            replyTo,
            subject,
            html: htmlContent,
            fromName: 'Site Labo El Allali',
          }),
        });
        if (r.ok) {
          return NextResponse.json({ success: true, via: 'function' });
        }
        console.warn(`send-appointment: sendEmail function HTTP ${r.status} — falling back to SMTP`);
      } catch (e) {
        console.warn('send-appointment: sendEmail function call failed — falling back to SMTP', e);
      }
    }

    // ── FALLBACK: direct SMTP (kept so a booking notification is never lost) ──
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('send-appointment: no SMTP config and no function — simulating send.');
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return NextResponse.json({ success: true, simulated: true });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const info = await transporter.sendMail({
      from: `"Site Labo El Allali" <${process.env.SMTP_USER}>`,
      to: labMail,
      cc: LAB_CC.join(', '),
      replyTo,
      subject,
      html: htmlContent,
    });

    return NextResponse.json({ success: true, messageId: info.messageId, via: 'smtp-fallback' });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
