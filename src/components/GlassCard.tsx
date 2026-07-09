// GlassCard.tsx — Verre de focus Courtlight (doc 06 §2.3, plan supérieur)
// Surface translucide avec backdrop-blur, liseré cyan, ombre e2,
// inclinaison 3D ±5° sous le pointeur (web), reflet de lumière qui suit.
import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { courtlight } from "../theme/tokens";

interface Props {
  children: React.ReactNode;
  style?: any;
  glow?: boolean; // applique le glowFocus (UN par écran — doc 06 §8)
}

export default function GlassCard({ children, style, glow = false }: Props) {
  const containerRef = React.useRef<any>(null);

  // 3D tilt + glare on web
  React.useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = containerRef.current as HTMLElement | null;
    if (!el) return;

    // Check reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const glare = el.querySelector("[data-glare]") as HTMLElement | null;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 5}deg) rotateY(${(x - 0.5) * 5}deg) translateZ(6px)`;
      if (glare) {
        glare.style.setProperty("--gx", `${x * 100}%`);
        glare.style.setProperty("--gy", `${y * 100}%`);
      }
    };

    const onLeave = () => {
      el.style.transform = "perspective(900px)";
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const glowShadow = glow
    ? `${courtlight.shadow.e2}, ${courtlight.shadow.glowFocus}`
    : courtlight.shadow.e2;

  return (
    <View
      ref={containerRef}
      style={[
        styles.glass,
        Platform.OS === "web" && (webStyles.glass as any),
        Platform.OS === "web" && ({ boxShadow: `${glowShadow}, ${courtlight.edge.rim.replace("inset ", "")}` } as any),
        style,
      ]}
    >
      {/* Glare overlay (web only) */}
      {Platform.OS === "web" && (
        <div
          data-glare=""
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: courtlight.radius.card,
            pointerEvents: "none",
            background:
              "radial-gradient(400px 200px at var(--gx, 50%) var(--gy, 0%), rgba(160,220,255,0.10), transparent 60%)",
          }}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: courtlight.radius.card,
    padding: 16,
    overflow: "hidden",
  },
});

// Web-only styles (CSS properties not in RN StyleSheet)
const webStyles = {
  glass: {
    background: courtlight.surface.glass,
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: `1px solid rgba(0,212,255,0.28)`,
    boxShadow: `${courtlight.shadow.e2}, inset 0 1px 0 rgba(160,220,255,0.14)`,
    transformStyle: "preserve-3d",
    willChange: "transform",
    transition: `transform 0.18s ${courtlight.motion.settle}`,
    position: "relative",
  },
};
