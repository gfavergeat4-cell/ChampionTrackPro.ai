-- ============================================================
-- 009 — Web Push VAPID : subscriptions + relances
-- E2 Notifications (doc 01 §5, doc 04 §3)
-- ============================================================

-- ── Push subscriptions (Web Push API) ──────────────────────
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;

-- Chaque utilisateur gère ses propres souscriptions
create policy "user_own_subs_select" on push_subscriptions
  for select using (user_id = auth.uid());
create policy "user_own_subs_insert" on push_subscriptions
  for insert with check (user_id = auth.uid());
create policy "user_own_subs_delete" on push_subscriptions
  for delete using (user_id = auth.uid());

-- ── Pending reminders (relances post-séance) ───────────────
create table pending_reminders (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  remind_at timestamptz not null,
  attempt int not null default 1,
  status text not null default 'pending'
    check (status in ('pending','sent','responded','expired')),
  created_at timestamptz not null default now(),
  unique (session_id, user_id, attempt)
);

alter table pending_reminders enable row level security;
-- Pas de policy : table gérée exclusivement par les edge functions (service-role).

-- Index pour le scan du cron session-watcher
create index idx_pending_reminders_due
  on pending_reminders (status, remind_at)
  where status = 'pending';
