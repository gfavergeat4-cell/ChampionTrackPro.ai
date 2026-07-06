-- Seed initial (base vide, pas de migration Firestore nécessaire) :
-- 1 organisation, 1 équipe pilote avec code d'invitation,
-- le questionnaire Basketball V3 actuel (poids/inversions du code existant).
insert into organizations (id, name, plan)
values ('a0000000-0000-4000-8000-000000000001', 'ChampionTrackPro', 'pilot')
on conflict do nothing;

insert into teams (id, organization_id, name, sport, invite_code, timezone)
values ('b0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000001',
        'Pilot Team', 'basketball', 'CTP-PILOT', 'America/New_York')
on conflict do nothing;

insert into questionnaires (id, name, sport, session_type, description, questions, is_default, created_by)
values ('tpl-basketball-any', 'Basketball — Any Session', 'Basketball', 'any',
  'Standard 6-metric questionnaire (V3) — sera remplacé par le V4 après ingénierie Gabin.',
  '[
    {"id":"q1","metricKey":"tankLevel","category":"Physical Engine","questionText":"How loaded is your tank walking into today''s session?","leftAnchor":"Running on empty","rightAnchor":"Fully charged","weight":0.20,"inverted":false,"isRequired":true},
    {"id":"q2","metricKey":"cardioLoad","category":"Physical Engine","questionText":"How gassed were your lungs and transitions yesterday?","leftAnchor":"Barely felt it","rightAnchor":"Completely gassed","weight":0.20,"inverted":true,"isRequired":true},
    {"id":"q3","metricKey":"legBounce","category":"Physical Engine","questionText":"How bouncy do your legs feel right now?","leftAnchor":"Legs are bricks","rightAnchor":"Springy and explosive","weight":0.20,"inverted":false,"isRequired":true},
    {"id":"q4","metricKey":"motorControl","category":"Technical Execution","questionText":"How dialed-in does your handle and shot feel today?","leftAnchor":"Completely off","rightAnchor":"Silky smooth, locked in","weight":0.15,"inverted":false,"isRequired":true},
    {"id":"q5","metricKey":"tacticalSharpness","category":"Technical Execution","questionText":"How sharp are you at reading the floor and playbook?","leftAnchor":"Mentally foggy","rightAnchor":"Seeing everything","weight":0.15,"inverted":false,"isRequired":true},
    {"id":"q6","metricKey":"teamChemistry","category":"Mental Energy","questionText":"How connected do you feel to the team''s energy?","leftAnchor":"Disconnected","rightAnchor":"Locked in together","weight":0.10,"inverted":false,"isRequired":true}
  ]'::jsonb, true, 'system')
on conflict do nothing;

insert into team_questionnaires (team_id, questionnaire_id)
values ('b0000000-0000-4000-8000-000000000001', 'tpl-basketball-any')
on conflict do nothing;
