// Scene3Baseline.tsx — L'écran qui doit convaincre.
//
// Ce que cette scène doit faire comprendre en 8 secondes :
//   « 54 » ne veut rien dire dans l'absolu. Ce qui compte, c'est que 54 soit
//   à 23 points SOUS la norme de CE joueur — et que la chute vienne du
//   physique (-31) bien plus que du mental (-12).
//
// La bande grisée est SA bande habituelle (±10 pts autour de sa baseline
// EMA 28 j, méthode DAR). Elle se déforme dans le temps parce que la norme
// d'un athlète bouge : c'est exactement ce qu'une moyenne d'équipe efface.
import React from "react";
import { SC, STATUS, easeInOutCubic, easeOutCubic } from "./showcaseTheme";
import { FOCUS, FOCUS_SERIES, FOCUS_BASELINE, BAND } from "./showcaseData";
import { useTimeline, seg } from "./useTimeline";

const T_HEAD = 450;
const T_CHART = 1000;
const T_CHART_DUR = 1700;
const T_TODAY = 2500;
const T_AXES = 3100;
const T_AXIS_STEP = 260;
const T_NOTE = 4400;
export const SCENE3_DURATION = T_NOTE + 2600;

const W = 320, H = 150, PAD_L = 8, PAD_R = 8, PAD_T = 12, PAD_B = 18;
const Y_MIN = 35, Y_MAX = 100;

const xAt = (i: number, n: number) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R);
const yAt = (v: number) => PAD_T + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * (H - PAD_T - PAD_B);

function AxisRow({
  label, value, dev, p,
}: { label: string; value: number; dev: number; p: number }) {
  // Position du marqueur sur une échelle d'écart -40..+20
  const lo = -40, hi = 20;
  const pos = (d: number) => ((d - lo) / (hi - lo)) * 100;
  const bandL = pos(-BAND), bandR = pos(BAND);
  const inBand = Math.abs(dev) <= BAND;
  const col = inBand ? SC.green : dev < -20 ? SC.blue : SC.amber;
  const shownDev = Math.round(dev * easeOutCubic(p));

  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 12.5, color: SC.textSoft, flex: 1 }}>{label}</div>
        <div style={{ fontFamily: SC.display, fontSize: 19, color: SC.text, letterSpacing: 0.5 }}>
          {Math.round(value * easeOutCubic(p))}
        </div>
        <div style={{
          fontFamily: SC.display, fontSize: 15, letterSpacing: 0.5,
          color: col, minWidth: 34, textAlign: "right",
        }}>
          {shownDev >= 0 ? "+" : ""}{shownDev}
        </div>
      </div>
      {/* Rail : la bande habituelle est le repère, pas le zéro absolu */}
      <div style={{
        position: "relative", height: 7, borderRadius: 4,
        background: "rgba(255,255,255,0.05)", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: `${bandL}%`, width: `${bandR - bandL}%`,
          background: "rgba(255,255,255,0.12)",
        }} />
        <div style={{
          position: "absolute", top: -2.5, height: 12, width: 3, borderRadius: 2,
          left: `calc(${pos(dev * easeOutCubic(p))}% - 1.5px)`,
          background: col, boxShadow: `0 0 8px ${col}`,
        }} />
      </div>
    </div>
  );
}

