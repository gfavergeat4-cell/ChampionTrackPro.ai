import React, { useEffect, useMemo, useState } from "react";
import { Platform, View, Text } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  collectionGroup,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../services/firebaseConfig";
import { calculateEMA, calculateReadiness } from "../utils/analytics";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  Legend,
} from "recharts";

const CYAN = "#00D4FF";
const BG = "#0A0F1E";
const CARD_BG = "#0D1526";
const CARD_BORDER = "rgba(0,212,255,0.14)";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatDate(ts: any): string {
  if (!ts) return "—";
  const d: Date =
    typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function formatDateShort(ts: any): string {
  if (!ts) return "—";
  const d: Date =
    typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// calculateEMA and calculateReadiness imported from ../utils/analytics

function getMetric(r: any, key: string): number {
  return r?.metrics?.[key] ?? r?.values?.[key] ?? r?.[key] ?? 5;
}

interface SessionRow {
  id: string;
  date: any;
  sessionType: string;
  readinessScore: number;
  workloadAU: number;
  hasFriction: boolean;
  frictionType?: string;
}

export default function AthleteDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    athleteId,
    athleteName: athleteNameProp,
    jerseyNumber: jerseyNumberProp,
    position: positionProp,
    teamId,
    teamName,
    uid,
  } = (route.params || {}) as {
    athleteId?: string;
    athleteName?: string;
    jerseyNumber?: number;
    position?: string;
    teamId?: string;
    teamName?: string;
    uid?: string;
  };

  // Support both param names
  const resolvedUid = uid || athleteId;

  const [athleteName, setAthleteName] = useState<string>(athleteNameProp || "Athlete");
  const [position, setPosition] = useState<string>(positionProp || "");
  const [jerseyNumber, setJerseyNumber] = useState<number | undefined>(jerseyNumberProp);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resolvedUid) {
      setError("No athlete UID provided.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        // Fetch user doc for name/position/jersey
        try {
          const userSnap = await getDoc(doc(db, "users", resolvedUid));
          if (userSnap.exists() && !cancelled) {
            const uData = userSnap.data() as any;
            if (uData.fullName) setAthleteName(uData.fullName);
            else if (uData.displayName) setAthleteName(uData.displayName);
            if (uData.position) setPosition(uData.position);
            if (uData.jerseyNumber != null) setJerseyNumber(Number(uData.jerseyNumber));
          }
        } catch {
          // ignore — use props
        }

        // Query responses collectionGroup where userId == uid AND teamId == teamId
        let q;
        if (teamId) {
          q = query(
            collectionGroup(db, "responses"),
            where("userId", "==", resolvedUid),
            where("teamId", "==", teamId),
            orderBy("submittedAt", "desc"),
            limit(28)
          );
        } else {
          q = query(
            collectionGroup(db, "responses"),
            where("userId", "==", resolvedUid),
            orderBy("submittedAt", "desc"),
            limit(28)
          );
        }

        const snap = await getDocs(q);
        if (!cancelled) {
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setResponses(docs);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [resolvedUid, teamId]);

  // Sorted ASC for trendlines
  const sortedAsc = useMemo(
    () => [...responses].sort((a, b) => (a.submittedAt?.seconds ?? 0) - (b.submittedAt?.seconds ?? 0)),
    [responses]
  );

  // Readiness 7-day average
  const readiness7dAvg = useMemo(() => {
    const recent = sortedAsc.slice(-7);
    if (recent.length === 0) return 0;
    const scores = recent.map((r) => {
      const rs = r.readinessScore ?? calculateReadiness(r?.metrics ?? {});
      return typeof rs === "number" ? rs : 50;
    });
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [sortedAsc]);

  // EMA trendline data (28 days)
  const emaTrendData = useMemo(() => {
    if (sortedAsc.length === 0) return [];
    const scores = sortedAsc.map((r) => {
      const rs = r.readinessScore ?? calculateReadiness(r?.metrics ?? {});
      return typeof rs === "number" ? rs : 50;
    });
    const workloads = sortedAsc.map((r) => r.workloadAU ?? (getMetric(r, "sessionRPE") * 60));
    const ema28 = calculateEMA(scores, 28);
    const ema7 = calculateEMA(workloads, 7);
    const ema28w = calculateEMA(workloads, 28);

    return sortedAsc.map((r, i) => ({
      date: formatDateShort(r.submittedAt),
      acuteLoad: Math.round(ema7[i]),
      chronicLoad: Math.round(ema28w[i]),
      readiness: scores[i],
      ema28: ema28[i],
    }));
  }, [sortedAsc]);

  // Radar data from last session — V3/V2 bridge
  const radarData = useMemo(() => {
    if (sortedAsc.length === 0) return [];
    const r = sortedAsc[sortedAsc.length - 1];
    // V3→V2 bridge: prefer V3 metric key, fall back to V2 key
    const getMetricV3 = (v3key: string, v2key: string): number =>
      r?.metrics?.[v3key] ?? r?.metrics?.[v2key] ?? r?.[v2key] ?? 0;

    const physical  = getMetricV3("legBounce",       "neuroLoad");
    const cardio    = getMetricV3("cardioLoad",       "cardioLoad");
    const sleep     = getMetricV3("tankLevel",        "sleepQuality");
    const stress    = 100 - getMetricV3("teamChemistry", "stressLevel");
    const motor     = getMetricV3("motorControl",     "motorControl");
    const tactical  = getMetricV3("tacticalSharpness","tacticalLucidity");

    return [
      { subject: "Physical",  value: Math.round(physical) },
      { subject: "Cardio",    value: Math.round(cardio) },
      { subject: "Sleep",     value: Math.round(sleep) },
      { subject: "Stress",    value: Math.round(stress) },
      { subject: "Motor",     value: Math.round(motor) },
      { subject: "Tactical",  value: Math.round(tactical) },
    ];
  }, [sortedAsc]);

  // Last 5 sessions
  const last5: SessionRow[] = useMemo(() => {
    return responses.slice(0, 5).map((r) => ({
      id: r.id,
      date: r.submittedAt,
      sessionType: r.sessionType || r.trainingType || "Training",
      readinessScore: r.readinessScore ?? Math.round(calculateReadiness(r?.metrics ?? {})),
      workloadAU: r.workloadAU ?? Math.round(getMetric(r, "sessionRPE") * 60),
      hasFriction: !!(r.hasFriction || r.frictionType || r.pain),
      frictionType: r.frictionType || (r.hasFriction ? "Friction" : undefined),
    }));
  }, [responses]);

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>Athlete detail is optimized for web.</Text>
      </View>
    );
  }

  const initials = getInitials(athleteName);

  // Readiness gauge SVG
  const gaugeRadius = 54;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeProgress = Math.min(readiness7dAvg, 100) / 100;
  const gaugeDash = gaugeCircumference * gaugeProgress;
  const gaugeColor = readiness7dAvg >= 70 ? "#00FF88" : readiness7dAvg >= 45 ? "#FFB800" : "#FF4444";

  const tooltipStyle = {
    backgroundColor: "#0E1528",
    border: "1px solid rgba(0,212,255,0.3)",
    borderRadius: 8,
    color: "#FFFFFF",
    fontSize: 12,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(ellipse at top, #0D1F3C 0%, ${BG} 60%)`,
      backgroundColor: BG,
      color: "#FFFFFF",
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      overflowY: "auto",
    }}>

      {/* Sticky header */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(10,15,30,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${CARD_BORDER}`,
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        <button
          type="button"
          onClick={() => navigation.goBack()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            color: CYAN,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            padding: "6px 10px",
            borderRadius: 8,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.08)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Team
        </button>

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.12)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          {jerseyNumber != null && (
            <div style={{
              minWidth: 28, height: 28, borderRadius: 6,
              background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: CYAN, flexShrink: 0, padding: "0 5px",
            }}>
              #{jerseyNumber}
            </div>
          )}
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: `linear-gradient(135deg, ${CYAN}33, #4A67FF33)`,
            border: "1px solid rgba(0,212,255,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: CYAN, flexShrink: 0,
          }}>
            {initials || "?"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {athleteName}
            </div>
            {position ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{position}</div>
            ) : null}
          </div>
        </div>

        {teamName && (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>{teamName}</div>
        )}
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 100px" }}>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "rgba(255,255,255,0.5)" }}>Loading athlete data...</div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 80, color: "#FCA5A5" }}>{error}</div>
        ) : (
          <>
            {/* Top row: Gauge + Radar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20, marginBottom: 24 }}>

              {/* Readiness Gauge */}
              <div style={{
                background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
                borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                  Readiness Score
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>7-day average</div>

                <svg width={140} height={140} viewBox="0 0 140 140">
                  {/* Background circle */}
                  <circle
                    cx="70" cy="70" r={gaugeRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="12"
                  />
                  {/* Progress arc */}
                  <circle
                    cx="70" cy="70" r={gaugeRadius}
                    fill="none"
                    stroke={gaugeColor}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${gaugeDash} ${gaugeCircumference - gaugeDash}`}
                    strokeDashoffset={gaugeCircumference * 0.25}
                    style={{ transition: "stroke-dasharray 0.6s ease", filter: `drop-shadow(0 0 8px ${gaugeColor}66)` }}
                  />
                  {/* Center text */}
                  <text x="70" y="65" textAnchor="middle" fill="#FFFFFF" fontSize="28" fontWeight="700">
                    {readiness7dAvg}
                  </text>
                  <text x="70" y="85" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="12">
                    / 100
                  </text>
                </svg>

                <div style={{
                  fontSize: 12, fontWeight: 600, color: gaugeColor,
                  background: `${gaugeColor}18`, border: `1px solid ${gaugeColor}44`,
                  borderRadius: 20, padding: "4px 12px",
                }}>
                  {readiness7dAvg >= 70 ? "Optimal" : readiness7dAvg >= 45 ? "Monitor" : "Danger"}
                </div>
              </div>

              {/* Radar Chart */}
              <div style={{
                background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
                borderRadius: 16, padding: 24,
              }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                  Last Session Profile
                </div>
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }} />
                      <Radar name="Score" dataKey="value" stroke={CYAN} fill={CYAN} fillOpacity={0.18} strokeWidth={2} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}`, "Score"]} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.35)", fontSize: 13 }}>No data available</div>
                )}
              </div>
            </div>

            {/* EMA Trendline */}
            <div style={{
              background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
              borderRadius: 16, padding: 24, marginBottom: 24,
            }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Workload Trendline — Last 28 Sessions
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>
                Acute load (7-day EMA) vs Chronic load (28-day EMA)
              </div>
              {emaTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={emaTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="date"
                      stroke="rgba(255,255,255,0.3)"
                      tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                      angle={-30}
                      textAnchor="end"
                      interval="preserveStartEnd"
                    />
                    <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.6)", paddingTop: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="acuteLoad"
                      name="Acute Load (7d EMA)"
                      stroke={CYAN}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="chronicLoad"
                      name="Chronic Load (28d EMA)"
                      stroke="#0066FF"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="5 3"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.35)", fontSize: 13 }}>No session data available</div>
              )}
            </div>

            {/* Last 5 Sessions Table */}
            <div style={{
              background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
              borderRadius: 16, padding: 24,
            }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
                Last 5 Sessions
              </div>
              {last5.length > 0 ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {["Date", "Session Type", "Readiness", "Workload AU", "Friction"].map((h) => (
                          <th key={h} style={{
                            textAlign: "left", padding: "8px 12px",
                            color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600,
                            textTransform: "uppercase", letterSpacing: 0.5,
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {last5.map((s, i) => (
                        <tr
                          key={s.id || i}
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <td style={{ padding: "12px 12px", color: "rgba(255,255,255,0.7)" }}>
                            {formatDate(s.date)}
                          </td>
                          <td style={{ padding: "12px 12px", color: "#FFFFFF", fontWeight: 500 }}>
                            {s.sessionType}
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            <span style={{
                              fontWeight: 700,
                              color: s.readinessScore >= 70 ? "#00FF88" : s.readinessScore >= 45 ? "#FFB800" : "#FF4444",
                            }}>
                              {s.readinessScore}
                            </span>
                          </td>
                          <td style={{ padding: "12px 12px", color: "rgba(255,255,255,0.7)" }}>
                            {s.workloadAU}
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            {s.hasFriction ? (
                              <span style={{
                                fontSize: 11, fontWeight: 600,
                                color: "#FFB800",
                                background: "rgba(255,184,0,0.12)",
                                border: "1px solid rgba(255,184,0,0.3)",
                                borderRadius: 20, padding: "3px 10px",
                              }}>
                                {s.frictionType || "Friction"}
                              </span>
                            ) : (
                              <span style={{ color: "rgba(255,255,255,0.3)" }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.35)", fontSize: 13 }}>No sessions recorded yet</div>
              )}

              {responses.length === 0 && !loading && (
                <div style={{ textAlign: "center", paddingTop: 12, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
                  No responses found for this athlete.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
