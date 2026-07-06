// MAILLON 3 : TRADUCTION. Cron quotidien (pg_cron -> invoke) par équipe.
// Ne reçoit que des dérivés pseudonymisés. Stocke le brief + le payload
// exact envoyé au LLM (traçabilité totale) + le coût.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { narrate, BRIEF_SYSTEM, MODELS } from "../_shared/llm.ts";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const { team_id } = await req.json();
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
  // TODO: push FCM au staff (réutiliser la logique notifications existante)
  return new Response("ok");
});
