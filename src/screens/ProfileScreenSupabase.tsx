// ProfileScreenSupabase.tsx — Profil athlète Supabase (parité StitchProfileScreen)
// Affichage/édition profil, notification status, LOGOUT Supabase, Courtlight styling.
import React from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, RefreshControl,
  StyleSheet, Platform, Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { CommonActions } from "@react-navigation/native";
import { getMyProfile, updateMyProfile, signOut } from "../lib/ctpApi";
import { courtlight as cl } from "../theme/tokens";

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
export default function ProfileScreenSupabase() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [notifPermission, setNotifPermission] = React.useState("default");

  // Profile data
  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [jerseyNumber, setJerseyNumber] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [teamName, setTeamName] = React.useState("");
  const [pseudonym, setPseudonym] = React.useState("");
  const [role, setRole] = React.useState("");

  // Edit form state
  const [editName, setEditName] = React.useState("");
  const [editJersey, setEditJersey] = React.useState("");
  const [editPosition, setEditPosition] = React.useState("");

  // ── Load profile ──
  const loadProfile = React.useCallback(async () => {
    try {
      const data = await getMyProfile();
      if (!data) { setLoading(false); return; }

      setEmail(data.user?.email ?? "");
      setDisplayName(data.profile?.display_name ?? "");
      setJerseyNumber(data.profile?.jersey_number != null ? String(data.profile.jersey_number) : "");
      setPosition(data.profile?.position ?? "");
      setTeamName((data.membership as any)?.teams?.name ?? "");
      setPseudonym((data.membership as any)?.pseudonym ?? "");
      setRole((data.membership as any)?.role ?? "");

      // Sync edit form
      setEditName(data.profile?.display_name ?? "");
      setEditJersey(data.profile?.jersey_number != null ? String(data.profile.jersey_number) : "");
      setEditPosition(data.profile?.position ?? "");
    } catch (e) {
      console.warn("[PROFILE][SUPA] load failed:", (e as any)?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { loadProfile(); }, [loadProfile]);

  // ── Notification permission check (web only) ──
  React.useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const check = () => {
      if (typeof Notification === "undefined") {
        setNotifPermission("denied");
        return;
      }
      setNotifPermission(Notification.permission);
    };

    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  // ── Save profile ──
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMyProfile({
        display_name: editName.trim() || undefined,
        jersey_number: editJersey.trim() ? parseInt(editJersey, 10) : undefined,
        position: editPosition.trim() || undefined,
      });
      setDisplayName(editName.trim());
      setJerseyNumber(editJersey.trim());
      setPosition(editPosition.trim());
      setEditing(false);
    } catch (e) {
      console.warn("[PROFILE][SUPA] save failed:", (e as any)?.message);
      if (Platform.OS === "web") alert("Error saving profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(displayName);
    setEditJersey(jerseyNumber);
    setEditPosition(position);
    setEditing(false);
  };

  // ── Logout (Supabase) ──
  const handleLogout = async () => {
    try {
      await signOut();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "AuthStack" }],
        }),
      );
    } catch (error) {
      console.error("Error during logout:", error);
      if (Platform.OS === "web") alert("Logout failed.");
    }
  };

  // ── Request notification permission ──
  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  // ── Render ──
  if (Platform.OS !== "web") return null;

  if (loading) {
    return (
      <ScrollView style={s.scroll} contentContainerStyle={s.container}>
        <View style={{ alignItems: "center", marginTop: 20 }}>
          <Skeleton width="40%" />
        </View>
        <View style={[s.card, { marginTop: 20 }]}>
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
            onRefresh={() => { setRefreshing(true); loadProfile(); }}
            tintColor={cl.accent.cyan}
          />
        }
      >
        {/* Header */}
        <Text style={s.brand}>CHAMPION<Text style={s.brandAccent}>TRACK</Text>PRO</Text>
        <Text style={s.headerTitle}>Profile</Text>

        {/* ── Avatar placeholder ── */}
        <View style={s.avatarWrap}>
          <View style={s.avatar}>
            <Text style={s.avatarInitial}>
              {(displayName || email || "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* ── Profile info card ── */}
        <View style={s.card}>
          <Text style={s.miniLabel}>PROFILE DETAILS</Text>

          {/* Display Name */}
          <Text style={s.fieldLabel}>Display Name</Text>
          {editing ? (
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
              placeholderTextColor={cl.text.low}
              style={s.input}
            />
          ) : (
            <Text style={s.fieldValue}>{displayName || "Not set"}</Text>
          )}

          {/* Email (read-only) */}
          <Text style={s.fieldLabel}>Email</Text>
          <Text style={s.fieldValue}>{email}</Text>

          {/* Jersey Number */}
          <Text style={s.fieldLabel}>Jersey Number</Text>
          {editing ? (
            <TextInput
              value={editJersey}
              onChangeText={setEditJersey}
              placeholder="Enter jersey number"
              placeholderTextColor={cl.text.low}
              keyboardType="numeric"
              style={s.input}
            />
          ) : (
            <Text style={s.fieldValue}>{jerseyNumber || "Not set"}</Text>
          )}

          {/* Position */}
          <Text style={s.fieldLabel}>Position</Text>
          {editing ? (
            <TextInput
              value={editPosition}
              onChangeText={setEditPosition}
              placeholder="e.g. Guard, Forward, Center"
              placeholderTextColor={cl.text.low}
              style={s.input}
            />
          ) : (
            <Text style={s.fieldValue}>{position || "Not set"}</Text>
          )}

          {/* Team info (read-only) */}
          {teamName ? (
            <>
              <Text style={s.fieldLabel}>Team</Text>
              <Text style={s.fieldValue}>{teamName}</Text>
            </>
          ) : null}

          {pseudonym ? (
            <>
              <Text style={s.fieldLabel}>Pseudonym</Text>
              <Text style={[s.fieldValue, { color: cl.accent.cyan }]}>{pseudonym}</Text>
            </>
          ) : null}
        </View>

        {/* ── Notifications section ── */}
        <View style={s.card}>
          <Text style={s.miniLabel}>NOTIFICATIONS</Text>

          {notifPermission === "granted" ? (
            <View style={s.notifRow}>
              <View style={[s.notifDot, { backgroundColor: "#00FF9D" }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.notifStatus}>Active</Text>
                <Text style={s.notifDetail}>You'll be alerted after each session.</Text>
              </View>
            </View>
          ) : notifPermission === "denied" ? (
            <View style={s.notifRow}>
              <View style={[s.notifDot, { backgroundColor: cl.zone.YELLOW }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.notifStatus, { color: cl.zone.YELLOW }]}>Blocked</Text>
                <Text style={s.notifDetail}>Check your browser notification settings to enable alerts.</Text>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={requestNotifPermission}
              style={s.notifRow}
            >
              <View style={[s.notifDot, { backgroundColor: "#EF4444" }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.notifStatus, { color: "#EF4444" }]}>Inactive - Tap to enable</Text>
                <Text style={s.notifDetail}>You won't receive session alerts.</Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* ── Action buttons ── */}
        {!editing ? (
          <View style={s.actionsCol}>
            <Pressable
              onPress={() => setEditing(true)}
              style={({ pressed }) => [s.primaryBtn, pressed && s.btnPressed]}
            >
              <Text style={s.primaryBtnText}>Edit Profile</Text>
            </Pressable>

            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [s.logoutBtn, pressed && s.btnPressed]}
            >
              <Text style={s.logoutBtnText}>Log out</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.actionsCol}>
            <View style={s.editBtnRow}>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [s.primaryBtn, { flex: 1 }, pressed && s.btnPressed]}
              >
                <Text style={s.primaryBtnText}>
                  {saving ? "Saving..." : "Save Changes"}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [s.cancelBtn, { flex: 1 }, pressed && s.btnPressed]}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [s.logoutBtn, pressed && s.btnPressed]}
            >
              <Text style={s.logoutBtnText}>Log out</Text>
            </Pressable>
          </View>
        )}

        <Text style={s.footer}>
          ChampionTrackPro - Your data belongs to your team.
        </Text>
      </ScrollView>

      {/* Bottom tab bar */}
      <BottomTabBar active="Profile" />
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
  brand: {
    fontFamily: "Marcellus_400Regular",
    fontSize: 12,
    letterSpacing: 4,
    color: cl.text.mid,
    textAlign: "center" as any,
    marginBottom: 4,
  },
  brandAccent: {
    color: cl.accent.cyan,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
    color: cl.text.hi,
    textAlign: "center" as any,
  },
  avatarWrap: {
    alignItems: "center" as any,
    marginTop: 20,
    marginBottom: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: "rgba(0,212,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? {
          background: "linear-gradient(145deg, rgba(0,212,255,0.25), rgba(7,11,20,0.90))",
          boxShadow: "0 12px 30px rgba(0,0,0,0.4), inset 0 0 14px rgba(0,212,255,0.15)",
        }
      : { backgroundColor: "rgba(0,212,255,0.15)" }),
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: "300",
    fontFamily: "Inter_300Light",
    color: cl.text.hi,
  },
  card: {
    backgroundColor: cl.surface.card,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.10)",
    borderRadius: cl.radius.card,
    padding: 20,
    marginTop: 12,
    ...(Platform.OS === "web"
      ? { boxShadow: `${cl.shadow.e1}, inset 0 1px 0 rgba(160,220,255,0.10)` }
      : {}),
  },
  miniLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    color: cl.text.mid,
    textTransform: "uppercase" as any,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: cl.text.mid,
    marginTop: 14,
    marginBottom: 4,
    textTransform: "uppercase" as any,
    letterSpacing: 0.8,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
    color: cl.text.hi,
  },
  input: {
    height: 44,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.20)",
    borderRadius: cl.radius.control,
    color: cl.text.hi,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  notifDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  notifStatus: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: cl.text.hi,
  },
  notifDetail: {
    fontSize: 12,
    color: cl.text.low,
    marginTop: 1,
  },
  actionsCol: {
    marginTop: 24,
    gap: 12,
  },
  editBtnRow: {
    flexDirection: "row",
    gap: 12,
  },
  primaryBtn: {
    height: 48,
    borderRadius: cl.radius.control,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { background: "linear-gradient(135deg, #00D4FF, #0066FF)", boxShadow: "0 8px 24px rgba(0,120,255,0.30)" }
      : { backgroundColor: cl.accent.cyan }),
  },
  primaryBtnText: {
    color: "#04121F",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  cancelBtn: {
    height: 48,
    borderRadius: cl.radius.control,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: cl.text.hi,
  },
  logoutBtn: {
    height: 48,
    borderRadius: cl.radius.control,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: "#F98A8A",
  },
  footer: {
    fontSize: 11,
    color: cl.text.low,
    textAlign: "center" as any,
    marginTop: 28,
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
