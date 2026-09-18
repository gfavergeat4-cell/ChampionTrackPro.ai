# PROJECT_SOURCE_OF_TRUTH

**Version du contexte : 1.0.0 — audit du 15 août 2026.**
Convention de fiabilité : `CONFIRMED` / `INFERRED` / `UNKNOWN` / `TODO` / `CONFLICTING`.

---

## 1. PROJECT OVERVIEW

`CONFIRMED` — ChampionTrackPro est un système d'aide à la décision pour les staffs de basketball universitaire américain (NCAA). Les athlètes répondent à un auto-questionnaire de 60 secondes après chaque séance ; un moteur déterministe calcule des dérivés statistiques individuels ; des règles d'interprétation écrites par le fondateur produisent des signaux ; un LLM les narre au coach sous forme de brief quotidien.

Application Expo / React Native déployée en **PWA web**. Trois rôles : athlète, coach, admin.

Baseline de marque : *The Training Intelligence*.

## 2. PRODUCT VISION

`CONFIRMED` (doc `04_VISION_PRODUIT_10_ANS.md`) — Rendre visible ce qu'un coach ne peut pas voir depuis le bord du terrain : la charge réellement encaissée par chaque joueur, sur trois plans — physique, technique, mental.

**Produit, pas service.** Aucun humain de ChampionTrackPro dans la boucle quotidienne. Le fondateur règle le modèle et écrit les règles ; le système tourne seul.

**Le coach décide, toujours.** L'outil décrit, il ne prescrit pas.

## 3. BUSINESS OBJECTIVE

`CONFIRMED` — Vendre un abonnement B2B par équipe à des programmes NCAA (D1, D2, D3), principalement en basketball féminin à ce stade. Canal d'acquisition actuel : un podcast d'interviews de coachs, utilisé pour créer la relation avant toute proposition commerciale.

`CONFIRMED` — **Zéro client payant au 15 août 2026.** Le produit n'a jamais été utilisé par une équipe réelle.

`TODO` — Pricing non figé. Un montant de 8 500 $ apparaît dans des documents de vente, un pilote à 1 500-3 000 $ dans d'autres. À faire trancher.

## 4. TARGET USERS

| Rôle | Qui | Ce qu'il fait dans l'app | Fréquence |
|---|---|---|---|
| **Athlète** | joueur NCAA, 18-23 ans | check-in de 60 s après chaque séance ; consulte son propre état | quotidien |
| **Coach / staff** | head coach, assistants, performance staff | lit le brief du matin et le tableau d'équipe ; ouvre la fiche d'un joueur | quotidien, 90 s |
| **Admin** | le fondateur aujourd'hui ; le support plus tard | crée les équipes, gère les codes, surveille la santé du système | ponctuel |

## 5. CORE USER FLOWS

### 5.1 Flux athlète — quotidien

```
Notification push (fin de séance détectée)
        ↓  deep link /?screen=questionnaire&trainingId=…&teamId=…
Ouverture de l'app  →  AuthGate  →  [ConsentGate si documents non acceptés]
        ↓
QuestionnaireCourtlight  (résout le questionnaire par sessions.session_type)
        ↓  submitResponse()
INSERT responses
        ├─ trigger SQL responses_readiness       → readiness_score
        ├─ trigger SQL responses_readiness_load  → session_load, workload_au
        └─ webhook DB on-response-submitted      → edge compute-metrics
                                                        ├─ f_engine_user()  → daily_metrics
                                                        ├─ v_daily_axes     → sub_phy/tec/men/aca
                                                        └─ rules enabled    → flags   (aucune aujourd'hui)
```

**Déclencheur** : `session-watcher` (cron 1 min) détecte `end_utc` passé et `notified_at IS NULL`, fenêtre de rattrapage 3 h.
**Relances** : +3 h et +6 h après la fin de séance, table `pending_reminders`, trois textes escaladés.
**Fenêtre de réponse** : fin de séance → +8 h, appliquée **par la RLS**, pas par l'interface.
**Erreurs possibles** : pas de souscription push (l'athlète n'a jamais activé) ; fenêtre fermée ; réponse déjà soumise (contrainte unique `session_id, user_id`).

### 5.2 Flux coach — quotidien

```
Cron 11:00 UTC  →  edge morning-brief
        ├─ lit memberships (pseudonymes), daily_metrics 28 j, flags du jour
        ├─ payload PSEUDONYMISÉ → LLM Anthropic → briefs
        ├─ llm_logs (coût, tokens)
        └─ push « Morning Brief ready » au staff
                ↓
CoachHomeSupabase   → brief + roster + boutons Useful / Noise → coach_feedback
CoachBoard (onglet Team) → 3 marqueurs par athlète, distribution d'équipe
        ↓ clic sur un joueur
AthleteDetailScreen → historique, courbes
```

