import "react-native-get-random-values"; // polyfill crypto.getRandomValues en RN
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// === Tes vraies clés (OK pour RN) ===
const firebaseConfig = {
  apiKey: "AIzaSyDwslrK0lbuqsBl61C_l3gjVDGF8ZqTZ5o",
  authDomain: "championtrackpro.firebaseapp.com",
  projectId: "championtrackpro",
  storageBucket: "championtrackpro.firebasestorage.app",
  messagingSenderId: "308674968497",
  appId: "1:308674968497:web:5f8d10b09ee98717a81b90",
};

// App unique - S'assurer que l'app est initialisée AVANT auth
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Auth unique (RN nécessite une persistance spécifique)
// Pour React Native, TOUJOURS utiliser initializeAuth avec persistence
let auth;
try {
  // Pour React Native, on doit utiliser initializeAuth avec persistence
  // getAuth() ne fonctionne pas correctement en standalone
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // Si initializeAuth échoue (déjà initialisé), utiliser getAuth
  try {
    auth = getAuth(app);
  } catch (getAuthError) {
    // Si getAuth échoue aussi, réessayer initializeAuth
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
}

// Fonction d'initialisation (assure que auth est prêt)
export async function initAuth() {
  try {
    // S'assurer que auth est bien initialisé
    if (!auth) {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    }
  } catch (e) {
    // Auth déjà initialisé, c'est OK
    if (!auth) {
      auth = getAuth(app);
    }
  }
  return Promise.resolve();
}

export { app, auth };
