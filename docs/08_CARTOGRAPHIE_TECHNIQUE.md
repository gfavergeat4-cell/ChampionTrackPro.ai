# 08 — CARTOGRAPHIE TECHNIQUE · ChampionTrackPro V2

> **But de ce document.** Décrire l'application telle qu'elle EST, avec assez de précision pour qu'un agent ou un développeur qui n'a jamais vu ce dépôt puisse s'y orienter sans lire tout le code. Ce n'est ni une vision, ni une roadmap (voir `04` et `09`). Tout ce qui est écrit ici a été vérifié dans les fichiers à la date indiquée.
>
> **Dernière vérification : 31 juillet 2026** (post-lots L1/L2/L3/L4) — chemin audité : `C:\GAB\PRO\ChampionTrackPRO\APP\ChampionTrackPro-V2`
>
> **Règle de maintenance :** toute modification structurelle (écran ajouté/supprimé, table, edge function, changement de routage, bascule de backend) met à jour ce fichier DANS LE MÊME COMMIT. Un écart entre ce document et le code est un bug.

---

## 1. En une phrase

Application Expo/React Native déployée en PWA web, à trois rôles (athlète / coach / admin), qui collecte un auto-questionnaire post-séance, calcule des dérivés statistiques individuels côté serveur, applique des règles d'interprétation écrites par le fondateur, et restitue au coach un brief quotidien narré par un LLM.

## 2. Stack et versions exactes

| Couche | Technologie | Version |
|---|---|---|
| Framework | Expo | 54.0.20 |
| Runtime UI | React Native | 0.81.5 |
| React | react / react-dom | 19.1.0 |
| Cible web | react-native-web | ^0.21.0 |
| Navigation | @react-navigation (native-stack + bottom-tabs) | ^7.x |
| Langage | TypeScript (partiel — coexiste avec du JS) | ~5.9.2 |
| Backend cible | Supabase (Postgres + Auth + Edge Functions Deno) | @supabase/supabase-js ^2.49 |
| Backend hérité | Firebase (Auth + Firestore + Functions + FCM) | firebase ^10.14.1 |
| 3D | three | ^0.185.1 (usage vanilla) |
| Graphiques | recharts | ^3.7.0 |
| Typographies | @expo-google-fonts/marcellus + /inter | Marcellus 400, Inter 300/400/500/600 |
| Node (build) | engines.node | 24.x |

`@react-three/fiber` et `@react-three/drei` sont installés mais **non utilisés** (décision tracée au changelog : la scène 3D est écrite en Three.js vanilla).

## 3. Chaîne de démarrage

```
index.js                       registerRootComponent(App) ; init Firebase natif si Platform.OS !== "web"
  └─ App.js                    charge les polices (Marcellus, Inter) ; init FCM sur web à la connexion Firebase
       └─ navigation/StitchNavigator.js
            ├─ CourtScene              (web uniquement, fond 3D absolu, z:0, pointerEvents none)
            └─ NavigationContainer
                 └─ AuthGate           détermine {user, role} puis rend RootStackNavigator
                      └─ RootStackNavigator   aiguillage par rôle
```

`index.web.js` existe pour la cible web (déclaré dans `app.config.js`).

## 4. Le commutateur de backend — `USE_SUPABASE`

`src/lib/supabase.ts` :

```ts
export const USE_SUPABASE = process.env.EXPO_PUBLIC_USE_SUPABASE === "1";
export const supabase = USE_SUPABASE && url && anon ? createClient(url, anon) : null;
```

C'est **le seul interrupteur** de l'application. Il gouverne :

- `AuthGate` — deux implémentations complètes dans `StitchNavigator.js` : branche Supabase (lignes ~455-495) et branche Firebase (lignes ~500-590).
- Le choix de composant sur certains onglets (`USE_SUPABASE ? ProfileScreenSupabase : ProfileScreen`).
- Des branches internes dans `StitchLoginScreen`, `StitchCreateAccountScreen`, `StitchQuestionnaireScreen`, `AthleteHomeNew`, `ScheduleScreenNew`, `OnboardingNotifScreen`.

