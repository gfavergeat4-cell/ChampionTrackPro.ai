// Scene2MorningBrief.tsx — Le Morning Brief tel que le staff l'ouvre.
//
// Deux rendus depuis UN SEUL composant :
//   variant="mobile"  -> 9:16, pour la vidéo
//   variant="desktop" -> 16:9, pour le partage d'écran en discovery call
//
// Le moment fort à animer : la jauge d'équipe qui se remplit, les scores qui
// montent en compteur, puis les lignes du roster qui tombent en cascade.
//
// La jauge mesure la part du roster DANS SA BANDE HABITUELLE OU AU-DESSUS.
// Ce n'est pas une moyenne de scores : moyenner des athlètes entre eux est
// précisément ce que la méthode DAR interdit (chaque série a sa norme).
import React from "react";
import { SC, STATUS, easeInOutCubic, easeOutCubic } from "./showcaseTheme";
import { ROSTER, TEAM, type ScAthlete } from "./showcaseData";
import { useTimeline, seg } from "./useTimeline";

const T_HEAD = 500;
const T_GAUGE = 950;
const T_GAUGE_DUR = 1500;
const T_ROWS = 2000;
const T_ROW_STEP = 115;
const T_ROW_DUR = 480;

export const SCENE2_DURATION =
  T_ROWS + ROSTER.length * T_ROW_STEP + T_ROW_DUR + 2200;

function Badge({ a, p }: { a: ScAthlete; p: number }) {
  const s = STATUS[a.status];
  return (
    <div style={{
      fontFamily: SC.display, fontSize: 13, letterSpacing: 1.2,
      color: s.color, padding: "3px 9px", borderRadius: 6,
      background: `${s.color}14`, boxShadow: `inset 0 0 0 1px ${s.color}44`,
      opacity: p, whiteSpace: "nowrap",
    }}>
      {s.label}
    </div>
  );
}

function Row({ a, p, wide }: { a: ScAthlete; p: number; wide: boolean }) {
  const s = STATUS[a.status];
  const shown = Math.round(a.score * easeOutCubic(p));
  const dev = a.deviation;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: wide ? 16 : 11,
      // En desktop, les lignes sont plus hautes pour que les six lignes de
      // chaque colonne occupent toute la hauteur utile : un 16:9 à moitié vide
      // en bas donne une impression de produit inachevé.
      padding: wide ? "21px 18px" : "10px 13px",
      borderRadius: 12, background: SC.card,
      boxShadow: `inset 0 0 0 1px ${SC.ring}`,
      opacity: p, transform: `translateX(${(1 - p) * -18}px)`,
    }}>
      <div style={{
        width: 3, height: wide ? 30 : 24, borderRadius: 2,
        background: s.color, boxShadow: `0 0 9px ${s.color}99`, flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: wide ? 16 : 14.5, fontWeight: 500, color: SC.text,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {a.name}
        </div>
        <div style={{ fontSize: wide ? 12 : 11, color: SC.textMuted, marginTop: 1 }}>
          {a.pos} · {dev >= 0 ? "+" : ""}{dev} vs his baseline
        </div>
      </div>
      <div style={{
        fontFamily: SC.display, fontSize: wide ? 30 : 26, letterSpacing: 0.6,
        color: SC.text, minWidth: wide ? 46 : 40, textAlign: "right",
      }}>
        {shown}
      </div>
      <Badge a={a} p={p} />
    </div>
  );
}

