-- ============================================================
-- 018 — Moteur scopé à un athlète (doc 11 P1-1)
-- ============================================================
-- PostgreSQL ne pousse jamais un prédicat dans une `WITH RECURSIVE`.
-- Conséquence : interroger `v_engine` pour UN athlète recalcule d'abord
-- la série complète de TOUS les athlètes de TOUS les clients, puis filtre.
--
-- Observé en conditions réelles le 15 août : 1 206 réponses insérées ->
-- autant d'appels webhook -> `daily_metrics` remplie sur 18 lignes au lieu
-- de 780. Le reste a dû être reconstruit à la main.
--
-- Cette fonction fait le MÊME calcul, borné à un athlète. Formules et
-- constantes recopiées à l'identique depuis les migrations 003 et 008 :
-- alpha = 0.0690, carry-forward, zones ±15 %, fenêtres 7 j / 28 j.
-- AUCUN seuil n'est modifié — la vérification de non-régression est
-- fournie en fin de fichier.

create or replace function f_engine_user(p_user uuid)
returns table (
  user_id       uuid,
  team_id       uuid,
  day           date,
  readiness     numeric,
  ema_28        numeric,
  deviation_pct numeric,
  zone          text,
  data_days     bigint,
  acwr          numeric,
  workload_au   numeric,
  mean_28       numeric,
  sd_28         numeric,
  z_score       numeric
)
language sql stable
set search_path = public
as $$
with recursive daily as (
  select r.team_id,
         (r.submitted_at at time zone 'UTC')::date as day,
         avg(r.readiness_score) as readiness,
         sum(r.workload_au)     as workload_au
  from responses r
  where r.user_id = p_user
    and r.is_test = false
    and r.readiness_score is not null
  group by r.team_id, (r.submitted_at at time zone 'UTC')::date
),
bounds as (
  select min(day) as d0, max(day) as d1 from daily
),
cal as (
  select g.day::date as day
  from bounds b
  cross join lateral generate_series(b.d0, b.d1, interval '1 day') as g(day)
),
serie as (
  select c.day, d.readiness, d.workload_au, d.team_id,
         row_number() over (order by c.day) as rn
  from cal c
  left join daily d on d.day = c.day
),
rec as (
  select s.day, s.readiness, s.workload_au, s.team_id, s.rn,
         coalesce(s.readiness, 50)::numeric as ema
  from serie s where s.rn = 1
  union all
  select s.day, s.readiness, s.workload_au, s.team_id, s.rn,
         case when s.readiness is null then r.ema
              else round(s.readiness * 0.0690 + r.ema * 0.9310, 2) end
  from serie s
  join rec r on s.rn = r.rn + 1
),
base as (
  select
    p_user as user_id,
    -- Sur un jour sans réponse, team_id est NULL : on retient la dernière
    -- équipe connue, comme le fait la vue globale par jointure.
    coalesce(rec.team_id, (select d2.team_id from daily d2 order by d2.day desc limit 1)) as team_id,
    rec.day,
    rec.readiness,
    rec.ema as ema_28,
    case when rec.readiness is null or rec.ema = 0 then null
         else round((rec.readiness - rec.ema) / rec.ema * 100, 1) end as deviation_pct,
    count(rec.readiness) over (order by rec.day) as data_days,
    rec.workload_au
  from rec
),
zoned as (
  select b.*,
    case
      when b.readiness is null or b.data_days < 3 then 'INSUFFICIENT_DATA'
      when b.deviation_pct >  15 then 'YELLOW'
      when b.deviation_pct < -15 then 'BLUE'
      else 'GREEN'
    end as zone,
    case when avg(b.workload_au) over w28 > 0
         then round(avg(b.workload_au) over w7 / avg(b.workload_au) over w28, 2)
    end as acwr,
    round(avg(b.readiness)         over w28, 1) as mean_28,
    round(stddev_samp(b.readiness) over w28, 2) as sd_28,
    case when stddev_samp(b.readiness) over w28 > 0
         then round((b.readiness - avg(b.readiness) over w28)
                    / stddev_samp(b.readiness) over w28, 2)
    end as z_score
  from base b
  window w7  as (order by b.day rows between 6  preceding and current row),
         w28 as (order by b.day rows between 27 preceding and current row)
)
select user_id, team_id, day, readiness, ema_28, deviation_pct, zone,
       data_days, acwr, workload_au, mean_28, sd_28, z_score
from zoned
order by day;
$$;

revoke execute on function f_engine_user(uuid) from anon, authenticated;

comment on function f_engine_user(uuid) is
  'Meme calcul que v_engine, borne a un athlete. A utiliser partout ou l''on '
  'traite un seul athlete : v_engine recalcule toute la base a chaque appel.';

-- ============================================================
-- NON-RÉGRESSION — à exécuter avant de considérer la bascule faite
-- ============================================================
-- Doit renvoyer ZÉRO ligne. Toute ligne retournée est un écart entre
-- l'ancien calcul et le nouveau, donc un bug à corriger avant d'aller
-- plus loin. Remplacer l'identifiant par un athlète ayant de l'historique.
--
-- select v.day, v.readiness, f.readiness, v.ema_28, f.ema_28,
--        v.zone, f.zone, v.acwr, f.acwr, v.z_score, f.z_score
-- from v_engine v
-- full outer join f_engine_user('d0000000-0000-4000-8000-000000000007') f
--   on f.day = v.day
-- where v.user_id = 'd0000000-0000-4000-8000-000000000007'
--   and (v.readiness     is distinct from f.readiness
--     or v.ema_28        is distinct from f.ema_28
--     or v.deviation_pct is distinct from f.deviation_pct
--     or v.zone          is distinct from f.zone
--     or v.data_days     is distinct from f.data_days
--     or v.acwr          is distinct from f.acwr
--     or v.mean_28       is distinct from f.mean_28
--     or v.sd_28         is distinct from f.sd_28
--     or v.z_score       is distinct from f.z_score);
