-- ============================================================
-- Row Level Security — isolation multi-tenant NON NÉGOCIABLE
-- Une équipe ne voit JAMAIS les données d'une autre.
-- L'athlète ne voit QUE ses propres réponses/métriques.
-- ============================================================

alter table organizations  enable row level security;
alter table teams          enable row level security;
alter table seasons        enable row level security;
alter table profiles       enable row level security;
alter table memberships    enable row level security;
alter table sessions       enable row level security;
alter table questionnaires enable row level security;
alter table team_questionnaires enable row level security;
alter table responses      enable row level security;
alter table daily_metrics  enable row level security;
alter table rules          enable row level security;
alter table flags          enable row level security;
alter table briefs         enable row level security;
alter table coach_feedback enable row level security;
alter table llm_logs       enable row level security;

-- Helpers
create or replace function my_teams() returns setof uuid
language sql stable security definer set search_path = public as $$
  select team_id from memberships where user_id = auth.uid()
$$;

create or replace function my_role_in(t uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from memberships where user_id = auth.uid() and team_id = t
$$;

-- profiles : soi-même + staff de ses équipes
create policy profiles_self on profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profiles_staff_read on profiles for select
  using (exists (select 1 from memberships m1
                 join memberships m2 on m1.team_id = m2.team_id
                 where m1.user_id = auth.uid() and m1.role in ('coach','admin')
                   and m2.user_id = profiles.user_id));

-- teams / seasons / sessions : membres de l'équipe
create policy teams_member_read on teams for select
  using (id in (select my_teams()));
create policy seasons_member_read on seasons for select
  using (team_id in (select my_teams()));
create policy sessions_member_read on sessions for select
  using (team_id in (select my_teams()));

-- memberships : lisible par les membres de la même équipe
create policy memberships_team_read on memberships for select
  using (team_id in (select my_teams()));

-- questionnaires : lecture pour tout utilisateur authentifié
create policy questionnaires_read on questionnaires for select
  using (auth.uid() is not null);
create policy team_q_read on team_questionnaires for select
  using (team_id in (select my_teams()));

-- responses : l'athlète écrit/lit LA SIENNE ; coach/admin lisent l'équipe.
-- Fenêtre temporelle (fin de séance -> +5h) recréée depuis les rules Firestore.
create policy responses_self_insert on responses for insert
  with check (
    user_id = auth.uid()
    and team_id in (select my_teams())
    and exists (select 1 from sessions s
                where s.id = session_id
                  and now() >= s.end_utc
                  and now() <= s.end_utc + interval '5 hours')
  );
create policy responses_self_read on responses for select
  using (user_id = auth.uid());
create policy responses_staff_read on responses for select
  using (my_role_in(team_id) in ('coach','admin'));

-- daily_metrics / flags / briefs : athlète voit les siens, staff voit l'équipe
create policy metrics_self_read on daily_metrics for select
  using (user_id = auth.uid());
create policy metrics_staff_read on daily_metrics for select
  using (my_role_in(team_id) in ('coach','admin'));
create policy flags_staff_read on flags for select
  using (my_role_in(team_id) in ('coach','admin'));
create policy briefs_staff_read on briefs for select
  using (my_role_in(team_id) in ('coach','admin'));

-- coach_feedback : le staff écrit, le staff lit
create policy feedback_staff_all on coach_feedback for all
  using (my_role_in(team_id) in ('coach','admin'))
  with check (coach_id = auth.uid() and my_role_in(team_id) in ('coach','admin'));

-- rules / llm_logs : AUCUN accès client. Service role uniquement.
-- (pas de policy = deny all pour anon/authenticated)

-- Écritures moteur (daily_metrics, flags, briefs, sessions ICS) :
-- exclusivement via service_role dans les edge functions.
