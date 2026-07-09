// AthleteHomeSupabase.tsx — Accueil athlète Courtlight (doc 06 §7.3)
// Halo personnel, GlassCard session à noter, cartes graphite sessions.
import React from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  StyleSheet, Platform, Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getMyMembership, listSessions, getMyResponseForSession, getMyMetricsToday } from "../lib/ctpApi";
import { courtlight } from "../theme/tokens";
import ReadinessHalo from "../components/ReadinessHalo";
import GlassCard from "../components/GlassCard";

type Zone = "GREEN" | "BLUE" | "YELLOW" | "NONE";

function Skeleton({ width = "70%" }: { width?: string | number }) {
  const shimmer = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: false }),
      { iterations: 2 }
    ).start();
  }, [shimmer]);
  const bg = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["rgba(255,255,255,0.04)", "rgba(160,220,255,0.10)", "rgba(255,255,255,0.04)"],
  });
  return <Animated.View style={[s.skeleton, { width, backgroundColor: bg }]} />;
}

function timeRemaining(endUtcISO: string): string {
  const end = new Date(endUtcISO).getTime();
  const windowEnd = end + 5 * 3600 * 1000;
  const left = windowEnd - Date.now();
  if (left <= 0) return "closing soon";
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  return h > 0 ? `closes in ${h} h ${m} min` : `closes in ${m} min`;
}

