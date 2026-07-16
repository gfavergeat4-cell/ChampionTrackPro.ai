import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { getTeamMembers, getTeamMetricsRange, getMyMembership } from "../lib/ctpApi";
import { courtlight as cl } from "../theme/tokens";
import { calculateEMA, calculateDeviation } from "../utils/analytics";
import type { RawResponse } from "../utils/analytics";
import DARPerformanceChart from "../components/DARPerformanceChart";
import { useIsDesktop } from "../hooks/useIsDesktop";
import {
  Line,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type Role = "admin" | "coach";

type DurationKey = "7d" | "14d" | "30d" | "90d";
type CategoryKey = "physical" | "mental" | "technical";
type ViewMode = "categories" | "individual";
type ChartType = "bar" | "deviation" | "workload" | "dar";
type DashTab = "brief" | "analytics";

interface PerformanceDashboardProps {
  route: {
    params?: {
      role?: Role;
      teamId?: string;
      teamName?: string;
      athleteId?: string;
    };
  };
}

// Shape returned by getTeamMembers
interface TeamMember {
  user_id: string;
  role: string;
  jersey_number: number | null;
  pseudonym: string | null;
  profiles: { display_name: string } | null;
}

// Shape returned by getTeamMetricsRange
interface DailyMetricRow {
  id: string;
  user_id: string;
  team_id: string;
  day: string;         // "2026-07-15"
  readiness: number;
  metrics: Record<string, number>;
  z_score: number | null;
  mean_28: number | null;
  sd_28: number | null;
}

// Normalised member for internal use (same keys the rest of the UI expects)
interface Member {
  id: string;
  displayName?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  jerseyNumber?: number;
  role?: string;
}

interface ChartPoint {
  date: string;
  [seriesKey: string]: number | string | null;
}

// ── V3 field definitions ───────────────────────────────────────────────────────
const V3_FIELDS = ["tankLevel", "cardioLoad", "legBounce", "motorControl", "tacticalSharpness", "teamChemistry"] as const;

const V3_LABELS: Record<string, string> = {
  tankLevel:         "Energy Tank",
  cardioLoad:        "Cardio Load *",
  legBounce:         "Leg Bounce",
  motorControl:      "Motor Control",
  tacticalSharpness: "Tactical Sharpness",
  teamChemistry:     "Team Chemistry",
};

const V3_COLORS: Record<string, string> = {
  tankLevel:         "#00D4FF",
  cardioLoad:        "#FF6B6B",
  legBounce:         "#00FF9D",
  motorControl:      "#FFB800",
  tacticalSharpness: "#7B61FF",
  teamChemistry:     "#FF9F43",
};

const CATEGORY_FIELDS: Record<CategoryKey, string[]> = {
  physical:  ["tankLevel", "cardioLoad", "legBounce"],
  mental:    ["teamChemistry"],
  technical: ["motorControl", "tacticalSharpness"],
};

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  physical:  "#00D4FF",
  mental:    "#7B61FF",
  technical: "#00FF9D",
};

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  physical:  "Physical Engine",
  mental:    "Mental Energy",
  technical: "Technical Execution",
};

const DURATION_LABEL: Record<DurationKey, string> = {
  "7d": "7 days",
  "14d": "14 days",
  "30d": "30 days",
  "90d": "3 months",
};

const INDICATOR_LABELS: Record<string, string> = {
  ...V3_LABELS,
  neuroLoad:        "Neuro Load",
  sessionRPE:       "Session RPE",
  sleepQuality:     "Sleep Quality",
  stressLevel:      "Stress Level",
  tacticalLucidity: "Tactical Lucidity",
};

const ALL_INDICATORS_BY_CATEGORY: Record<CategoryKey, string[]> = {
  physical:  ["tankLevel", "cardioLoad", "legBounce"],
  mental:    ["teamChemistry"],
  technical: ["motorControl", "tacticalSharpness"],
};