**Conséquence structurante :** tout écran qui n'a PAS de branche `USE_SUPABASE` et qui importe `firebase/firestore` lit une base vide quand le flag est à 1. Voir le tableau §7.

## 5. Arborescence commentée

```
ChampionTrackPro-V2/
├── index.js / index.web.js / App.js        point d'entrée + polices + FCM
├── app.config.js / app.json / eas.json     configuration Expo
├── babel.config.cjs / metro.config.js      bundler
├── package.json                            scripts + dépendances
├── vercel.json                             build web, rewrites SPA, CSP
├── CLAUDE.md                               document-mère (lois, backlog, environnement)
├── CONSTITUTION.md                         12 articles + amendements
├── GUIDE_ACTIONS_GABIN.md                  checklist manuelle du fondateur
├── README.md                               runbook migration M0-M8
│
├── docs/
│   ├── 01_ETAT_DU_PROJET_HANDOVER.md       état, comptes test, problèmes ouverts
│   ├── 02_MOTEUR_DE_REGLES_SPORT_SCIENCE.md ~20 règles DRAFT sourcées (établi de Gabin)
│   ├── 03_DIRECTION_ARTISTIQUE.md          DA v2 « Stadium at night »
│   ├── 04_VISION_PRODUIT_10_ANS.md         mission, workflow canonique, actes 1-5
│   ├── 05_PRESENTATION_PLATEFORME.md       support commercial
│   ├── 06_REDESIGN_COURTLIGHT.md           langage visuel propriétaire (fait autorité sur le 03)
│   ├── 07_CONTRAT_DE_PARITE.md             matrice ancien ↔ nouveau
│   ├── 08_CARTOGRAPHIE_TECHNIQUE.md        CE FICHIER
│   ├── 09_AUDIT_ET_ROADMAP.md              ce qui manque et dans quel ordre (lots L1-L7)
│   ├── CHANGELOG_IMPLEMENTATION.md         journal daté (à tenir à jour à chaque session)
│   └── prototype_courtlight.html           prototype visuel autonome (ouvrir dans Chrome)
│
├── navigation/StitchNavigator.js           ★ AuthGate + routage par rôle + deep links (≈680 l.)
│
├── screens/                                écrans historiques (JS, hérités de la V1)
│   ├── StitchLandingScreen.js              présentation avant connexion
│   ├── StitchLoginScreen.js                connexion — branche USE_SUPABASE
│   ├── StitchCreateAccountScreen.js        inscription + code d'équipe — branche USE_SUPABASE
│   ├── StitchQuestionnaireScreen.js        ★ check-in athlète (1409 l.) — branche USE_SUPABASE
│   ├── StitchHomeScreenClean.js            accueil hérité — Firebase seul (non routé)
│   ├── StitchScheduleScreen.js             planning hérité — Firebase seul (non routé)
│   ├── StitchProfileScreen.js              profil hérité — Firebase seul (routé si flag = 0)
│   ├── StitchTeamDetails.js                détail équipe hérité — Firebase seul
│   ├── DevEventsProbe.js                   outil de debug
│   └── DebugTestQuestionnaireScreen.js     outil de debug (routé dans tous les stacks)
│
├── src/
│   ├── lib/
│   │   ├── supabase.ts                     ★ client + flag USE_SUPABASE
│   │   ├── ctpApi.ts                       ★ COUCHE D'ACCÈS UNIQUE Supabase (§8)
│   │   ├── firebase.ts                     client Firebase (chemin hérité)
│   │   ├── scheduleQueries.ts              requêtes planning Firestore
│   │   ├── scheduleQueriesSupabase.ts      équivalent Supabase
│   │   ├── responses.ts / mapTraining.ts / resolveAthleteTeam.ts / teamContext.ts
│   │
│   ├── screens/                            écrans modernes (TSX)
│   │   ├── AthleteHome.js                  wrapper → stitch_components/AthleteHomeNew
│   │   ├── ScheduleScreenNewScreen.js      wrapper → stitch_components/ScheduleScreenNew
│   │   ├── AthleteHomeSupabase.tsx         ⚠ DÉBRANCHÉ (remplacé par parité, fichier conservé)
│   │   ├── ScheduleScreenSupabase.tsx      ⚠ DÉBRANCHÉ (idem)
│   │   ├── ProfileScreenSupabase.tsx       profil — actif si USE_SUPABASE
│   │   ├── OnboardingNotifScreen.tsx       activation push — rendu tant que l'appareil n'est pas abonné (§13.1)
│   │   ├── CoachHomeSupabase.tsx           ★ Morning Brief coach (Courtlight)
│   │   ├── CoachHomeScreen.tsx             version Firebase (fallback flag = 0)
│   │   ├── CoachTeamScreen.tsx             roster coach + compliance — ctpApi
│   │   ├── CoachScheduleScreen.tsx         planning coach (fenêtre ±60 j) — ctpApi
│   │   ├── CoachProfileScreen.tsx          ⚠ Firebase uniquement (fallback flag = 0)
│   │   ├── AthleteDetailScreen.tsx         fiche joueur — ctpApi (remapping §13.3)
│   │   ├── AdminHomeScreen.tsx             console admin — Supabase (ctpApi)
│   │   ├── AdminTeamDetailScreen.tsx       détail équipe admin — Supabase (ctpApi)
│   │   ├── AdminSystemHealthScreen.tsx     ★ console santé système (lecture seule)
│   ├── AdminTeamScreen.tsx             ⚠ route retirée (L4) — fichier conservé
│   │   ├── CreateTeamModal.tsx             ⚠ route retirée (L4) — Firestore, doublon
│   │   └── PerformanceDashboard.tsx        analytics (1591 l.) — Supabase (ctpApi)
│   │
│   ├── stitch_components/                  composants de parité issus de l'ancienne version
│   │   ├── AthleteHomeNew.tsx              ★ accueil athlète (1912 l.) — branche USE_SUPABASE
│   │   ├── ScheduleScreenNew.tsx           ★ planning athlète (2244 l.) — branche USE_SUPABASE
│   │   └── UnifiedAthleteNavigation.tsx    barre de navigation athlète
│   │
│   ├── components/                         BrandHeader · CardGraphite · ChampionTrackProLogo ·
│   │                                       CourtScene (3D) · DAR*Chart ×3 · GlassCard ·
│   │                                       MobileViewport · PWAInstallBanner · ReadinessHalo ·
│   │                                       SliderDivider · SplashScreen · StatusPill
│   ├── theme/tokens.ts                     exports `da` (DA v2) et `courtlight` (doc 06)
│   ├── services/                           fcmService · membership · notificationTest ·
│   │                                       vapidPush · webNotifications
│   ├── hooks/                              useDevice · useIsDesktop
│   └── utils/                              analytics · press · questionnaire ·
│                                           questionnaireTemplates (Firestore) · responsive ·
│                                           time · useDARAlgorithm
│
├── supabase/
│   ├── migrations/001→010                  schéma, RLS, moteur, seeds, RPC, push, santé (§9)
│   └── functions/                          edge functions Deno (§10)
│
├── functions/index.js                      anciennes Cloud Functions Firebase (encore actives)
├── services/firebaseConfig.js              config Firebase utilisée par App.js et le navigateur
├── firestore.rules / firestore.indexes.json
├── public/                                 manifest, icônes, ctp-sw.js (SW VAPID), firebase-messaging-sw.js
├── scripts/                                copy-service-worker · inject-metadata · verify-build ·
│                                           generate-og-image · migration/{export-firestore,transform-load}.mjs
├── dist/ et web/                           sorties de build (non versionnées)
└── nul                                     ⚠ artefact Windows parasite, à supprimer
```