export default function AthleteHomeSupabase() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [teamId, setTeamId] = React.useState<string | null>(null);
  const [toRate, setToRate] = React.useState<any[]>([]);
  const [upcoming, setUpcoming] = React.useState<any[]>([]);
  const [myMetrics, setMyMetrics] = React.useState<any>(null);

  const load = React.useCallback(async () => {
    try {
      const m: any = await getMyMembership();
      if (!m?.team_id) { setLoading(false); return; }
      setTeamId(m.team_id);
      const now = Date.now();
      const from = new Date(now - 6 * 3600 * 1000).toISOString();
      const to = new Date(now + 7 * 24 * 3600 * 1000).toISOString();
      const [sessions, metrics] = await Promise.all([
        listSessions(m.team_id, from, to),
        getMyMetricsToday(),
      ]);
      setMyMetrics(metrics);
      const past = (sessions as any[]).filter(
        (s) => !s.cancelled && new Date(s.end_utc).getTime() <= now &&
               now <= new Date(s.end_utc).getTime() + 5 * 3600 * 1000
      );
      const answered = await Promise.all(past.map((s) => getMyResponseForSession(s.id)));
      setToRate(past.filter((_, i) => !answered[i]));
      setUpcoming(
        (sessions as any[])
          .filter((s) => !s.cancelled && new Date(s.start_utc).getTime() > now)
          .slice(0, 5)
      );
    } catch (e) {
      console.warn("[ATHLETE][SUPA] load failed:", (e as any)?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  // Personal readiness
  const score = myMetrics?.readiness != null ? Math.round(myMetrics.readiness) : null;
  const zone: Zone = myMetrics?.zone === "INSUFFICIENT_DATA" ? "NONE" : (myMetrics?.zone as Zone) ?? "NONE";
  const baseline = myMetrics?.ema_28 != null ? Math.round(myMetrics.ema_28) : null;

  if (loading) {
    return (
      <ScrollView style={s.scroll} contentContainerStyle={s.container}>
        <View style={{ alignItems: "center", marginTop: 20 }}>
          <Skeleton width="40%" />
        </View>
        <View style={[s.card, { marginTop: 16 }]}>
          <Skeleton width="80%" />
          <Skeleton width="50%" />
        </View>
        <View style={[s.card, { marginTop: 12 }]}>
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={courtlight.accent.cyan} />}
    >
      {/* ── Header: brand + personal halo ── */}
      <Text style={s.brand}>CHAMPION<Text style={s.brandAccent}>TRACK</Text>PRO</Text>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>Your day</Text>
        </View>
        <ReadinessHalo score={score ?? 0} zone={zone} size={56} baselinePct={baseline} />
      </View>

      {/* ── Session to rate (GlassCard = verre de focus) ── */}
      {toRate.length > 0 ? (
        toRate.map((sess) => (
          <GlassCard key={sess.id} glow style={{ marginTop: 12 }}>
            <Text style={s.miniLabel}>SESSION TO RATE</Text>
            <View style={s.sessionRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.sessionTitle}>{sess.title || "Practice"}</Text>
                <Text style={s.sessionMeta}>
                  ended {Math.round((Date.now() - new Date(sess.end_utc).getTime()) / 60000)} min ago · {timeRemaining(sess.end_utc)}
                </Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate("Questionnaire", { trainingId: sess.id, teamId, eventTitle: sess.title })}
                style={({ pressed }) => [s.respondBtn, pressed && s.btnPressed]}
              >
                <Text style={s.respondBtnText}>Respond · 60 s</Text>
              </Pressable>
            </View>
          </GlassCard>
        ))
      ) : (
        <View style={[s.card, { marginTop: 12 }]}>
          <Text style={s.emptyText}>All caught up.</Text>
          {upcoming.length > 0 && (
            <Text style={s.emptyDetail}>
              Next session {fmtDay(upcoming[0].start_utc)} at {fmt(upcoming[0].start_utc)}.
            </Text>
          )}
        </View>
      )}

      {/* ── Next sessions ── */}
      <Text style={s.sectionTitle}>Next sessions</Text>
      {upcoming.length === 0 ? (
        <Text style={s.emptyDetail}>No upcoming sessions on the calendar.</Text>
      ) : (
        <View style={s.card}>
          {upcoming.map((sess, i) => (
            <View key={sess.id}>
              <View style={s.upcomingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.upcomingTitle} numberOfLines={1}>{sess.title || "Training"}</Text>
                  <Text style={s.upcomingMeta}>
                    {fmtDay(sess.start_utc)} · {fmt(sess.start_utc)} – {fmt(sess.end_utc)}
                  </Text>
                </View>
                <Text style={s.upcomingType}>{sess.session_type || "practice"}</Text>
              </View>
              {i < upcoming.length - 1 && <View style={s.separator} />}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
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
  brand: {
    fontFamily: "Marcellus_400Regular",
    fontSize: 12,
    letterSpacing: 4,
    color: courtlight.text.mid,
    textAlign: "center" as any,
    marginBottom: 6,
  },
  brandAccent: {
    color: courtlight.accent.cyan,
    fontWeight: "600",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
    color: courtlight.text.hi,
  },
  miniLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    color: courtlight.text.mid,
    textTransform: "uppercase" as any,
    marginBottom: 6,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sessionTitle: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
    color: courtlight.text.hi,
  },
  sessionMeta: {
    fontSize: 12,
    color: courtlight.text.mid,
    marginTop: 2,
  },
  respondBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: courtlight.radius.control,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { background: "linear-gradient(135deg, #00D4FF, #0066FF)", boxShadow: "0 6px 20px rgba(0,120,255,0.35)" }
      : { backgroundColor: courtlight.accent.cyan }),
  },
  respondBtnText: {
    color: "#04121F",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: courtlight.text.hi,
    letterSpacing: 0.3,
    marginTop: 28,
    marginBottom: 8,
  },
  card: {
    backgroundColor: courtlight.surface.card,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.10)",
    borderRadius: courtlight.radius.card,
    padding: 16,
    ...(Platform.OS === "web"
      ? { boxShadow: `${courtlight.shadow.e1}, inset 0 1px 0 rgba(160,220,255,0.10)` }
      : {}),
  },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  upcomingTitle: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: courtlight.text.hi,
  },
  upcomingMeta: {
    fontSize: 12,
    color: courtlight.text.mid,
    marginTop: 2,
  },
  upcomingType: {
    fontSize: 11,
    color: courtlight.text.low,
    fontFamily: "Inter_400Regular",
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginVertical: 2,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
    color: courtlight.text.hi,
  },
  emptyDetail: {
    fontSize: 13,
    color: courtlight.text.mid,
    marginTop: 4,
  },
  skeleton: {
    height: 14,
    borderRadius: 8,
    marginTop: 10,
  },
});
