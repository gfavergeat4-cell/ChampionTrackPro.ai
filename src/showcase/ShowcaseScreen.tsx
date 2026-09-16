// ShowcaseScreen.tsx — Plateau de tournage.
//
// Rôle : afficher les scènes dans un cadre aux proportions exactes, sans
// aucun chrome navigateur, et permettre de rejouer une prise autant de fois
// que nécessaire sans relancer l'app.
//
// Raccourcis clavier (pensés pour capturer d'une seule main) :
//   1 / 2 / 3   choisir la scène          Espace / R   rejouer
//   D           bascule mobile <-> desktop   C         mode propre (masque l'UI)
//   + / -       échelle de rendu (capture HD)
//
// En mode propre, l'écran ne contient PLUS QUE le cadre : c'est l'état dans
// lequel il faut lancer l'enregistrement.
import React from "react";
import { SC, injectShowcaseFonts } from "./showcaseTheme";
import Scene1Questionnaire, { SCENE1_DURATION } from "./Scene1Questionnaire";
import Scene2MorningBrief, { SCENE2_DURATION } from "./Scene2MorningBrief";
import Scene3Baseline, { SCENE3_DURATION } from "./Scene3Baseline";

const PHONE = { w: 390, h: 844 };
const DESK = { w: 1280, h: 720 };

const SCENES = [
  { id: 1, name: "Check-in athlète", dur: SCENE1_DURATION, desktop: false },
  { id: 2, name: "Morning Brief", dur: SCENE2_DURATION, desktop: true },
  { id: 3, name: "Baseline joueur", dur: SCENE3_DURATION, desktop: false },
];

/** Barre d'état iOS factice — évite toute trace d'OS ou de navigateur. */
function StatusBar() {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 44,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 26px", zIndex: 10, pointerEvents: "none",
      fontFamily: SC.body, color: SC.text,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.2 }}>9:41</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {/* Réseau */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 4.4} y={8 - i * 2.4} width="2.9" height={3 + i * 2.4}
              rx="0.9" fill={SC.text} />
          ))}
        </svg>
        {/* Wi-Fi */}
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
          <path d="M8 9.6 L10.1 7.3 A3 3 0 0 0 5.9 7.3 Z" fill={SC.text} />
          <path d="M2.6 4.2 A7.6 7.6 0 0 1 13.4 4.2" stroke={SC.text} strokeWidth="1.5"
            strokeLinecap="round" fill="none" opacity="0.95" />
          <path d="M4.8 6.4 A4.6 4.6 0 0 1 11.2 6.4" stroke={SC.text} strokeWidth="1.5"
            strokeLinecap="round" fill="none" opacity="0.95" />
        </svg>
        {/* Batterie */}
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
          <rect x="0.6" y="0.6" width="21" height="10.8" rx="3" stroke={SC.text}
            strokeOpacity="0.4" strokeWidth="1" />
          <rect x="2.2" y="2.2" width="17" height="7.6" rx="1.8" fill={SC.text} />
          <path d="M23.4 4.2 v3.6 a2 2 0 0 0 1.4-1.8 a2 2 0 0 0-1.4-1.8Z" fill={SC.text}
            fillOpacity="0.4" />
        </svg>
      </div>
    </div>
  );
}

