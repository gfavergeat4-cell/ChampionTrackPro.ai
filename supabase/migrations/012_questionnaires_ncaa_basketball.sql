-- ============================================================
-- 012 — Questionnaires NCAA Basketball (doc 15 v3, méthode DAR)
-- ============================================================
-- Architecture à deux blocs :
--   A. Après chaque effort  -> coût de l'effort, varie selon session_type
--   B. Une fois par jour    -> état global + charge académique + douleur
--
-- ⚠ RIEN N'EST ACTIVÉ. Ces questionnaires sont créés mais NON reliés
--   aux équipes. La bascule est une décision du fondateur : voir le bloc
--   commenté en fin de fichier.
--
-- Champs ajoutés au format des questions : "role" (cost|state|context)
-- et "axis" (PHY|TEC|MEN|REC|SOC|ACA|CTX). Ils permettent au moteur de
-- calculer session_load et sub_phy/sub_tec/sub_men sans les deviner.
--
-- Convention de lecture (DAR partie 2 §E.2) : le sens gauche->droite va
-- TOUJOURS du moins vers le plus. L'inversion de valence est un traitement
-- serveur (champ "inverted"), invisible pour l'athlète.

-- ── Zone corporelle de la douleur (doc 15 §5, étape D3) ────────
alter table responses add column if not exists friction_area text;

comment on column responses.friction_area is
  'Zone corporelle déclarée en cas de douleur physique. Vocabulaire figé (doc 15 §5). Ne rentre dans aucun score.';

-- ============================================================
-- BLOC A — Après l'effort
-- ============================================================

-- A1. Séance complète : practice / scrimmage
insert into questionnaires (id, name, sport, session_type, description, questions, is_default, created_by)
values ('tpl-bball-effort-full', 'Basketball - Practice', 'Basketball', 'practice',
  'Coût de l''effort, 8 items. Identique au questionnaire match (comparabilite entrainement/competition).',
  '[
    {"id":"r0","metricKey":"reserveBefore","role":"context","axis":"CTX","category":"Before",
     "questionText":"Energy before","description":"How much you had in the tank before starting.",
     "leftAnchor":"Empty","rightAnchor":"Completely full","weight":0,"inverted":true,"isRequired":true},
    {"id":"p1","metricKey":"costMuscular","role":"cost","axis":"PHY","category":"Physical",
     "questionText":"Muscular Cost","description":"How much this session cost your muscles.",
     "leftAnchor":"Nothing","rightAnchor":"Everything I had","weight":0.18,"inverted":false,"isRequired":true},
    {"id":"p2","metricKey":"costCardio","role":"cost","axis":"PHY","category":"Physical",
     "questionText":"Cardio Cost","description":"How much it cost your engine - breathing, heart rate.",
     "leftAnchor":"Nothing","rightAnchor":"Everything I had","weight":0.18,"inverted":false,"isRequired":true},
    {"id":"p3","metricKey":"recoveryBetween","role":"cost","axis":"PHY","category":"Physical",
     "questionText":"Recovery Between Efforts","description":"How well you got your air back between reps and drills.",
     "leftAnchor":"Never recovered","rightAnchor":"Recovered every time","weight":0.12,"inverted":true,"isRequired":true},
    {"id":"t1","metricKey":"costTechnical","role":"cost","axis":"TEC","category":"Technical",
     "questionText":"Technical Demand","description":"How much precision it required - handling, finishing, footwork.",
     "leftAnchor":"Very little","rightAnchor":"Maximum","weight":0.14,"inverted":false,"isRequired":true},
    {"id":"t2","metricKey":"costTactical","role":"cost","axis":"TEC","category":"Technical",
     "questionText":"Reading The Game","description":"How much reading and decision-making it required.",
     "leftAnchor":"Very little","rightAnchor":"Constant","weight":0.14,"inverted":false,"isRequired":true},
    {"id":"m1","metricKey":"costFocus","role":"cost","axis":"MEN","category":"Mental",
     "questionText":"Concentration Demand","description":"How much concentration it required.",
     "leftAnchor":"Very little","rightAnchor":"Maximum","weight":0.13,"inverted":false,"isRequired":true},
    {"id":"m2","metricKey":"costEmotional","role":"cost","axis":"MEN","category":"Mental",
     "questionText":"Emotional Cost","description":"How much it cost you emotionally - pressure, frustration, nerves.",
     "leftAnchor":"Nothing","rightAnchor":"A lot","weight":0.11,"inverted":false,"isRequired":true}
  ]'::jsonb, false, 'system')
