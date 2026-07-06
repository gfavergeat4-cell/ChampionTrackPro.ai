import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import Constants from "expo-constants";

const extra = (Constants?.expoConfig?.extra as any) || {};
const firebaseConfig = extra?.firebase ?? {};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// Functions are deployed to us-central1 (same region as in functions/index.js)
export const functions = getFunctions(app, 'us-central1');
export const storage = getStorage(app);
export { app };

