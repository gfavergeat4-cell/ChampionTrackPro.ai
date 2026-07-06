// Trigger : appelée par webhook DB à chaque INSERT sur responses
// (ou en batch par cron). MAILLON 1+2 : calcul + règles. Zéro LLM ici.
import { createClient } from "jsr:@supabase/supabase-js@2";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const { record } = await req.json(); // webhook payload: la réponse insérée
  const { user_id, team_id } = record;

  // 1) CALCUL — relit la vue moteur (port SQL des calculs existants)
  const { data: engine, error } = await supa
    .from("v_engine").select("*")
    .eq("user_id", user_id)
    .order("day", { ascending: false })
    .limit(1);
  if (error) return new Response(error.message, { status: 500 });
  const m = engine?.[0];
  if (!m) return new Response("no data", { status: 200 });

  // upsert daily_metrics (source de vérité historisée)
  await supa.from("daily_metrics").upsert({
    user_id, team_id, day: m.day,
    readiness: m.readiness, ema_28: m.ema_28,
    deviation_pct: m.deviation_pct, zone: m.zone,
    workload_au: m.workload_au, acwr: m.acwr, data_days: m.data_days,
  });

  // 2) RÈGLES — n'évalue QUE les règles activées par Gabin (enabled=true).
  //    Tant que la table est vide/désactivée : aucun flag, et c'est voulu.
  const { data: rules } = await supa.from("rules").select("*").eq("enabled", true);
  for (const r of rules ?? []) {
    if ((m.data_days ?? 0) < r.min_data_days) continue;
    // Évaluation déterministe côté SQL pour rester traçable
    const { data: hit } = await supa.rpc("eval_rule", {
      p_rule: r.id, p_user: user_id, p_day: m.day,
    }).maybeSingle?.() ?? { data: null };
    if (hit) {
      await supa.from("flags").upsert({
        team_id, user_id, rule_id: r.id, rule_version: r.version,
        day: m.day, value: m.readiness,
      }, { onConflict: "user_id,rule_id,day" });
    }
  }
  return new Response("ok");
});
