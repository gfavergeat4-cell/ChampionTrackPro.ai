-- ============================================================
-- 017 — Conditions d'utilisation et traçabilité du consentement
-- (doc 12 R-04, doc 14 P1-7)
-- ============================================================
-- Aujourd'hui rien ne prouve qu'un utilisateur ait jamais vu le moindre
-- texte. Le jour où un athlète affirme n'avoir pas été informé, il n'y a
-- rien à opposer. Cette migration crée la preuve : une ligne par document,
-- par version, par personne, horodatée.

-- ── Les textes et leurs versions ────────────────────────────
create table if not exists legal_documents (
  key          text not null,                          -- 'tos' | 'privacy' | 'athlete_notice'
  version      text not null,                          -- 'v1.0'
  title        text not null,
  url          text not null,                          -- page publique
  summary      text,                                   -- une ligne, affichée dans l'app
  effective_at date not null default current_date,
  applies_to   text[] not null default array['athlete','coach','admin'],
  -- 'draft' : visible, jamais exige. 'active' : bloque l'acces tant que non accepte.
  -- Les brouillons du doc 13 n'ont pas ete relus par un avocat : ils restent
  -- en 'draft' jusqu'a validation. Basculer en 'active' est une decision.
  status       text not null default 'draft' check (status in ('draft','active','retired')),
  created_at   timestamptz not null default now(),
  primary key (key, version)
);

alter table legal_documents enable row level security;

create policy legal_documents_read on legal_documents for select
  using (true);   -- lisible meme avant connexion : l'ecran d'inscription en a besoin

grant select on legal_documents to anon, authenticated;

-- ── La preuve d'acceptation ─────────────────────────────────
-- Immuable par construction : pas de policy UPDATE ni DELETE.
-- Un consentement est un fait daté, il ne se modifie pas.
create table if not exists user_consents (
  user_id     uuid not null references auth.users(id) on delete cascade,
  doc_key     text not null,
  version     text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, doc_key, version)
);

alter table user_consents enable row level security;

create policy consents_self_read on user_consents for select
  using (user_id = auth.uid());
create policy consents_self_insert on user_consents for insert
  with check (user_id = auth.uid());

grant select, insert on user_consents to authenticated;

-- Un admin doit pouvoir prouver qui a accepte quoi, sans voir autre chose.
create policy consents_admin_read on user_consents for select
  using (exists (
    select 1 from memberships m_admin
    join memberships m_target on m_target.team_id = m_admin.team_id
    where m_admin.user_id = auth.uid() and m_admin.role = 'admin'
      and m_target.user_id = user_consents.user_id
  ));

-- ── Ce qu'il reste à accepter, pour l'utilisateur courant ───
create or replace view v_my_pending_consents as
with my_roles as (
  select distinct role from memberships where user_id = auth.uid()
),
current_docs as (
  select distinct on (d.key) d.*
  from legal_documents d
  where d.status = 'active'
  order by d.key, d.effective_at desc, d.version desc
)
select c.key, c.version, c.title, c.url, c.summary, c.effective_at
from current_docs c
where (
    exists (select 1 from my_roles r where r.role = any(c.applies_to))
    or not exists (select 1 from my_roles)   -- pas encore d'equipe : on exige quand meme
  )
  and not exists (
    select 1 from user_consents uc
    where uc.user_id = auth.uid() and uc.doc_key = c.key and uc.version = c.version
  );

alter view v_my_pending_consents set (security_invoker = true);
grant select on v_my_pending_consents to authenticated;

-- ── Seed v1.0 — en BROUILLON, donc non bloquant ─────────────
insert into legal_documents (key, version, title, url, summary, applies_to, status) values
  ('tos', 'v1.0', 'Terms of Service', '/legal/terms.html',
   'What the service does, what it does not do, and who is responsible for what.',
   array['athlete','coach','admin'], 'draft'),
  ('privacy', 'v1.0', 'Privacy Policy', '/legal/privacy.html',
   'What we collect, who can see it, how long we keep it, and how to have it deleted.',
   array['athlete','coach','admin'], 'draft'),
  ('athlete_notice', 'v1.0', 'Athlete Notice', '/legal/athlete-notice.html',
   'Plain-language summary of what your coaching staff sees and what your rights are.',
   array['athlete'], 'draft')
on conflict (key, version) do update
  set title = excluded.title, url = excluded.url, summary = excluded.summary;

-- ============================================================
-- ACTIVATION — décision du fondateur, volontairement non exécutée
-- ============================================================
-- Tant que les textes n'ont pas ete relus par un conseil qualifie en droit
-- americain, ils restent en 'draft' : l'application les affiche mais ne les
-- impose pas. Pour les rendre opposables :
--
--   update legal_documents set status = 'active' where version = 'v1.0';
--
-- A partir de ce moment, aucun utilisateur n'accede a ses donnees sans
-- avoir accepte, et chaque acceptation est horodatee.
