# 01 — ÉTAT DU PROJET (handover complet)
**7 juillet 2026. Ce document permet à n'importe quel agent/développeur de reprendre le projet exactement où il est. Lire aussi : `CONSTITUTION.md` (racine du repo — règles intangibles), puis les docs 02-04.**

---

## 1. Le produit en une phrase
ChampionTrackPro transforme le ressenti quotidien des athlètes (sliders 60 s post-séance) en aide à la décision pour les staffs de basketball NCAA : calculs déterministes (baseline individuelle EMA 28 j, zones, charge) → règles écrites par le fondateur (Gabin, expert sport science — table `rules`, encore vide volontairement) → narration LLM traçable → Morning Brief coach avec feedback (useful/noise) qui constitue le futur dataset d'apprentissage.

## 2. Contexte business (résumé)
Fondateur solo : Gabin Favergeat, M2 EOPS, bilingue, basé Tennessee. 0 client payant. Preuve : Cesson-Rennes Handball D1 (+4 places, 0 blessure de charge, 2 mois). Cible : WBB/MBB NCAA D2-D3 (coach = seul décideur). Pricing prévu : 8,5-12 k$/saison. Leads chauds : King Univ., Emory & Henry, WV State, Washburn (voir mémoire projet). Chemin critique commercial : 1 pilote NCAA de 8 semaines dès la pré-saison août 2026.

## 3. Infrastructure en production

| Élément | Valeur |
|---|---|
| Repo GitHub | `gfavergeat4-cell/ChampionTrackPro.ai` (privé, branche main) |
| Dossier local | `C:\GAB\PRO\ChampionTrackPRO\APP\ChampionTrackPro-V2` |
| Ancien projet (GELÉ, ne pas toucher) | `C:\GAB\PRO\ChampionTrackPro_-main` + Firebase (CF encore actives → à éteindre en fin de migration) |
| Supabase | projet `wiopzitygsgincztwquz`, région US East, plan Free. Org `gab's Org` |
| LLM | API Anthropic, clé dans `supabase secrets` (`ANTHROPIC_API_KEY`), modèle quotidien classe Haiku, coût mesuré ≈ 0,05 ¢/brief |
| Auth Supabase | email/password, **Confirm email DÉSACTIVÉ** (sinon quota email = 429) |

