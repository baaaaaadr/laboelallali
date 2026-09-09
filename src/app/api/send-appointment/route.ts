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

/**
 * Comme `esc()`, mais garde les retours a la ligne.
 *
 * Sans cela, un patient qui recopie son ordonnance ligne par ligne
 * ("NFS\nFerritine\nTSH") voyait tout s'aplatir en une seule phrase illisible
 * dans la boite du laboratoire — et une adresse sur trois lignes aussi.
 * L'echappement passe TOUJOURS en premier : les `<br>` sont ajoutes apres, sur
 * du texte deja neutralise.
 */
function escMultiline(v: unknown): string {
  return esc(v).replace(/\r?\n/g, '<br>');
}

/** Numero marocain -> identifiant wa.me (0612… -> 212612…). */
function waId(phone: unknown): string {
  const digits = String(phone ?? '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('212')) return digits;
  if (digits.startsWith('0')) return '212' + digits.slice(1);
  return digits;
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
      // Home-sampling fields. They were POSTed by /glabo since launch but never
      // read here, so every home-visit email reached the lab WITHOUT THE ADDRESS
      // — the staff had to call the patient back to ask where they live.
      adresse,
      lieuPrelevement,
      instructionsAcces,
      // ── Champs du PARCOURS UNIFIÉ (/test-rdv), tous OPTIONNELS ────────────
      // Les deux anciennes pages ne les envoient pas : chaque bloc ci-dessous
      // rend une chaîne vide quand sa donnée manque, donc leurs e-mails restent
      // identiques au bit près tant qu'elles existent.
      //
      // ⚠ Ces valeurs arrivent en CLÉ BRUTE et sont traduites ICI. Le client ne
      // doit jamais envoyer la sortie de `t()` : un patient arabophone mettrait
      // des libellés arabes dans la boîte française du laboratoire — c'est
      // exactement l'incident déjà survenu sur `lieuPrelevement`.
      source,
      hasPrescription,
      transmissionModes,
      analyses,
      cartTotals,
      preparation,
      wantToKnow,
      replyChannel,
      needsHumanAnswer,
      sentViaWhatsApp,
      locale,
      wantsAppointment,
    } = data;

    // `false` = le patient a envoyé sa demande sans réserver de créneau
    // (bulle "Recevoir ma réponse d'abord", 11/09/2026) : `date_souhaitee`/
    // `heure_souhaitee` sont alors des chaînes vides. `undefined` pour les
    // deux anciennes pages, qui n'envoient pas ce champ — comportement
    // strictement inchangé pour elles.
    const isJourney = source === 'journey';
    const noSlotRequested = isJourney && wantsAppointment === false;

    // `lieuPrelevement` used to be sent already translated INTO THE PATIENT'S
    // LANGUAGE, so an Arabic-speaking patient put المنزل in a French email. The client
    // now sends the raw key; we still accept the old translated strings so a
    // browser holding a cached bundle mid-deploy does not lose the information.
    const LIEU_LABELS: Record<string, string> = {
      domicile: 'Domicile du patient',
      travail: 'Lieu de travail',
    };
    const lieuLabel = LIEU_LABELS[String(lieuPrelevement ?? '').toLowerCase()]
      || String(lieuPrelevement ?? '').trim()
      || 'Non précisé';

    // La langue du patient etait envoyee par le client et JETEE par la route.
    // Le personnel ne pouvait pas savoir qu'il fallait rappeler en arabe.
    const langueHtml =
      isJourney && locale
        ? `<p><strong>Langue du patient :</strong> ${esc(String(locale) === 'ar' ? 'Arabe' : 'Français')}</p>`
        : '';

    // ── Libellés français des clés brutes envoyées par le parcours ──────────
    const WANT_LABELS: Record<string, string> = {
      prix: 'Le prix total',
      delai: 'Le délai des résultats',
      jeune: "S'il faut être à jeun",
      explication: 'Une explication de ses analyses',
    };
    const CHANNEL_LABELS: Record<string, string> = {
      whatsapp: 'WhatsApp',
      email: 'E-mail',
      call: 'Appel téléphonique',
      sms: 'SMS',
    };
    const PRESCRIPTION_LABELS: Record<string, string> = { yes: 'Oui', no: 'Non' };
    const TRANSMISSION_LABELS: Record<string, string> = {
      upload: 'Ordonnance photographiée / PDF',
      freetext: 'Demande écrite en texte libre',
      catalog: 'Sélection dans le catalogue',
    };

    /** Nombre sûr : `Number()` AVANT `esc()`, pour qu'une valeur non numérique ne devienne jamais du balisage. */
    const num = (v: unknown): string => {
      const n = Number(v);
      return Number.isFinite(n) ? String(n) : '0';
    };

    // 1) Tableau des analyses + totaux. Plafonné à 60 lignes : au-delà, on
    //    annonce le reste plutôt que d'envoyer un e-mail illisible.
    let analysesHtml = '';
    if (Array.isArray(analyses) && analyses.length > 0) {
      const MAX_ROWS = 60;
      const shown = analyses.slice(0, MAX_ROWS);
      const rest = analyses.length - shown.length;
      const rows = shown
        .map(
          (a: { name?: string; price?: number }) => `
            <tr>
              <td style="padding: 6px 0; border-bottom: 1px solid #eee;">${esc(a?.name)}</td>
              <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: right; white-space: nowrap;">${num(a?.price)} DH</td>
            </tr>`
        )
        .join('');
      const totals = cartTotals
        ? `
            <tr><td style="padding: 6px 0;">Sous-total analyses</td><td style="padding: 6px 0; text-align: right;">${num(cartTotals.itemsTotal)} DH</td></tr>
            <tr><td style="padding: 6px 0;">Frais de prélèvement${isHomeService ? ' <span style="color:#777; font-weight:normal;">(déplacement inclus)</span>' : ''}</td><td style="padding: 6px 0; text-align: right;">${num(cartTotals.samplingFee)} DH</td></tr>
            <tr style="font-weight: bold; color: #800020;"><td style="padding: 8px 0; border-top: 2px solid #800020;">TOTAL ESTIMÉ</td><td style="padding: 8px 0; border-top: 2px solid #800020; text-align: right;">${num(cartTotals.total)} DH</td></tr>`
        : '';
      analysesHtml = `
          <h3 style="color: #FF4081; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 25px;">Analyses demandées (${num(analyses.length)})</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            ${rows}
            ${rest > 0 ? `<tr><td colspan="2" style="padding: 6px 0; font-style: italic; color: #777;">… et ${num(rest)} autre(s) analyse(s)</td></tr>` : ''}
            ${totals}
          </table>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #777;">Estimation — tarif à confirmer au laboratoire.</p>`;
    }

    // 2) Consignes de préparation, calculées côté client à partir du catalogue.
    let preparationHtml = '';
    if (preparation) {
      const jeune = Number(preparation.maxJeune) > 0
        ? `À jeun : ${num(preparation.maxJeune)} h`
        : 'Aucun jeûne obligatoire';
      const delai = Number(preparation.maxDRR) > 0
        ? `Résultats sous ${num(preparation.maxDRR)} jour(s)`
        : 'Résultats le jour même';
      const types = Array.isArray(preparation.sampleTypes) && preparation.sampleTypes.length
        ? `<p style="margin: 0 0 4px 0;"><strong>Type(s) de prélèvement :</strong> ${preparation.sampleTypes.map(esc).join(', ')}</p>`
        : '';
      // DEUX publics, donc DEUX blocs :
      //  - `patientPreparation` (`Pre_Analytique_FR`) : ce que le patient a lu a
      //    l'ecran, rappele ici pour que le personnel dise la meme chose ;
      //  - `technicalInstructions` (`CPA_Instructions`) : la fiche technique du
      //    preleveur (tubes, centrifugation, congelation, acheminement). Elle n'a
      //    AUCUNE traduction arabe dans la base -- preuve qu'elle n'a jamais ete
      //    ecrite pour un patient. Utile ICI, et nulle part ailleurs.
      //  `specialInstructions` reste accepte : ancien nom du second champ.
      const patientNotes = Array.isArray(preparation.patientPreparation) && preparation.patientPreparation.length
        ? `<p style="margin: 0;"><strong>Consignes données au patient :</strong> ${preparation.patientPreparation.map(esc).join(' · ')}</p>`
        : '';
      const technical = preparation.technicalInstructions ?? preparation.specialInstructions;
      const techniqueHtml = Array.isArray(technical) && technical.length
        ? `<p style="margin: 8px 0 0 0; padding-top: 8px; border-top: 1px dashed #ccc; color: #555;"><strong>Consignes techniques (préleveur) :</strong> ${technical.map(esc).join(' · ')}</p>`
        : '';
      preparationHtml = `
          <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #FF4081; margin-top: 20px;">
            <p style="margin: 0 0 8px 0; font-weight: bold;">Préparation${
              needsHumanAnswer
                ? ' <span style="font-weight: normal; color: #777;">— calculée sur les seules analyses du catalogue</span>'
                : ''
            }</p>
            <p style="margin: 0 0 4px 0;">${esc(jeune)}</p>
            <p style="margin: 0 0 4px 0;">${esc(delai)}</p>
            ${types}
            ${patientNotes}
            ${techniqueHtml}
          </div>`;
    }

    // 3) Ce que le patient veut savoir.
    let wantHtml = '';
    if (Array.isArray(wantToKnow) && wantToKnow.length > 0) {
      wantHtml = `
          <div style="margin-top: 20px;">
            <p style="margin: 0 0 6px 0;"><strong>Le patient souhaite connaître :</strong></p>
            <ul style="margin: 0; padding-left: 20px;">
              ${wantToKnow.map((k: string) => `<li>${esc(WANT_LABELS[String(k)] ?? k)}</li>`).join('')}
            </ul>
          </div>`;
    }

    // 4) Canal de réponse + avertissement "réponse humaine attendue".
    // L'alerte DEPEND de ce que le patient a fourni. Une premiere version
    // affirmait toujours "le prix et le delai n'ont pas pu etre calcules
    // automatiquement" -- juste sous un TOTAL ESTIME de 148 DH et un delai de
    // 2 jours, quand le patient avait a la fois ecrit un texte ET choisi dans le
    // catalogue. Contradiction pure sous les yeux du personnel.
    const hasQuote = Boolean(cartTotals);
    let replyHtml = '';
    if (replyChannel || needsHumanAnswer) {
      const channel = replyChannel
        ? `<p style="margin: 0 0 6px 0;"><strong>Répondre au patient par :</strong> ${esc(CHANNEL_LABELS[String(replyChannel)] ?? replyChannel)}</p>`
        : '';
      const human = needsHumanAnswer
        ? hasQuote
          ? `<p style="margin: 0; color: #B00020;"><strong>⚠ Le devis ci-dessus ne couvre QUE les analyses choisies dans le catalogue.</strong> Le patient a aussi joint une ordonnance ou écrit sa demande : ces analyses-là restent à chiffrer.</p>`
          : `<p style="margin: 0; color: #B00020;"><strong>⚠ Rien n'a pu être chiffré automatiquement</strong> (ordonnance photographiée ou demande écrite) : le prix et le délai sont à communiquer par vos soins.</p>`
        : '';
      replyHtml = `
          <div style="background-color: #FFF3F6; border-radius: 6px; padding: 15px; margin-top: 20px;">
            ${channel}${human}
          </div>`;
    }

    // Comment la demande est ARRIVEE -- a ne pas confondre avec le canal de
    // reponse souhaite. Les deux se suivaient et se lisaient comme une
    // contradiction ("Appel telephonique" puis "a choisi WhatsApp"). Ce bloc
    // remonte donc en haut, avec les metadonnees d'arrivee.
    const arrivalHtml = sentViaWhatsApp
      ? `<p style="margin: 6px 0 0 0; color: #1F7A3D;"><strong>Reçu aussi sur WhatsApp</strong> — le patient a utilisé le bouton WhatsApp ; cet e-mail reprend l'intégralité de sa demande, vous n'avez rien à lui redemander.</p>`
      : '';

    // 5) Provenance de la demande (ordonnance oui/non + modes de transmission).
    let originHtml = '';
    if (hasPrescription || (Array.isArray(transmissionModes) && transmissionModes.length > 0)) {
      const ordo = hasPrescription
        ? `<p style="margin: 0 0 4px 0;"><strong>Ordonnance :</strong> ${esc(PRESCRIPTION_LABELS[String(hasPrescription)] ?? hasPrescription)}</p>`
        : '';
      const modes = Array.isArray(transmissionModes) && transmissionModes.length
        ? `<p style="margin: 0;"><strong>Mode(s) de transmission :</strong> ${transmissionModes.map((m: string) => esc(TRANSMISSION_LABELS[String(m)] ?? m)).join(' · ')}</p>`
        : '';
      originHtml = `
          <div style="margin-top: 20px;">
            ${ordo}${modes}
          </div>`;
    }

    // Prescription links (URLs escaped for both href and visible text).
    let ordonnancesHtml = '';
    if (Array.isArray(ordonnanceUrls) && ordonnanceUrls.length > 0) {
      ordonnancesHtml = `
        <div style="margin-top: 25px; text-align: center;">
          <h4 style="color: #FF4081; margin-bottom: 5px;">Ordonnance(s) jointe(s)</h4>
          <p style="margin: 0 0 12px 0; font-size: 12px; color: #777;">Ces liens expirent 30 jours après la demande — téléchargez le document si vous devez le conserver.</p>
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
          <h2 style="margin: 0;">${
            isJourney
              // "Nouvelle Demande de Prelevement a Domicile" s'affichait meme
              // pour un prelevement sur le LIEU DE TRAVAIL, alors que l'objet de
              // l'e-mail, lui, disait bien "LIEU DE TRAVAIL".
              ? (isHomeService ? `Nouvelle demande — ${lieuLabel}` : 'Nouvelle demande — Rendez-vous au laboratoire')
              : (isHomeService ? 'Nouvelle Demande de Prélèvement à Domicile' : 'Nouvelle Demande de Rendez-vous')
          }</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Laboratoire El Allali</p>
        </div>

        <div style="padding: 20px;">
          <h3 style="color: #FF4081; border-bottom: 1px solid #eee; padding-bottom: 10px;">Informations Patient</h3>
          <p><strong>Nom :</strong> ${esc(`${nom} ${prenom}`.replace(/\s+/g, ' ').trim())}</p>
          <p><strong>Téléphone :</strong> <a href="tel:${esc(String(telephone ?? '').replace(/[^0-9+]/g, ''))}" style="color: #800020;">${esc(telephone)}</a>${
            waId(telephone)
              ? ` &nbsp;·&nbsp; <a href="https://wa.me/${esc(waId(telephone))}" style="color: #1F7A3D;">WhatsApp</a>`
              : ''
          }</p>
          ${email ? `<p><strong>Email :</strong> <a href="mailto:${esc(email)}" style="color: #800020;">${esc(email)}</a></p>` : ''}
          ${langueHtml}

          <h3 style="color: #FF4081; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 25px;">Détails du Rendez-vous</h3>
          ${
            noSlotRequested
              ? `<p><strong>Créneau :</strong> Aucun pour l'instant — le patient souhaite d'abord votre réponse (prix / conditions préanalytiques / délai) avant de réserver.</p>`
              : `<p><strong>Date souhaitée :</strong> ${esc(date_souhaitee)}</p>
          <p><strong>Heure souhaitée :</strong> ${esc(heure_souhaitee)}</p>`
          }
          ${
            isJourney
              // Le parcours donne deja le lieu exact dans son propre encadre :
              // repeter "Type d'analyse", "Service a domicile" puis "Type de
              // lieu" disait trois fois la meme chose, dont une fois a tort
              // ("Service a domicile : Oui" pour un prelevement au TRAVAIL).
              ? ''
              : `<p><strong>Type d'analyse :</strong> ${esc(type_analyse)}</p>
          <p><strong>Service à domicile :</strong> ${isHomeService ? 'Oui' : 'Non'}</p>`
          }
          ${arrivalHtml}

          ${
            isHomeService
              ? `
            <div style="background-color: #FFF3F6; border: 2px solid #800020; border-radius: 6px; padding: 15px; margin-top: 20px;">
              <p style="margin: 0 0 10px 0; color: #800020; font-weight: bold; font-size: 15px;">Lieu de prélèvement</p>
              <p style="margin: 0 0 6px 0;"><strong>Type de lieu :</strong> ${esc(lieuLabel)}</p>
              ${
                adresse && String(adresse).trim()
                  ? `<p style="margin: 0 0 6px 0;"><strong>Adresse :</strong> ${escMultiline(adresse)}</p>`
                  : noSlotRequested
                    // Pas d'alerte rouge ici : une adresse manquante est NORMALE
                    // tant que le patient n'a pas réservé — l'alarmer comme une
                    // erreur ferait rappeler un patient qui n'a rien oublié.
                    ? `<p style="margin: 0 0 6px 0; color: #777;">Adresse non demandée pour l'instant — le patient n'a pas encore réservé de créneau.</p>`
                    : `<p style="margin: 0 0 6px 0; color: #B00020;"><strong>Adresse non renseignée — rappeler le patient.</strong></p>`
              }
              ${
                instructionsAcces && String(instructionsAcces).trim()
                  ? `<p style="margin: 0;"><strong>Indications d'accès :</strong> ${escMultiline(instructionsAcces)}</p>`
                  : ''
              }
            </div>
          `
              : ''
          }

          ${
            commentaires
              ? `
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #800020; margin-top: 15px;">
              <p style="margin: 0;"><strong>${isJourney ? 'Demande écrite par le patient' : 'Commentaires'} :</strong></p>
              <p style="margin: 5px 0 0 0;">${escMultiline(commentaires)}</p>
            </div>
          `
              : ''
          }

          ${originHtml}
          ${analysesHtml}
          ${preparationHtml}
          ${wantHtml}
          ${replyHtml}

          ${ordonnancesHtml}
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          Ceci est un email automatique généré par le site web du Laboratoire El Allali.
        </div>
      </div>
    `;

    const labMail = process.env.SMTP_USER || 'laboelallali@gmail.com';
    const replyTo = email && String(email).includes('@') ? String(email) : labMail;
    // The lab triages from the inbox list: the location has to be in the subject.
    // ⚠ Les deux préfixes existants sont CONSERVÉS tels quels — des filtres de
    // boîte mail s'appuient dessus. Le montant est seulement AJOUTÉ à la fin.
    const devisSuffix = cartTotals ? ` — DEVIS ${num(cartTotals.total)} DH` : '';
    // Le libellé de lieu n'est précisé QUE pour le parcours unifié. Les deux
    // anciennes pages gardent « DOMICILE » même pour un prélèvement sur le lieu
    // de travail : c'est inexact, mais leurs e-mails doivent rester à
    // l'identique jusqu'à leur retrait. Le parcours, lui, écrit
    // « LIEU DE TRAVAIL » et le personnel trie juste depuis sa boîte.
    const lieuTag =
      source === 'journey' && isHomeService ? lieuLabel.toUpperCase() : 'DOMICILE';
    // `prenom` est vide pour le parcours (on ne devine plus le decoupage du nom) :
    // sans ce `trim` l'objet contiendrait un double espace avant le tiret.
    const patientLabel = `${nom} ${prenom}`.replace(/\s+/g, ' ').trim();
    // Sans créneau demandé, `date_souhaitee` est une chaîne vide : l'objet
    // porterait un tiret suivi de rien. `dateTag` dit clairement de quoi il
    // s'agit plutôt que de laisser un blanc dans la liste des e-mails.
    const dateTag = noSlotRequested ? 'réponse seulement' : date_souhaitee;
    const subject = isHomeService
      ? `Nouveau RDV WEB — ${lieuTag} : ${patientLabel} - ${dateTag}${devisSuffix}`
      : `Nouveau Rendez-vous WEB : ${patientLabel} - ${dateTag}${devisSuffix}`;

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
