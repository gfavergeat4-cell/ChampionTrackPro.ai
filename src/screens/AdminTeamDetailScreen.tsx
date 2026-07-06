/**
 * AdminTeamDetailScreen.tsx
 * Dashboard-first team view for admins.
 * Full PerformanceDashboard embedded as main content.
 * Gear icon (⚙) top-right opens a slide-in settings drawer.
 *
 * Route params: { teamId: string, teamName?: string }
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Platform, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  doc, getDoc, updateDoc, setDoc, serverTimestamp,
  collection, getDocs, deleteDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";
import PerformanceDashboard from "./PerformanceDashboard";
import {
  seedDefaultQuestionnaires,
  fetchTeamQuestionnaire,
  QuestionnaireDoc,
} from "../utils/questionnaireTemplates";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamDoc {
  name?: string;
  sport?: string;
  division?: string;
  logoUrl?: string;
  seasonStart?: string;
  seasonEnd?: string;
  inviteCode?: string;
  calendarUrl?: string;
  icsUrl?: string;
  calendarActive?: boolean;
  calendarLastSyncStatus?: "ok" | "error" | "syncing";
  calendarSyncError?: string;
  calendarLastSyncAt?: any;
  questionnaireId?: string;
  questionnaireIds?: string[];
}

type AccordionKey = "info" | "codes" | "members";
type CopiedKey = "coach-code" | "coach-link" | "athlete-code" | "athlete-link" | null;

// ── Constants ─────────────────────────────────────────────────────────────────

const JOIN_BASE = "https://champion-track-pro.vercel.app";

// ── Helpers ───────────────────────────────────────────────────────────────────

const sanitize = (str: string, maxLen = 200): string =>
  str.trim().replace(/[<>"']/g, "").slice(0, maxLen);

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

function formatDate(val: any): string {
  if (!val) return "—";
  try {
    const d = val instanceof Date ? val : val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "—"; }
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 9,
  border: "1px solid rgba(0,212,255,0.20)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  fontSize: 13,
  fontFamily: "'DM Sans', system-ui",
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
  const [team, setTeam] = useState<TeamDoc | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  // Team info form
  const [editName, setEditName] = useState("");
  const [editLogoBase64, setEditLogoBase64] = useState<string | null>(null);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Calendar (in Team Info)
  const [calendarUrl, setCalendarUrl] = useState("");
  const [calendarActive, setCalendarActive] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Questionnaire (in Team Info)
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireDoc | null>(null);
  const [questionnaireLoading, setQuestionnaireLoading] = useState(false);
  const [allQuestionnaires, setAllQuestionnaires] = useState<QuestionnaireDoc[]>([]);
  const [editSelectedQIds, setEditSelectedQIds] = useState<string[]>([]);
  const seededRef = useRef(false);
  const editLogoFileRef = useRef<HTMLInputElement>(null);

  // Members
  interface MemberEntry {
    uid: string;
    name: string;
    email: string;
    role: string;
    joinedAt: any;
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
        const snap = await getDoc(doc(db, "teams", teamId));
        if (cancelled || !snap.exists()) { setTeamLoading(false); return; }
        const data = snap.data() as TeamDoc;
        setTeam(data);
        setCalendarUrl(data.calendarUrl || data.icsUrl || "");
        setCalendarActive(data.calendarActive !== false);
        setEditName(data.name || "");
        setEditLogoBase64(data.logoUrl || null);
        setEditSelectedQIds(data.questionnaireIds || (data.questionnaireId ? [data.questionnaireId] : []));
        let code = data.inviteCode;
        if (!code) {
          code = generateCode(6);
          await setDoc(doc(db, "teams", teamId), { inviteCode: code }, { merge: true });
        }
        setInviteCode(code);
      } catch {}
      finally { if (!cancelled) setTeamLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [teamId]);

  // ── Load questionnaire (lazy on Team Info accordion open) ────────────────

  useEffect(() => {
    if (openAccordion !== "info" || !teamId) return;
    if (questionnaire && allQuestionnaires.length > 0) return; // already loaded

    let cancelled = false;
    setQuestionnaireLoading(true);

    (async () => {
      try {
        // Seed defaults once
        if (!seededRef.current) {
          seededRef.current = true;
          await seedDefaultQuestionnaires();
        }

        // Load team's questionnaire
        const teamQ = await fetchTeamQuestionnaire(teamId, team?.sport);
        if (!cancelled && teamQ) {
          setQuestionnaire(teamQ);
          setEditSelectedQIds(prev => prev.length > 0 ? prev : [teamQ.id]);
        }

        // Load all for inline picker
        const allSnap = await getDocs(collection(db, "questionnaires"));
        if (!cancelled) {
          const all = allSnap.docs
            .map(d => ({ id: d.id, ...(d.data() as any) } as QuestionnaireDoc))
            .filter(q => !q.isArchived)
            .sort((a, b) => a.sport.localeCompare(b.sport) || a.name.localeCompare(b.name));
          setAllQuestionnaires(all);
        }
      } catch {}
      finally { if (!cancelled) setQuestionnaireLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [openAccordion, teamId, team?.sport]);

  // ── Load members (lazy on accordion open) ────────────────────────────────

  useEffect(() => {
    if (openAccordion !== "members" || membersLoaded || !teamId) return;
    let cancelled = false;
    setMembersLoading(true);
    (async () => {
      try {
        const snap = await getDocs(collection(db, "teams", teamId, "members"));
        if (cancelled) return;
        const list: MemberEntry[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            uid: d.id,
            name: data.displayName || data.name || data.fullName || d.id,
            email: data.email || "",
            role: data.role || "athlete",
            joinedAt: data.joinedAt || null,
          };
        });
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
      await updateDoc(doc(db, "teams", teamId), {
        name: sanitize(editName, 100),
        logoUrl: editLogoBase64 || null,
        calendarUrl: calendarUrl.trim(),
        icsUrl: calendarUrl.trim(),
        calendarActive,
        questionnaireIds: editSelectedQIds,
        questionnaireId: editSelectedQIds[0] || null,
        updatedAt: serverTimestamp(),
      });
      setTeam(prev => prev ? { ...prev, name: editName.trim(), logoUrl: editLogoBase64 || undefined } : prev);
      setInfoMsg("Saved.");
      setTimeout(() => setInfoMsg(null), 2500);
    } catch (e: any) {
      setInfoMsg("Error: " + (e?.message || String(e)));
    } finally { setSavingInfo(false); }
  }, [teamId, editName, editLogoBase64, calendarUrl, calendarActive, editSelectedQIds]);

  const handleSyncNow = useCallback(async () => {
    if (!teamId) return;
    setSyncing(true); setSyncMsg(null);
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
    try { await copyText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); } catch {}
  }, []);

  const handleRemoveMember = useCallback(async (uid: string) => {
    if (!teamId) return;
    setRemovingUid(uid);
    try {
      await deleteDoc(doc(db, "teams", teamId, "members", uid));
      await updateDoc(doc(db, "users", uid), { teamId: null });
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
  const coachCode = inviteCode ? `${inviteCode}-C` : "—";
  const athleteCode = inviteCode ? `${inviteCode}-A` : "—";
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

        {/* Logo */}
        <FieldGroup label="Team Logo">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            {editLogoBase64 ? (
              <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(0,212,255,0.30)", flexShrink: 0 }}>
                <img src={editLogoBase64} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(0,212,255,0.08)", border: "2px dashed rgba(0,212,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 18 }}>🏆</span>
              </div>
            )}
            <div>
              <input ref={editLogoFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e: any) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => setEditLogoBase64((ev.target?.result as string) || null);
                reader.readAsDataURL(file);
              }} />
              <button type="button" onClick={() => editLogoFileRef.current?.click()} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(0,212,255,0.30)", background: "transparent", color: "#00D4FF", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', system-ui" }}>
                {editLogoBase64 ? "Change" : "Upload Logo"}
              </button>
              {editLogoBase64 && (
                <button type="button" onClick={() => setEditLogoBase64(null)} style={{ marginLeft: 6, padding: "6px 10px", borderRadius: 7, border: "1px solid rgba(255,77,77,0.25)", background: "transparent", color: "rgba(255,77,77,0.60)", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', system-ui" }}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </FieldGroup>

        {/* Calendar URL */}
        <FieldGroup label="ICS Calendar URL">
          <input type="url" value={calendarUrl} onChange={(e: any) => setCalendarUrl(e.target.value)} placeholder="https://calendar.google.com/..." style={{ ...inputStyle, fontFamily: "'Space Mono', monospace", fontSize: 11, marginBottom: 8 }} />
        </FieldGroup>

        {/* Auto-sync toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Auto-sync (every 15 min)</span>
          <Toggle value={calendarActive} onChange={setCalendarActive} />
        </div>

        {/* Sync now */}
        {(calendarUrl.trim() || team?.icsUrl) && (
          <div style={{ marginBottom: 14 }}>
            <SmallBtn onClick={handleSyncNow} disabled={syncing}>{syncing ? "Syncing…" : "Sync Now"}</SmallBtn>
            {syncMsg && <Msg text={syncMsg} />}
          </div>
        )}

        {/* Questionnaire selector */}
        <FieldGroup label="Questionnaire Template">
          {questionnaireLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
              <ActivityIndicator color="#00D4FF" size="small" />
            </div>
          ) : allQuestionnaires.length === 0 ? (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", padding: "6px 0" }}>No templates found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {allQuestionnaires.map(q => {
                const isSelected = editSelectedQIds.includes(q.id);
                const sessionLabel =
                  q.sessionType === "any" ? "Any Session" :
                  q.sessionType === "game" ? "Game Day" : q.sessionType;
                const toggle = () => setEditSelectedQIds(prev =>
                  prev.includes(q.id) ? prev.filter(x => x !== q.id) : [...prev, q.id]
                );
                return (
                  <button key={q.id} type="button" onClick={toggle} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: isSelected ? "2px solid #00D4FF" : "1px solid rgba(255,255,255,0.08)", background: isSelected ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.02)", color: "#fff", textAlign: "left" as const, cursor: "pointer", fontFamily: "'DM Sans', system-ui", transition: "all 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 5 }}>{q.name}</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                          <Badge label={q.sport} color="#00D4FF" />
                          <Badge label={sessionLabel} color="#00FF9D" />
                          {q.isDefault && <Badge label="Default" color="#FFB800" />}
                        </div>
                      </div>
                      {/* Checkbox */}
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: isSelected ? "none" : "1.5px solid rgba(255,255,255,0.25)", background: isSelected ? "#00D4FF" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2, transition: "all 0.15s" }}>
                        {isSelected && <span style={{ color: "#0A0F1E", fontSize: 9, fontWeight: 800 }}>✓</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </FieldGroup>

        <SmallBtn primary onClick={handleSaveTeamInfo} disabled={savingInfo}>{savingInfo ? "Saving…" : "Save"}</SmallBtn>
        {infoMsg && <Msg text={infoMsg} />}
      </div>
    );
  }

  function renderAccessCodesAccordion() {
    return (
      <div>
        <p style={{ margin: "0 0 14px 0", fontSize: 12, color: "rgba(255,255,255,0.40)" }}>
          Share these codes to invite staff and athletes.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <CodeCard label="Coach Code" color="#00D4FF" code={coachCode} link={coachLink} copied={copied} codeKey="coach-code" linkKey="coach-link" onCopyCode={() => handleCopy("coach-code", coachCode)} onCopyLink={() => handleCopy("coach-link", coachLink)} />
          <CodeCard label="Athlete Code" color="#00FF9D" code={athleteCode} link={athleteLink} copied={copied} codeKey="athlete-code" linkKey="athlete-link" onCopyCode={() => handleCopy("athlete-code", athleteCode)} onCopyLink={() => handleCopy("athlete-link", athleteLink)} />
        </div>
      </div>
    );
  }

  function renderMembersAccordion() {
    const coaches = members.filter(m => m.role === "coach");
    const athletes = members.filter(m => m.role === "athlete");
    const countLabel = membersLoaded
      ? `${coaches.length} Coach${coaches.length !== 1 ? "es" : ""} · ${athletes.length} Athlete${athletes.length !== 1 ? "s" : ""}`
      : "";

    if (membersLoading) {
      return <div style={{ display: "flex", justifyContent: "center", padding: 16 }}><ActivityIndicator color="#00D4FF" size="small" /></div>;
    }

    return (
      <div>
        {countLabel ? (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginBottom: 12, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
            {countLabel}
          </div>
        ) : null}

        {members.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", padding: "8px 0" }}>No members yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {members.map(m => {
              const initials = m.name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
              const isCoachRole = m.role === "coach";
              const isConfirming = confirmRemoveUid === m.uid;
              const isRemoving = removingUid === m.uid;
              return (
                <div key={m.uid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {/* Avatar */}
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: isCoachRole ? "rgba(0,212,255,0.15)" : "rgba(0,255,157,0.12)", border: `1px solid ${isCoachRole ? "rgba(0,212,255,0.35)" : "rgba(0,255,157,0.35)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: isCoachRole ? "#00D4FF" : "#00FF9D", flexShrink: 0 }}>
                    {initials || "?"}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                    {m.email ? <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div> : null}
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>{m.joinedAt ? formatDate(m.joinedAt) : ""}</div>
                  </div>
                  {/* Role badge */}
                  <span style={{ fontSize: 9, fontWeight: 700, color: isCoachRole ? "#00D4FF" : "#00FF9D", background: isCoachRole ? "rgba(0,212,255,0.10)" : "rgba(0,255,157,0.10)", border: `1px solid ${isCoachRole ? "rgba(0,212,255,0.25)" : "rgba(0,255,157,0.25)"}`, borderRadius: 10, padding: "2px 7px", textTransform: "uppercase" as const, letterSpacing: 0.5, flexShrink: 0 }}>
                    {m.role}
                  </span>
                  {/* Remove button */}
                  {isConfirming ? (
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      <button type="button" disabled={isRemoving} onClick={() => handleRemoveMember(m.uid)} style={{ padding: "4px 9px", borderRadius: 6, border: "1px solid rgba(255,68,68,0.5)", background: "rgba(255,68,68,0.12)", color: "#FF4444", fontSize: 10, fontWeight: 700, cursor: isRemoving ? "not-allowed" : "pointer", opacity: isRemoving ? 0.6 : 1 }}>
                        {isRemoving ? "…" : "Confirm"}
                      </button>
                      <button type="button" onClick={() => setConfirmRemoveUid(null)} style={{ padding: "4px 9px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.45)", fontSize: 10, cursor: "pointer" }}>
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
    <div style={{ minHeight: "100vh", background: "#0A0F1E", overflowX: "hidden" }}>

      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,15,30,0.96)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid rgba(0,212,255,0.08)", padding: isDesktop ? "14px 32px" : "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
        <button type="button" onClick={() => navigation.goBack()} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, color: "rgba(255,255,255,0.55)", padding: "7px 13px", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', system-ui", flexShrink: 0 }}>
          ← Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isDesktop ? 18 : 16, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {teamLoading ? routeTeamName || "…" : teamName}
          </div>
          {(team?.sport || team?.division) && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 1 }}>
              {[team.sport, team.division].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        {/* Gear icon */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          title="Team settings"
          style={{ background: drawerOpen ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(0,212,255,0.20)", borderRadius: 10, color: "#00D4FF", padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" }}
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
        background: "#0D1526",
        borderLeft: "1px solid rgba(0,212,255,0.15)",
        transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
        zIndex: 201,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Drawer header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px 20px", borderBottom: "1px solid rgba(0,212,255,0.08)", flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.80)", letterSpacing: 0.5 }}>
            {teamName}
          </div>
          <button type="button" onClick={() => setDrawerOpen(false)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.50)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 2px", fontFamily: "system-ui" }}>
            ×
          </button>
        </div>

        {/* Accordions */}
        <div style={{ padding: "12px 16px", flex: 1 }}>

          <Accordion icon="👥" title="Team Info" isOpen={openAccordion === "info"} onToggle={() => toggleAccordion("info")}>
            {renderTeamInfoAccordion()}
          </Accordion>

          <Accordion icon="🔑" title="Access Codes" isOpen={openAccordion === "codes"} onToggle={() => toggleAccordion("codes")}>
            {renderAccessCodesAccordion()}
          </Accordion>

          <Accordion icon="👥" title="Members" isOpen={openAccordion === "members"} onToggle={() => toggleAccordion("members")}>
            {renderMembersAccordion()}
          </Accordion>

        </div>
      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Accordion({
  icon, title, isOpen, onToggle, children,
}: {
  icon: string; title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <button type="button" onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, background: isOpen ? "rgba(0,212,255,0.06)" : "rgba(255,255,255,0.03)", border: isOpen ? "1px solid rgba(0,212,255,0.18)" : "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "all 0.2s" }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ flex: 1, textAlign: "left" as const, fontSize: 13, fontWeight: 600, color: isOpen ? "#fff" : "rgba(255,255,255,0.65)", fontFamily: "'DM Sans', system-ui" }}>{title}</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", transition: "transform 0.2s", display: "inline-block", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
      </button>
      {isOpen && (
        <div style={{ padding: "14px 14px 8px 14px", borderLeft: "1px solid rgba(0,212,255,0.08)", marginLeft: 10, marginTop: 2, marginBottom: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function FieldGroup({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{ gridColumn: span === 2 ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, border: "none", background: value ? "#00D4FF" : "rgba(255,255,255,0.15)", cursor: "pointer", position: "relative", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
    </button>
  );
}

function SmallBtn({
  children, onClick, disabled, primary,
}: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ padding: "8px 18px", borderRadius: 8, border: primary ? "none" : "1px solid rgba(0,212,255,0.30)", background: primary ? "linear-gradient(135deg,#00BFFF,#0066FF)" : "transparent", color: primary ? "#fff" : "#00D4FF", fontWeight: 600, fontSize: 12, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, fontFamily: "'DM Sans', system-ui" }}>
      {children}
    </button>
  );
}

function Msg({ text }: { text: string }) {
  const isError = text.startsWith("Error");
  return <p style={{ margin: "6px 0 0 0", fontSize: 11, color: isError ? "#FCA5A5" : "#00FF9D" }}>{text}</p>;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ padding: "2px 8px", borderRadius: 10, background: `${color}18`, border: `1px solid ${color}40`, color, fontSize: 10, fontFamily: "'Space Mono', monospace", letterSpacing: 0.5 }}>
      {label}
    </span>
  );
}

interface CodeCardProps {
  label: string; color: string; code: string; link: string;
  copied: CopiedKey; codeKey: CopiedKey; linkKey: CopiedKey;
  onCopyCode: () => void; onCopyLink: () => void;
}

function CodeCard({ label, color, code, link, copied, codeKey, linkKey, onCopyCode, onCopyLink }: CodeCardProps) {
  return (
    <div style={{ background: `${color}08`, border: `1px solid ${color}30`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.40)", letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color, letterSpacing: 3, marginBottom: 10 }}>{code}</div>
      <div style={{ display: "flex", gap: 7 }}>
        <button type="button" onClick={onCopyCode} style={{ padding: "5px 11px", borderRadius: 7, border: copied === codeKey ? "1px solid #00FF9D" : "1px solid rgba(255,255,255,0.15)", background: copied === codeKey ? "rgba(0,255,157,0.10)" : "transparent", color: copied === codeKey ? "#00FF9D" : "rgba(255,255,255,0.55)", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', system-ui" }}>
          {copied === codeKey ? "✓ Copied!" : "Copy Code"}
        </button>
        {link && (
          <button type="button" onClick={onCopyLink} style={{ padding: "5px 11px", borderRadius: 7, border: copied === linkKey ? "1px solid #00FF9D" : "1px solid rgba(255,255,255,0.15)", background: copied === linkKey ? "rgba(0,255,157,0.10)" : "transparent", color: copied === linkKey ? "#00FF9D" : "rgba(255,255,255,0.55)", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', system-ui" }}>
            {copied === linkKey ? "✓ Copied!" : "Copy Link"}
          </button>
        )}
      </div>
    </div>
  );
}