## 6. Routage par rôle

`AuthGate` résout `{user, role}` puis `RootStackNavigator` normalise le rôle (`trim().toLowerCase()`) et rend l'un des quatre arbres :

| Rôle | Stack racine | Onglets |
|---|---|---|
| `admin` | `AdminMain` + AdminPerformanceDashboard, AdminTeamDetailScreen, TeamDetails, DevEventsProbe, Questionnaire | **AdminHome** · Health (AdminSystemHealthScreen) · Analytics (PerformanceDashboard) · Profile |
| `coach` | `CoachMain` + AthleteDetail, Questionnaire | **Home** (CoachHomeSupabase) · Team · Schedule · Analytics · Profile |
| `athlete` | `AthleteMain` + Questionnaire — précédé de `OnboardingNotifScreen` tant que l'appareil n'est pas abonné au push (§13.1) | **Home** (AthleteHomeNew) · Schedule (ScheduleScreenNew) · Profile — barre de tabs masquée |
| aucun | `Auth` | Landing · CreateAccount · Login |

**Deep links gérés** (`StitchNavigator`, effet au montage + polling 500 ms) :

- `/?screen=questionnaire&trainingId=<id>&teamId=<id>` → ouvre le check-in après authentification
- `/?sessionId=<id>&openQuestionnaire=1` → format hérité
- `/?code=XK7B2P-C` → code d'adhésion mis en attente puis consommé
- `/debug/test-questionnaire` → écran de debug

