// Scene1Questionnaire.tsx — L'athlète remplit son check-in post-séance.
//
// Trois états successifs, comme demandé au brief :
//   1. avant réponse   : curseurs au repos, anneau blanc qui pulse
//   2. en train de répondre : chaque curseur glisse vers sa valeur, un par un
//   3. validé          : bouton pressé, puis confirmation
//
// Le curseur est l'emblème de marque : on réutilise le VRAI composant de
// production (`src/components/LogoSlider`), pas une imitation. Ce qui est
// filmé doit être ce qui est livré.
import React from "react";
import LogoSlider from "../components/LogoSlider";
import { SC, easeInOutCubic } from "./showcaseTheme";
import { QUESTIONS, SESSION } from "./showcaseData";
import { useTimeline, seg, lerp } from "./useTimeline";

// Minutage (ms). Modifiable sans casser la scène : tout est relatif.
const T_CARD = 260;        // apparition d'une carte
const T_HOLD = 620;        // temps de lecture avant que le curseur bouge
const T_DRAG = 900;        // durée du glissement d'un curseur
const T_GAP = 420;         // respiration entre deux questions
const T_START = 700;       // apparition de l'en-tête

const qStart = (i: number) => T_START + 260 + i * (T_HOLD + T_DRAG + T_GAP);
const T_PAIN = qStart(QUESTIONS.length);
const T_SUBMIT = T_PAIN + 1100;
const T_DONE = T_SUBMIT + 700;
export const SCENE1_DURATION = T_DONE + 1900;

function Card({ children, p }: { children: React.ReactNode; p: number }) {
  return (
    <div
      style={{
        background: SC.card,
        borderRadius: 18,
        boxShadow: `inset 0 0 0 1px ${SC.ring}`,
        padding: 16,
        opacity: p,
        transform: `translateY(${(1 - p) * 14}px)`,
      }}
    >
      {children}
    </div>
  );
}

