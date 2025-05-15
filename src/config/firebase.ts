import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDVG_qlwWUUFi6bohNIe0yx1UPQeQiPsVg",
  authDomain: "labo-el-allali-pwa.firebaseapp.com",
  projectId: "labo-el-allali-pwa",
  storageBucket: "labo-el-allali-pwa.firebasestorage.app",
  messagingSenderId: "611850340982",
  appId: "1:611850340982:web:8a4df18bb7620a01eb2d57",
  measurementId: "G-FW0GFTRPBN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Initialize other Firebase services conditionally to prevent SSR issues
let auth = null;
let storage = null;
let analytics = null;

// Only initialize client-side services when in the browser
if (typeof window !== 'undefined') {
  // Dynamically import services to avoid SSR issues
  const initializeServices = async () => {
    try {
      // Auth
      const { getAuth } = await import('firebase/auth');
      auth = getAuth(app);
      
      // Storage
      const { getStorage } = await import('firebase/storage');
      storage = getStorage(app);
      
      // Analytics
      const { getAnalytics } = await import('firebase/analytics');
      analytics = getAnalytics(app);
    } catch (error) {
      console.error('Error initializing Firebase services:', error);
    }
  };
  
  initializeServices();
}

export { app, db, auth, storage, analytics };