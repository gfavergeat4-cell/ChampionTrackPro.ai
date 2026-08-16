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

/**
 * Adhésion par code. Le rôle n'est PAS un paramètre : le serveur le déduit
 * du code présenté (code athlète ou code staff). Voir doc 11 P0-2.
 */
export async function joinTeam(inviteCode: string, displayName?: string) {
  const { data: { session } } = await db().auth.getSession();
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/join-team`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ invite_code: inviteCode, display_name: displayName }),
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
  frictionArea?: string | null; frictionImpact?: number | null;
  worryLevel?: number | null; isTest?: boolean;
}) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error("not signed in");
  const { error } = await db().from("responses").insert({
    team_id: p.teamId, session_id: p.sessionId, user_id: user.id,
    questionnaire_id: p.questionnaireId, metrics: p.metrics,
    has_friction: p.hasFriction ?? false, friction_type: p.frictionType ?? null,
    friction_area: p.frictionArea ?? null,
    friction_impact: p.frictionImpact ?? null,
    worry_level: p.worryLevel ?? null,
    worry_flag: (p.worryLevel ?? 0) > 70, is_test: p.isTest ?? false,
  });
  if (error) throw error;
  return { ok: true };
}

/**
 * Résout le questionnaire à servir pour une séance donnée (doc 15 §3).
 * Priorité : questionnaire de l'équipe dont `session_type` correspond au type
 * de la séance → sinon celui de type 'any' → sinon le premier disponible.
 * Une équipe peut donc être reliée à plusieurs questionnaires.
 */
export async function getQuestionnaireForSession(teamId: string, sessionType?: string | null) {
  const { data } = await db().from("team_questionnaires")
    .select("questionnaires(*)").eq("team_id", teamId);
  const list = (data ?? [])
    .map((r: any) => r.questionnaires)
    .filter(Boolean)
    .filter((q: any) => !q.is_archived);
  if (!list.length) return null;
  return (
    list.find((q: any) => sessionType && q.session_type === sessionType) ??
    list.find((q: any) => q.session_type === "any") ??
    list[0]
  );
}

/** Une seule séance, par identifiant. (getSession est déjà pris par l'auth) */
export async function getSessionById(sessionId: string) {
  const { data } = await db().from("sessions")
    .select("id, team_id, title, session_type, start_utc, end_utc")
    .eq("id", sessionId).maybeSingle();
  return data;
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
    .select("user_id, role, jersey_number, position, pseudonym")
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

/**
 * Dernière séance déjà terminée de l'équipe + les réponses associées.
 * Sert au statut de compliance du roster coach (parité CoachTeamScreen V1 :
 * worry_flag, readiness < 40, friction_impact > 70).
 */
export async function getTeamLatestSessionResponses(teamId: string) {
  const { data: session } = await db().from("sessions")
    .select("id, title, start_utc, end_utc")
    .eq("team_id", teamId)
    .eq("cancelled", false)
    .lte("end_utc", new Date().toISOString())
    .order("end_utc", { ascending: false })
    .limit(1).maybeSingle();
  if (!session) return { session: null, responses: [] as any[] };

  const { data: responses } = await db().from("responses")
    .select("user_id, readiness_score, worry_flag, has_friction, friction_impact, submitted_at")
    .eq("session_id", (session as any).id);
  return { session, responses: responses ?? [] };
}

/**
 * Réponses de plusieurs séances en une passe (planning coach).
 * Découpé en tranches de 200 pour rester sous les limites d'URL PostgREST.
 */
export async function getResponsesForSessions(sessionIds: string[]) {
  if (!sessionIds.length) return [] as any[];
  const out: any[] = [];
  for (let i = 0; i < sessionIds.length; i += 200) {
    const chunk = sessionIds.slice(i, i + 200);
    const { data, error } = await db().from("responses")
      .select("user_id, session_id, worry_flag, has_friction, readiness_score")
      .in("session_id", chunk);
    if (error) throw error;
    if (data) out.push(...data);
  }
  return out;
}

/** Historique des métriques d'un athlète (fiche joueur coach). */
export async function getAthleteMetricsRange(userId: string, fromISO: string, toISO: string) {
  const { data, error } = await db().from("daily_metrics")
    .select("*").eq("user_id", userId)
    .gte("day", fromISO).lte("day", toISO)
    .order("day");
  if (error) throw error;
  return data ?? [];
}

/** Dernières réponses brutes d'un athlète (fiche joueur coach). */
export async function getAthleteResponses(userId: string, teamId: string, max = 30) {
  const { data, error } = await db().from("responses")
    .select("id, session_id, metrics, readiness_score, has_friction, friction_type, worry_level, worry_flag, submitted_at")
    .eq("user_id", userId).eq("team_id", teamId)
    .order("submitted_at", { ascending: false })
    .limit(max);
  if (error) throw error;
  return data ?? [];
}

// ── Admin ────────────────────────────────────────────────────
/** Lists all teams the current user administers (role admin or coach). */
export async function getAdminTeams() {
  const { data: { user } } = await db().auth.getUser();
  if (!user) return [];
  const { data: mems } = await db().from("memberships")
    .select("team_id, role, teams(id, name, sport, invite_code, coach_code)")
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
        coach_code: team?.coach_code ?? null,
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

/**
 * Retire un membre de l'équipe. **Ne supprime pas ses données** : réponses et
 * métriques restent, l'historique de l'équipe est préservé. C'est le geste
 * courant (un joueur quitte le programme).
 * Pour effacer réellement, voir `purgeAthlete`.
 */
export async function removeMember(teamId: string, userId: string) {
  const { error } = await db().from("memberships")
    .delete().eq("team_id", teamId).eq("user_id", userId);
  if (error) throw error;
  return { ok: true };
}

async function adminPurge(body: Record<string, unknown>) {
  const { data: { session } } = await db().auth.getSession();
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/admin-purge`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body),
    },
  );
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? "purge failed");
  return j;
}