export default function Scene2MorningBrief({
  playKey, paused, variant = "mobile",
}: { playKey: number; paused?: boolean; variant?: "mobile" | "desktop" }) {
  const t = useTimeline(playKey, paused);
  const wide = variant === "desktop";

  const headP = easeInOutCubic(seg(t, T_HEAD, 480));
  const gaugeP = easeOutCubic(seg(t, T_GAUGE, T_GAUGE_DUR));
  const pct = Math.round(TEAM.readyPct * gaugeP);

  // Arc de jauge. Plus compact en mobile pour laisser de la hauteur au roster.
  const R = wide ? 74 : 52;
  const CIRC = 2 * Math.PI * R;
  const sweep = 0.72; // arc ouvert en bas

  const counts = {
    READY: ROSTER.filter((a) => a.status === "READY").length,
    WATCH: ROSTER.filter((a) => a.status === "WATCH").length,
    RECOVER: ROSTER.filter((a) => a.status === "RECOVER").length,
  };

  const rosterBlock = (
    <div style={{
      display: "grid", gap: wide ? 9 : 7,
      gridTemplateColumns: wide ? "1fr 1fr" : "1fr",
      alignContent: "start",
    }}>
      {ROSTER.map((a, i) => (
        <Row key={a.id} a={a} wide={wide}
          p={easeInOutCubic(seg(t, T_ROWS + i * T_ROW_STEP, T_ROW_DUR))} />
      ))}
    </div>
  );

  const gaugeBlock = (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      opacity: easeInOutCubic(seg(t, T_GAUGE - 200, 420)),
    }}>
      <div style={{ position: "relative", width: (R + 16) * 2, height: (R + 16) * 2 }}>
        <svg width={(R + 16) * 2} height={(R + 16) * 2} style={{ transform: "rotate(140deg)" }}>
          <circle cx={R + 16} cy={R + 16} r={R} fill="none"
            stroke="rgba(255,255,255,0.07)" strokeWidth={9} strokeLinecap="round"
            strokeDasharray={`${CIRC * sweep} ${CIRC}`} />
          <circle cx={R + 16} cy={R + 16} r={R} fill="none"
            stroke={SC.green} strokeWidth={9} strokeLinecap="round"
            strokeDasharray={`${CIRC * sweep * (pct / 100)} ${CIRC}`}
            style={{ filter: `drop-shadow(0 0 9px ${SC.green}88)` }} />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            fontFamily: SC.display, fontSize: wide ? 58 : 50,
            letterSpacing: 1, color: SC.text, lineHeight: 1,
          }}>
            {pct}%
          </div>
          <div style={{ fontSize: 11, color: SC.textMuted, marginTop: 3 }}>in their range</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
        {(["READY", "WATCH", "RECOVER"] as const).map((k, i) => (
          <div key={k} style={{
            textAlign: "center",
            opacity: easeInOutCubic(seg(t, T_GAUGE + 700 + i * 160, 400)),
          }}>
            <div style={{
              fontFamily: SC.display, fontSize: 24, color: STATUS[k].color, lineHeight: 1,
            }}>
              {counts[k]}
            </div>
            <div style={{
              fontSize: 9.5, letterSpacing: 1, color: SC.textMuted, marginTop: 3,
            }}>
              {k}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{
      position: "absolute", inset: 0,
      background: `linear-gradient(180deg, ${SC.bg} 0%, ${SC.bgDeep} 100%)`,
      fontFamily: SC.body, overflow: "hidden",
      // 44 px réservés en haut en mobile : hauteur de la barre d'état.
      padding: wide ? "26px 34px" : "44px 18px 0",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        position: "absolute", top: -140, left: "50%", width: 520, height: 340,
        transform: "translateX(-50%)", pointerEvents: "none",
        background: `radial-gradient(ellipse at center, ${SC.green}14 0%, transparent 70%)`,
      }} />

      {/* En-tête */}
      <div style={{
        opacity: headP, transform: `translateY(${(1 - headP) * 10}px)`,
        paddingTop: wide ? 0 : 10, flexShrink: 0,
      }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: SC.cyan, fontWeight: 500 }}>
          MORNING BRIEF
        </div>
        <div style={{
          fontFamily: SC.display, fontSize: wide ? 40 : 31, letterSpacing: 1,
          color: SC.text, lineHeight: 1.08, marginTop: 3,
        }}>
          {TEAM.date}
        </div>
        <div style={{ fontSize: 12.5, color: SC.textMuted, marginTop: 3 }}>
          {TEAM.responded} of {TEAM.total} athletes checked in
        </div>
        <div style={{
          height: 1, marginTop: 13,
          background: `linear-gradient(90deg, ${SC.cyan}55, transparent)`,
        }} />
      </div>

      {wide ? (
        <div style={{
          display: "grid", gridTemplateColumns: "260px 1fr",
          gap: 30, marginTop: 20, flex: 1, minHeight: 0,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", paddingTop: 12 }}>
            {gaugeBlock}
          </div>
          <div style={{ overflow: "hidden" }}>{rosterBlock}</div>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 12, flexShrink: 0 }}>{gaugeBlock}</div>
          {/* Le roster déborde volontairement : douze athlètes ne tiennent pas
              sur un écran de téléphone, et prétendre le contraire serait faux.
              Le dégradé de bas d'écran signale « la liste continue » au lieu
              de couper un nom en plein milieu, ce qui aurait l'air d'un bug. */}
          <div style={{ position: "relative", marginTop: 14, flex: 1, minHeight: 0 }}>
            <div style={{ overflow: "hidden", height: "100%" }}>{rosterBlock}</div>
            <div style={{
              position: "absolute", left: 0, right: 0, bottom: 0, height: 90,
              pointerEvents: "none",
              background: `linear-gradient(180deg, transparent 0%, ${SC.bgDeep}D9 55%, ${SC.bgDeep} 100%)`,
            }} />
          </div>
        </>
      )}
    </div>
  );
}
