import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getAdminTeams, signOut, createTeam } from "../lib/ctpApi";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { courtlight as cl } from "../theme/tokens";

interface TeamItem {
  id: string;
  name: string;
  sport: string | null;
  invite_code: string | null;
  memberCount: number;
}

export default function AdminHomeScreen() {
  const navigation = useNavigation<any>();
  const isDesktop = useIsDesktop();

  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSport, setNewSport] = useState("basketball");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const items = await getAdminTeams();
        if (!cancelled) setTeams(items);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleOpenTeam = (team: TeamItem) => {
    navigation.navigate("AdminTeamDetailScreen", {
      teamId: team.id,
      teamName: team.name,
    });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const result = await createTeam(newName.trim(), newSport.trim());
      setTeams((prev) => [...prev, {
        id: result.team_id,
        name: result.name,
        sport: result.sport,
        invite_code: result.invite_code,
        memberCount: 1,
      }]);
      setShowCreate(false);
      setNewName("");
    } catch (e: any) {
      alert("Error: " + (e?.message || String(e)));
    } finally {
      setCreating(false);
    }
  };

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: cl.bg.court, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
        <Text style={{ color: "white", fontSize: 16, textAlign: "center" }}>Admin home is optimized for web.</Text>
      </View>
    );
  }

  const contentWidth = isDesktop ? 960 : 420;

  return (
    <div style={{
      minHeight: "100vh",
      overflowY: "auto",
      paddingBottom: 80,
      background: cl.bg.vignette,
      backgroundColor: cl.bg.court,
      color: cl.text.hi,
      fontFamily: cl.type.ui,
      padding: isDesktop ? "32px 48px 80px 48px" : "24px 16px 80px 16px",
    }}>
      <div style={{ maxWidth: contentWidth, margin: "0 auto" }}>
        {/* Top bar: logout */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", paddingTop: 16, paddingBottom: 8 }}>
          <button type="button" onClick={() => signOut()} style={{
            padding: "10px 20px", borderRadius: cl.radius.card, border: cl.edge.hair,
            background: "transparent", color: cl.text.hi, fontSize: 14, fontWeight: 600, cursor: "pointer",
            fontFamily: cl.type.ui,
          }}>
            Log Out
          </button>
        </div>

        {/* Logo */}
        <div style={{ paddingTop: 32, paddingBottom: 16 }}>
          <img src="/logo/logo_bon.png" alt="" style={{ width: 240, maxWidth: "80%", height: "auto", display: "block", margin: "0 auto" }} />
        </div>

        {/* Loading / Error / Empty */}
        {loading ? (
          <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <ActivityIndicator color={cl.accent.cyan} />
            <span style={{ color: cl.text.mid, fontSize: 14 }}>Loading teams...</span>
          </div>
        ) : error ? (
          <div style={{ minHeight: 160, color: "#FCA5A5", fontSize: 14 }}>{error}</div>
        ) : teams.length === 0 ? (
          <div style={{ minHeight: 160, color: cl.text.mid, fontSize: 14 }}>No teams found.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr", gap: 16 }}>
            {teams.map((team) => {
              const initials = (team.name || "CT").trim().slice(0, 2).toUpperCase();
              return (
                <button key={team.id} onClick={() => handleOpenTeam(team)} type="button" style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left",
                  width: "100%", padding: 16, borderRadius: cl.radius.card,
                  border: "1px solid rgba(0,212,255,0.2)", borderTop: "2px solid rgba(0,212,255,0.25)",
                  background: cl.surface.card, cursor: "pointer",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  fontFamily: cl.type.ui,
                }}
                onMouseEnter={(e) => { (e.currentTarget as any).style.boxShadow = cl.shadow.glowFocus; }}
                onMouseLeave={(e) => { (e.currentTarget as any).style.boxShadow = "none"; }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(0,212,255,0.15)", color: cl.accent.cyan, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {initials}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700, color: cl.text.hi, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                    {team.name}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: cl.text.low }}>
                    {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}
                  </div>
                  <div style={{ marginTop: 12, padding: "4px 10px", borderRadius: 20, background: "rgba(0,212,255,0.1)", color: cl.accent.cyan, fontSize: 11, letterSpacing: 2 }}>
                    OPERATIONAL
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Create Team */}
        {!loading && !error && (
          <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
            {!showCreate ? (
              <button onClick={() => setShowCreate(true)} type="button" style={{
                padding: "16px 48px", borderRadius: cl.radius.card,
                background: "linear-gradient(135deg, #00BFFF, #0066FF)", border: "none",
                color: cl.text.hi, fontWeight: 700, letterSpacing: 1, fontSize: 14, cursor: "pointer",
                boxShadow: cl.shadow.glowFocus, fontFamily: cl.type.ui,
              }}>
                + CREATE TEAM
              </button>
            ) : (
              <div style={{
                background: cl.surface.card, borderRadius: cl.radius.card,
                border: "1px solid rgba(0,212,255,0.2)", padding: 24, width: "100%", maxWidth: 400,
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: cl.text.hi, marginBottom: 16, fontFamily: cl.type.brand }}>
                  NEW TEAM
                </div>
                <label style={{ display: "block", fontSize: 11, color: cl.text.mid, letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 6 }}>
                  Team Name
                </label>
                <input value={newName} onChange={(e: any) => setNewName(e.target.value)} placeholder="e.g. King University WBB"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,212,255,0.25)", background: "rgba(0,212,255,0.05)", color: "#fff", fontSize: 13, fontFamily: cl.type.ui, outline: "none", boxSizing: "border-box" as const, marginBottom: 12 }} />
                <label style={{ display: "block", fontSize: 11, color: cl.text.mid, letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 6 }}>
                  Sport
                </label>
                <input value={newSport} onChange={(e: any) => setNewSport(e.target.value)} placeholder="basketball"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,212,255,0.25)", background: "rgba(0,212,255,0.05)", color: "#fff", fontSize: 13, fontFamily: cl.type.ui, outline: "none", boxSizing: "border-box" as const, marginBottom: 16 }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={handleCreate} disabled={creating || !newName.trim()} style={{
                    padding: "10px 24px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg, #00BFFF, #0066FF)", color: "#fff", fontWeight: 600, fontSize: 13,
                    cursor: creating ? "not-allowed" : "pointer", opacity: creating || !newName.trim() ? 0.6 : 1, fontFamily: cl.type.ui,
                  }}>
                    {creating ? "Creating..." : "Create"}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)} style={{
                    padding: "10px 24px", borderRadius: 10, border: cl.edge.hair,
                    background: "transparent", color: cl.text.mid, fontSize: 13, cursor: "pointer", fontFamily: cl.type.ui,
                  }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
