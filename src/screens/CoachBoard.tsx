// CoachBoard.tsx — Lecture coach multi-marqueurs (méthode DAR, partie 3).
//
// Trois principes repris du texte de Morin, et qui expliquent chaque choix
// d'affichage de cet écran :
//
//  1. « Chaque série possède sa propre tendance, sa zone de variations
//     habituelles (±10) et ses zones d'écart. » -> trois marqueurs lus
//     séparément, jamais fondus en un seul chiffre.
//  2. « On lit la couleur ET la courbe. » -> chaque marqueur affiche sa zone
//     ET la direction de sa tendance sur 7 jours.
//  3. « Toute tentative de normalisation interindividuelle constitue une
//     erreur méthodologique. » -> pas de moyenne d'équipe. L'équipe se lit
//     en DISTRIBUTION : combien d'athlètes dans chaque zone.
//
// Cet écran DÉCRIT. Il ne recommande rien : « seul l'entraîneur peut
// interpréter » (DAR partie 3, §E) — et la table `rules` appartient au
// fondateur (Constitution art. 2).
//
// Langage visuel : celui du check-in athlète (cartes #141A24, liseré cyan).
import React from "react";
import { Platform, View, Text, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getMyMembership, getCoachBoard } from "../lib/ctpApi";
import type { AthleteBoardRow, AxisReading, Axis, Zone } from "../lib/ctpApi";
import { useIsDesktop } from "../hooks/useIsDesktop";

const C = {
  bgTop: "#0B0F1A", bgBottom: "#020409",
  card: "#141A24", ring: "rgba(0,224,255,0.10)",
  accent: "#00E0FF",
  textHi: "rgba(255,255,255,0.9)",
  textMid: "rgba(154,163,178,0.7)",
  textLow: "rgba(154,163,178,0.45)",
};

// Couleurs de zone — sacrées, jamais décoratives (doc 06).
const ZONE: Record<Zone, { c: string; label: string }> = {
  YELLOW:            { c: "#FFB800", label: "Above usual" },
  GREEN:             { c: "#00C853", label: "Usual" },
  BLUE:              { c: "#2196F3", label: "Below usual" },
  INSUFFICIENT_DATA: { c: "rgba(154,163,178,0.35)", label: "Not enough data" },
};

const AXES: { key: Axis; short: string; full: string }[] = [
  { key: "PHY", short: "PHY", full: "Physical" },
  { key: "TEC", short: "TEC", full: "Technical" },
  { key: "MEN", short: "MEN", full: "Mental" },
];

/**
 * Configurations décrites par Morin (partie 3, §8). Détection purement
 * arithmétique — on nomme un motif, on n'en tire aucune conclusion.
 */
function pattern(row: AthleteBoardRow): { label: string; hint: string } | null {
  const z = (a: Axis) => row.axes[a]?.zone;
  const phy = z("PHY"), tec = z("TEC"), men = z("MEN");
  if (!phy || !tec || !men) return null;

  if (phy === tec && tec === men && phy !== "GREEN" && phy !== "INSUFFICIENT_DATA") {
    return { label: "Converging", hint: "All three markers moved the same way." };
  }
  if (tec === "YELLOW" && phy === "GREEN") {
    return { label: "Technical only", hint: "Technical demand up, physical load as usual." };
  }
  if (men === "YELLOW" && phy === "GREEN" && tec === "GREEN") {
    return { label: "Mental only", hint: "Mental cost up while training load is unchanged." };
  }
  return null;
}

function Dot({ zone, size = 9 }: { zone: Zone; size?: number }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: 999,
      background: ZONE[zone].c, flexShrink: 0,
      boxShadow: zone === "INSUFFICIENT_DATA" ? "none" : `0 0 8px ${ZONE[zone].c}66`,
    }} />
  );
}

function TrendArrow({ v }: { v: number | null }) {
  if (v === null || Math.abs(v) < 1.5) {
    return <span style={{ color: C.textLow, fontSize: 13 }}>→</span>;
  }
  return (
    <span style={{ color: C.textMid, fontSize: 13 }}>{v > 0 ? "↗" : "↘"}</span>
  );
}

function Marker({ reading }: { reading?: AxisReading }) {
  if (!reading) {
    return <div style={{ minWidth: 74 }}><span style={{ color: C.textLow, fontSize: 13 }}>—</span></div>;
  }
  const d = reading.deltaPoints;
  return (
    <div style={{ minWidth: 74, display: "flex", alignItems: "center", gap: 6 }}>
      <Dot zone={reading.zone} />
      <span style={{
        fontSize: 14, fontVariantNumeric: "tabular-nums",
        color: reading.zone === "GREEN" ? C.textMid : ZONE[reading.zone].c,
      }}>
        {d === null ? "—" : `${d > 0 ? "+" : ""}${d}`}
      </span>
      <TrendArrow v={reading.trend7d} />
    </div>
  );
}

