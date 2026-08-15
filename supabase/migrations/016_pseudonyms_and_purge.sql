-- ============================================================
-- 016 — Pseudonymes stables + suppression réelle
-- (doc 11 P1-10, doc 14 P0-2 / P1-9)
-- ============================================================

-- ── 1. Pseudonymes non réutilisables ────────────────────────
-- `join-team` calculait le pseudonyme par count() sur les membres.
-- Conséquence : un joueur part, le suivant hérite de son pseudonyme.
-- Comme c'est le SEUL identifiant transmis au LLM, deux athlètes
-- différents apparaissent alors sous le même nom dans les briefs —
-- sans aucune erreur nulle part. Un compteur qui ne décroît jamais.
alter table teams add column if not exists pseudonym_seq int not null default 0;

update teams t set pseudonym_seq = greatest(
  coalesce((
    select max(nullif(regexp_replace(m.pseudonym, '\D', '', 'g'), '')::int)
    from memberships m
    where m.team_id = t.id and m.pseudonym ~ '^[A-Za-z]+-[0-9]+$'
  ), 0),
  (select count(*) from memberships m2 where m2.team_id = t.id)
)
where pseudonym_seq = 0;

create or replace function next_pseudonym(p_team uuid)
returns text language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update teams set pseudonym_seq = pseudonym_seq + 1
  where id = p_team returning pseudonym_seq into n;
  if n is null then raise exception 'team % introuvable', p_team; end if;
  return 'P-' || lpad(n::text, 2, '0');
end $$;

revoke execute on function next_pseudonym(uuid) from anon, authenticated;

-- ── 2. Suppression réelle d'un athlète ──────────────────────
-- « Remove » n'effaçait que la ligne memberships : réponses et métriques
-- restaient lisibles par le staff. C'est la deuxième question de tout
-- juriste universitaire — sans réponse, pas de signature.
--
-- Ne touche PAS à auth.users : la personne peut appartenir à une autre
-- équipe. La suppression du compte lui-même est une action distincte.
create or replace function purge_athlete(p_team uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_resp int; n_metrics int; n_flags int; n_rem int; n_mem int;
begin
  delete from responses      where team_id = p_team and user_id = p_user;
  get diagnostics n_resp = row_count;
  delete from daily_metrics  where team_id = p_team and user_id = p_user;
  get diagnostics n_metrics = row_count;
  delete from flags          where team_id = p_team and user_id = p_user;
  get diagnostics n_flags = row_count;
  delete from pending_reminders where team_id = p_team and user_id = p_user;
  get diagnostics n_rem = row_count;
  delete from memberships    where team_id = p_team and user_id = p_user;
  get diagnostics n_mem = row_count;

  -- Souscriptions push : uniquement si la personne n'est plus dans AUCUNE équipe.
  if not exists (select 1 from memberships where user_id = p_user) then
    delete from push_subscriptions where user_id = p_user;
  end if;

  return jsonb_build_object(
    'responses', n_resp, 'daily_metrics', n_metrics, 'flags', n_flags,
    'pending_reminders', n_rem, 'membership', n_mem,
    'note', 'auth.users conserve : suppression du compte = action distincte'
  );
end $$;

revoke execute on function purge_athlete(uuid, uuid) from anon, authenticated;

-- ── 3. Suppression réelle d'une équipe (fin de contrat) ─────
-- Compte AVANT de supprimer : la cascade efface sans laisser de trace,
-- et une fin de contrat doit pouvoir être justifiée.
create or replace function purge_team(p_team uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  select jsonb_build_object(
    'team',           (select name from teams where id = p_team),
    'responses',      (select count(*) from responses      where team_id = p_team),
    'daily_metrics',  (select count(*) from daily_metrics  where team_id = p_team),
    'sessions',       (select count(*) from sessions       where team_id = p_team),
    'briefs',         (select count(*) from briefs         where team_id = p_team),
    'coach_feedback', (select count(*) from coach_feedback where team_id = p_team),
    'memberships',    (select count(*) from memberships    where team_id = p_team)
  ) into res;

  if res->>'team' is null then raise exception 'team % introuvable', p_team; end if;

  delete from teams where id = p_team;  -- cascade sur tout le reste
  return res || jsonb_build_object('purged_at', now());
end $$;

revoke execute on function purge_team(uuid) from anon, authenticated;

-- ── 4. Export des données d'un athlète (doc 14 P2-1) ────────
-- Le pendant du droit à la suppression : le droit à la portabilité.
-- Une université le demandera aussi.
create or replace function export_athlete(p_team uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from profiles p where p.user_id = p_user),
    'membership', (select to_jsonb(m) from memberships m
                   where m.team_id = p_team and m.user_id = p_user),
    'responses', coalesce((select jsonb_agg(to_jsonb(r) order by r.submitted_at)
                           from responses r
                           where r.team_id = p_team and r.user_id = p_user), '[]'::jsonb),
    'daily_metrics', coalesce((select jsonb_agg(to_jsonb(d) order by d.day)
                               from daily_metrics d
                               where d.team_id = p_team and d.user_id = p_user), '[]'::jsonb)
  );
end $$;

revoke execute on function export_athlete(uuid, uuid) from anon, authenticated;
