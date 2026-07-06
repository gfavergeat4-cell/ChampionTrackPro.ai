import React, { useState, useEffect } from "react";
import { Platform } from "react-native";
import { registerWebPushTokenForCurrentUser } from "../services/webNotifications";

const DISMISSED_KEY = "pwa-banner-dismissed";

type BannerState = "install" | "enable" | "hidden";

function computeBannerState(): BannerState {
  if (localStorage.getItem(DISMISSED_KEY) === "true") return "hidden";
  if (typeof Notification !== "undefined" && Notification.permission === "granted") return "hidden";

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (!isIOS) return "hidden";

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  return isStandalone ? "enable" : "install";
}

export default function PWAInstallBanner() {
  const [bannerState, setBannerState] = useState<BannerState>("hidden");
  const [deniedMsg, setDeniedMsg] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    setBannerState(computeBannerState());

    const handleVisibility = () => {
      setBannerState(computeBannerState());
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setBannerState("hidden");
  };

  const handleEnableNotifications = async () => {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      try {
        await registerWebPushTokenForCurrentUser();
      } catch (e) {
        console.warn("[PWA] registerWebPushTokenForCurrentUser failed:", e);
      }
      localStorage.setItem(DISMISSED_KEY, "true");
      setBannerState("hidden");
    } else {
      setDeniedMsg(true);
    }
  };

  if (bannerState === "hidden") return null;

  return (
    <>
      <style>{`
        @keyframes ctp-pulse-icon {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.18); }
        }
        @keyframes ctp-bounce-arrow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(7px); }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: bannerState === "install" ? "rgba(0,212,255,0.12)" : "#0D1526",
          borderTop: bannerState === "install" ? "2px solid #00D4FF" : "1px solid #00D4FF",
          padding: "16px 20px 32px",
          boxShadow: "0 -4px 24px rgba(0, 212, 255, 0.15)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          style={{
            position: "absolute",
            top: 12,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "rgba(255,255,255,0.4)",
            lineHeight: 1,
          }}
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {bannerState === "install" ? (
          /* STATE 1 — not yet installed as PWA */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 4 }}>
            {/* Pulsing Share icon */}
            <div style={{
              animation: "ctp-pulse-icon 1.8s ease-in-out infinite",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "rgba(0,212,255,0.15)",
              border: "1.5px solid rgba(0,212,255,0.5)",
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </div>

            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#FFFFFF", letterSpacing: 0.2 }}>
                Install ChampionTrackPro
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
                Tap{" "}
                <span style={{ color: "#00D4FF", fontWeight: 700 }}>↑ Share</span>
                {" "}below, then{" "}
                <span style={{ color: "#00D4FF", fontWeight: 700 }}>'Add to Home Screen'</span>
              </p>
            </div>

            {/* Animated arrow pointing down toward Safari Share button */}
            <div style={{ animation: "ctp-bounce-arrow 1.2s ease-in-out infinite", marginTop: 2 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </div>
          </div>
        ) : (
          /* STATE 2 — PWA installed, need notification permission */
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>
              Enable Notifications
            </p>
            {deniedMsg ? (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#FFB347", lineHeight: 1.5 }}>
                To enable: Settings → Notifications → ChampionTrackPro → Allow
              </p>
            ) : (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                Receive training alerts and reminders
              </p>
            )}
            <button
              onClick={handleEnableNotifications}
              style={{
                background: "#00D4FF",
                color: "#000000",
                border: "none",
                borderRadius: 6,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "system-ui, -apple-system, sans-serif",
                WebkitTapHighlightColor: "transparent",
              } as React.CSSProperties}
            >
              Enable Notifications
            </button>
          </div>
        )}
      </div>
    </>
  );
}