### 5.3 Flux admin

```
AdminHomeScreen → createTeam() → edge create-team
        ├─ crée l'organisation si absente
        ├─ crée l'équipe avec DEUX codes : XXXXXX-A (athlètes) / XXXXXX-C (staff)
        └─ inscrit le créateur comme admin
                ↓
AdminTeamDetailScreen → réglages, membres, bouton « Board »
AdminSystemHealthScreen (onglet Health) → briefs, compliance, coût LLM, relances
```

### 5.4 Flux d'adhésion

```
Inscription → saisie d'un code
        ↓ edge join-team
Le SERVEUR déduit le rôle du code présenté (-A → athlete, -C → coach).
Le champ `role` envoyé par le client est IGNORÉ.
Un membre déjà inscrit ne change jamais de rôle en re-présentant un code.
```

### 5.5 Flux calendrier

```
Le coach colle l'adresse iCal secrète de son calendrier d'équipe
        ↓ RPC set_team_ics()
teams.ics_url
        ↓ cron ics-sync (15 min) ou bouton « Sync Now »
Parsing RRULE (DAILY/WEEKLY, INTERVAL, BYDAY, UNTIL, COUNT, EXDATE) + VTIMEZONE
        ↓ upsert par lots de 200
sessions
```

## 6. CURRENT FEATURES

Voir `FEATURE_STATUS.md` pour la matrice complète et l'état de test réel.

## 7. PLANNED FEATURES

`CONFIRMED` (doc `09` lots L5-L7, doc `04`) — création de séance in-app avec charge prévue ; boucle de décision étendue (`acknowledged` / `overridden`) ; export hebdomadaire ; vue par cycles ; extinction de Firebase (étape M8) ; sélecteur d'équipe pour les utilisateurs multi-équipes.

## 8. NON-GOALS

`CONFIRMED` — Interdits par la Constitution, à ne jamais implémenter sans décision explicite du fondateur :

- prédiction de blessure individuelle ;
- décision automatique de repos ou de charge ;
- conseil médical ;
- promesse de résultat sportif ;
- orchestrateur multi-agents LLM ;
- comparaison des athlètes **entre eux** (voir §27).

## 9. TECH STACK

`CONFIRMED` — relevé dans `package.json` le 15/08/2026.

| Couche | Technologie | Version |
|---|---|---|
| Framework | Expo | 54.0.20 |
| Runtime UI | React Native | 0.81.5 |
| React | react / react-dom | 19.1.0 |
| Cible web | react-native-web | ^0.21.0 |
| Navigation | @react-navigation native-stack + bottom-tabs | ^7.x |
| Langage | TypeScript partiel (coexiste avec du JS) | ~5.9.2 |
| Backend cible | Supabase — Postgres, Auth, Edge Functions Deno, pg_cron | @supabase/supabase-js ^2.49 |
| Backend hérité | Firebase — Auth, Firestore, Functions, FCM | firebase ^10.14.1 |
| 3D | three (usage vanilla) | ^0.185.1 |
| Graphiques | recharts | ^3.7.0 |
| Polices | @expo-google-fonts/marcellus + /inter | Marcellus 400 ; Inter 300/400/500/600 |
| Node (build) | engines.node | 24.x |

`CONFIRMED` — `@react-three/fiber` et `@react-three/drei` sont installés mais **non utilisés** : la scène 3D est écrite en Three.js vanilla (décision tracée).

`CONFIRMED` — **Inter_700Bold n'est PAS chargé** alors que `fontWeight: 700` est utilisé ~59 fois → le navigateur synthétise un faux gras. Défaut visuel connu, voir `KNOWN_ISSUES.md`.

## 10. ARCHITECTURE

```
index.js  →  App.js  →  navigation/StitchNavigator.js
                              ├─ CourtScene (fond 3D, web uniquement, z:0)
                              └─ NavigationContainer
                                    └─ AuthGate      (deux implémentations : Supabase / Firebase)
                                          ├─ ConsentGate  (si documents actifs non acceptés)
                                          └─ RootStackNavigator  (aiguillage par rôle)
                                                ├─ admin   → AdminTabs
                                                ├─ coach   → CoachTabs
                                                ├─ athlete → AthleteTabs (précédé de OnboardingNotifScreen)
                                                └─ aucun   → AuthStack
```

**Le commutateur unique** : `src/lib/supabase.ts` exporte `USE_SUPABASE = process.env.EXPO_PUBLIC_USE_SUPABASE === "1"`. Il gouverne l'AuthGate, le choix de composant sur certains onglets, et des branches internes dans plusieurs écrans.

