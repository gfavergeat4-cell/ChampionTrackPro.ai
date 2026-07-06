import React, { useState, useEffect } from "react";
import { Platform } from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { registerWebPushTokenForCurrentUser } from "../services/webNotifications";

type Platform_ = "android" | "ios-safari" | "ios-pwa";

function detectPlatform(): Platform_ {
  if (typeof window === "undefined") return "android";
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS) return "android";
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
  return isStandalone ? "ios-pwa" : "ios-safari";
}

async function markOnboardingComplete() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await updateDoc(doc(db, "users", uid), { onboardingComplete: true });
  } catch (e) {
    console.warn("[Onboarding] markOnboardingComplete failed:", e);
  }
}

interface Props {
  onComplete: () => void;
}

export default function OnboardingNotifScreen({ onComplete }: Props) {
  const [platform, setPlatform] = useState<Platform_>("android");
  const [step, setStep] = useState<"main" | "ios-install">("main");
  const [skipCount, setSkipCount] = useState(0);
  const [permResult, setPermResult] = useState<NotificationPermission | null>(null);
  const [pulsing, setPulsing] = useState(true);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  useEffect(() => {
    // If ios-safari → show install step first
    if (platform === "ios-safari") setStep("ios-install");
  }, [platform]);

  const requestAndRegister = async () => {
    if (typeof Notification === "undefined") {
      await markOnboardingComplete();
      onComplete();
      return;
    }
    const result = await Notification.requestPermission();
    setPermResult(result);
    if (result === "granted") {
      try { await registerWebPushTokenForCurrentUser(); } catch (e) { /* silent */ }
      await markOnboardingComplete();
      onComplete();
    }
    // else stay and show retry/skip
  };

  const handleSkip = async () => {
    const next = skipCount + 1;
    setSkipCount(next);
    if (next >= 2) {
      await markOnboardingComplete();
      onComplete();
    }
    // after first skip show message; second skip exits
  };

  const handleIOSInstallDone = () => {
    // Mark pwa prompt shown
    localStorage.setItem("pwaPromptShown", "true");
    setStep("main");
  };

  if (Platform.OS !== "web") return null;

  // ── Styles ──────────────────────────────────────────────────────────────
  const s: Record<string, React.CSSProperties> = {
    root: {
      position: "fixed",
      inset: 0,
      background: "#0A0F1E",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      fontFamily: "'Inter', sans-serif",
      padding: "24px",
      boxSizing: "border-box",
    },
    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: "50%",
      background: "rgba(0,212,255,0.12)",
      border: "2px solid rgba(0,212,255,0.3)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: "32px",
      animation: pulsing ? "ctp-pulse-notif 2s ease-in-out infinite" : "none",
    },
    title: {
      fontFamily: "'Bebas Neue', sans-serif",
      fontSize: "36px",
      color: "#FFFFFF",
      letterSpacing: "3px",
      textAlign: "center",
      marginBottom: "12px",
    },
    subtitle: {
      fontFamily: "'DM Sans', 'Inter', sans-serif",
      fontSize: "16px",
      color: "rgba(255,255,255,0.6)",
      textAlign: "center",
      maxWidth: "320px",
      lineHeight: "1.5",
      marginBottom: "40px",
    },
    btn: {
      width: "100%",
      maxWidth: "320px",
      height: "56px",
      background: "linear-gradient(135deg, #00BFFF, #0066FF)",
      borderRadius: "12px",
      border: "none",
      color: "#fff",
      fontSize: "16px",
      fontWeight: 700,
      cursor: "pointer",
      marginBottom: "16px",
      letterSpacing: "0.5px",
    },
    skip: {
      background: "none",
      border: "none",
      color: "rgba(255,255,255,0.3)",
      fontSize: "14px",
      cursor: "pointer",
      padding: "8px",
    },
    denied: {
      color: "rgba(255,255,255,0.5)",
      fontSize: "14px",
      textAlign: "center",
      maxWidth: "300px",
      lineHeight: "1.5",
      marginBottom: "20px",
    },
    arrowWrap: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      marginBottom: "24px",
      animation: "ctp-bounce-arrow 1.2s ease-in-out infinite",
    },
    shareIcon: {
      width: 56,
      height: 56,
      borderRadius: "14px",
      background: "rgba(0,122,255,0.2)",
      border: "1px solid rgba(0,122,255,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: "8px",
    },
  };

  const keyframes = `
    @keyframes ctp-pulse-notif {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(0,212,255,0.4); }
      50% { transform: scale(1.08); box-shadow: 0 0 0 12px rgba(0,212,255,0); }
    }
    @keyframes ctp-bounce-arrow {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
  `;

  // ── iOS Safari Install Step ──────────────────────────────────────────────
  if (step === "ios-install") {
    return (
      <div style={s.root}>
        <style>{keyframes}</style>
        <div style={s.arrowWrap}>
          <div style={s.shareIcon}>
            {/* Share icon */}
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth={2.5}>
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="16,6 12,2 8,6" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "20px" }}>↓</span>
        </div>
        <div style={s.title}>INSTALL THE APP FIRST</div>
        <div style={s.subtitle}>
          Tap the <strong style={{ color: "#007AFF" }}>↑ Share</strong> button below, then select{" "}
          <strong style={{ color: "#fff" }}>"Add to Home Screen"</strong>
        </div>
        <button style={s.btn} onClick={handleIOSInstallDone}>
          I've added it — Continue
        </button>
        <button style={s.skip} onClick={handleSkip}>
          Skip for now
        </button>
      </div>
    );
  }

  // ── Main Step (Android / iOS PWA) ────────────────────────────────────────
  const isDenied = permResult === "denied";

  return (
    <div style={s.root}>
      <style>{keyframes}</style>
      <div style={s.iconWrap}>
        {/* Bell icon */}
        <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth={2}>
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={s.title}>NEVER MISS A SESSION</div>
      <div style={s.subtitle}>
        Get instant alerts when your coach needs your data.{"\n"}
        Takes less than 60 seconds to respond.
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", maxWidth: 300, lineHeight: 1.5, marginBottom: 16 }}>
        Your data is used solely for performance tracking by your coaching staff. You may request deletion at any time. FERPA rights apply.
      </div>

      {isDenied ? (
        <>
          <div style={s.denied}>
            {platform === "android"
              ? "To enable: tap the lock icon in your browser's address bar → Notifications → Allow"
              : "To enable: Settings → Safari → ChampionTrackPro → Notifications → Allow"}
          </div>
          <button style={s.skip} onClick={handleSkip}>
            Skip for now
          </button>
        </>
      ) : (
        <>
          <button style={s.btn} onClick={requestAndRegister}>
            Enable Notifications
          </button>
          {skipCount > 0 && (
            <div style={{ ...s.denied, marginBottom: "12px" }}>
              You can always enable this later in your Profile.
            </div>
          )}
          <button style={s.skip} onClick={handleSkip}>
            Skip for now
          </button>
        </>
      )}
    </div>
  );
}
