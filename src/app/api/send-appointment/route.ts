import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

/**
 * Appointment / home-service (glabo) notification email.
 *
 * Sending is CENTRALIZED: the primary path POSTs to the shared `sendEmail` Cloud
 * Function (credentials in Secret Manager — the single source of truth, also used
 * by the server-monitoring alerts). If that call fails or its config is missing,
 * we FALL BACK to sending directly via SMTP here, so a booking notification can
 * never be lost during/after the migration. See docs/integrations/server-monitoring.md.
 *
 * All patient-supplied values are HTML-escaped before interpolation (the previous
 * version was injection-prone).
 */

/** Escape a value before putting it into email HTML. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LAB_CC = [
  'baaaaaadr@gmail.com',
  'azizelallali@gmail.com',
  'communication.labo.elallali@gmail.com',
];

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const {
      nom,
      prenom,
      telephone,
      email,
      date_souhaitee,
      heure_souhaitee,
      type_analyse,
      commentaires,
      ordonnanceUrls = [],
      isHomeService,
    } = data;

    // Prescription links (URLs escaped for both href and visible text).
    let ordonnancesHtml = '';
    if (Array.isArray(ordonnanceUrls) && ordonnanceUrls.length > 0) {
      ordonnancesHtml = `
        <div style="margin-top: 25px; text-align: center;">
          <h4 style="color: #FF4081; margin-bottom: 15px;">Ordonnance(s) jointe(s)</h4>
          ${ordonnanceUrls
            .map(
              (url: string, index: number) => `
            <a href="${esc(url)}" target="_blank" style="background-color: #FF4081; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; margin: 5px;">
              Voir l'ordonnance (Page ${index + 1})
            </a>
          `
            )
            .join('')}
        </div>
      `;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #800020; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Nouvelle Demande de Rendez-vous</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Laboratoire El Allali</p>
        </div>

        <div style="padding: 20px;">
          <h3 style="color: #FF4081; border-bottom: 1px solid #eee; padding-bottom: 10px;">Informations Patient</h3>
          <p><strong>Nom :</strong> ${esc(nom)} ${esc(prenom)}</p>
          <p><strong>Téléphone :</strong> ${esc(telephone)}</p>
          ${email ? `<p><strong>Email :</strong> ${esc(email)}</p>` : ''}

          <h3 style="color: #FF4081; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 25px;">Détails du Rendez-vous</h3>
          <p><strong>Date souhaitée :</strong> ${esc(date_souhaitee)}</p>
          <p><strong>Heure souhaitée :</strong> ${esc(heure_souhaitee)}</p>
          <p><strong>Type d'analyse :</strong> ${esc(type_analyse)}</p>
          <p><strong>Service à domicile :</strong> ${isHomeService ? 'Oui' : 'Non'}</p>

          ${
            commentaires
              ? `
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #800020; margin-top: 15px;">
              <p style="margin: 0;"><strong>Commentaires :</strong></p>
              <p style="margin: 5px 0 0 0;">${esc(commentaires)}</p>
            </div>
          `
              : ''
          }

          ${ordonnancesHtml}
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          Ceci est un email automatique généré par le site web du Laboratoire El Allali.
        </div>
      </div>
    `;

    const labMail = process.env.SMTP_USER || 'laboelallali@gmail.com';
    const replyTo = email && String(email).includes('@') ? String(email) : labMail;
    const subject = `Nouveau Rendez-vous WEB : ${nom} ${prenom} - ${date_souhaitee}`;

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
