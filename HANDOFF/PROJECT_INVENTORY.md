# PROJECT_INVENTORY

Cartographie du dépôt `APP/ChampionTrackPro-V2`. Colonnes : **rôle**, **risque** (ce qui casse si on y touche mal), **modifiable** (oui / avec précaution / non sans revue).

---

```
PROJECT
├── Entrée / configuration
├── Frontend
│   ├── Navigation
│   ├── Écrans athlète
│   ├── Écrans coach
│   ├── Écrans admin
│   ├── Composants
│   └── Thème
├── Couche d'accès
├── Backend (Supabase)
│   ├── Migrations
│   └── Edge functions
├── Backend hérité (Firebase)
├── Assets & PWA
├── Scripts de build
└── Documentation
```

## Entrée et configuration

| Fichier | Rôle | Risque | Modifiable |
|---|---|---|---|
| `index.js` / `index.web.js` | point d'entrée, init Firebase natif | démarrage | avec précaution |
| `App.js` | polices Marcellus + Inter, init FCM web | **écran blanc si les polices échouent** | avec précaution |
| `package.json` | dépendances, script `web:build` | build et déploiement | avec précaution |
| `app.json` / `app.config.js` | configuration Expo, PWA, couleurs | icônes, splash, manifest | oui |
| `vercel.json` | rewrites SPA, CSP, sortie `web/dist` | **404 partout si les rewrites sautent** | non sans revue |
| `.env` | 4 variables `EXPO_PUBLIC_*` | l'app ne se connecte plus | oui, jamais commité |
| `CLAUDE.md` | document-mère, les 6 lois | contrat de travail | à tenir à jour |
| `CONSTITUTION.md` | 12 articles + amendements | idem | non sans revue |

## Navigation

| Fichier | Rôle | Risque | Modifiable |
|---|---|---|---|
| `navigation/StitchNavigator.js` (~730 l.) | **AuthGate double (Supabase/Firebase), ConsentGate, routage par rôle, deep links** | le cœur nerveux : une erreur ici bloque toute l'app | non sans revue |

Deep links gérés : `/?screen=questionnaire&trainingId=…&teamId=…` · `/?sessionId=…&openQuestionnaire=1` (hérité) · `/?code=XXXXXX-A` · `/debug/test-questionnaire`.

## Écrans athlète

| Fichier | Rôle | Source | Risque | Modifiable |
|---|---|---|---|---|
| `src/screens/AthleteHome.js` (83 l.) | wrapper vers `AthleteHomeNew` | — | faible | oui |
| `src/stitch_components/AthleteHomeNew.tsx` (1912 l.) | **accueil athlète — écran de parité** | branche `USE_SUPABASE` | parité | avec précaution |
| `src/screens/ScheduleScreenNewScreen.js` (61 l.) | wrapper | — | faible | oui |
| `src/stitch_components/ScheduleScreenNew.tsx` (2244 l.) | **planning athlète — écran de parité** | branche `USE_SUPABASE` | parité | avec précaution |
| `src/screens/ProfileScreenSupabase.tsx` (668 l.) | profil, notifications, logout | `ctpApi` | moyen | oui |
| `src/screens/QuestionnaireCourtlight.tsx` (476 l.) | **check-in, piloté par la donnée** | `ctpApi` | chaîne de collecte | avec précaution |
| `src/screens/OnboardingNotifScreen.tsx` (323 l.) | activation push | `ctpApi` + Firebase | **toute la compliance en dépend** | non sans revue |
| `src/screens/ConsentGate.tsx` (168 l.) | acceptation des documents | `ctpApi` | bloque l'accès si mal codé | avec précaution |
| `src/stitch_components/UnifiedAthleteNavigation.tsx` (389 l.) | barre d'onglets athlète | — | cohérence visuelle des 3 onglets | avec précaution |
| `src/screens/AthleteHomeSupabase.tsx` · `ScheduleScreenSupabase.tsx` | **DÉBRANCHÉS**, 1 190 l. conservées | `ctpApi` | aucun | à archiver |

## Écrans coach

| Fichier | Rôle | Source | Risque | Modifiable |
|---|---|---|---|---|
| `src/screens/CoachHomeSupabase.tsx` (554 l.) | **Morning Brief** + roster + feedback | `ctpApi` | écran principal du client | avec précaution |
| `src/screens/CoachBoard.tsx` (315 l.) | **tableau multi-marqueurs DAR** | `ctpApi` | méthode Morin | non sans revue |
| `src/screens/CoachScheduleScreen.tsx` (706 l.) | planning, fenêtre ±60 j | `ctpApi` | perf si la borne saute | avec précaution |
| `src/screens/AthleteDetailScreen.tsx` (562 l.) | fiche joueur | `ctpApi` | **contrat de forme camelCase + faux Timestamp** | avec précaution |
| `src/screens/PerformanceDashboard.tsx` (1591 l.) | analytics, filtres, graphiques | `ctpApi` | le plus gros fichier | avec précaution |
| `src/screens/CoachTeamScreen.tsx` (278 l.) | ancien roster | `ctpApi` | remplacé par `CoachBoard` | à archiver |
| `src/screens/CoachHomeScreen.tsx` · `CoachProfileScreen.tsx` | versions Firebase (flag = 0) | Firestore | — | ne pas supprimer avant M8 |

## Écrans admin

