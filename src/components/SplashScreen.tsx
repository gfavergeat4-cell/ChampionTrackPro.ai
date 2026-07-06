import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
// ChampionTrackProLogo import removed — using img directly
export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {Platform.OS === "web" && (
          <img
            src="/logo/logo_clean.png"
            alt=""
            style={{ width: 200, height: "auto", display: "block", margin: "0 auto" }}
          />
        )}
        <View style={styles.spinner} />
        <Text style={styles.text}>Loading...</Text>
      </View>
      {Platform.OS === "web" && (
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .spinner-web {
            animation: spin 1s linear infinite;
          }
        `}</style>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1A",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    gap: 20,
    backgroundColor: "transparent",
  },
  spinner: {
    width: 40,
    height: 40,
    borderWidth: 3,
    borderColor: "rgba(0, 224, 255, 0.3)",
    borderTopColor: "#00D4FF",
    borderRadius: 20,
    ...(Platform.OS === "web" && {
      className: "spinner-web",
    }),
  },
  text: {
    fontSize: 16,
    fontWeight: "500",
    color: "#00D4FF",
    fontFamily: Platform.OS === "web" ? "'Inter', sans-serif" : "System",
  },
});