### Base de données (migrations `supabase/migrations/`, toutes appliquées)
- `001_schema.sql` — 15 tables : organizations, teams, seasons, profiles, memberships (rôles athlete/coach/admin + pseudonym P-xx pour le LLM), sessions, questionnaires (jsonb questions), team_questionnaires, responses, daily_metrics, rules (VIDE — ingénierie Gabin), flags, briefs, coach_feedback, llm_logs. UUID via `gen_random_uuid()`.
- `002_rls.sql` — RLS multi-tenant complet (athlète = ses données ; staff = son équipe ; fenêtre d'écriture réponse = fin de séance → +5 h).
- `003_engine.sql` — moteur en SQL : trigger readiness serveur (poids/inversions lus du questionnaire), vues `v_daily_scores` → `v_ema_baseline` (CTE récursive, EMA α=0,069, carry-forward) → `v_zones` (±15 %, min 3 pts) → `v_acwr` → `v_engine` ; `eval_rule()` (exécute `rules.condition_sql`) ; `v_ai_dataset` (anonymisé).
- `004_seed_rules_placeholder.sql` — squelette R-01→R-07, `enabled=false` partout.
- `005_security_views.sql` — `security_invoker` + revoke (fix Advisor).
- `006_seed_initial.sql` — org + équipe **Pilot Team** (`b0000000-…-01`, code invitation `CTP-PILOT`) + questionnaire `tpl-basketball-any` (V3, 6 sliders).
- `007_team_settings_rpc.sql` — `set_team_ics()` : le coach branche son calendrier depuis l'app.

### Edge functions (déployées)
- `compute-metrics` — déclenchée par **webhook DB** `on-response-submitted` (INSERT sur `responses`) : upsert `daily_metrics` depuis `v_engine`, évalue les `rules` `enabled=true` → `flags`.
- `morning-brief` — narration LLM (payload pseudonymisé scores+flags, système anti-invention), stocke `briefs` + coût dans `llm_logs`. **Cron pg_cron `morning-brief-daily` 11h UTC** (⚠ team_id en dur = Pilot Team → à rendre multi-équipes).
- `join-team` — adhésion par code invitation (profil + membership + pseudonym auto).
- `ics-sync` — calendrier ICS → `sessions` (RRULE DAILY/WEEKLY + EXDATE maison, fenêtre -30 j/+180 j). Cron `ics-sync-15min` à vérifier/créer.

## 4. Application (React Native 0.81 / Expo 54, web PWA)

Migration Firebase→Supabase **par flag** : `.env` → `EXPO_PUBLIC_USE_SUPABASE=1` (les chemins Firebase restent intacts derrière `if (USE_SUPABASE)`). Couche d'accès unique : `src/lib/ctpApi.ts` (+ `src/lib/supabase.ts`).

| Bloc | État | Fichiers clés |
|---|---|---|
| A Fondations | ✅ | `src/lib/ctpApi.ts`, `supabase/functions/join-team` |
| B Auth + routage rôle | ✅ | `screens/StitchLoginScreen.js`, `screens/StitchCreateAccountScreen.js` (fix course : `refreshSession()` après adhésion), `navigation/StitchNavigator.js` (AuthGate Supabase) |
| C Questionnaire → Postgres | ✅ testé bout en bout | `screens/StitchQuestionnaireScreen.js` (accès + submit Supabase) |
| D Écran coach | ✅ | `src/screens/CoachHomeSupabase.tsx` : brief + Useful/Noise + readiness roster + **Team setup** (code invitation + import calendrier ICS self-serve) |
| E1 Accueil athlète + sync ICS | ✅ code / **⚠ test sync ICS EN COURS** | `src/screens/AthleteHomeSupabase.tsx` (Sessions to rate + Respond), `supabase/functions/ics-sync` |

### Comptes de test existants
Athlète = P-01 (compte Gabin), Coach = P-02 (2ᵉ email, fenêtre privée). Équipe Pilot Team / code `CTP-PILOT`. 1 réponse réelle → 1 daily_metrics → 1 brief généré → 1 feedback `useful`.

## 5. ⚠ Problèmes ouverts (au moment du handover)
1. **Sync ICS retourne `upserted:0`** sur le calendrier Google de test (`errors:0`). Diagnostic en cours : réponse curl avec `ics_bytes` ajoutée — si ics_bytes minuscule → calendrier pas réellement public (fix : Google Calendar → rendre public, OU utiliser l'adresse SECRÈTE iCal). Dernier statut : en attente du retour utilisateur.
2. **TZID ignoré** dans le parseur ICS (heures traitées comme UTC → décalage si le calendrier est en heure locale). Fix prévu avec E2.
3. **Logout non branché** côté Supabase (les écrans Profile appellent le signOut Firebase). Contournement : fenêtre privée.
4. **Cron brief mono-équipe** (team_id en dur) → boucler sur les équipes actives.
5. **Firebase encore vivant** : FCM (tokens, service worker) + anciennes CF (sync ICS 15 min, notifications). Extinction = étape M8, seulement après E2.
6. Écrans non migrés (affichent du vide/du Firebase en mode Supabase) : Schedule, Profile, Analytics/PerformanceDashboard, Admin*, CoachTeam.

## 6. Prochains blocs (ordre recommandé)
1. **Finir E1** : résoudre le test sync ICS (voir §5.1).
2. **E2 Notifications** : cron minute serveur → détection fin de séance → push (choix à faire : garder FCM vs Web Push VAPID natif vs email Resend) + relances (vision Gabin : 20/40/60 min) + notification staff quand brief prêt.
3. **Console admin** (Gabin) : créer équipe/org, voir toutes les équipes, générer codes (aujourd'hui : SQL).
4. **Migrer Schedule + Profile + logout**, puis Analytics sur `daily_metrics`.
5. **Déploiement Vercel** du build web (`npm run web:build`, config `vercel.json` présente).
6. **Extinction Firebase** (M8) après run parallèle.
7. **Ingénierie des règles par Gabin** (doc 02) puis activation `enabled=true` et test sur données pilotes.
8. En parallèle permanent : **vente du pilote NCAA** (docs mémoire + leads).

## 7. Règles de collaboration avec Gabin (importantes pour tout agent)
- Français. Direct, pas de flatterie (voir instructions projet + Constitution art. 2).
- **UNE action à la fois** : il exécute vite mais relance parfois des commandes déjà réussies ; toujours donner l'étape suivante unique avec le résultat attendu.
- PowerShell (pas cmd) : `curl.exe`, `Remove-Item -Recurse -Force`.
- Il colle parfois des secrets dans le chat : le stopper, faire révoquer.
- Les règles d'interprétation sport science sont SA propriété : ne jamais inventer de seuil "définitif" — proposer avec source et statut DRAFT (doc 02).
- Décisions verrouillées : pas d'orchestrateur multi-agents LLM (Constitution art. 4/11 — les "agents" métier = modules déterministes du moteur de règles), pas de prédiction de blessure individuelle, pas de décision automatique sans coach.
