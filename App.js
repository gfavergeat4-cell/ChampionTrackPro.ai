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
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import StitchNavigator from "./navigation/StitchNavigator";
import ShowcaseScreen from "./src/showcase/ShowcaseScreen";

// ── Mode showcase ────────────────────────────────────────────────────────
// Plateau de capture pour la vidéo produit et les démos en discovery call.
// Accessible UNIQUEMENT en développement, via ?showcase=1 :
//     npx expo start --web   ->   http://localhost:8081/?showcase=1
// `__DEV__` est remplacé par `false` au build de production, donc ce bloc et
// l'import ci-dessus sont éliminés par le bundler : les écrans de démo ne
// sont PAS atteignables sur champtrackpro.com. C'est voulu — ils affichent
// des données fictives qui ne doivent jamais être prises pour du réel.
function showcaseRequested() {
  if (!__DEV__ || Platform.OS !== "web") return false;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("showcase");
}

export default function App() {
  const [marcReady] = useMarcellus({ Marcellus_400Regular });
  const [interReady] = useInter({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
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

  // Court-circuit avant l'auth et avant les polices de l'app : le showcase
  // charge ses propres polices (Bebas Neue + DM Sans) et ne dépend d'aucune
  // session. Il doit s'ouvrir instantanément, autant de fois que nécessaire.
  if (showcaseRequested()) return <ShowcaseScreen />;

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