/**
 * ⚠ IRRÉVERSIBLE. Efface toutes les données d'un athlète dans cette équipe :
 * réponses, métriques, flags, relances, adhésion. Le compte `auth.users` est
 * conservé (la personne peut appartenir à une autre équipe).
 * Réservé à un admin de l'équipe. Répond au droit à la suppression (doc 12).
 */
export async function purgeAthlete(teamId: string, userId: string) {
  return adminPurge({ action: "purge_athlete", team_id: teamId, user_id: userId });
}

/** ⚠ IRRÉVERSIBLE. Fin de contrat : efface l'équipe et tout son historique. */
export async function purgeTeam(teamId: string) {
  return adminPurge({ action: "purge_team", team_id: teamId });
}

/** Export complet des données d'un athlète — droit à la portabilité. */
export async function exportAthlete(teamId: string, userId: string) {
  return adminPurge({ action: "export_athlete", team_id: teamId, user_id: userId });
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

// ── Consentements (doc 12 R-04, doc 14 P1-7) ─────────────────
export interface PendingConsent {
  key: string;
  version: string;
  title: string;
  url: string;
  summary: string | null;
  effective_at: string;
}

/**
 * Documents que l'utilisateur courant doit encore accepter.
 * Ne remonte que les documents en statut `active` : tant que les textes
 * n'ont pas été relus par un avocat, ils restent en `draft` et cette
 * fonction renvoie une liste vide — donc aucun blocage.
 */
export async function getPendingConsents(): Promise<PendingConsent[]> {
  return safe(db().from("v_my_pending_consents").select("*"), [] as PendingConsent[]);
}

/** Enregistre l'acceptation. Une ligne par document et par version, horodatée et immuable. */
export async function acceptConsents(docs: { key: string; version: string }[]) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error("not signed in");
  if (!docs.length) return { ok: true };
  const { error } = await db().from("user_consents").insert(
    docs.map((d) => ({ user_id: user.id, doc_key: d.key, version: d.version })),
  );
  if (error) throw error;
  return { ok: true };
}

/** Tous les textes publiés, pour l'écran d'inscription et les liens de pied de page. */
export async function getLegalDocuments() {
  const { data } = await db().from("legal_documents")
    .select("key, version, title, url, summary, status, effective_at")
    .neq("status", "retired")
    .order("key");
  return data ?? [];
}

