import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported, Messaging } from "firebase/messaging";

// Configuration Firebase avec variables d'environnement
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDwslrK0lbuqsBl61C_l3gjVDGF8ZqTZ5o",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "championtrackpro.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "championtrackpro",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "championtrackpro.appspot.com",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "308674968497",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:308674968497:web:5f8d10b09ee98717a81b90",
};

// Initialiser l'app Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialiser Auth avec persistance browser
export const auth = getAuth(app);

// Initialiser Firestore
export const db = getFirestore(app);

let messagingPromise: Promise<Messaging | null> | null = null;

/**
 * Obtient l'instance Firebase Messaging pour le web
 * Retourne null si le navigateur ne supporte pas les notifications ou si on est côté serveur
 */
export async function getWebMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  
  if (!messagingPromise) {
    messagingPromise = isSupported().then((supported) => {
      if (!supported) {
        console.warn("[FCM] Messaging not supported in this browser");
        return null;
      }
      return getMessaging(app);
    });
  }
  
  return messagingPromise;
}

export async function initAuth() {
  await setPersistence(auth, browserLocalPersistence);
  
  // Afficher l'état de débogage au démarrage (uniquement sur le web)
  if (typeof window !== 'undefined') {
    try {
      const { debugWebPushStatus } = await import('../src/services/webNotifications');
      debugWebPushStatus();
    } catch (err) {
      console.warn('[WEB PUSH] Could not load debug function:', err);
    }
  }
  
  await new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && typeof window !== 'undefined') {
        // onMessage handler is registered in fcmService.js (initializeFCM).
        // setupForegroundMessageHandler removed to avoid duplicate onMessage handlers.
      }
      unsub();
      resolve();
    });
  });
}

export { app };
export default app;

