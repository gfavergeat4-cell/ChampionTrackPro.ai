import React from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { getMyMembership, getTeamMetrics, getLatestBrief, sendCoachFeedback, getTeamMembers, setTeamCalendar, triggerIcsSync } from "../lib/ctpApi";

const ZONE_COLORS: Record<string, string> = {
  GREEN: "#00C853",
  BLUE: "#2196F3",
  YELLOW: "#FFB800",
  INSUFFICIENT_DATA: "rgba(255,255,255,0.25)",
};

const BG = "#0A0F1E";
const CARD = "#0E1528";
const BORDER = "rgba(0,212,255,0.14)";
const TXT = "#FFFFFF";
const MUTED = "#9CA3AF";
const ACCENT = "#00D4FF";

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
      setRows((metrics as any[]).map((r) => ({ ...r, name: nameByUid[r.user_id] ?? "Player" })));
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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  const complianceTxt = athleteCount > 0 ? `${rows.length}/${athleteCount}` : "—";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 120, maxWidth: 560, alignSelf: "center", width: "100%" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ACCENT} />}
    >
      <Text style={{ color: MUTED, fontSize: 13, letterSpacing: 2, textTransform: "uppercase" }}>{teamName}</Text>
      <Text style={{ color: TXT, fontSize: 26, fontWeight: "700", marginTop: 4 }}>Morning brief</Text>
      <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>
        {brief?.brief_date ?? new Date().toISOString().slice(0, 10)} · check-ins today: {complianceTxt}
      </Text>

      <View style={{ backgroundColor: CARD, borderColor: "rgba(0,212,255,0.35)", borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 16, boxShadow: "0 0 30px rgba(0,180,255,0.18)" }}>
        {brief ? (
          <>
            <Text style={{ color: TXT, fontSize: 14, lineHeight: 22 }}>{brief.body}</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={() => fb("useful")}
                disabled={!!feedbackSent}
                style={{ flex: 1, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center",
                  backgroundColor: feedbackSent === "useful" ? "rgba(0,200,83,0.18)" : "rgba(255,255,255,0.06)",
                  borderWidth: 1, borderColor: feedbackSent === "useful" ? "#00C853" : BORDER }}
              >
                <Text style={{ color: feedbackSent === "useful" ? "#00C853" : TXT, fontSize: 13, fontWeight: "600" }}>Useful</Text>
              </Pressable>
              <Pressable
                onPress={() => fb("noise")}
                disabled={!!feedbackSent}
                style={{ flex: 1, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center",
                  backgroundColor: feedbackSent === "noise" ? "rgba(255,184,0,0.18)" : "rgba(255,255,255,0.06)",
                  borderWidth: 1, borderColor: feedbackSent === "noise" ? "#FFB800" : BORDER }}
              >
                <Text style={{ color: feedbackSent === "noise" ? "#FFB800" : TXT, fontSize: 13, fontWeight: "600" }}>Noise</Text>
              </Pressable>
            </View>
            {feedbackSent ? (
              <Text style={{ color: MUTED, fontSize: 12, marginTop: 8, textAlign: "center" }}>
                Feedback saved — this trains what matters to you.
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={{ color: MUTED, fontSize: 14 }}>
            No brief yet. It is generated automatically every morning once athletes start checking in.
          </Text>
        )}
      </View>

      <Text style={{ color: TXT, fontSize: 18, fontWeight: "700", marginTop: 28 }}>Readiness today</Text>
      <View style={{ marginTop: 10, gap: 8 }}>
        {rows.length === 0 ? (
          <Text style={{ color: MUTED, fontSize: 14 }}>No check-ins yet today.</Text>
        ) : (
          rows.map((r) => (
            <View key={r.user_id} style={{ backgroundColor: CARD, borderColor: BORDER, borderWidth: 1, borderRadius: 10,
              padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ZONE_COLORS[r.zone] ?? ZONE_COLORS.INSUFFICIENT_DATA }} />
                <Text style={{ color: TXT, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>{r.name}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: TXT, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{r.readiness != null ? Math.round(r.readiness) : "—"}</Text>
                <Text style={{ color: MUTED, fontSize: 11 }}>
                  {r.zone === "INSUFFICIENT_DATA"
                    ? `building baseline (${r.data_days}d)`
                    : `${r.deviation_pct > 0 ? "+" : ""}${r.deviation_pct ?? 0}% vs baseline`}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={{ color: TXT, fontSize: 18, fontWeight: "700", marginTop: 28 }}>Team setup</Text>
      <View style={{ backgroundColor: CARD, borderColor: BORDER, borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 10 }}>
        <Text style={{ color: MUTED, fontSize: 12 }}>Invite code for your athletes</Text>
        <Text style={{ color: ACCENT, fontSize: 20, fontWeight: "700", letterSpacing: 2, marginTop: 2 }}>{inviteCode || "—"}</Text>

        <Text style={{ color: MUTED, fontSize: 12, marginTop: 16 }}>
          Training calendar — paste your Google Calendar secret iCal address, sessions sync automatically every 15 min
        </Text>
        <TextInput
          value={icsUrl}
          onChangeText={(v) => { setIcsUrl(v); setIcsSaved(null); }}
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          placeholderTextColor="rgba(255,255,255,0.25)"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ height: 44, backgroundColor: "#0D1526", borderColor: BORDER, borderWidth: 1, borderRadius: 8,
            color: TXT, paddingHorizontal: 12, fontSize: 13, marginTop: 8 }}
        />
        <Pressable
          onPress={saveCalendar}
          style={{ height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center",
            backgroundColor: ACCENT, marginTop: 10 }}
        >
          <Text style={{ color: "#04121F", fontSize: 13, fontWeight: "700" }}>
            {icsSaved === "saving" ? "Syncing…" : "Save & sync calendar"}
          </Text>
        </Pressable>
        {icsSaved === "done" ? (
          <Text style={{ color: "#00C853", fontSize: 12, marginTop: 8, textAlign: "center" }}>Calendar connected — sessions are syncing.</Text>
        ) : icsSaved === "error" ? (
          <Text style={{ color: "#FFB800", fontSize: 12, marginTop: 8, textAlign: "center" }}>Could not save — check the URL (must start with https).</Text>
        ) : null}
      </View>

      <Text style={{ color: MUTED, fontSize: 11, marginTop: 24, textAlign: "center" }}>
        Signals are computed from each athlete's own 28-day baseline. Decisions stay yours.
      </Text>
    </ScrollView>
  );
}
