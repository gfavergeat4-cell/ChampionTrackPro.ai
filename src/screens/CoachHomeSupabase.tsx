// CoachHomeSupabase.tsx — Morning Brief coach (doc 06 §7.1)
// Courtlight: GlassCard brief, count-up héros, roster mini-halos, Team setup accordéon
import React from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl, TextInput,
  StyleSheet, Platform, Animated,
} from "react-native";
import { getMyMembership, getTeamMetrics, getLatestBrief, sendCoachFeedback, getTeamMembers, setTeamCalendar, triggerIcsSync } from "../lib/ctpApi";
import { courtlight } from "../theme/tokens";
import ReadinessHalo from "../components/ReadinessHalo";
import GlassCard from "../components/GlassCard";

type Zone = "GREEN" | "BLUE" | "YELLOW" | "INSUFFICIENT_DATA";

// ── Skeleton warm-up (doc 06 §6) ──
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
  return (
    <Animated.View style={[s.skeleton, { width, backgroundColor: bg }]} />
  );
}

// ── Team average from roster ──
function teamAvg(rows: any[]): { score: number; zone: Zone } {
  const valid = rows.filter((r) => r.readiness != null);
  if (valid.length === 0) return { score: 0, zone: "INSUFFICIENT_DATA" as Zone };
  const avg = Math.round(valid.reduce((a: number, b: any) => a + b.readiness, 0) / valid.length);
  const zone = avg >= 75 ? "GREEN" : avg >= 50 ? "BLUE" : "YELLOW";
  return { score: avg, zone: zone as Zone };
}

