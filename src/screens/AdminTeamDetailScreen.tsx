/**
 * AdminTeamDetailScreen.tsx
 * Dashboard-first team view for admins — Supabase migration.
 * Full PerformanceDashboard embedded as main content.
 * Gear icon top-right opens a slide-in settings drawer.
 *
 * Replaces Firebase version: reads from ctpApi (getTeamInfo, getTeamMembers,
 * setTeamCalendar, triggerIcsSync, removeMember, updateTeamInfo).
 * Questionnaire picker removed (frozen). Logo upload removed (not MVP).
 * Courtlight tokens from src/theme/tokens.ts.
 *
 * Route params: { teamId: string, teamName?: string }
 */

import React, { useEffect, useState, useCallback } from "react";
import { Platform, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  getTeamInfo,
  getTeamMembers,
  setTeamCalendar,
  triggerIcsSync,
  removeMember,
  updateTeamInfo,
} from "../lib/ctpApi";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { courtlight as cl } from "../theme/tokens";
import PerformanceDashboard from "./PerformanceDashboard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamData {
  id: string;
  name?: string;
  sport?: string;
  division?: string;
  ics_url?: string;
  invite_code?: string;
  calendar_active?: boolean;
}

type AccordionKey = "info" | "codes" | "members";
type CopiedKey = "coach-code" | "coach-link" | "athlete-code" | "athlete-link" | null;

// ── Constants ─────────────────────────────────────────────────────────────────

const JOIN_BASE = "https://champion-track-pro.vercel.app";

// ── Helpers ───────────────────────────────────────────────────────────────────