## 7. Écran → source de données → état réel

Vérifié par analyse des imports de chaque fichier.

| Écran | Fichier | Lignes | Source | État avec `USE_SUPABASE=1` |
|---|---|---:|---|---|
| Connexion | `screens/StitchLoginScreen.js` | 195 | Supabase (branche) | ✅ |
| Inscription | `screens/StitchCreateAccountScreen.js` | 601 | Supabase (branche) | ✅ |
| Check-in | `screens/StitchQuestionnaireScreen.js` | 1409 | Supabase (branche) | ✅ |
| Accueil athlète | `src/stitch_components/AthleteHomeNew.tsx` | 1912 | Supabase (branche) | ✅ |
| Planning athlète | `src/stitch_components/ScheduleScreenNew.tsx` | 2244 | Supabase (branche) | ✅ |
| Profil | `src/screens/ProfileScreenSupabase.tsx` | 623 | ctpApi | ✅ |
| Morning Brief coach | `src/screens/CoachHomeSupabase.tsx` | 554 | ctpApi | ✅ |
| Analytics | `src/screens/PerformanceDashboard.tsx` | 1591 | ctpApi | ✅ |
| Console admin | `src/screens/AdminHomeScreen.tsx` | 206 | ctpApi | ✅ |
| Détail équipe admin | `src/screens/AdminTeamDetailScreen.tsx` | 527 | ctpApi | ✅ |
| Équipe coach | `src/screens/CoachTeamScreen.tsx` | 278 | ctpApi | ✅ rebranché (L2) |
| Planning coach | `src/screens/CoachScheduleScreen.tsx` | 706 | ctpApi | ✅ rebranché (L2) |
| Fiche joueur | `src/screens/AthleteDetailScreen.tsx` | 562 | ctpApi | ✅ rebranché (L2) |
| Santé système | `src/screens/AdminSystemHealthScreen.tsx` | 284 | ctpApi | ✅ nouveau (L3) |
| Onboarding push | `src/screens/OnboardingNotifScreen.tsx` | ~290 | ctpApi (branche) | ✅ rendu tant que l'appareil n'est pas abonné (L1) |
| AdminTeamScreen | `src/screens/AdminTeamScreen.tsx` | 490 | ctpApi | ⚫ route retirée (L4) — fichier conservé |
| CreateTeamModal | `src/screens/CreateTeamModal.tsx` | 536 | Firestore | ⚫ route retirée (L4) — fichier conservé |
| AthleteHomeSupabase | `src/screens/AthleteHomeSupabase.tsx` | 331 | ctpApi | ⚫ débranché |
| ScheduleScreenSupabase | `src/screens/ScheduleScreenSupabase.tsx` | 859 | ctpApi | ⚫ débranché |

