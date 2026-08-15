-- ============================================================
-- SEED DÉMO — 15 athlètes, 60 jours d'historique réaliste
-- ============================================================
-- ⚠ DONNÉES FICTIVES. À exécuter uniquement sur la base pilote.
--   Script de purge en fin de fichier.
--
-- Sème dans l'équipe pilote (b0000000-...-0001), que Gabin coache déjà.
-- Comptes athlètes : emails @demo.championtrackpro.test, sans mot de passe
-- utilisable — ils existent comme sujets de données, pas comme connexions.
--
-- Motifs volontairement injectés sur les 7 derniers jours, pour que le
-- tableau coach montre les trois configurations de la méthode DAR :
--   D-03  « Mental only »     -> mental seul en hausse
--   D-07  « Converging »      -> les trois marqueurs montent ensemble
--   D-11  « Technical only »  -> technique seule en hausse
--   D-05  non-répondant depuis 3 jours
--   D-09  en sous-sollicitation durable (bleu silencieux)

-- ── 0. L'équipe doit servir les nouveaux questionnaires ─────
delete from team_questionnaires where team_id = 'b0000000-0000-4000-8000-000000000001';
insert into team_questionnaires (team_id, questionnaire_id) values
  ('b0000000-0000-4000-8000-000000000001', 'tpl-bball-effort-full'),
  ('b0000000-0000-4000-8000-000000000001', 'tpl-bball-effort-game'),
  ('b0000000-0000-4000-8000-000000000001', 'tpl-bball-effort-sc'),
  ('b0000000-0000-4000-8000-000000000001', 'tpl-bball-effort-skill'),
  ('b0000000-0000-4000-8000-000000000001', 'tpl-bball-daily')
on conflict do nothing;

-- ── 1. Athlètes ─────────────────────────────────────────────
do $$
declare
  i int;
  uid uuid;
  positions text[] := array['G','G','G','G','G','F','F','F','F','F','C','C','G','F','C'];
  names text[] := array[
    'DEMO Marcus Hill','DEMO Tyrese Brooks','DEMO Jalen Carter','DEMO Devin Ross',
    'DEMO Isaiah Moore','DEMO Cameron Reid','DEMO Xavier Lane','DEMO Elijah Ward',
    'DEMO Nolan Pierce','DEMO Amari Boyd','DEMO Zion Fletcher','DEMO Keon Vance',
    'DEMO Trey Salazar','DEMO Andre Whitfield','DEMO Josiah Kemp'];
begin
  for i in 1..15 loop
    uid := ('d0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'demo' || lpad(i::text, 2, '0') || '@demo.championtrackpro.test', '',
      now(), now() - interval '70 days', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
      '', '', '', ''
    ) on conflict (id) do nothing;

    insert into profiles (user_id, display_name, email)
    values (uid, names[i], 'demo' || lpad(i::text, 2, '0') || '@demo.championtrackpro.test')
    on conflict (user_id) do update set display_name = excluded.display_name;

    insert into memberships (team_id, user_id, role, jersey_number, position, pseudonym, joined_at)
    values ('b0000000-0000-4000-8000-000000000001', uid, 'athlete',
            i + 3, positions[i], 'D-' || lpad(i::text, 2, '0'), now() - interval '70 days')
    on conflict (team_id, user_id) do update set pseudonym = excluded.pseudonym;
  end loop;
end $$;

-- ── 2. Séances sur 60 jours ─────────────────────────────────
-- Rythme NCAA : practice lun/mer/ven, S&C mar/jeu, match samedi.
do $$
declare
  d date;
  dow int;
begin
  for d in select generate_series(current_date - 60, current_date, interval '1 day')::date loop
    dow := extract(isodow from d);
    if dow in (1, 3, 5) then
      insert into sessions (team_id, title, session_type, start_utc, end_utc)
      values ('b0000000-0000-4000-8000-000000000001', 'Practice', 'practice',
              d + time '19:00', d + time '21:00')
      on conflict do nothing;
    elsif dow in (2, 4) then
      insert into sessions (team_id, title, session_type, start_utc, end_utc)
      values ('b0000000-0000-4000-8000-000000000001', 'Lift', 'conditioning',
              d + time '12:00', d + time '13:15')
      on conflict do nothing;
    elsif dow = 6 then
      insert into sessions (team_id, title, session_type, start_utc, end_utc)
      values ('b0000000-0000-4000-8000-000000000001', 'Game', 'game',
              d + time '23:00', d + time '25:00')
      on conflict do nothing;
    end if;
  end loop;
end $$;

