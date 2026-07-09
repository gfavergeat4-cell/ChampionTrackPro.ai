// ReadinessHalo.tsx — Signature Courtlight n°1 (doc 06 §2.1)
// Anneau de readiness + lueur de zone + cran de baseline.
// "On VOIT l'écart avant de lire le chiffre."
import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { courtlight } from "../theme/tokens";

type Zone = "GREEN" | "BLUE" | "YELLOW" | "NONE";

interface Props {
  score: number | null;        // 0-100
  zone: Zone;
  size?: number;               // diameter px (default 76)
  baselinePct?: number | null;  // 0-100, position du cran sur l'anneau
  fontSize?: number;            // override auto (size * 0.30)
  animate?: boolean;            // count-up entrance (default false)
}

const ZONE_COLORS: Record<Zone, string> = {
  GREEN: courtlight.zone.GREEN,
  BLUE: courtlight.zone.BLUE,
  YELLOW: courtlight.zone.YELLOW,
  NONE: "rgba(255,255,255,0.25)",
};

const ZONE_GLOW: Record<Zone, string> = {
  GREEN: "drop-shadow(0 0 8px rgba(0,200,83,0.7))",
  BLUE: "drop-shadow(0 0 8px rgba(33,150,243,0.7))",
  YELLOW: "drop-shadow(0 0 8px rgba(255,184,0,0.7))",
  NONE: "none",
};

export default function ReadinessHalo({
  score,
  zone,
  size = 76,
  baselinePct = null,
  fontSize,
  animate = false,
}: Props) {
  const displayScore = score ?? 0;
  const r = size / 2 - 5;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - displayScore / 100);
  const color = ZONE_COLORS[zone] || ZONE_COLORS.NONE;
  const glow = ZONE_GLOW[zone] || "none";
  const textSize = fontSize || Math.round(size * 0.3);

  // Cran de baseline : point blanc sur l'anneau
  const baselineMarker = React.useMemo(() => {
    if (baselinePct == null) return null;
    // L'anneau démarre à -90° (12h), tourne clockwise
    const angle = (baselinePct / 100) * 2 * Math.PI - Math.PI / 2;
    const cx = size / 2 + r * Math.cos(angle);
    const cy = size / 2 + r * Math.sin(angle);
    return { cx, cy };
  }, [baselinePct, size, r]);

  // Count-up animation
  const [displayVal, setDisplayVal] = React.useState(animate ? 0 : displayScore);
  const [animOffset, setAnimOffset] = React.useState(
    animate ? circumference : offset
  );

  React.useEffect(() => {
    if (!animate) {
      setDisplayVal(displayScore);
      setAnimOffset(offset);
      return;
    }
    const duration = courtlight.motion.hero; // 600ms
    let start: number | null = null;
    let raf: number;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      // ease-out cubic
      const e = 1 - Math.pow(1 - p, 3);
      const val = Math.round(displayScore * e);
      setDisplayVal(val);
      setAnimOffset(circumference * (1 - (displayScore * e) / 100));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [animate, displayScore, circumference, offset]);

  // Web: apply drop-shadow glow via style filter
  const svgStyle: any =
    Platform.OS === "web" && glow !== "none"
      ? { filter: glow, transform: [{ rotate: "-90deg" }] }
      : { transform: [{ rotate: "-90deg" }] };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={svgStyle}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={4}
          fill="none"
        />
        {/* Score arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={animOffset}
        />
        {/* Baseline notch */}
        {baselineMarker && (
          <Circle
            cx={baselineMarker.cx}
            cy={baselineMarker.cy}
            r={3.4}
            fill="#fff"
            opacity={0.95}
          />
        )}
      </Svg>
      <Text
        style={[
          styles.value,
          {
            fontSize: textSize,
            fontFamily: "Inter_300Light",
            fontVariant: ["tabular-nums" as any],
          },
        ]}
      >
        {score != null ? displayVal : "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    position: "absolute",
    color: "#FFFFFF",
    fontWeight: "400",
  },
});