const sanitize = (str: string, maxLen = 200): string =>
  str.trim().replace(/[<>"']/g, "").slice(0, maxLen);

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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: cl.radius.control,
  border: cl.edge.hair,
  background: "rgba(255,255,255,0.05)",
  color: cl.text.hi,
  fontSize: 13,
  fontFamily: cl.type.ui,
  outline: "none",
  boxSizing: "border-box",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminTeamDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isDesktop = useIsDesktop();
  const { teamId, teamName: routeTeamName } = route.params || {};

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<AccordionKey | null>("codes");

  // Team data (for header + drawer)
  const [team, setTeam] = useState<TeamData | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  // Team info form
  const [editName, setEditName] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Calendar (in Team Info)
  const [calendarUrl, setCalendarUrl] = useState("");
  const [calendarActive, setCalendarActive] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Members
  interface MemberEntry {
    uid: string;
    name: string;
    role: string;
    pseudonym?: string;
  }
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);

  // Access codes
  const [copied, setCopied] = useState<CopiedKey>(null);

  // ── Load team ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!teamId) { setTeamLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await getTeamInfo(teamId);
        if (cancelled || !data) { setTeamLoading(false); return; }
        setTeam(data as TeamData);
        setCalendarUrl(data.ics_url || "");
        setCalendarActive(data.calendar_active !== false);
        setEditName(data.name || "");
        setInviteCode(data.invite_code || null);
      } catch {}
      finally { if (!cancelled) setTeamLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [teamId]);

  // ── Load members (lazy on accordion open) ────────────────────────────────

  useEffect(() => {
    if (openAccordion !== "members" || membersLoaded || !teamId) return;
    let cancelled = false;
    setMembersLoading(true);
    (async () => {
      try {
        const raw = await getTeamMembers(teamId);
        if (cancelled) return;
        const list: MemberEntry[] = (raw ?? []).map((m: any) => ({
          uid: m.user_id,
          name: m.profiles?.display_name || m.pseudonym || m.user_id,
          role: m.role || "athlete",
          pseudonym: m.pseudonym,
        }));
        list.sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
        setMembers(list);
        setMembersLoaded(true);
      } catch {}
      finally { if (!cancelled) setMembersLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [openAccordion, teamId, membersLoaded]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveTeamInfo = useCallback(async () => {
    if (!teamId) return;
    setSavingInfo(true); setInfoMsg(null);
    try {
      // Save name via updateTeamInfo
      await updateTeamInfo(teamId, { name: sanitize(editName, 100) });
      // Save calendar via setTeamCalendar
      if (calendarUrl.trim()) {
        await setTeamCalendar(teamId, calendarUrl.trim());
      }
      setTeam(prev => prev ? { ...prev, name: editName.trim() } : prev);
      setInfoMsg("Saved.");
      setTimeout(() => setInfoMsg(null), 2500);
    } catch (e: any) {
      setInfoMsg("Error: " + (e?.message || String(e)));
    } finally { setSavingInfo(false); }
  }, [teamId, editName, calendarUrl, calendarActive]);

  const handleSyncNow = useCallback(async () => {
    if (!teamId) return;
    setSyncing(true); setSyncMsg(null);
    try {
      await triggerIcsSync();
      setSyncMsg("Sync triggered.");
    } catch (e: any) {
      setSyncMsg("Error: " + (e?.message || String(e)));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  }, [teamId]);

  const handleCopy = useCallback(async (key: CopiedKey, text: string) => {
    try { await copyText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); } catch {}
  }, []);

  const handleRemoveMember = useCallback(async (uid: string) => {
    if (!teamId) return;
    setRemovingUid(uid);
    try {
      await removeMember(teamId, uid);
      setMembers(prev => prev.filter(m => m.uid !== uid));
    } catch (e: any) {
      alert("Error removing member: " + (e?.message || String(e)));
    } finally {
      setRemovingUid(null);
      setConfirmRemoveUid(null);
    }
  }, [teamId]);

  const toggleAccordion = (key: AccordionKey) => {
    setOpenAccordion(prev => prev === key ? null : key);
  };

  // ── Guards ────────────────────────────────────────────────────────────────

  if (Platform.OS !== "web") return null;

  // ── Derived ───────────────────────────────────────────────────────────────

  const teamName = team?.name || routeTeamName || teamId;
  const coachCode = inviteCode ? `${inviteCode}-C` : "\u2014";
  const athleteCode = inviteCode ? `${inviteCode}-A` : "\u2014";
  const coachLink = inviteCode ? `${JOIN_BASE}/?code=${inviteCode}-C` : "";
  const athleteLink = inviteCode ? `${JOIN_BASE}/?code=${inviteCode}-A` : "";

  const drawerWidth = isDesktop ? 420 : "100%";

  // ── Accordion renderers ────────────────────────────────────────────────────

  function renderTeamInfoAccordion() {
    return (
      <div>
        {/* Team Name */}
        <FieldGroup label="Team Name">
          <input value={editName} onChange={(e: any) => setEditName(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
        </FieldGroup>

        {/* Calendar URL */}
        <FieldGroup label="ICS Calendar URL">
          <input type="url" value={calendarUrl} onChange={(e: any) => setCalendarUrl(e.target.value)} placeholder="https://calendar.google.com/..." style={{ ...inputStyle, fontFamily: cl.type.mono, fontSize: 11, marginBottom: 8 }} />
        </FieldGroup>

        {/* Auto-sync toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: cl.text.low }}>Auto-sync (every 15 min)</span>
          <Toggle value={calendarActive} onChange={setCalendarActive} />
        </div>

        {/* Sync now */}
        {(calendarUrl.trim() || team?.ics_url) && (
          <div style={{ marginBottom: 14 }}>
            <SmallBtn onClick={handleSyncNow} disabled={syncing}>{syncing ? "Syncing\u2026" : "Sync Now"}</SmallBtn>
            {syncMsg && <Msg text={syncMsg} />}
          </div>
        )}

        <SmallBtn primary onClick={handleSaveTeamInfo} disabled={savingInfo}>{savingInfo ? "Saving\u2026" : "Save"}</SmallBtn>
        {infoMsg && <Msg text={infoMsg} />}
      </div>
    );
  }

  function renderAccessCodesAccordion() {
    return (
      <div>
        <p style={{ margin: "0 0 14px 0", fontSize: 12, color: cl.text.low }}>
          Share these codes to invite staff and athletes.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <CodeCard label="Coach Code" color={cl.accent.cyan} code={coachCode} link={coachLink} copied={copied} codeKey="coach-code" linkKey="coach-link" onCopyCode={() => handleCopy("coach-code", coachCode)} onCopyLink={() => handleCopy("coach-link", coachLink)} />
          <CodeCard label="Athlete Code" color="#00FF9D" code={athleteCode} link={athleteLink} copied={copied} codeKey="athlete-code" linkKey="athlete-link" onCopyCode={() => handleCopy("athlete-code", athleteCode)} onCopyLink={() => handleCopy("athlete-link", athleteLink)} />
        </div>
      </div>
    );
  }

  function renderMembersAccordion() {
    const coaches = members.filter(m => m.role === "coach");
    const athletes = members.filter(m => m.role === "athlete");
    const countLabel = membersLoaded
      ? `${coaches.length} Coach${coaches.length !== 1 ? "es" : ""} \u00B7 ${athletes.length} Athlete${athletes.length !== 1 ? "s" : ""}`
      : "";

    if (membersLoading) {
      return <div style={{ display: "flex", justifyContent: "center", padding: 16 }}><ActivityIndicator color={cl.accent.cyan} size="small" /></div>;
    }

    return (
      <div>
        {countLabel ? (
          <div style={{ fontSize: 11, color: cl.text.low, marginBottom: 12, fontFamily: cl.type.mono, letterSpacing: 1 }}>
            {countLabel}
          </div>
        ) : null}

        {members.length === 0 ? (
          <div style={{ fontSize: 12, color: cl.text.low, padding: "8px 0" }}>No members yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {members.map(m => {
              const initials = m.name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
              const isCoachRole = m.role === "coach";
              const isConfirming = confirmRemoveUid === m.uid;
              const isRemoving = removingUid === m.uid;
              return (
                <div key={m.uid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: cl.radius.control, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {/* Avatar */}
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: isCoachRole ? "rgba(0,212,255,0.15)" : "rgba(0,255,157,0.12)", border: `1px solid ${isCoachRole ? "rgba(0,212,255,0.35)" : "rgba(0,255,157,0.35)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: isCoachRole ? cl.accent.cyan : "#00FF9D", flexShrink: 0 }}>
                    {initials || "?"}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: cl.text.hi, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                    {m.pseudonym ? <div style={{ fontSize: 10, color: cl.text.low, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.pseudonym}</div> : null}
                  </div>
                  {/* Role badge */}
                  <span style={{ fontSize: 9, fontWeight: 700, color: isCoachRole ? cl.accent.cyan : "#00FF9D", background: isCoachRole ? "rgba(0,212,255,0.10)" : "rgba(0,255,157,0.10)", border: `1px solid ${isCoachRole ? "rgba(0,212,255,0.25)" : "rgba(0,255,157,0.25)"}`, borderRadius: 10, padding: "2px 7px", textTransform: "uppercase" as const, letterSpacing: 0.5, flexShrink: 0 }}>
                    {m.role}
                  </span>
                  {/* Remove button */}
                  {isConfirming ? (
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      <button type="button" disabled={isRemoving} onClick={() => handleRemoveMember(m.uid)} style={{ padding: "4px 9px", borderRadius: 6, border: "1px solid rgba(255,68,68,0.5)", background: "rgba(255,68,68,0.12)", color: "#FF4444", fontSize: 10, fontWeight: 700, cursor: isRemoving ? "not-allowed" : "pointer", opacity: isRemoving ? 0.6 : 1 }}>
                        {isRemoving ? "\u2026" : "Confirm"}
                      </button>
                      <button type="button" onClick={() => setConfirmRemoveUid(null)} style={{ padding: "4px 9px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: cl.text.low, fontSize: 10, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmRemoveUid(m.uid)} style={{ height: 28, padding: "0 10px", borderRadius: 6, border: "1px solid rgba(255,68,68,0.35)", background: "transparent", color: "rgba(255,68,68,0.70)", fontSize: 10, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }


  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: cl.bg.court, overflowX: "hidden" }}>

      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(7,11,20,0.96)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: cl.edge.hair, padding: isDesktop ? "14px 32px" : "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
        <button type="button" onClick={() => navigation.goBack()} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: cl.radius.control, color: cl.text.low, padding: "7px 13px", cursor: "pointer", fontSize: 13, fontFamily: cl.type.ui, flexShrink: 0 }}>
          ← Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isDesktop ? 18 : 16, fontWeight: 700, color: cl.text.hi, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, fontFamily: cl.type.ui }}>
            {teamLoading ? routeTeamName || "\u2026" : teamName}
          </div>
          {(team?.sport || team?.division) && (
            <div style={{ fontSize: 11, color: cl.text.low, marginTop: 1, fontFamily: cl.type.ui }}>
              {[team.sport, team.division].filter(Boolean).join(" \u00B7 ")}
            </div>
          )}
        </div>
        {/* Gear icon */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          title="Team settings"
          style={{ background: drawerOpen ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(0,212,255,0.20)", borderRadius: cl.radius.control, color: cl.accent.cyan, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: `background ${cl.motion.fast}ms` }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Dashboard content */}
      <PerformanceDashboard route={{ params: { role: "admin" as "admin" | "coach", teamId, teamName } }} />

      {/* Drawer backdrop */}
      {drawerOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200 }}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: drawerWidth,
        background: cl.surface.card,
        borderLeft: cl.edge.hair,
        transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
        transition: `transform ${cl.motion.base}ms ${cl.motion.settle}`,
        zIndex: 201,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Drawer header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px 20px", borderBottom: cl.edge.hair, flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: cl.text.mid, letterSpacing: 0.5, fontFamily: cl.type.ui }}>
            {teamName}
          </div>
          <button type="button" onClick={() => setDrawerOpen(false)} style={{ background: "transparent", border: "none", color: cl.text.low, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 2px", fontFamily: "system-ui" }}>
            ×
          </button>
        </div>

        {/* Accordions */}
        <div style={{ padding: "12px 16px", flex: 1 }}>

          <Accordion title="Team Info" isOpen={openAccordion === "info"} onToggle={() => toggleAccordion("info")}>
            {renderTeamInfoAccordion()}
          </Accordion>

          <Accordion title="Access Codes" isOpen={openAccordion === "codes"} onToggle={() => toggleAccordion("codes")}>
            {renderAccessCodesAccordion()}
          </Accordion>

          <Accordion title="Members" isOpen={openAccordion === "members"} onToggle={() => toggleAccordion("members")}>
            {renderMembersAccordion()}
          </Accordion>

        </div>
      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Accordion({
  title, isOpen, onToggle, children,
}: {
  title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <button type="button" onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: cl.radius.control, background: isOpen ? "rgba(0,212,255,0.06)" : "rgba(255,255,255,0.03)", border: isOpen ? "1px solid rgba(0,212,255,0.18)" : "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: `all ${cl.motion.fast}ms` }}>
        <span style={{ flex: 1, textAlign: "left" as const, fontSize: 13, fontWeight: 600, color: isOpen ? cl.text.hi : cl.text.mid, fontFamily: cl.type.ui }}>{title}</span>
        <span style={{ fontSize: 10, color: cl.text.low, transition: `transform ${cl.motion.fast}ms`, display: "inline-block", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>{"\u25BC"}</span>
      </button>
      {isOpen && (
        <div style={{ padding: "14px 14px 8px 14px", borderLeft: cl.edge.hair, marginLeft: 10, marginTop: 2, marginBottom: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function FieldGroup({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{ gridColumn: span === 2 ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: 10, color: cl.text.low, letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 5, fontFamily: cl.type.ui }}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, border: "none", background: value ? cl.accent.cyan : "rgba(255,255,255,0.15)", cursor: "pointer", position: "relative", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: `left ${cl.motion.fast}ms` }} />
    </button>
  );
}

function SmallBtn({
  children, onClick, disabled, primary,
}: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ padding: "8px 18px", borderRadius: cl.radius.control, border: primary ? "none" : "1px solid rgba(0,212,255,0.30)", background: primary ? `linear-gradient(135deg,${cl.accent.cyan},${cl.accent.deep})` : "transparent", color: primary ? cl.text.hi : cl.accent.cyan, fontWeight: 600, fontSize: 12, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, fontFamily: cl.type.ui }}>
      {children}
    </button>
  );
}

function Msg({ text }: { text: string }) {
  const isError = text.startsWith("Error");
  return <p style={{ margin: "6px 0 0 0", fontSize: 11, color: isError ? "#FCA5A5" : "#00FF9D" }}>{text}</p>;
}

interface CodeCardProps {
  label: string; color: string; code: string; link: string;
  copied: CopiedKey; codeKey: CopiedKey; linkKey: CopiedKey;
  onCopyCode: () => void; onCopyLink: () => void;
}

function CodeCard({ label, color, code, link, copied, codeKey, linkKey, onCopyCode, onCopyLink }: CodeCardProps) {
  return (
    <div style={{ background: `${color}08`, border: `1px solid ${color}30`, borderRadius: cl.radius.control, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, color: cl.text.low, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 6, fontFamily: cl.type.ui }}>{label}</div>
      <div style={{ fontFamily: cl.type.mono, fontSize: 20, fontWeight: 700, color, letterSpacing: 3, marginBottom: 10 }}>{code}</div>
      <div style={{ display: "flex", gap: 7 }}>
        <button type="button" onClick={onCopyCode} style={{ padding: "5px 11px", borderRadius: 7, border: copied === codeKey ? "1px solid #00FF9D" : "1px solid rgba(255,255,255,0.15)", background: copied === codeKey ? "rgba(0,255,157,0.10)" : "transparent", color: copied === codeKey ? "#00FF9D" : cl.text.low, fontSize: 11, cursor: "pointer", fontFamily: cl.type.ui }}>
          {copied === codeKey ? "\u2713 Copied!" : "Copy Code"}
        </button>
        {link && (
          <button type="button" onClick={onCopyLink} style={{ padding: "5px 11px", borderRadius: 7, border: copied === linkKey ? "1px solid #00FF9D" : "1px solid rgba(255,255,255,0.15)", background: copied === linkKey ? "rgba(0,255,157,0.10)" : "transparent", color: copied === linkKey ? "#00FF9D" : cl.text.low, fontSize: 11, cursor: "pointer", fontFamily: cl.type.ui }}>
            {copied === linkKey ? "\u2713 Copied!" : "Copy Link"}
          </button>
        )}
      </div>
    </div>
  );
}
