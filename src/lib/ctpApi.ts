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
export async function getMyMetricsToday() {
  const { data: { user } } = await db().auth.getUser();
  if (!user) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db().from("daily_metrics")
    .select("*").eq("user_id", user.id).eq("day", today).maybeSingle();
  return data;
}

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

// ── Push subscriptions (VAPID) ────────────────────────────────
export async function savePushSubscription(sub: {
  endpoint: string; p256dh: string; authKey: string;
}) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error("not signed in");
  const { error } = await db().from("push_subscriptions").upsert({
    user_id: user.id, endpoint: sub.endpoint,
    p256dh: sub.p256dh, auth_key: sub.authKey,
  }, { onConflict: "user_id,endpoint" });
  if (error) throw error;
}

export async function removePushSubscription(endpoint: string) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error("not signed in");
  await db().from("push_subscriptions")
    .delete().eq("user_id", user.id).eq("endpoint", endpoint);
}

// ── Team ─────────────────────────────────────────────────────
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

// ── Admin ────────────────────────────────────────────────────
/** Lists all teams the current user administers (role admin or coach). */
export async function getAdminTeams() {
  const { data: { user } } = await db().auth.getUser();
  if (!user) return [];
  const { data: mems } = await db().from("memberships")
    .select("team_id, role, teams(id, name, sport, invite_code)")
    .eq("user_id", user.id)
    .in("role", ["admin", "coach"]);
  if (!mems?.length) return [];
  // Enrich with member count
  const teams = await Promise.all(
    (mems as any[]).map(async (m) => {
      const team = m.teams as any;
      const { count } = await db().from("memberships")
        .select("*", { count: "exact", head: true })
        .eq("team_id", m.team_id);
      return {
        id: team?.id ?? m.team_id,
        name: team?.name ?? m.team_id,
        sport: team?.sport ?? null,
        invite_code: team?.invite_code ?? null,
        memberCount: count ?? 0,
      };
    }),
  );
  return teams;
}

/** Get full team info for admin screens. */
export async function getTeamInfo(teamId: string) {
  const { data, error } = await db().from("teams")
    .select("*").eq("id", teamId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Update team info (admin). */
export async function updateTeamInfo(teamId: string, updates: Record<string, any>) {
  const { error } = await db().from("teams")
    .update(updates).eq("id", teamId);
  if (error) throw error;
  return { ok: true };
}

/** Remove a member from a team (admin). */
export async function removeMember(teamId: string, userId: string) {
  const { error } = await db().from("memberships")
    .delete().eq("team_id", teamId).eq("user_id", userId);
  if (error) throw error;
  return { ok: true };
}

/** Create a team via edge function (service-role pattern). */
export async function createTeam(name: string, sport: string) {
  const { data: { session } } = await db().auth.getSession();
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-team`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ name, sport }),
    },
  );
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? "create team failed");
  return j;
}

/** Get daily metrics for a team over a date range. */
export async function getTeamMetricsRange(teamId: string, fromISO: string, toISO: string) {
  const { data, error } = await db().from("daily_metrics")
    .select("*").eq("team_id", teamId)
    .gte("day", fromISO).lte("day", toISO)
    .order("day");
  if (error) throw error;
  return data ?? [];
}

/** Get user profile. */
export async function getMyProfile() {
  const { data: { user } } = await db().auth.getUser();
  if (!user) return null;
  const { data: profile } = await db().from("profiles")
    .select("*").eq("user_id", user.id).maybeSingle();
  const membership = await getMyMembership();
  return { user, profile, membership };
}

/** Update user profile. */
export async function updateMyProfile(updates: { display_name?: string; jersey_number?: number; position?: string }) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error("not signed in");
  const { error } = await db().from("profiles")
    .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" });
  if (error) throw error;
  return { ok: true };
}
