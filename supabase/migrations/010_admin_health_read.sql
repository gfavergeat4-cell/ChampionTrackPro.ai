-- ============================================================
-- 010 — Console santé système (doc 09, lot L3)
-- Lecture seule, réservée aux admins de l'équipe concernée.
-- Aucune écriture client : ces tables restent pilotées par les
-- edge functions en service_role.
-- ============================================================

-- Journal LLM : coût et erreurs par équipe.
-- (Jusqu'ici aucune policy => aucun accès client, y compris admin.)
create policy llm_logs_admin_read on llm_logs for select
  using (team_id is not null and my_role_in(team_id) = 'admin');

-- Relances push : visibilité sur ce que la chaîne de notification a envoyé.
create policy pending_reminders_admin_read on pending_reminders for select
  using (my_role_in(team_id) = 'admin');
