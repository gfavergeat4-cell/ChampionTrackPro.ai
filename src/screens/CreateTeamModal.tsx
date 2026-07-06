/**
 * CreateTeamModal.tsx
 * Simplified team creation: Name · Logo · Calendar URL · Questionnaire template.
 * On save: writes Firestore doc, shows success screen with access codes.
 */

import React, { useState, useRef, useEffect } from "react";
import { Platform, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";
import {
  seedDefaultQuestionnaires,
  QuestionnaireDoc,
} from "../utils/questionnaireTemplates";

// ── Constants ─────────────────────────────────────────────────────────────────

const JOIN_BASE = "https://champion-track-pro.vercel.app";

const sanitize = (str: string, maxLen = 200): string =>
  str.trim().replace(/[<>"']/g, "").slice(0, maxLen);

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const el = document.createElement("textarea");
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

type CopiedKey = "coach-code" | "coach-link" | "athlete-code" | "athlete-link" | null;

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,212,255,0.20)",
  background: "#0A0F1E",
  color: "#fff",
  fontSize: 13,
  fontFamily: "'DM Sans', system-ui",
  outline: "none",
  boxSizing: "border-box",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateTeamModal() {
  const navigation = useNavigation<any>();
  const isDesktop = useIsDesktop();

  // Form state
  const [name, setName] = useState("");
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [calendarUrl, setCalendarUrl] = useState("");
  const [calendarActive, setCalendarActive] = useState(true);

  // Questionnaire state
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireDoc[]>([]);
  const [questionnairesLoading, setQuestionnairesLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Save state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success screen state
  const [saved, setSaved] = useState(false);
  const [savedTeamId, setSavedTeamId] = useState<string | null>(null);
  const [savedInviteCode, setSavedInviteCode] = useState<string | null>(null);
  const [savedName, setSavedName] = useState("");
  const [copied, setCopied] = useState<CopiedKey>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load questionnaires on mount
  useEffect(() => {
    if (Platform.OS !== "web") return;
    (async () => {
      try {
        await seedDefaultQuestionnaires();
        const snap = await getDocs(collection(db, "questionnaires"));
        const all: QuestionnaireDoc[] = snap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) } as QuestionnaireDoc))
          .filter(q => !q.isArchived)
          .sort((a, b) => a.sport.localeCompare(b.sport) || a.name.localeCompare(b.name));
        setQuestionnaires(all);
        const defaults = all.filter(q => q.sport === "Basketball" && q.isDefault);
        setSelectedIds(defaults.length > 0 ? defaults.map(q => q.id) : (all[0] ? [all[0].id] : []));
      } catch {}
      finally { setQuestionnairesLoading(false); }
    })();
  }, []);

  if (Platform.OS !== "web") return null;

  const handleLogoChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoBase64((ev.target?.result as string) || null);
    reader.readAsDataURL(file);
  };

  const handleCopy = async (key: CopiedKey, text: string) => {
    try {
      await copyText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Team name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const inviteCode = generateCode();
      const docRef = await addDoc(collection(db, "teams"), {
        name: sanitize(name, 100),
        logoUrl: logoBase64 || null,
        icsUrl: calendarUrl.trim(),
        calendarUrl: calendarUrl.trim(),
        calendarActive: calendarUrl.trim() ? calendarActive : false,
        questionnaireIds: selectedIds,
        questionnaireId: selectedIds[0] || null,
        inviteCode,
        status: "active",
        createdAt: serverTimestamp(),
      });

      if (calendarUrl.trim()) {
        try {
          const fn = httpsCallable(functions, "syncIcsNow");
          await fn({ teamId: docRef.id });
        } catch {}
      }

      setSavedTeamId(docRef.id);
      setSavedInviteCode(inviteCode);
      setSavedName(name.trim());
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || String(e));
      setSaving(false);
    }
  };

  const contentWidth = isDesktop ? 600 : "100%";

  // ── Success screen ──────────────────────────────────────────────────────────

  if (saved && savedTeamId && savedInviteCode) {
    const coachCode = `${savedInviteCode}-C`;
    const athleteCode = `${savedInviteCode}-A`;
    const coachLink = `${JOIN_BASE}/?code=${savedInviteCode}-C`;
    const athleteLink = `${JOIN_BASE}/?code=${savedInviteCode}-A`;

    return (
      <div style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)",
        color: "#fff",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isDesktop ? "32px 48px" : "20px 16px",
      }}>
        <div style={{ width: "100%", maxWidth: contentWidth }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>✅</div>
            <h1 style={{ margin: "0 0 8px 0", fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: "#fff" }}>
              Team created successfully
            </h1>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.50)" }}>{savedName}</div>
          </div>

          {/* Coach access */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", letterSpacing: 1.5, color: "rgba(0,212,255,0.70)", textTransform: "uppercase" as const, marginBottom: 8 }}>
              Coach Access
            </div>
            <div style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.28)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: "#00D4FF", letterSpacing: 3, marginBottom: 12 }}>
                {coachCode}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <CopyBtn isCopied={copied === "coach-code"} onClick={() => handleCopy("coach-code", coachCode)}>
                  Copy Code
                </CopyBtn>
                <CopyBtn isCopied={copied === "coach-link"} onClick={() => handleCopy("coach-link", coachLink)}>
                  Copy Link
                </CopyBtn>
              </div>
            </div>
          </div>

          {/* Athlete access */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", letterSpacing: 1.5, color: "rgba(0,255,157,0.70)", textTransform: "uppercase" as const, marginBottom: 8 }}>
              Athlete Access
            </div>
            <div style={{ background: "rgba(0,255,157,0.05)", border: "1px solid rgba(0,255,157,0.28)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: "#00FF9D", letterSpacing: 3, marginBottom: 12 }}>
                {athleteCode}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <CopyBtn isCopied={copied === "athlete-code"} onClick={() => handleCopy("athlete-code", athleteCode)}>
                  Copy Code
                </CopyBtn>
                <CopyBtn isCopied={copied === "athlete-link"} onClick={() => handleCopy("athlete-link", athleteLink)}>
                  Copy Link
                </CopyBtn>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginBottom: 28, lineHeight: 1.7, textAlign: "center" as const }}>
            Share these codes with your team.<br />
            Coach code → staff only.&nbsp;&nbsp;Athlete code → players.
          </div>

          {/* Go to dashboard */}
          <button
            type="button"
            onClick={() => navigation.navigate("AdminTeamDetailScreen", {
              teamId: savedTeamId,
              teamName: savedName,
            })}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg,#00BFFF,#0066FF)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              fontFamily: "'DM Sans', system-ui",
              letterSpacing: 0.5,
            }}
          >
            Go to Team Dashboard →
          </button>

        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100vh",
      overflowY: "auto",
      background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)",
      color: "#fff",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      padding: isDesktop ? "32px 48px 80px 48px" : "20px 16px 80px 16px",
    }}>
      <div style={{ maxWidth: contentWidth, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <button
            type="button"
            onClick={() => navigation.goBack()}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "rgba(255,255,255,0.55)", padding: "8px 14px", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', system-ui" }}
          >
            ← Cancel
          </button>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 22 : 18, fontWeight: 700, color: "#fff" }}>
            Create New Team
          </h1>
        </div>

        {/* 1 — Team Name */}
        <Field label="Team Name *">
          <input
            value={name}
            onChange={(e: any) => setName(e.target.value)}
            placeholder="e.g. Wildcats Basketball"
            style={inputStyle}
          />
        </Field>

        {/* 2 — Logo */}
        <Field label="Team Logo">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logoBase64 ? (
              <div style={{ width: 60, height: 60, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(0,212,255,0.3)", flexShrink: 0 }}>
                <img src={logoBase64} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(0,212,255,0.08)", border: "2px dashed rgba(0,212,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 22 }}>🏆</span>
              </div>
            )}
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: "none" }} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(0,212,255,0.30)", background: "transparent", color: "#00D4FF", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', system-ui" }}
              >
                {logoBase64 ? "Change Logo" : "Upload Logo"}
              </button>
              {logoBase64 && (
                <button
                  type="button"
                  onClick={() => setLogoBase64(null)}
                  style={{ marginLeft: 8, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,77,77,0.25)", background: "transparent", color: "rgba(255,77,77,0.60)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', system-ui" }}
                >
                  Remove
                </button>
              )}
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", marginTop: 4 }}>PNG, JPG — max 200KB recommended</div>
            </div>
          </div>
        </Field>

        {/* 3 — Calendar URL */}
        <Field label="ICS Calendar URL (optional)">
          <input
            type="url"
            value={calendarUrl}
            onChange={(e: any) => setCalendarUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/..."
            style={{ ...inputStyle, fontFamily: "'Space Mono', monospace", fontSize: 11 }}
          />
        </Field>

        {/* Auto-sync toggle */}
        {calendarUrl.trim() && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, padding: "12px 14px", borderRadius: 10, background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)" }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>Auto-sync (every 15 min)</span>
            <button
              type="button"
              onClick={() => setCalendarActive(v => !v)}
              style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: calendarActive ? "#00D4FF" : "rgba(255,255,255,0.15)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
            >
              <div style={{ position: "absolute", top: 3, left: calendarActive ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </button>
          </div>
        )}

        {/* 4 — Questionnaire template */}
        <Field label="Questionnaire Template">
          {questionnairesLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 28 }}>
              <ActivityIndicator color="#00D4FF" size="small" />
            </div>
          ) : questionnaires.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", padding: "8px 0" }}>
              No questionnaire templates found.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {questionnaires.map(q => {
                const isSelected = selectedIds.includes(q.id);
                const sessionLabel =
                  q.sessionType === "any" ? "Any Session" :
                  q.sessionType === "game" ? "Game Day" :
                  q.sessionType;
                const toggle = () => setSelectedIds(prev =>
                  prev.includes(q.id) ? prev.filter(x => x !== q.id) : [...prev, q.id]
                );
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={toggle}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: isSelected ? "2px solid #00D4FF" : "1px solid rgba(255,255,255,0.10)",
                      background: isSelected ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.03)",
                      color: "#fff",
                      textAlign: "left" as const,
                      cursor: "pointer",
                      fontFamily: "'DM Sans', system-ui",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 6 }}>
                          {q.name}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: q.description ? 6 : 0 }}>
                          <QBadge label={q.sport} color="#00D4FF" />
                          <QBadge label={sessionLabel} color="#00FF9D" />
                          {q.isDefault && <QBadge label="Default" color="#FFB800" />}
                        </div>
                        {q.description && (
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", lineHeight: 1.4 }}>
                            {q.description}
                          </div>
                        )}
                      </div>
                      {/* Checkbox */}
                      <div style={{ width: 20, height: 20, borderRadius: 5, border: isSelected ? "none" : "1.5px solid rgba(255,255,255,0.25)", background: isSelected ? "#00D4FF" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                        {isSelected && <span style={{ color: "#0A0F1E", fontSize: 11, fontWeight: 800 }}>✓</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        {/* Error */}
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.25)", color: "#FCA5A5", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 12,
            border: "none",
            background: saving ? "rgba(0,212,255,0.3)" : "linear-gradient(135deg,#00BFFF,#0066FF)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "'DM Sans', system-ui",
            letterSpacing: 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {saving ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <span>Creating…</span>
            </>
          ) : (
            "Create Team"
          )}
        </button>

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: "block",
        fontSize: 10,
        fontFamily: "'Space Mono', monospace",
        color: "rgba(0,212,255,0.70)",
        letterSpacing: 1,
        textTransform: "uppercase" as const,
        marginBottom: 8,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function QBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: "2px 8px",
      borderRadius: 10,
      background: `${color}18`,
      border: `1px solid ${color}40`,
      color,
      fontSize: 10,
      fontFamily: "'Space Mono', monospace",
      letterSpacing: 0.5,
    }}>
      {label}
    </span>
  );
}

function CopyBtn({ children, isCopied, onClick }: { children: React.ReactNode; isCopied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: 8,
        border: isCopied ? "1px solid #00FF9D" : "1px solid rgba(255,255,255,0.18)",
        background: isCopied ? "rgba(0,255,157,0.10)" : "transparent",
        color: isCopied ? "#00FF9D" : "rgba(255,255,255,0.60)",
        fontSize: 12,
        cursor: "pointer",
        fontFamily: "'DM Sans', system-ui",
        transition: "all 0.15s",
      }}
    >
      {isCopied ? "✓ Copied!" : children}
    </button>
  );
}
