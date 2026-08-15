-- ============================================================
-- 014 — Baseline et zones PAR AXE (méthode DAR, partie 3)
-- ============================================================
-- Morin, §8 « De l'indicateur singulier au profil multi-marqueurs » :
--   « Chaque série possède sa propre tendance, sa zone de variations
--     habituelles (±10) et ses zones d'écart (bleu/vert/jaune). »
--   « C'est cette articulation, et NON une moyenne arithmétique, qui fonde
--     une régulation fine. »
--
-- Le moteur ne calculait qu'une seule baseline, sur le score global.
-- Cette migration en produit une par axe (PHY / TEC / MEN / ACA), avec
-- sa tendance et sa zone. CALCUL uniquement — aucune interprétation.

-- ── Série quotidienne par axe ───────────────────────────────
create or replace view v_axis_daily as
select user_id, team_id, day, axis, round(avg(axis_value), 1) as value
from v_response_axes
group by user_id, team_id, day, axis;

alter view v_axis_daily set (security_invoker = true);
revoke select on v_axis_daily from anon, authenticated;

-- ── MME par axe ─────────────────────────────────────────────
-- Même constante que le moteur global : alpha = 2/29 (fenêtre 28 j),
-- avec carry-forward des jours sans réponse. Morin consacre une section
-- au choix de la constante et met en garde contre une constante
-- « arbitraire, déconnectée du rythme réel » : ce choix appartient au
-- fondateur, il est ici centralisé dans la constante 0.0690.
create or replace view v_axis_baseline as
with recursive bounds as (
  select user_id, team_id, axis, min(day) as d0, max(day) as d1
  from v_axis_daily group by user_id, team_id, axis
),
cal as (
  select b.user_id, b.team_id, b.axis, g.day::date as day
  from bounds b
  cross join lateral generate_series(b.d0, b.d1, interval '1 day') as g(day)
),
serie as (
  select c.user_id, c.team_id, c.axis, c.day, d.value,
         row_number() over (partition by c.user_id, c.axis order by c.day) as rn
  from cal c
  left join v_axis_daily d
    on d.user_id = c.user_id and d.axis = c.axis and d.day = c.day
),
rec as (
  select user_id, team_id, axis, day, value, rn,
         coalesce(value, 50)::numeric as ema
  from serie where rn = 1
  union all
  select s.user_id, s.team_id, s.axis, s.day, s.value, s.rn,
         case when s.value is null then r.ema
              else round(s.value * 0.0690 + r.ema * 0.9310, 2) end
  from serie s
  join rec r on r.user_id = s.user_id and r.axis = s.axis and s.rn = r.rn + 1
)
select user_id, team_id, axis, day, value, ema,
       case when value is null then null else round(value - ema, 1) end as delta_points,
       count(value) over (partition by user_id, axis order by day) as data_days
from rec;

alter view v_axis_baseline set (security_invoker = true);
revoke select on v_axis_baseline from anon, authenticated;

-- ── Zones par axe ───────────────────────────────────────────
-- ⚠ SEUIL : ±10 POINTS autour de la MME, conformément à la méthode DAR
--   (partie 3, §C). Le moteur global utilise, lui, ±15 % (migration 003).
--   Les deux coexistent volontairement tant que le fondateur n'a pas
--   tranché — voir doc 15 §7.1. C'est un paramètre d'interprétation :
--   il lui appartient, et il se change ICI, en un seul endroit.
--
-- Morin exige un minimum de données avant de qualifier une zone : sans
-- historique, l'écart à la tendance ne veut rien dire. Seuil repris du
-- moteur global : 3 jours.
create or replace view v_axis_zones as
select *,
  case
    when value is null or data_days < 3 then 'INSUFFICIENT_DATA'
    when delta_points >  10 then 'YELLOW'   -- sursollicitation
    when delta_points < -10 then 'BLUE'     -- moindre sollicitation
    else 'GREEN'                            -- sollicitation habituelle
  end as zone,
  -- Tendance de la MME sur 7 jours : « on lit la couleur ET la courbe »
  round(ema - lag(ema, 7) over (partition by user_id, axis order by day), 1) as ema_trend_7d
from v_axis_baseline;

alter view v_axis_zones set (security_invoker = true);
revoke select on v_axis_zones from anon, authenticated;

-- ── Vue de lecture coach ────────────────────────────────────
-- Une ligne par athlète et par axe, pour le jour demandé.
-- AUCUNE moyenne d'équipe : Morin (partie 2 §E.4) proscrit la
-- normalisation interindividuelle. L'agrégation d'équipe se fait par
-- DISTRIBUTION (comptage par zone), côté application.
create or replace view v_coach_board as
select
  z.user_id, z.team_id, z.day, z.axis,
  z.value, z.ema, z.delta_points, z.zone, z.data_days, z.ema_trend_7d,
  m.pseudonym, m.position, m.jersey_number
from v_axis_zones z
join memberships m on m.user_id = z.user_id and m.team_id = z.team_id
where m.role = 'athlete';

alter view v_coach_board set (security_invoker = true);

comment on view v_coach_board is
  'Lecture multi-marqueurs par athlete et par axe (methode DAR partie 3 SS8). '
  'Contient valeur brute, tendance MME, ecart en points et zone. '
  'Ne JAMAIS en tirer une moyenne d''equipe : agreger par distribution.';
