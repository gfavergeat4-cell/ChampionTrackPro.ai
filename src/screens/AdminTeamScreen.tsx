/**
 * AdminTeamScreen.tsx
 * Team detail screen for admins: calendar sync config + access codes.
 * Route params: { teamId: string, teamName?: string }
 *
 * Supabase-migrated: data via ctpApi (getTeamInfo, setTeamCalendar, triggerIcsSync).
 * Courtlight styling (#070B14, card rgba(17,26,45,0.92), Inter, accent #00D4FF).
 */

import React, { useEffect, useState, useCallback } from "react";
import { Platform, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { getTeamInfo, setTeamCalendar, triggerIcsSync } from "../lib/ctpApi";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { courtlight as cl } from "../theme/tokens";

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamData {
  id: string;
  name?: string;
  sport?: string;
  ics_url?: string | null;
  invite_code?: string | null;
  timezone?: string;
}

type CopiedKey = "coach-code" | "coach-link" | "athlete-code" | "athlete-link" | null;

// ── Helpers ──────────────────────────────────────────────────────────────────

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

  const [team, setTeam] = useState<TeamData | null>(null);
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

  // Load team data from Supabase
  useEffect(() => {
    if (!teamId) { setError("Missing teamId"); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await getTeamInfo(teamId);
        if (cancelled) return;
        if (!data) { setError("Team not found"); setLoading(false); return; }
        setTeam(data as TeamData);
        setCalendarUrl(data.ics_url || "");
        setCalendarActive(true); // auto-sync active by default when URL is set
        setInviteCode(data.invite_code || null);
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
      await setTeamCalendar(teamId, calendarUrl.trim());
      setSaveMsg("Saved.");
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (e: any) {
      setSaveMsg("Error: " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  }, [teamId, calendarUrl]);

  const handleSyncNow = useCallback(async () => {
    if (!teamId) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      await triggerIcsSync();
      setSyncMsg("Sync triggered. Sessions will update shortly.");
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

  const syncBadge = (() => {
    if (!team?.ics_url) return null;
    // Supabase schema does not track per-sync status — show URL-present badge
    return { dot: cl.accent.cyan, label: "Calendar URL configured" };
  })();

  // ── Render guards ──────────────────────────────────────────────────────────

  if (Platform.OS !== "web") return null;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: cl.bg.court, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={cl.accent.cyan} />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div style={{ minHeight: "100vh", background: cl.bg.court, display: "flex", alignItems: "center", justifyContent: "center", color: "#FCA5A5", fontFamily: cl.type.ui, fontSize: 14 }}>
        {error || "Team not found"}
      </div>
    );
  }

  const teamName = team.name || routeTeamName || teamId;
  const coachCode = inviteCode ? `${inviteCode}-C` : "\u2014";
  const athleteCode = inviteCode ? `${inviteCode}-A` : "\u2014";
  const coachLink = inviteCode ? `${JOIN_BASE}/?code=${inviteCode}-C` : "";
  const athleteLink = inviteCode ? `${JOIN_BASE}/?code=${inviteCode}-A` : "";

  const contentWidth = isDesktop ? 720 : "100%";

  return (
    <div style={{
      minHeight: "100vh",
      overflowY: "auto",
      background: cl.bg.vignette,
      color: cl.text.hi,
      fontFamily: cl.type.ui,
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
              borderRadius: cl.radius.control,
              color: cl.text.low,
              padding: "8px 14px",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: cl.type.ui,
            }}
          >
            &larr; Back
          </button>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: cl.text.hi }}>
            {teamName}
          </h1>
        </div>

        {/* ── Access Codes ──────────────────────────────────────────── */}
        <Section title="Access Codes" icon="🔑">
          <p style={{ margin: "0 0 16px 0", fontSize: 13, color: cl.text.low }}>
            Share these codes with your staff and athletes to join the team.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 16 }}>
            <CodeCard
              label="Coach Code"
              color={cl.accent.cyan}
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
              <span style={{ fontSize: 12, color: cl.text.low, maxWidth: 480 }}>{syncBadge.label}</span>
            </div>
          )}

          {/* Auto-sync toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: cl.text.mid }}>Auto-sync (every 15 min)</span>
            <button
              type="button"
              onClick={() => setCalendarActive(v => !v)}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                border: "none",
                background: calendarActive ? cl.accent.cyan : "rgba(255,255,255,0.15)",
                cursor: "pointer",
                position: "relative",
                transition: `background ${cl.motion.fast}ms ${cl.motion.settle}`,
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
                transition: `left ${cl.motion.fast}ms ${cl.motion.settle}`,
              }} />
            </button>
          </div>

          {/* ICS URL input */}
          <label style={{ display: "block", fontSize: 11, color: cl.text.low, marginBottom: 6, letterSpacing: "0.16em", textTransform: "uppercase" as const }}>
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
              borderRadius: cl.radius.control,
              border: `1px solid rgba(0,212,255,0.25)`,
              background: "rgba(0,212,255,0.05)",
              color: cl.text.hi,
              fontSize: 13,
              fontFamily: cl.type.mono,
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
              fontFamily: cl.type.ui,
              marginBottom: showInstructions ? 12 : 0,
            }}
          >
            {showInstructions ? "\u25B2" : "\u25BC"} How to get the Google Calendar link
          </button>

          {showInstructions && (
            <div style={{
              background: "rgba(0,212,255,0.05)",
              border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: cl.radius.control,
              padding: "12px 14px",
              fontSize: 12,
              color: cl.text.mid,
              lineHeight: 1.7,
              marginBottom: 12,
            }}>
              <strong style={{ color: "rgba(255,255,255,0.85)" }}>Google Calendar:</strong>
              <ol style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
                <li>Open Google Calendar &rarr; Settings (gear icon)</li>
                <li>Click on the calendar under &ldquo;Settings for my calendars&rdquo;</li>
                <li>Scroll to &ldquo;Integrate calendar&rdquo;</li>
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
                borderRadius: cl.radius.control,
                border: "none",
                background: `linear-gradient(135deg, ${cl.accent.cyan}, ${cl.accent.deep})`,
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                fontFamily: cl.type.ui,
              }}
            >
              {saving ? "Saving\u2026" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing || !calendarUrl.trim()}
              style={{
                padding: "10px 24px",
                borderRadius: cl.radius.control,
                border: `1px solid rgba(0,212,255,0.35)`,
                background: "transparent",
                color: cl.accent.cyan,
                fontWeight: 600,
                fontSize: 13,
                cursor: (syncing || !calendarUrl.trim()) ? "not-allowed" : "pointer",
                opacity: (syncing || !calendarUrl.trim()) ? 0.5 : 1,
                fontFamily: cl.type.ui,
              }}
            >
              {syncing ? "Syncing\u2026" : "Sync Now"}
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
      background: cl.surface.card,
      boxShadow: `${cl.shadow.e1}, ${cl.edge.rim}`,
      border: `1px solid rgba(0,212,255,0.10)`,
      borderRadius: cl.radius.card,
      padding: "20px 20px",
      marginBottom: 20,
    }}>
      <h2 style={{
        margin: "0 0 16px 0",
        fontSize: 11,
        fontWeight: cl.type.weights.semibold,
        color: cl.text.mid,
        letterSpacing: "0.16em",
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
      borderRadius: cl.radius.card,
      padding: "16px",
    }}>
      <div style={{ fontSize: 11, color: cl.text.low, letterSpacing: "0.16em", textTransform: "uppercase" as const, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{
        fontFamily: cl.type.mono,
        fontSize: 22,
        fontWeight: 700,
        color,
        letterSpacing: 4,
        marginBottom: 14,
      }}>
        {code}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
        <CopyBtn label={copied === codeKey ? "Copied!" : "Copy Code"} onClick={onCopyCode} active={copied === codeKey} />
        {link && <CopyBtn label={copied === linkKey ? "Copied!" : "Copy Link"} onClick={onCopyLink} active={copied === linkKey} />}
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
        borderRadius: cl.radius.control,
        border: active ? "1px solid #00FF9D" : "1px solid rgba(255,255,255,0.18)",
        background: active ? "rgba(0,255,157,0.10)" : "transparent",
        color: active ? "#00FF9D" : cl.text.mid,
        fontSize: 12,
        cursor: "pointer",
        fontFamily: cl.type.ui,
        fontWeight: cl.type.weights.medium,
        transition: `all ${cl.motion.fast}ms ${cl.motion.settle}`,
      }}
    >
      {label}
    </button>
  );
}