`CONFIRMED` — **Conséquence structurante** : tout écran sans branche `USE_SUPABASE` qui importe `firebase/firestore` lit une base vide quand le flag vaut 1.

## 11. DATABASE ARCHITECTURE

`CONFIRMED` — Supabase / PostgreSQL, projet `wiopzitygsgincztwquz` (US East). 19 migrations dans `supabase/migrations/`.

### 11.1 Tables (20)

| Table | Rôle | Clés et contraintes notables |
|---|---|---|
| `organizations` | tenant racine | |
| `teams` | équipe | `invite_code` unique (athlètes), `coach_code` unique (staff), `ics_url`, `timezone`, `pseudonym_seq` |
| `seasons` | saison | |
| `profiles` | extension applicative de `auth.users` | `display_name`, `email`, `fcm_tokens` — **pas** de jersey ni position |
| `memberships` | appartenance | PK `(team_id, user_id)` ; `role ∈ {athlete, coach, admin}` ; `jersey_number`, `position`, `pseudonym` |
| `sessions` | séance | unique `(team_id, ics_uid, start_utc)` **+ index partiel `uq_sessions_manual`** sur `(team_id, start_utc, title) where ics_uid is null` ; `planned_load`, `objective`, `group_label`, `notified_at` |
| `questionnaires` | modèle de questionnaire | `id` texte ; `questions` JSONB ; `session_type` |
| `team_questionnaires` | liaison équipe ↔ questionnaires | plusieurs par équipe |
| `responses` | réponse d'un athlète | unique `(session_id, user_id)` ; `readiness_score`, `session_load`, `workload_au` **calculés par trigger** ; `friction_*`, `worry_*` |
| `daily_metrics` | métriques historisées | PK `(user_id, day)` ; readiness, ema_28, deviation_pct, zone, z_score, mean_28, sd_28, acwr, sub_phy/tec/men/aca, data_days |
| `rules` | **règles d'interprétation — propriété du fondateur** | `enabled` défaut `false` ; `condition_sql` évalué par `eval_rule()` |
| `flags` | signal levé par une règle | unique `(user_id, rule_id, day)` |
| `briefs` | sortie LLM | unique `(team_id, brief_date)` ; stocke le `payload` exact envoyé au LLM |
| `coach_feedback` | retour du coach | **dataset futur — ne jamais purger** |
| `llm_logs` | coût et audit LLM | |
| `cycles` | micro/mésocycles | créée, **lue par personne** |
| `push_subscriptions` | Web Push VAPID | unique `(user_id, endpoint)` |
| `pending_reminders` | relances programmées | unique `(session_id, user_id, attempt)` |
| `legal_documents` | textes et versions | `status ∈ {draft, active, retired}` |
| `user_consents` | preuve d'acceptation | PK `(user_id, doc_key, version)` — **immuable, pas de policy UPDATE/DELETE** |

### 11.2 Vues (14)

**Moteur global** : `v_daily_scores` → `v_ema_baseline` → `v_zones` → (+ `v_acwr`) → **`v_engine`**.
**Moteur par axe** (migration 014) : `v_response_axes` → `v_axis_daily` → `v_axis_baseline` → `v_axis_zones` → **`v_coach_board`**.
**Autres** : `v_daily_axes`, `v_specificity`, `v_ai_dataset`, `v_my_pending_consents`.

### 11.3 Fonctions SQL (13)

`my_teams` · `my_role_in` · `compute_readiness` · `trg_responses_readiness` · `trg_responses_load` · `eval_rule` · `set_team_ics` · `next_pseudonym` · `purge_athlete` · `purge_team` · `export_athlete` · `check_questionnaire_weights` · **`f_engine_user`**.

`CONFIRMED` — **`f_engine_user` remplace `v_engine` partout où l'on traite un seul athlète.** PostgreSQL ne pousse pas un prédicat dans une `WITH RECURSIVE` : interroger `v_engine` pour un athlète recalculait toute la base. Non-régression vérifiée le 15/08 : **zéro écart**.

### 11.4 Le calcul, en clair

```
readiness_score = somme pondérée des items du questionnaire (trigger, jamais côté client)
                  val inversée = 101 - val ; clamp 1-100
ema_28          = EMA alpha = 2/29 ≈ 0,0690, calendrier continu, carry-forward des jours vides
deviation_pct   = (readiness - ema) / ema × 100
zone            = INSUFFICIENT_DATA si data_days < 3 ; YELLOW si dev > +15 % ; BLUE si < -15 % ; sinon GREEN
session_load    = readiness_score / 10           (uniquement si le questionnaire porte des items role="cost")
workload_au     = session_load × durée réelle de la séance
acwr            = moyenne 7 j / moyenne 28 j de workload_au
sub_phy/tec/men = moyennes par axe, inversions appliquées côté serveur
zone par axe    = ±10 POINTS autour de la MME de cet axe   ← voir CONFLICTING §25
```

