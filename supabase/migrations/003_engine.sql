-- ============================================================
-- MOTEUR DE CALCUL — port SQL fidèle des calculs EXISTANTS
-- (useDARAlgorithm.ts / analytics.ts). AUCUNE nouvelle règle.
-- L'interprétation reste la propriété de Gabin (table rules).
-- ============================================================

-- Readiness par réponse : poids/inversions lus depuis questionnaires.questions
-- (même formule que calcReadinessFromQuestionnaire : val inversée = 101 - val,
--  somme pondérée, clamp 1-100). Calculé par trigger à l'INSERT — plus jamais client.
create or replace function compute_readiness(p_metrics jsonb, p_questionnaire text)
returns numeric language plpgsql stable as $$
declare q jsonb; total numeric := 0; val numeric; w numeric;
begin
  for q in select jsonb_array_elements(questions) from questionnaires where id = p_questionnaire
  loop
    val := coalesce((p_metrics ->> (q->>'metricKey'))::numeric, 50);
    if coalesce((q->>'inverted')::boolean, false) then val := 101 - val; end if;
    w := coalesce((q->>'weight')::numeric, 0);
    total := total + val * w;
  end loop;
  if total = 0 then return null; end if;
  return greatest(1, least(100, round(total)));
end $$;

create or replace function trg_responses_readiness() returns trigger
language plpgsql as $$
begin
  if new.questionnaire_id is not null then
    new.readiness_score := compute_readiness(new.metrics, new.questionnaire_id);
  end if;
  return new;
end $$;
create trigger responses_readiness before insert or update of metrics
  on responses for each row execute function trg_responses_readiness();

-- Série quotidienne par athlète (moyenne si plusieurs réponses/jour) — hors tests
create or replace view v_daily_scores as
select user_id, team_id, (submitted_at at time zone 'UTC')::date as day,
       avg(readiness_score) as readiness,
       sum(workload_au) as workload_au
from responses
where is_test = false and readiness_score is not null
group by user_id, team_id, (submitted_at at time zone 'UTC')::date;

-- EMA 28 j (alpha = 2/29 ≈ 0.0690) avec carry-forward des jours manquants —
-- port exact de processDARData(). Recursive CTE sur calendrier continu.
create or replace view v_ema_baseline as
with recursive bounds as (
  select user_id, team_id, min(day) as d0, max(day) as d1
  from v_daily_scores group by user_id, team_id
),
cal as (
  select b.user_id, b.team_id, g.day::date as day
  from bounds b cross join lateral generate_series(b.d0, b.d1, interval '1 day') as g(day)
),
serie as (
  select c.user_id, c.team_id, c.day, s.readiness, s.workload_au,
         row_number() over (partition by c.user_id order by c.day) as rn
  from cal c left join v_daily_scores s
    on s.user_id = c.user_id and s.day = c.day
),
rec as (
  select user_id, team_id, day, readiness, workload_au, rn,
         coalesce(readiness, 50)::numeric as ema
  from serie where rn = 1
  union all
  select s.user_id, s.team_id, s.day, s.readiness, s.workload_au, s.rn,
         case when s.readiness is null then r.ema
              else round(s.readiness * 0.0690 + r.ema * 0.9310, 2) end
  from serie s join rec r on r.user_id = s.user_id and s.rn = r.rn + 1
)
select user_id, team_id, day, readiness, workload_au, ema,
       case when readiness is null or ema = 0 then null
            else round((readiness - ema) / ema * 100, 1) end as deviation_pct,
       count(readiness) over (partition by user_id order by day) as data_days
from rec;

-- Zones — seuils EXISTANTS (±15 %, MIN 3 points). Les seuils définitifs
-- appartiennent à Gabin ; modifiables ici sans toucher au code applicatif.
create or replace view v_zones as
select *,
  case
    when readiness is null or data_days < 3 then 'INSUFFICIENT_DATA'
    when deviation_pct >  15 then 'YELLOW'
    when deviation_pct < -15 then 'BLUE'
    else 'GREEN'
  end as zone
from v_ema_baseline;

-- ACWR (aiguë 7 j / chronique 28 j) — prêt, mais NULL tant que workload_au
-- n'est pas alimenté (la mesure de charge n'existe pas encore en V3).
create or replace view v_acwr as
select user_id, team_id, day,
  avg(workload_au) over w7  as acute_7d,
  avg(workload_au) over w28 as chronic_28d,
  case when avg(workload_au) over w28 > 0
       then round(avg(workload_au) over w7 / avg(workload_au) over w28, 2)
  end as acwr
from v_ema_baseline
window w7  as (partition by user_id order by day rows between 6 preceding and current row),
       w28 as (partition by user_id order by day rows between 27 preceding and current row);

-- Vue d'assemblage consommée par l'edge function compute-metrics
create or replace view v_engine as
select z.user_id, z.team_id, z.day, z.readiness, z.ema as ema_28,
       z.deviation_pct, z.zone, z.data_days, a.acwr, z.workload_au
from v_zones z
left join v_acwr a on a.user_id = z.user_id and a.day = z.day;

-- Dataset d'entraînement anonymisé (équivalent ai_training_dataset) :
-- pseudonyme + dérivés uniquement, jamais l'identité.
create or replace view v_ai_dataset as
select m.pseudonym, m.position, m.birth_year,
       dm.day, dm.readiness, dm.ema_28, dm.deviation_pct, dm.zone,
       dm.workload_au, dm.acwr,
       f.rule_id, cf.action as coach_action
from daily_metrics dm
join memberships m on m.user_id = dm.user_id and m.team_id = dm.team_id
left join flags f on f.user_id = dm.user_id and f.day = dm.day
left join coach_feedback cf on cf.flag_id = f.id;

-- Évaluateur de règle : exécute condition_sql (écrite par Gabin, table rules,
-- accessible en écriture uniquement via service_role) contre v_engine.
create or replace function eval_rule(p_rule text, p_user uuid, p_day date)
returns boolean language plpgsql security definer set search_path = public as $$
declare cond text; hit boolean;
begin
  select condition_sql into cond from rules where id = p_rule and enabled = true;
  if cond is null then return false; end if;
  execute format(
    'select exists(select 1 from v_engine where user_id = $1 and day = $2 and (%s))', cond
  ) into hit using p_user, p_day;
  return coalesce(hit, false);
end $$;
revoke execute on function eval_rule(text, uuid, date) from anon, authenticated;