export default function Scene1Questionnaire({ playKey, paused }: { playKey: number; paused?: boolean }) {
  const t = useTimeline(playKey, paused);

  const headP = easeInOutCubic(seg(t, T_START, 420));
  const painP = easeInOutCubic(seg(t, T_PAIN, 380));
  const painPicked = t > T_PAIN + 620;
  const submitP = easeInOutCubic(seg(t, T_SUBMIT - 300, 380));
  const pressed = t > T_SUBMIT && t < T_SUBMIT + 220;
  const done = t > T_DONE;
  const doneP = easeInOutCubic(seg(t, T_DONE, 420));

  return (
    <div
      style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(180deg, ${SC.bg} 0%, ${SC.bgDeep} 100%)`,
        fontFamily: SC.body,
        display: "flex", flexDirection: "column",
        // 44 px réservés en haut : c'est la hauteur de la barre d'état du
        // téléphone. Sans cette réserve, le titre passe sous l'heure.
        padding: "44px 20px 0", overflow: "hidden",
      }}
    >
      {/* Halo de marque, un seul point lumineux par écran */}
      <div style={{
        position: "absolute", top: -120, left: "50%", width: 420, height: 300,
        transform: "translateX(-50%)", pointerEvents: "none",
        background: `radial-gradient(ellipse at center, ${SC.cyan}1f 0%, transparent 70%)`,
      }} />

      {!done && (
        <>
          {/* En-tête de séance */}
          <div style={{ opacity: headP, transform: `translateY(${(1 - headP) * 10}px)`, paddingTop: 8 }}>
            <div style={{
              fontFamily: SC.display, fontSize: 30, letterSpacing: 1.1,
              color: SC.text, lineHeight: 1.05,
            }}>
              {SESSION.title}
            </div>
            <div style={{ fontSize: 13, color: SC.textMuted, marginTop: 4 }}>{SESSION.time}</div>
            <div style={{
              height: 1, marginTop: 14,
              background: `linear-gradient(90deg, ${SC.cyan}66, transparent)`,
            }} />
          </div>

          {/* Questions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 16 }}>
            {QUESTIONS.map((q, i) => {
              const s = qStart(i);
              const cardP = easeInOutCubic(seg(t, s - 200, T_CARD));
              const dragP = easeInOutCubic(seg(t, s + T_HOLD, T_DRAG));
              const touched = t > s + T_HOLD + 60;
              // Départ à 50 : position neutre, aucune valeur affirmée tant
              // que l'athlète n'a pas touché (DAR §E, biais de centralité).
              const value = Math.round(lerp(50, q.target, dragP));
              return (
                <Card key={q.key} p={cardP}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: SC.text, lineHeight: 1.3 }}>
                    {q.label}
                  </div>
                  <div style={{ fontSize: 12, color: SC.textMuted, marginTop: 3, lineHeight: 1.35 }}>
                    {q.hint}
                  </div>
                  <div style={{ marginTop: 15, marginBottom: 7 }}>
                    <LogoSlider
                      value={value}
                      onChange={() => {}}
                      touched={touched}
                      ariaLabel={q.label}
                    />
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: 11, color: SC.textMuted,
                  }}>
                    <span>{q.left}</span>
                    <span style={{
                      fontFamily: SC.display, fontSize: 17, letterSpacing: 0.6,
                      color: touched ? SC.cyan : SC.textMuted,
                      transition: "color 220ms ease-out",
                    }}>
                      {touched ? value : "—"}
                    </span>
                    <span>{q.right}</span>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Porte d'entrée douleur */}
          <div style={{ marginTop: 13, opacity: painP, transform: `translateY(${(1 - painP) * 12}px)` }}>
            <Card p={1}>
              <div style={{ fontSize: 15, fontWeight: 500, color: SC.text }}>
                Any pain or discomfort?
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 13 }}>
                {["No", "Yes"].map((opt) => {
                  const on = painPicked && opt === "No";
                  return (
                    <div key={opt} style={{
                      flex: 1, textAlign: "center", padding: "11px 0",
                      borderRadius: 11, fontSize: 14, fontWeight: 500,
                      color: on ? SC.bg : SC.textSoft,
                      background: on ? SC.green : "rgba(255,255,255,0.05)",
                      boxShadow: on ? `0 0 18px ${SC.green}55` : `inset 0 0 0 1px rgba(255,255,255,0.08)`,
                      transform: on ? "scale(1.03)" : "scale(1)",
                      transition: "all 260ms cubic-bezier(0.34,1.3,0.44,1)",
                    }}>
                      {opt}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Envoi */}
          <div style={{
            marginTop: "auto", marginBottom: 26,
            opacity: submitP, transform: `scale(${pressed ? 0.965 : 1})`,
            transition: "transform 140ms ease-out",
          }}>
            <div style={{
              textAlign: "center", padding: "16px 0", borderRadius: 14,
              fontFamily: SC.display, fontSize: 20, letterSpacing: 1.6, color: SC.bg,
              background: `linear-gradient(90deg, ${SC.cyan} 0%, ${SC.blue} 100%)`,
              boxShadow: `0 6px 26px ${SC.cyan}44`,
            }}>
              SUBMIT
            </div>
          </div>
        </>
      )}

      {/* Confirmation */}
      {done && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 22,
        }}>
          <svg width={92} height={92} viewBox="0 0 92 92" style={{ opacity: doneP }}>
            <circle cx="46" cy="46" r="42" fill="none" stroke={SC.green} strokeWidth="2.5"
              strokeDasharray={264} strokeDashoffset={264 * (1 - doneP)}
              transform="rotate(-90 46 46)" style={{ filter: `drop-shadow(0 0 10px ${SC.green}88)` }} />
            <path d="M29 47 L41 59 L64 34" fill="none" stroke={SC.green} strokeWidth="4"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={62} strokeDashoffset={62 * (1 - easeInOutCubic(seg(t, T_DONE + 260, 420)))}
              style={{ filter: `drop-shadow(0 0 8px ${SC.green}aa)` }} />
          </svg>
          <div style={{
            fontFamily: SC.display, fontSize: 30, letterSpacing: 1.3, color: SC.text,
            opacity: easeInOutCubic(seg(t, T_DONE + 380, 420)),
          }}>
            CHECK-IN SENT
          </div>
          <div style={{
            fontSize: 13.5, color: SC.textMuted, textAlign: "center", maxWidth: 250, lineHeight: 1.5,
            opacity: easeInOutCubic(seg(t, T_DONE + 520, 420)),
          }}>
            Takes under a minute. Your staff sees it tomorrow morning.
          </div>
        </div>
      )}
    </div>
  );
}
