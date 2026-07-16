/**
 * scheduleQueriesSupabase.ts — drop-in Supabase replacement for scheduleQueries.ts
 * Same exports, same return types (EventWithResponse), reads from Supabase sessions + responses.
 * Used by AthleteHomeNew/ScheduleScreenNew when USE_SUPABASE is active.
 */
import { supabase } from './supabase';
import { DateTime } from 'luxon';
import {
  getQuestionnaireState,
  computeQuestionnaireStatus,
  getQuestionnaireWindowFromEnd,
  QuestionnaireState,
} from '../utils/questionnaire';
import type { EventWithResponse, ScheduleQueryOptions } from './scheduleQueries';

function db() {
  if (!supabase) throw new Error('Supabase disabled');
  return supabase;
}

// ── helpers ────────────────────────────────────────────────────

interface SupaSession {
  id: string;
  team_id: string;
  title: string;
  start_utc: string;
  end_utc: string;
  cancelled: boolean;
  source?: string;
}

function sessionToEvent(s: SupaSession, hasResponse: boolean, submittedAt?: string | null): EventWithResponse {
  const startMs = new Date(s.start_utc).getTime();
  const endMs = new Date(s.end_utc).getTime();
  const now = DateTime.utc();
  const qState = getQuestionnaireState(endMs, hasResponse, now);
  const qStatus = computeQuestionnaireStatus(endMs, hasResponse, now);

  let questionnaireOpenAt: number | undefined;
  let questionnaireCloseAt: number | undefined;
  if (endMs) {
    const w = getQuestionnaireWindowFromEnd(endMs);
    questionnaireOpenAt = w.openAt.toMillis();
    questionnaireCloseAt = w.closeAt.toMillis();
  }

  return {
    id: s.id,
    teamId: s.team_id,
    title: s.title || 'Training',
    summary: s.title || 'Training',
    description: '',
    location: '',
    startUtc: { toMillis: () => startMs, seconds: startMs / 1000 } as any,
    endUtc: { toMillis: () => endMs, seconds: endMs / 1000 } as any,
    startUTC: startMs,
    endUTC: endMs,
    startMillis: startMs,
    endMillis: endMs,
    timeZone: 'UTC',
    displayTz: 'UTC',
    originalTzid: null,
    calendarTz: null,
    hasUtcSuffix: true,
    startLocalISO: s.start_utc,
    endLocalISO: s.end_utc,
    uid: '',
    status: 'CONFIRMED',
    hasResponse,
    responseStatus: hasResponse ? 'completed' : 'not_responded',
    response: hasResponse && submittedAt
      ? { status: 'completed' as const, submittedAt: { toMillis: () => new Date(submittedAt).getTime(), seconds: Math.floor(new Date(submittedAt).getTime() / 1000) } as any, completedAt: { toMillis: () => new Date(submittedAt).getTime(), seconds: Math.floor(new Date(submittedAt).getTime() / 1000) } as any }
      : null,
    questionnaireStatus: qStatus,
    questionnaireState: qState,
    questionnaireOpenAt,
    questionnaireCloseAt,
    tzid: 'UTC',
    source: s.source,
    players: [],
    startDate: new Date(startMs),
    endDate: new Date(endMs),
  } as any;
}

async function enrichWithResponses(
  sessions: SupaSession[],
  userId: string,
): Promise<EventWithResponse[]> {
  if (!sessions.length) return [];

  const ids = sessions.map((s) => s.id);
  const { data: responses } = await db()
    .from('responses')
    .select('session_id, submitted_at')
    .eq('user_id', userId)
    .in('session_id', ids);

  const respMap = new Map<string, string>();
  for (const r of responses ?? []) {
    respMap.set(r.session_id, r.submitted_at);
  }

  return sessions
    .filter((s) => !s.cancelled)
    .map((s) => sessionToEvent(s, respMap.has(s.id), respMap.get(s.id) ?? null));
}

// ── public API (mirrors scheduleQueries.ts exports) ─────────