on conflict (id) do update set questions = excluded.questions, description = excluded.description;

-- A2. Match — items RIGOUREUSEMENT identiques (loi de comparabilite, doc 15 §3)
insert into questionnaires (id, name, sport, session_type, description, questions, is_default, created_by)
select 'tpl-bball-effort-game', 'Basketball - Game', 'Basketball', 'game',
       'Items strictement identiques a la practice. Toute divergence detruirait la comparaison entrainement/competition.',
       questions, false, 'system'
from questionnaires where id = 'tpl-bball-effort-full'
on conflict (id) do update set questions = excluded.questions;

-- A3. Préparation physique / musculation — pas de technique ni tactique
insert into questionnaires (id, name, sport, session_type, description, questions, is_default, created_by)
values ('tpl-bball-effort-sc', 'Basketball - Strength & Conditioning', 'Basketball', 'conditioning',
  'Coût de l''effort, 5 items. Technique et tactique retirees : les poser ici produirait du bruit. Poids renormalises a 1.0.',
  '[
    {"id":"r0","metricKey":"reserveBefore","role":"context","axis":"CTX","category":"Before",
     "questionText":"Energy before","description":"How much you had in the tank before starting.",
     "leftAnchor":"Empty","rightAnchor":"Completely full","weight":0,"inverted":true,"isRequired":true},
    {"id":"p1","metricKey":"costMuscular","role":"cost","axis":"PHY","category":"Physical",
     "questionText":"Muscular Cost","description":"How much this session cost your muscles.",
     "leftAnchor":"Nothing","rightAnchor":"Everything I had","weight":0.30,"inverted":false,"isRequired":true},
    {"id":"p2","metricKey":"costCardio","role":"cost","axis":"PHY","category":"Physical",
     "questionText":"Cardio Cost","description":"How much it cost your engine - breathing, heart rate.",
     "leftAnchor":"Nothing","rightAnchor":"Everything I had","weight":0.30,"inverted":false,"isRequired":true},
    {"id":"p3","metricKey":"recoveryBetween","role":"cost","axis":"PHY","category":"Physical",
     "questionText":"Recovery Between Efforts","description":"How well you got your air back between sets.",
     "leftAnchor":"Never recovered","rightAnchor":"Recovered every time","weight":0.20,"inverted":true,"isRequired":true},
    {"id":"m1","metricKey":"costFocus","role":"cost","axis":"MEN","category":"Mental",
     "questionText":"Concentration Demand","description":"How much concentration it required.",
     "leftAnchor":"Very little","rightAnchor":"Maximum","weight":0.20,"inverted":false,"isRequired":true}
  ]'::jsonb, false, 'system')
on conflict (id) do update set questions = excluded.questions, description = excluded.description;

-- A4. Travail individuel technique
insert into questionnaires (id, name, sport, session_type, description, questions, is_default, created_by)
values ('tpl-bball-effort-skill', 'Basketball - Skill Work', 'Basketball', 'skill',
  'Coût de l''effort, 4 items. Poids renormalises a 1.0.',
  '[
    {"id":"r0","metricKey":"reserveBefore","role":"context","axis":"CTX","category":"Before",
     "questionText":"Energy before","description":"How much you had in the tank before starting.",
     "leftAnchor":"Empty","rightAnchor":"Completely full","weight":0,"inverted":true,"isRequired":true},
    {"id":"p1","metricKey":"costMuscular","role":"cost","axis":"PHY","category":"Physical",
     "questionText":"Muscular Cost","description":"How much this session cost your muscles.",
     "leftAnchor":"Nothing","rightAnchor":"Everything I had","weight":0.35,"inverted":false,"isRequired":true},
    {"id":"t1","metricKey":"costTechnical","role":"cost","axis":"TEC","category":"Technical",
     "questionText":"Technical Demand","description":"How much precision it required - handling, finishing, footwork.",
     "leftAnchor":"Very little","rightAnchor":"Maximum","weight":0.35,"inverted":false,"isRequired":true},
    {"id":"m1","metricKey":"costFocus","role":"cost","axis":"MEN","category":"Mental",
     "questionText":"Concentration Demand","description":"How much concentration it required.",
     "leftAnchor":"Very little","rightAnchor":"Maximum","weight":0.30,"inverted":false,"isRequired":true}
  ]'::jsonb, false, 'system')
