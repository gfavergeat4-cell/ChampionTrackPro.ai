// screens/StitchLandingScreen.js
import React from "react";
import { useNavigation } from "@react-navigation/native";
import { View, Platform } from "react-native";
import PWAInstallBanner from "../src/components/PWAInstallBanner";
import { useIsDesktop } from "../src/hooks/useIsDesktop";

export default function StitchLandingScreen() {
  const navigation = useNavigation();
  const isDesktop = useIsDesktop();

  const handleCreateAccount = () => navigation.navigate("CreateAccount");
  const handleLogin = () => navigation.navigate("Login");

  if (Platform.OS === "web") {
    return (
      <>
      <PWAInstallBanner />
      <div
        style={{
          width: "100%",
          height: "100vh",
          background: "radial-gradient(ellipse at 40% 30%, #0D2545 0%, #0A0F1E 65%)",
          position: "relative",
          overflow: "hidden",
          fontFamily: "'Inter', 'SF Pro Display', sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {/* Logo centered at 38% */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%' }}>
          <img
            src="/logo/logo_bon.png"
            alt=""
            style={{
              width: isDesktop ? 480 : 260,
              height: isDesktop ? 240 : 130,
              objectFit: 'contain',
              mixBlendMode: 'screen',
              display: 'block',
              margin: '0 auto',
            }}
          />
        </div>

        {/* Buttons pinned to bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 420,
            padding: "0 24px 40px",
            boxSizing: "border-box",
          }}
        >
          <button
            onClick={handleCreateAccount}
            style={{
              width: "100%",
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #00BFFF, #0055FF)",
              boxShadow: "0 0 30px rgba(0,180,255,0.4)",
              border: "none",
              color: "white",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "2px",
              textTransform: "uppercase",
              cursor: "pointer",
              marginBottom: 12,
              transition: "opacity 0.2s",
              animation: "fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.8s both",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Create Account
          </button>

          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              height: 56,
              borderRadius: 14,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: "2px",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "border-color 0.2s",
              animation: "fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 1s both",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
          >
            Log In
          </button>
        </div>
      </div>
      </>
    );
  }

  // Native fallback
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0A0F1E",
        justifyContent: "center",
        alignItems: "center",
      }}
    />
  );
}
