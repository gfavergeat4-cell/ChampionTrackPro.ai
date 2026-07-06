// Couche d'accès Supabase — remplace progressivement les appels Firestore.
// Chaque écran migré importe UNIQUEMENT depuis ce fichier.
import { supabase } from "./supabase";

function db() {
  if (!supabase) throw new Error("Supabase désactivé (EXPO_PUBLIC_USE_SUPABASE != 1)");
  return supabase;
}

// ── Auth ─────────────────────────────────────────────────────
export const signUp = (email: string, password: string) =>
  db().auth.signUp({ email, password });
export const signIn = (email: string, password: string) =>
  db().auth.signInWithPassword({ email, password });
export const signOut = () => db().auth.signOut();
export const getSession = () => db().auth.getSession();
export const onAuthChange = (cb: (uid: string | null) => void) =>
  db().auth.onAuthStateChange((_e, s) => cb(s?.user?.id ?? null));

// ── Équipe / rôle ────────────────────────────────────────────
export async function getMyMembership() {
  const { data: { user } } = await db().auth.getUser();
  if (!user) return null;
  const { data } = await db().from("memberships")
    .select("team_id, role, pseudonym, teams(name, sport, ics_url, invite_code)")
    .eq("user_id", user.id).limit(1).maybeSingle();
  return data;
}

export async function setTeamCalendar(teamId: string, url: string) {
  const { error } = await db().rpc("set_team_ics", { p_team: teamId, p_url: url });
  if (error) throw error;
  return { ok: true };
}

export async function triggerIcsSync() {
  const { data: { session } } = await db().auth.getSession();
  await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ics-sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });
  return { ok: true };
}

export async function joinTeam(inviteCode: string, role: "athlete" | "coach", displayName?: string) {
  const { data: { session } } = await db().auth.getSession();
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/join-team`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ invite_code: inviteCode, role, display_name: displayName }),
    },
  );
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? "join failed");
  return j;
}

// ── Séances ──────────────────────────────────────────────────
export async function listSessions(teamId: string, fromISO: string, toISO: string) {
  const { data, error } = await db().from("sessions")
    .select("*").eq("team_id", teamId)
    .gte("start_utc", fromISO).lte("start_utc", toISO)
    .order("start_utc");
  if (error) throw error;
  return data ?? [];
}

// ── Questionnaire ────────────────────────────────────────────
export async function getTeamQuestionnaire(teamId: string) {
  const { data } = await db().from("team_questionnaires")
    .select("questionnaires(*)").eq("team_id", teamId).limit(1).maybeSingle();
  return (data as any)?.questionnaires ?? null;
}

export async function submitResponse(p: {
  teamId: string; sessionId: string; questionnaireId: string;
  metrics: Record<string, number>;
  hasFriction?: boolean; frictionType?: string | null;
  worryLevel?: number | null; isTest?: boolean;
}) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error("not signed in");
  const { error } = await db().from("responses").insert({
    team_id: p.teamId, session_id: p.sessionId, user_id: user.id,
    questionnaire_id: p.questionnaireId, metrics: p.metrics,
    has_friction: p.hasFriction ?? false, friction_type: p.frictionType ?? null,
    worry_level: p.worryLevel ?? null,
    worry_flag: (p.worryLevel ?? 0) > 70, is_test: p.isTest ?? false,
  });
  if (error) throw error;
  return { ok: true };
}

export async function getMyResponseForSession(sessionId: string) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) return null;
  const { data } = await db().from("responses")
    .select("id, submitted_at").eq("session_id", sessionId)
    .eq("user_id", user.id).maybeSingle();
  return data;
}

// ── Coach ────────────────────────────────────────────────────
export async function getTeamMetrics(teamId: string, dayISO: string) {
  const { data, error } = await db().from("daily_metrics")
    .select("*").eq("team_id", teamId).eq("day", dayISO)
    .order("readiness", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getLatestBrief(teamId: string) {
  const { data } = await db().from("briefs")
    .select("*").eq("team_id", teamId)
    .order("brief_date", { ascending: false }).limit(1).maybeSingle();
  return data;
}

export async function sendCoachFeedback(p: {
  teamId: string; briefId?: string; flagId?: string;
  action: "acknowledged" | "overridden" | "useful" | "noise"; note?: string;
}) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error("not signed in");
  const { error } = await db().from("coach_feedback").insert({
    team_id: p.teamId, coach_id: user.id, brief_id: p.briefId ?? null,
    flag_id: p.flagId ?? null, action: p.action, note: p.note ?? null,
  });
  if (error) throw error;
  return { ok: true };
}

export async function getTeamMembers(teamId: string) {
  const { data: mems, error } = await db().from("memberships")
    .select("user_id, role, jersey_number, pseudonym")
    .eq("team_id", teamId);
  if (error) throw error;
  const ids = (mems ?? []).map((m) => m.user_id);
  const profMap: Record<string, any> = {};
  if (ids.length) {
    const { data: profs } = await db().from("profiles")
      .select("user_id, display_name").in("user_id", ids);
    for (const p of profs ?? []) profMap[p.user_id] = p;
  }
  return (mems ?? []).map((m) => ({ ...m, profiles: profMap[m.user_id] ?? null }));
}
