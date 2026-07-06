import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { calculateEMA, calculateDeviation, calculateReadiness, extractV2Metrics } from "../utils/analytics";
import type { V2Metrics, RawResponse } from "../utils/analytics";
import DARPerformanceChart from "../components/DARPerformanceChart";
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

interface Team {
  id: string;
  name?: string;
}

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

// V2Metrics and RawResponse imported from ../utils/analytics

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

const INDICATOR_COLORS: Record<CategoryKey, string[]> = {
  physical:  ["#00D4FF", "#FF6B6B", "#00FF9D"],
  mental:    ["#7B61FF"],
  technical: ["#FFB800", "#7B61FF"],
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
  // legacy
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

// ── V3 metric extraction helpers ──────────────────────────────────────────────
function getV3Metric(r: RawResponse, key: string): number | null {
  const m = (r as any).metrics;
  if (m && typeof m[key] === "number") return m[key];
  if (typeof (r as any)[key] === "number") return (r as any)[key];
  return null;
}

function computePhysicalComposite(r: RawResponse): number | null {
  const tank = getV3Metric(r, "tankLevel");
  const leg  = getV3Metric(r, "legBounce");
  const card = getV3Metric(r, "cardioLoad");
  if (tank == null || leg == null || card == null) return null;
  return Math.round((tank + leg + (101 - card)) / 3);
}

function computeMentalComposite(r: RawResponse): number | null {
  return getV3Metric(r, "teamChemistry");
}

function computeTechnicalComposite(r: RawResponse): number | null {
  const motor    = getV3Metric(r, "motorControl");
  const tactical = getV3Metric(r, "tacticalSharpness");
  if (motor == null || tactical == null) return null;
  return Math.round((motor + tactical) / 2);
}

function getDateRangeFromKey(key: DurationKey): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  const days = key === "7d" ? 7 : key === "14d" ? 14 : key === "30d" ? 30 : 90;
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getDateRange(
  mode: "preset" | "custom",
  durationKey: DurationKey,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date } {
  if (mode === "custom" && customStart && customEnd) {
    const start = new Date(customStart);
    const end = new Date(customEnd);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) return { start, end };
  }
  return getDateRangeFromKey(durationKey);
}

function formatDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getMetricValue(resp: RawResponse, key: string): number | null {
  const flat = (resp as any)[key];
  if (typeof flat === "number") return flat;
  if (resp.values && typeof resp.values[key] === "number") return resp.values[key] as number;
  if (resp.metrics && typeof (resp.metrics as any)[key] === "number") return (resp.metrics as any)[key];
  return null;
}

// Morning Brief: per-player latest readiness
function getRiskLevel(score: number, deviation: number): "danger" | "monitor" | "optimal" {
  if (score < 40 || deviation > 20) return "danger";
  if (score < 65 || deviation > 10) return "monitor";
  return "optimal";
}

