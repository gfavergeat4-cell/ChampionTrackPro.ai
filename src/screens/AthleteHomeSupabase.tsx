import React from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getMyMembership, listSessions, getMyResponseForSession } from "../lib/ctpApi";

const BG = "#0A0F1E";
const CARD = "#0E1528";
const BORDER = "rgba(0,212,255,0.14)";
const TXT = "#FFFFFF";
const MUTED = "#9CA3AF";
const ACCENT = "#00D4FF";

export default function AthleteHomeSupabase() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [teamId, setTeamId] = React.useState<string | null>(null);
  const [toRate, setToRate] = React.useState<any[]>([]);
  const [upcoming, setUpcoming] = React.useState<any[]>([]);

  const load = React.useCallback(async () => {
    try {
      const m: any = await getMyMembership();
      if (!m?.team_id) { setLoading(false); return; }
      setTeamId(m.team_id);
      const now = Date.now();
      const from = new Date(now - 6 * 3600 * 1000).toISOString();   // fenêtre réponse 5 h + marge
      const to = new Date(now + 7 * 24 * 3600 * 1000).toISOString();
      const sessions = await listSessions(m.team_id, from, to);
      const past = (sessions as any[]).filter(
        (s) => !s.cancelled && new Date(s.end_utc).getTime() <= now &&
               now <= new Date(s.end_utc).getTime() + 5 * 3600 * 1000
      );
      const answered = await Promise.all(past.map((s) => getMyResponseForSession(s.id)));
      setToRate(past.filter((_, i) => !answered[i]));
      setUpcoming((sessions as any[])
        .filter((s) => !s.cancelled && new Date(s.start_utc).getTime() > now)
        .slice(0, 5));
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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 120, maxWidth: 560, alignSelf: "center", width: "100%" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ACCENT} />}
    >
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <Image source={{ uri: "/logo/logo_nobackground.png" }} style={{ width: 220, height: 90 }} resizeMode="contain" />
      </View>

      <Text style={{ color: TXT, fontSize: 18, fontWeight: "700", letterSpacing: 1 }}>Sessions to rate</Text>
      <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>Tap respond to complete your check-in.</Text>
      <View style={{ marginTop: 12, gap: 10 }}>
        {toRate.length === 0 ? (
          <View style={{ backgroundColor: CARD, borderColor: BORDER, borderWidth: 1, borderRadius: 12, padding: 16 }}>
            <Text style={{ color: MUTED, fontSize: 14 }}>Nothing to rate right now. You are all caught up.</Text>
          </View>
        ) : (
          toRate.map((s) => (
            <View key={s.id} style={{ backgroundColor: CARD, borderColor: BORDER, borderWidth: 1, borderRadius: 12,
              padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ color: TXT, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>{s.title || "Training"}</Text>
                <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{fmt(s.start_utc)} – {fmt(s.end_utc)}</Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate("Questionnaire", { trainingId: s.id, teamId, eventTitle: s.title })}
                style={{ height: 40, paddingHorizontal: 18, borderRadius: 8, alignItems: "center", justifyContent: "center",
                  backgroundColor: ACCENT, boxShadow: "0 0 24px rgba(0,180,255,0.35)" }}
              >
                <Text style={{ color: "#04121F", fontSize: 13, fontWeight: "700" }}>Respond</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <Text style={{ color: TXT, fontSize: 18, fontWeight: "700", letterSpacing: 1, marginTop: 28 }}>Next sessions</Text>
      <View style={{ marginTop: 12, gap: 8 }}>
        {upcoming.length === 0 ? (
          <Text style={{ color: MUTED, fontSize: 14 }}>No upcoming session on the calendar.</Text>
        ) : (
          upcoming.map((s) => (
            <View key={s.id} style={{ backgroundColor: CARD, borderColor: BORDER, borderWidth: 1, borderRadius: 10, padding: 14 }}>
              <Text style={{ color: TXT, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{s.title || "Training"}</Text>
              <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{fmtDay(s.start_utc)} · {fmt(s.start_utc)} – {fmt(s.end_utc)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