on conflict (id) do update set questions = excluded.questions, description = excluded.description;

-- ============================================================
-- BLOC B — Une fois par jour, heure fixe (DAR partie 2 §C.1)
-- ============================================================
insert into questionnaires (id, name, sport, session_type, description, questions, is_default, created_by)
values ('tpl-bball-daily', 'Basketball - Daily Check-in', 'Basketball', 'daily',
  'Etat global de la journee. UNE SEULE passation par jour, meme en double seance. Le bloc douleur y est attache.',
  '[
    {"id":"s1","metricKey":"stateSleep","role":"state","axis":"REC","category":"Recovery",
     "questionText":"Sleep Quality","description":"Quality of rest during the last 24 hours.",
     "leftAnchor":"Broken / poor","rightAnchor":"Deep / restorative","weight":0.30,"inverted":false,"isRequired":true},
    {"id":"s2","metricKey":"stateMotivation","role":"state","axis":"MEN","category":"Mental",
     "questionText":"Drive","description":"How much you wanted to be there today.",
     "leftAnchor":"Didn''t want to be there","rightAnchor":"Couldn''t wait","weight":0.25,"inverted":false,"isRequired":true},
    {"id":"s3","metricKey":"stateConfidence","role":"state","axis":"MEN","category":"Mental",
     "questionText":"Confidence","description":"How much you trusted your game today.",
     "leftAnchor":"Doubting myself","rightAnchor":"Full belief","weight":0.20,"inverted":false,"isRequired":true},
    {"id":"s4","metricKey":"stateTeamSpirit","role":"state","axis":"SOC","category":"Team",
     "questionText":"Team Energy","description":"How the energy in the group felt today.",
     "leftAnchor":"Flat / tense","rightAnchor":"Connected / lifting each other","weight":0.15,"inverted":false,"isRequired":true},
    {"id":"s5","metricKey":"stateBelonging","role":"state","axis":"SOC","category":"Team",
     "questionText":"Role Clarity","description":"How clear your role in this team felt today.",
     "leftAnchor":"Completely unclear","rightAnchor":"Completely clear","weight":0.10,"inverted":false,"isRequired":true},
    {"id":"a1","metricKey":"costAcademic","role":"cost","axis":"ACA","category":"Academics",
     "questionText":"Academic Load","description":"How much school took out of you today - classes, study, deadlines.",
     "leftAnchor":"Nothing","rightAnchor":"Everything I had","weight":0,"inverted":false,"isRequired":true}
  ]'::jsonb, false, 'system')
on conflict (id) do update set questions = excluded.questions, description = excluded.description;

-- ============================================================
-- Garde-fou : la somme des poids doit valoir 1.0 par questionnaire
-- ============================================================
-- Un questionnaire dont les poids ne somment pas a 1.0 produit un score
-- faux que personne ne remarque. On verifie a l'insertion.
create or replace function check_questionnaire_weights()
returns trigger language plpgsql as $$
declare total numeric;
begin
  select round(sum((q->>'weight')::numeric), 4) into total
  from jsonb_array_elements(new.questions) q;
  if total is null or abs(total - 1.0) > 0.001 then
    raise exception 'Questionnaire %: la somme des poids vaut % (attendu 1.0)', new.id, total;
  end if;
  return new;
end $$;

drop trigger if exists questionnaires_weights_check on questionnaires;
create trigger questionnaires_weights_check
  before insert or update of questions on questionnaires
  for each row execute function check_questionnaire_weights();

-- ============================================================
-- BASCULE — décision du fondateur, volontairement NON exécutée
-- ============================================================
-- Rien n'est relie a une equipe : le questionnaire actuel reste actif.
-- Quand Gabin decide de basculer une equipe, il execute :
--
--   delete from team_questionnaires where team_id = '<TEAM_ID>';
--   insert into team_questionnaires (team_id, questionnaire_id) values
--     ('<TEAM_ID>', 'tpl-bball-effort-full'),
--     ('<TEAM_ID>', 'tpl-bball-effort-game'),
--     ('<TEAM_ID>', 'tpl-bball-effort-sc'),
--     ('<TEAM_ID>', 'tpl-bball-effort-skill'),
--     ('<TEAM_ID>', 'tpl-bball-daily');
--
-- ⚠ Les readiness calculees avec l'ancien questionnaire ne sont PAS
--   comparables aux nouvelles. Les baselines se reconstituent en 28 jours.