export default function CoachBoard() {
  const navigation = useNavigation<any>();
  const isDesktop = useIsDesktop();
  const [rows, setRows] = React.useState<AthleteBoardRow[]>([]);
  const [teamName, setTeamName] = React.useState("");
  const [teamId, setTeamId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m: any = await getMyMembership();
        if (!m?.team_id) throw new Error("No team linked to your account.");
        if (!cancelled) { setTeamId(m.team_id); setTeamName(m.teams?.name ?? "My team"); }
        const today = new Date().toISOString().slice(0, 10);
        const data = await getCoachBoard(m.team_id, today);
        if (!cancelled) setRows(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: C.bgTop, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>Team board is optimized for web.</Text>
      </View>
    );
  }

  const responded = rows.filter((r) => r.responded).length;

  // Distribution par axe — l'agrégat d'équipe autorisé par la méthode.
  const distribution = AXES.map(({ key, short, full }) => {
    const counts: Record<Zone, number> = {
      YELLOW: 0, GREEN: 0, BLUE: 0, INSUFFICIENT_DATA: 0,
    };
    rows.forEach((r) => { const z = r.axes[key]?.zone; if (z) counts[z]++; });
    return { key, short, full, counts };
  });

  const page: React.CSSProperties = {
    minHeight: "100vh",
    background: `linear-gradient(to bottom, ${C.bgTop}, ${C.bgBottom})`,
    color: C.textHi,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    padding: isDesktop ? "36px 40px 100px" : "24px 16px 100px",
  };

  const card: React.CSSProperties = {
    background: C.card, borderRadius: 16,
    boxShadow: `inset 0 0 0 1px ${C.ring}`, padding: 18,
  };

  return (
    <div style={page}>
      <div style={{ maxWidth: isDesktop ? 900 : 460, margin: "0 auto" }}>

        <header style={{ marginBottom: 22 }}>
          <div style={{
            fontFamily: "'Marcellus', serif", fontSize: 13,
            letterSpacing: "0.22em", color: C.textMid, marginBottom: 6,
          }}>{teamName.toUpperCase()}</div>
          <h1 style={{ fontSize: 26, fontWeight: 500, margin: 0 }}>Today</h1>
          <p style={{ fontSize: 14, color: C.textMid, margin: "4px 0 0" }}>
            {responded} of {rows.length} checked in
          </p>
        </header>

        {loading ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", padding: 60 }}>
            <ActivityIndicator color={C.accent} />
            <span style={{ color: C.textMid, fontSize: 14 }}>Loading…</span>
          </div>
        ) : error ? (
          <div style={{ ...card, color: "#FCA5A5", fontSize: 14 }}>{error}</div>
        ) : (
          <>
            {/* ── Distribution : l'équipe se lit en répartition, pas en moyenne ── */}
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{
                fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
                color: C.textLow, marginBottom: 14,
              }}>Where the group sits today</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {distribution.map(({ key, full, counts }) => {
                  const total = counts.YELLOW + counts.GREEN + counts.BLUE;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 78, fontSize: 13, color: C.textMid }}>{full}</div>
                      <div style={{
                        flex: 1, display: "flex", height: 10, borderRadius: 999,
                        overflow: "hidden", background: "rgba(255,255,255,0.05)",
                      }}>
                        {(["BLUE", "GREEN", "YELLOW"] as Zone[]).map((z) =>
                          counts[z] > 0 ? (
                            <div key={z} title={`${counts[z]} ${ZONE[z].label}`}
                                 style={{ width: `${(counts[z] / Math.max(total, 1)) * 100}%`, background: ZONE[z].c }} />
                          ) : null
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 10, fontSize: 13, fontVariantNumeric: "tabular-nums", minWidth: 96 }}>
                        <span style={{ color: ZONE.BLUE.c }}>{counts.BLUE}</span>
                        <span style={{ color: ZONE.GREEN.c }}>{counts.GREEN}</span>
                        <span style={{ color: ZONE.YELLOW.c }}>{counts.YELLOW}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p style={{ fontSize: 11, color: C.textLow, margin: "14px 0 0", lineHeight: 1.6 }}>
                Below usual · Usual · Above usual. Each athlete is compared to their own
                28-day baseline — never to a teammate.
              </p>
            </div>

            {/* ── Roster ── */}
            <div style={{ ...card }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 12, paddingBottom: 12,
                borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 4,
              }}>
                <div style={{ flex: 1, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: C.textLow }}>
                  Athlete
                </div>
                {AXES.map((a) => (
                  <div key={a.key} style={{
                    minWidth: 74, fontSize: 10, letterSpacing: "0.16em",
                    textTransform: "uppercase", color: C.textLow,
                  }}>{a.short}</div>
                ))}
              </div>

              {rows.map((r) => {
                const p = pattern(r);
                return (
                  <div
                    key={r.userId}
                    onClick={() => teamId && navigation.navigate("AthleteDetail", {
                      teamId, teamName, athleteId: r.userId, athleteName: r.name,
                      jerseyNumber: r.jerseyNumber, position: r.position,
                    })}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 0", cursor: "pointer",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      opacity: r.responded ? 1 : 0.45,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, color: C.textHi, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.jerseyNumber != null ? `${r.jerseyNumber}. ` : ""}{r.name}
                      </div>
                      {!r.responded ? (
                        <div style={{ fontSize: 12, color: C.textLow, marginTop: 2 }}>No check-in yet</div>
                      ) : p ? (
                        <div style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>
                          <span style={{ color: C.accent }}>{p.label}</span> · {p.hint}
                        </div>
                      ) : null}
                    </div>
                    {AXES.map((a) => <Marker key={a.key} reading={r.axes[a.key]} />)}
                  </div>
                );
              })}

              {rows.length === 0 ? (
                <div style={{ color: C.textLow, fontSize: 14, padding: 30, textAlign: "center" }}>
                  No athletes in this team yet.
                </div>
              ) : null}
            </div>

            <p style={{
              fontSize: 11, color: C.textLow, lineHeight: 1.7,
              margin: "18px 0 0", textAlign: "center", maxWidth: 560, marginInline: "auto",
            }}>
              Numbers are the gap to each athlete's own baseline, in points.
              The arrow is where their 28-day trend is heading.
              A colour on its own means nothing — read the colour and the arrow together,
              then talk to the player.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
