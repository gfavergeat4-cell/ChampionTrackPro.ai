-- ============================================================
-- ChampionTrackPro V2 — Schéma relationnel Supabase (PostgreSQL)
-- Migration depuis Firestore. Source de vérité côté serveur.
-- ============================================================

-- uuid: gen_random_uuid() est natif (pgcrypto), rien à installer
-- pg_cron : à activer plus tard via Dashboard -> Database -> Extensions (nécessaire seulement pour le cron du Morning Brief, Phase 7 du runbook)

-- ── Tenancy ──────────────────────────────────────────────────
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'pilot',
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  sport text not null default 'basketball',
  ics_url text,
  invite_code text unique,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create table seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  label text not null,
  starts_on date not null,
  ends_on date not null
);

-- ── Personnes ────────────────────────────────────────────────
-- auth.users = Supabase Auth. profiles = extension applicative.
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  fcm_tokens jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table memberships (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('athlete','coach','admin')),
  jersey_number int,
  position text,
  birth_year int,
  pseudonym text, -- ex "P-07" : seul identifiant transmis au LLM
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- ── Séances (sync ICS) ───────────────────────────────────────
create table sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  season_id uuid references seasons(id),
  title text,
  session_type text not null default 'practice' check (session_type in ('practice','game','conditioning','skill','scrimmage','other')),
  start_utc timestamptz not null,
  end_utc timestamptz not null,
  ics_uid text,
  ics_hash text,
  cancelled boolean not null default false,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, ics_uid, start_utc)
);
create index idx_sessions_team_end on sessions (team_id, end_utc);

-- ── Questionnaires (structure V3/V4 identique au Firestore actuel) ──
create table questionnaires (
  id text primary key,               -- ex 'tpl-basketball-any'
  name text not null,
  sport text not null,
  session_type text not null default 'any',
  description text,
  questions jsonb not null,          -- [{id, metricKey, category, questionText, leftAnchor, rightAnchor, weight, inverted, isRequired}]
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

create table team_questionnaires (
  team_id uuid not null references teams(id) on delete cascade,
  questionnaire_id text not null references questionnaires(id),
  primary key (team_id, questionnaire_id)
);

-- ── Réponses ─────────────────────────────────────────────────
create table responses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  questionnaire_id text references questionnaires(id),
  metrics jsonb not null,            -- {metricKey: 1-100}
  readiness_score numeric,           -- calculé SERVEUR (trigger), plus jamais client
  session_load numeric,              -- future V4 (charge) — null tant que non déployé
  workload_au numeric,               -- session_load/10 * durée_min — null tant que non déployé
  has_friction boolean not null default false,
  friction_type text,
  friction_impact numeric,
  worry_level numeric,
  worry_flag boolean not null default false,
  is_test boolean not null default false,
  submitted_at timestamptz not null default now(),
  unique (session_id, user_id)
);
create index idx_responses_team_date on responses (team_id, submitted_at);
create index idx_responses_user_date on responses (user_id, submitted_at);

-- ── Moteur : métriques quotidiennes (remplies par edge function) ──
create table daily_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  day date not null,
  readiness numeric,
  ema_28 numeric,                    -- baseline EMA alpha=0.069 (méthodologie existante)
  deviation_pct numeric,             -- (readiness - ema)/ema * 100
  zone text check (zone in ('GREEN','BLUE','YELLOW','INSUFFICIENT_DATA')),
  sub_phy numeric, sub_tec numeric, sub_men numeric,
  workload_au numeric,
  acwr numeric,                      -- null tant que la charge n'existe pas
  data_days int not null default 0,  -- nb de jours de données réelles derrière la baseline
  computed_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ── RÈGLES D'INTERPRÉTATION — PROPRIÉTÉ DE GABIN ─────────────
-- ⚠ TABLE VOLONTAIREMENT VIDE DE LOGIQUE. Le moteur n'évalue que
--   les lignes enabled=true. L'ingénierie des règles (seuils,
--   conditions, textes) sera faite par Gabin. RIEN à inventer ici.
create table rules (
  id text primary key,               -- ex 'R-01'
  version int not null default 1,
  description text not null,
  metric text not null,              -- 'readiness' | 'zone' | metricKey | 'acwr' | ...
  condition_sql text not null,       -- prédicat évalué par le moteur
  min_data_days int not null default 10,
  flag_code text not null,           -- ex 'LOAD_WARNING'
  severity text not null default 'monitor' check (severity in ('info','monitor','danger')),
  recommendation text,               -- les mots de Gabin, narrés tels quels par le LLM
  priority int not null default 100, -- hiérarchisation de ce qui remonte au coach
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table flags (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id text not null references rules(id),
  rule_version int not null,
  day date not null,
  value numeric,                     -- la valeur qui a déclenché
  created_at timestamptz not null default now(),
  unique (user_id, rule_id, day)
);

-- ── Briefs (sortie LLM) + boucle de feedback coach ───────────
create table briefs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  brief_date date not null,
  body text not null,                -- narration LLM ; chaque phrase cite un chiffre
  payload jsonb not null,            -- scores+flags pseudonymisés envoyés au LLM (traçabilité totale)
  model text not null,
  tokens_in int, tokens_out int, cost_usd numeric,
  created_at timestamptz not null default now(),
  unique (team_id, brief_date)
);

-- Le carburant du futur entraînement : ce que le coach juge utile.
create table coach_feedback (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  coach_id uuid not null references auth.users(id),
  brief_id uuid references briefs(id) on delete cascade,
  flag_id uuid references flags(id) on delete cascade,
  action text not null check (action in ('acknowledged','overridden','useful','noise')),
  note text,
  created_at timestamptz not null default now()
);

-- Journal LLM (coûts, audit)
create table llm_logs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id),
  purpose text not null,             -- 'morning_brief' | 'weekly_synthesis'
  model text not null,
  tokens_in int, tokens_out int, cost_usd numeric,
  ok boolean not null default true,
  error text,
  created_at timestamptz not null default now()
);
