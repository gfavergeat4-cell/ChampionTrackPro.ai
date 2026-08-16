// ProfileScreenSupabase.tsx — Profil athlète Supabase (parité StitchProfileScreen)
// Affichage/edition profil, etat des notifications, logout Supabase.
// DA : identique a AthleteHomeNew et ScheduleScreenNew (meme coquille,
// meme degrade, memes cartes en verre, meme en-tete de marque).
import React from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, RefreshControl,
  StyleSheet, Platform, Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { CommonActions } from "@react-navigation/native";
import { getMyProfile, updateMyProfile, signOut } from "../lib/ctpApi";
import {
  registerVapidPush,
  ensurePushSubscriptionSynced,
  clearPushOnboardingSkipped,
} from "../services/vapidPush";
import { courtlight as cl } from "../theme/tokens";
import MobileViewport from "../components/MobileViewport";
import UnifiedAthleteNavigation from "../stitch_components/UnifiedAthleteNavigation";

// Postes NCAA. Liste figée : une saisie libre produit "PG", "Point guard",
// "1" et "Meneur" pour le même poste, et rend tout regroupement impossible.
const POSITIONS = [
  "Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center",
] as const;

const P = {
  // DA athlète — RELEVÉE sur AthleteHomeNew et ScheduleScreenNew, qui font
  // référence pour cet onglet. Le profil suivait la palette du check-in
  // (#141A24, liseré cyan interne) : proche, mais visiblement différente.
  shell: "#0A0F1A",
  backdrop:
    "linear-gradient(180deg, #0E1528 0%, #090F1F 35%, #050910 100%), " +
    "radial-gradient(circle at 50% 0%, rgba(0, 224, 255, 0.08) 0%, rgba(0, 0, 0, 0) 55%), " +
    "radial-gradient(circle at 0% 100%, rgba(74, 103, 255, 0.12) 0%, rgba(0, 0, 0, 0) 60%)",
  // Cartes en verre, identiques à celles de Home
  card: "rgba(255, 255, 255, 0.06)",
  cardBorder: "rgba(0, 224, 255, 0.35)",
  cardShadow: "0 10px 30px rgba(0, 0, 0, 0.45), inset 0 0 22px rgba(0, 224, 255, 0.04)",
  radius: 18,
  accent: "#00E0FF",
  accentDeep: "#4A67FF",
  textHi: "rgba(255,255,255,0.92)",
  textMid: "rgba(154,163,178,0.7)",
  textLow: "rgba(154,163,178,0.45)",
  inactive: "rgba(255,255,255,0.08)",
};

// Chrome ignore scrollbarWidth : il faut la pseudo-classe WebKit.
// Injectee une fois, comme le fait LogoSlider.
const HIDE_SCROLLBAR_ID = "ctp-hide-scrollbar";
function useHideScrollbar() {
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(HIDE_SCROLLBAR_ID)) return;
    const el = document.createElement("style");
    el.id = HIDE_SCROLLBAR_ID;
    el.textContent =
      ".ctp-noscroll::-webkit-scrollbar{width:0;height:0;display:none}" +
      ".ctp-noscroll{scrollbar-width:none;-ms-overflow-style:none}";
    document.head.appendChild(el);
  }, []);
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

