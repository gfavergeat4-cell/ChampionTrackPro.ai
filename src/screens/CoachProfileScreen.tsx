import React, { useEffect, useRef, useState } from "react";
import { Platform, View, Text, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { signOut } from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { CommonActions } from "@react-navigation/native";

export default function CoachProfileScreen() {
  const navigation = useNavigation<any>();
  const isDesktop = useIsDesktop();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [teamName, setTeamName] = useState("");
  const [coachCode, setCoachCode] = useState("");
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPhotoBase64, setEditPhotoBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        setEmail(user.email || "");

        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = (userSnap.data() as any) || {};
        if (!cancelled) {
          setFullName(userData.fullName || userData.displayName || "");
          // photoBase64 takes priority over photoURL (storage-based)
          setPhotoURL(userData.photoBase64 || userData.photoURL || null);
        }

        const tid: string | null = userData.teamId || null;
        if (tid) {
          const teamSnap = await getDoc(doc(db, "teams", tid));
          if (teamSnap.exists()) {
            const teamData = teamSnap.data() as any;
            if (!cancelled) setTeamName(teamData.name || tid);
            if (!cancelled) setCoachCode(teamData.coachCode || "");
          }
        }
      } catch (e) {
        console.error("[CoachProfile] load error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Auth" }] }));
    } catch (e) {
      console.error("[CoachProfile] logout error", e);
    }
  };

  const handleCopyCode = () => {
    if (!coachCode) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(coachCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const startEdit = () => {
    setEditName(fullName);
    setEditPhone("");
    setEditPhotoBase64(null);
    setSaveError(null);
    setSuccessMsg(null);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setSaveError(null);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_BYTES = 500 * 1024;
    if (file.size > MAX_BYTES) {
      setSaveError("Image too large, please use a smaller photo (max 500 KB)");
      return;
    }
    setSaveError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setEditPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    setSuccessMsg(null);
    try {
      const newName = editName.trim() || fullName;
      const updates: Record<string, any> = { displayName: newName, fullName: newName };
      if (editPhotoBase64) updates.photoBase64 = editPhotoBase64;

      // Update Firebase Auth profile
      await updateProfile(user, { displayName: newName });
      // Update Firestore (merge to preserve other fields)
      await setDoc(doc(db, "users", user.uid), updates, { merge: true });

      setFullName(newName);
      if (editPhotoBase64) setPhotoURL(editPhotoBase64);
      setEditMode(false);
      setSuccessMsg("Profile updated ✅");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setSaveError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0F1E", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>Profile is optimized for web.</Text>
      </View>
    );
  }

  const maxWidth = isDesktop ? 640 : 480;
  const initials = (fullName || email || "C").slice(0, 1).toUpperCase();

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <h1 style={{ fontSize: isDesktop ? 28 : 22, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
            Profile
          </h1>
          {!editMode && !loading && (
            <button
              type="button"
              onClick={startEdit}
              style={{
                padding: "8px 20px",
                borderRadius: 10,
                border: "1px solid rgba(0,212,255,0.35)",
                background: "rgba(0,212,255,0.08)",
                color: "#00D4FF",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Edit
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 40 }}>
            <ActivityIndicator color="#00D4FF" />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Loading...</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Avatar + name */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: "#0D1526",
              border: "1px solid rgba(0,212,255,0.15)",
              borderTop: "2px solid rgba(0,212,255,0.25)",
              borderRadius: 16,
              padding: "20px 24px",
            }}>
              {/* Avatar */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                {(editMode ? (editPhotoBase64 || photoURL) : photoURL) ? (
                  <img
                    src={(editMode ? (editPhotoBase64 || photoURL) : photoURL)!}
                    alt="avatar"
                    style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(0,212,255,0.4)" }}
                  />
                ) : (
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #00D4FF33, #4A67FF44)",
                    border: "1px solid rgba(0,212,255,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#00D4FF",
                  }}>
                    {initials}
                  </div>
                )}
                {editMode && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      position: "absolute",
                      bottom: -4,
                      right: -4,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "#00D4FF",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    <svg width="12" height="12" fill="none" stroke="#0A0F1E" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handlePhotoSelect}
                />
              </div>

              {/* Name/email */}
              <div style={{ flex: 1 }}>
                {editMode ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Full name"
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(0,212,255,0.35)",
                      borderRadius: 8,
                      color: "#FFFFFF",
                      fontSize: 15,
                      fontWeight: 600,
                      padding: "8px 12px",
                      outline: "none",
                      marginBottom: 6,
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF" }}>
                    {fullName || "Coach"}
                  </div>
                )}
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: editMode ? 0 : 2 }}>{email}</div>
              </div>
            </div>

            {/* Phone (edit only) */}
            {editMode && (
              <div style={{
                background: "#0D1526",
                border: "1px solid rgba(0,212,255,0.15)",
                borderRadius: 16,
                padding: "16px 24px",
              }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                  Phone (optional)
                </div>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(0,212,255,0.25)",
                    borderRadius: 8,
                    color: "#FFFFFF",
                    fontSize: 14,
                    padding: "8px 12px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {/* Team info */}
            <div style={{
              background: "#0D1526",
              border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: 16,
              padding: "20px 24px",
            }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                Team
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#00D4FF" }}>
                {teamName || "—"}
              </div>
            </div>

            {/* Coach code */}
            {coachCode ? (
              <div style={{
                background: "#0D1526",
                border: "1px solid rgba(0,212,255,0.15)",
                borderRadius: 16,
                padding: "20px 24px",
              }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                  Coach Code
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#FFFFFF",
                    letterSpacing: "0.15em",
                    flex: 1,
                  }}>
                    {coachCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,212,255,0.35)",
                      background: copied ? "rgba(0,255,136,0.15)" : "rgba(0,212,255,0.1)",
                      color: copied ? "#00FF88" : "#00D4FF",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 8 }}>
                  Share this code with coaches to join your team
                </div>
              </div>
            ) : null}

            {/* Success message */}
            {successMsg && (
              <div style={{ color: "#00FF9D", fontSize: 13, padding: "8px 12px", background: "rgba(0,255,157,0.08)", border: "1px solid rgba(0,255,157,0.2)", borderRadius: 8 }}>
                {successMsg}
              </div>
            )}

            {/* Save error */}
            {saveError && (
              <div style={{ color: "#FCA5A5", fontSize: 13, padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 8 }}>
                {saveError}
              </div>
            )}

            {/* Edit actions */}
            {editMode ? (
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: 12,
                    background: saving ? "rgba(0,212,255,0.3)" : "linear-gradient(135deg, #00BFFF, #0066FF)",
                    border: "none",
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: saving ? "default" : "pointer",
                    transition: "opacity 0.2s",
                  }}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  style={{
                    padding: "14px 24px",
                    borderRadius: 12,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              /* Logout */
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: 12,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#EF4444",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
                  marginTop: 8,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.18)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)"; }}
              >
                Log Out
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