export default function ShowcaseScreen() {
  const [scene, setScene] = React.useState(1);
  const [playKey, setPlayKey] = React.useState(0);
  const [desktop, setDesktop] = React.useState(false);
  const [clean, setClean] = React.useState(false);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => { injectShowcaseFonts(); }, []);

  const replay = React.useCallback(() => setPlayKey((k) => k + 1), []);
  const go = React.useCallback((id: number) => { setScene(id); setPlayKey((k) => k + 1); }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") go(1);
      else if (e.key === "2") go(2);
      else if (e.key === "3") go(3);
      else if (e.key === " " || e.key.toLowerCase() === "r") { e.preventDefault(); replay(); }
      else if (e.key.toLowerCase() === "c") setClean((v) => !v);
      else if (e.key.toLowerCase() === "d") { setDesktop((v) => !v); replay(); }
      else if (e.key === "+" || e.key === "=") setScale((s) => Math.min(3, +(s + 0.5).toFixed(1)));
      else if (e.key === "-") setScale((s) => Math.max(0.5, +(s - 0.5).toFixed(1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, replay]);

  const cur = SCENES.find((s) => s.id === scene)!;
  const isDesk = desktop && cur.desktop;
  const dim = isDesk ? DESK : PHONE;

  // Boucle : on relance la scène à la fin pour permettre une capture continue.
  React.useEffect(() => {
    const id = setTimeout(replay, cur.dur);
    return () => clearTimeout(id);
  }, [playKey, cur.dur, replay]);

  const Body = (
    <>
      {scene === 1 && <Scene1Questionnaire playKey={playKey} />}
      {scene === 2 && <Scene2MorningBrief playKey={playKey} variant={isDesk ? "desktop" : "mobile"} />}
      {scene === 3 && <Scene3Baseline playKey={playKey} />}
    </>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 22,
      fontFamily: SC.body, overflow: "auto",
    }}>
      {/* Le cadre — c'est la seule chose à filmer */}
      <div style={{
        width: dim.w * scale, height: dim.h * scale,
        flexShrink: 0, position: "relative",
      }}>
        <div style={{
          width: dim.w, height: dim.h, position: "relative", overflow: "hidden",
          borderRadius: isDesk ? 10 : 44, background: SC.bg,
          transform: `scale(${scale})`, transformOrigin: "top left",
        }}>
          {Body}
          {!isDesk && <StatusBar />}
          {!isDesk && (
            <div style={{
              position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
              width: 134, height: 5, borderRadius: 3,
              background: "rgba(255,255,255,0.3)", zIndex: 10, pointerEvents: "none",
            }} />
          )}
        </div>
      </div>

      {/* Panneau de contrôle — masqué en mode propre */}
      {!clean && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          justifyContent: "center", padding: "0 20px", flexShrink: 0,
        }}>
          {SCENES.map((s) => (
            <button key={s.id} onClick={() => go(s.id)} style={{
              padding: "9px 15px", borderRadius: 9, border: "none", cursor: "pointer",
              fontFamily: SC.body, fontSize: 13,
              background: scene === s.id ? SC.cyan : "rgba(255,255,255,0.08)",
              color: scene === s.id ? "#000" : SC.textSoft,
              fontWeight: scene === s.id ? 700 : 400,
            }}>
              {s.id}. {s.name}
            </button>
          ))}
          <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.15)" }} />
          <button onClick={replay} style={{
            padding: "9px 15px", borderRadius: 9, border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.08)", color: SC.textSoft, fontSize: 13,
            fontFamily: SC.body,
          }}>
            ⟳ Rejouer
          </button>
          {cur.desktop && (
            <button onClick={() => { setDesktop((v) => !v); replay(); }} style={{
              padding: "9px 15px", borderRadius: 9, border: "none", cursor: "pointer",
              background: isDesk ? SC.green : "rgba(255,255,255,0.08)",
              color: isDesk ? "#000" : SC.textSoft, fontSize: 13, fontFamily: SC.body,
            }}>
              {isDesk ? "16:9 desktop" : "9:16 mobile"}
            </button>
          )}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            color: SC.textMuted, fontSize: 13,
          }}>
            <button onClick={() => setScale((s) => Math.max(0.5, +(s - 0.5).toFixed(1)))}
              style={{
                width: 28, height: 28, borderRadius: 7, border: "none", cursor: "pointer",
                background: "rgba(255,255,255,0.08)", color: SC.textSoft, fontSize: 15,
              }}>−</button>
            <span style={{ minWidth: 34, textAlign: "center" }}>{scale}×</span>
            <button onClick={() => setScale((s) => Math.min(3, +(s + 0.5).toFixed(1)))}
              style={{
                width: 28, height: 28, borderRadius: 7, border: "none", cursor: "pointer",
                background: "rgba(255,255,255,0.08)", color: SC.textSoft, fontSize: 15,
              }}>+</button>
          </div>
          <button onClick={() => setClean(true)} style={{
            padding: "9px 15px", borderRadius: 9, border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.08)", color: SC.textSoft, fontSize: 13,
            fontFamily: SC.body,
          }}>
            Mode propre (C)
          </button>
        </div>
      )}

      {clean && (
        <div
          onClick={() => setClean(false)}
          style={{
            position: "fixed", bottom: 10, right: 14, fontSize: 11,
            color: "rgba(255,255,255,0.14)", cursor: "pointer", userSelect: "none",
          }}
        >
          C
        </div>
      )}
    </div>
  );
}