// ── Lecture coach multi-marqueurs (méthode DAR, doc 15) ──────
export type Zone = "GREEN" | "BLUE" | "YELLOW" | "INSUFFICIENT_DATA";
export type Axis = "PHY" | "TEC" | "MEN" | "ACA";

export interface AxisReading {
  axis: Axis;
  value: number | null;
  ema: number | null;
  deltaPoints: number | null;
  zone: Zone;
  trend7d: number | null;
  dataDays: number;
}

export interface AthleteBoardRow {
  userId: string;
  name: string;
  pseudonym: string | null;
  jerseyNumber: number | null;
  position: string | null;
  axes: Partial<Record<Axis, AxisReading>>;
  /** Nombre de marqueurs hors zone habituelle — tri arithmétique, pas un jugement. */
  outOfBand: number;
  responded: boolean;
}

/**
 * Tableau de lecture du coach pour un jour donné.
 * Une ligne par athlète, un état par axe. **Aucune moyenne d'équipe** :
 * la méthode DAR proscrit la normalisation interindividuelle (partie 2 §E.4).
 * L'agrégation se fait par distribution, calculée dans l'écran.
 */
export async function getCoachBoard(teamId: string, dayISO: string): Promise<AthleteBoardRow[]> {
  const [rows, members] = await Promise.all([
    safe(db().from("v_coach_board").select("*").eq("team_id", teamId).eq("day", dayISO), [] as any[]),
    getTeamMembers(teamId),
  ]);

  const byUser: Record<string, AthleteBoardRow> = {};
  for (const m of (members as any[]).filter((x) => x.role === "athlete")) {
    byUser[m.user_id] = {
      userId: m.user_id,
      name: m.profiles?.display_name || m.pseudonym || "Player",
      pseudonym: m.pseudonym ?? null,
      jerseyNumber: m.jersey_number ?? null,
      position: m.position ?? null,
      axes: {},
      outOfBand: 0,
      responded: false,
    };
  }

  for (const r of rows as any[]) {
    const row = byUser[r.user_id];
    if (!row) continue;
    row.responded = true;
    row.axes[r.axis as Axis] = {
      axis: r.axis,
      value: r.value,
      ema: r.ema,
      deltaPoints: r.delta_points,
      zone: (r.zone ?? "INSUFFICIENT_DATA") as Zone,
      trend7d: r.ema_trend_7d,
      dataDays: r.data_days ?? 0,
    };
  }

  for (const row of Object.values(byUser)) {
    row.outOfBand = Object.values(row.axes)
      .filter((a) => a && (a.zone === "YELLOW" || a.zone === "BLUE")).length;
  }

  return Object.values(byUser).sort((a, b) => {
    if (a.responded !== b.responded) return a.responded ? -1 : 1;
    if (b.outOfBand !== a.outOfBand) return b.outOfBand - a.outOfBand;
    return a.name.localeCompare(b.name);
  });
}

/** Historique d'un axe pour un athlète — sert au détail joueur. */
export async function getAxisHistory(userId: string, axis: Axis, days = 28) {
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data } = await db().from("v_axis_zones")
    .select("day, value, ema, delta_points, zone")
    .eq("user_id", userId).eq("axis", axis)
    .gte("day", from).order("day");
  return data ?? [];
}

// ── Console santé système (doc 09 lot L3) ────────────────────
export interface TeamHealth {
  id: string;
  name: string;
  athletes: number;
  staff: number;
  lastBriefDate: string | null;
  briefsCount: number;
  sessionsEnded: number;
  sessionsUpcoming: number;
  responses: number;
  expectedResponses: number;
  compliancePct: number | null;
  remindersPending: number;
  remindersSent: number;
  cost30dUsd: number | null;
  llmErrors: number | null;
  icsConfigured: boolean;
}

async function safe<T>(p: PromiseLike<{ data: T | null }>, fallback: T): Promise<T> {
  try { const { data } = await p; return (data ?? fallback) as T; }
  catch { return fallback; }
}

