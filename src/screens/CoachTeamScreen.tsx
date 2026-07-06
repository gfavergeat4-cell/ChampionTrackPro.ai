import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
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
        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated");

        // Get coach's teamId
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = (userSnap.data() as any) || {};
        const tid: string | null = userData.teamId || null;
        if (!tid) throw new Error("No team linked to your account.");
        if (!cancelled) setTeamId(tid);

        // Get team name
        const teamSnap = await getDoc(doc(db, "teams", tid));
        const teamData = (teamSnap.data() as any) || {};
        if (!cancelled) setTeamName(teamData.name || tid);

        // Get members
        const membersSnap = await getDocs(collection(db, "teams", tid, "members"));
        const memberList: { uid: string; name: string }[] = [];
        await Promise.all(
          membersSnap.docs.map(async (d) => {
            const mData = d.data() as any;
            let name = mData.displayName || mData.name || mData.fullName || d.id;
            let position = mData.position || "";
            let jerseyNumber: number | undefined = mData.jerseyNumber != null ? Number(mData.jerseyNumber) : undefined;
            // Enrich from users/{uid}
            try {
              const uSnap = await getDoc(doc(db, "users", d.id));
              if (uSnap.exists()) {
                const uData = uSnap.data() as any;
                if (uData.fullName) name = uData.fullName;
                if (uData.position) position = uData.position;
                if (uData.jerseyNumber != null) jerseyNumber = Number(uData.jerseyNumber);
              }
            } catch { /* ignore */ }
            memberList.push({ uid: d.id, name, position, jerseyNumber } as any);
          })
        );

        // Get last training
        let lastTrainingId: string | null = null;
        try {
          const lastSnap = await getDocs(
            query(collection(db, "teams", tid, "trainings"), orderBy("startUtc", "desc"), limit(1))
          );
          if (!lastSnap.empty) lastTrainingId = lastSnap.docs[0].id;
        } catch { /* ignore */ }

        // Get responses for last training
        const respondedUids = new Set<string>();
        const worryUids = new Set<string>();
        const frictionUids = new Set<string>();
        if (lastTrainingId) {
          try {
            const respSnap = await getDocs(
              collection(db, "teams", tid, "trainings", lastTrainingId, "responses")
            );
            respSnap.docs.forEach((d) => {
              respondedUids.add(d.id);
              const data = d.data() as any;
              // V3 at-risk detection
              if (data.worryFlag === true) {
                worryUids.add(d.id);
              } else if (
                (typeof data.readinessScore === "number" && data.readinessScore < 40) ||
                (typeof data.frictionImpact === "number" && data.frictionImpact > 70)
              ) {
                frictionUids.add(d.id);
              }
            });
          } catch { /* ignore */ }
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
