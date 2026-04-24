import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

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
      isHomeService
    } = data;

    // Create a transporter using SMTP
    // For Gmail, use service: 'gmail' and provide user/pass in .env.local
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Generate HTML for multiple prescription URLs
    let ordonnancesHtml = '';
    if (ordonnanceUrls && ordonnanceUrls.length > 0) {
      ordonnancesHtml = `
        <div style="margin-top: 25px; text-align: center;">
          <h4 style="color: #FF4081; margin-bottom: 15px;">Ordonnance(s) jointe(s)</h4>
          ${ordonnanceUrls.map((url: string, index: number) => `
            <a href="${url}" target="_blank" style="background-color: #FF4081; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; margin: 5px;">
              Voir l'ordonnance (Page ${index + 1})
            </a>
          `).join('')}
        </div>
      `;
    }

    // Formatting the email content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #800020; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Nouvelle Demande de Rendez-vous</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Laboratoire El Allali</p>
        </div>
        
        <div style="padding: 20px;">
          <h3 style="color: #FF4081; border-bottom: 1px solid #eee; padding-bottom: 10px;">Informations Patient</h3>
          <p><strong>Nom :</strong> ${nom} ${prenom}</p>
          <p><strong>Téléphone :</strong> ${telephone}</p>
          ${email ? `<p><strong>Email :</strong> ${email}</p>` : ''}
          
          <h3 style="color: #FF4081; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 25px;">Détails du Rendez-vous</h3>
          <p><strong>Date souhaitée :</strong> ${date_souhaitee}</p>
          <p><strong>Heure souhaitée :</strong> ${heure_souhaitee}</p>
          <p><strong>Type d'analyse :</strong> ${type_analyse}</p>
          <p><strong>Service à domicile :</strong> ${isHomeService ? 'Oui' : 'Non'}</p>
          
          ${commentaires ? `
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #800020; margin-top: 15px;">
              <p style="margin: 0;"><strong>Commentaires :</strong></p>
              <p style="margin: 5px 0 0 0;">${commentaires}</p>
            </div>
          ` : ''}

          ${ordonnancesHtml}
        </div>
        
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          Ceci est un email automatique généré par le site web du Laboratoire El Allali.
        </div>
      </div>
    `;

    // Send the email
    // Configuration de l'envoi de l'email
    const mailOptions = {
      from: `"Site Labo El Allali" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // Le destinataire principal (laboelallali@gmail.com)
      cc: 'baaaaaadr@gmail.com, azizelallali@gmail.com', // Les adresses en copie
      replyTo: email || process.env.SMTP_USER, // Permet de répondre directement au patient
      subject: `Nouveau Rendez-vous WEB : ${nom} ${prenom} - ${date_souhaitee}`,
      html: htmlContent,
    };

    // If SMTP credentials aren't set up yet, we'll log it and return success for testing UI
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("⚠️ SMTP credentials not found. Simulating email send for testing.");
      console.log("Email content:", mailOptions);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      return NextResponse.json({ success: true, simulated: true });
    }

    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
