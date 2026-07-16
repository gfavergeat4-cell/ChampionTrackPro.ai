// ScheduleScreenSupabase.tsx — Calendrier athlète Supabase (parité StitchScheduleScreen)
// Day/Week/Month tabs, sessions depuis Supabase, bouton Respond/Done, Courtlight styling.
import React from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  StyleSheet, Platform, Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getMyMembership, listSessions, getMyResponseForSession } from "../lib/ctpApi";
import { courtlight as cl } from "../theme/tokens";

type ViewMode = "Day" | "Week" | "Month";

interface Session {
  id: string;
  team_id: string;
  title: string;
  start_utc: string;
  end_utc: string;
  cancelled: boolean;
}

// ── Skeleton (doc 06 section 6) ──
function Skeleton({ width = "70%" }: { width?: string | number }) {
  const shimmer = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: false }),
      { iterations: 2 },
    ).start();
  }, [shimmer]);
  const bg = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["rgba(255,255,255,0.04)", "rgba(160,220,255,0.10)", "rgba(255,255,255,0.04)"],
  });
  return <Animated.View style={[s.skeleton, { width, backgroundColor: bg }]} />;
}

// ── Date helpers ──
function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function fmtDayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function fmtMonthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

// ── Bottom tab bar (parité UnifiedAthleteNavigation) ──
function BottomTabBar({ active }: { active: "Home" | "Schedule" | "Profile" }) {
  const navigation = useNavigation<any>();
  if (Platform.OS !== "web") return null;

  const tabs = [
    { id: "Home" as const, label: "Home" },
    { id: "Schedule" as const, label: "Schedule" },
    { id: "Profile" as const, label: "Profile" },
  ];

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: "100%",
      maxWidth: 430,
      background: "rgba(7,11,20,0.95)",
      backdropFilter: "blur(30px)",
      WebkitBackdropFilter: "blur(30px)",
      borderTop: "0.5px solid rgba(0,212,255,0.18)",
      padding: "8px 12px 12px",
      paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      zIndex: 10000,
      display: "flex",
      justifyContent: "center",
      gap: 20,
    }}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id !== active) navigation.navigate(tab.id);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "6px 12px",
              color: isActive ? cl.accent.cyan : cl.text.mid,
            }}
          >
            <span style={{
              fontSize: 10,
              fontWeight: isActive ? "600" : "400",
              fontFamily: cl.type.ui,
              color: isActive ? cl.accent.cyan : cl.text.mid,
              textShadow: isActive ? `0 0 4px rgba(0,212,255,0.3)` : "none",
            }}>
              {tab.label}
            </span>
            {isActive && (
              <div style={{
                height: 2,
                width: 22,
                background: cl.accent.cyan,
                borderRadius: 1,
                boxShadow: "0 0 6px rgba(0,212,255,0.5)",
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Main component ──
export default function ScheduleScreenSupabase() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [teamId, setTeamId] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>("Week");
  const [selectedDay, setSelectedDay] = React.useState(new Date());
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date()));
  const [monthStart, setMonthStart] = React.useState(() => startOfMonth(new Date()));
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [responded, setResponded] = React.useState<Record<string, boolean>>({});

  // ── Load team ──
  React.useEffect(() => {
    (async () => {
      try {
        const m: any = await getMyMembership();
        if (m?.team_id) setTeamId(m.team_id);
      } catch (e) {
        console.warn("[SCHEDULE][SUPA] membership failed:", (e as any)?.message);
      }
    })();
  }, []);

  // ── Load sessions when teamId, viewMode, weekStart, monthStart, or selectedDay changes ──
  const loadSessions = React.useCallback(async () => {
    if (!teamId) { setLoading(false); return; }
    try {
      let from: string;
      let to: string;

      if (viewMode === "Day") {
        const d = new Date(selectedDay);
        d.setHours(0, 0, 0, 0);
        from = d.toISOString();
        const dEnd = new Date(d);
        dEnd.setHours(23, 59, 59, 999);
        to = dEnd.toISOString();
      } else if (viewMode === "Week") {
        from = weekStart.toISOString();
        to = addDays(weekStart, 7).toISOString();
      } else {
        from = monthStart.toISOString();
        to = endOfMonth(monthStart).toISOString();
      }

      const data = await listSessions(teamId, from, to) as Session[];
      const activeSessions = data.filter((s) => !s.cancelled);
      setSessions(activeSessions);

      // Check responses for each session
      const respMap: Record<string, boolean> = {};
      await Promise.all(
        activeSessions.map(async (sess) => {
          try {
            const resp = await getMyResponseForSession(sess.id);
            respMap[sess.id] = !!resp;
          } catch {
            respMap[sess.id] = false;
          }
        }),
      );
      setResponded(respMap);
    } catch (e) {
      console.warn("[SCHEDULE][SUPA] load sessions failed:", (e as any)?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId, viewMode, selectedDay, weekStart, monthStart]);

  React.useEffect(() => { loadSessions(); }, [loadSessions]);

  // ── Sessions for selected day (filtered from loaded range) ──
  const sessionsForDay = sessions.filter((sess) =>
    isSameDay(new Date(sess.start_utc), selectedDay),
  );

  // ── Week day buttons ──
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const isToday = isSameDay(d, new Date());
    const isSelected = isSameDay(d, selectedDay);
    const hasEvents = sessions.some((sess) => isSameDay(new Date(sess.start_utc), d));
    return { date: d, letter: DAY_LETTERS[i], dayNum: d.getDate(), isToday, isSelected, hasEvents };
  });

  // ── Month calendar grid ──
  const getMonthGrid = () => {
    const first = new Date(monthStart);
    const gridStart = addDays(first, -first.getDay()); // start from Sunday
    const today = new Date();
    return Array.from({ length: 42 }, (_, i) => {
      const d = addDays(gridStart, i);
      return {
        date: d,
        dayNum: d.getDate(),
        isCurrentMonth: d.getMonth() === monthStart.getMonth(),
        isToday: isSameDay(d, today),
        isSelected: isSameDay(d, selectedDay),
        hasEvents: sessions.some((sess) => isSameDay(new Date(sess.start_utc), d)),
      };
    });
  };

  // ── Navigation helpers ──
  const goToPrevWeek = () => {
    const nw = addDays(weekStart, -7);
    setWeekStart(nw);
    setSelectedDay(addDays(selectedDay, -7));
  };
  const goToNextWeek = () => {
    const nw = addDays(weekStart, 7);
    setWeekStart(nw);
    setSelectedDay(addDays(selectedDay, 7));
  };
  const goToPrevMonth = () => {
    const nw = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
    setMonthStart(nw);
  };
  const goToNextMonth = () => {
    const nw = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    setMonthStart(nw);
  };
  const goToToday = () => {
    const today = new Date();
    setSelectedDay(today);
    setWeekStart(startOfWeek(today));
    setMonthStart(startOfMonth(today));
  };

  const handleTabChange = (tab: ViewMode) => {
    setViewMode(tab);
    if (tab === "Day") {
      setSelectedDay(new Date());
    } else if (tab === "Week") {
      setWeekStart(startOfWeek(selectedDay));
    } else {
      setMonthStart(startOfMonth(selectedDay));
    }
  };

  const handleRespond = (sess: Session) => {
    navigation.navigate("Questionnaire", {
      trainingId: sess.id,
      sessionId: sess.id,
      teamId,
      eventTitle: sess.title || "Training",
    });
  };

  const isCurrentWeek = isSameDay(weekStart, startOfWeek(new Date()));
  const isCurrentMonth =
    monthStart.getFullYear() === new Date().getFullYear() &&
    monthStart.getMonth() === new Date().getMonth();

  // ── Render ──
  if (Platform.OS !== "web") return null;

  if (loading) {
    return (
      <ScrollView style={s.scroll} contentContainerStyle={s.container}>
        <Skeleton width="40%" />
        <View style={[s.card, { marginTop: 16 }]}>
          <Skeleton width="80%" />
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadSessions(); }}
            tintColor={cl.accent.cyan}
          />
        }
      >
        {/* Header */}
        <Text style={s.headerTitle}>Schedule</Text>

        {/* View mode tabs: Day / Week / Month */}
        <View style={s.tabRow}>
          {(["Day", "Week", "Month"] as ViewMode[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => handleTabChange(tab)}
              style={({ pressed }) => [
                s.tabBtn,
                viewMode === tab && s.tabBtnActive,
                pressed && s.btnPressed,
              ]}
            >
              <Text style={[s.tabLabel, viewMode === tab && s.tabLabelActive]}>
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Date display */}
        <Text style={s.dateLabel}>{fmtDayLabel(selectedDay)}</Text>

        {/* ── Week navigation + day selector ── */}
        {viewMode === "Week" && (
          <View style={{ marginTop: 12 }}>
            {/* Week nav arrows */}
            <View style={s.weekNavRow}>
              <Pressable onPress={goToPrevWeek} style={({ pressed }) => [s.navBtn, pressed && s.btnPressed]}>
                <Text style={s.navBtnText}>Previous</Text>
              </Pressable>
              <Text style={s.weekLabel}>
                Week {Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 86400000)) + 1}
              </Text>
              <Pressable onPress={goToNextWeek} style={({ pressed }) => [s.navBtn, pressed && s.btnPressed]}>
                <Text style={s.navBtnText}>Next</Text>
              </Pressable>
            </View>

            {/* Today button */}
            {!isCurrentWeek && (
              <Pressable onPress={goToToday} style={({ pressed }) => [s.todayBtn, pressed && s.btnPressed]}>
                <Text style={s.todayBtnText}>Today</Text>
              </Pressable>
            )}

            {/* Day circles */}
            <View style={s.dayRow}>
              {weekDays.map((day, i) => (
                <Pressable
                  key={i}
                  onPress={() => setSelectedDay(day.date)}
                  style={[
                    s.dayCircle,
                    day.isSelected && s.dayCircleSelected,
                    day.isToday && !day.isSelected && s.dayCircleToday,
                  ]}
                >
                  <Text style={[
                    s.dayLetter,
                    day.isSelected && s.dayLetterSelected,
                  ]}>
                    {day.letter}
                  </Text>
                  <Text style={[
                    s.dayNum,
                    day.isSelected && s.dayNumSelected,
                  ]}>
                    {day.dayNum}
                  </Text>
                  {day.hasEvents && !day.isSelected && (
                    <View style={s.dayDot} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ── Day navigation ── */}
        {viewMode === "Day" && (
          <View style={s.weekNavRow}>
            <Pressable
              onPress={() => setSelectedDay(addDays(selectedDay, -1))}
              style={({ pressed }) => [s.navBtn, pressed && s.btnPressed]}
            >
              <Text style={s.navBtnText}>Previous</Text>
            </Pressable>
            {!isSameDay(selectedDay, new Date()) && (
              <Pressable onPress={goToToday} style={({ pressed }) => [s.todayBtnSmall, pressed && s.btnPressed]}>
                <Text style={s.todayBtnText}>Today</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => setSelectedDay(addDays(selectedDay, 1))}
              style={({ pressed }) => [s.navBtn, pressed && s.btnPressed]}
            >
              <Text style={s.navBtnText}>Next</Text>
            </Pressable>
          </View>
        )}

        {/* ── Month calendar grid ── */}
        {viewMode === "Month" && (
          <View style={{ marginTop: 12 }}>
            {/* Month nav */}
            <View style={s.weekNavRow}>
              <Pressable onPress={goToPrevMonth} style={({ pressed }) => [s.navBtn, pressed && s.btnPressed]}>
                <Text style={s.navBtnText}>Previous</Text>
              </Pressable>
              <Text style={s.weekLabel}>{fmtMonthLabel(monthStart)}</Text>
              <Pressable onPress={goToNextMonth} style={({ pressed }) => [s.navBtn, pressed && s.btnPressed]}>
                <Text style={s.navBtnText}>Next</Text>
              </Pressable>
            </View>

            {!isCurrentMonth && (
              <Pressable onPress={goToToday} style={({ pressed }) => [s.todayBtn, pressed && s.btnPressed]}>
                <Text style={s.todayBtnText}>Today</Text>
              </Pressable>
            )}

            {/* Grid */}
            {Platform.OS === "web" && (
              <div style={{
                backgroundColor: cl.surface.card,
                borderRadius: cl.radius.card,
                padding: 12,
                border: "1px solid rgba(0,212,255,0.10)",
                marginTop: 12,
              }}>
                {/* Day headers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                  {DAY_LETTERS.map((letter, i) => (
                    <div key={i} style={{
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: "600",
                      color: cl.text.mid,
                      padding: "4px 0",
                      fontFamily: cl.type.ui,
                    }}>
                      {letter}
                    </div>
                  ))}
                </div>
                {/* Calendar days */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                  {getMonthGrid().map((day, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(day.date)}
                      style={{
                        aspectRatio: "1",
                        backgroundColor: day.isSelected
                          ? cl.accent.cyan
                          : day.isToday
                            ? "rgba(0,212,255,0.15)"
                            : "transparent",
                        color: day.isSelected
                          ? "#070B14"
                          : day.isCurrentMonth
                            ? cl.text.hi
                            : "rgba(255,255,255,0.25)",
                        border: day.isToday && !day.isSelected
                          ? `1px solid ${cl.accent.cyan}`
                          : "1px solid transparent",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        fontFamily: cl.type.ui,
                        opacity: day.isCurrentMonth ? 1 : 0.4,
                      }}
                    >
                      <span>{day.dayNum}</span>
                      {day.hasEvents && (
                        <div style={{
                          position: "absolute",
                          bottom: 3,
                          width: 4,
                          height: 4,
                          backgroundColor: day.isSelected ? "#070B14" : cl.accent.cyan,
                          borderRadius: "50%",
                        }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </View>
        )}

        {/* ── Session cards for selected day ── */}
        <Text style={s.sectionTitle}>
          {sessionsForDay.length > 0
            ? `${sessionsForDay.length} session${sessionsForDay.length > 1 ? "s" : ""}`
            : "No sessions"}
        </Text>

        {sessionsForDay.length === 0 ? (
          <View style={s.card}>
            <Text style={s.emptyText}>
              {isSameDay(selectedDay, new Date())
                ? "No training today"
                : "No sessions scheduled"}
            </Text>
            <Text style={s.emptyDetail}>
              {isSameDay(selectedDay, new Date())
                ? "Time to rest and recover."
                : selectedDay < new Date()
                  ? "This day has passed."
                  : "Check back closer to the date."}
            </Text>
          </View>
        ) : (
          sessionsForDay.map((sess) => {
            const done = responded[sess.id];
            return (
              <View key={sess.id} style={[s.card, { marginTop: 8 }]}>
                <View style={s.sessionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sessionTitle} numberOfLines={1}>
                      {sess.title || "Training"}
                    </Text>
                    <Text style={s.sessionMeta}>
                      {fmtTime(sess.start_utc)} - {fmtTime(sess.end_utc)}
                    </Text>
                  </View>
                  {done ? (
                    <View style={s.doneBadge}>
                      <Text style={s.doneText}>Done</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleRespond(sess)}
                      style={({ pressed }) => [s.respondBtn, pressed && s.btnPressed]}
                    >
                      <Text style={s.respondBtnText}>Respond</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}

        <Text style={s.footer}>
          Respond within 60 seconds of your session ending.
        </Text>
      </ScrollView>

      {/* Bottom tab bar */}
      <BottomTabBar active="Schedule" />
    </>
  );
}

const s = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  container: {
    padding: 18,
    paddingTop: 52,
    paddingBottom: 120,
    maxWidth: 430,
    alignSelf: "center" as any,
    width: "100%",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
    color: cl.text.hi,
    textAlign: "center" as any,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: cl.radius.control,
    padding: 4,
    marginTop: 16,
  },
  tabBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: {
    ...(Platform.OS === "web"
      ? { background: `linear-gradient(135deg, ${cl.accent.cyan}, ${cl.accent.deep})` } as any
      : { backgroundColor: cl.accent.cyan }),
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: cl.text.mid,
  },
  tabLabelActive: {
    color: "#070B14",
  },
  dateLabel: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
    color: cl.text.hi,
    textAlign: "center" as any,
    marginTop: 16,
  },
  weekNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  navBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.10)",
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: cl.text.hi,
  },
  weekLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: cl.accent.cyan,
    fontFamily: "Inter_500Medium",
  },
  todayBtn: {
    alignSelf: "center" as any,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    ...(Platform.OS === "web"
      ? { background: `linear-gradient(135deg, ${cl.accent.cyan}, ${cl.accent.deep})` } as any
      : { backgroundColor: cl.accent.cyan }),
  },
  todayBtnSmall: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    ...(Platform.OS === "web"
      ? { background: `linear-gradient(135deg, ${cl.accent.cyan}, ${cl.accent.deep})` } as any
      : { backgroundColor: cl.accent.cyan }),
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
    color: "#070B14",
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  dayCircle: {
    width: 44,
    height: 56,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  dayCircleSelected: {
    backgroundColor: cl.accent.cyan,
    borderColor: cl.accent.cyan,
  },
  dayCircleToday: {
    borderColor: cl.accent.cyan,
    backgroundColor: "rgba(0,212,255,0.12)",
  },
  dayLetter: {
    fontSize: 11,
    fontWeight: "500",
    color: cl.text.mid,
    fontFamily: "Inter_500Medium",
  },
  dayLetterSelected: {
    color: "#070B14",
  },
  dayNum: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
    color: cl.text.hi,
    marginTop: 1,
  },
  dayNumSelected: {
    color: "#070B14",
  },
  dayDot: {
    position: "absolute" as any,
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: cl.accent.cyan,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: cl.text.hi,
    letterSpacing: 0.3,
    marginTop: 22,
    marginBottom: 8,
  },
  card: {
    backgroundColor: cl.surface.card,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.10)",
    borderRadius: cl.radius.card,
    padding: 16,
    ...(Platform.OS === "web"
      ? { boxShadow: `${cl.shadow.e1}, inset 0 1px 0 rgba(160,220,255,0.10)` }
      : {}),
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: cl.text.hi,
  },
  sessionMeta: {
    fontSize: 12,
    color: cl.text.mid,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  respondBtn: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: cl.radius.control,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { background: "linear-gradient(135deg, #00D4FF, #0066FF)", boxShadow: "0 6px 20px rgba(0,120,255,0.35)" }
      : { backgroundColor: cl.accent.cyan }),
  },
  respondBtnText: {
    color: "#04121F",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },
  doneBadge: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: cl.radius.control,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,200,83,0.14)",
    borderWidth: 1,
    borderColor: "rgba(0,200,83,0.35)",
  },
  doneText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: cl.zone.GREEN,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
    color: cl.text.hi,
  },
  emptyDetail: {
    fontSize: 13,
    color: cl.text.mid,
    marginTop: 4,
  },
  footer: {
    fontSize: 11,
    color: cl.text.low,
    textAlign: "center" as any,
    marginTop: 24,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  skeleton: {
    height: 14,
    borderRadius: 8,
    marginTop: 10,
  },
});
