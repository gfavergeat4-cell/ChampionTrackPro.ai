# CHANGELOG — Implémentation des documents fondateurs
**Mis à jour en temps réel à chaque modification. Réf : docs 01-04 + Constitution.**

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