## 12. AUTHENTICATION

`CONFIRMED` — Supabase Auth, email + mot de passe.

`CONFIRMED` — **« Confirm email » est DÉSACTIVÉ** dans le tableau de bord Supabase. Raison historique : l'activer avait cassé l'inscription (quota d'emails du plan). **Conséquence de sécurité : n'importe qui peut s'inscrire avec l'adresse d'un tiers.** À corriger avant tout client réel.

`CONFIRMED` — Le rôle vient de `memberships.role`, résolu par `getMyMembership()`. `AuthGate` normalise (`trim().toLowerCase()`).

`CONFIRMED` — `getMyMembership()` fait un `limit(1)` **sans tri** : un utilisateur membre de plusieurs équipes obtient une équipe non déterministe à chaque chargement. Limite connue, sans impact tant qu'une seule équipe existe.

`CONFIRMED` — Chemin Firebase : `AuthGate` contient une règle en dur créant un compte `admin` pour l'email `gabfavergeat@gmail.com` s'il n'a pas de document Firestore. À retirer en M8.

## 13. PERMISSIONS

`CONFIRMED` — RLS activée sur toutes les tables. Helpers `my_teams()` et `my_role_in(team)`.

| Donnée | anon | athlete | coach / admin | service_role |
|---|---|---|---|---|
| `teams`, `sessions`, `seasons` | — | lecture (ses équipes) | lecture | tout |
| `teams` UPDATE | — | — | **admin uniquement** | tout |
| `memberships` | — | lecture équipe | lecture ; **DELETE coach/admin** | tout |
| `responses` | — | **écrit et lit les siennes** | lit toute l'équipe | tout |
| `daily_metrics`, `flags`, `briefs` | — | les siennes (`daily_metrics`) | toute l'équipe | tout |
| `coach_feedback` | — | — | **SELECT + INSERT seulement** | tout |
| `rules`, `llm_logs` | — | — | `llm_logs` : lecture admin (migration 010) | tout |
| `push_subscriptions` | — | les siennes (S/I/U/D) | — | tout |
| `pending_reminders` | — | — | lecture admin | tout |
| `legal_documents` | **lecture** | lecture | lecture | tout |
| `user_consents` | — | les siens (S/I) ; **jamais U/D** | lecture admin de son équipe | tout |
| Vues moteur | — | via `security_invoker` | idem | tout |

`CONFIRMED` — **Fenêtre d'écriture du check-in appliquée en base** : `now() >= end_utc AND now() <= end_utc + 8 heures`. Ce n'est pas une règle d'interface, elle ne se contourne pas côté client.

## 14. FRONTEND ARCHITECTURE

Voir `PROJECT_INVENTORY.md` pour le détail fichier par fichier.

`CONFIRMED` — **`src/lib/ctpApi.ts` est la couche d'accès unique à Supabase.** Aucun écran migré n'appelle Supabase directement. Toute reprise passe par ce fichier.

`CONFIRMED` — Deux langages visuels coexistent (`CONFLICTING`, voir §26) : le parcours athlète et le check-in d'un côté, les écrans coach/admin Courtlight de l'autre.

## 15. BACKEND ARCHITECTURE

`CONFIRMED` — 8 edge functions Deno + un dossier `_shared`.

| Fonction | Déclencheur | Rôle | Garde |
|---|---|---|---|
| `compute-metrics` | webhook DB sur INSERT `responses` | `f_engine_user` → `daily_metrics` ; évalue les règles activées | service_role |
| `morning-brief` | cron `0 11 * * *` | payload pseudonymisé → LLM → `briefs` + `llm_logs` + push staff | service_role |
| `session-watcher` | cron `* * * * *` | détecte les séances terminées (rattrapage 3 h), notifie, crée et traite les relances | service_role |
| `notify` | interne | envoi Web Push à une liste d'utilisateurs | service_role |
| `ics-sync` | cron 15 min + bouton coach | parse l'ICS, upsert par lots de 200 | service_role → toutes équipes ; coach/admin → **ses équipes seulement** |
| `join-team` | client (JWT) | adhésion ; **le serveur déduit le rôle du code** | JWT utilisateur |
| `create-team` | client (JWT) | crée org + équipe + 2 codes + membership admin | JWT utilisateur |
| `admin-purge` | client (JWT) | `purge_athlete` / `purge_team` / `export_athlete` | **admin de l'équipe visée**, vérifié serveur |
| `_shared/llm.ts` | — | unique point d'appel Anthropic | — |
| `_shared/webpush.ts` | — | VAPID JWT ES256 + chiffrement ECE aes128gcm, WebCrypto pur, zéro dépendance | — |

### Automatisations

| Nom | Type | Planification | Cible | Fiabilité |
|---|---|---|---|---|
| `on-response-submitted` | webhook DB | INSERT `responses` | `compute-metrics` | `CONFIRMED` |
| `morning-brief-daily` | pg_cron | `0 11 * * *` UTC | `morning-brief` | `CONFIRMED` |
| `session-watcher-1min` | pg_cron | `* * * * *` | `session-watcher` | `CONFIRMED` |
| `ics-sync-15min` | pg_cron | toutes les 15 min | `ics-sync` | `INFERRED` — documenté, **existence en production non revérifiée** |

## 16. API / SERVICES

`CONFIRMED` — Surface publique de `src/lib/ctpApi.ts` :

**Auth** `signUp` `signIn` `signOut` `getSession` `onAuthChange`
**Équipe** `getMyMembership` `joinTeam(code, displayName)` `setTeamCalendar` `triggerIcsSync` `getTeamMembers` `getTeamLatestSessionResponses` `getResponsesForSessions`
**Séances** `listSessions` `getSessionById`
**Questionnaire** `getTeamQuestionnaire` `getQuestionnaireForSession(teamId, sessionType)` `submitResponse` `getMyResponseForSession`
**Métriques** `getMyMetricsToday` `getTeamMetrics` `getTeamMetricsRange` `getAthleteMetricsRange` `getAthleteResponses`
**Lecture coach DAR** `getCoachBoard(teamId, day)` `getAxisHistory(userId, axis, days)` (+ types `AthleteBoardRow`, `AxisReading`, `Axis`, `Zone`)
**Brief** `getLatestBrief` `sendCoachFeedback`
**Push** `savePushSubscription` `removePushSubscription`
**Consentements** `getPendingConsents` `acceptConsents` `getLegalDocuments`
**Admin** `getAdminTeams` `getTeamInfo` `updateTeamInfo` `removeMember` `createTeam` `getAdminSystemHealth` `purgeAthlete` `purgeTeam` `exportAthlete`
**Profil** `getMyProfile` `updateMyProfile`

`CONFIRMED` — `removeMember` **retire de l'équipe sans effacer les données**. `purgeAthlete` **efface**. La confusion entre les deux était un défaut de conformité corrigé le 15/08.

## 17. NOTIFICATIONS

`CONFIRMED` — **Web Push natif VAPID. Pas FCM** sur le chemin Supabase (décision fondateur, voir `ARCHITECTURE_DECISIONS.md`).

- Service worker : `public/ctp-sw.js`, copié dans le build par `scripts/copy-service-worker.js`.
- Souscription : `src/services/vapidPush.ts` → `registerVapidPush()` (geste utilisateur requis).
- Resynchronisation silencieuse au démarrage : `ensurePushSubscriptionSynced()` — ne demande jamais de permission, répare une ligne `push_subscriptions` perdue.
- **L'état d'onboarding n'est PAS un booléen.** La question posée est « ce navigateur possède-t-il une souscription valide ? ». Un booléen serveur mentirait au changement d'appareil. Seul le renoncement explicite est mémorisé, en local (`ctp_push_onboarding_skipped`).
- Copywriting des relances : textes exacts repris de l'ancienne version (parité).

`CONFIRMED` — Testé et **reçu sur un vrai appareil le 15/08/2026**.
`UNKNOWN` — Comportement sur **iOS** non testé. iOS exige que la PWA soit ajoutée à l'écran d'accueil avant d'autoriser le push. C'est potentiellement la moitié d'un roster.

## 18. CALENDAR

`CONFIRMED` — Import iCal par équipe. Parser maison, zéro dépendance externe : RRULE `DAILY`/`WEEKLY`, `INTERVAL`, `BYDAY`, `UNTIL`, `COUNT`, `EXDATE`, et fuseaux via les blocs `VTIMEZONE`.

`CONFIRMED` — Il faut l'**adresse iCal secrète** de Google Calendar. L'URL publique renvoie 429 depuis une IP de datacenter.

`CONFIRMED` — Une séance **retirée du calendrier n'est jamais annulée** côté base. Bug ouvert.

## 19. DEPLOYMENT

| | V2 (cible de développement) | LIVE (ancienne, en production) |
|---|---|---|
| Dossier | `APP/ChampionTrackPro-V2` | `APP/ChampionTrackPro-LIVE` |
| Dépôt | `gfavergeat4-cell/ChampionTrackPro.ai` | `gfavergeat4-cell/ChampionTrackPro_` (**public**) |
| Branche | `main` | `main` |
| Projet Vercel | `champion-track-pro-ai` | `champion-track-pro` |
| Domaine | `UNKNOWN` — URL Vercel par défaut | `champtrackpro.com` + 4 domaines |
| Backend | Supabase | Firebase / Firestore |

**Build** : `npm run web:build` → `expo export --platform web --output-dir web/dist` puis trois scripts : `copy-service-worker.js`, `inject-metadata.js`, `verify-build.js`. Sortie attendue : `[VERIFY] BUILD VERIFICATION PASSED`.

`CONFIRMED` — Ne **jamais** remettre `git rev-parse HEAD` dans le script de build : les déploiements par CLI n'ont pas de dossier `.git`.

`CONFIRMED` — `vercel.json` : rewrites SPA `/(.*) → /index.html`, CSP restrictive, sortie `web/dist`.

## 20. ENVIRONMENT VARIABLES

**Aucun secret n'est reproduit ici.** Les variables `EXPO_PUBLIC_*` sont exposées au navigateur par construction : n'y mets jamais un secret.

| Nom | Rôle | Requis | Environnements | Utilisée dans |
|---|---|---|---|---|
| `EXPO_PUBLIC_USE_SUPABASE` | interrupteur de backend (`1` = Supabase) | oui | local, Vercel | `src/lib/supabase.ts` |
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet | oui | local, Vercel | client + appels edge |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clé anonyme (publique par nature) | oui | local, Vercel | client Supabase |
| `EXPO_PUBLIC_VAPID_PUBLIC_KEY` | clé publique Web Push | oui | local, Vercel | `src/services/vapidPush.ts` |
| `ANTHROPIC_API_KEY` | **secret** | oui | `supabase secrets` uniquement | `_shared/llm.ts` |
| `VAPID_PRIVATE_KEY` | **secret** | oui | `supabase secrets` | `_shared/webpush.ts` |
| `VAPID_PUBLIC_KEY` | pendant serveur de la clé publique | oui | `supabase secrets` | `_shared/webpush.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | oui | injecté automatiquement | toutes les edge functions |

`CONFIRMED` — Les variables `EXPO_PUBLIC_*` sont **figées à la compilation**. Les modifier dans Vercel sans reconstruire ne change rien.

`CONFIRMED` — `EXPO_PUBLIC_FCM_VAPID_KEY` et `NEXT_PUBLIC_FCM_VAPID_KEY` sont référencées dans le code (chemin Firebase) mais absentes de `.env`. Vestiges.

## 21. SECURITY

Voir `docs/12_CONFORMITE_US.md` et `docs/14_DURCISSEMENT_SECURITE.md`.

**Fermé le 15/08/2026** : rôle décidé par le serveur ; gardes d'appelant sur les edge functions ; fuite de `diag` dans `ics-sync` ; policies manquantes sur `teams` et `memberships` ; `coach_feedback` en lecture-insertion ; `birth_year` retiré du dataset IA ; pseudonymes non réutilisables ; suppression et export réels.

**Ouvert** : confirmation d'email désactivée ; aucun journal d'accès aux données d'athlète ; pas de MFA staff ; pas d'expiration de session ; pas de politique de rétention exécutée ; boîte `privacy@championtrackpro.com` **inexistante alors que trois documents la citent**.

`CONFIRMED` — Le payload envoyé au LLM est **réellement pseudonymisé** (vérifié ligne à ligne) : pseudonyme `P-xx`, jamais de nom. C'est un argument commercial solide.

`CONFIRMED` — Ne **jamais** affirmer « zéro rétention » sur l'API LLM : la rétention par défaut d'Anthropic est de 30 jours et un accord *Zero Data Retention* se contracte. Le commentaire qui l'affirmait a été corrigé.

## 22-24. BUGS, HISTORIQUE, APPROCHES ÉCHOUÉES

→ `KNOWN_ISSUES.md`. **Lis-le avant toute correction** : plusieurs solutions ont déjà été tentées et ont échoué.

## 25. IMPORTANT TECHNICAL DECISIONS

→ `ARCHITECTURE_DECISIONS.md`.

`CONFLICTING` — **Deux seuils de zone coexistent volontairement.** Le moteur global utilise ±15 % (`v_zones`, migration 003) ; le moteur par axe utilise ±10 points (`v_axis_zones`, migration 014, conforme à la méthode DAR de Morin). Ils coïncident autour d'une baseline de 65 et divergent ailleurs. **Décision du fondateur en attente.** Ne pas trancher seul.

## 26. UX/UI RULES

`CONFIRMED` (doc `06_REDESIGN_COURTLIGHT.md`, fait autorité sur le `03`) :

- Zones **GREEN / BLUE / YELLOW sacrées** — jamais décoratives, jamais réattribuées.
- Jamais d'information portée par la couleur seule.
- **Un seul élément lumineux par écran** : le glow est une hiérarchie, pas un ornement.
- Un score n'est **jamais seul** : toujours accompagné de sa baseline, sa tendance ou son delta.
- Cibles tactiles ≥ 44 pt, contraste AA, animations ≤ 700 ms.
- Budgets de temps : athlète ≤ 60 s, coach ≤ 90 s.
- **Aucun chiffre affiché à l'athlète** sur les curseurs : ancres sémantiques seules. Un athlète qui voit « 73 » se compare à son coéquipier.
- Typographie : Marcellus pour l'identité, Inter pour l'interface. Cinzel et Rajdhani ont été **retirées** le 8 juillet 2026.
- Le curseur du check-in **EST l'emblème de marque** — géométrie et dégradés relevés sur le logo officiel.

`CONFLICTING` — Deux palettes coexistent : parcours athlète (`#0A0F1A`, cartes en verre, accent `#00E0FF`) et écrans coach/admin (Courtlight, `#070B14`, cartes graphite, accent `#00D4FF`). Écart d'un demi-ton sur le cyan. Décision en attente, voir `docs/10_SYSTEME_VISUEL.md` §6 étape 2.

## 27. BUSINESS RULES

`CONFIRMED` — Règles issues de la méthode DAR (Stéphane Morin) et de la Constitution. **Elles ont priorité sur le confort d'implémentation.**

**Qui voit quoi.**
- L'athlète voit **ses** réponses et **ses** métriques. Jamais celles d'un coéquipier.
- Le staff voit toute son équipe, réponses nominatives comprises. C'est pour cela que le code staff ne doit jamais circuler dans le roster.
- Une équipe ne voit **jamais** les données d'une autre.
- Le LLM ne reçoit que des pseudonymes et des dérivés — jamais un nom.

**Comment on lit une donnée.**
- Chaque athlète est comparé **à lui-même**, à sa propre moyenne mobile. Jamais à un coéquipier.
- Morin : *« toute tentative de normalisation interindividuelle constitue une erreur méthodologique »*. L'équipe se lit en **distribution** (combien dans chaque zone), pas en moyenne.
- On lit **la couleur ET la courbe** — jamais la couleur seule.
- Le bleu n'est pas une bonne nouvelle par défaut : il peut signaler une récupération réussie ou un désengagement silencieux.
- Le critère décisif est **temporel** : un jour atypique est du bruit, trois jours de suite sont un signal.

**Ce que le produit ne dit jamais.**
- Il ne recommande pas. Il ne décide pas qui joue. Il ne prédit pas.
- Le bloc douleur n'entre dans aucun score et remonte tel quel au staff.

**Consentement et données.**
- Exercer un droit (accès, suppression) ne peut jamais affecter la place d'un joueur dans l'équipe.
- Un consentement est un fait daté : la table est immuable.

## 28. CURRENT STATE

`CONFIRMED` au 15 août 2026, fin de journée.

**Vérifié en exécution réelle** : notification push reçue sur appareil · `session_load` et `workload_au` calculés pour la première fois · ACWR vivant (1,28 sur l'athlète en surcharge simulée) · tableau coach multi-marqueurs peuplé sur 15 athlètes et 2 mois d'historique · porte de consentement active, acceptations horodatées · **moteur par athlète validé à zéro écart** contre l'ancien calcul.

**Non vérifié** : iOS · plusieurs équipes simultanées · relances déclenchées à +3 h/+6 h en conditions réelles · un vrai athlète, un vrai coach.

**Zéro client. Zéro pilote. Zéro règle d'interprétation active.**

## 29. REMAINING WORK

Par ordre de valeur décroissante, `docs/09` §12 pour le détail.

1. **Activer trois à cinq règles d'interprétation** (`docs/02`) — décision fondateur, une heure. Sans elles le brief décrit sans dire ce qui compte.
2. Relecture juridique des trois textes ; créer `privacy@championtrackpro.com`.
3. Réactiver la confirmation d'email ; journal d'accès ; MFA staff.
4. Performance : `morning-brief` en série, `ics-sync` en série, `getAdminSystemHealth` en 8N+1, bucket journalier en UTC alors que `teams.timezone` existe et n'est jamais lu.
5. Décisions visuelles (§26) et seuil de zones (§25).
6. Sélecteur d'équipe pour les comptes multi-équipes.
7. M8 : extinction de Firebase.

## 30. PRIORITY ROADMAP

| Lot | Contenu | Critère de sortie | État |
|---|---|---|---|
| L1 | Chaîne de notifications | notification + relance reçues sur un vrai appareil | ✅ 15/08 |
| L2 | Écrans coach sur `ctpApi` | depuis le brief, ouvrir la fiche d'un joueur | ✅ 15/08 |
| L3 | Console santé admin | répondre à « le brief d'hier est-il parti ? » sans SQL | ✅ 15/08 |
| L4 | Nettoyage navigation admin | chaque onglet mène à un écran distinct | ✅ 15/08 |
| L5 | Création de séance in-app (`planned_load`) | `acwr` cesse d'être nul sur données réelles | ⬜ |
| L6 | Boucle de décision étendue + export | le coach trace ce qu'il fait d'un signal | ⬜ |
| L7 | M8 — extinction Firebase | aucune référence `firebase/*` dans le graphe actif | ⬜ |

**Hors séquence et prioritaire sur tout** : l'activation des premières règles.

## 31. TESTING

`CONFIRMED` — **Il n'y a aucun test automatisé.** `App.test.js` existe mais est un vestige. Aucun runner configuré.

La vérification se fait par un **test de santé de la chaîne**, à exécuter après tout changement du moteur :

1. Insérer une séance test avec `end_utc = now() - 2 minutes`.
2. Répondre en athlète (ou via `/?screen=questionnaire&trainingId=…&teamId=…`).
3. Vérifier `responses` +1 **et** `daily_metrics` +1 → le webhook fonctionne.
4. Appeler `morning-brief` → `briefs` contient un texte qui cite les chiffres.
5. Le coach voit le brief, clique « Useful » → `coach_feedback` +1.

Les cinq passent = la chaîne est vivante.

**Vérification statique utilisée pendant le développement** (à reprendre) : parsing Babel des fichiers touchés, puis résolution complète du graphe d'imports depuis `index.js` — 77 fichiers locaux, zéro import cassé au 15/08.

## 32. VALIDATION CHECKLIST

Avant tout déploiement :

- [ ] `npm run web:build` finit sur `[VERIFY] BUILD VERIFICATION PASSED`
- [ ] Graphe d'imports : zéro import cassé
- [ ] Aucun secret ajouté au dépôt
- [ ] Migration SQL appliquée **et** requête de non-régression passée si le moteur est touché
- [ ] Edge functions redéployées si modifiées
- [ ] `DO_NOT_BREAK.md` relu
- [ ] Entrée datée ajoutée à `docs/CHANGELOG_IMPLEMENTATION.md`

## 33. HANDOFF NOTES

- Le `CHANGELOG_IMPLEMENTATION.md` est tenu à jour **à chaque session** et contient le raisonnement derrière chaque bloc de travail. C'est la meilleure source pour comprendre « pourquoi ce code est comme ça ».
- Les migrations SQL sont **nommées sans horodatage** : `supabase db push` ne les détecte pas. Elles ont toutes été appliquées **manuellement** via le SQL editor. Continue ainsi, ou renomme-les — mais alors vérifie l'historique de migration distant avant.
- L'éditeur SQL de Supabase exécute tout le script **dans une transaction** : une erreur en fin de script annule tout ce qui précède. Vérifie toujours le résultat, ne suppose pas.
- Ne pas écrire de gros fichiers de code via un montage réseau : une troncature silencieuse a déjà eu lieu. Vérifier le nombre de lignes et l'équilibre des accolades après écriture.

## 34. OPEN QUESTIONS

| # | Question | Qui tranche | Bloque |
|---|---|---|---|
| 1 | Quelles règles d'interprétation activer, avec quels seuils ? | fondateur | la valeur du produit |
| 2 | Zones : ±10 points (DAR) ou ±15 % (moteur global) ? | fondateur | cohérence du moteur |
| 3 | Le coach voit-il une moyenne d'équipe ou une distribution ? | fondateur | `CoachHomeSupabase` contredit `CoachBoard` |
| 4 | Cyan de marque : `#00D4FF` (code) ou `#00C2FD` (logo) ? | fondateur | harmonisation visuelle |
| 5 | Le questionnaire NCAA est-il validé dans sa formulation ? | fondateur | bascule définitive |
| 6 | Pricing et durée d'abonnement | fondateur | CGU §8bis |
| 7 | Les textes juridiques sont `active` mais portent « Draft » — relecture avocat ? | fondateur | exposition juridique |
| 8 | `ics-sync-15min` existe-t-il réellement en production ? | à vérifier | fiabilité du calendrier |
| 9 | Comportement push sur iOS | à tester | la moitié d'un roster |

## 35. DO NOT BREAK LIST

→ `DO_NOT_BREAK.md`. Résumé : l'authentification, la RLS, la chaîne de notifications, le moteur de calcul, `coach_feedback`, les chemins Firebase, la parité avec l'ancienne version, et la table `rules` qui n'appartient qu'au fondateur.
