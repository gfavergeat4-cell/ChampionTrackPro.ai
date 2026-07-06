import { Platform } from "react-native";

let auth, db, app, functions;

if (Platform.OS !== "web") {
  // React Native - utiliser firebaseConfig.native.js
  const nativeConfig = require("../firebaseConfig.native");
  const { getFirestore } = require("firebase/firestore");
  const { getFunctions } = require("firebase/functions");
  
  auth = nativeConfig.auth;
  db = getFirestore(nativeConfig.app);
  app = nativeConfig.app;
  // Functions are deployed to us-central1
  functions = getFunctions(nativeConfig.app, 'us-central1');
} else {
  // Web - config standard
  const { initializeApp, getApp, getApps } = require("firebase/app");
  const { getAuth } = require("firebase/auth");
  const { getFirestore } = require("firebase/firestore");
  const { getFunctions } = require("firebase/functions");

  const firebaseConfig = {
    apiKey: "AIzaSyDwslrK0lbuqsBl61C_l3gjVDGF8ZqTZ5o",
    authDomain: "championtrackpro.firebaseapp.com",
    projectId: "championtrackpro",
    storageBucket: "championtrackpro.firebasestorage.app",
    messagingSenderId: "308674968497",
    appId: "1:308674968497:web:5f8d10b09ee98717a81b90"
  };

  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  // Functions are deployed to us-central1
  functions = getFunctions(app, 'us-central1');
}

export { auth, db, app, functions };
