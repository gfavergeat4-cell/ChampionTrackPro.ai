// SplashScreen.tsx — Courtlight loading (doc 06 §6)
// Skeleton warm-up: pas de spinner, la lumière se lève.
import React from "react";
import { View, Text, StyleSheet, Platform, Animated } from "react-native";
import { courtlight } from "../theme/tokens";

function ShimmerBar({ width = "50%", delay = 0 }: { width?: string | number; delay?: number }) {
  const shimmer = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const timer = setTimeout(() => {
      Animated.loop(
        Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: false }),
        { iterations: 2 }
      ).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [shimmer, delay]);
  const bg = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["rgba(255,255,255,0.03)", "rgba(160,220,255,0.10)", "rgba(255,255,255,0.03)"],
  });
  return <Animated.View style={{ height: 12, borderRadius: 6, width, backgroundColor: bg, marginTop: 10 }} />;
}

export default function SplashScreen() {
  return (
    <View style={s.container}>
      <Text style={s.brand}>
        CHAMPION<Text style={s.brandCyan}>TRACK</Text>PRO
      </Text>
      <ShimmerBar width="60%" delay={0} />
      <ShimmerBar width="40%" delay={200} />
      <ShimmerBar width="30%" delay={400} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: courtlight.bg.court,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  brand: {
    fontFamily: "Marcellus_400Regular",
    fontSize: 14,
    letterSpacing: 6,
    color: courtlight.text.mid,
    marginBottom: 20,
  },
  brandCyan: {
    color: courtlight.accent.cyan,
  },
});
