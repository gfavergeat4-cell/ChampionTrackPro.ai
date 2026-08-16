-- ============================================================
-- 019 — Fenêtre de réponse alignée sur les relances (doc 11 P0-5)
-- ============================================================
-- Les relances partent à +3 h et +6 h après la fin de séance — timings
-- repris à l'identique de l'ancienne version, validés sur le terrain.
-- Or la policy d'insertion fermait la fenêtre à +5 h : l'athlète recevait
-- la relance de 6 h, ouvrait le questionnaire, remplissait ses soixante
-- secondes et prenait un refus. Aucune erreur explicite, juste un échec.
--
-- Des deux valeurs, c'est la fenêtre qui est arbitraire : elle a été
-- inventée en V2, alors que les timings de relance viennent de la version
-- éprouvée. On aligne donc la fenêtre, pas les relances.
--
-- 8 h = dernière relance (+6 h) + 2 h pour répondre.

drop policy if exists responses_self_insert on responses;

create policy responses_self_insert on responses for insert
  with check (
    user_id = auth.uid()
    and team_id in (select my_teams())
    and exists (
      select 1 from sessions s
      where s.id = session_id
        and now() >= s.end_utc
        and now() <= s.end_utc + interval '8 hours'
    )
  );

comment on policy responses_self_insert on responses is
  'Fenetre de reponse : fin de seance -> +8 h. Doit rester STRICTEMENT '
  'superieure au dernier offset de relance de session-watcher (+6 h), '
  'sinon l''athlete est renvoye vers un formulaire deja ferme.';