// ── Count-up display (600ms, 1×/day) ──
function useCountUp(target: number, enabled: boolean) {
  const [val, setVal] = React.useState(enabled ? 0 : target);
  const done = React.useRef(false);
  React.useEffect(() => {
    if (!enabled || done.current) { setVal(target); return; }
    done.current = true;
    let start: number | null = null;
    let raf: number;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / courtlight.motion.hero, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return val;
}

// ── Brief number inline highlight ──
function BriefBody({ text }: { text: string }) {
  // Highlight numbers in the brief text (cyan + tabular-nums)
  const parts = text.split(/(\b\d+(?:\.\d+)?%?\b)/g);
  return (
    <Text style={s.briefText}>
      {parts.map((part, i) =>
        /^\d/.test(part) ? (
          <Text key={i} style={s.briefNum}>{part}</Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

export default function CoachHomeSupabase() {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [teamId, setTeamId] = React.useState<string | null>(null);
  const [teamName, setTeamName] = React.useState("");
  const [brief, setBrief] = React.useState<any>(null);
  const [rows, setRows] = React.useState<any[]>([]);
  const [athleteCount, setAthleteCount] = React.useState(0);
  const [feedbackSent, setFeedbackSent] = React.useState<string | null>(null);
  const [icsUrl, setIcsUrl] = React.useState("");
  const [icsSaved, setIcsSaved] = React.useState<string | null>(null);
  const [inviteCode, setInviteCode] = React.useState("");
  const [setupOpen, setSetupOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const m: any = await getMyMembership();
      if (!m?.team_id) { setLoading(false); return; }
      setTeamId(m.team_id);
      setTeamName(m.teams?.name ?? "My team");
      setIcsUrl(m.teams?.ics_url ?? "");
      setInviteCode(m.teams?.invite_code ?? "");
      const today = new Date().toISOString().slice(0, 10);
      const [metrics, members, b] = await Promise.all([
        getTeamMetrics(m.team_id, today),
        getTeamMembers(m.team_id),
        getLatestBrief(m.team_id),
      ]);
      const nameByUid: Record<string, string> = {};
      let athletes = 0;
      for (const mem of members as any[]) {
        if (mem.role === "athlete") athletes++;
        nameByUid[mem.user_id] = mem.profiles?.display_name || mem.pseudonym || "Player";
      }
      setAthleteCount(athletes);
      setRows(
        (metrics as any[])
          .map((r) => ({ ...r, name: nameByUid[r.user_id] ?? "Player" }))
          .sort((a, b) => {
            // Priority sort: flagged / low zone first
            const zOrd = (z: string) => z === "YELLOW" ? 0 : z === "BLUE" ? 1 : z === "INSUFFICIENT_DATA" ? 3 : 2;
            return zOrd(a.zone) - zOrd(b.zone);
          })
      );
      setBrief(b);
    } catch (e) {
      console.warn("[COACH][SUPA] load failed:", (e as any)?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const fb = async (action: "useful" | "noise") => {
    if (!teamId || !brief) return;
    try {
      await sendCoachFeedback({ teamId, briefId: brief.id, action });
      setFeedbackSent(action);
    } catch (e) {
      console.warn("[COACH][SUPA] feedback failed:", (e as any)?.message);
    }
  };

  const saveCalendar = async () => {
    if (!teamId) return;
    try {
      setIcsSaved("saving");
      await setTeamCalendar(teamId, icsUrl.trim());
      await triggerIcsSync();
      setIcsSaved("done");
      load();
    } catch (e) {
      console.warn("[COACH][SUPA] set calendar failed:", (e as any)?.message);
      setIcsSaved("error");
    }
  };

  // Team average for hero
  const avg = teamAvg(rows);
  const heroScore = useCountUp(avg.score, !loading && rows.length > 0);
  const complianceTxt = athleteCount > 0 ? `${rows.length}/${athleteCount}` : "—";

  // ── Loading: skeleton warm-up ──
  if (loading) {
    return (
      <ScrollView style={s.scroll} contentContainerStyle={s.container}>
        <Text style={s.teamLabel}>&nbsp;</Text>
        <Skeleton width="50%" />
        <View style={[s.card, { marginTop: 16 }]}>
          <Skeleton width="80%" />
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </View>
        <View style={[s.card, { marginTop: 12 }]}>
          <Skeleton width="70%" />
          <Skeleton width="50%" />
        </View>
      </ScrollView>
    );
  }

  const today = brief?.brief_date ?? new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={courtlight.accent.cyan} />}
    >
      {/* ── Header: identité équipe (Marcellus) ── */}
      <Text style={s.teamLabel}>{teamName.toUpperCase()}</Text>
      <Text style={s.date}>{today} · check-ins {complianceTxt}</Text>

      {/* ── Verre de focus : brief IA ── */}
      <GlassCard glow style={{ marginTop: 16 }}>
        <View style={s.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.miniLabel}>TEAM READINESS</Text>
            <Text style={s.heroScore}>{heroScore}</Text>
            {avg.score > 0 && (
              <Text style={s.tinyText}>
                vs team baseline <Text style={s.briefNum}>—</Text>
              </Text>
            )}
          </View>
          <ReadinessHalo
            score={avg.score}
            zone={avg.zone === "INSUFFICIENT_DATA" ? "NONE" : avg.zone}
            size={76}
            baselinePct={avg.score > 0 ? Math.max(20, avg.score - 5) : null}
            animate
          />
        </View>

        {brief ? (
          <>
            <View style={{ marginTop: 10 }}>
              <BriefBody text={brief.body} />
            </View>
            <View style={s.fbRow}>
              <Pressable
                onPress={() => fb("useful")}
                disabled={!!feedbackSent}
                style={({ pressed }) => [
                  s.fbBtn,
                  feedbackSent === "useful" && s.fbUseful,
                  pressed && s.btnPressed,
                ]}
              >
                <Text style={[s.fbLabel, feedbackSent === "useful" && { color: courtlight.zone.GREEN }]}>Useful</Text>
              </Pressable>
              <Pressable
                onPress={() => fb("noise")}
                disabled={!!feedbackSent}
                style={({ pressed }) => [
                  s.fbBtn,
                  feedbackSent === "noise" && s.fbNoise,
                  pressed && s.btnPressed,
                ]}
              >
                <Text style={[s.fbLabel, feedbackSent === "noise" && { color: courtlight.zone.YELLOW }]}>Noise</Text>
              </Pressable>
            </View>
            {feedbackSent && (
              <Text style={s.fbNote}>Feedback saved — this trains what matters to you.</Text>
            )}
          </>
        ) : (
          <Text style={[s.briefText, { color: courtlight.text.mid, marginTop: 10 }]}>
            No brief yet. It is generated every morning once athletes check in.
          </Text>
        )}
      </GlassCard>

      {/* ── Roster : mini-halos + delta vs baseline ── */}
      <Text style={s.sectionTitle}>Readiness today</Text>
      <View style={s.card}>
        {rows.length === 0 ? (
          <Text style={{ color: courtlight.text.mid, fontSize: 14 }}>
            {athleteCount > 0
              ? `Waiting for check-ins — ${athleteCount} athletes on the roster.`
              : "No athletes have joined yet."}
          </Text>
        ) : (
          rows.map((r, i) => (
            <View key={r.user_id} style={[s.rosterRow, i < rows.length - 1 && s.rosterBorder]}>
              <View style={s.rosterLeft}>
                <ReadinessHalo
                  score={r.readiness != null ? Math.round(r.readiness) : 0}
                  zone={r.zone === "INSUFFICIENT_DATA" ? "NONE" : r.zone}
                  size={34}
                  baselinePct={r.ema_28 != null ? Math.round(r.ema_28) : null}
                />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={s.playerName} numberOfLines={1}>{r.name}</Text>
                  <Text style={s.playerDelta}>
                    {r.zone === "INSUFFICIENT_DATA"
                      ? `building baseline (${r.data_days ?? 0}d)`
                      : `${r.deviation_pct > 0 ? "+" : ""}${r.deviation_pct ?? 0}% vs baseline`}
                  </Text>
                </View>
              </View>
              <Text style={s.playerScore}>
                {r.readiness != null ? Math.round(r.readiness) : "—"}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* ── Team setup : accordéon ── */}
      <Pressable
        onPress={() => setSetupOpen(!setupOpen)}
        style={({ pressed }) => [s.accordionHeader, pressed && s.btnPressed]}
      >
        <Text style={s.sectionTitle}>Team setup</Text>
        <Text style={{ color: courtlight.text.mid, fontSize: 14 }}>{setupOpen ? "▲" : "▼"}</Text>
      </Pressable>
      {setupOpen && (
        <View style={s.card}>
          <Text style={s.setupLabel}>Invite code for your athletes</Text>
          <Text style={s.inviteCode}>{inviteCode || "—"}</Text>

          <Text style={[s.setupLabel, { marginTop: 16 }]}>
            Training calendar — paste your Google Calendar secret iCal address
          </Text>
          <TextInput
            value={icsUrl}
            onChangeText={(v) => { setIcsUrl(v); setIcsSaved(null); }}
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            placeholderTextColor={courtlight.text.low}
            autoCapitalize="none"
            autoCorrect={false}
            style={s.icsInput}
          />
          <Pressable
            onPress={saveCalendar}
            style={({ pressed }) => [s.primaryBtn, pressed && s.btnPressed]}
          >
            <Text style={s.primaryBtnText}>
              {icsSaved === "saving" ? "Syncing…" : "Save & sync calendar"}
            </Text>
          </Pressable>
          {icsSaved === "done" && (
            <Text style={[s.fbNote, { color: courtlight.zone.GREEN }]}>Calendar connected — sessions are syncing.</Text>
          )}
          {icsSaved === "error" && (
            <Text style={[s.fbNote, { color: courtlight.zone.YELLOW }]}>Could not save — check the URL.</Text>
          )}
        </View>
      )}

      <Text style={s.footer}>
        Signals are computed from each athlete's own 28-day baseline. Decisions stay yours.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "transparent", // Court scene visible behind
  },
  container: {
    padding: 18,
    paddingTop: 52,
    paddingBottom: 120,
    maxWidth: 560,
    alignSelf: "center" as any,
    width: "100%",
  },
  teamLabel: {
    fontFamily: "Marcellus_400Regular",
    fontSize: 12,
    letterSpacing: 4,
    color: courtlight.text.mid,
    textAlign: "center" as any,
  },
  date: {
    fontSize: 13,
    color: courtlight.text.mid,
    textAlign: "center" as any,
    marginTop: 2,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  miniLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    color: courtlight.text.mid,
    textTransform: "uppercase" as any,
  },
  heroScore: {
    fontSize: 48,
    fontWeight: "300",
    fontFamily: "Inter_300Light",
    color: courtlight.text.hi,
    lineHeight: 56,
    ...(Platform.OS === "web" ? { fontVariantNumeric: "tabular-nums" } : {}),
  },
  tinyText: {
    fontSize: 11,
    color: courtlight.text.low,
  },
  briefText: {
    fontSize: 14,
    lineHeight: 23,
    color: courtlight.text.hi,
    fontFamily: "Inter_400Regular",
  },
  briefNum: {
    color: courtlight.accent.cyan,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
    ...(Platform.OS === "web" ? { fontVariantNumeric: "tabular-nums" } : {}),
  },
  fbRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  fbBtn: {
    flex: 1,
    height: 42,
    borderRadius: courtlight.radius.control,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.10)",
  },
  fbUseful: {
    borderColor: courtlight.zone.GREEN,
    backgroundColor: "rgba(0,200,83,0.14)",
  },
  fbNoise: {
    borderColor: courtlight.zone.YELLOW,
    backgroundColor: "rgba(255,184,0,0.14)",
  },
  fbLabel: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: courtlight.text.hi,
  },
  fbNote: {
    fontSize: 12,
    color: courtlight.text.mid,
    textAlign: "center" as any,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: courtlight.text.hi,
    letterSpacing: 0.3,
    marginTop: 22,
    marginBottom: 4,
  },
  card: {
    backgroundColor: courtlight.surface.card,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.10)",
    borderRadius: courtlight.radius.card,
    padding: 16,
    marginTop: 8,
    ...(Platform.OS === "web"
      ? { boxShadow: `${courtlight.shadow.e1}, inset 0 1px 0 rgba(160,220,255,0.10)` }
      : {}),
  },
  rosterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  rosterBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  rosterLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: courtlight.text.hi,
  },
  playerDelta: {
    fontSize: 11,
    color: courtlight.text.low,
    marginTop: 1,
  },
  playerScore: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
    color: courtlight.text.hi,
    ...(Platform.OS === "web" ? { fontVariantNumeric: "tabular-nums" } : {}),
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 0,
  },
  setupLabel: {
    fontSize: 12,
    color: courtlight.text.mid,
  },
  inviteCode: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
    color: courtlight.accent.cyan,
    letterSpacing: 2,
    marginTop: 2,
  },
  icsInput: {
    height: 44,
    backgroundColor: "rgba(7,11,20,0.8)",
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.10)",
    borderRadius: courtlight.radius.control,
    color: courtlight.text.hi,
    paddingHorizontal: 12,
    fontSize: 13,
    marginTop: 8,
    fontFamily: "Inter_400Regular",
  },
  primaryBtn: {
    height: 42,
    borderRadius: courtlight.radius.control,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    ...(Platform.OS === "web"
      ? { background: "linear-gradient(135deg, #00D4FF, #0066FF)", boxShadow: "0 6px 20px rgba(0,120,255,0.35)" }
      : { backgroundColor: courtlight.accent.cyan }),
  },
  primaryBtnText: {
    color: "#04121F",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  footer: {
    fontSize: 11,
    color: courtlight.text.low,
    textAlign: "center" as any,
    marginTop: 24,
  },
  skeleton: {
    height: 14,
    borderRadius: 8,
    marginTop: 10,
  },
});
