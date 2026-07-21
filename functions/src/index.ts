/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import next from "next";

// Patient results bridge (CyberLab) — see docs/integrations/cyberlab-results-api.md
export { fetchResults } from "./cyberlab/fetchResults";

// Staff-only onboarding probe: test a requester_id against CyberLab (list-only).
export { adminTestResults } from "./cyberlab/adminTestResults";

// Admin space callables (staff attach requester_id/type; owner/admin manage roles).
export {
  adminLookupPatient,
  adminSearchPatients,
  adminSetRequester,
  adminSetStaff,
  adminSetAdmin,
  adminListStaff,
  // Patient results-access requests (self-service) + staff fulfillment.
  requestResultsAccess,
  myAccessRequest,
  adminListAccessRequests,
  adminFulfillAccessRequest,
  adminRejectAccessRequest,
  // Adoption dashboard (accounts + usage) for the staff space.
  adminDashboardStats,
} from "./admin/adminPatients";

import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Appointment-notification emails are sent by the Next.js API route
// (src/app/api/send-appointment/route.ts, nodemailer + Gmail SMTP), NOT here —
// the old SendGrid Firestore trigger was unused and has been removed.

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
 * Scheduled Cloud Function to clean up expired prescription files
 * Runs daily at 2:00 AM to delete prescriptions older than 30 days
 *
 * REGION — deliberately `europe-west1`, NOT the `europe-southwest1` used by every other
 * function here: **Cloud Scheduler has no europe-southwest1 location**, so creating the
 * schedule failed with `HTTP 400: Location 'europe-southwest1' is not a valid location`.
 * The function itself deployed but no scheduler job was ever created, so this cleanup
 * silently never ran. europe-west1 is supported (and already hosts the SSR function).
 * Do not align this back to REGION without checking Cloud Scheduler's supported locations.
 */
export const cleanupExpiredPrescriptions = onSchedule(
  {
    schedule: "0 2 * * *", // Every day at 2:00 AM (cron format)
    timeZone: "Europe/Paris",
    region: "europe-west1",
    memory: "512MiB",
  },
  async () => {
    logger.info("Starting cleanup of expired prescriptions", { structuredData: true });

    try {
      const db = admin.firestore();
      const storage = getStorage();
      const bucket = storage.bucket();
      const now = new Date();

      // Query all appointment requests with expired prescriptions
      const expiredAppointments = await db.collection("appointmentRequests")
        .where("expiresAt", "<=", now)
        .where("prescriptionImageUrl", "!=", null)
        .get();

      logger.info(`Found ${expiredAppointments.size} expired prescriptions to clean up`, { structuredData: true });

      let deletedCount = 0;
      let errorCount = 0;

      // Process each expired appointment
      for (const doc of expiredAppointments.docs) {
        try {
          const data = doc.data();
          const prescriptionUrl = data.prescriptionImageUrl;

          if (prescriptionUrl) {
            // Extract file path from URL
            // URL format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media...
            const urlParts = prescriptionUrl.split('/o/');
            if (urlParts.length > 1) {
              const pathPart = urlParts[1].split('?')[0];
              const filePath = decodeURIComponent(pathPart);

              // Delete the file from Storage
              const fileRef = bucket.file(filePath);
              await fileRef.delete();

              logger.info(`Deleted prescription file: ${filePath}`, { structuredData: true });

              // Update the document to mark prescription as deleted
              await doc.ref.update({
                prescriptionImageUrl: null,
                prescriptionDeletedAt: FieldValue.serverTimestamp(),
                prescriptionDeletedReason: "expired_30_days"
              });

              deletedCount++;
            }
          }
        } catch (fileError) {
          logger.error(`Error deleting prescription for document ${doc.id}:`, fileError);
          errorCount++;
        }
      }

      logger.info(`Cleanup completed. Deleted: ${deletedCount}, Errors: ${errorCount}`, { structuredData: true });

    } catch (error) {
      logger.error("Error during prescription cleanup:", error);
    }
  }
);