// ── Main component ──
export default function ProfileScreenSupabase() {
  useHideScrollbar();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [notifPermission, setNotifPermission] = React.useState("default");
  // Permission accordée ≠ abonné : c'est la souscription qui fait foi (doc 09 §3 P0-1)
  const [notifSubscribed, setNotifSubscribed] = React.useState(false);
  const [notifBusy, setNotifBusy] = React.useState(false);

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
        setNotifSubscribed(false);
        return;
      }
      setNotifPermission(Notification.permission);
      // Vérifie la souscription réelle de CE navigateur et répare la ligne
      // push_subscriptions si elle manque (upsert idempotent, sans permission).
      ensurePushSubscriptionSynced()
        .then(setNotifSubscribed)
        .catch(() => setNotifSubscribed(false));
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

  // ── Activer les notifications (porte de rattrapage — doc 09 §3 P0-1) ──
  // Demander la permission ne suffit pas : il faut souscrire au PushManager
  // et enregistrer la souscription dans Supabase, sinon aucun push ne partira.
  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined" || notifBusy) return;
    setNotifBusy(true);
    try {
      const ok = await registerVapidPush();
      setNotifSubscribed(ok);
      setNotifPermission(Notification.permission);
      if (ok) clearPushOnboardingSkipped();
    } catch (e) {
      console.warn("[PROFILE][SUPA] push registration failed:", (e as any)?.message);
      setNotifPermission(Notification.permission);
    } finally {
      setNotifBusy(false);
    }
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

  // Même coquille que Home et Schedule : viewport mobile, dégradé de fond
  // avec ses deux halos, en-tête de marque. C'est ce qui manquait ici.
  return (
    <MobileViewport>
      <div style={{
        width: "100%", maxWidth: "375px", height: "812px",
        backgroundColor: P.shell, overflow: "hidden", position: "relative",
        display: "flex", flexDirection: "column", alignItems: "center",
        fontFamily: "'Inter', sans-serif", color: "white",
        margin: "0 auto", boxSizing: "border-box",
      }}>
        <div style={{
          position: "absolute", width: "100%", height: "100%",
          background: P.backdrop, zIndex: 0, pointerEvents: "none",
        }} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.container}
        {...(Platform.OS === "web" ? { className: "ctp-noscroll" } as any : {})}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadProfile(); }}
            tintColor={P.accent}
          />
        }
      >
        {/* Header */}
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
              placeholderTextColor={P.textLow}
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
              placeholderTextColor={P.textLow}
              keyboardType="numeric"
              style={s.input}
            />
          ) : (
            <Text style={s.fieldValue}>{jerseyNumber || "Not set"}</Text>
          )}

          {/* Position */}
          <Text style={s.fieldLabel}>Position</Text>
          {editing ? (
            <select
              value={editPosition}
              onChange={(e) => setEditPosition(e.target.value)}
              style={{
                width: "100%",
                marginTop: 6,
                marginBottom: 4,
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${P.cardBorder}`,
                color: P.textHi,
                fontFamily: "'Inter', sans-serif",
                fontSize: 15,
                appearance: "none",
                WebkitAppearance: "none",
                cursor: "pointer",
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2300E0FF' stroke-width='2.5' stroke-linecap='round'><path d='M6 9l6 6 6-6'/></svg>\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 14px center",
              }}
            >
              <option value="" style={{ background: "#0E1528" }}>Select a position</option>
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos} style={{ background: "#0E1528" }}>{pos}</option>
              ))}
            </select>
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
              <Text style={[s.fieldValue, { color: P.accent }]}>{pseudonym}</Text>
            </>
          ) : null}
        </View>

        {/* ── Notifications section ── */}
        <View style={s.card}>
          <Text style={s.miniLabel}>NOTIFICATIONS</Text>

          {notifSubscribed ? (
            <View style={s.notifRow}>
              <View style={[s.notifDot, { backgroundColor: "#00FF9D" }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.notifStatus}>Active</Text>
                <Text style={s.notifDetail}>You'll be alerted after each session.</Text>
              </View>
            </View>
          ) : notifPermission === "granted" ? (
            <Pressable onPress={requestNotifPermission} style={s.notifRow}>
              <View style={[s.notifDot, { backgroundColor: cl.zone.YELLOW }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.notifStatus, { color: cl.zone.YELLOW }]}>
                  {notifBusy ? "Finishing setup…" : "Almost there - Tap to finish setup"}
                </Text>
                <Text style={s.notifDetail}>Permission granted, but this device isn't registered yet.</Text>
              </View>
            </Pressable>
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
                <Text style={[s.notifStatus, { color: "#EF4444" }]}>
                  {notifBusy ? "Enabling…" : "Inactive - Tap to enable"}
                </Text>
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

        {/* Navigation unifiée — le composant EXACT de Home et Schedule */}
        <UnifiedAthleteNavigation
          activeTab="Profile"
          onNavigate={(tab) => { if (tab !== "Profile") navigation.navigate(tab); }}
        />
      </div>
    </MobileViewport>
  );
}

const s = StyleSheet.create({
  scroll: {
    flex: 1,
    width: "100%",
    backgroundColor: "transparent",
    zIndex: 1,
    // Home et Schedule masquent la barre de defilement : sur un ecran de
    // 375 px cadre comme un telephone, elle traverse l'interface.
    ...(Platform.OS === "web"
      ? { scrollbarWidth: "none", msOverflowStyle: "none" } as any
      : {}),
  },
  container: {
    padding: 18,
    paddingTop: 12,
    paddingBottom: 120,
    maxWidth: 430,
    alignSelf: "center" as any,
    width: "100%",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
    color: P.textHi,
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
    borderColor: "rgba(0,224,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? {
          background: "linear-gradient(145deg, rgba(0,224,255,0.25), rgba(7,11,20,0.90))",
          boxShadow: "0 12px 30px rgba(0,0,0,0.4), inset 0 0 14px rgba(0,224,255,0.15)",
        }
      : { backgroundColor: "rgba(0,224,255,0.15)" }),
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: "300",
    fontFamily: "Inter_300Light",
    color: P.textHi,
  },
  card: {
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.cardBorder,
    borderRadius: P.radius,
    padding: 18,
    marginTop: 12,
    ...(Platform.OS === "web"
      ? { boxShadow: P.cardShadow, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }
      : {}),
  },
  miniLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    color: P.textMid,
    textTransform: "uppercase" as any,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: P.textMid,
    marginTop: 14,
    marginBottom: 4,
    textTransform: "uppercase" as any,
    letterSpacing: 0.8,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
    color: P.textHi,
  },
  input: {
    height: 44,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,224,255,0.20)",
    borderRadius: 12,
    color: P.textHi,
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
    color: P.textHi,
  },
  notifDetail: {
    fontSize: 12,
    color: P.textLow,
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
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { background: "linear-gradient(135deg, #00D4FF, #0066FF)", boxShadow: "0 8px 24px rgba(0,120,255,0.30)" }
      : { backgroundColor: P.accent }),
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
    borderRadius: 12,
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
    color: P.textHi,
  },
  logoutBtn: {
    height: 48,
    borderRadius: 12,
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
    color: P.textLow,
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
