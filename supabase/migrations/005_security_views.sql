-- Fix Advisor : les vues du moteur ne doivent être lisibles que par le
-- service_role (edge functions). security_invoker + revoke = double verrou.
alter view v_daily_scores set (security_invoker = true);
alter view v_ema_baseline set (security_invoker = true);
alter view v_zones        set (security_invoker = true);
alter view v_acwr         set (security_invoker = true);
alter view v_engine       set (security_invoker = true);
alter view v_ai_dataset   set (security_invoker = true);
revoke select on v_daily_scores, v_ema_baseline, v_zones, v_acwr, v_engine, v_ai_dataset from anon, authenticated;