/**
 * Photographie lecture seule de l'état du système, équipe par équipe.
 * Répond à « est-ce que tout tourne, et sinon où ? » sans ouvrir Supabase.
 * `cost30dUsd` et les relances nécessitent la migration 010 ; en son absence
 * les champs valent null / 0 plutôt que de faire échouer l'écran.
 */
export async function getAdminSystemHealth(days = 7): Promise<TeamHealth[]> {
  const teams = await getAdminTeams();
  const now = Date.now();
  const sinceISO = new Date(now - days * 86400000).toISOString();
  const sinceDay = sinceISO.slice(0, 10);
  const since30ISO = new Date(now - 30 * 86400000).toISOString();
  const nowISO = new Date(now).toISOString();

  return Promise.all(teams.map(async (t: any): Promise<TeamHealth> => {
    const [briefs, members, responses, sessions, logs, reminders, info] = await Promise.all([
      safe(db().from("briefs").select("brief_date").eq("team_id", t.id)
        .gte("brief_date", sinceDay).order("brief_date", { ascending: false }), [] as any[]),
      safe(db().from("memberships").select("role").eq("team_id", t.id), [] as any[]),
      safe(db().from("responses").select("id").eq("team_id", t.id)
        .gte("submitted_at", sinceISO), [] as any[]),
      safe(db().from("sessions").select("id, end_utc").eq("team_id", t.id)
        .eq("cancelled", false).gte("end_utc", sinceISO), [] as any[]),
      safe(db().from("llm_logs").select("cost_usd, ok").eq("team_id", t.id)
        .gte("created_at", since30ISO), null as any[] | null),
      safe(db().from("pending_reminders").select("status").eq("team_id", t.id)
        .gte("created_at", sinceISO), [] as any[]),
      safe(db().from("teams").select("ics_url").eq("id", t.id).limit(1), [] as any[]),
    ]);

    const athletes = (members as any[]).filter((m) => m.role === "athlete").length;
    const staff = (members as any[]).filter((m) => m.role !== "athlete").length;
    const ended = (sessions as any[]).filter((s) => s.end_utc <= nowISO);
    const upcoming = (sessions as any[]).length - ended.length;
    const expected = ended.length * athletes;

    return {
      id: t.id,
      name: t.name,
      athletes,
      staff,
      lastBriefDate: (briefs as any[])[0]?.brief_date ?? null,
      briefsCount: (briefs as any[]).length,
      sessionsEnded: ended.length,
      sessionsUpcoming: upcoming,
      responses: (responses as any[]).length,
      expectedResponses: expected,
      compliancePct: expected > 0
        ? Math.round(((responses as any[]).length / expected) * 100)
        : null,
      remindersPending: (reminders as any[]).filter((r) => r.status === "pending").length,
      remindersSent: (reminders as any[]).filter((r) => r.status === "sent").length,
      cost30dUsd: logs
        ? (logs as any[]).reduce((a, l) => a + Number(l.cost_usd ?? 0), 0)
        : null,
      llmErrors: logs ? (logs as any[]).filter((l) => l.ok === false).length : null,
      icsConfigured: Boolean((info as any[])[0]?.ics_url),
    };
  }));
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
/**
 * `display_name` vit sur `profiles`, `jersey_number` et `position` sur
 * `memberships` (doc 11 P1-11). L'ancienne version écrivait les trois dans
 * `profiles`, où deux des colonnes n'existent pas : l'édition du profil
 * échouait intégralement.
 */
export async function updateMyProfile(updates: { display_name?: string; jersey_number?: number; position?: string }) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error("not signed in");

  if (updates.display_name !== undefined) {
    const { error } = await db().from("profiles")
      .upsert({ user_id: user.id, display_name: updates.display_name }, { onConflict: "user_id" });
    if (error) throw error;
  }

  const teamFields: Record<string, unknown> = {};
  if (updates.jersey_number !== undefined) teamFields.jersey_number = updates.jersey_number;
  if (updates.position !== undefined) teamFields.position = updates.position;

  if (Object.keys(teamFields).length) {
    const { error } = await db().from("memberships")
      .update(teamFields).eq("user_id", user.id);
    if (error) throw error;
  }
  return { ok: true };
}
