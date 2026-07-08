// E2 — Session Watcher: détecte les séances terminées, envoie les notifications
// initiales aux athlètes, gère les relances +20/40/60 min.
// Cron pg_cron toutes les minutes. SERVICE-ROLE ONLY (même guard que notify).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendPush } from "../_shared/webpush.ts";
import type { SendResult } from "../_shared/webpush.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Notification helpers ────────────────────────────────────
interface PushSub {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

async function pushToUsers(
  userIds: string[],
  payload: Record<string, unknown>,
): Promise<{ sent: number; failed: number; cleaned: number }> {
  if (!userIds.length) return { sent: 0, failed: 0, cleaned: 0 };

  const { data: subs } = await supa.from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth_key")
    .in("user_id", userIds) as { data: PushSub[] | null };

  if (!subs?.length) return { sent: 0, failed: 0, cleaned: 0 };

  let sent = 0, failed = 0, cleaned = 0;
  const toDelete: string[] = [];

  for (const sub of subs) {
    try {
      const r: SendResult = await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, authKey: sub.auth_key },
        payload,
      );
      if (r.ok) sent++;
      else if (r.gone) { toDelete.push(sub.id); cleaned++; }
      else { console.error(`[SW] push ${sub.endpoint} → ${r.status}`); failed++; }
    } catch (e) {
      console.error(`[SW] push error: ${sub.endpoint}`, String(e));
      failed++;
    }
  }

  if (toDelete.length) {
    await supa.from("push_subscriptions").delete().in("id", toDelete);
  }
  return { sent, failed, cleaned };
}

// ── Copywriting ─────────────────────────────────────────────
const COPY = [
  { title: "ChampionTrackPro", body: "Tell us — how did that session hit you?" },
  { title: "Still got 60 seconds?", body: "Your coach needs your data to make tomorrow better." },
  { title: "Don't let it go untracked", body: "Quick check-in keeps the whole team sharp." },
  { title: "Final reminder", body: "Your session data closes soon." },
];

// ── Main handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  // Auth guard: service-role only (JWT role claim)
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  let role = "";
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      const p = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      role = p.role ?? "";
    }
  } catch (_) { /* */ }
  if (role !== "service_role") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const stats = { sessions_notified: 0, reminders_sent: 0, reminders_responded: 0, reminders_expired: 0 };

  // ── Phase A: Detect ended sessions ────────────────────────
  const now = new Date();
  const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000);

  const { data: endedSessions } = await supa.from("sessions")
    .select("id, team_id, title")
    .gte("end_utc", twoMinAgo.toISOString())
    .lte("end_utc", now.toISOString())
    .is("notified_at", null)
    .eq("cancelled", false);

  for (const session of endedSessions ?? []) {
    // Get athlete members of this team
    const { data: athletes } = await supa.from("memberships")
      .select("user_id")
      .eq("team_id", session.team_id)
      .eq("role", "athlete");

    const athleteIds = (athletes ?? []).map((a) => a.user_id);
    if (!athleteIds.length) continue;

    const url = `/?screen=questionnaire&trainingId=${session.id}&teamId=${session.team_id}`;
    const result = await pushToUsers(athleteIds, {
      ...COPY[0],
      url,
      trainingId: session.id,
      teamId: session.team_id,
      tag: `questionnaire-${session.id}`,
    });

    console.log(`[SW] session ${session.id}: pushed ${result.sent}, failed ${result.failed}`);

    // Mark session as notified
    await supa.from("sessions")
      .update({ notified_at: now.toISOString() })
      .eq("id", session.id);
    stats.sessions_notified++;

    // Create pending reminders: +20min, +40min, +60min
    const reminders = athleteIds.flatMap((uid) =>
      [1, 2, 3].map((attempt) => ({
        team_id: session.team_id,
        session_id: session.id,
        user_id: uid,
        remind_at: new Date(now.getTime() + attempt * 20 * 60 * 1000).toISOString(),
        attempt,
        status: "pending",
      }))
    );

    if (reminders.length) {
      const { error } = await supa.from("pending_reminders")
        .upsert(reminders, { onConflict: "session_id,user_id,attempt" });
      if (error) console.error("[SW] reminders insert:", error.message);
    }
  }

  // ── Phase B: Process due reminders ────────────────────────
  const { data: dueReminders } = await supa.from("pending_reminders")
    .select("id, team_id, session_id, user_id, attempt")
    .eq("status", "pending")
    .lte("remind_at", now.toISOString())
    .limit(200);

  for (const rem of dueReminders ?? []) {
    // Check if athlete already responded
    const { data: resp } = await supa.from("responses")
      .select("id")
      .eq("session_id", rem.session_id)
      .eq("user_id", rem.user_id)
      .limit(1)
      .maybeSingle();

    if (resp) {
      // Already responded — mark as responded
      await supa.from("pending_reminders")
        .update({ status: "responded" })
        .eq("id", rem.id);
      stats.reminders_responded++;
      continue;
    }

    // Send reminder push (escalated copy)
    const copy = COPY[Math.min(rem.attempt, COPY.length - 1)];
    const url = `/?screen=questionnaire&trainingId=${rem.session_id}&teamId=${rem.team_id}`;
    await pushToUsers([rem.user_id], {
      ...copy,
      url,
      trainingId: rem.session_id,
      teamId: rem.team_id,
      tag: `questionnaire-${rem.session_id}`,
    });

    await supa.from("pending_reminders")
      .update({ status: "sent" })
      .eq("id", rem.id);
    stats.reminders_sent++;
  }

  // ── Phase C: Expire old reminders ─────────────────────────
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { count: expired } = await supa.from("pending_reminders")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("remind_at", oneDayAgo.toISOString());
  stats.reminders_expired = expired ?? 0;

  return Response.json({ ok: true, ...stats });
});