Légende : ✅ fonctionnel · ❌ cassé sous Supabase · ⚫ présent mais non atteint à l'exécution.

## 8. `src/lib/ctpApi.ts` — couche d'accès unique

**Règle d'architecture : aucun écran migré n'appelle Supabase directement. Tout passe par ce fichier.**

| Domaine | Fonctions exportées |
|---|---|
| Auth | `signUp` · `signIn` · `signOut` · `getSession` · `onAuthChange` |
| Équipe / rôle | `getMyMembership` · `joinTeam` · `setTeamCalendar` (RPC `set_team_ics`) · `triggerIcsSync` |
| Séances | `listSessions(teamId, fromISO, toISO)` |
| Questionnaire | `getTeamQuestionnaire` · `submitResponse` · `getMyResponseForSession` |
| Métriques | `getMyMetricsToday` · `getTeamMetrics(teamId, day)` · `getTeamMetricsRange(teamId, from, to)` |
| Brief | `getLatestBrief` · `sendCoachFeedback` |
| Push | `savePushSubscription` · `removePushSubscription` |
| Équipe | `getTeamMembers` (deux requêtes séparées — l'embed PostgREST échouait silencieusement) · `getTeamLatestSessionResponses` · `getResponsesForSessions` (par tranches de 200) |
| Fiche joueur | `getAthleteMetricsRange` · `getAthleteResponses` |
| Admin | `getAdminTeams` · `getTeamInfo` · `updateTeamInfo` · `removeMember` · `createTeam` (edge function) · `getAdminSystemHealth` (+ type `TeamHealth`) |
| Profil | `getMyProfile` · `updateMyProfile` |

## 9. Backend Supabase

Projet : `wiopzitygsgincztwquz` (US East). Auth email/mot de passe, **« Confirm email » désactivé** (le réactiver casse l'inscription — quota d'emails).

### 9.1 Tables (18)

`organizations` · `teams` · `seasons` · `profiles` · `memberships` · `sessions` · `questionnaires` · `team_questionnaires` · `responses` · `daily_metrics` · `rules` · `flags` · `briefs` · `coach_feedback` · `llm_logs` · `cycles` · `push_subscriptions` · `pending_reminders`

Points structurants :

- `memberships` : clé primaire `(team_id, user_id)`, `role ∈ {athlete, coach, admin}`, colonne `pseudonym` — **seul identifiant transmis au LLM**.
- `sessions` : unicité `(team_id, ics_uid, start_utc)` ; colonnes `planned_load`, `objective`, `group_label` (migration 008, encore non alimentées par l'UI).
- `responses` : unicité `(session_id, user_id)` ; `readiness_score` calculé **par trigger serveur**, plus jamais par le client.
- `rules` : `enabled` **défaut `false`**. Table vide de logique — propriété exclusive du fondateur.
- `daily_metrics` : clé `(user_id, day)` ; readiness, ema_28, deviation_pct, zone, z_score, mean_28, sd_28, acwr, data_days.

### 9.2 Vues (moteur de calcul)

Chaîne : `v_daily_scores` → `v_ema_baseline` → `v_zones` → (+ `v_acwr`) → **`v_engine`**.

- `v_daily_scores` — moyenne quotidienne par athlète, `is_test = false` exclu.
- `v_ema_baseline` — EMA 28 j, α = 0,0690 (2/29), calendrier continu avec carry-forward des jours manquants (CTE récursive). Expose `deviation_pct` et `data_days`.
- `v_zones` — `INSUFFICIENT_DATA` si `data_days < 3`, `YELLOW` si écart > +15 %, `BLUE` si < −15 %, sinon `GREEN`.
- `v_acwr` — aigu 7 j / chronique 28 j. **NULL tant que `workload_au` n'est pas alimenté** (la mesure de charge n'existe pas encore).
- `v_engine` — vue d'assemblage consommée par `compute-metrics` ; version 2 (migration 008) ajoute `mean_28`, `sd_28`, `z_score`. `security_invoker = true`, `select` révoqué pour `anon`/`authenticated`.
- `v_ai_dataset` — dataset anonymisé : pseudonyme + dérivés + règle déclenchée + action du coach.

### 9.3 Fonctions SQL

`my_teams()` · `my_role_in(team)` · `compute_readiness(metrics, questionnaire)` · `trg_responses_readiness()` (trigger) · `eval_rule(rule, user, day)` (security definer, révoquée pour les clients) · `set_team_ics(team, url)`.

### 9.4 RLS — isolation multi-tenant

Activée sur toutes les tables. Principes :

- Une équipe ne voit jamais les données d'une autre (`team_id in (select my_teams())`).
- L'athlète ne lit que ses propres `responses` et `daily_metrics`.
- Le staff (`coach`/`admin`) lit l'ensemble de son équipe.
- **Fenêtre d'écriture du check-in** : insertion autorisée uniquement entre `session.end_utc` et `end_utc + 5 heures`.
- `rules` et `llm_logs` : **aucune policy** = aucun accès client. Service role exclusivement.
- Toutes les écritures moteur (`daily_metrics`, `flags`, `briefs`, `sessions` ICS) passent par des edge functions en service-role.

### 9.5 Migrations

| Fichier | Contenu |
|---|---|
| `001_schema.sql` | 15 tables initiales |
| `002_rls.sql` | RLS + helpers `my_teams` / `my_role_in` |
| `003_engine.sql` | trigger readiness + 5 vues moteur + `eval_rule` |
| `004_seed_rules_placeholder.sql` | règles, toutes `enabled = false` |
| `005_security_views.sql` | `security_invoker` (correctif Advisor « Security Definer View ») |
| `006_seed_initial.sql` | org + « Pilot Team » (`CTP-PILOT`) + questionnaire `tpl-basketball-any` (6 métriques V3) |
| `007_team_settings_rpc.sql` | RPC `set_team_ics` |
| `008_engine_v2_planning.sql` | z-score, mean/sd 28 j, colonnes séance, table `cycles` |
| `009_push_notifications.sql` | `push_subscriptions` + `pending_reminders` |
| `010_admin_health_read.sql` | policies de **lecture seule** sur `llm_logs` et `pending_reminders` pour l'admin de l'équipe (console santé) |

## 10. Edge functions (Deno)

| Fonction | Déclencheur | Rôle |
|---|---|---|
| `compute-metrics` | webhook DB à l'INSERT sur `responses` | lit `v_engine`, upsert `daily_metrics`, évalue les règles `enabled=true`, upsert `flags`. **Zéro LLM.** |
| `morning-brief` | cron `0 11 * * *` (corps vide = toutes les équipes) | assemble le payload pseudonymisé, appelle le LLM, upsert `briefs` + `llm_logs`, push au staff |
| `session-watcher` | cron `* * * * *` | détecte les séances terminées, notifie les athlètes, crée et traite les relances, expire à 24 h |
| `notify` | appelée en interne | envoi Web Push à une liste d'utilisateurs. **Service-role only** (vérifie `role` dans le JWT) |
| `ics-sync` | cron + appel manuel | parse l'ICS (RRULE DAILY/WEEKLY, INTERVAL, BYDAY, UNTIL, COUNT, EXDATE, VTIMEZONE), upsert par lots de 200 |
| `join-team` | client (JWT utilisateur) | adhésion par code, crée `profiles` + `memberships` + pseudonyme auto |
| `create-team` | client (JWT admin) | crée organisation si besoin + équipe + code d'invitation + membership admin |
| `_shared/llm.ts` | — | unique point d'appel Anthropic ; `BRIEF_SYSTEM`, `MODELS` |
| `_shared/webpush.ts` | — | VAPID JWT ES256 (RFC 8292) + chiffrement ECE aes128gcm (RFC 8291), WebCrypto pur, zéro dépendance |

## 11. Automatisations serveur

| Nom | Type | Planification | Cible |
|---|---|---|---|
| `on-response-submitted` | webhook DB | INSERT sur `responses` | `compute-metrics` |
| `morning-brief-daily` | pg_cron | `0 11 * * *` (UTC) | `morning-brief` |
| `session-watcher-1min` | pg_cron | `* * * * *` | `session-watcher` |
| `ics-sync-15min` | pg_cron | toutes les 15 min | `ics-sync` |

## 12. La chaîne de bout en bout

```
Calendrier ICS du coach
   └─(ics-sync, 15 min)→ table sessions
        └─(session-watcher, 1 min : end_utc atteint)→ Web Push athlète
             └─ deep link → check-in (StitchQuestionnaireScreen)
                  └─ INSERT responses
                       ├─ trigger SQL → readiness_score
                       └─ webhook → compute-metrics
                            ├─ v_engine → daily_metrics
                            └─ rules (enabled) → flags
                                 └─(cron 11 h UTC)→ morning-brief
                                      ├─ payload pseudonymisé → LLM → briefs
                                      └─ Web Push staff « Morning Brief ready »
                                           └─ CoachHomeSupabase → Useful / Noise
                                                └─ coach_feedback (futur dataset)
```

Relances si absence de réponse : `pending_reminders`, trois tentatives.

## 13. Mécanismes non évidents, et anomalies restantes

### 13.1 Onboarding push — l'état n'est pas un booléen

Contre-intuitif et volontaire : sur le chemin Supabase, « l'onboarding est-il terminé ? » n'est **pas** lu dans une colonne. La question réellement posée est *« ce navigateur possède-t-il une souscription push valide ? »*, résolue au démarrage par `ensurePushSubscriptionSynced()` (`src/services/vapidPush.ts`), appelée depuis la branche Supabase de `AuthGate`.

- Cette fonction ne demande **jamais** de permission : elle lit `Notification.permission`, récupère la souscription du `PushManager` et la ré-`upsert` dans `push_subscriptions`. Elle **répare** donc silencieusement une ligne perdue.
- Elle est per-appareil, ce qui est le comportement correct : un endpoint push appartient à un navigateur, pas à un compte. Changer de téléphone redemande l'activation.
- Seul le renoncement explicite est mémorisé, en local : `localStorage["ctp_push_onboarding_skipped"]`. La porte de rattrapage vit dans l'écran Profil.
- Dans le profil, « Active » signifie **abonné**, pas « permission accordée ». L'état intermédiaire (permission accordée, souscription absente) est affiché et cliquable.

Le chemin Firebase conserve son booléen `users/{uid}.onboardingComplete` — inchangé.

### 13.2 Fenêtre bornée du planning coach

`CoachScheduleScreen` ne charge que **−60 j / +60 j**. La table `sessions` contient des milliers d'occurrences récurrentes issues de l'ICS ; tout charger fait tomber l'écran. Ne pas retirer cette borne sans pagination.

### 13.3 Contrat de forme dans la fiche joueur

`AthleteDetailScreen` a été rebranché sur Postgres mais son rendu consomme encore des champs camelCase et un `submittedAt` façon Timestamp Firestore (`{seconds}`, `toDate()`). Le chargement remappe donc les lignes Supabase vers ce contrat, plutôt que de réécrire 400 lignes d'affichage (loi de parité). Toute évolution du rendu doit tenir compte de ce remapping.

### 13.4 Anomalies restantes

1. **`AthleteHomeSupabase` et `ScheduleScreenSupabase` sont débranchés** au profit des composants de parité — 1 190 lignes conservées sans usage.
2. **`AdminTeamScreen` (490 l.) et `CreateTeamModal` (536 l.)** : routes retirées au lot L4, fichiers toujours présents. `CreateTeamModal` écrit sur Firestore alors qu'`AdminHomeScreen` crée les équipes via `ctpApi.createTeam`.
3. **Un fichier `nul`** traîne à la racine (artefact de redirection Windows).
4. **`dist/` et `web/`** coexistent comme sorties de build ; seul `web/dist` est déclaré dans `vercel.json`.
5. **Deux systèmes de questionnaire coexistent** : `src/utils/questionnaireTemplates.ts` (Firestore) et la table `questionnaires` (Postgres, seed `tpl-basketball-any`). Le questionnaire NCAA définitif est **gelé** par décision du fondateur.
6. **`AuthGate` contient une règle en dur** : un utilisateur sans document Firestore dont l'email vaut `gabfavergeat@gmail.com` se voit créer un compte `admin`. Chemin Firebase uniquement, à retirer en M8.
7. **`toMs()` dans `CoachScheduleScreen`** n'est plus utilisé depuis le rebranchement (les dates arrivent en ISO). Sans effet.
8. **Le moteur tourne à vide** : aucune ligne `rules.enabled = true`, donc `flags` reste vide et le brief demeure descriptif. Décision réservée au fondateur (Constitution art. 2).


## 14. Build et déploiement

```bash
npm run web:build
# = expo export --platform web --output-dir web/dist
#   + scripts/copy-service-worker.js   (copie ctp-sw.js et firebase-messaging-sw.js)
#   + scripts/inject-metadata.js
#   + scripts/verify-build.js          (exige index.html, firebase-messaging-sw.js, manifest.json)
```

- Sortie : `web/dist` · Rewrites : tout → `/index.html` (SPA) · CSP restrictive déclarée dans `vercel.json`.
- Projet Vercel lié : `champion-track-pro-ai` (`.vercel/repo.json`).
- Dépôt : `github.com/gfavergeat4-cell/ChampionTrackPro.ai`, branche `main`.
- ⚠ Ne jamais mettre `git rev-parse HEAD` dans le script de build : les déploiements par CLI n'ont pas de dossier `.git`.

**Ne pas confondre avec l'ancienne version en production** : dépôt `gfavergeat4-cell/ChampionTrackPro_`, dossier local `C:\GAB\PRO\ChampionTrackPRO\APP\ChampionTrackPro-LIVE`, projet Vercel `champion-track-pro`, domaine `champtrackpro.com`. C'est la référence de parité (doc 07), pas la cible de développement.

## 15. Environnement et secrets

Client (`.env`, préfixe `EXPO_PUBLIC_` = exposé au navigateur, donc jamais de secret) :

```
EXPO_PUBLIC_USE_SUPABASE       0 | 1
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_VAPID_PUBLIC_KEY
```

Serveur (`supabase secrets set`, jamais dans le dépôt) : `ANTHROPIC_API_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_PUBLIC_KEY` · `SUPABASE_SERVICE_ROLE_KEY` (injectée automatiquement).

Environnement de travail : Windows + **PowerShell 5** → pas de `&&` (une commande par ligne), `curl.exe` et non `curl`, `Remove-Item -Recurse -Force`. Dev : `npx expo start --web --clear` sur `localhost:8081`.

## 16. Comptes et données de test

Équipe « Pilot Team », `id = b0000000-0000-4000-8000-000000000001`, code `CTP-PILOT`, questionnaire `tpl-basketball-any`. Pseudonymes P-01 (athlète), P-02 (coach).

## 17. Test de santé de la chaîne

À exécuter après toute modification du moteur :

1. Insérer une séance test (`end_utc = now() − 2 min`).
2. Répondre en athlète (ou via `/?screen=questionnaire&trainingId=…&teamId=…`).
3. Vérifier `responses` +1 **et** `daily_metrics` +1 (le webhook fonctionne).
4. Appeler `morning-brief` → `briefs` contient un texte qui cite les chiffres.
5. Le coach voit le brief, clique « Useful » → `coach_feedback` +1.

Les cinq passent = la chaîne est vivante.
