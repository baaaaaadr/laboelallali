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
import path from "path";

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const isDev = process.env.NODE_ENV !== "production";

// Resolve the path to the root of the Next.js project directory
// Relative path from functions/lib/index.js back to the project root is '../../'
const projectRoot = path.resolve(__dirname, '..', '..');

// Prepare the Next.js server instance
const nextServer = next({
  dev: isDev,
  dir: projectRoot, // Directory where the Next.js app resides (root of your project)
  conf: { distDir: ".next" }, // Relative path to the build output directory within 'dir'
});

const nextRequestHandler = nextServer.getRequestHandler();

// Define the Cloud Function
export const nextServer = onRequest(
  {
    // Set region and memory for Next.js applications
    // Adjust these based on your needs and Firebase plan
    region: "us-central1", // Example: Change to your preferred region (e.g., europe-west1)
    memory: "1GiB",      // Example: Adjust memory (e.g., 512MiB, 2GiB)
  },
  (req, res) => {
    logger.info(`Received request for path: ${req.path}`, { structuredData: true });
    // Ensure the Next.js server is prepared before handling requests
    return nextServer.prepare()
      .then(() => {
        logger.info("Next.js server prepared, handling request.", { structuredData: true });
        return nextRequestHandler(req, res);
      })
      .catch((err) => {
        logger.error("Next.js request handler error or preparation failed.", { error: err, structuredData: true });
        res.status(500).send("Internal Server Error handling Next.js request.");
      });
  }
);