| Fichier | Rôle | Source | Risque | Modifiable |
|---|---|---|---|---|
| `src/screens/AdminHomeScreen.tsx` (208 l.) | liste + création d'équipe | `ctpApi` | création d'équipe | oui |
| `src/screens/AdminTeamDetailScreen.tsx` (539 l.) | réglages, membres, bouton Board | `ctpApi` | écritures admin | avec précaution |
| `src/screens/AdminSystemHealthScreen.tsx` (284 l.) | santé système, **lecture seule** | `ctpApi` | aucun | oui |
| `src/screens/AdminTeamScreen.tsx` (490 l.) | **route retirée** | `ctpApi` | aucun | à archiver |
| `src/screens/CreateTeamModal.tsx` (536 l.) | **route retirée, écrit sur Firestore** | Firestore | doublon dangereux | à archiver |

## Composants

| Fichier | Rôle | Utilisé par | Note |
|---|---|---|---|
| `LogoSlider.tsx` (204 l.) | **le curseur EST l'emblème** | check-in | géométrie relevée sur le logo — ne pas « simplifier » |
| `ReadinessHalo.tsx` | anneau de score avec cran de baseline | coach, athlète | signature visuelle |
| `GlassCard.tsx` · `CardGraphite.tsx` | surfaces Courtlight | coach | `CardGraphite` peu utilisé |
| `CourtScene.tsx` | fond 3D Three.js vanilla | `StitchNavigator` | dégradation auto si GPU faible |
| `MobileViewport.tsx` | cadre 375 × 812 | écrans athlète | cohérence des 3 onglets |
| `BrandHeader.tsx` · `ChampionTrackProLogo.tsx` | en-tête de marque | Home | référence `public/logo/*` |
| `SplashScreen.tsx` · `StatusPill.tsx` · `SliderDivider.tsx` · `PWAInstallBanner.tsx` | divers | | |
| `DARPerformanceChart` · `DARRawChart` · `DARStackedChart` | graphiques | dashboard | **déclarent Space Mono / DM Sans, jamais chargées** |

## Couche d'accès et services

| Fichier | Rôle | Risque |
|---|---|---|
| **`src/lib/ctpApi.ts`** | **point d'accès unique à Supabase** — auth, équipes, séances, questionnaires, métriques, board DAR, consentements, admin, purge | **le fichier le plus critique du front** |
| `src/lib/supabase.ts` | client + `USE_SUPABASE` | l'interrupteur |
| `src/services/vapidPush.ts` | souscription et resynchronisation push | compliance |
| `src/services/webNotifications.ts` · `fcmService.js` | chemin Firebase | ne pas supprimer avant M8 |
| `src/lib/firebase.ts` · `services/firebaseConfig.js` | clients Firebase | idem |
| `src/lib/scheduleQueries.ts` / `scheduleQueriesSupabase.ts` | requêtes planning, deux backends | |
| `src/utils/analytics.ts` · `useDARAlgorithm.ts` | calculs client hérités | **le calcul fait autorité est en SQL** |
| `src/utils/questionnaireTemplates.ts` | modèles Firestore | doublon du système Postgres |
| `src/theme/tokens.ts` | `courtlight` (autorité) ; `da` supprimé | cohérence visuelle |

## Backend Supabase

**19 migrations** — 001 schéma · 002 RLS · 003 moteur · 004 règles placeholder · 005 `security_invoker` · 006 seed initial · 007 RPC calendrier · 008 moteur v2 · 009 push · 010 lecture santé admin · 011 policy UPDATE push · 012 questionnaires NCAA · 013 moteur de charge · 014 baselines par axe · 015 durcissement · 016 pseudonymes et purge · 017 consentements · 018 moteur par athlète · 019 fenêtre de réponse.

**8 edge functions** — voir `PROJECT_SOURCE_OF_TRUTH.md` §15. `_shared/webpush.ts` (318 l. de cryptographie) et `_shared/llm.ts` (unique point d'appel Anthropic) sont les deux fichiers sensibles.

`supabase/seed_demo_roster.sql` — génération et purge des 15 athlètes de démonstration.

## Assets et PWA

`public/icons/*` (6 icônes régénérées depuis le logo officiel) · `public/logo/*` (lockups) · `assets/*` (Expo : icon, adaptive, splash, favicon) · `public/manifest.json` · `public/ctp-sw.js` (SW VAPID) · `public/firebase-messaging-sw.js` (SW Firebase) · `public/legal/*.html` (3 pages juridiques).

Fond de marque unique : **`#070B14`**.

## Scripts de build

`scripts/copy-service-worker.js` (copie les SW — **sans lui, aucune notification**) · `inject-metadata.js` · `verify-build.js` (garde-fou de build) · `generate-og-image.js` · `scripts/migration/*.mjs` (export/transform Firestore, historique).

## Documentation

`docs/01` état initial · `02` **moteur de règles, l'établi du fondateur** · `03` DA v2 · `04` vision 10 ans · `05` support commercial · `06` **Courtlight, fait autorité sur le 03** · `07` contrat de parité · `08` **cartographie technique** · `09` audit et roadmap · `10` système visuel relevé · `11` **audit backend, 26 anomalies** · `12` conformité US · `13` documents juridiques · `14` durcissement sécurité · `15` **questionnaire NCAA v3** · `16` **lecture du tableau coach + script commercial** · `CHANGELOG_IMPLEMENTATION.md` **(journal daté, la meilleure source de « pourquoi »)** · `GUIDES/` fiches d'action.
