import { Platform } from "react-native";
import { registerRootComponent } from "expo";
import App from "./App";

// Détecter la plateforme et utiliser la bonne config Firebase
// Pour le web, index.web.js est utilisé (configuré dans app.config.js)
// Ce fichier est utilisé uniquement pour React Native (iOS/Android)
if (Platform.OS !== "web") {
  // React Native uniquement : utiliser la config native
  try {
    // Import dynamique pour éviter les erreurs de bundling web
    const nativeConfig = require("./firebaseConfig.native");
    if (nativeConfig && nativeConfig.initAuth) {
      setImmediate(() => { nativeConfig.initAuth().catch(() => {}); });
    }
  } catch (error) {
    // Si l'import échoue, continuer sans initialisation (sera géré par le composant)
    console.warn("Firebase native config import failed:", error);
  }
}

registerRootComponent(App);