export default function Scene3Baseline({ playKey, paused }: { playKey: number; paused?: boolean }) {
  const t = useTimeline(playKey, paused);
  const n = FOCUS_SERIES.length;

  const headP = easeInOutCubic(seg(t, T_HEAD, 450));
  const chartP = easeOutCubic(seg(t, T_CHART, T_CHART_DUR));
  const todayP = easeInOutCubic(seg(t, T_TODAY, 500));
  const noteP = easeInOutCubic(seg(t, T_NOTE, 600));

  // Tracé progressif de la courbe
  const shown = Math.max(2, Math.round(n * chartP));
  const linePts = FOCUS_SERIES.slice(0, shown).map((v, i) => `${xAt(i, n)},${yAt(v)}`).join(" ");

  const bandTop = FOCUS_BASELINE.map((b, i) => `${xAt(i, n)},${yAt(b + BAND)}`).join(" ");
  const bandBot = FOCUS_BASELINE.map((b, i) => `${xAt(i, n)},${yAt(b - BAND)}`).reverse().join(" ");

  const s = STATUS[FOCUS.status];
  const lastX = xAt(n - 1, n), lastY = yAt(FOCUS_SERIES[n - 1]);

  return (
    <div style={{
      position: "absolute", inset: 0,
      background: `linear-gradient(180deg, ${SC.bg} 0%, ${SC.bgDeep} 100%)`,
      fontFamily: SC.body, overflow: "hidden",
      // 44 px réservés en haut : hauteur de la barre d'état du téléphone.
      // space-between répartit les quatre blocs sur toute la hauteur plutôt
      // que de laisser un vide entre les axes et l'encart de lecture.
      padding: "44px 20px 26px", display: "flex", flexDirection: "column",
      justifyContent: "space-between",
    }}>
      <div style={{
        position: "absolute", top: -130, left: "50%", width: 460, height: 320,
        transform: "translateX(-50%)", pointerEvents: "none",
        background: `radial-gradient(ellipse at center, ${SC.blue}18 0%, transparent 70%)`,
      }} />

      {/* En-tête joueur */}
      <div style={{
        opacity: headP, transform: `translateY(${(1 - headP) * 10}px)`,
        paddingTop: 14, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            fontFamily: SC.display, fontSize: 33, letterSpacing: 1, color: SC.text, lineHeight: 1,
          }}>
            {FOCUS.name}
          </div>
          <div style={{
            fontFamily: SC.display, fontSize: 13, letterSpacing: 1.2, color: s.color,
            padding: "3px 9px", borderRadius: 6, background: `${s.color}14`,
            boxShadow: `inset 0 0 0 1px ${s.color}44`,
          }}>
            {s.label}
          </div>
        </div>
        <div style={{ fontSize: 12, color: SC.textMuted, marginTop: 4 }}>
          Center · 21-day window · compared to his own baseline
        </div>
      </div>

      {/* Courbe + bande habituelle */}
      <div style={{
        marginTop: 16, background: SC.card, borderRadius: 16, padding: "14px 12px 8px",
        boxShadow: `inset 0 0 0 1px ${SC.ring}`, flexShrink: 0,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          padding: "0 6px 8px",
        }}>
          <span style={{ fontSize: 11, letterSpacing: 1.4, color: SC.textMuted }}>READINESS</span>
          <span style={{ fontSize: 11, color: SC.textMuted }}>
            <span style={{
              display: "inline-block", width: 16, height: 6, borderRadius: 3,
              background: "rgba(255,255,255,0.14)", verticalAlign: "middle", marginRight: 5,
            }} />
            his usual range
          </span>
        </div>

        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
          {/* Bande habituelle : ±10 pts autour de SA baseline */}
          <polygon points={`${bandTop} ${bandBot}`} fill="rgba(255,255,255,0.075)" />
          {/* Baseline elle-même */}
          <polyline
            points={FOCUS_BASELINE.map((b, i) => `${xAt(i, n)},${yAt(b)}`).join(" ")}
            fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1"
            strokeDasharray="3 3" />
          {/* Sa courbe */}
          <polyline points={linePts} fill="none" stroke={SC.cyan} strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 5px ${SC.cyan}88)` }} />
          {/* Point du jour */}
          {chartP > 0.98 && (
            <>
              <circle cx={lastX} cy={lastY} r={5 + 3 * (1 - todayP)} fill={s.color}
                opacity={todayP} style={{ filter: `drop-shadow(0 0 9px ${s.color})` }} />
              <line x1={lastX} y1={lastY} x2={lastX} y2={H - PAD_B + 6}
                stroke={s.color} strokeWidth="1" opacity={todayP * 0.45} strokeDasharray="2 3" />
            </>
          )}
        </svg>

        <div style={{
          display: "flex", justifyContent: "space-between",
          padding: "2px 6px 0", fontSize: 10, color: SC.textMuted,
        }}>
          <span>3 weeks ago</span>
          <span style={{ color: todayP > 0.5 ? s.color : SC.textMuted }}>today</span>
        </div>
      </div>

      {/* Décomposition par axe */}
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          { label: "Physical", v: FOCUS.axes.phy, d: FOCUS.axesDev.phy },
          { label: "Technical", v: FOCUS.axes.tec, d: FOCUS.axesDev.tec },
          { label: "Mental", v: FOCUS.axes.men, d: FOCUS.axesDev.men },
        ].map((a, i) => (
          <AxisRow key={a.label} label={a.label} value={a.v} dev={a.d}
            p={easeInOutCubic(seg(t, T_AXES + i * T_AXIS_STEP, 520))} />
        ))}
      </div>

      {/* La lecture — c'est la phrase qui vend le produit */}
      <div style={{
        opacity: noteP, transform: `translateY(${(1 - noteP) * 12}px)`,
        background: SC.cardAlt, borderRadius: 14, padding: "14px 15px",
        boxShadow: `inset 0 0 0 1px ${SC.ringStrong}`,
      }}>
        <div style={{ fontSize: 11, letterSpacing: 1.4, color: SC.cyan, marginBottom: 6 }}>
          WHAT STANDS OUT
        </div>
        <div style={{ fontSize: 13.5, color: SC.textSoft, lineHeight: 1.5 }}>
          His body is <strong style={{ color: SC.blue }}>31 points</strong> under his own norm
          while his head is only <strong style={{ color: SC.text }}>12</strong> under.
          Same athlete, two different signals.
        </div>
      </div>
    </div>
  );
}
