-- ============================================================
-- 015 — Durcissement : rôle serveur, policies manquantes, index
-- (doc 11 P0-1/P0-2/P0-7/P1-5/P1-9/P1-13, doc 14 P0-1/P2-3)
-- ============================================================

-- ── 1. Deux codes par équipe (décision fondateur) ───────────
-- Le rôle ne doit JAMAIS venir du client. Il se déduit du code utilisé :
-- un athlète ne possède que le code athlète, il ne peut donc pas se
-- déclarer coach. Parité avec l'ancienne version, qui distinguait déjà
-- `coachCode` et `codes.athlete`.
alter table teams add column if not exists coach_code text unique;

-- Backfill : un code coach pour les équipes existantes.
update teams
set coach_code = upper(substring(replace(gen_random_uuid()::text, '-', '') for 6)) || '-C'
where coach_code is null;

comment on column teams.invite_code is 'Code ATHLETE. Diffusable au roster.';
comment on column teams.coach_code  is 'Code STAFF. Ne jamais diffuser aux athletes : il donne acces aux reponses nominatives de toute l''equipe.';

-- ── 2. Policies manquantes : écritures silencieusement perdues ──
-- `updateTeamInfo` et `removeMember` n'avaient AUCUNE policy : PostgreSQL
-- filtrait sans erreur, PostgREST renvoyait 204, l'écran affichait
-- « succès » et rien n'était écrit. Pire qu'un refus : invisible.
drop policy if exists teams_admin_update on teams;
create policy teams_admin_update on teams for update
  using (my_role_in(id) = 'admin')
  with check (my_role_in(id) = 'admin');

drop policy if exists memberships_staff_delete on memberships;
create policy memberships_staff_delete on memberships for delete
  using (my_role_in(team_id) in ('coach', 'admin'));

-- ── 3. coach_feedback : le dataset ne doit pas pouvoir être effacé ──
-- La policy `FOR ALL` autorisait un coach à modifier et supprimer ses
-- propres retours. Or c'est le futur jeu d'entraînement du système
-- (Constitution : « ne jamais le purger »). Lecture + insertion, rien de plus.
drop policy if exists feedback_staff_all on coach_feedback;

create policy feedback_staff_read on coach_feedback for select
  using (my_role_in(team_id) in ('coach', 'admin'));

create policy feedback_staff_insert on coach_feedback for insert
  with check (coach_id = auth.uid() and my_role_in(team_id) in ('coach', 'admin'));

-- ── 4. Doublons de séances ──────────────────────────────────
-- La contrainte unique (team_id, ics_uid, start_utc) ne protège rien
-- quand ics_uid est NULL : en SQL, NULL n'entre jamais en conflit.
-- Constaté en pratique : 187 séances là où on en attendait 60.
create unique index if not exists uq_sessions_manual
  on sessions (team_id, start_utc, title)
  where ics_uid is null;

-- ── 5. Index sur les chemins les plus chauds (doc 11 P1-5) ──
create index if not exists idx_memberships_user      on memberships (user_id);
create index if not exists idx_daily_metrics_team_day on daily_metrics (team_id, day desc);
create index if not exists idx_responses_session      on responses (session_id);
create index if not exists idx_briefs_team_date       on briefs (team_id, brief_date desc);
create index if not exists idx_sessions_team_start    on sessions (team_id, start_utc);
create index if not exists idx_flags_team_day         on flags (team_id, day desc);

-- ── 6. Dataset IA : retirer l'année de naissance (doc 14 P2-3) ──
-- Pseudonyme + poste + année de naissance suffisent souvent à
-- réidentifier un joueur dans un roster de quinze. La pseudonymisation
-- n'a de valeur que si elle résiste au recoupement.
-- `create or replace` ne peut pas retirer une colonne d'une vue : il faut
-- la supprimer puis la recreer.
drop view if exists v_ai_dataset;
create view v_ai_dataset as
select m.pseudonym, m.position,
       dm.day, dm.readiness, dm.ema_28, dm.deviation_pct, dm.zone,
       dm.workload_au, dm.acwr,
       f.rule_id, cf.action as coach_action
from daily_metrics dm
join memberships m on m.user_id = dm.user_id and m.team_id = dm.team_id
left join flags f on f.user_id = dm.user_id and f.day = dm.day
left join coach_feedback cf on cf.flag_id = f.id;

alter view v_ai_dataset set (security_invoker = true);
revoke select on v_ai_dataset from anon, authenticated;
