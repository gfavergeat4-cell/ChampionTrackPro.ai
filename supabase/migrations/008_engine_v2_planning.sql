-- Doc 02 §2 : z-score individuel (plus défendable que la déviation % seule)
-- Doc 04 §4 : séances enrichies (charge prévue, objectif, groupe) + cycles

alter table sessions add column if not exists planned_load numeric;
alter table sessions add column if not exists objective text;
alter table sessions add column if not exists group_label text;

create table if not exists cycles (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  season_id uuid references seasons(id),
  kind text not null check (kind in ('microcycle','mesocycle')),
  label text not null,
  starts_on date not null,
  ends_on date not null
);
alter table cycles enable row level security;
create policy cycles_member_read on cycles for select
  using (team_id in (select my_teams()));

alter table daily_metrics add column if not exists z_score numeric;
alter table daily_metrics add column if not exists mean_28 numeric;
alter table daily_metrics add column if not exists sd_28 numeric;

-- v_engine v2 : ajoute moyenne/écart-type/z-score sur fenêtre 28 j
create or replace view v_engine as
with base as (
  select z.user_id, z.team_id, z.day, z.readiness, z.ema as ema_28,
         z.deviation_pct, z.zone, z.data_days, a.acwr, z.workload_au
  from v_zones z
  left join v_acwr a on a.user_id = z.user_id and a.day = z.day
)
select b.*,
  round(avg(readiness) over w28, 1)         as mean_28,
  round(stddev_samp(readiness) over w28, 2) as sd_28,
  case when stddev_samp(readiness) over w28 > 0
       then round((readiness - avg(readiness) over w28)
                  / (stddev_samp(readiness) over w28), 2)
  end as z_score
from base b
window w28 as (partition by user_id order by day
               rows between 27 preceding and current row);

-- create or replace réinitialise les options : re-verrouiller (doc 01 §5 / Advisor)
alter view v_engine set (security_invoker = true);
revoke select on v_engine from anon, authenticated;
