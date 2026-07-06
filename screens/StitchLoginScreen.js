import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { View, Platform, Alert } from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { useIsDesktop } from "../src/hooks/useIsDesktop";

export default function StitchLoginScreen() {
  const navigation = useNavigation();
  const isDesktop = useIsDesktop();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.email || !formData.password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, formData.email.trim(), formData.password);
    } catch (error) {
      let msg = "Login error";
      if (error.code === "auth/user-not-found") msg = "No account found with this email.";
      else if (error.code === "auth/wrong-password") msg = "Incorrect password.";
      else if (error.code === "auth/invalid-credential") msg = "Invalid email or password.";
      else if (error.code === "auth/invalid-email") msg = "Invalid email address.";
      else if (error.code === "auth/too-many-requests") msg = "Too many attempts. Please try again later.";
      else if (error.code === "auth/network-request-failed") msg = "Network error. Check your connection.";
      else msg = error.message || error.code || "Unknown error";
      Alert.alert("Login failed", msg);
    } finally {
      setLoading(false);
    }
  };

  if (Platform.OS === "web") {
    return (
      <div style={{
        width: "100%",
        height: "100vh",
        background: "radial-gradient(ellipse at 40% 30%, #0D2545 0%, #0A0F1E 65%)",
        backgroundColor: "#0A0F1E",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'SF Pro Display', sans-serif",
        WebkitFontSmoothing: "antialiased",
        color: "#fff",
      }}>

        {/* Back button */}
        <button
          onClick={() => navigation.navigate("Landing")}
          style={{
            position: "absolute", top: 24, left: 24, zIndex: 10,
            width: 40, height: 40, borderRadius: 20,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer",
          }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Logo */}
        <div style={{
          position: "absolute", top: "30%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "100%", display: "flex", justifyContent: "center",
        }}>
          <img
            src="/logo/logo_bon.png"
            alt=""
            style={{ width: isDesktop ? 480 : 260, height: isDesktop ? 240 : 130, objectFit: "contain", mixBlendMode: "screen", display: "block", margin: "0 auto" }}
          />
        </div>

        {/* Form + buttons */}
        <div style={{
          position: "absolute",
          bottom: 0, left: "50%",
          transform: "translateX(-50%)",
          width: "100%", maxWidth: 420,
          padding: "0 24px 40px",
          boxSizing: "border-box",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <form
            id="login-form"
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
            autoComplete="off"
          >
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              autoComplete="off"
              style={{
                height: 52, width: "100%", boxSizing: "border-box",
                backgroundColor: "#0D1526",
                border: "1px solid rgba(0,212,255,0.14)",
                borderRadius: 8, color: "#FFFFFF",
                padding: "0 16px", fontSize: 15, outline: "none",
              }}
            />
            <div style={{ position: "relative" }}>
              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                autoComplete="off"
                style={{
                  height: 52, width: "100%", boxSizing: "border-box",
                  backgroundColor: "#0D1526",
                  border: "1px solid rgba(0,212,255,0.14)",
                  borderRadius: 8, color: "#FFFFFF",
                  padding: "0 48px 0 16px", fontSize: 15, outline: "none",
                }}
              />
              <div aria-hidden="true" style={{
                position: "absolute", right: 14, top: "50%",
                transform: "translateY(-50%)", color: "#9AA3B2", pointerEvents: "none",
              }}>
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <button type="button" onClick={() => {}} style={{
                fontSize: 13, color: "#00D4FF", textDecoration: "underline",
                background: "none", border: "none", cursor: "pointer",
              }}>
                Forgot Password?
              </button>
            </div>
          </form>

          <button
            type="submit"
            form="login-form"
            onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
            disabled={loading}
            style={{
              width: "100%", height: 56, borderRadius: 8,
              background: "linear-gradient(135deg, #00BFFF, #0066FF)",
              boxShadow: "0 0 30px rgba(0,180,255,0.4)",
              border: "none", color: "#fff",
              fontWeight: 700, fontSize: 14, letterSpacing: "2px",
              textTransform: "uppercase", cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1, transition: "opacity 0.2s",
            }}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>

          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#9CA3AF", margin: 0 }}>
              Don't have an account?{" "}
              <span
                onClick={() => navigation.navigate("CreateAccount")}
                style={{ color: "#00D4FF", cursor: "pointer", textDecoration: "underline" }}
              >
                Create one
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <View style={{ flex: 1, backgroundColor: "#0A0F1E" }} />;
}
