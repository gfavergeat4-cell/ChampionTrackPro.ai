// MAILLON 3 : TRADUCTION. Cron quotidien (pg_cron -> invoke) par équipe.
// Ne reçoit que des dérivés pseudonymisés. Stocke le brief + le payload
// exact envoyé au LLM (traçabilité totale) + le coût.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { narrate, BRIEF_SYSTEM, MODELS } from "../_shared/llm.ts";
import { sendPush } from "../_shared/webpush.ts";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function generateBrief(team_id: string) {
  const today = new Date().toISOString().slice(0, 10);

  // Derniers 28 j de métriques + flags du jour, pseudonymisés
  const { data: members } = await supa.from("memberships")
    .select("user_id, pseudonym, position, role").eq("team_id", team_id);
  const athletes = (members ?? []).filter((m) => m.role === "athlete");
  const ids = athletes.map((a) => a.user_id);

  const { data: metrics } = await supa.from("daily_metrics")
    .select("user_id, day, readiness, ema_28, deviation_pct, zone, acwr, data_days")
    .in("user_id", ids).eq("day", today);

  const { data: flags } = await supa.from("flags")
    .select("user_id, rule_id, value, rules(description, severity, recommendation, priority)")
    .in("user_id", ids).eq("day", today);

  const pseudo = Object.fromEntries(athletes.map((a) => [a.user_id, a.pseudonym ?? "P-??"]));
  const payload = {
    date: today,
    athletes: (metrics ?? []).map((m) => ({
      ref: pseudo[m.user_id], readiness: m.readiness, baseline: m.ema_28,
      deviation_pct: m.deviation_pct, zone: m.zone, acwr: m.acwr, data_days: m.data_days,
      flags: (flags ?? []).filter((f) => f.user_id === m.user_id)
        .map((f) => ({ rule: f.rule_id, ...f.rules })),
    })),
  };

  const { text, tokensIn, tokensOut } = await narrate(BRIEF_SYSTEM, payload, MODELS.daily);
  const cost = (tokensIn * 1e-6 + tokensOut * 5e-6); // ordre de grandeur Haiku

  await supa.from("briefs").upsert({
    team_id, brief_date: today, body: text, payload,
    model: MODELS.daily, tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: cost,
  }, { onConflict: "team_id,brief_date" });
  await supa.from("llm_logs").insert({
    team_id, purpose: "morning_brief", model: MODELS.daily,
    tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: cost,
  });
  // E2: notifier le staff quand le brief est prêt
  try {
    const { data: staff } = await supa.from("memberships")
      .select("user_id").eq("team_id", team_id)
      .in("role", ["coach", "admin"]);
    const staffIds = (staff ?? []).map((s) => s.user_id);
    if (staffIds.length) {
      const { data: subs } = await supa.from("push_subscriptions")
        .select("endpoint, p256dh, auth_key")
        .in("user_id", staffIds);
      for (const sub of subs ?? []) {
        try {
          await sendPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, authKey: sub.auth_key },
            { title: "Morning Brief ready", body: "Today's team readiness report is available.", url: "/" },
          );
        } catch (e) { console.error("[BRIEF] push staff:", String(e)); }
      }
    }
  } catch (e) { console.error("[BRIEF] staff notify:", String(e)); }
}

Deno.serve(async (req) => {
  let team_id: string | null = null;
  try { team_id = (await req.json())?.team_id ?? null; } catch (_) { /* corps vide = toutes les équipes */ }
  if (team_id) {
    await generateBrief(team_id);
    return new Response("ok");
  }
  // Multi-équipes : toutes les équipes ayant au moins un membre (doc 04 §3, event-driven)
  const { data: teams } = await supa.from("teams").select("id");
  let done = 0, failed = 0;
  for (const t of teams ?? []) {
    try { await generateBrief(t.id); done++; }
    catch (e) { console.error("[BRIEF] team", t.id, String(e)); failed++; }
  }
  return Response.json({ ok: true, briefs: done, failed });
});
