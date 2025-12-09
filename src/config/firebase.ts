// src/config/firebase.ts
import { initializeApp, getApps, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getFirestore as getFirestoreImpl, Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { FirebaseStorage } from 'firebase/storage';
import type { Analytics as FirebaseAnalytics } from 'firebase/analytics';

// Firebase configuration from environment variables
// These MUST be set in .env.local file (see .env.example)
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validate that required config is present
const isConfigValid = firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId;

// Initialize Firebase
let app: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;

if (!getApps().length) {
  if (isConfigValid) {
    app = initializeApp(firebaseConfig);
  } else if (process.env.NODE_ENV === 'development') {
    console.error(
      "[Firebase] Configuration is incomplete. Please check your .env.local file.\n" +
      "Required variables: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_APP_ID"
    );
  }
} else {
  app = getApps()[0];
}

// Initialize Firestore if app exists
if (app) {
  try {
    firestoreInstance = getFirestoreImpl(app);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error("[Firebase] Error initializing Firestore:", error);
    }
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
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.error("[Firebase] Error initializing Auth:", e);
        }
      }
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
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.error("[Firebase] Error initializing Storage:", e);
        }
      }
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
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.error("[Firebase] Error initializing Analytics:", e);
        }
      }
    }
    return analyticsInstance;
  }
  return null;
};

export {
  app,
  db,
  getClientAuth,
  getClientStorage,
  getClientAnalytics,
  storage, // Added storage export for rendez-vous page
};