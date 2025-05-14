/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import next from "next";

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

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
