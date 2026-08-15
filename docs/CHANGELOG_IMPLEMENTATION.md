# CHANGELOG — Implémentation des documents fondateurs
**Mis à jour en temps réel à chaque modification. Réf : docs 01-04 + Constitution.**

## Session du 16 juillet 2026 — PARITÉ ATHLÈTE (A1-A5)

### A1-A2 — Rebranchement écrans athlète validés sur Supabase
- Diff confirmé : les 5 fichiers athlète (AthleteHome.js, AthleteHomeNew.tsx, ScheduleScreenNewScreen.js, ScheduleScreenNew.tsx, UnifiedAthleteNavigation.tsx) sont IDENTIQUES entre ancien repo et V2.
- `scheduleQueriesSupabase.ts` : nouveau module — miroir API de `scheduleQueries.ts` (getUpcomingTrainings, getEventsForDay/Week/Month, getNextSession) lisant `sessions` + `responses` Supabase au lieu de Firebase Firestore. Même type de retour `EventWithResponse`.
- `AthleteHomeNew.tsx` : ajout branche `if (USE_SUPABASE)` dans le useEffect de chargement data UNIQUEMENT. Zéro changement JSX/layout/style. Auth Supabase → getMyProfile/getMyMembership → getUpcomingTrainingsSupabase → même format formattedEvents.
- `ScheduleScreenNew.tsx` : même approche — branche `if (USE_SUPABASE)` dans loadEvents, appels getEventsForDay/Week/MonthSupabase. Zéro changement JSX.

### A3 — Navigator rebranché
- `StitchNavigator.js` AthleteTabs : Home = AthleteHome (ancien validé, USE_SUPABASE branché en interne), Schedule = ScheduleScreenNewScreen (ancien validé, USE_SUPABASE branché en interne). AthleteHomeSupabase/ScheduleScreenSupabase débranchés (fichiers conservés).
- Profile reste ProfileScreenSupabase (signOut Supabase fonctionnel).

### A5 — Vérification
- Build web : OK (0 erreur, 4.25 MB bundle).
- Écrans athlète : JSX/layout/textes/pastilles/tab bar = copie exacte de l'ancien, données Supabase.

---

## Session du 16 juillet 2026 — PARITÉ P1-P4

### P1 — Notifications : parité timing/texte (doc 07)
- `session-watcher/index.ts` : remplacé les 3 relances +20/+40/+60 min par 2 relances calquées sur l'ancien `functions/index.js`.
  - Relance 1 : +3 h, titre « Still got 60 seconds? ⏱ », body « Your coach needs your data to make tomorrow better for everyone. » (EXACT ancien).
  - Relance 2 : +6 h, titre « Final reminder 🔒 », body « Don't let your session go untracked. » (EXACT ancien).
  - Initial T+0 : emoji ⚡ ajouté au titre pour parité complète.
- `pending_reminders` : 2 attempts au lieu de 3 par athlète.

### P2 — Console Admin portée sur ctpApi + Courtlight
- `AdminHomeScreen.tsx` : réécrit — Firebase → ctpApi (`getAdminTeams`, `signOut`, `createTeam`). Grille d'équipes, inline create team, Courtlight.
- `AdminTeamScreen.tsx` : réécrit — Firebase → ctpApi (`getTeamInfo`, `setTeamCalendar`, `triggerIcsSync`). Access Codes + Calendar Sync, Courtlight.
- `AdminTeamDetailScreen.tsx` : réécrit — Firebase → ctpApi (`getTeamInfo`, `getTeamMembers`, `removeMember`, `updateTeamInfo`). Drawer settings + PerformanceDashboard intégré.
- `PerformanceDashboard.tsx` : réécrit — Firebase `responses` collectionGroup → ctpApi `getTeamMetricsRange` + `getTeamMembers`. Morning Brief + Analytics (recharts). Courtlight.
- `create-team/index.ts` (edge function) : nouvelle fonction service-role pour création d'équipe + auto-membership admin.
- `ctpApi.ts` : ajouté `getAdminTeams`, `getTeamInfo`, `updateTeamInfo`, `removeMember`, `createTeam`, `getTeamMetricsRange`, `getMyProfile`, `updateMyProfile`.

### P3 — Schedule + Profile + Logout Supabase
- `ScheduleScreenSupabase.tsx` : nouveau — Day/Week/Month avec `listSessions`, `getMyResponseForSession`. Courtlight.
- `ProfileScreenSupabase.tsx` : nouveau — profil éditable + notification status + **signOut Supabase fonctionnel** (via `CommonActions.reset`).
- `StitchNavigator.js` : AthleteTabs/AdminTabs/CoachTabs utilisent Schedule/Profile Supabase quand `USE_SUPABASE` actif.

### P4 — Vérification parité
- `docs/07_CONTRAT_DE_PARITE.md` : matrice mise à jour — toutes les lignes ✓ (sauf questionnaire = 🔒 gelé).
- Build web (`npx expo export --platform web`) : OK, 1271 modules, 0 erreur.

---

## Session du 7 juillet 2026

