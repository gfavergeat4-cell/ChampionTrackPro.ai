/**
 * AdminTeamScreen.tsx
 * Team detail screen for admins: calendar sync config + access codes.
 * Route params: { teamId: string, teamName?: string }
 */

import React, { useEffect, useState, useCallback } from "react";
import { Platform, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamDoc {
  name?: string;
  inviteCode?: string;
  calendarUrl?: string;
  icsUrl?: string;
  calendarActive?: boolean;
  calendarLastSyncStatus?: "ok" | "error" | "syncing";
  calendarSyncError?: string;
  calendarLastSyncAt?: any;
  members?: number;
}

type CopiedKey = "coach-code" | "coach-link" | "athlete-code" | "athlete-link" | null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
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

const JOIN_BASE = "https://champion-track-pro.vercel.app";

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminTeamScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isDesktop = useIsDesktop();

  const { teamId, teamName: routeTeamName } = route.params || {};

  const [team, setTeam] = useState<TeamDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar form state
  const [calendarUrl, setCalendarUrl] = useState("");
  const [calendarActive, setCalendarActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Access codes state
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopiedKey>(null);

  // Load team data
  useEffect(() => {
    if (!teamId) { setError("Missing teamId"); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "teams", teamId));
        if (cancelled) return;
        if (!snap.exists()) { setError("Team not found"); setLoading(false); return; }
        const data = snap.data() as TeamDoc;
        setTeam(data);
        setCalendarUrl(data.calendarUrl || data.icsUrl || "");
        setCalendarActive(data.calendarActive !== false); // default true

        // Generate inviteCode if missing
        let code = data.inviteCode;
        if (!code) {
          code = generateCode(6);
          await setDoc(doc(db, "teams", teamId), { inviteCode: code }, { merge: true });
        }
        setInviteCode(code);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teamId]);

  const handleSaveCalendar = useCallback(async () => {
    if (!teamId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await updateDoc(doc(db, "teams", teamId), {
        calendarUrl: calendarUrl.trim(),
        icsUrl: calendarUrl.trim(), // keep icsUrl in sync for CF compatibility
        calendarActive,
        updatedAt: serverTimestamp(),
      });
      setSaveMsg("Saved.");
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (e: any) {
      setSaveMsg("Error: " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  }, [teamId, calendarUrl, calendarActive]);

  const handleSyncNow = useCallback(async () => {
    if (!teamId) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const fn = httpsCallable(functions, "syncIcsNow");
      const result: any = await fn({ teamId });
      const d = result?.data || {};
      setSyncMsg(`Done — ${d.created ?? 0} created, ${d.updated ?? 0} updated`);
    } catch (e: any) {
      setSyncMsg("Error: " + (e?.message || String(e)));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  }, [teamId]);

  const handleCopy = useCallback(async (key: CopiedKey, text: string) => {
    try {
      await copyText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }, []);

  // ── Sync status badge ──────────────────────────────────────────────────────

  const syncStatus = team?.calendarLastSyncStatus;
  const syncBadge = (() => {
    if (!team?.calendarUrl && !team?.icsUrl) return null;
    if (syncStatus === "ok") return { dot: "#00FF9D", label: "Synced" };
    if (syncStatus === "error") return { dot: "#FF4D4D", label: team?.calendarSyncError ? `Error: ${team.calendarSyncError}` : "Sync error" };
    if (syncStatus === "syncing") return { dot: "#FFB800", label: "Syncing…" };
    return { dot: "rgba(255,255,255,0.25)", label: "Never synced" };
  })();

  // ── Render guards ──────────────────────────────────────────────────────────

  if (Platform.OS !== "web") return null;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0F1E", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#00D4FF" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0F1E", display: "flex", alignItems: "center", justifyContent: "center", color: "#FCA5A5", fontFamily: "'DM Sans', system-ui", fontSize: 14 }}>
        {error || "Team not found"}
      </div>
    );
  }

  const teamName = team.name || routeTeamName || teamId;
  const coachCode = inviteCode ? `${inviteCode}-C` : "—";
  const athleteCode = inviteCode ? `${inviteCode}-A` : "—";
  const coachLink = inviteCode ? `${JOIN_BASE}/?code=${inviteCode}-C` : "";
  const athleteLink = inviteCode ? `${JOIN_BASE}/?code=${inviteCode}-A` : "";

  const contentWidth = isDesktop ? 720 : "100%";

  return (
    <div style={{
      minHeight: "100vh",
      overflowY: "auto",
      background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)",
      color: "#FFFFFF",
      fontFamily: "'DM Sans', system-ui",
      padding: isDesktop ? "32px 48px 80px 48px" : "20px 16px 80px 16px",
    }}>
      <div style={{ maxWidth: contentWidth, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <button
            type="button"
            onClick={() => navigation.goBack()}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10,
              color: "rgba(255,255,255,0.6)",
              padding: "8px 14px",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "'DM Sans', system-ui",
            }}
          >
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: "#ffffff" }}>
            {teamName}
          </h1>
        </div>

        {/* ── Access Codes ──────────────────────────────────────────── */}
        <Section title="Access Codes" icon="🔑">
          <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "rgba(255,255,255,0.50)" }}>
            Share these codes with your staff and athletes to join the team.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 16 }}>
            <CodeCard
              label="Coach Code"
              color="#00D4FF"
              code={coachCode}
              link={coachLink}
              copied={copied}
              codeKey="coach-code"
              linkKey="coach-link"
              onCopyCode={() => handleCopy("coach-code", coachCode)}
              onCopyLink={() => handleCopy("coach-link", coachLink)}
            />
            <CodeCard
              label="Athlete Code"
              color="#00FF9D"
              code={athleteCode}
              link={athleteLink}
              copied={copied}
              codeKey="athlete-code"
              linkKey="athlete-link"
              onCopyCode={() => handleCopy("athlete-code", athleteCode)}
              onCopyLink={() => handleCopy("athlete-link", athleteLink)}
            />
          </div>
        </Section>

        {/* ── Calendar Sync ─────────────────────────────────────────── */}
        <Section title="Calendar Sync" icon="📅">
          {/* Sync status badge */}
          {syncBadge && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: syncBadge.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", maxWidth: 480 }}>{syncBadge.label}</span>
            </div>
          )}

          {/* Auto-sync toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.70)" }}>Auto-sync (every 15 min)</span>
            <button
              type="button"
              onClick={() => setCalendarActive(v => !v)}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                border: "none",
                background: calendarActive ? "#00D4FF" : "rgba(255,255,255,0.15)",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <div style={{
                position: "absolute",
                top: 3,
                left: calendarActive ? 22 : 3,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.2s",
              }} />
            </button>
          </div>

          {/* ICS URL input */}
          <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" as const }}>
            ICS Calendar URL
          </label>
          <input
            type="url"
            value={calendarUrl}
            onChange={(e: any) => setCalendarUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,212,255,0.25)",
              background: "rgba(0,212,255,0.05)",
              color: "#fff",
              fontSize: 13,
              fontFamily: "'Space Mono', monospace",
              outline: "none",
              boxSizing: "border-box" as const,
              marginBottom: 8,
            }}
          />

          {/* Google Calendar instructions toggle */}
          <button
            type="button"
            onClick={() => setShowInstructions(v => !v)}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(0,212,255,0.70)",
              fontSize: 12,
              cursor: "pointer",
              padding: "4px 0",
              fontFamily: "'DM Sans', system-ui",
              marginBottom: showInstructions ? 12 : 0,
            }}
          >
            {showInstructions ? "▲" : "▼"} How to get the Google Calendar link
          </button>

          {showInstructions && (
            <div style={{
              background: "rgba(0,212,255,0.05)",
              border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: 10,
              padding: "12px 14px",
              fontSize: 12,
              color: "rgba(255,255,255,0.60)",
              lineHeight: 1.7,
              marginBottom: 12,
            }}>
              <strong style={{ color: "rgba(255,255,255,0.85)" }}>Google Calendar:</strong>
              <ol style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
                <li>Open Google Calendar → Settings (gear icon)</li>
                <li>Click on the calendar under "Settings for my calendars"</li>
                <li>Scroll to "Integrate calendar"</li>
                <li>Copy the <strong>Public URL to this calendar</strong> (ending in <code>.ics</code>)</li>
                <li>The calendar must be set to <strong>Public</strong> for sync to work</li>
              </ol>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" as const }}>
            <button
              type="button"
              onClick={handleSaveCalendar}
              disabled={saving}
              style={{
                padding: "10px 24px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #00BFFF, #0066FF)",
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                fontFamily: "'DM Sans', system-ui",
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing || !calendarUrl.trim()}
              style={{
                padding: "10px 24px",
                borderRadius: 10,
                border: "1px solid rgba(0,212,255,0.35)",
                background: "transparent",
                color: "#00D4FF",
                fontWeight: 600,
                fontSize: 13,
                cursor: (syncing || !calendarUrl.trim()) ? "not-allowed" : "pointer",
                opacity: (syncing || !calendarUrl.trim()) ? 0.5 : 1,
                fontFamily: "'DM Sans', system-ui",
              }}
            >
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
          </div>

          {saveMsg && (
            <p style={{ margin: "8px 0 0 0", fontSize: 12, color: saveMsg.startsWith("Error") ? "#FCA5A5" : "#00FF9D" }}>
              {saveMsg}
            </p>
          )}
          {syncMsg && (
            <p style={{ margin: "8px 0 0 0", fontSize: 12, color: syncMsg.startsWith("Error") ? "#FCA5A5" : "#00FF9D" }}>
              {syncMsg}
            </p>
          )}
        </Section>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#0D1526",
      border: "1px solid rgba(0,212,255,0.14)",
      borderRadius: 16,
      padding: "20px 20px",
      marginBottom: 20,
    }}>
      <h2 style={{
        margin: "0 0 16px 0",
        fontSize: 14,
        fontWeight: 600,
        color: "rgba(255,255,255,0.85)",
        letterSpacing: 1.5,
        textTransform: "uppercase" as const,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span>{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

interface CodeCardProps {
  label: string;
  color: string;
  code: string;
  link: string;
  copied: CopiedKey;
  codeKey: CopiedKey;
  linkKey: CopiedKey;
  onCopyCode: () => void;
  onCopyLink: () => void;
}

function CodeCard({ label, color, code, link, copied, codeKey, linkKey, onCopyCode, onCopyLink }: CodeCardProps) {
  return (
    <div style={{
      background: "rgba(0,212,255,0.04)",
      border: `1px solid ${color}33`,
      borderRadius: 12,
      padding: "16px",
    }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 22,
        fontWeight: 700,
        color,
        letterSpacing: 4,
        marginBottom: 14,
      }}>
        {code}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
        <CopyBtn label={copied === codeKey ? "✓ Copied!" : "Copy Code"} onClick={onCopyCode} active={copied === codeKey} />
        {link && <CopyBtn label={copied === linkKey ? "✓ Copied!" : "Copy Link"} onClick={onCopyLink} active={copied === linkKey} />}
      </div>
    </div>
  );
}

function CopyBtn({ label, onClick, active }: { label: string; onClick: () => void; active: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: 8,
        border: active ? "1px solid #00FF9D" : "1px solid rgba(255,255,255,0.18)",
        background: active ? "rgba(0,255,157,0.10)" : "transparent",
        color: active ? "#00FF9D" : "rgba(255,255,255,0.65)",
        fontSize: 12,
        cursor: "pointer",
        fontFamily: "'DM Sans', system-ui",
        fontWeight: 500,
        transition: "all 0.2s",
      }}
    >
      {label}
    </button>
  );
}