export default function PerformanceDashboard({ route }: PerformanceDashboardProps) {
  // Limiter aux plateformes web pour Recharts
  if (Platform.OS !== "web") {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0A0F1E",
        }}
      >
        <Text style={{ color: "white", fontSize: 16 }}>
          Performance dashboard is available on web only.
        </Text>
      </View>
    );
  }

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

  const [responses, setResponses] = useState<RawResponse[]>([]);
  const [activeTab, setActiveTab] = useState<DashTab>("brief");

  const CYAN = "#00D4FF";
  const BG = "#0A0F1E";

  // Initialisation : teamId fixé par les props (admin) ou résolu depuis l'utilisateur (coach)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingInit(true);
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error("User not authenticated");
        }

        const raw = route?.params?.teamId;
        const teamIdFromParams =
          typeof raw === "string" && raw.trim() ? raw.trim() : null;

        if (role === "coach") {
          let teamId = teamIdFromParams ?? null;
          if (!teamId) {
            const userSnap = await getDoc(doc(db, "users", user.uid));
            const data = userSnap.data() || {};
            teamId = data.teamId || null;
          }
          if (!teamId) {
            const teamsSnap = await getDocs(collection(db, "teams"));
            for (const d of teamsSnap.docs) {
              const data = d.data() as any;
              const coaches = data.coaches;
              if (Array.isArray(coaches) && coaches.includes(user.uid)) {
                teamId = d.id;
                break;
              }
              if (data.coachId === user.uid || data.coach === user.uid) {
                teamId = d.id;
                break;
              }
            }
          }
          if (!teamId) {
            throw new Error("No team associated with this coach.");
          }
          if (!cancelled) setSelectedTeamId(teamId);
        } else {
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

  // Resynchroniser selectedTeamId si la route change (ex. navigation avec un autre teamId)
  useEffect(() => {
    const raw = route?.params?.teamId;
    const next =
      typeof raw === "string" && raw.trim() ? raw.trim() : null;
    if (role === "admin" && next !== null) {
      setSelectedTeamId((prev) => (prev !== next ? next : prev));
    }
  }, [route?.params?.teamId, role]);

  // Load team members — member doc is source of truth, user doc enriches if it exists
  useEffect(() => {
    let cancelled = false;
    if (!selectedTeamId) return;

    const parseJersey = (v: any): number | undefined => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") { const n = parseInt(v, 10); return Number.isFinite(n) ? n : undefined; }
      return undefined;
    };

    (async () => {
      try {
        const memSnap = await getDocs(collection(db, "teams", selectedTeamId, "members"));
        if (cancelled) return;

        const loaded: Member[] = await Promise.all(
          memSnap.docs.map(async (d) => {
            const md = d.data() as any;
            // Seed member doc as baseline
            let fullName: string | undefined = md.fullName || md.displayName || md.name || undefined;
            let position: string | undefined = md.position || undefined;
            let jerseyNumber: number | undefined = parseJersey(md.jerseyNumber);
            let role: string | undefined = md.role || undefined;

            // Enrich from users/{uid} when the document exists
            try {
              const userSnap = await getDoc(doc(db, "users", d.id));
              if (userSnap.exists()) {
                const ud = userSnap.data() as any;
                if (ud.fullName) fullName = ud.fullName;
                else if (ud.displayName && !fullName) fullName = ud.displayName;
                if (ud.position) position = ud.position;
                const uj = parseJersey(ud.jerseyNumber);
                if (uj != null) jerseyNumber = uj;
                if (ud.role) role = ud.role;
              }
            } catch {
              // user doc unreadable — member doc data is used as-is
            }

            return { id: d.id, fullName, displayName: fullName, position, jerseyNumber, role };
          })
        );

        const athletes = loaded.filter((m) => m.role !== "coach");
        console.log("members loaded:", athletes);
        if (!cancelled) setMembers(athletes);
      } catch (e) {
        console.error("[PERF][DASH] load members error", e);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedTeamId]);

  // Charger les réponses de l'équipe sur la période sélectionnée
  useEffect(() => {
    let cancelled = false;
    if (!selectedTeamId) return;

    (async () => {
      setLoadingData(true);
      setError(null);
      try {
        const { start, end } = getDateRange(
          durationMode,
          duration,
          customStart || undefined,
          customEnd || undefined
        );
        const startTs = Timestamp.fromDate(start);
        const endTs = Timestamp.fromDate(end);

        const cg = collectionGroup(db, "responses");
        // isTest filter removed server-side: legacy responses lack the field (undefined ≠ false).
        // Client-side guard below (data.isTest check) handles exclusion.
        const qy = query(
          cg,
          where("teamId", "==", selectedTeamId),
          where("submittedAt", ">=", startTs),
          where("submittedAt", "<=", endTs)
        );
        const snap = await getDocs(qy);
        console.log("[Dashboard] responses loaded:", snap.size, "| teamId:", selectedTeamId, "| range:", start.toISOString(), "→", end.toISOString());
        if (cancelled) return;

        const resps: RawResponse[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (!data || !data.userId || !data.trainingId) return;
          if (data.isTest) return;
          resps.push({
            ...(data as RawResponse),
          });
        });

        setResponses(resps);
      } catch (e: any) {
        console.error("[PERF][DASH] load responses error", e);
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

  const filteredResponses = useMemo(() => {
    // When specific players are selected, filter by those players
    if (selectedPlayerIds.length > 0) {
      const set = new Set(selectedPlayerIds);
      return responses.filter((r) => set.has(r.userId));
    }
    // When positions are selected but no specific players, filter by position
    if (selectedPositions.length > 0) {
      const positionUids = new Set(membersFilteredByPosition.map((m) => m.id));
      return responses.filter((r) => positionUids.has(r.userId));
    }
    return responses;
  }, [responses, selectedPlayerIds, selectedPositions, membersFilteredByPosition]);

  const activeFields = useMemo(() => {
    if (indicatorMode === "category") return CATEGORY_FIELDS[category];
    if (indicatorMode === "combined") return [...V3_FIELDS];
    if (selectedIndicators.length > 0) return selectedIndicators;
    return [...V3_FIELDS];
  }, [indicatorMode, category, selectedIndicators]);

  const chartData: ChartPoint[] = useMemo(() => {
    if (!selectedTeamId || filteredResponses.length === 0) return [];

    const { start, end } = getDateRange(
      durationMode, duration, customStart || undefined, customEnd || undefined
    );

    const byDate: Record<string, { byUser: Record<string, RawResponse[]> }> = {};
    for (const r of filteredResponses) {
      if (!r.submittedAt) continue;
      const dt: Date = typeof (r.submittedAt as any).toDate === "function"
        ? (r.submittedAt as any).toDate()
        : new Date(r.submittedAt);
      if (dt < start || dt > end) continue;
      const dateKey = formatDateKey(dt);
      if (!byDate[dateKey]) byDate[dateKey] = { byUser: {} };
      if (!byDate[dateKey].byUser[r.userId]) byDate[dateKey].byUser[r.userId] = [];
      byDate[dateKey].byUser[r.userId].push(r);
    }

    const dates = Object.keys(byDate).sort();
    const data: ChartPoint[] = [];

    if (viewMode === "individual") {
      // Per-player physical composite as readiness proxy per day
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
          list.forEach((resp) => {
            const phy = computePhysicalComposite(resp);
            if (phy != null) { sum += phy; count++; }
          });
          point[uid] = count > 0 ? Math.round(sum / count) : null;
        }
        data.push(point);
      }
      return data;
    }

    if (indicatorMode === "category") {
      // 3 category composite series
      for (const dateKey of dates) {
        const resps = Object.values(byDate[dateKey].byUser).flat();
        const point: ChartPoint = { date: dateKey };
        let phySum = 0, phyCount = 0, menSum = 0, menCount = 0, techSum = 0, techCount = 0;
        for (const r of resps) {
          const phy = computePhysicalComposite(r); if (phy != null) { phySum += phy; phyCount++; }
          const men = computeMentalComposite(r);   if (men != null) { menSum += men; menCount++; }
          const tec = computeTechnicalComposite(r); if (tec != null) { techSum += tec; techCount++; }
        }
        point["physical"]  = phyCount  > 0 ? Math.round(phySum  / phyCount)  : null;
        point["mental"]    = menCount  > 0 ? Math.round(menSum  / menCount)   : null;
        point["technical"] = techCount > 0 ? Math.round(techSum / techCount)  : null;
        data.push(point);
      }
      return data;
    }

    // "indicator" or "combined" — raw V3 fields
    const fields = indicatorMode === "indicator" && selectedIndicators.length > 0
      ? selectedIndicators
      : [...V3_FIELDS];
    for (const dateKey of dates) {
      const resps = Object.values(byDate[dateKey].byUser).flat();
      const point: ChartPoint = { date: dateKey };
      for (const field of fields) {
        let sum = 0, count = 0;
        for (const r of resps) {
          const v = getV3Metric(r, field);
          if (v != null) { sum += v; count++; }
        }
        point[field] = count > 0 ? Math.round(sum / count) : null;
      }
      data.push(point);
    }
    return data;
  }, [filteredResponses, durationMode, duration, customStart, customEnd, viewMode, selectedTeamId, indicatorMode, selectedIndicators]);

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

  // ─── Morning Brief — per-player readiness sorted by risk ─────────────────
  const morningBriefData = useMemo(() => {
    if (filteredResponses.length === 0 || members.length === 0) return [];

    const byPlayer: Record<string, {
      name: string; uid: string; position?: string; jerseyNumber?: number;
      scores: number[]; latestResp: RawResponse | null;
    }> = {};

    const sortedResponses = [...filteredResponses].sort((a, b) => {
      const ta = a.submittedAt?.seconds ?? 0;
      const tb = b.submittedAt?.seconds ?? 0;
      return ta - tb;
    });

    sortedResponses.forEach((r) => {
      if (!byPlayer[r.userId]) {
        const member = members.find((m) => m.id === r.userId);
        byPlayer[r.userId] = {
          name: member?.displayName || r.userId,
          uid: r.userId,
          position: member?.position,
          jerseyNumber: member?.jerseyNumber,
          scores: [],
          latestResp: null,
        };
      }
      const m2 = extractV2Metrics(r) ?? {};
      const rs = r.readinessScore ?? calculateReadiness(m2);
      byPlayer[r.userId].scores.push(rs);
      byPlayer[r.userId].latestResp = r; // last in chronological order = most recent
    });

    return Object.values(byPlayer).map((p) => {
      const emaArr = calculateEMA(p.scores, 28);
      const latest = p.scores[p.scores.length - 1];
      const emaLatest = emaArr[emaArr.length - 1];
      const deviation = calculateDeviation(latest, emaLatest);
      const risk = getRiskLevel(latest, deviation);

      // V3 sub-scores from latest response
      const lm = (p.latestResp?.metrics ?? {}) as any;
      const physicalScore =
        lm.tankLevel != null && lm.legBounce != null && lm.cardioLoad != null
          ? Math.round((lm.tankLevel + lm.legBounce + (101 - lm.cardioLoad)) / 3)
          : null;
      const mentalScore = typeof lm.teamChemistry === 'number' ? lm.teamChemistry : null;
      const technicalScore =
        lm.motorControl != null && lm.tacticalSharpness != null
          ? Math.round((lm.motorControl + lm.tacticalSharpness) / 2)
          : null;
      const worryFlag = p.latestResp?.worryFlag === true;

      return {
        name: p.name, uid: p.uid, position: p.position, jerseyNumber: p.jerseyNumber,
        readinessScore: latest, ema: emaLatest, deviation, risk,
        physicalScore, mentalScore, technicalScore, worryFlag,
      };
    }).sort((a, b) => {
      const order = { danger: 0, monitor: 1, optimal: 2 };
      return order[a.risk] - order[b.risk];
    });
  }, [filteredResponses, members]);

  // ─── V2: Deviation Chart data (readiness vs EMA) ─────────────────────────
  const deviationChartData = useMemo(() => {
    const teamResponses = [...filteredResponses].sort((a, b) => {
      const ta = a.submittedAt?.seconds ?? 0;
      const tb = b.submittedAt?.seconds ?? 0;
      return ta - tb;
    });
    if (teamResponses.length === 0) return [];

    const scores = teamResponses.map((r) => {
      const m2 = extractV2Metrics(r) ?? {};
      return r.readinessScore ?? calculateReadiness(m2);
    });
    const emaArr = calculateEMA(scores, 28);

    return teamResponses.map((r, i) => ({
      date: formatDateKey(new Date((r.submittedAt?.seconds ?? 0) * 1000)),
      readiness: scores[i],
      ema: emaArr[i],
      deviation: calculateDeviation(scores[i], emaArr[i]),
    }));
  }, [filteredResponses]);

  // ─── V2: Workload Chart data (EMA 7d + EMA 28d + danger zone) ────────────
  const workloadChartData = useMemo(() => {
    const teamResponses = [...filteredResponses].sort((a, b) => {
      const ta = a.submittedAt?.seconds ?? 0;
      const tb = b.submittedAt?.seconds ?? 0;
      return ta - tb;
    });
    if (teamResponses.length === 0) return [];

    const workloads = teamResponses.map((r) => r.workloadAU ?? (r.metrics?.sessionRPE ?? 5) * 60);
    const ema7 = calculateEMA(workloads, 7);
    const ema28 = calculateEMA(workloads, 28);

    return teamResponses.map((r, i) => ({
      date: formatDateKey(new Date((r.submittedAt?.seconds ?? 0) * 1000)),
      ema7: Math.round(ema7[i]),
      ema28: Math.round(ema28[i]),
      danger: 700, // threshold line
    }));
  }, [filteredResponses]);


  // ─── V3: Radar data (6 V3 axes, team average over recent responses) ──────
  const radarData = useMemo(() => {
    if (filteredResponses.length === 0) return [];
    const recent = filteredResponses.slice(-60);
    const avg = (vals: number[]) => vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 50;
    const getVals = (key: string) => recent.map((r) => getV3Metric(r, key)).filter((v): v is number => v != null);
    return [
      { subject: "Energy Tank",       value: Math.round(avg(getVals("tankLevel"))) },
      { subject: "Cardio Load *",      value: Math.round(101 - avg(getVals("cardioLoad"))) },
      { subject: "Leg Bounce",         value: Math.round(avg(getVals("legBounce"))) },
      { subject: "Motor Control",      value: Math.round(avg(getVals("motorControl"))) },
      { subject: "Tactical Sharp.",    value: Math.round(avg(getVals("tacticalSharpness"))) },
      { subject: "Team Chemistry",     value: Math.round(avg(getVals("teamChemistry"))) },
    ];
  }, [filteredResponses]);

  function getIndicatorCategory(key: string): CategoryKey {
    if (CATEGORY_FIELDS.physical.includes(key)) return "physical";
    if (CATEGORY_FIELDS.mental.includes(key)) return "mental";
    return "technical";
  }

  const categoryColor = CATEGORY_COLORS[category];

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

  // ─── V2 Chart Renderer (extracted for ResponsiveContainer compatibility) ──
  const renderChartContent = () => {
    const tooltipStyle = { backgroundColor: "#0E1528", border: "1px solid #00D4FF", borderRadius: 8, color: "#FFFFFF" };
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
          {devQ.median !== 0 && <ReferenceLine y={devQ.median} stroke="rgba(0,212,255,0.8)" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Med", position: "insideTopLeft" as const, fontSize: 10, fill: "#00D4FF" }} />}
          {devQ.q3 !== 0 && <ReferenceLine y={devQ.q3} stroke="rgba(255,184,0,0.6)" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Q3", position: "insideTopLeft" as const, fontSize: 10, fill: "rgba(255,184,0,0.8)" }} />}
          <Bar dataKey="deviation" name="Deviation %" fill="#00D4FF" fillOpacity={0.7} radius={[4, 4, 0, 0] as any} />
          <Line type="monotone" dataKey="ema" name="EMA 28d" stroke="#0066FF" strokeWidth={2} dot={false} strokeDasharray="4 2" />
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
          {wlQ.median > 0 && <ReferenceLine y={wlQ.median} stroke="rgba(0,212,255,0.8)" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Med", position: "insideTopLeft" as const, fontSize: 10, fill: "#00D4FF" }} />}
          {wlQ.q3 > 0 && <ReferenceLine y={wlQ.q3} stroke="rgba(255,184,0,0.6)" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Q3", position: "insideTopLeft" as const, fontSize: 10, fill: "rgba(255,184,0,0.8)" }} />}
          <Area type="monotone" dataKey="ema7" name="EMA 7d" stroke="#00D4FF" fill="#00D4FF" fillOpacity={0.12} strokeWidth={2} />
          <Line type="monotone" dataKey="ema28" name="EMA 28d" stroke="#0066FF" strokeWidth={2} dot={false} strokeDasharray="5 3" />
        </ComposedChart>
      );
    }

    // line or bar (legacy)
    return null;
  };

  const filterBoxStyle = {
    background: "#0D1526",
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(0,212,255,0.14)",
  } as const;
  const labelStyle = { fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 6, display: "block" as const };
  const checkboxStyle = { accentColor: CYAN };
  const btnActiveStyle = {
    background: "linear-gradient(135deg, #00BFFF, #0066FF)",
    color: "#FFFFFF",
    border: "none",
  };
  const btnInactiveStyle = {
    background: "#0A0F1E",
    color: "rgba(255,255,255,0.7)",
    border: "1px solid rgba(255,255,255,0.2)",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        overflowY: "auto",
        background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)",
        backgroundColor: BG,
        color: "#FFFFFF",
        padding: 24,
        paddingBottom: 120,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
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
                fontWeight: 700,
                color: "#FFFFFF",
                marginBottom: 4,
                fontFamily: "'Palatino Linotype', Palatino, Georgia, serif",
              }}
            >
              Performance Analytics
            </h1>
            {teamNameFromRoute && (
              <p style={{ margin: "2px 0 4px", fontSize: 14, color: "#00D4FF", fontWeight: 600 }}>
                {teamNameFromRoute}
              </p>
            )}
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: 0 }}>
              Questionnaire data visualization by player, category and period.
            </p>
          </div>
        </div>

        {/* ─── Tab bar ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid rgba(0,212,255,0.15)" }}>
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
                  borderBottom: active ? "2px solid #00D4FF" : "2px solid transparent",
                  color: active ? "#00D4FF" : "rgba(255,255,255,0.45)",
                  fontWeight: active ? 700 : 400,
                  fontSize: 14,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  marginBottom: -1,
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
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginRight: 4 }}>Period:</span>
              {(["7d", "14d", "30d", "90d"] as DurationKey[]).map((d) => {
                const active = duration === d && durationMode === "preset";
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setDurationMode("preset"); setDuration(d); }}
                    style={{
                      padding: "5px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                      ...(active ? { background: "linear-gradient(135deg, #00BFFF, #0066FF)", color: "#FFF", border: "none" }
                                 : { background: "#0A0F1E", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.2)" }),
                      cursor: "pointer",
                    }}
                  >
                    {DURATION_LABEL[d]}
                  </button>
                );
              })}
              {/* Full season shortcut — covers Oct 1 2025 → Mar 10 2026 seed range */}
              <button
                type="button"
                onClick={() => { setDurationMode("custom"); setCustomStart("2025-10-01"); setCustomEnd("2026-03-10"); }}
                style={{
                  padding: "5px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                  ...(durationMode === "custom" && customStart === "2025-10-01" && customEnd === "2026-03-10"
                    ? { background: "linear-gradient(135deg, #00BFFF, #0066FF)", color: "#FFF", border: "none" }
                    : { background: "#0A0F1E", color: "rgba(0,212,255,0.7)", border: "1px solid rgba(0,212,255,0.3)" }),
                  cursor: "pointer",
                }}
              >
                Full Season
              </button>
            </div>
            {loadingInit || loadingData ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
                <ActivityIndicator color={CYAN} />
                <span style={{ marginLeft: 12, color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Loading...</span>
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
                    { key: "monitor" as const, emoji: "🟡", label: "MONITOR", threshold: "40–65" },
                    { key: "optimal" as const, emoji: "🟢", label: "OPTIMAL", threshold: "> 65"  },
                  ] as const
                ).map(({ key, emoji, label, threshold }) => {
                  const group = morningBriefData.filter((p) => p.risk === key);
                  if (group.length === 0) return null;
                  const sectionColor = key === "danger" ? "#FF3B30" : key === "monitor" ? "#FFB800" : "#00FF9D";
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
                            borderRadius: 12,
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
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
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
                                    <span style={{ fontSize: 10, color: "#00D4FF", fontFamily: "'Space Mono', monospace" }}>
                                      PHY {p.physicalScore}
                                    </span>
                                  )}
                                  {p.mentalScore != null && (
                                    <span style={{ fontSize: 10, color: "#00FF88", fontFamily: "'Space Mono', monospace" }}>
                                      MEN {p.mentalScore}
                                    </span>
                                  )}
                                  {p.technicalScore != null && (
                                    <span style={{ fontSize: 10, color: "#A855F7", fontFamily: "'Space Mono', monospace" }}>
                                      TEC {p.technicalScore}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* EMA + deviation */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, minWidth: 64 }}>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>EMA {Math.round(p.ema)}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: p.deviation > 0 ? "#FF3B30" : "#00FF9D" }}>
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

        {/* Filtres */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
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
                background: "#0D1526",
                border: "1px solid rgba(0,212,255,0.14)",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: "pointer",
                color: "#FFFFFF",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 14,
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
                  background: "#0E1528",
                  border: "1px solid rgba(0,212,255,0.3)",
                  borderRadius: 8,
                  maxHeight: 260,
                  overflowY: "auto",
                  marginTop: 4,
                }}
              >
                <div
                  onClick={() => setSelectedPlayerIds([])}
                  style={{ padding: "10px 14px", cursor: "pointer", color: selectedPlayerIds.length === 0 ? CYAN : "#FFFFFF", display: "flex", gap: 8, alignItems: "center" }}
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
                      style={{ padding: "10px 14px", cursor: "pointer", color: selectedPlayerIds.includes(m.id) ? CYAN : "#FFFFFF", display: "flex", gap: 8, alignItems: "center" }}
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
                background: "#0D1526",
                border: "1px solid rgba(0,212,255,0.14)",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: "pointer",
                color: "#FFFFFF",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 14,
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
                  background: "#0E1528",
                  border: "1px solid rgba(0,212,255,0.3)",
                  borderRadius: 8,
                  maxHeight: 220,
                  overflowY: "auto",
                  marginTop: 4,
                }}
              >
                <div
                  onClick={() => setSelectedPositions([])}
                  style={{ padding: "10px 14px", cursor: "pointer", color: selectedPositions.length === 0 ? CYAN : "#FFFFFF", display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input type="checkbox" checked={selectedPositions.length === 0} readOnly style={checkboxStyle} />
                  All Positions
                </div>
                {positions.map((p) => (
                  <div
                    key={p}
                    onClick={() => togglePosition(p)}
                    style={{ padding: "10px 14px", cursor: "pointer", color: selectedPositions.includes(p) ? CYAN : "#FFFFFF", display: "flex", gap: 8, alignItems: "center" }}
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
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(durationMode === "preset" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
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
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(durationMode === "custom" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
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
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        ...(active ? btnActiveStyle : btnInactiveStyle),
                        cursor: "pointer",
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
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    ...(durationMode === "custom" && customStart === "2025-10-01" ? btnActiveStyle : { ...btnInactiveStyle, color: "rgba(0,212,255,0.7)", border: "1px solid rgba(0,212,255,0.3)" }),
                    cursor: "pointer",
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
                      borderRadius: 8,
                      border: "1px solid rgba(0,212,255,0.2)",
                      background: "#0D1526",
                      color: "#FFFFFF",
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
                    borderRadius: 8,
                    border: "1px solid rgba(0,212,255,0.2)",
                    background: "#0D1526",
                    color: "#FFFFFF",
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
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(indicatorMode === "category" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
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
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(indicatorMode === "combined" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
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
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(indicatorMode === "indicator" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
                }}
              >
                By Indicator
              </button>
            </div>
            {indicatorMode === "category" ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["physical", "mental", "technical"] as CategoryKey[]).map((c) => {
                  const active = category === c;
                  const color = CATEGORY_COLORS[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        ...(active ? { ...btnActiveStyle, color: "#FFFFFF" } : btnInactiveStyle),
                        border: active ? "none" : "1px solid rgba(255,255,255,0.2)",
                        cursor: "pointer",
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
                    borderRadius: 8,
                    border: "1px solid rgba(0,212,255,0.2)",
                    background: "#0D1526",
                    color: "#FFFFFF",
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer",
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
                      background: "#0D1526",
                      border: "1px solid rgba(0,212,255,0.2)",
                      borderRadius: 8,
                      zIndex: 10,
                      maxHeight: 320,
                      overflowY: "auto",
                    }}
                  >
                    {(Object.keys(ALL_INDICATORS_BY_CATEGORY) as CategoryKey[]).map((cat) => (
                      <div key={cat} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: CATEGORY_COLORS[cat], marginBottom: 6 }}>
                          {cat === "physical" && "🔵 Physical"}
                          {cat === "mental" && "🟢 Mental"}
                          {cat === "technical" && "🟡 Technical"}
                        </div>
                        {ALL_INDICATORS_BY_CATEGORY[cat].map((key) => {
                          const checked = selectedIndicators.includes(key);
                          return (
                            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", color: "#FFFFFF", cursor: "pointer" }}>
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
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      ...(active ? btnActiveStyle : btnInactiveStyle),
                      cursor: "pointer",
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
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      ...(active ? btnActiveStyle : btnInactiveStyle),
                      cursor: "pointer",
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
            background: "#0D1526",
            borderRadius: 16,
            padding: 20,
            border: "1px solid rgba(0,212,255,0.15)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
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
                  color: "rgba(255,255,255,0.6)",
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
            /* ── DAR Algorithm View ── */
            <DARPerformanceChart
              filteredResponses={filteredResponses}
              members={members}
              selectedPlayerIds={selectedPlayerIds}
            />
          ) : chartData.length === 0 ? (
            <div
              style={{
                minHeight: 160,
                color: "#9CA3AF",
                fontSize: 14,
              }}
            >
              No data for the selected period.
            </div>
          ) : (
            <div style={{ minHeight: 400, marginBottom: 16 }}>
              {/* Root cause fix: height="100%" on ResponsiveContainer needs explicit parent height.
                  Use height={360} directly to avoid 0-height invisible chart. */}
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
                    <Tooltip contentStyle={{ backgroundColor: "#0D1526", border: "1px solid rgba(0,212,255,0.25)", borderRadius: 8, color: "#FFF", fontFamily: "'DM Sans',system-ui", fontSize: 12 }} formatter={(v: any, name: string) => [`${v}/100`, name]} />
                    {chartQuartiles.q1 > 0 && <ReferenceLine y={chartQuartiles.q1} stroke="rgba(33,150,243,0.6)" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Q1", position: "insideTopLeft" as const, fontSize: 10, fill: "rgba(33,150,243,0.8)" }} />}
                    {chartQuartiles.median > 0 && <ReferenceLine y={chartQuartiles.median} stroke="rgba(0,212,255,0.8)" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Med", position: "insideTopLeft" as const, fontSize: 10, fill: "#00D4FF" }} />}
                    {chartQuartiles.q3 > 0 && <ReferenceLine y={chartQuartiles.q3} stroke="rgba(255,184,0,0.6)" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Q3", position: "insideTopLeft" as const, fontSize: 10, fill: "rgba(255,184,0,0.8)" }} />}
                    {seriesKeys.map((k, idx) => {
                      const palette = ["#00D4FF","#00FF88","#A855F7","#FFB800","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4"];
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
                  const palette = ["#00D4FF","#00FF88","#A855F7","#FFB800","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4"];
                  const color = viewMode === "individual" ? palette[idx % palette.length]
                    : indicatorMode === "category" ? (CATEGORY_COLORS[k as CategoryKey] || palette[idx % palette.length])
                    : (V3_COLORS[k] || palette[idx % palette.length]);
                  const label = viewMode === "individual" ? athleteLabel(k)
                    : indicatorMode === "category" ? (CATEGORY_LABEL[k as CategoryKey] || k)
                    : (V3_LABELS[k] || INDICATOR_LABELS[k] || k);
                  return (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{label}</span>
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