// ── Quartile helper ───────────────────────────────────────────────────────────
function calcQuartiles(values: number[]): { q1: number; median: number; q3: number } {
  const sorted = [...values].filter((v) => v != null && !isNaN(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return { q1: 0, median: 0, q3: 0 };
  return {
    q1:     sorted[Math.floor(sorted.length * 0.25)],
    median: sorted[Math.floor(sorted.length * 0.50)],
    q3:     sorted[Math.floor(sorted.length * 0.75)],
  };
}

// ── Metric extraction helpers (from daily_metrics.metrics jsonb) ─────────────
function getV3Metric(metrics: Record<string, number> | null | undefined, key: string): number | null {
  if (!metrics || typeof metrics[key] !== "number") return null;
  return metrics[key];
}

function computePhysicalComposite(metrics: Record<string, number> | null | undefined): number | null {
  const tank = getV3Metric(metrics, "tankLevel");
  const leg  = getV3Metric(metrics, "legBounce");
  const card = getV3Metric(metrics, "cardioLoad");
  if (tank == null || leg == null || card == null) return null;
  return Math.round((tank + leg + (101 - card)) / 3);
}

function computeMentalComposite(metrics: Record<string, number> | null | undefined): number | null {
  return getV3Metric(metrics, "teamChemistry");
}

function computeTechnicalComposite(metrics: Record<string, number> | null | undefined): number | null {
  const motor    = getV3Metric(metrics, "motorControl");
  const tactical = getV3Metric(metrics, "tacticalSharpness");
  if (motor == null || tactical == null) return null;
  return Math.round((motor + tactical) / 2);
}

function getDateRangeISO(
  mode: "preset" | "custom",
  durationKey: DurationKey,
  customStart?: string,
  customEnd?: string
): { fromISO: string; toISO: string } {
  if (mode === "custom" && customStart && customEnd) {
    return { fromISO: customStart, toISO: customEnd };
  }
  const days = durationKey === "7d" ? 7 : durationKey === "14d" ? 14 : durationKey === "30d" ? 30 : 90;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    fromISO: start.toISOString().slice(0, 10),
    toISO: end.toISOString().slice(0, 10),
  };
}

// Morning Brief: per-player risk level
function getRiskLevel(score: number, deviation: number): "danger" | "monitor" | "optimal" {
  if (score < 40 || deviation > 20) return "danger";
  if (score < 65 || deviation > 10) return "monitor";
  return "optimal";
}

// ── Convert DailyMetricRow to RawResponse for DARPerformanceChart compatibility
function metricRowToRawResponse(row: DailyMetricRow): RawResponse {
  return {
    userId: row.user_id,
    teamId: row.team_id,
    submittedAt: { seconds: Math.floor(new Date(row.day + "T12:00:00Z").getTime() / 1000) },
    readinessScore: row.readiness,
    metrics: row.metrics as any,
    workloadAU: row.metrics?.sessionRPE != null ? row.metrics.sessionRPE * 60 : undefined,
  };
}

// ──────────────────────────────────────────────────────────────────────────────

export default function PerformanceDashboard({ route }: PerformanceDashboardProps) {
  // Limit to web for Recharts
  if (Platform.OS !== "web") {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: cl.bg.court,
        }}
      >
        <Text style={{ color: "white", fontSize: 16 }}>
          Performance dashboard is available on web only.
        </Text>
      </View>
    );
  }

  const isDesktop = useIsDesktop();
  const role: Role = (route?.params?.role as Role) || "coach";
  const teamNameFromRoute = route?.params?.teamName;

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(() => {
    const t = route?.params?.teamId;
    return typeof t === "string" && t.trim() ? t.trim() : null;
  });

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(() => {
    const aid = route?.params?.athleteId;
    return typeof aid === "string" && aid.trim() ? [aid.trim()] : [];
  });
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

  const [durationMode, setDurationMode] = useState<"preset" | "custom">("preset");
  const [duration, setDuration] = useState<DurationKey>("30d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const [indicatorMode, setIndicatorMode] = useState<"category" | "indicator" | "combined">("category");
  const [category, setCategory] = useState<CategoryKey>("physical");
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>("categories");
  const [chartType, setChartType] = useState<ChartType>("bar");

  const [loadingInit, setLoadingInit] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [metricRows, setMetricRows] = useState<DailyMetricRow[]>([]);
  const [activeTab, setActiveTab] = useState<DashTab>("brief");

  const CYAN = cl.accent.cyan;
  const BG = cl.bg.court;

  // ── Init: resolve teamId from route params or membership ──────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingInit(true);
      try {
        const raw = route?.params?.teamId;
        const teamIdFromParams =
          typeof raw === "string" && raw.trim() ? raw.trim() : null;

        if (role === "coach") {
          let teamId = teamIdFromParams ?? null;
          if (!teamId) {
            const membership = await getMyMembership();
            teamId = membership?.team_id ?? null;
          }
          if (!teamId) {
            throw new Error("No team associated with this coach.");
          }
          if (!cancelled) setSelectedTeamId(teamId);
        } else {
          // admin role — teamId comes from route
          if (teamIdFromParams && !cancelled) setSelectedTeamId(teamIdFromParams);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || String(e));
        }
      } finally {
        if (!cancelled) setLoadingInit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role, route?.params?.teamId]);

  // Re-sync selectedTeamId if route changes (e.g. admin navigating)
  useEffect(() => {
    const raw = route?.params?.teamId;
    const next =
      typeof raw === "string" && raw.trim() ? raw.trim() : null;
    if (role === "admin" && next !== null) {
      setSelectedTeamId((prev) => (prev !== next ? next : prev));
    }
  }, [route?.params?.teamId, role]);

  // ── Load team members via Supabase ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!selectedTeamId) return;

    (async () => {
      try {
        const mems: TeamMember[] = await getTeamMembers(selectedTeamId);
        if (cancelled) return;

        const athletes: Member[] = mems
          .filter((m) => m.role !== "coach")
          .map((m) => ({
            id: m.user_id,
            displayName: m.profiles?.display_name ?? m.pseudonym ?? m.user_id,
            fullName: m.profiles?.display_name ?? m.pseudonym ?? undefined,
            jerseyNumber: m.jersey_number ?? undefined,
            role: m.role,
          }));

        console.log("[PERF][DASH] members loaded:", athletes.length);
        if (!cancelled) setMembers(athletes);
      } catch (e) {
        console.error("[PERF][DASH] load members error", e);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedTeamId]);

  // ── Load daily_metrics for selected period via Supabase ───────────────────
  useEffect(() => {
    let cancelled = false;
    if (!selectedTeamId) return;

    (async () => {
      setLoadingData(true);
      setError(null);
      try {
        const { fromISO, toISO } = getDateRangeISO(
          durationMode,
          duration,
          customStart || undefined,
          customEnd || undefined
        );

        const rows: DailyMetricRow[] = await getTeamMetricsRange(selectedTeamId, fromISO, toISO);
        console.log("[Dashboard] daily_metrics loaded:", rows.length, "| teamId:", selectedTeamId, "| range:", fromISO, "->", toISO);
        if (cancelled) return;

        setMetricRows(rows);
      } catch (e: any) {
        console.error("[PERF][DASH] load metrics error", e);
        if (!cancelled) {
          setError(e?.message || String(e));
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTeamId, durationMode, duration, customStart, customEnd]);

  const positions = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.position && m.position.trim()) set.add(m.position.trim());
    });
    return Array.from(set).sort();
  }, [members]);

  const membersFilteredByPosition = useMemo(() => {
    if (selectedPositions.length === 0) return members;
    return members.filter((m) => m.position && selectedPositions.includes(m.position));
  }, [members, selectedPositions]);

  // ── Derived: convert daily_metrics rows to RawResponse[] for DAR chart ────
  const filteredResponsesForDAR: RawResponse[] = useMemo(() => {
    let rows = metricRows;
    if (selectedPlayerIds.length > 0) {
      const set = new Set(selectedPlayerIds);
      rows = rows.filter((r) => set.has(r.user_id));
    } else if (selectedPositions.length > 0) {
      const positionUids = new Set(membersFilteredByPosition.map((m) => m.id));
      rows = rows.filter((r) => positionUids.has(r.user_id));
    }
    return rows.map(metricRowToRawResponse);
  }, [metricRows, selectedPlayerIds, selectedPositions, membersFilteredByPosition]);

  const filteredMetrics = useMemo(() => {
    if (selectedPlayerIds.length > 0) {
      const set = new Set(selectedPlayerIds);
      return metricRows.filter((r) => set.has(r.user_id));
    }
    if (selectedPositions.length > 0) {
      const positionUids = new Set(membersFilteredByPosition.map((m) => m.id));
      return metricRows.filter((r) => positionUids.has(r.user_id));
    }
    return metricRows;
  }, [metricRows, selectedPlayerIds, selectedPositions, membersFilteredByPosition]);

  const activeFields = useMemo(() => {
    if (indicatorMode === "category") return CATEGORY_FIELDS[category];
    if (indicatorMode === "combined") return [...V3_FIELDS];
    if (selectedIndicators.length > 0) return selectedIndicators;
    return [...V3_FIELDS];
  }, [indicatorMode, category, selectedIndicators]);

  // ── Chart data from daily_metrics ─────────────────────────────────────────
  const chartData: ChartPoint[] = useMemo(() => {
    if (!selectedTeamId || filteredMetrics.length === 0) return [];

    // Group by date then by user
    const byDate: Record<string, { byUser: Record<string, DailyMetricRow[]> }> = {};
    for (const row of filteredMetrics) {
      const dateKey = row.day;
      if (!byDate[dateKey]) byDate[dateKey] = { byUser: {} };
      if (!byDate[dateKey].byUser[row.user_id]) byDate[dateKey].byUser[row.user_id] = [];
      byDate[dateKey].byUser[row.user_id].push(row);
    }

    const dates = Object.keys(byDate).sort();
    const data: ChartPoint[] = [];

    if (viewMode === "individual") {
      const userIdsSet = new Set<string>();
      Object.values(byDate).forEach((e) => Object.keys(e.byUser).forEach((uid) => userIdsSet.add(uid)));
      const userIds = Array.from(userIdsSet);
      for (const dateKey of dates) {
        const entry = byDate[dateKey];
        const point: ChartPoint = { date: dateKey };
        for (const uid of userIds) {
          const list = entry.byUser[uid] || [];
          if (list.length === 0) { point[uid] = null; continue; }
          let sum = 0, count = 0;
          list.forEach((row) => {
            const phy = computePhysicalComposite(row.metrics);
            if (phy != null) { sum += phy; count++; }
          });
          point[uid] = count > 0 ? Math.round(sum / count) : null;
        }
        data.push(point);
      }
      return data;
    }

    if (indicatorMode === "category") {
      for (const dateKey of dates) {
        const rows = Object.values(byDate[dateKey].byUser).flat();
        const point: ChartPoint = { date: dateKey };
        let phySum = 0, phyCount = 0, menSum = 0, menCount = 0, techSum = 0, techCount = 0;
        for (const row of rows) {
          const phy = computePhysicalComposite(row.metrics); if (phy != null) { phySum += phy; phyCount++; }
          const men = computeMentalComposite(row.metrics);   if (men != null) { menSum += men; menCount++; }
          const tec = computeTechnicalComposite(row.metrics); if (tec != null) { techSum += tec; techCount++; }
        }
        point["physical"]  = phyCount  > 0 ? Math.round(phySum  / phyCount)  : null;
        point["mental"]    = menCount  > 0 ? Math.round(menSum  / menCount)   : null;
        point["technical"] = techCount > 0 ? Math.round(techSum / techCount)  : null;
        data.push(point);
      }
      return data;
    }

    // "indicator" or "combined" — raw V3 fields from metrics jsonb
    const fields = indicatorMode === "indicator" && selectedIndicators.length > 0
      ? selectedIndicators
      : [...V3_FIELDS];
    for (const dateKey of dates) {
      const rows = Object.values(byDate[dateKey].byUser).flat();
      const point: ChartPoint = { date: dateKey };
      for (const field of fields) {
        let sum = 0, count = 0;
        for (const row of rows) {
          const v = getV3Metric(row.metrics, field);
          if (v != null) { sum += v; count++; }
        }
        point[field] = count > 0 ? Math.round(sum / count) : null;
      }
      data.push(point);
    }
    return data;
  }, [filteredMetrics, viewMode, selectedTeamId, indicatorMode, selectedIndicators, category]);

  const chartQuartiles = useMemo(() => {
    const allValues: number[] = [];
    for (const point of chartData) {
      for (const [k, v] of Object.entries(point)) {
        if (k !== "date" && typeof v === "number") allValues.push(v);
      }
    }
    return calcQuartiles(allValues);
  }, [chartData]);

  function formatPlayerName(fullName: string, jerseyNumber: number): string {
    const parts = fullName.trim().split(' ');
    const first = parts[0]?.[0] || '';
    const last = parts[parts.length - 1] || '';
    return `${first}. ${last} #${jerseyNumber}`;
  }

  const athleteLabel = (uid: string): string => {
    const m = members.find((x) => x.id === uid);
    if (!m) return uid;
    const name =
      m.fullName ||
      m.displayName ||
      (m.firstName || m.lastName ? `${m.firstName || ""} ${m.lastName || ""}`.trim() : null);
    if (!name) return uid;
    if (m.jerseyNumber != null) return formatPlayerName(name, m.jerseyNumber);
    return name;
  };

  const seriesKeys: string[] = useMemo(() => {
    if (chartData.length === 0) return [];
    const sample = chartData[0];
    return Object.keys(sample).filter((k) => k !== "date");
  }, [chartData]);

  // ─── Morning Brief — per-player readiness from daily_metrics ──────────────
  const morningBriefData = useMemo(() => {
    if (filteredMetrics.length === 0 || members.length === 0) return [];

    // Group by user_id, sorted by day asc
    const byPlayer: Record<string, DailyMetricRow[]> = {};
    const sorted = [...filteredMetrics].sort((a, b) => a.day.localeCompare(b.day));
    for (const row of sorted) {
      if (!byPlayer[row.user_id]) byPlayer[row.user_id] = [];
      byPlayer[row.user_id].push(row);
    }

    return Object.entries(byPlayer).map(([userId, rows]) => {
      const member = members.find((m) => m.id === userId);
      const name = member?.displayName || member?.fullName || userId;
      const latest = rows[rows.length - 1];
      const readinessScore = latest.readiness;

      // Use pre-computed mean_28 from daily_metrics for deviation
      const ema = latest.mean_28 ?? readinessScore;
      const deviation = ema !== 0 ? ((readinessScore - ema) / ema) * 100 : 0;
      const risk = getRiskLevel(readinessScore, Math.abs(deviation));

      // V3 sub-scores from latest response metrics jsonb
      const lm = latest.metrics ?? {};
      const physicalScore = computePhysicalComposite(lm);
      const mentalScore = computeMentalComposite(lm);
      const technicalScore = computeTechnicalComposite(lm);
      const worryFlag = false; // worry_flag lives on responses, not daily_metrics

      return {
        name,
        uid: userId,
        position: member?.position,
        jerseyNumber: member?.jerseyNumber,
        readinessScore,
        ema,
        deviation,
        risk,
        physicalScore,
        mentalScore,
        technicalScore,
        worryFlag,
      };
    }).sort((a, b) => {
      const order = { danger: 0, monitor: 1, optimal: 2 };
      return order[a.risk] - order[b.risk];
    });
  }, [filteredMetrics, members]);

  // ─── Deviation Chart data (readiness vs EMA from daily_metrics) ───────────
  const deviationChartData = useMemo(() => {
    const sorted = [...filteredMetrics].sort((a, b) => a.day.localeCompare(b.day));
    if (sorted.length === 0) return [];

    // Team-average per day
    const byDate: Record<string, { readinessSum: number; emaSum: number; count: number }> = {};
    for (const row of sorted) {
      if (!byDate[row.day]) byDate[row.day] = { readinessSum: 0, emaSum: 0, count: 0 };
      byDate[row.day].readinessSum += row.readiness;
      byDate[row.day].emaSum += (row.mean_28 ?? row.readiness);
      byDate[row.day].count++;
    }

    return Object.keys(byDate).sort().map((day) => {
      const d = byDate[day];
      const avgReadiness = Math.round(d.readinessSum / d.count);
      const avgEma = Math.round(d.emaSum / d.count);
      const deviation = avgEma !== 0 ? parseFloat((((avgReadiness - avgEma) / avgEma) * 100).toFixed(1)) : 0;
      return { date: day, readiness: avgReadiness, ema: avgEma, deviation };
    });
  }, [filteredMetrics]);

  // ─── Workload Chart data (EMA 7d + EMA 28d from metrics.sessionRPE) ──────
  const workloadChartData = useMemo(() => {
    const sorted = [...filteredMetrics].sort((a, b) => a.day.localeCompare(b.day));
    if (sorted.length === 0) return [];

    // Team-level average workload per day
    const byDate: Record<string, number[]> = {};
    for (const row of sorted) {
      const w = row.metrics?.sessionRPE != null ? row.metrics.sessionRPE * 60 : 0;
      if (!byDate[row.day]) byDate[row.day] = [];
      byDate[row.day].push(w);
    }

    const dates = Object.keys(byDate).sort();
    const dailyAvg = dates.map((day) => {
      const vals = byDate[day];
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });

    const ema7 = calculateEMA(dailyAvg, 7);
    const ema28 = calculateEMA(dailyAvg, 28);

    return dates.map((day, i) => ({
      date: day,
      ema7: Math.round(ema7[i]),
      ema28: Math.round(ema28[i]),
      danger: 700,
    }));
  }, [filteredMetrics]);

  // ─── Radar data (6 V3 axes, team average) ────────────────────────────────
  const radarData = useMemo(() => {
    if (filteredMetrics.length === 0) return [];
    const recent = filteredMetrics.slice(-60);
    const avg = (vals: number[]) => vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 50;
    const getVals = (key: string) => recent.map((r) => getV3Metric(r.metrics, key)).filter((v): v is number => v != null);
    return [
      { subject: "Energy Tank",       value: Math.round(avg(getVals("tankLevel"))) },
      { subject: "Cardio Load *",      value: Math.round(101 - avg(getVals("cardioLoad"))) },
      { subject: "Leg Bounce",         value: Math.round(avg(getVals("legBounce"))) },
      { subject: "Motor Control",      value: Math.round(avg(getVals("motorControl"))) },
      { subject: "Tactical Sharp.",    value: Math.round(avg(getVals("tacticalSharpness"))) },
      { subject: "Team Chemistry",     value: Math.round(avg(getVals("teamChemistry"))) },
    ];
  }, [filteredMetrics]);

  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const [openIndicators, setOpenIndicators] = useState(false);

  const togglePlayer = (uid: string) => {
    setSelectedPlayerIds((ids) =>
      ids.includes(uid) ? ids.filter((id) => id !== uid) : [...ids, uid]
    );
  };

  const togglePosition = (pos: string) => {
    setSelectedPositions((arr) =>
      arr.includes(pos) ? arr.filter((p) => p !== pos) : [...arr, pos]
    );
  };

  // ─── Chart Renderer ──────────────────────────────────────────────────────
  const renderChartContent = () => {
    const tooltipStyle = { backgroundColor: cl.surface.card, border: `1px solid ${cl.accent.cyan}`, borderRadius: 8, color: cl.text.hi };
    const xAxisProps = {
      dataKey: "date" as string,
      stroke: "rgba(255,255,255,0.6)",
      tick: { fill: "rgba(255,255,255,0.6)", fontSize: 11 },
      angle: -35,
      textAnchor: "end" as const,
      interval: "preserveStartEnd" as const,
      tickFormatter: (d: string) => { const dt = new Date(d); return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); },
    };
    const gridProps = { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.08)" };
    const margin = { top: 20, right: 30, left: 20, bottom: 60 };

    if (chartType === "deviation") {
      const devVals = deviationChartData.map((d) => d.deviation).filter((v): v is number => typeof v === "number");
      const devQ = calcQuartiles(devVals);
      return (
        <ComposedChart data={deviationChartData} margin={margin}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis stroke="rgba(255,255,255,0.6)" />
          <Tooltip contentStyle={tooltipStyle} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
          {devQ.q1 !== 0 && <ReferenceLine y={devQ.q1} stroke="rgba(33,150,243,0.6)" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Q1", position: "insideTopLeft" as const, fontSize: 10, fill: "rgba(33,150,243,0.8)" }} />}
          {devQ.median !== 0 && <ReferenceLine y={devQ.median} stroke="rgba(0,212,255,0.8)" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Med", position: "insideTopLeft" as const, fontSize: 10, fill: cl.accent.cyan }} />}
          {devQ.q3 !== 0 && <ReferenceLine y={devQ.q3} stroke="rgba(255,184,0,0.6)" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Q3", position: "insideTopLeft" as const, fontSize: 10, fill: "rgba(255,184,0,0.8)" }} />}
          <Bar dataKey="deviation" name="Deviation %" fill={cl.accent.cyan} fillOpacity={0.7} radius={[4, 4, 0, 0] as any} />
          <Line type="monotone" dataKey="ema" name="EMA 28d" stroke={cl.accent.deep} strokeWidth={2} dot={false} strokeDasharray="4 2" />
        </ComposedChart>
      );
    }

    if (chartType === "workload") {
      const wlVals = workloadChartData.map((d) => d.ema7).filter((v): v is number => typeof v === "number");
      const wlQ = calcQuartiles(wlVals);
      return (
        <ComposedChart data={workloadChartData} margin={margin}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis stroke="rgba(255,255,255,0.6)" />
          <Tooltip contentStyle={tooltipStyle} />
          <ReferenceLine y={700} stroke="#FF3B30" strokeDasharray="4 4" label={{ value: "Danger", fill: "#FF3B30", fontSize: 10 }} />
          {wlQ.q1 > 0 && <ReferenceLine y={wlQ.q1} stroke="rgba(33,150,243,0.6)" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Q1", position: "insideTopLeft" as const, fontSize: 10, fill: "rgba(33,150,243,0.8)" }} />}
          {wlQ.median > 0 && <ReferenceLine y={wlQ.median} stroke="rgba(0,212,255,0.8)" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Med", position: "insideTopLeft" as const, fontSize: 10, fill: cl.accent.cyan }} />}
          {wlQ.q3 > 0 && <ReferenceLine y={wlQ.q3} stroke="rgba(255,184,0,0.6)" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Q3", position: "insideTopLeft" as const, fontSize: 10, fill: "rgba(255,184,0,0.8)" }} />}
          <Area type="monotone" dataKey="ema7" name="EMA 7d" stroke={cl.accent.cyan} fill={cl.accent.cyan} fillOpacity={0.12} strokeWidth={2} />
          <Line type="monotone" dataKey="ema28" name="EMA 28d" stroke={cl.accent.deep} strokeWidth={2} dot={false} strokeDasharray="5 3" />
        </ComposedChart>
      );
    }

    return null;
  };

  const filterBoxStyle = {
    background: cl.surface.card,
    borderRadius: cl.radius.card,
    padding: 12,
    border: cl.edge.hair,
  } as const;
  const labelStyle = { fontSize: 12, color: cl.text.low, marginBottom: 6, display: "block" as const };
  const checkboxStyle = { accentColor: CYAN };
  const btnActiveStyle = {
    background: `linear-gradient(135deg, ${cl.accent.cyan}, ${cl.accent.deep})`,
    color: cl.text.hi,
    border: "none",
  };
  const btnInactiveStyle = {
    background: cl.bg.court,
    color: cl.text.mid,
    border: "1px solid rgba(255,255,255,0.2)",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        overflowY: "auto",
        background: cl.bg.vignette,
        backgroundColor: BG,
        color: cl.text.hi,
        padding: 24,
        paddingBottom: 120,
        fontFamily: cl.type.ui,
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: cl.type.weights.semibold as any,
                color: cl.text.hi,
                marginBottom: 4,
                fontFamily: cl.type.brand,
              }}
            >
              Performance Analytics
            </h1>
            {teamNameFromRoute && (
              <p style={{ margin: "2px 0 4px", fontSize: 14, color: cl.accent.cyan, fontWeight: 600 }}>
                {teamNameFromRoute}
              </p>
            )}
            <p style={{ color: cl.text.low, fontSize: 13, margin: 0 }}>
              Questionnaire data visualization by player, category and period.
            </p>
          </div>
        </div>

        {/* ─── Tab bar ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `1px solid rgba(0,212,255,0.15)` }}>
          {([
            { key: "brief" as DashTab, label: "Morning Brief" },
            { key: "analytics" as DashTab, label: "Analytics" },
          ]).map(({ key, label }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  padding: "10px 24px",
                  background: "none",
                  border: "none",
                  borderBottom: active ? `2px solid ${cl.accent.cyan}` : "2px solid transparent",
                  color: active ? cl.accent.cyan : cl.text.low,
                  fontWeight: active ? 700 : 400,
                  fontSize: 14,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  marginBottom: -1,
                  fontFamily: cl.type.ui,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ─── Morning Brief Tab ────────────────────────────────────────── */}
        {activeTab === "brief" && (
          <div>
            {/* Duration filter (compact) */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: cl.text.low, marginRight: 4 }}>Period:</span>
              {(["7d", "14d", "30d", "90d"] as DurationKey[]).map((d) => {
                const active = duration === d && durationMode === "preset";
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setDurationMode("preset"); setDuration(d); }}
                    style={{
                      padding: "5px 12px", borderRadius: cl.radius.halo, fontSize: 12, fontWeight: 600,
                      ...(active ? { background: `linear-gradient(135deg, ${cl.accent.cyan}, ${cl.accent.deep})`, color: cl.text.hi, border: "none" }
                                 : { background: cl.bg.court, color: cl.text.mid, border: "1px solid rgba(255,255,255,0.2)" }),
                      cursor: "pointer",
                      fontFamily: cl.type.ui,
                    }}
                  >
                    {DURATION_LABEL[d]}
                  </button>
                );
              })}
              {/* Full season shortcut */}
              <button
                type="button"
                onClick={() => { setDurationMode("custom"); setCustomStart("2025-10-01"); setCustomEnd("2026-03-10"); }}
                style={{
                  padding: "5px 12px", borderRadius: cl.radius.halo, fontSize: 12, fontWeight: 600,
                  ...(durationMode === "custom" && customStart === "2025-10-01" && customEnd === "2026-03-10"
                    ? { background: `linear-gradient(135deg, ${cl.accent.cyan}, ${cl.accent.deep})`, color: cl.text.hi, border: "none" }
                    : { background: cl.bg.court, color: "rgba(0,212,255,0.7)", border: "1px solid rgba(0,212,255,0.3)" }),
                  cursor: "pointer",
                  fontFamily: cl.type.ui,
                }}
              >
                Full Season
              </button>
            </div>
            {loadingInit || loadingData ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
                <ActivityIndicator color={CYAN} />
                <span style={{ marginLeft: 12, color: cl.text.mid, fontSize: 14 }}>Loading...</span>
              </div>
            ) : morningBriefData.length === 0 ? (
              <div style={{ textAlign: "center" as const, padding: 60, color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
                No readiness data for the selected period.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(
                  [
                    { key: "danger"  as const, emoji: "🔴", label: "DANGER",  threshold: "< 40"  },
                    { key: "monitor" as const, emoji: "🟡", label: "MONITOR", threshold: "40-65" },
                    { key: "optimal" as const, emoji: "🟢", label: "OPTIMAL", threshold: "> 65"  },
                  ] as const
                ).map(({ key, emoji, label, threshold }) => {
                  const group = morningBriefData.filter((p) => p.risk === key);
                  if (group.length === 0) return null;
                  const sectionColor = key === "danger" ? "#FF3B30" : key === "monitor" ? cl.zone.YELLOW : cl.zone.GREEN;
                  return (
                    <div key={key}>
                      {/* Section divider */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        marginTop: 6, marginBottom: 8,
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: sectionColor, letterSpacing: "0.06em" }}>
                          {emoji} {label}
                        </span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.30)" }}>{threshold}</span>
                        <div style={{ flex: 1, height: 1, background: `${sectionColor}30` }} />
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.30)" }}>{group.length} player{group.length > 1 ? "s" : ""}</span>
                      </div>
                      {/* Rows */}
                      {group.map((p) => {
                        const riskColor = sectionColor;
                        const bgColor   = key === "danger" ? "rgba(255,59,48,0.07)" : key === "monitor" ? "rgba(255,184,0,0.07)" : "rgba(0,255,157,0.05)";
                        const borderClr = key === "danger" ? "rgba(255,59,48,0.25)" : key === "monitor" ? "rgba(255,184,0,0.25)" : "rgba(0,255,157,0.2)";
                        const initials  = p.name.split(" ").map((w: string) => w[0] || "").slice(0, 2).join("").toUpperCase();
                        return (
                          <div key={p.uid || p.name} style={{
                            display: "flex", alignItems: "center", gap: 12,
                            background: bgColor,
                            borderRadius: cl.radius.card,
                            padding: "12px 16px",
                            border: `1px solid ${borderClr}`,
                            borderLeft: `4px solid ${riskColor}`,
                            marginBottom: 6,
                          }}>
                            {/* Avatar */}
                            <div style={{
                              width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                              background: `rgba(${key === "danger" ? "255,59,48" : key === "monitor" ? "255,184,0" : "0,212,255"},0.15)`,
                              border: `1.5px solid ${riskColor}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 700, color: riskColor,
                            }}>
                              {initials}
                            </div>
                            {/* Name + position + jersey */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: cl.text.hi, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {p.name}
                                </span>
                                {p.jerseyNumber != null && (
                                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>#{p.jerseyNumber}</span>
                                )}
                                {p.worryFlag && (
                                  <span title="Worry flag raised" style={{ fontSize: 13, flexShrink: 0 }}>⚠️</span>
                                )}
                              </div>
                              {p.position && (
                                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 1 }}>{p.position}</div>
                              )}
                              {/* Sub-scores */}
                              {(p.physicalScore != null || p.mentalScore != null || p.technicalScore != null) && (
                                <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
                                  {p.physicalScore != null && (
                                    <span style={{ fontSize: 10, color: cl.accent.cyan, fontFamily: cl.type.mono }}>
                                      PHY {p.physicalScore}
                                    </span>
                                  )}
                                  {p.mentalScore != null && (
                                    <span style={{ fontSize: 10, color: "#00FF88", fontFamily: cl.type.mono }}>
                                      MEN {p.mentalScore}
                                    </span>
                                  )}
                                  {p.technicalScore != null && (
                                    <span style={{ fontSize: 10, color: "#A855F7", fontFamily: cl.type.mono }}>
                                      TEC {p.technicalScore}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* EMA + deviation */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, minWidth: 64 }}>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>EMA {Math.round(p.ema)}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: p.deviation > 0 ? "#FF3B30" : cl.zone.GREEN }}>
                                {p.deviation > 0 ? "+" : ""}{p.deviation.toFixed(0)}%
                              </span>
                            </div>
                            {/* Readiness score circle */}
                            <div style={{
                              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                              background: riskColor,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 13, fontWeight: 800, color: "#000",
                            }}>
                              {p.readinessScore}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Analytics Tab ────────────────────────────────────────────── */}
        {activeTab === "analytics" && (<>

        {/* Filters */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(200px, 1fr))" : "1fr",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {/* Players (multi-select) */}
          <div style={{ ...filterBoxStyle, position: "relative", zIndex: showPlayerDropdown ? 100 : 1 }}>
            <span style={labelStyle}>Players</span>
            <button
              type="button"
              onClick={() => { setShowPositionDropdown(false); setOpenIndicators(false); setShowPlayerDropdown((v) => !v); }}
              style={{
                width: "100%",
                background: cl.surface.card,
                border: cl.edge.hair,
                borderRadius: cl.radius.control,
                padding: "10px 14px",
                cursor: "pointer",
                color: cl.text.hi,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 14,
                fontFamily: cl.type.ui,
              }}
            >
              <span>
                {selectedPlayerIds.length === 0
                  ? "All Players"
                  : `${selectedPlayerIds.length} player(s) selected`}
              </span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{showPlayerDropdown ? "▲" : "▼"}</span>
            </button>
            {showPlayerDropdown && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  background: cl.surface.card,
                  border: `1px solid rgba(0,212,255,0.3)`,
                  borderRadius: cl.radius.control,
                  maxHeight: 260,
                  overflowY: "auto",
                  marginTop: 4,
                }}
              >
                <div
                  onClick={() => setSelectedPlayerIds([])}
                  style={{ padding: "10px 14px", cursor: "pointer", color: selectedPlayerIds.length === 0 ? CYAN : cl.text.hi, display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input type="checkbox" checked={selectedPlayerIds.length === 0} readOnly style={checkboxStyle} />
                  All Players
                </div>
                {membersFilteredByPosition.map((m) => {
                  const playerName = m.fullName || m.displayName || m.id;
                  const label = m.jerseyNumber != null
                    ? formatPlayerName(playerName, m.jerseyNumber) + (m.position ? ` — ${m.position}` : "")
                    : playerName + (m.position ? ` — ${m.position}` : "");
                  return (
                    <div
                      key={m.id}
                      onClick={() => togglePlayer(m.id)}
                      style={{ padding: "10px 14px", cursor: "pointer", color: selectedPlayerIds.includes(m.id) ? CYAN : cl.text.hi, display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <input type="checkbox" checked={selectedPlayerIds.includes(m.id)} readOnly style={checkboxStyle} />
                      {label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Position (multi-select) */}
          <div style={{ ...filterBoxStyle, position: "relative", zIndex: showPositionDropdown ? 100 : 1 }}>
            <span style={labelStyle}>Position</span>
            <button
              type="button"
              onClick={() => { setShowPlayerDropdown(false); setOpenIndicators(false); setShowPositionDropdown((v) => !v); }}
              style={{
                width: "100%",
                background: cl.surface.card,
                border: cl.edge.hair,
                borderRadius: cl.radius.control,
                padding: "10px 14px",
                cursor: "pointer",
                color: cl.text.hi,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 14,
                fontFamily: cl.type.ui,
              }}
            >
              <span>{selectedPositions.length === 0 ? "All Positions" : `${selectedPositions.length} position(s)`}</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{showPositionDropdown ? "▲" : "▼"}</span>
            </button>
            {showPositionDropdown && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  background: cl.surface.card,
                  border: `1px solid rgba(0,212,255,0.3)`,
                  borderRadius: cl.radius.control,
                  maxHeight: 220,
                  overflowY: "auto",
                  marginTop: 4,
                }}
              >
                <div
                  onClick={() => setSelectedPositions([])}
                  style={{ padding: "10px 14px", cursor: "pointer", color: selectedPositions.length === 0 ? CYAN : cl.text.hi, display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input type="checkbox" checked={selectedPositions.length === 0} readOnly style={checkboxStyle} />
                  All Positions
                </div>
                {positions.map((p) => (
                  <div
                    key={p}
                    onClick={() => togglePosition(p)}
                    style={{ padding: "10px 14px", cursor: "pointer", color: selectedPositions.includes(p) ? CYAN : cl.text.hi, display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <input type="checkbox" checked={selectedPositions.includes(p)} readOnly style={checkboxStyle} />
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Duration */}
          <div style={filterBoxStyle}>
            <label style={labelStyle}>Duration</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setDurationMode("preset")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: cl.radius.halo,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(durationMode === "preset" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
                  fontFamily: cl.type.ui,
                }}
              >
                Preset Period
              </button>
              <button
                type="button"
                onClick={() => setDurationMode("custom")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: cl.radius.halo,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(durationMode === "custom" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
                  fontFamily: cl.type.ui,
                }}
              >
                Custom Dates
              </button>
            </div>
            {durationMode === "preset" ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["7d", "14d", "30d", "90d"] as DurationKey[]).map((d) => {
                  const active = duration === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: cl.radius.halo,
                        fontSize: 12,
                        fontWeight: 600,
                        ...(active ? btnActiveStyle : btnInactiveStyle),
                        cursor: "pointer",
                        fontFamily: cl.type.ui,
                      }}
                    >
                      {DURATION_LABEL[d]}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => { setDurationMode("custom"); setCustomStart("2025-10-01"); setCustomEnd("2026-03-31"); }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: cl.radius.halo,
                    fontSize: 12,
                    fontWeight: 600,
                    ...(durationMode !== "preset" && customStart === "2025-10-01" ? btnActiveStyle : { ...btnInactiveStyle, color: "rgba(0,212,255,0.7)", border: "1px solid rgba(0,212,255,0.3)" }),
                    cursor: "pointer",
                    fontFamily: cl.type.ui,
                  }}
                >
                  Full Season
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: cl.radius.control,
                      border: "1px solid rgba(0,212,255,0.2)",
                      background: cl.surface.card,
                      color: cl.text.hi,
                      fontSize: 14,
                      colorScheme: "dark",
                    }}
                  />
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: cl.radius.control,
                    border: "1px solid rgba(0,212,255,0.2)",
                    background: cl.surface.card,
                    color: cl.text.hi,
                    fontSize: 14,
                    colorScheme: "dark",
                  }}
                />
              </div>
            )}
          </div>

          {/* Indicators */}
          <div style={{ ...filterBoxStyle, position: "relative", gridColumn: "span 1" }}>
            <label style={labelStyle}>Indicators</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => { setIndicatorMode("category"); setOpenIndicators(false); }}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: cl.radius.halo,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(indicatorMode === "category" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
                  fontFamily: cl.type.ui,
                }}
              >
                By Category
              </button>
              <button
                type="button"
                onClick={() => { setIndicatorMode("combined"); setOpenIndicators(false); }}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: cl.radius.halo,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(indicatorMode === "combined" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
                  fontFamily: cl.type.ui,
                }}
              >
                Combined
              </button>
              <button
                type="button"
                onClick={() => setIndicatorMode("indicator")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: cl.radius.halo,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(indicatorMode === "indicator" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
                  fontFamily: cl.type.ui,
                }}
              >
                By Indicator
              </button>
            </div>
            {indicatorMode === "category" ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["physical", "mental", "technical"] as CategoryKey[]).map((c) => {
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: cl.radius.halo,
                        fontSize: 12,
                        fontWeight: 600,
                        ...(active ? { ...btnActiveStyle, color: cl.text.hi } : btnInactiveStyle),
                        border: active ? "none" : "1px solid rgba(255,255,255,0.2)",
                        cursor: "pointer",
                        fontFamily: cl.type.ui,
                      }}
                    >
                      {CATEGORY_LABEL[c]}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setOpenIndicators((v) => !v)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: cl.radius.control,
                    border: "1px solid rgba(0,212,255,0.2)",
                    background: cl.surface.card,
                    color: cl.text.hi,
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: cl.type.ui,
                  }}
                >
                  {selectedIndicators.length === 0 ? "All" : `${selectedIndicators.length} indicator(s) selected`}
                </button>
                {openIndicators && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      padding: 8,
                      background: cl.surface.card,
                      border: "1px solid rgba(0,212,255,0.2)",
                      borderRadius: cl.radius.control,
                      zIndex: 10,
                      maxHeight: 320,
                      overflowY: "auto",
                    }}
                  >
                    {(Object.keys(ALL_INDICATORS_BY_CATEGORY) as CategoryKey[]).map((cat) => (
                      <div key={cat} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: CATEGORY_COLORS[cat], marginBottom: 6 }}>
                          {cat === "physical" && "Physical"}
                          {cat === "mental" && "Mental"}
                          {cat === "technical" && "Technical"}
                        </div>
                        {ALL_INDICATORS_BY_CATEGORY[cat].map((key) => {
                          const checked = selectedIndicators.includes(key);
                          return (
                            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", color: cl.text.hi, cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  if (checked) setSelectedIndicators((arr) => arr.filter((x) => x !== key));
                                  else setSelectedIndicators((arr) => [...arr, key]);
                                }}
                                style={checkboxStyle}
                              />
                              {INDICATOR_LABELS[key] || key}
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* View Mode + Chart Type */}
          <div style={filterBoxStyle}>
            <label style={labelStyle}>View Mode</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {(["categories", "individual"] as ViewMode[]).map((m) => {
                const active = viewMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setViewMode(m)}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: cl.radius.halo,
                      fontSize: 12,
                      fontWeight: 600,
                      ...(active ? btnActiveStyle : btnInactiveStyle),
                      cursor: "pointer",
                      fontFamily: cl.type.ui,
                    }}
                  >
                    {m === "categories" ? "Categories" : "Individual"}
                  </button>
                );
              })}
            </div>
            <label style={labelStyle}>Chart Type</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {([
                { key: "bar",       label: "Bar" },
                { key: "deviation", label: "Deviation" },
                { key: "workload",  label: "Workload" },
                { key: "dar",       label: "DAR" },
              ] as { key: ChartType; label: string }[]).map(({ key, label }) => {
                const active = chartType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setChartType(key)}
                    style={{
                      flex: "1 1 auto",
                      padding: "6px 8px",
                      borderRadius: cl.radius.halo,
                      fontSize: 11,
                      fontWeight: 600,
                      ...(active ? btnActiveStyle : btnInactiveStyle),
                      cursor: "pointer",
                      fontFamily: cl.type.ui,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>


        <div
          style={{
            background: cl.surface.card,
            borderRadius: cl.radius.card,
            padding: 20,
            border: cl.edge.hair,
            boxShadow: cl.shadow.e1,
          }}
        >
          {loadingInit || loadingData ? (
            <div
              style={{
                height: 320,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={CYAN} />
              <span
                style={{
                  marginLeft: 12,
                  color: cl.text.mid,
                  fontSize: 14,
                }}
              >
                Loading data...
              </span>
            </div>
          ) : !selectedTeamId ? (
            <div
              style={{
                minHeight: 160,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#F87171",
                fontSize: 14,
              }}
            >
              No team selected
            </div>
          ) : error ? (
            <div
              style={{
                minHeight: 160,
                color: "#F87171",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          ) : chartType === "dar" ? (
            /* DAR Algorithm View */
            <DARPerformanceChart
              filteredResponses={filteredResponsesForDAR}
              members={members}
              selectedPlayerIds={selectedPlayerIds}
            />
          ) : chartData.length === 0 ? (
            <div
              style={{
                minHeight: 160,
                color: cl.text.mid,
                fontSize: 14,
              }}
            >
              No data for the selected period.
            </div>
          ) : (
            <div style={{ minHeight: 400, marginBottom: 16 }}>
              {(chartType === "deviation" || chartType === "workload") ? (
                <ResponsiveContainer width="100%" height={360}>
                  {renderChartContent() as React.ReactElement}
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={chartData} margin={{ top: 20, right: 40, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} stroke="rgba(255,255,255,0.6)" />
                    <Tooltip contentStyle={{ backgroundColor: cl.surface.card, border: `1px solid rgba(0,212,255,0.25)`, borderRadius: 8, color: cl.text.hi, fontFamily: cl.type.ui, fontSize: 12 }} formatter={(v: any, name: string) => [`${v}/100`, name]} />
                    {chartQuartiles.q1 > 0 && <ReferenceLine y={chartQuartiles.q1} stroke="rgba(33,150,243,0.6)" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Q1", position: "insideTopLeft" as const, fontSize: 10, fill: "rgba(33,150,243,0.8)" }} />}
                    {chartQuartiles.median > 0 && <ReferenceLine y={chartQuartiles.median} stroke="rgba(0,212,255,0.8)" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Med", position: "insideTopLeft" as const, fontSize: 10, fill: cl.accent.cyan }} />}
                    {chartQuartiles.q3 > 0 && <ReferenceLine y={chartQuartiles.q3} stroke="rgba(255,184,0,0.6)" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Q3", position: "insideTopLeft" as const, fontSize: 10, fill: "rgba(255,184,0,0.8)" }} />}
                    {seriesKeys.map((k, idx) => {
                      const palette = [cl.accent.cyan,"#00FF88","#A855F7","#FFB800","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4"];
                      const color = viewMode === "individual" ? palette[idx % palette.length]
                        : indicatorMode === "category" ? (CATEGORY_COLORS[k as CategoryKey] || palette[idx % palette.length])
                        : (V3_COLORS[k] || palette[idx % palette.length]);
                      const name = viewMode === "individual" ? athleteLabel(k)
                        : indicatorMode === "category" ? (CATEGORY_LABEL[k as CategoryKey] || k)
                        : (V3_LABELS[k] || INDICATOR_LABELS[k] || k);
                      return <Bar key={k} dataKey={k} name={name} fill={color} radius={[6, 6, 0, 0]} />;
                    })}
                  </BarChart>
                </ResponsiveContainer>
              )}
              {/* Custom legend */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", padding: "16px 20px 4px", justifyContent: "center" }}>
                {seriesKeys.map((k, idx) => {
                  const palette = [cl.accent.cyan,"#00FF88","#A855F7","#FFB800","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4"];
                  const color = viewMode === "individual" ? palette[idx % palette.length]
                    : indicatorMode === "category" ? (CATEGORY_COLORS[k as CategoryKey] || palette[idx % palette.length])
                    : (V3_COLORS[k] || palette[idx % palette.length]);
                  const label = viewMode === "individual" ? athleteLabel(k)
                    : indicatorMode === "category" ? (CATEGORY_LABEL[k as CategoryKey] || k)
                    : (V3_LABELS[k] || INDICATOR_LABELS[k] || k);
                  return (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: cl.text.mid }}>{label}</span>
                    </div>
                  );
                })}
              </div>
              {(indicatorMode === "indicator" || indicatorMode === "combined") && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", textAlign: "center" as const, marginTop: 4 }}>
                  * Cardio Load: lower = better (fatigue metric)
                </div>
              )}
            </div>
          )}
        </div>
        </>)}
      </div>
    </div>
  );
}
