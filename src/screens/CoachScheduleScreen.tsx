import React, { useEffect, useState } from "react";
import { Platform, View, Text } from "react-native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";

const BG = "#0A0F1E";
const CYAN = "#00D4FF";
const CARD_BG = "#0D1526";
const BORDER = "rgba(0,212,255,0.2)";
const ORANGE = "#FF8C42";

type ViewTab = "Day" | "Week" | "Month";

interface MemberStatus {
  uid: string;
  name: string;
  status: "completed" | "pending" | "friction" | "worry";
}

interface TrainingWithStats {
  id: string;
  title: string;
  startUtc: number;
  endUtc: number;
  total: number;
  completed: number;
  memberStatuses: MemberStatus[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

function toMs(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  return 0;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isSameDay(msA: number, msB: number): boolean {
  return startOfDay(msA) === startOfDay(msB);
}

function startOfWeek(ms: number): number {
  // Monday-based
  const d = new Date(ms);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function weekNumber(ms: number): number {
  const d = new Date(ms);
  const firstJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - firstJan.getTime()) / 86400000 + firstJan.getDay() + 1) / 7);
}

function formatDayFull(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatMonthYear(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function addDays(ms: number, n: number): number {
  return ms + n * 86400000;
}

// ── subcomponents ─────────────────────────────────────────────────────────────

function TrainingCard({
  t,
  expandedId,
  setExpandedId,
}: {
  t: TrainingWithStats;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  const pct = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
  const isGood = pct >= 50;
  const expanded = expandedId === t.id;

  return (
    <div
      style={{
        backgroundColor: CARD_BG,
        borderRadius: 14,
        border: `1px solid ${BORDER}`,
        borderTop: "2px solid rgba(0,212,255,0.4)",
        marginBottom: 14,
        overflow: "hidden",
      }}
    >
      {/* Clickable header */}
      <div
        onClick={() => setExpandedId(expanded ? null : t.id)}
        style={{
          padding: "16px 18px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {t.title}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
            {formatTime(t.startUtc)} – {formatTime(t.endUtc)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              backgroundColor: isGood ? "rgba(0,212,255,0.10)" : "rgba(255,140,66,0.10)",
              color: isGood ? CYAN : ORANGE,
              border: `1px solid ${isGood ? "rgba(0,212,255,0.3)" : "rgba(255,140,66,0.3)"}`,
              whiteSpace: "nowrap",
            }}
          >
            {t.completed}/{t.total} completed
          </span>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, backgroundColor: "rgba(255,255,255,0.06)", margin: "0 18px 14px" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            backgroundColor: isGood ? CYAN : ORANGE,
            borderRadius: 2,
            transition: "width 0.4s ease",
          }}
        />
      </div>

      {/* Expanded member list */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Team Members
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {t.memberStatuses.map((ms) => {
              const isCompleted = ms.status === "completed";
              const isWorry = ms.status === "worry";
              const isFriction = ms.status === "friction";
              const statusColor = isWorry ? "#FF4D4D" : isFriction ? "#FFB800" : isCompleted ? "#4ADE80" : ORANGE;
              const statusLabel = isWorry ? "High worry" : isFriction ? "High friction" : isCompleted ? "Completed" : "Pending";
              const statusIcon = isWorry ? "🔴" : isFriction ? "⚡" : isCompleted ? "✅" : "⏳";
              return (
                <div
                  key={ms.uid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span style={{ fontSize: 13, color: "#fff" }}>{ms.name}</span>
                  <span style={{ fontSize: 12, color: statusColor, display: "flex", alignItems: "center", gap: 5 }}>
                    {statusIcon} {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyDay() {
  return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
      No training scheduled for this day.
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function CoachScheduleScreen() {
  const isDesktop = useIsDesktop();

  const [trainings, setTrainings] = useState<TrainingWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ViewTab>("Week");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const [selectedDayMs, setSelectedDayMs] = useState<number>(todayMs);
  const [currentWeekMs, setCurrentWeekMs] = useState<number>(startOfWeek(todayMs));
  const [currentMonthMs, setCurrentMonthMs] = useState<number>(() => {
    const d = new Date(todayMs);
    d.setDate(1);
    return d.getTime();
  });

  // ── data loading ──

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated");

        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = (userSnap.data() as any) || {};
        const tid: string | null = userData.teamId || null;
        if (!tid) throw new Error("No team linked to your account.");

        // Load members
        const membersSnap = await getDocs(collection(db, "teams", tid, "members"));
        const memberList: { uid: string; name: string }[] = [];
        await Promise.all(
          membersSnap.docs.map(async (d) => {
            const mData = d.data() as any;
            let name = mData.fullName || mData.displayName || mData.name || d.id;
            try {
              const uSnap = await getDoc(doc(db, "users", d.id));
              if (uSnap.exists()) {
                const uData = uSnap.data() as any;
                if (uData.fullName) name = uData.fullName;
              }
            } catch { /* ignore */ }
            memberList.push({ uid: d.id, name });
          })
        );

        // Load trainings
        const trainingsSnap = await getDocs(
          query(collection(db, "teams", tid, "trainings"), orderBy("startUtc", "desc"))
        );

        const result: TrainingWithStats[] = [];

        await Promise.all(
          trainingsSnap.docs.map(async (tDoc) => {
            const tData = tDoc.data() as any;
            const startUtc = toMs(tData.startUtc);
            const endUtc = toMs(tData.endUtc) || startUtc;

            const responsesSnap = await getDocs(
              collection(db, "teams", tid, "trainings", tDoc.id, "responses")
            );
            const responseMap: Record<string, any> = {};
            responsesSnap.docs.forEach((r) => { responseMap[r.id] = r.data(); });

            const memberStatuses: MemberStatus[] = memberList.map((m) => {
              const resp = responseMap[m.uid];
              if (!resp) return { uid: m.uid, name: m.name, status: "pending" as const };
              if (resp.worryFlag === true) return { uid: m.uid, name: m.name, status: "worry" as const };
              if (resp.hasFriction === true) return { uid: m.uid, name: m.name, status: "friction" as const };
              return { uid: m.uid, name: m.name, status: "completed" as const };
            });

            const completed = memberStatuses.filter((s) => s.status !== "pending").length;

            result.push({
              id: tDoc.id,
              title: tData.title || tData.name || "Training",
              startUtc,
              endUtc,
              total: memberList.length,
              completed,
              memberStatuses,
            });
          })
        );

        result.sort((a, b) => a.startUtc - b.startUtc);

        if (!cancelled) {
          setTrainings(result);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Error loading schedule");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── filter helpers ──

  const trainingsForDay = (dayMs: number) =>
    trainings
      .filter((t) => isSameDay(t.startUtc, dayMs))
      .sort((a, b) => a.startUtc - b.startUtc);

  const trainingsForMonth = (monthStartMs: number) => {
    const d = new Date(monthStartMs);
    const year = d.getFullYear();
    const month = d.getMonth();
    return trainings.filter((t) => {
      const td = new Date(t.startUtc);
      return td.getFullYear() === year && td.getMonth() === month;
    });
  };

  // Days with trainings (for dots)
  const daysWithTrainings = new Set(trainings.map((t) => startOfDay(t.startUtc)));

  // ── week helpers ──

  const weekDays = (): { ms: number; letter: string }[] => {
    const sw = currentWeekMs; // Monday
    const letters = ["M", "T", "W", "T", "F", "S", "S"];
    return letters.map((l, i) => ({ ms: addDays(sw, i), letter: l }));
  };

  // ── month calendar ──

  const getCalendarDays = () => {
    const d = new Date(currentMonthMs);
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    // adjust so Monday=0
    const startOffset = (firstDay.getDay() + 6) % 7;
    const startMs = firstDay.getTime() - startOffset * 86400000;
    const days: { ms: number; inMonth: boolean; isToday: boolean; hasTraining: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const ms = startMs + i * 86400000;
      const date = new Date(ms);
      days.push({
        ms,
        inMonth: date.getMonth() === month,
        isToday: ms === todayMs,
        hasTraining: daysWithTrainings.has(ms),
      });
    }
    return days;
  };

  // ── tab change ──

  const handleTabChange = (tab: ViewTab) => {
    setActiveTab(tab);
    setExpandedId(null);
    if (tab === "Day") setSelectedDayMs(todayMs);
    else if (tab === "Week") setCurrentWeekMs(startOfWeek(todayMs));
    else {
      const d = new Date(todayMs);
      d.setDate(1);
      setCurrentMonthMs(d.getTime());
    }
  };

  // ── render ──

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>Schedule is available on web.</Text>
      </View>
    );
  }

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    overflowY: "auto",
    paddingBottom: 100,
    backgroundColor: BG,
    padding: isDesktop ? "40px 60px 100px" : "20px 16px 100px",
    fontFamily: "'Inter', sans-serif",
    color: "#fff",
    boxSizing: "border-box",
  };

  const navBtnStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    color: "#fff",
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: 13,
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${CYAN}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Loading schedule...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ backgroundColor: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.3)", borderRadius: 12, padding: "14px 18px", color: "#FF6B6B" }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: isDesktop ? 26 : 20, fontWeight: 700, color: "#fff", fontFamily: "'Palatino Linotype', Palatino, Georgia, serif" }}>
          Training Schedule
        </h1>
        <p style={{ margin: "5px 0 0", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
          Track completion rates per session
        </p>
      </div>

      {/* Tab navigation */}
      <div
        style={{
          display: "flex",
          backgroundColor: "rgba(255,255,255,0.05)",
          borderRadius: 12,
          padding: 4,
          marginBottom: 24,
          maxWidth: 360,
        }}
      >
        {(["Day", "Week", "Month"] as ViewTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            style={{
              flex: 1,
              padding: "10px 0",
              backgroundColor: activeTab === tab ? CYAN : "transparent",
              color: activeTab === tab ? "#0A0F1E" : "#9AA3B2",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── DAY VIEW ── */}
      {activeTab === "Day" && (
        <div style={{ maxWidth: isDesktop ? 720 : "100%" }}>
          {/* Day navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button style={navBtnStyle} onClick={() => setSelectedDayMs(addDays(selectedDayMs, -1))}>← Prev</button>
            <div style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 600, color: "#fff" }}>
              {formatDayFull(selectedDayMs)}
            </div>
            <button style={navBtnStyle} onClick={() => setSelectedDayMs(addDays(selectedDayMs, 1))}>Next →</button>
          </div>
          {selectedDayMs !== todayMs && (
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <button onClick={() => setSelectedDayMs(todayMs)} style={{ ...navBtnStyle, color: CYAN, borderColor: "rgba(0,212,255,0.3)" }}>
                Today
              </button>
            </div>
          )}
          {trainingsForDay(selectedDayMs).length === 0
            ? <EmptyDay />
            : trainingsForDay(selectedDayMs).map((t) => (
              <TrainingCard key={t.id} t={t} expandedId={expandedId} setExpandedId={setExpandedId} />
            ))
          }
        </div>
      )}

      {/* ── WEEK VIEW ── */}
      {activeTab === "Week" && (
        <div style={{ maxWidth: isDesktop ? 720 : "100%" }}>
          {/* Week navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button
              style={navBtnStyle}
              onClick={() => {
                const nw = addDays(currentWeekMs, -7);
                setCurrentWeekMs(nw);
                setSelectedDayMs(nw);
              }}
            >← Prev</button>
            <div style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 600, color: "#fff" }}>
              Week {weekNumber(currentWeekMs)}
            </div>
            <button
              style={navBtnStyle}
              onClick={() => {
                const nw = addDays(currentWeekMs, 7);
                setCurrentWeekMs(nw);
                setSelectedDayMs(nw);
              }}
            >Next →</button>
          </div>

          {/* Today button */}
          {startOfWeek(todayMs) !== currentWeekMs && (
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <button
                onClick={() => { setCurrentWeekMs(startOfWeek(todayMs)); setSelectedDayMs(todayMs); }}
                style={{ ...navBtnStyle, color: CYAN, borderColor: "rgba(0,212,255,0.3)" }}
              >
                Today
              </button>
            </div>
          )}

          {/* Day circles */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, justifyContent: "space-between" }}>
            {weekDays().map(({ ms, letter }, i) => {
              const isSelected = isSameDay(ms, selectedDayMs);
              const isToday = ms === todayMs;
              const hasDot = daysWithTrainings.has(ms);
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDayMs(ms)}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 11, color: isToday ? CYAN : "rgba(255,255,255,0.4)", fontWeight: isToday ? 700 : 400 }}>
                    {letter}
                  </span>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      backgroundColor: isSelected ? CYAN : "transparent",
                      border: isToday && !isSelected ? `1.5px solid ${CYAN}` : "1.5px solid transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? "#0A0F1E" : "#fff" }}>
                      {new Date(ms).getDate()}
                    </span>
                  </div>
                  {hasDot && (
                    <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: isSelected ? "rgba(255,255,255,0.6)" : CYAN }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Trainings for selected day */}
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
            {formatDayFull(selectedDayMs)}
          </div>
          {trainingsForDay(selectedDayMs).length === 0
            ? <EmptyDay />
            : trainingsForDay(selectedDayMs).map((t) => (
              <TrainingCard key={t.id} t={t} expandedId={expandedId} setExpandedId={setExpandedId} />
            ))
          }
        </div>
      )}

      {/* ── MONTH VIEW ── */}
      {activeTab === "Month" && (
        <div style={{ maxWidth: isDesktop ? 720 : "100%" }}>
          {/* Month navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button
              style={navBtnStyle}
              onClick={() => {
                const d = new Date(currentMonthMs);
                d.setMonth(d.getMonth() - 1);
                setCurrentMonthMs(d.getTime());
              }}
            >← Prev</button>
            <div style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 600, color: "#fff" }}>
              {formatMonthYear(currentMonthMs)}
            </div>
            <button
              style={navBtnStyle}
              onClick={() => {
                const d = new Date(currentMonthMs);
                d.setMonth(d.getMonth() + 1);
                setCurrentMonthMs(d.getTime());
              }}
            >Next →</button>
          </div>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((l, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, padding: "4px 0" }}>
                {l}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 24 }}>
            {getCalendarDays().map(({ ms, inMonth, isToday, hasTraining }, i) => {
              const isSelected = isSameDay(ms, selectedDayMs);
              return (
                <div
                  key={i}
                  onClick={() => { setSelectedDayMs(ms); }}
                  style={{
                    aspectRatio: "1",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    backgroundColor: isSelected ? CYAN : "transparent",
                    border: isToday && !isSelected ? `1px solid ${CYAN}` : "1px solid transparent",
                    cursor: "pointer",
                    position: "relative",
                    gap: 2,
                  }}
                >
                  <span style={{
                    fontSize: 13,
                    fontWeight: isToday ? 700 : 400,
                    color: isSelected ? "#0A0F1E" : inMonth ? "#fff" : "rgba(255,255,255,0.2)",
                  }}>
                    {new Date(ms).getDate()}
                  </span>
                  {hasTraining && (
                    <div style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      backgroundColor: isSelected ? "rgba(10,15,30,0.7)" : CYAN,
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Trainings for selected day */}
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
            {formatDayFull(selectedDayMs)}
          </div>
          {trainingsForDay(selectedDayMs).length === 0
            ? <EmptyDay />
            : trainingsForDay(selectedDayMs).map((t) => (
              <TrainingCard key={t.id} t={t} expandedId={expandedId} setExpandedId={setExpandedId} />
            ))
          }
        </div>
      )}
      </div>
    </div>
  );
}
