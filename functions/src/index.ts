/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import next from "next";

// For SendGrid email functionality
import * as sgMail from "@sendgrid/mail";
import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Define environment parameters for SendGrid
const sendgridApiKey = defineString("sendgrid.key");
const sendgridSenderEmail = defineString("sendgrid.sender");
const labEmailAddress = defineString("lab.email");

const isDev = process.env.NODE_ENV !== "production";

// Prepare the Next.js server instance
const nextApp = next({
  dev: isDev,
  dir: "." // Next.js looks for .next, package.json, public in the current dir (/workspace)
});

const nextRequestHandler = nextApp.getRequestHandler();

// Define the Cloud Function
export const nextServer = onRequest(
  {
    // Set region and memory for Next.js applications
    // Adjust these based on your needs and Firebase plan
    region: "europe-southwest1", // Example: Change to your preferred region (e.g., europe-west1)
    memory: "1GiB",      // Example: Adjust memory (e.g., 512MiB, 2GiB)
  },
  (req, res) => {
    logger.info(`Received request for path: ${req.path}`, { structuredData: true });
    // Ensure the Next.js server is prepared before handling requests
    return nextApp.prepare()
      .then(() => {
        logger.info("Next.js server prepared, handling request.", { structuredData: true });
        return nextRequestHandler(req, res);
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((err: any) => { // Add :any to err to access properties like message/stack more easily
        logger.error("Next.js PREPARE/HANDLER FAILED.", {
          errorMessage: err.message, // Log the error message
          errorStack: err.stack,     // Log the stack trace
          errorObject: JSON.stringify(err, Object.getOwnPropertyNames(err)), // Try to stringify the whole error
          structuredData: true
        });
        res.status(500).send("Internal Server Error handling Next.js request.");
      });
  }
);

/**
 * Cloud Function triggered when a new appointment request is created in Firestore
 * Sends an email notification with the appointment details to the laboratory
 */
export const sendAppointmentRequestEmail = onDocumentCreated(
  {
    document: "appointmentRequests/{docId}",
    region: "europe-southwest1",
    memory: "512MiB",
  },
  async (event) => {
    // Exit if no data exists
    if (!event.data) {
      logger.error("No document data found");
      return;
    }

    try {
      // Extract appointment data
      const appointmentData = event.data.data();
      const appointmentId = event.data.id;
      logger.info(`Processing new appointment request: ${appointmentId}`, { structuredData: true });

      // Set up SendGrid with the API key from environment variables
      sgMail.setApiKey(sendgridApiKey.value());

      let attachments = [];
      let prescriptionNote = "Le patient n'a pas d'ordonnance.";

      // Handle prescription file if it exists
      if (appointmentData.prescriptionImageUrl) {
        try {
          const storage = getStorage();
          const fileUrl = appointmentData.prescriptionImageUrl;
          const bucket = storage.bucket();
          
          // Extract filename from the URL
          const urlParts = fileUrl.split('/');
          const fileName = urlParts[urlParts.length - 1].split('?')[0];
          
          // Create a reference to the file
          const fileRef = bucket.file(`ordonnances/${fileName}`);
          
          // Get file data
          const [fileContents] = await fileRef.download();
          
          // Prepare attachment for SendGrid
          const attachment = {
            content: fileContents.toString('base64'),
            filename: fileName,
            type: appointmentData.prescriptionImageUrl.includes('.pdf') ? 'application/pdf' : 'image/jpeg',
            disposition: 'attachment'
          };
          
          attachments.push(attachment);
          prescriptionNote = "L'ordonnance du patient est jointe à ce email.";
        } catch (error) {
          logger.error("Error downloading prescription file:", error);
          prescriptionNote = `Le patient a téléchargé une ordonnance, mais nous n'avons pas pu la télécharger. Vous pouvez l'accéder via ce lien: ${appointmentData.prescriptionImageUrl}`;
        }
      }

      // Format email body
      const emailHtml = `
        <h2>Nouvelle demande de rendez-vous</h2>
        <p><strong>Date de la demande:</strong> ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p>
        <p><strong>Nom du patient:</strong> ${appointmentData.name}</p>
        <p><strong>Numéro de téléphone:</strong> ${appointmentData.phone}</p>
        ${appointmentData.email ? `<p><strong>Email:</strong> ${appointmentData.email}</p>` : ''}
        <p><strong>Date souhaitée:</strong> ${appointmentData.desiredDate}</p>
        <p><strong>Heure souhaitée:</strong> ${appointmentData.desiredTime}</p>
        ${appointmentData.comments ? `<p><strong>Commentaires:</strong> ${appointmentData.comments}</p>` : ''}
        <p><strong>Ordonnance:</strong> ${prescriptionNote}</p>
        <p><em>Cette demande a été soumise via le site web du laboratoire.</em></p>
      `;

      // Prepare email message
      const msg = {
        to: labEmailAddress.value(),
        from: sendgridSenderEmail.value(),
        subject: `Nouvelle demande de RDV: ${appointmentData.name} - ${appointmentData.desiredDate}`,
        html: emailHtml,
        attachments: attachments
      };

      // Send the email
      await sgMail.send(msg);
      logger.info(`Email notification sent for appointment request: ${appointmentId}`, { structuredData: true });

      // Update document status
      const db = admin.firestore();
      await db.collection("appointmentRequests").doc(appointmentId).update({
        status: "email_sent_to_lab",
        emailSentAt: FieldValue.serverTimestamp()
      });

    } catch (error) {
      logger.error("Error sending appointment notification email:", error);

      // Update document status to indicate failure
      if (event.data && event.data.id) {
        try {
          const db = admin.firestore();
          await db.collection("appointmentRequests").doc(event.data.id).update({
            status: "email_failed",
            emailErrorAt: FieldValue.serverTimestamp(),
            emailErrorMessage: error.message || "Unknown error"
          });
        } catch (updateError) {
          logger.error("Error updating appointment status after email failure:", updateError);
        }
      }
    }
  }
);
