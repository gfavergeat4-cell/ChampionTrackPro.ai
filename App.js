import React from "react";
import { Platform } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./services/firebaseConfig";
import { initializeFCM } from "./src/services/fcmService";
import StitchNavigator from "./navigation/StitchNavigator";

export default function App() {
  React.useEffect(() => {
    if (Platform.OS !== "web") return;

    let initialized = false;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !initialized) {
        initialized = true;
        initializeFCM().catch((err) => {
          console.error("[FCM] initializeFCM in App failed", err);
        });
      }
    });
    return () => unsub();
  }, []);

  return <StitchNavigator />;
}

