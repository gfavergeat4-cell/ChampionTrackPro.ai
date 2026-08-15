-- ============================================================
-- 011 — Correctif : policy UPDATE manquante sur push_subscriptions
-- ============================================================
-- ctpApi.savePushSubscription() fait un upsert (onConflict user_id,endpoint).
-- PostgREST le traduit en INSERT ... ON CONFLICT DO UPDATE, ce qui exige une
-- policy UPDATE. La migration 009 n'avait créé que SELECT / INSERT / DELETE.
--
-- Symptôme : le tout premier abonnement d'un appareil passe (insertion pure),
-- puis chaque re-synchronisation renvoie 403
-- « new row violates row-level security policy (USING expression) ».
-- Conséquence : impossible de rafraîchir un endpoint expiré → notifications
-- muettes au bout de quelques semaines, sans erreur visible côté athlète.

create policy "user_own_subs_update" on push_subscriptions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