export async function getUpcomingTrainingsSupabase(
  teamId: string,
  userId: string,
  limitCount = 50,
  rangeDays = 30,
): Promise<EventWithResponse[]> {
  const nowMs = Date.now();
  const from = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(nowMs + rangeDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions, error } = await db()
    .from('sessions')
    .select('*')
    .eq('team_id', teamId)
    .eq('cancelled', false)
    .gte('start_utc', from)
    .lte('start_utc', to)
    .order('start_utc');

  if (error) { console.error('[SUPA][SCHEDULE]', error.message); return []; }
  const events = await enrichWithResponses(sessions ?? [], userId);

  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const allRespond = events.filter((e) => e.questionnaireState === 'respond')
    .sort((a, b) => (a.endMillis ?? 0) - (b.endMillis ?? 0));

  const recentlyCompleted = events.filter((e) => {
    if (e.questionnaireState !== 'completed') return false;
    const ca = e.response?.completedAt;
    if (!ca) return false;
    const caMs = typeof ca === 'number' ? ca : (typeof ca?.toMillis === 'function' ? ca.toMillis() : 0);
    return (nowMs - caMs) <= FIVE_MINUTES_MS && (nowMs - caMs) >= 0;
  });

  const comingSoon = events.filter((e) => e.questionnaireState === 'comingSoon')
    .sort((a, b) => (a.endMillis ?? 0) - (b.endMillis ?? 0));

  const combined = [
    ...allRespond,
    ...recentlyCompleted,
    ...comingSoon.slice(0, Math.max(0, limitCount - allRespond.length - recentlyCompleted.length)),
  ];

  if (combined.length > 0) return combined;

  // Fallback: next upcoming sessions
  return events
    .filter((e) => (e.startMillis ?? 0) > nowMs)
    .sort((a, b) => (a.startMillis ?? 0) - (b.startMillis ?? 0))
    .slice(0, limitCount);
}

export async function getEventsForDateRangeSupabase(
  teamId: string,
  startDate: Date,
  endDate: Date,
  userId: string,
): Promise<EventWithResponse[]> {
  const { data: sessions, error } = await db()
    .from('sessions')
    .select('*')
    .eq('team_id', teamId)
    .eq('cancelled', false)
    .gte('start_utc', startDate.toISOString())
    .lte('start_utc', endDate.toISOString())
    .order('start_utc');

  if (error) { console.error('[SUPA][SCHEDULE]', error.message); return []; }
  return enrichWithResponses(sessions ?? [], userId);
}

export async function fetchTrainingsRangeSupabase(
  teamId: string,
  from: DateTime,
  to: DateTime,
): Promise<any[]> {
  const { data, error } = await db()
    .from('sessions')
    .select('id, team_id, title, start_utc, end_utc, source')
    .eq('team_id', teamId)
    .eq('cancelled', false)
    .gte('start_utc', from.toISO())
    .lte('start_utc', to.toISO())
    .order('start_utc');

  if (error) { console.error('[SUPA][SCHEDULE]', error.message); return []; }

  return (data ?? []).map((s: any) => ({
    id: s.id,
    teamId: s.team_id,
    title: s.title || 'Training',
    startDate: new Date(s.start_utc),
    endDate: new Date(s.end_utc),
    startMillis: new Date(s.start_utc).getTime(),
    endMillis: new Date(s.end_utc).getTime(),
    displayTz: 'UTC',
  }));
}

// Day/Week/Month convenience wrappers matching scheduleQueries exports
export async function getEventsForWeekSupabase(
  teamId: string,
  weekStart: Date,
  userId: string,
): Promise<EventWithResponse[]> {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return getEventsForDateRangeSupabase(teamId, weekStart, end, userId);
}

export async function getEventsForMonthSupabase(
  teamId: string,
  monthStart: Date,
  userId: string,
): Promise<EventWithResponse[]> {
  const end = new Date(monthStart);
  end.setMonth(end.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return getEventsForDateRangeSupabase(teamId, monthStart, end, userId);
}

export async function getEventsForDaySupabase(
  teamId: string,
  day: Date,
  userId: string,
): Promise<EventWithResponse[]> {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  // Expand query 24h before to catch spanning events
  const queryStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  const events = await getEventsForDateRangeSupabase(teamId, queryStart, end, userId);
  // Filter to only events that overlap with this day
  const dayStartMs = start.getTime();
  const dayEndMs = end.getTime();
  return events.filter((e) => {
    const s = e.startMillis ?? 0;
    const en = e.endMillis ?? s;
    return (s >= dayStartMs && s <= dayEndMs) || (en >= dayStartMs && en <= dayEndMs) || (s < dayStartMs && en > dayEndMs);
  });
}

export async function getNextSessionSupabase(
  teamId: string,
  userId: string,
): Promise<EventWithResponse | null> {
  const { data, error } = await db()
    .from('sessions')
    .select('*')
    .eq('team_id', teamId)
    .eq('cancelled', false)
    .gte('start_utc', new Date().toISOString())
    .order('start_utc')
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const events = await enrichWithResponses([data], userId);
  return events[0] ?? null;
}