-- ── 3. Réponses ─────────────────────────────────────────────
-- Chaque athlète a SA baseline. La zone est un écart à soi-même : c'est
-- toute la méthode. Bruit aléatoire ±7, motifs injectés sur 7 jours.
do $$
declare
  s record;
  i int;
  uid uuid;
  base_phy numeric; base_tec numeric; base_men numeric;
  p numeric; t numeric; m numeric;
  qid text;
  days_ago numeric;
  recent boolean;
begin
  for s in
    select id, session_type, start_utc, end_utc
    from sessions
    where team_id = 'b0000000-0000-4000-8000-000000000001'
      and end_utc <= now()
      and start_utc >= now() - interval '61 days'
    order by start_utc
  loop
    days_ago := extract(epoch from (now() - s.end_utc)) / 86400.0;
    recent   := days_ago <= 7;

    qid := case s.session_type
             when 'game' then 'tpl-bball-effort-game'
             when 'conditioning' then 'tpl-bball-effort-sc'
             else 'tpl-bball-effort-full' end;

    for i in 1..15 loop
      uid := ('d0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid;

      -- D-05 : ne répond plus depuis 3 jours
      if i = 5 and days_ago <= 3 then continue; end if;
      -- compliance imparfaite, comme dans la vraie vie
      if random() < 0.08 then continue; end if;

      base_phy := 42 + ((i * 3) % 28);
      base_tec := 38 + ((i * 5) % 30);
      base_men := 34 + ((i * 7) % 26);

      -- Un match coûte plus qu'une practice, une séance de force sollicite
      -- surtout le physique : c'est ce qui rendra l'écart de spécificité lisible.
      if s.session_type = 'game' then
        base_phy := base_phy + 12; base_tec := base_tec + 14; base_men := base_men + 16;
      elsif s.session_type = 'conditioning' then
        base_phy := base_phy + 8; base_men := base_men - 6;
      end if;

      p := base_phy + (random() * 14 - 7);
      t := base_tec + (random() * 14 - 7);
      m := base_men + (random() * 14 - 7);

      -- Motifs des 7 derniers jours
      if recent then
        if i = 3  then m := m + 19; end if;                          -- Mental only
        if i = 7  then p := p + 15; t := t + 15; m := m + 15; end if; -- Converging
        if i = 11 then t := t + 19; end if;                          -- Technical only
        if i = 9  then p := p - 15; t := t - 13; m := m - 12; end if; -- bleu silencieux
      end if;

      p := greatest(5, least(98, p));
      t := greatest(5, least(98, t));
      m := greatest(5, least(98, m));

      -- recoveryBetween est inversé côté serveur : 101 - p le neutralise,
      -- pour que l'axe PHY vaille exactement p.
      insert into responses (
        team_id, session_id, user_id, questionnaire_id, metrics,
        has_friction, submitted_at
      ) values (
        'b0000000-0000-4000-8000-000000000001', s.id, uid, qid,
        case when s.session_type = 'conditioning' then
          jsonb_build_object(
            'reserveBefore',   round(55 + random() * 30),
            'costMuscular',    round(p),
            'costCardio',      round(p),
            'recoveryBetween', round(101 - p),
            'costFocus',       round(m))
        else
          jsonb_build_object(
            'reserveBefore',   round(55 + random() * 30),
            'costMuscular',    round(p),
            'costCardio',      round(p),
            'recoveryBetween', round(101 - p),
            'costTechnical',   round(t),
            'costTactical',    round(t),
            'costFocus',       round(m),
            'costEmotional',   round(m))
        end,
        false,
        s.end_utc + interval '25 minutes'
      ) on conflict (session_id, user_id) do nothing;
    end loop;
  end loop;
end $$;

-- ── 4. Contrôle ─────────────────────────────────────────────
select
  (select count(*) from memberships
    where team_id = 'b0000000-0000-4000-8000-000000000001' and role = 'athlete') as athletes,
  (select count(*) from sessions
    where team_id = 'b0000000-0000-4000-8000-000000000001')                      as seances,
  (select count(*) from responses
    where team_id = 'b0000000-0000-4000-8000-000000000001')                      as reponses,
  (select count(*) from responses
    where team_id = 'b0000000-0000-4000-8000-000000000001'
      and workload_au is not null)                                               as avec_charge;

-- ============================================================
-- PURGE — à garder sous la main
-- ============================================================
-- delete from responses  where user_id::text like 'd0000000-0000-4000-8000-%';
-- delete from memberships where user_id::text like 'd0000000-0000-4000-8000-%';
-- delete from profiles    where user_id::text like 'd0000000-0000-4000-8000-%';
-- delete from auth.users  where id::text      like 'd0000000-0000-4000-8000-%';
-- delete from sessions    where team_id = 'b0000000-0000-4000-8000-000000000001'
--                           and ics_uid is null;
