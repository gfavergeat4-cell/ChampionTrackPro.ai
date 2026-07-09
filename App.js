import React from "react";
import { Platform, View, ActivityIndicator, StyleSheet } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./services/firebaseConfig";
import { initializeFCM } from "./src/services/fcmService";
import { useFonts as useMarcellus, Marcellus_400Regular } from "@expo-google-fonts/marcellus";
import {
  useFonts as useInter,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import StitchNavigator from "./navigation/StitchNavigator";

export default function App() {
  const [marcReady] = useMarcellus({ Marcellus_400Regular });
  const [interReady] = useInter({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

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

  if (!marcReady || !interReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#00D4FF" />
      </View>
    );
  }

  return <StitchNavigator />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#070B14",
  },
});

