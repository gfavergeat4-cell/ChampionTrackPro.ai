// CardGraphite.tsx — Carte graphite Courtlight (doc 06 §2.3, plan intermédiaire)
// Surface flottante, ombre e1, liseré zénithal 1px.
// Animation cascade : translateY 8px → 0, spring, delay 40ms/index.
import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { courtlight } from "../theme/tokens";

interface Props {
  children: React.ReactNode;
  style?: any;
  index?: number; // pour le décalage cascade (40ms × index)
}

export default function CardGraphite({ children, style, index = 0 }: Props) {
  const webAnim = Platform.OS === "web"
    ? {
        animation: `cardRise 0.34s ${courtlight.motion.settle} ${index * 40}ms backwards`,
      }
    : {};

  return (
    <View style={[s.card, webAnim as any, style]}>
      {children}
    </View>
  );
}

// Inject cascade keyframes on web (once)
if (Platform.OS === "web" && typeof document !== "undefined") {
  const id = "courtlight-card-keyframes";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes cardRise {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
}

const s = StyleSheet.create({
  card: {
    backgroundColor: courtlight.surface.card,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.10)",
    borderRadius: courtlight.radius.card,
    padding: 16,
    ...(Platform.OS === "web"
      ? { boxShadow: `${courtlight.shadow.e1}, inset 0 1px 0 rgba(160,220,255,0.10)` }
      : {}),
  },
});
