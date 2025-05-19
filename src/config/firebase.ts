// src/config/firebase.ts
import { initializeApp, getApps, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getFirestore as getFirestoreImpl, Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { FirebaseStorage } from 'firebase/storage';
import type { Analytics as FirebaseAnalytics } from 'firebase/analytics';

console.log("--- [firebase.ts] MODULE LOAD START ---");

// Function to safely get environment variables - works on server only
const getEnvVar = (key: string): string => {
  return process.env[key] || '';
};

// Create the Firebase config object - for server-side
const firebaseConfig: FirebaseOptions = {
  apiKey: getEnvVar('NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain: getEnvVar('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('NEXT_PUBLIC_FIREBASE_APP_ID'),
  measurementId: getEnvVar('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'),
};

// Hardcoded fallback for client-side rendering
const clientSideFallbackConfig: FirebaseOptions = {
  apiKey: "AIzaSyDVG_qlwWUUFi6bohNIe0yx1UPQeQiPsVg",
  authDomain: "labo-el-allali-pwa.firebaseapp.com",
  projectId: "labo-el-allali-pwa",
  storageBucket: "labo-el-allali-pwa.firebasestorage.app",
  messagingSenderId: "611850340982",
  appId: "1:611850340982:web:8a4df18bb7620a01eb2d57",
  measurementId: "G-FW0GFTRPBN"
};

// Log current config values
console.log("[firebase.ts] Firebase config values:", {
  apiKey: firebaseConfig.apiKey ? "DEFINED" : "UNDEFINED",
  projectId: firebaseConfig.projectId || clientSideFallbackConfig.projectId,
  appId: firebaseConfig.appId ? "DEFINED" : "UNDEFINED",
});

// Initialize Firebase
let app: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;

// Determine if we're on client or server
const isClient = typeof window !== 'undefined';

// Initialize Firebase (with different logic for client vs server)
if (!getApps().length) {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    // Server-side with valid config
    app = initializeApp(firebaseConfig);
    console.log(`[firebase.ts] Firebase App initialized with projectId: ${firebaseConfig.projectId}`);
  } else if (isClient) {
    // Client-side (browser) - use fallback config
    app = initializeApp(clientSideFallbackConfig);
    console.log(`[firebase.ts] Client-side Firebase initialized with fallback projectId: ${clientSideFallbackConfig.projectId}`);
  } else {
    // Server-side with invalid config
    console.error("[firebase.ts] Firebase configuration is incomplete. Check your .env.local file.");
    if (process.env.NODE_ENV === 'development') {
      throw new Error("Firebase configuration is missing required fields");
    }
  }
} else {
  // Use existing Firebase app
  app = getApps()[0];
  console.log(`[firebase.ts] Using existing Firebase app with projectId: ${app.options.projectId}`);
}

// Initialize Firestore if app exists
if (app) {
  try {
    firestoreInstance = getFirestoreImpl(app);
  } catch (error) {
    console.error("[firebase.ts] Error initializing Firestore:", error);
  }
}

// Export the pre-initialized Firestore instance
const db = firestoreInstance;

// Lazy-loaded client-side services
let authInstance: Auth | null = null;
const getClientAuth = async (): Promise<Auth | null> => {
  if (typeof window !== 'undefined' && app) {
    if (!authInstance) {
      try {
        const { getAuth } = await import('firebase/auth');
        authInstance = getAuth(app);
      } catch (e) { console.error("[firebase.ts] Error initializing Firebase Auth:", e); }
    }
    return authInstance;
  }
  return null;
};

// Storage instance and getter
let storageInstance: FirebaseStorage | null = null;
const getClientStorage = async (): Promise<FirebaseStorage | null> => {
  if (typeof window !== 'undefined' && app) {
    if (!storageInstance) {
      try {
        const { getStorage } = await import('firebase/storage');
        storageInstance = getStorage(app);
      } catch (e) { console.error("[firebase.ts] Error initializing Firebase Storage:", e); }
    }
    return storageInstance;
  }
  return null;
};

// Create a simplified storage export for direct import
let storage: FirebaseStorage | null = null;
if (typeof window !== 'undefined') {
  // Only initialize in browser environment
  getClientStorage().then(s => { storage = s; });
}

let analyticsInstance: FirebaseAnalytics | null = null;
const getClientAnalytics = async (): Promise<FirebaseAnalytics | null> => {
  if (typeof window !== 'undefined' && app) {
    if (!analyticsInstance) {
      try {
        const { getAnalytics, isSupported } = await import('firebase/analytics');
        if (await isSupported()) {
          analyticsInstance = getAnalytics(app);
        } else { console.warn("[firebase.ts] Firebase Analytics not supported."); }
      } catch (e) { console.error("[firebase.ts] Error initializing Firebase Analytics:", e); }
    }
    return analyticsInstance;
  }
  return null;
};

console.log("--- [firebase.ts] MODULE LOAD END ---");

export {
  app,
  db,
  getClientAuth,
  getClientStorage,
  getClientAnalytics,
  storage, // Added storage export for rendez-vous page
};