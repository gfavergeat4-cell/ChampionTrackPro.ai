-- ============================================================
-- 013 — Moteur : charge de l'effort et sous-scores par axe
-- (doc 15 v3 §6). CALCUL uniquement — aucune interprétation.
-- ============================================================
-- Ce que ça débloque : session_load et workload_au n'ont JAMAIS été
-- alimentés, ce qui rend acwr systématiquement nul depuis l'origine.

-- ── 1. session_load et workload_au ──────────────────────────
-- readiness_score est déjà la somme pondérée des items (trigger 003).
-- Avec un questionnaire d'effort, cette somme EST le coût ressenti :
-- ramené sur 0-10 (échelle type CR-10), multiplié par la durée réelle.
--
-- Garde-fou : on ne calcule que si le questionnaire porte des items
-- `role = "cost"`. Un questionnaire hérité (sans rôle) mesure un état,
-- pas un coût — le convertir en charge serait un contresens.
create or replace function trg_responses_load() returns trigger
language plpgsql as $$
declare
  dur_min numeric;
  has_cost boolean;
begin
  select exists (
    select 1 from questionnaires qq
    cross join lateral jsonb_array_elements(qq.questions) q
    where qq.id = new.questionnaire_id and q->>'role' = 'cost'
  ) into has_cost;

  if coalesce(has_cost, false) and new.readiness_score is not null then
    new.session_load := round(new.readiness_score / 10.0, 2);

    select greatest(extract(epoch from (s.end_utc - s.start_utc)) / 60.0, 0)
      into dur_min
    from sessions s where s.id = new.session_id;

    if dur_min is not null and dur_min > 0 then
      new.workload_au := round(new.session_load * dur_min, 1);
    end if;
  end if;

  return new;
end $$;

-- ⚠ Nom choisi pour l'ordre d'exécution : PostgreSQL déclenche les triggers
--   BEFORE par ordre alphabétique. « responses_readiness » doit passer avant
--   « responses_readiness_load », sinon readiness_score serait encore NULL.
drop trigger if exists responses_readiness_load on responses;
create trigger responses_readiness_load
  before insert or update of metrics on responses
  for each row execute function trg_responses_load();

-- ── 2. Sous-scores par axe (PHY / TEC / MEN / ACA) ──────────
-- Chaque item porte son axe dans le questionnaire. On ne devine rien.
-- L'inversion de valence est appliquée ici, invisible pour l'athlète
-- (méthode DAR, partie 2 §E.2).
create or replace view v_response_axes as
select
  r.id                                        as response_id,
  r.user_id,
  r.team_id,
  (r.submitted_at at time zone 'UTC')::date    as day,
  q->>'axis'                                   as axis,
  avg(
    case when coalesce((q->>'inverted')::boolean, false)
         then 101 - coalesce((r.metrics ->> (q->>'metricKey'))::numeric, 50)
         else       coalesce((r.metrics ->> (q->>'metricKey'))::numeric, 50)
    end
  )                                            as axis_value
from responses r
join questionnaires qq on qq.id = r.questionnaire_id
cross join lateral jsonb_array_elements(qq.questions) q
where r.is_test = false
  and q->>'role' = 'cost'
  and q->>'axis' is not null
group by r.id, r.user_id, r.team_id, (r.submitted_at at time zone 'UTC')::date, q->>'axis';

alter view v_response_axes set (security_invoker = true);
revoke select on v_response_axes from anon, authenticated;

-- Agrégat quotidien : si plusieurs séances dans la journée, moyenne des axes.
create or replace view v_daily_axes as
select
  user_id, team_id, day,
  round(avg(axis_value) filter (where axis = 'PHY'), 1) as sub_phy,
  round(avg(axis_value) filter (where axis = 'TEC'), 1) as sub_tec,
  round(avg(axis_value) filter (where axis = 'MEN'), 1) as sub_men,
  round(avg(axis_value) filter (where axis = 'ACA'), 1) as sub_aca
from v_response_axes
group by user_id, team_id, day;

alter view v_daily_axes set (security_invoker = true);
revoke select on v_daily_axes from anon, authenticated;

-- ── 3. Charge académique ────────────────────────────────────
-- Colonne dédiée : c'est un coût hors-sport, il ne doit jamais être
-- confondu avec la charge d'entraînement (doc 15 §4).
alter table daily_metrics add column if not exists sub_aca numeric;

comment on column daily_metrics.sub_aca is
  'Coût académique ressenti (0-100), passation journaliere. Hors charge sportive.';

-- ── 4. Écart entraînement / compétition ─────────────────────
-- Le calcul qui justifie d''utiliser les mêmes items en practice et en match.
-- Calculé PAR ATHLÈTE : la méthode DAR proscrit la normalisation
-- interindividuelle (partie 2 §E.4).
create or replace view v_specificity as
with per_session as (
  select ra.user_id, ra.team_id, ra.axis, s.session_type,
         ra.axis_value, s.start_utc
  from v_response_axes ra
  join responses r on r.id = ra.response_id
  join sessions  s on s.id = r.session_id
  where s.session_type in ('practice', 'scrimmage', 'game')
)
select
  user_id, team_id, axis,
  avg(axis_value) filter (where session_type = 'game')                        as game_demand,
  avg(axis_value) filter (where session_type in ('practice','scrimmage'))     as practice_demand,
  count(*)        filter (where session_type = 'game')                        as games_counted,
  case when avg(axis_value) filter (where session_type = 'game') > 0
       then round(
         avg(axis_value) filter (where session_type in ('practice','scrimmage'))
         / avg(axis_value) filter (where session_type = 'game') * 100, 0)
  end                                                                          as specificity_pct
from per_session
where start_utc >= now() - interval '56 days'
group by user_id, team_id, axis;

alter view v_specificity set (security_invoker = true);
revoke select on v_specificity from anon, authenticated;

comment on view v_specificity is
  'Rapport exigence entrainement / exigence match, par athlete et par axe, sur 56 jours. '
  'Le nombre minimum de matchs avant affichage et les seuils d''alerte sont des '
  'decisions du fondateur (doc 15 SS3) : cette vue ne fait que calculer.';