_(en cours — les entrées s'ajoutent au fil des modifications)_

### Bloc 1 — Moteur v2 (doc 02 §2, doc 04 §4)
- `supabase/migrations/008_engine_v2_planning.sql` : z-score individuel 28 j + mean/sd dans `v_engine` et `daily_metrics` ; colonnes `sessions.planned_load / objective / group_label` ; table `cycles` (micro/mésocycles) avec RLS ; re-verrouillage security_invoker.
- `compute-metrics` : stocke désormais z_score/mean_28/sd_28 (base des règles F-01, T-01 du doc 02).
- ➜ Action requise : `supabase db push` + `supabase functions deploy compute-metrics`.

### Bloc 2 — Brief multi-équipes (doc 01 §5.4, doc 04 §3)
- `morning-brief` : appel sans `team_id` = génère le brief de TOUTES les équipes (le cron n'est plus mono-équipe). Appel avec `team_id` inchangé.
- ➜ Action requise : `supabase functions deploy morning-brief`, puis mettre à jour le cron pour envoyer un corps vide `{}`.

### Bloc 3 — Tokens DA (doc 03 §2)
- `src/theme/tokens.ts` : export additif `da` — palette « Stadium at night » complète (bg/surface/line/accent/state/text/radius/glow). Non-cassant : les anciens écrans gardent `tokens`.

### Bloc 4 — Polish des écrans migrés (doc 03 §1, §5, §6)
- `CoachHomeSupabase` : la carte du brief devient l'élément lumineux unique de l'écran (bordure focus + glow) ; chiffres readiness en tabular-nums.
- `AthleteHomeSupabase` : le bouton Respond porte le glow unique de l'écran athlète.
- Règle appliquée : « la lumière = la hiérarchie » — un seul élément glow par écran.

### Bloc 5 — Fix ics-sync (doc 01 §5.1 — backlog E1)
- **Diagnostic** : l'URL ICS Google Calendar fonctionne (200, `text/calendar`, 10 VEVENT récurrents DAILY). La cause du `upserted:0` précédent et du timeout ultérieur : **2 100 occurrences** (10 events × 210 jours) upsertées une par une (2 100 requêtes séquentielles → timeout edge function).
- **Fix** : batch upsert par tranches de 200 lignes (11 requêtes au lieu de 2 100). Résultat : `upserted:2100` en ~5 s.
- **Ajouts défensifs** : `AbortController` 15 s sur le fetch ICS (protection contre URL qui hang) ; mode `?dry_run=1` (retourne la liste des teams avec URL sans fetch, sans exposer l'URL complète) ; diagnostic riche dans la réponse (`is_ics`, `vevent_count`, `events_in_window`).
- ➜ Déployé. Cron `ics-sync-15min` à vérifier (doit exister dans pg_cron).

### Bloc 6 — Fix TZID ics-sync (doc 01 §5.2)
- **Parsing VTIMEZONE** : extraction des blocs STANDARD/DAYLIGHT (offset, RRULE transition DST/heure d'été). Fallback sur `X-WR-TIMEZONE` si pas de TZID explicite sur DTSTART.
- **Conversion locale→UTC** : `getOffsetMin()` détermine si une date locale est en heure d'été ou standard, applique le bon offset. Les événements récurrents sont expansés en temps local puis convertis occurrence par occurrence.
- **Validation** : `DTSTART;TZID=Europe/Paris:20251110T073000` → été 05:30 UTC (UTC+2 ✓), hiver 06:30 UTC (UTC+1 ✓), transition DST oct 25 correcte.
- **Procédure** : `DELETE FROM sessions WHERE ics_uid IS NOT NULL` (2 102 lignes purgées) → resync → `upserted:2100` avec heures corrigées.
- **⚠ Calendrier de test irréaliste** : 10 « Training » quotidiens sans fin (07:30-22:30 Europe/Paris) → l'écran athlète affiche 10 sessions par jour. Gabin doit le remplacer par un calendrier réaliste type NCAA (practice lun/mer/ven + game samedi, avec UNTIL).
- ➜ Déployé et vérifié en prod.

## Session du 8 juillet 2026

### Bloc 7 — E2 Notifications Web Push VAPID (doc 01 §5, doc 04 §3)

**Décision fondateur** : Web Push natif VAPID — PAS de FCM. Les chemins Firebase restent intacts (Constitution art. 6).

#### 7a. Infra VAPID
- **Clés VAPID** générées (ECDSA P-256), stockées : `supabase secrets set VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY` ; clé publique dans `.env` (`EXPO_PUBLIC_VAPID_PUBLIC_KEY`).
- **Migration 009** (`supabase/migrations/009_push_notifications.sql`) : table `push_subscriptions` (user_id, endpoint, p256dh, auth_key, RLS user_own) + table `pending_reminders` (team_id, session_id, user_id, remind_at, attempt 1/2/3, status pending/sent/responded/expired, service-role only).

#### 7b. Module WebPush pure WebCrypto
- `supabase/functions/_shared/webpush.ts` : VAPID JWT ES256 (RFC 8292) + ECE aes128gcm (RFC 8291), zéro dépendance externe, Web Crypto API uniquement. Fonctionne sur Deno Deploy.
- **Crypto validé en prod** : insertion d'une souscription fake (ECDH P-256 valide, endpoint FCM bidon) → appel `notify` → `sent:0, failed:0, cleaned:1` (le pipeline VAPID JWT + ECDH + HKDF + AES-GCM s'exécute sans crash ; le cleanup auto supprime le endpoint 404).

#### 7c. Edge function `notify`
- `supabase/functions/notify/index.ts` : envoie des notifications push à une liste de `user_ids`. **Service-role only** : vérifie `role === "service_role"` dans le JWT (anon → 403). Nettoie les souscriptions mortes (404/410).

#### 7d. Edge function `session-watcher`
- `supabase/functions/session-watcher/index.ts` : cron 1 min (`session-watcher-1min` dans pg_cron).
- **Phase A** : détecte les sessions terminées (end_utc entre now-2min et now, notified_at IS NULL), envoie la notif initiale aux athlètes, marque `notified_at`, crée 3 `pending_reminders` (+20/+40/+60 min).
- **Phase B** : traite les reminders due, vérifie si l'athlète a répondu (table `responses`), envoie le push avec copywriting escaladé, marque `sent` ou `responded`.
- **Phase C** : expire les reminders > 24h.
- **Copywriting** : initial « Tell us — how did that session hit you? » → +20 « Still got 60 seconds? » → +40 « Don't let it go untracked » → +60 « Final reminder ».
- **Test** : session insérée avec end_utc = now()-1min → `sessions_notified:1`, 3 pending_reminders créés (+20/+40/+60 min), notified_at rempli.

#### 7e. Hook morning-brief → notification staff
- `morning-brief/index.ts` : après upsert du brief, récupère les coaches/admins de l'équipe, envoie un push « Morning Brief ready » via `_shared/webpush.ts`.

#### 7f. Client-side
- `public/ctp-sw.js` : Service Worker VAPID, écoute `push` + `notificationclick`, deep link vers questionnaire. Zéro dépendance Firebase.
- `src/services/vapidPush.ts` : enregistre le SW, souscrit via `pushManager.subscribe()`, stocke dans Supabase via `ctpApi.savePushSubscription()`.
- `src/lib/ctpApi.ts` : ajout `savePushSubscription()` + `removePushSubscription()`.
- `src/screens/OnboardingNotifScreen.tsx` : si `USE_SUPABASE`, appelle `registerVapidPush()` au lieu de `registerWebPushTokenForCurrentUser()`.
- `scripts/copy-service-worker.js` : copie aussi `ctp-sw.js` dans `web/dist/`.

#### 7g. Crons pg_cron
- `session-watcher-1min` : `* * * * *` → appelle `session-watcher` avec Bearer service_role.
- `morning-brief-daily` : `0 11 * * *` (inchangé).

#### Action requise — Gabin
1. Ouvrir l'app en athlète → cliquer « Enable Notifications » → vérifier `push_subscriptions` +1.
2. Insérer une session test (`end_utc = now() - interval '1 min'`) → attendre 1 min (cron) → notification Chrome.
3. Ne pas répondre → attendre 20 min → relance.

### Bloc 8 — Courtlight : langage visuel propriétaire (doc 06)

**7 étapes (T1-T7), chacune testée et commitée indépendamment.**

#### T1. Fondations
- Packages : `@expo-google-fonts/marcellus`, `@expo-google-fonts/inter`, `react-native-svg`, `three`, `@react-three/fiber`, `@react-three/drei`, `expo-font`.
- Export `courtlight` dans `src/theme/tokens.ts` (doc 06 §3) : bg, surface, edge, shadow, zoneGlow, motion, radius, type.
- Chargement Marcellus 400 + Inter 300/400/500/600 dans `App.js` via `useFonts`.

#### T2. CourtScene (scène ambiante 3D)
- `src/components/CourtScene.tsx` : Three.js vanilla (terrain NBA canvas-texture HD 2048px, 180 particules, parallaxe caméra pointeur, fog court).
- Dégradation auto : `prefers-reduced-motion` → rendu statique unique, FPS < 28 après 60 frames → freeze, pas de WebGL → composant vide.
- Monté une seule fois dans `StitchNavigator` (web only, absolute z:0, pointerEvents none).

#### T3. ReadinessHalo (signature n°1)
- `src/components/ReadinessHalo.tsx` : SVG ring (react-native-svg), arc de progression coloré par zone, cran de baseline (point blanc), count-up optionnel 600ms.
- Glow zone via CSS drop-shadow filter (web), dégradation silencieuse (native).

#### T4. GlassCard (plan supérieur)
- `src/components/GlassCard.tsx` : surface translucide + backdrop-blur 14px, bordure cyan, ombre e2.
- Tilt 3D ±5° sous le pointeur (perspective 900px) + reflet radial qui suit (--gx/--gy), transition settle.
- Props `glow` pour le glowFocus unique de l'écran.

#### T5. Refonte CoachHomeSupabase (doc 06 §7.1)
- Brief IA dans GlassCard avec tilt 3D et glow unique de l'écran.
- Count-up héros 600ms (ease-out cubic) pour le readiness d'équipe, 1×/jour.
- Chiffres du brief en Inter tabular cyan inline (auto-détection regex).
- Roster trié par priorité avec mini-halos ReadinessHalo 34px + delta vs baseline en texte clair.
- Team setup replié en accordéon (fermé par défaut).
- Skeleton warm-up shimmer au chargement. Fond transparent (Court visible).
- Marcellus pour l'identité équipe, Inter 300-600 partout.

#### T6. Refonte AthleteHomeSupabase + check-in (doc 06 §7.2-7.3)
- Halo personnel ReadinessHalo + baseline dans l'en-tête.
- GlassCard pour session à noter avec temps restant de la fenêtre (« closes in 3 h 40 »).
- État vide informatif (« All caught up. Next session… »).
- `getMyMetricsToday()` ajouté dans `ctpApi.ts`.
- **Check-in un-slider-par-écran** (chemin Supabase uniquement) : dots de progression, une question par écran dans un GlassCard, slider Courtlight (pouce radial-gradient cyan, grab/grabbing, haptique visuel). Friction matrix en dernier. Écran « Locked in. See you tomorrow. » + trend 7j SVG.
- Chemin Firebase totalement intact.

#### T7. Micro-interactions et états (doc 06 §5-6)
- `CardGraphite.tsx` : carte surface standard avec animation cascade (translateY 8px → 0, spring, delay 40ms × index).
- `SplashScreen.tsx` : skeleton warm-up shimmer Courtlight (pas de spinner).
- Tab bar transparente (rgba court), Onboarding fond vignette, typographie Marcellus.
- **Décision prise seul** : pas de R3F pour la scène (vanilla Three.js plus fiable pour un fond fixe). `@react-three/fiber` et `drei` installés mais non utilisés (disponibles pour T-futurs).
- **Décision prise seul** : slider Courtlight (radial-gradient cyan, scale 1.18 au grab) appliqué aussi au chemin Firebase pour cohérence visuelle du slider CSS partagé.

### Restes à implémenter (traçés, non faits — nécessitent session dédiée ou décision)
- Création de séance in-app avec planned_load/objective (UI coach) — colonnes prêtes (008).
- Court map SVG dans le fond du check-in (doc 06 §7.2 — les lignes de terrain en filigrane derrière le slider).
- Landing 3D (doc 03 §3) — asset commercial.
- Règles moteur : attendent l'ingénierie Gabin (doc 02 §7) — AUCUN seuil activé sans lui (Constitution).

## Session du 31 juillet 2026

### Bloc 9 — Cartographie et audit (aucune modification de code)

- **`docs/08_CARTOGRAPHIE_TECHNIQUE.md`** (nouveau) : structure réelle de l'app, vérifiée fichier par fichier. Stack et versions, chaîne de démarrage, commutateur `USE_SUPABASE`, arborescence commentée, routage par rôle, tableau écran → source de données → état, inventaire `ctpApi`, backend Supabase (18 tables, 6 vues, 6 fonctions SQL, RLS, 9 migrations), 9 edge functions, 4 automatisations, chaîne de bout en bout, build/déploiement, environnement, test de santé. **Document de référence pour tout agent externe.**
- **`docs/09_AUDIT_ET_ROADMAP.md`** (nouveau) : audit structurel, priorité interface admin et coach. Trois blocages P0, état écran par écran, manques classés par valeur, dette technique chiffrée, séquence L1-L7 avec critères de sortie vérifiables.
- **`CLAUDE.md`** : cartographie du repo complétée (docs 06 à 09).

#### Anomalies constatées pendant l'audit (non corrigées — prévision uniquement)
1. **Chaîne push inopérante** : `registerVapidPush()` n'a qu'un appelant (`OnboardingNotifScreen.tsx:63`), écran jamais rendu car `onboardingComplete` est fixé à `true` en dur dans la branche Supabase de `AuthGate` (`StitchNavigator.js:485`). `push_subscriptions` reste donc vide.
2. **Trois écrans coach lisent Firestore** → vides sous `USE_SUPABASE=1` : `CoachTeamScreen`, `CoachScheduleScreen`, `AthleteDetailScreen`. La fiche joueur est de ce fait inaccessible (seul chemin d'accès : `CoachTeamScreen:206`).
3. **Admin** : onglet « Teams » = doublon d'`AdminHome` ; `AdminTeamScreen` (490 l.) et `CreateTeamModal` (536 l., Firestore) enregistrés mais jamais atteints.
4. **Code débranché conservé** : `AthleteHomeSupabase` + `ScheduleScreenSupabase` (1 190 l.).
5. **Divers** : fichier `nul` parasite à la racine ; `dist/` et `web/` coexistent alors que seul `web/dist` est déclaré dans `vercel.json`.
6. **Moteur à vide** : aucune ligne `rules.enabled = true` → `flags` toujours vide → le brief reste descriptif. Décision réservée à Gabin (Constitution art. 2).

### Hors V2 — remise en ligne de l'ancienne version
- Dépôt `gfavergeat4-cell/ChampionTrackPro_` : `main` écrasé par erreur depuis un dossier local dont le git ne suivait que 70 fichiers, puis restauré depuis la branche de sauvegarde `backup-main-avant-ecrasement` (603 fichiers).
- Clone propre dans `APP/ChampionTrackPro-LIVE`, puis trois modifications réversibles : `public/landing` → `public/_landing_disabled`, rewrites `vercel.json` vers `/index.html` (les trois règles vers `/app.html` devenaient invalides sans la landing), `initialRouteName="Login"` dans `navigation/StitchNavigator.js`. L'app s'ouvre désormais sur l'écran de connexion.

### Bloc 10 — Implémentation de l'audit : lots L1 à L4 (31 juillet 2026)

#### L1 — Déblocage de la chaîne de notifications push (P0-1)
- `src/services/vapidPush.ts` : ajout de `ensurePushSubscriptionSynced()` — lit la souscription `PushManager` de CE navigateur et la ré-`upsert` dans `push_subscriptions` (idempotent, répare une ligne perdue). **Ne demande jamais de permission**, appelable au démarrage. Ajout de `isPushOnboardingSkipped()` / `markPushOnboardingSkipped()` / `clearPushOnboardingSkipped()` (clé `ctp_push_onboarding_skipped`).
- `navigation/StitchNavigator.js`, branche Supabase de `AuthGate` : `onboardingComplete` n'est plus fixé à `true` en dur. Pour un athlète, il vaut `souscription valide || renoncement explicite`. **L'état d'onboarding est désormais dérivé de la réalité de l'appareil, pas d'un booléen** — un booléen serveur mentirait au changement de téléphone (raisonnement détaillé : doc 09 §7).
- `src/screens/OnboardingNotifScreen.tsx` : `markOnboardingComplete()` devient no-op sur le chemin Supabase ; nouveau `markSkipped()`. Sur le chemin Supabase, l'écran ne se ferme que si `registerVapidPush()` **retourne true** — auparavant il se fermait sur la seule permission, laissant la chaîne morte.
- `src/screens/ProfileScreenSupabase.tsx` : `requestNotifPermission()` appelait uniquement `Notification.requestPermission()` — **aucune souscription n'était créée**. Remplacé par `registerVapidPush()`. Nouvel état `notifSubscribed` : « Active » signifie maintenant *abonné*, pas *permission accordée*. État intermédiaire cliquable (« Almost there — Tap to finish setup »).

#### L2 — Rebranchement des trois écrans coach (P0-2)
Rendu **non modifié** (loi de parité) : seuls les chargements de données ont changé.
- `src/lib/ctpApi.ts` : `getTeamMembers()` remonte désormais `position` ; ajout de `getTeamLatestSessionResponses()`, `getResponsesForSessions()` (tranches de 200), `getAthleteMetricsRange()`, `getAthleteResponses()`.
- `CoachTeamScreen.tsx` (313 → 278 l.) : Firestore → `getMyMembership` + `getTeamMembers` + `getTeamLatestSessionResponses`. Seuils « at-risk » identiques à la V1 (`worry_flag`, readiness < 40, `friction_impact` > 70).
- `AthleteDetailScreen.tsx` (570 → 562 l.) : `collectionGroup` → `getAthleteResponses`. Les lignes Postgres sont remappées vers le contrat attendu par le rendu (camelCase + `submittedAt` façon Timestamp) plutôt que de réécrire 400 lignes d'affichage.
- `CoachScheduleScreen.tsx` (720 → 706 l.) : Firestore → `listSessions` + `getResponsesForSessions`. **Fenêtre bornée −60 j / +60 j** : la table `sessions` contient des milliers d'occurrences récurrentes, tout charger faisait tomber l'écran.

#### L3 — Console santé système (admin)
- `supabase/migrations/010_admin_health_read.sql` : policies de **lecture seule** sur `llm_logs` et `pending_reminders` pour l'admin de l'équipe. Ces tables n'avaient aucune policy, donc aucun accès client — le coût LLM n'était lisible que dans le SQL editor.
- `src/lib/ctpApi.ts` : `getAdminSystemHealth(days)` + type `TeamHealth`. Chaque sous-requête est encapsulée : si la migration 010 n'est pas appliquée, les champs concernés valent `null` au lieu de faire échouer l'écran.
- `src/screens/AdminSystemHealthScreen.tsx` (nouveau, 284 l.) : par équipe — dernier brief et son âge, briefs sur 7 j, compliance (réponses ÷ séances terminées × athlètes), séances passées/à venir, relances envoyées/en attente, coût 30 j, erreurs LLM. Bandeau agrégé. **Lecture seule.**

#### L4 — Nettoyage de la navigation admin
- Onglet « Teams » (qui rendait `AdminHomeScreen`, doublon d'« AdminHome ») remplacé par l'onglet « Health ».
- Routes `AdminTeamScreen` et `CreateTeamModal` retirées : jamais atteintes par un `navigate()`, et `CreateTeamModal` écrivait sur Firestore alors qu'`AdminHomeScreen` crée les équipes via `ctpApi.createTeam`. **Fichiers conservés**, seules les routes disparaissent.

#### Vérifications effectuées
- Parsing Babel (JSX + TypeScript) des 9 fichiers touchés : OK.
- Résolution complète du graphe d'imports depuis `index.js` : 73 fichiers locaux, **zéro import non résolu**.
- Atteignabilité confirmée des 4 écrans rebranchés/créés ; `AdminTeamScreen` et `CreateTeamModal` confirmés hors du graphe actif.
- Aucun résidu Firestore dans les 3 écrans coach. Les chemins Firebase restent intacts ailleurs (Constitution art. 6, extinction en M8).
- ⚠ **Build web non exécuté ici** (Metro trop lent à travers le montage) : à lancer en local — `npm run web:build`.

#### Non fait volontairement
- Aucune règle d'interprétation activée (`rules.enabled` reste `false` partout) — domaine réservé au fondateur.
- Questionnaire NCAA : gelé, aucune décision anticipée.
- Lots L5 (création de séance in-app), L6 (boucle de décision étendue + export), L7 (extinction Firebase) : non commencés.

#### Action requise — Gabin
1. `supabase db push` (applique la migration 010).
2. `npm run web:build` pour valider le bundle localement.
3. Vérifications de terrain V2 à V5 listées dans `docs/09_AUDIT_ET_ROADMAP.md §10` — la plus importante : recevoir une vraie notification sur un vrai téléphone.

### Bloc 10bis — Validation terrain de L1 et deux correctifs (31 juillet 2026)

**✅ Critère de sortie L1 ATTEINT.** Première notification push jamais reçue par ce système : séance test (`end_utc = now() − 1 min`) → `session-watcher` → notification affichée sur l'appareil → `notified_at` rempli → deux relances programmées (+3 h, +6 h), conformes aux timings de l'ancienne version.

#### Correctif 1 — `011_push_subscriptions_update_policy.sql`
`savePushSubscription()` fait un upsert ; PostgREST le traduit en `INSERT ... ON CONFLICT DO UPDATE`, qui exige une policy **UPDATE**. La migration 009 n'avait créé que SELECT / INSERT / DELETE.
- Symptôme : le premier abonnement d'un appareil passe (insertion pure), toute re-synchronisation renvoie 403 « new row violates row-level security policy (USING expression) ».
- **Portée réelle du bug, au-delà du blocage constaté** : les endpoints push expirent et doivent être rafraîchis. Sans policy UPDATE, le rafraîchissement échouait silencieusement — les athlètes auraient cessé de recevoir des notifications au bout de quelques semaines, sans aucune erreur visible.

#### Correctif 2 — robustesse de l'activation (`vapidPush.ts`, `OnboardingNotifScreen.tsx`)
- `registerVapidPush()` réutilise la souscription existante de l'appareil au lieu d'appeler `subscribe()` en aveugle (qui échoue si une souscription est déjà en place) ; désabonnement puis nouvelle souscription en dernier recours.
- `ensurePushSubscriptionSynced()` attend `serviceWorker.ready` (borné à 3 s) puis retombe sur `getRegistrations()` — au démarrage à froid, `getRegistration()` répondait avant l'activation du SW et réaffichait l'onboarding à un athlète déjà abonné.
- `OnboardingNotifScreen` : états `busy` / `regFailed`, message d'échec explicite et bouton **Continue anyway**. L'athlète n'est jamais piégé sur l'écran de permission.

#### Environnement
- `EXPO_PUBLIC_VAPID_PUBLIC_KEY` doit être déclarée dans les variables d'environnement Vercel du projet `champion-track-pro-ai` : les variables `EXPO_PUBLIC_*` sont figées à la compilation, un redeploy sans rebuild ne les prend pas.
- Fichier `nul` supprimé (nom réservé Windows, bloquait `git add`) et ajouté au `.gitignore`.
- `supabase db push` ne détecte pas les migrations nommées sans horodatage : 010 et 011 ont été appliquées manuellement via le SQL editor.

### Bloc 11 — Questionnaire NCAA Basketball : moteur + écran (31 juillet 2026)

Implémentation du doc 15 v3 (méthode DAR, Stéphane Morin). **Rien n'est activé** : les questionnaires sont créés mais non reliés aux équipes, le questionnaire actuel reste en service jusqu'à décision du fondateur.

#### Migration 012 — Questionnaires
- Colonne `responses.friction_area` (zone corporelle, vocabulaire figé).
- **5 questionnaires** : `tpl-bball-effort-full` (practice, 8 items), `tpl-bball-effort-game` (**items copiés à l'identique** depuis practice, par requête SQL — la comparabilité entraînement/compétition ne peut pas dépendre d'une recopie manuelle), `tpl-bball-effort-sc` (conditioning, 5 items, technique et tactique retirées), `tpl-bball-effort-skill` (4 items), `tpl-bball-daily` (bloc journalier : sommeil, drive, confiance, énergie du groupe, clarté du rôle, charge académique).
- Champs ajoutés à chaque item : `role` (cost/state/context) et `axis` (PHY/TEC/MEN/REC/SOC/ACA/CTX) — le moteur ne devine plus rien.
- **Trigger `check_questionnaire_weights`** : refuse tout questionnaire dont les poids ne somment pas à 1.0. Un questionnaire mal pondéré produit un score faux que personne ne remarque.
- Poids renormalisés par variante : sans cela, une séance de musculation produirait mécaniquement un coût plus faible qu'une practice — un artefact, pas une mesure.

#### Migration 013 — Moteur de charge
- **`session_load` et `workload_au` enfin calculés** (trigger `responses_readiness_load`). Ces colonnes n'avaient jamais été alimentées, ce qui rendait `acwr` systématiquement nul depuis l'origine du projet. `session_load = readiness_score / 10` (échelle CR-10), `workload_au = session_load × durée réelle de la séance`.
  - ⚠ Nom du trigger choisi pour l'ordre alphabétique d'exécution : `responses_readiness` doit passer avant `responses_readiness_load`, sinon `readiness_score` serait encore NULL.
  - Garde-fou : ne calcule que si le questionnaire porte des items `role = "cost"`. Un questionnaire hérité mesure un état, le convertir en charge serait un contresens.
- **`v_response_axes` / `v_daily_axes`** : sous-scores PHY / TEC / MEN / ACA calculés depuis les axes déclarés, inversion de valence appliquée côté serveur (invisible pour l'athlète, DAR partie 2 §E.2). NULL propagé si l'axe n'a pas été mesuré — jamais remplacé par 0.
- Colonne `daily_metrics.sub_aca` (charge académique, hors charge sportive).
- **`v_specificity`** : rapport exigence entraînement / exigence match par axe, sur 56 jours, **calculé par athlète** — DAR proscrit la normalisation interindividuelle.
- `compute-metrics` alimente désormais `sub_phy` / `sub_tec` / `sub_men` / `sub_aca`.

#### Écran de check-in — `src/screens/QuestionnaireCourtlight.tsx` (469 l., nouveau)
Rendu conforme au modèle visuel fourni : en-tête de séance avec halo, cartes `#141A24` rayon 16 avec liseré cyan interne, libellé 18 px + explication 14 px, cascade 50 ms par carte, porte d'entrée douleur en deux boutons, Submit en dégradé avec glow.
- **Entièrement piloté par la donnée** : aucun libellé en dur. Changer le questionnaire en base change l'écran.
- Résolution du questionnaire **par type de séance** (`getQuestionnaireForSession`), avec repli sur l'ancien comportement.
- Bloc douleur affiché si le questionnaire est journalier **ou** hérité — le signal n'est jamais perdu pendant la transition.
- Soumission bloquée tant que chaque curseur n'a pas été touché : sans cela, un athlète pressé valide 50 partout et empoisonne sa propre baseline.

#### Composant de marque — `src/components/LogoSlider.tsx` (164 l., nouveau)
**Le curseur EST l'emblème.** Géométrie et dégradés relevés sur `logo_ctp_embleme.svg` et `logo-191-v2.png` : rail 12 px (ratio 64/500 du logo), orbe 22 px (1,81 × la hauteur du rail, ratio exact du logo), dégradé de rail `#8CEFE0 → #4FC9F2 → #3D8BF7 → #2E5BF6`, orbe en dégradé radial `#FFFFFF → #DFF6FF → #8ED9FF → #4FB4F2 → #3E9BE8`.
- Le rail reste **entièrement coloré** quelle que soit la position : c'est ce qui préserve la lecture « emblème » plutôt que « barre de progression ».
- État non touché : rail désaturé, orbe grise qui respire. Répond au biais de centralité signalé par DAR — un curseur pré-positionné au centre fabrique des réponses médianes.

#### Couche d'accès
`submitResponse` accepte `frictionArea` et `frictionImpact` ; ajout de `getQuestionnaireForSession` et `getSessionById` (renommé : `getSession` était déjà pris par l'auth).

#### Vérifications
Parsing Babel des 5 fichiers touchés : OK. Graphe d'imports depuis `index.js` : 75 fichiers, zéro import cassé, les deux nouveaux fichiers atteignables.

#### Action requise — Gabin
1. Appliquer 012 et 013 dans le SQL editor (le CLI ne détecte pas les migrations sans horodatage).
2. `npm run web:build`, puis commit et push.
3. **Décider de la bascule** : tant que `team_questionnaires` n'est pas modifié, rien ne change pour l'équipe pilote. Le bloc SQL de bascule est commenté en fin de migration 012.
4. Les 9 décisions du doc 15 §12 restent ouvertes — notamment zones ±10 points vs ±15 %, et moyenne d'équipe vs distribution.

### Bloc 12 — Durcissement : 9 correctifs + rôle serveur (15 août 2026)

Issus de `docs/11_AUDIT_BACKEND.md` et `docs/14_DURCISSEMENT_SECURITE.md`. Vérifiés dans le code avant correction, pas repris sur parole.

#### Sécurité

**Rôle coach décidé par le serveur** (11 P0-2 / 14 P0-1). `join-team` lisait le rôle dans le corps de la requête : tout athlète possédant le code d'équipe se réinscrivait en cochant « coach » et accédait aux réponses nominatives de tout le roster. **Décision fondateur : deux codes distincts générés à la création de l'équipe.** `teams.coach_code` ajouté (migration 015, avec backfill), `create-team` génère `XXXXXX-A` et `XXXXXX-C`, `join-team` déduit le rôle du code présenté et **ignore le champ `role`**. Un membre existant ne change plus jamais de rôle en re-présentant un code. `ctpApi.joinTeam()` perd son paramètre `role`.

**Gardes d'appelant** (11 P0-3/P0-4). `compute-metrics` et `morning-brief` acceptaient n'importe quel appelant et écrivaient sur le `team_id` fourni — exfiltration inter-tenant. Garde service-role ajouté, identique à celui de `notify`. `ics-sync` est un cas à part : le bouton « Sync Now » du coach l'appelle avec son propre jeton, un garde strict aurait cassé la fonction. Portée résolue à la place : service-role → toutes les équipes, coach/admin → **uniquement les siennes**, tout autre appelant → 403. Corrige au passage P1-3 (un clic ne synchronise plus tous les clients).

**Fuite de `diag`** (11 P0-4). `ics-sync` renvoyait à tout appelant l'identifiant, le nom et l'hôte calendrier de **toutes** les équipes. Déplacé dans les logs serveur.

**`birth_year` retiré de `v_ai_dataset`** (14 P2-3). Pseudonyme + poste + année de naissance suffisent à réidentifier un joueur dans un roster de quinze.

**`coach_feedback` verrouillé** (11 P1-13). La policy `FOR ALL` laissait un coach modifier et supprimer ses retours — or c'est le futur dataset d'apprentissage, que la Constitution interdit de purger. Réduit à SELECT + INSERT.

#### Bugs silencieux

**`create-team` était totalement cassé** (11 P0-1) : insertion sur `org_id` alors que la colonne s'appelle `organization_id`. **Aucune équipe ne pouvait être créée par le produit** ; toutes les équipes existantes viennent des seeds SQL. Correction : un mot.

**Deux fonctions d'administration renvoyaient « succès » sans rien écrire** (11 P0-7). `teams` n'avait aucune policy UPDATE, `memberships` aucune policy DELETE : PostgreSQL filtrait sans erreur, PostgREST répondait 204, l'écran affichait un succès. Pire qu'un refus, parce qu'invisible. Policies `teams_admin_update` et `memberships_staff_delete` ajoutées.

**`updateMyProfile` écrivait dans des colonnes inexistantes** (11 P1-11) : `jersey_number` et `position` vivent sur `memberships`, pas sur `profiles`. L'édition du profil échouait intégralement. Écriture désormais répartie sur les deux tables.

**Doublons de séances** (11 P1-9). La contrainte `unique (team_id, ics_uid, start_utc)` ne protège rien quand `ics_uid` est NULL — en SQL, NULL n'entre jamais en conflit. Constaté en pratique pendant le seed : 187 séances là où on en attendait 60. Index unique partiel `uq_sessions_manual` sur les séances non-ICS.

#### Performance et cohérence visuelle

**Six index** sur les chemins les plus sollicités (11 P1-5) : `memberships(user_id)`, `daily_metrics(team_id, day)`, `responses(session_id)`, `briefs(team_id, brief_date)`, `sessions(team_id, start_utc)`, `flags(team_id, day)`.

**`tokens.ts` nettoyé** (doc 10, étape 3) : `brand: "Cinzel, serif"` → `"'Marcellus', serif"` — Cinzel avait été retirée par décision du 8 juillet mais subsistait dans les tokens. Export `da` supprimé (32 lignes) : zéro consommateur dans tout le graphe d'imports, doublon de `courtlight` qui fait autorité depuis le doc 06.

#### Correctif de la veille, à noter
Les `revoke select` posés sur les vues de la migration 014 empêchaient le coach de lire son propre tableau : avec `security_invoker = true`, la RLS des tables sous-jacentes suffit déjà. Grants rétablis. Symptôme trompeur — l'écran affichait « 0 of 16 » sans erreur, parce que la fonction `safe()` de `ctpApi` avale les échecs de requête. **À revoir : transformer une erreur de permission en « pas de données » est le pire des deux mondes pour diagnostiquer.**

#### Vérifications
Parsing des 9 fichiers touchés : OK. Graphe d'imports : 76 fichiers, zéro import cassé.

#### Action requise — Gabin
1. Coller `015_hardening.sql` dans le SQL editor.
2. `supabase functions deploy create-team join-team ics-sync compute-metrics morning-brief`.
3. `npm run web:build`, commit, push.
4. **Récupérer les nouveaux codes staff** : `select name, invite_code, coach_code from teams;` — le code coach ne doit jamais être diffusé au roster.

#### Restant, avec décision en attente
Relance +6 h contre fenêtre RLS de 5 h (11 P0-5) · fenêtre de détection du watcher (P0-6) · `f_engine_user` pour la montée en charge (P1-1) · suppression réelle d'un athlète et d'une équipe (14 P0-2, bloquant pour signer) · journal d'accès (14 P1-4) · MFA staff (14 P1-2) · seuils ±10 vs ±15 % · cyan de marque.

### Bloc 13 — Assets de marque régénérés depuis les logos officiels (15 août 2026)

Application de `docs/10_SYSTEME_VISUEL.md` §6 étape 1.

#### Ce qui n'allait pas
- **Les quatre assets Expo étaient les placeholders par défaut** : `favicon.png`, `icon.png`, `adaptive-icon.png`, `splash-icon.png`. Le tout premier contact visuel avec le produit — icône installée, écran de démarrage — n'était pas la marque.
- **Doublons binaires** : `icon-192.png` ≡ `icon-192-v2.png`, `icon-512.png` ≡ `icon-512-v2.png`, `logo_clean.png` ≡ `logo_nobackground.png`, `adaptive-icon.png` ≡ `splash-icon.png`.
- **Trois couleurs de fond concurrentes** dans les configs : `#0E1528` (app.json ×2), `#0A0F1E` (app.json ×2), `#0A1F3C` (app.config.js ×2, manifest ×2).

#### Régénéré depuis les sources officielles
Emblème : `VISUEL/logos officiels/logo-191-v2.png` (transparent, propre — `logo_test.png` est écarté, il contient un carré noir parasite). Lockup : `8ea1daef-…png`, le seul à fond transparent.

| Fichier | Taille | Contenu |
|---|---|---|
| `public/icons/icon-192-v2.png` · `icon-512-v2.png` | 192 / 512 | Emblème à 78 % de largeur sur `#070B14` |
| `public/icons/icon-192.png` · `icon-512.png` | 192 / 512 | Identiques — noms conservés pour compatibilité |
| `public/icons/icon-notif-color.png` | 192 | Emblème à 80 % |
| `public/icons/badge-72.png` | 72 | **Silhouette blanche sur transparent** — Android applique un masque au badge de notification, une image couleur y ressort en carré noir |
| `assets/icon.png` | 1024 | Emblème à 76 % sur `#070B14` |
| `assets/adaptive-icon.png` | 1024 | Emblème à **55 %**, fond transparent — zone de sécurité Android, le système recadre en cercle ou squircle |
| `assets/splash-icon.png` | 1024 | Emblème à 62 %, transparent (le fond vient de `splash.backgroundColor`) |
| `assets/favicon.png` | 48 | Emblème à 90 % — à cette taille il doit remplir |
| `public/logo/logo_bon.png` | 900 × 303 | Lockup complet, transparent (en-tête web) |
| `public/logo/logo_nobackground.png` | 492 × 166 | Lockup complet, transparent (en-tête natif) |

#### Configuration
Les huit occurrences des trois fonds concurrents unifiées sur **`#070B14`** (`courtlight.bg.court`) dans `app.json`, `app.config.js` et `public/manifest.json`.

#### Restant
- `public/logo/logo_clean.png` et `assets/logo.svg` (contient `Cinzel`, retirée le 8 juillet) : suppression refusée par le montage, **à supprimer à la main**. Aucun des deux n'est référencé.
- Les six décisions de couleur du doc 10 §6 étape 2 restent ouvertes : cyan de marque, mot en cyan, vert, rouge, orange friction, zone de respiration.

### Bloc 14 — Pseudonymes stables, suppression réelle, export (15 août 2026)

#### Migration 016

**Pseudonymes non réutilisables** (11 P1-10, 14 P1-9). `join-team` calculait le pseudonyme par `count()` sur les membres : un joueur part, le suivant hérite du sien. Or c'est le **seul identifiant transmis au LLM** — deux athlètes différents apparaissaient sous le même nom dans les briefs, sans erreur nulle part. Remplacé par `teams.pseudonym_seq`, compteur qui ne décroît jamais, alloué par `next_pseudonym()`. Backfill sur la valeur max existante.

**`purge_athlete(team, user)`** (14 P0-2). Efface réponses, métriques, flags, relances et adhésion, et retourne le décompte de ce qui a été supprimé. Ne touche pas à `auth.users` : la personne peut appartenir à une autre équipe, la suppression du compte est une action distincte. Les souscriptions push ne partent que si la personne ne fait plus partie d'aucune équipe.

**`purge_team(team)`** — fin de contrat. Compte **avant** de supprimer : la cascade efface sans laisser de trace, or une fin de contrat doit pouvoir être justifiée.

**`export_athlete(team, user)`** (14 P2-1) — le pendant du droit à la suppression. Une université demandera aussi la portabilité.

Les trois fonctions sont `security definer` et **révoquées pour `anon` et `authenticated`** : le seul chemin est l'edge function.

#### Edge function `admin-purge`
Point d'entrée unique, qui vérifie côté serveur que l'appelant est **admin de l'équipe visée** — jamais sur déclaration du client. Un admin ne peut pas se purger lui-même. Trace minimale en log : qui, quoi, quand, sans aucune donnée de santé.

#### Couche d'accès
`removeMember` documenté pour ce qu'il est : **retirer de l'équipe sans effacer**. Ajout de `purgeAthlete`, `purgeTeam`, `exportAthlete`. La distinction entre les deux gestes est désormais explicite dans le code — c'était la confusion à l'origine du P0-2.

#### Correction d'une affirmation fausse
`_shared/llm.ts` ligne 3 affirmait « API zéro-rétention ». La rétention par défaut d'Anthropic est de 30 jours, et un accord *Zero Data Retention* se contracte. Commentaire remplacé par un avertissement explicite. **À ne jamais reprendre dans un argumentaire de vente tant que l'accord n'est pas signé.**

#### Action requise — Gabin
1. Coller `016_pseudonyms_and_purge.sql`.
2. `supabase functions deploy admin-purge` et `supabase functions deploy join-team`.
3. Aucun changement d'interface : les fonctions de purge sont disponibles dans `ctpApi` mais pas encore câblées à un bouton. Volontaire — un bouton « supprimer définitivement » mérite sa propre confirmation à double saisie.
