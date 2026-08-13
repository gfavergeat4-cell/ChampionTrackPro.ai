import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  getMyMembership,
  getTeamMembers,
  getTeamLatestSessionResponses,
} from "../lib/ctpApi";
import { useIsDesktop } from "../hooks/useIsDesktop";

interface Athlete {
  uid: string;
  name: string;
  position: string;
  jerseyNumber?: number;
  status: "completed" | "pending" | "worry" | "friction";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function CoachTeamScreen() {
  const navigation = useNavigation<any>();
  const isDesktop = useIsDesktop();

  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        // ── Équipe du coach ──────────────────────────────────────────────
        const membership: any = await getMyMembership();
        const tid: string | null = membership?.team_id ?? null;
        if (!tid) throw new Error("No team linked to your account.");
        if (!cancelled) {
          setTeamId(tid);
          setTeamName(membership?.teams?.name || tid);
        }

        // ── Roster + réponses de la dernière séance terminée ─────────────
        const [members, latest] = await Promise.all([
          getTeamMembers(tid),
          getTeamLatestSessionResponses(tid),
        ]);

        const memberList = (members as any[])
          .filter((m) => m.role === "athlete")
          .map((m) => ({
            uid: m.user_id,
            name: m.profiles?.display_name || m.pseudonym || "Player",
            position: m.position || "",
            jerseyNumber: m.jersey_number != null ? Number(m.jersey_number) : undefined,
          }));

        // Détection « at-risk » — mêmes seuils que la V1 (loi de parité) :
        // worry_flag, readiness < 40, friction_impact > 70.
        const respondedUids = new Set<string>();
        const worryUids = new Set<string>();
        const frictionUids = new Set<string>();
        for (const r of latest.responses as any[]) {
          respondedUids.add(r.user_id);
          if (r.worry_flag === true) {
            worryUids.add(r.user_id);
          } else if (
            (typeof r.readiness_score === "number" && r.readiness_score < 40) ||
            (typeof r.friction_impact === "number" && r.friction_impact > 70)
          ) {
            frictionUids.add(r.user_id);
          }
        }

        // Build athlete list with status
        const athleteList: Athlete[] = (memberList as any[]).map((m) => {
          let status: Athlete["status"] = "pending";
          if (respondedUids.has(m.uid)) {
            if (worryUids.has(m.uid)) status = "worry";
            else if (frictionUids.has(m.uid)) status = "friction";
            else status = "completed";
          }
          return { uid: m.uid, name: m.name, position: (m as any).position || "", jerseyNumber: (m as any).jerseyNumber, status };
        });

        // Sort: worry first, friction, then pending, then completed
        athleteList.sort((a, b) => {
          const order = { worry: 0, friction: 1, pending: 2, completed: 3 };
          return order[a.status] - order[b.status];
        });

        if (!cancelled) setAthletes(athleteList);
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
      <View style={{ flex: 1, backgroundColor: "#0A0F1E", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>Team screen is optimized for web.</Text>
      </View>
    );
  }

  const maxWidth = isDesktop ? 960 : 480;

  const statusConfig = {
    completed: { label: "Completed ✅",          color: "#00FF88", bg: "rgba(0,255,136,0.08)",  border: "rgba(0,255,136,0.25)" },
    pending:   { label: "Pending ⏳",             color: "#FFB800", bg: "rgba(255,184,0,0.08)",  border: "rgba(255,184,0,0.25)" },
    worry:     { label: "⚠️ High worry",          color: "#FFB800", bg: "rgba(255,184,0,0.08)",  border: "rgba(255,184,0,0.35)" },
    friction:  { label: "⚡ High friction impact", color: "#FB7100", bg: "rgba(251,113,0,0.08)",  border: "rgba(251,113,0,0.25)" },
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)",
      backgroundColor: "#0A0F1E",
      color: "#FFFFFF",
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      padding: isDesktop ? "40px 48px 80px" : "24px 16px 80px",
      overflowY: "auto",
    }}>
      <div style={{ maxWidth, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: isDesktop ? 28 : 22, fontWeight: 700, color: "#FFFFFF", margin: "0 0 4px" }}>
            My Team
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: "#00D4FF", fontWeight: 500 }}>{teamName}</p>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: 60 }}>
            <ActivityIndicator color="#00D4FF" />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Loading team...</span>
          </div>
        ) : error ? (
          <div style={{ color: "#FCA5A5", fontSize: 14, textAlign: "center", padding: 40 }}>{error}</div>
        ) : athletes.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", padding: 40 }}>
            No athletes in this team yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {athletes.map((athlete) => {
              const cfg = statusConfig[athlete.status];
              const initials = getInitials(athlete.name);
              return (
                <div
                  key={athlete.uid}
                  onClick={() =>
                    navigation.navigate("AthleteDetail", {
                      teamId,
                      teamName,
                      athleteId: athlete.uid,
                      athleteName: athlete.name,
                      jerseyNumber: athlete.jerseyNumber,
                      position: athlete.position,
                    })
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    background: "#0D1526",
                    border: "1px solid rgba(0,212,255,0.12)",
                    borderRadius: 14,
                    padding: "14px 16px",
                    cursor: "pointer",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,212,255,0.4)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,212,255,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,212,255,0.12)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  }}
                >
                  {/* Jersey badge */}
                  {athlete.jerseyNumber != null && (
                    <div style={{
                      minWidth: 30,
                      height: 30,
                      borderRadius: 6,
                      background: "rgba(0,212,255,0.12)",
                      border: "1px solid rgba(0,212,255,0.35)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#00D4FF",
                      flexShrink: 0,
                      padding: "0 6px",
                    }}>
                      #{athlete.jerseyNumber}
                    </div>
                  )}

                  {/* Avatar */}
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #00D4FF22, #4A67FF33)",
                    border: "1px solid rgba(0,212,255,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#00D4FF",
                    flexShrink: 0,
                  }}>
                    {initials || "?"}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {athlete.name}
                    </div>
                    {athlete.position ? (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                        {athlete.position}
                      </div>
                    ) : null}
                  </div>

                  {/* Status badge */}
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: cfg.color,
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    borderRadius: 20,
                    padding: "4px 10px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}>
                    {cfg.label}
                  </span>

                  {/* Arrow */}
                  <svg width="16" height="16" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
