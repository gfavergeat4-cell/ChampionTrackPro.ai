# CLAUDE.md — ChampionTrackPro V2 · Document-mère

> **NOUVEAU SUR CE PROJET ?** Commence par `HANDOFF/CLAUDE_CODE_HANDOFF.md`, pas par ce fichier.
> Le dossier `HANDOFF/` contient la passation complète : source de vérité, bugs et solutions échouées,
> décisions d'architecture, matrice de fonctionnalités, liste de ce qu'il ne faut pas casser.
**Tu es le développeur senior de ce produit. Ce fichier t'oriente ; les détails vivent dans les documents référencés. Ordre de lecture au premier lancement : ce fichier → `CONSTITUTION.md` → `docs/01` → le bloc sur lequel tu travailles.**

---

## 1. Ce qu'on construit (10 secondes)
Système d'aide à la décision pour staffs de basketball NCAA : check-in athlète 60 s post-séance → moteur déterministe (baseline individuelle EMA 28 j, z-scores, zones) → règles écrites par Gabin (fondateur, expert sport science — table `rules`) → narration LLM traçable → Morning Brief coach + feedback useful/noise (futur dataset d'apprentissage). Produit autonome : aucun humain ChampionTrackPro dans la boucle quotidienne ; le coach décide, toujours.

## 2. LOIS (violations interdites — détail : `CONSTITUTION.md`)
1. **Chaîne intangible** : CALCUL (code/SQL) → RÈGLES (Gabin, versionnées) → TRADUCTION (1 appel LLM, payload pseudonymisé P-xx, chaque phrase cite un chiffre) → DÉCISION (coach, tracée).
2. **Ne JAMAIS inventer/activer une règle d'interprétation** : la table `rules` est la propriété de Gabin. Propositions = DRAFT dans `docs/02`. `enabled=true` = décision de Gabin uniquement.
3. **Pas d'orchestrateur multi-agents LLM** (art. 4/11) : les "agents" métier (Charge, Fatigue, Tendances…) = modules déterministes du moteur. Gén. 2/3 verrouillées par portes mesurables (`docs/04 §5`).
4. Jamais : prédiction de blessure individuelle, décision automatique de repos, conseil médical, promesse de résultat sportif.
5. RLS multi-tenant non négociable. Secrets jamais en clair (ni code, ni chat, ni commit).
6. Auditer avant de modifier ; produit fonctionnel à chaque commit ; les chemins Firebase restent intacts derrière `if (USE_SUPABASE)` jusqu'à l'étape M8.

## 2bis. LOI DE PARITÉ (15 juil. — prime sur toute interprétation)
L'ancienne version en ligne (`APP/ChampionTrackPro-LIVE`, dépôt `ChampionTrackPro_`, domaine `champtrackpro.com`) fait foi pour fonctionnalités, écrans, questionnaires, textes et timings de notifications, workflows et console admin. V2 = copie exacte nettoyée + backend SQL + améliorations validées par Gabin (Courtlight). Ne JAMAIS improviser un contenu ou une règle qui existe déjà dans l'ancien code : ouvrir, copier, nettoyer. Détail et matrice : `docs/07_CONTRAT_DE_PARITE.md`.

## 3. Cartographie du repo
```
HANDOFF/                 ← ★ DOSSIER DE PASSATION — à lire en premier si tu reprends le projet
CLAUDE.md                ← ce fichier
CONSTITUTION.md          ← lois + amendements datés
GUIDE_ACTIONS_GABIN.md   ← checklist manuelle du fondateur
README.md                ← runbook migration M0-M8 + démarrage
docs/
  01_ETAT_DU_PROJET_HANDOVER.md      ← état exact, comptes test, problèmes ouverts
  02_MOTEUR_DE_REGLES_SPORT_SCIENCE.md ← l'établi de Gabin : ~20 règles DRAFT sourcées
  03_DIRECTION_ARTISTIQUE.md         ← DA « Stadium at night », tokens, doctrine 3D
  04_VISION_PRODUIT_10_ANS.md        ← mission, workflow canonique, actes 1-5
  06_REDESIGN_COURTLIGHT.md          ← langage visuel propriétaire (fait autorité sur le 03)
  07_CONTRAT_DE_PARITE.md            ← matrice ancien ↔ nouveau (loi de parité)
  08_CARTOGRAPHIE_TECHNIQUE.md       ← ★ STRUCTURE RÉELLE DE L'APP. À lire avant toute modif
                                        structurelle, et à mettre à jour DANS LE MÊME COMMIT.
  09_AUDIT_ET_ROADMAP.md             ← manques constatés + séquence L1-L7 avec critères de sortie
  CHANGELOG_IMPLEMENTATION.md        ← journal des modifs (À TENIR À JOUR à chaque session)
supabase/
  migrations/001-019     ← schéma, RLS, moteur SQL, seeds, push, questionnaires NCAA,
                            durcissement, purge, consentements, moteur par athlète
  functions/             ← compute-metrics · morning-brief · session-watcher · notify ·
                            ics-sync · join-team · create-team · admin-purge (+ _shared/{llm,webpush}.ts)
src/lib/ctpApi.ts        ← COUCHE D'ACCÈS UNIQUE Supabase (tout écran migré passe par là)
src/lib/supabase.ts      ← client + flag USE_SUPABASE (.env)
src/theme/tokens.ts      ← export `courtlight` (fait autorité). `da` a été SUPPRIMÉ (0 consommateur)
src/screens/CoachHomeSupabase.tsx ← Morning Brief · CoachBoard.tsx ← tableau DAR
src/screens/QuestionnaireCourtlight.tsx ← check-in · ConsentGate.tsx ← acceptation légale
(AthleteHomeSupabase / ScheduleScreenSupabase = DÉBRANCHÉS, conservés sans usage)
screens/Stitch*.js       ← écrans historiques (Login/CreateAccount/Questionnaire = migrés par branches USE_SUPABASE ; le reste = Firebase)
navigation/StitchNavigator.js ← AuthGate double (Supabase/Firebase) + routage par rôle
functions/index.js       ← anciennes Cloud Functions Firebase (ENCORE ACTIVES — extinction en M8, pas avant)
```

## 4. Infrastructure (prod)
- **Supabase** projet `wiopzitygsgincztwquz` (US East). Auth email/password, **Confirm email désactivé** (le réactiver casse l'inscription — quota emails).
- **Webhook DB** `on-response-submitted` : INSERT `responses` → edge `compute-metrics`.
- **Crons pg_cron** : `morning-brief-daily` 11h UTC · `session-watcher-1min` · `ics-sync-15min` (existence réelle à revérifier).
- **Secrets** : `ANTHROPIC_API_KEY` via `supabase secrets`. Modèles : quotidien classe Haiku (~0,05 ¢/brief), synthèses lourdes classe Sonnet.
- **Comptes test** : équipe « Pilot Team » `b0000000-0000-4000-8000-000000000001`. **Deux codes** : `CTP-PILOT` (athlètes) et un code staff `-C` (voir `select coach_code from teams`).
- **Données de démonstration** : 15 athlètes `DEMO …`, ~1 200 réponses, 2 mois d'historique. Purge en fin de `supabase/seed_demo_roster.sql`.
- `.env` local présent (gitignoré). Variables `EXPO_PUBLIC_*` figées à la compilation.

## 5. État & backlog priorisé (détail : `HANDOFF/FEATURE_STATUS.md` et `docs/09` §12)

✅ **Vérifié en exécution réelle le 15/08/2026** : notification push reçue sur appareil · check-in soumis · `session_load` et `workload_au` calculés (premiers du projet) · ACWR vivant · tableau coach multi-marqueurs peuplé · consentement horodaté · moteur par athlète validé à zéro écart.

✅ Fait : auth + adhésion à rôle serveur · questionnaire NCAA (5 variantes) · moteur complet (readiness, EMA, zones, charge, ACWR, axes) · Morning Brief LLM · CoachBoard DAR · console santé admin · consentements versionnés · purge et export d'athlète · assets de marque.

Backlog, dans l'ordre :
1. **Activer 3 à 5 règles d'interprétation** (`docs/02`) — **décision fondateur**, hors développement. Sans elles le brief décrit sans dire ce qui compte.
2. Confirmation d'email (nécessite un SMTP) · boîte `privacy@` · journal d'accès · MFA staff.
3. Tester le push sur **iOS** (exige l'installation de la PWA) et les relances +3 h / +6 h en réel.
4. Performance : `morning-brief` et `ics-sync` en série · `getAdminSystemHealth` en 8N+1 · bucket journalier en UTC alors que `teams.timezone` existe.
5. Décisions en attente : zones ±10 vs ±15 % · moyenne d'équipe vs distribution · cyan de marque · formulations du questionnaire.
6. Sélecteur d'équipe (`getMyMembership` est non déterministe en multi-équipes).
7. **M8 extinction Firebase** : 34 fichiers actifs le référencent encore. Seulement après run parallèle vérifié.

## 6. Consignes par domaine
- **Design** : appliquer `docs/06` (fait autorité sur le 03) — tokens `courtlight`, fond `#070B14`, UN seul élément lumineux par écran (glow = hiérarchie), zones GREEN/BLUE/YELLOW sacrées (jamais décoratives), jamais d'info par la couleur seule, cibles ≥ 44 pt, contraste AA, animations ≤ 700 ms, budgets : athlète ≤ 60 s, coach ≤ 90 s. 3D : landing seulement, jamais dans les écrans quotidiens.
- **Moteur/règles** : nouvelles grandeurs de calcul = vues SQL dans une migration (pattern 003/008) + stockage `daily_metrics` + changelog. Les seuils restent en base (table `rules`), jamais en dur dans le code.
- **LLM** : uniquement `_shared/llm.ts`. Ne jamais élargir le payload au-delà de scores+flags+textes de règles pseudonymisés. Logguer coût dans `llm_logs`.
- **Data** : toute écriture côté client passe la RLS ; toute écriture privilégiée passe par une edge function service-role. `coach_feedback` est sacré (futur dataset) — ne jamais le purger.
- **Science** : formulations autorisées = signal/visibilité/information. Bannies = prédit/prévient/diagnostique/remplace. ACWR = descriptif, controverse signalée (docs/02 §2).

## 7. Environnement de travail
- Machine : Windows + **PowerShell 5** → PAS de `&&` (une commande par ligne ou `;`), `curl.exe` (pas `curl`), `Remove-Item -Recurse -Force`.
- Dev : `npx expo start --web --clear` (localhost:8081). Node 24. Deux sessions navigateur : normale = athlète, privée = coach.
- Supabase CLI : `supabase db push` (migrations), `supabase functions deploy <name>`, `supabase secrets set`.
- Git : commits fréquents, messages descriptifs français, jamais de secret ni `node_modules` (`.gitignore` en place).
- **Après CHAQUE modification significative : entrée datée dans `docs/CHANGELOG_IMPLEMENTATION.md`.**

## 8. Test de santé de la chaîne (à lancer après tout changement moteur)
1. Insérer une séance test SQL (end_utc = now()−2 min) → 2. Athlète répond via l'app (ou deep link `/?screen=questionnaire&trainingId=…&teamId=…`) → 3. Vérifier `responses` +1 ET `daily_metrics` +1 (= webhook OK) → 4. `curl.exe` morning-brief → `briefs` contient un texte qui cite les chiffres → 5. Coach voit le brief, clique Useful → `coach_feedback` +1. Si les 5 passent, la chaîne vit.

## 9. Le patron
Gabin Favergeat — fondateur, expert entraînement (M2 EOPS, méthodo Morin, preuve Cesson-Rennes D1). Français, direct, zéro flatterie. Lui donner UNE action à la fois avec le résultat attendu ; il exécute vite mais relance parfois des commandes déjà réussies. S'il colle un secret dans le chat : le stopper et faire révoquer. Ses domaines réservés : règles d'interprétation, science, pricing, vente, vision. Ton KPI unique : la réussite réelle de ce produit — ce qui inclut le contredire quand une demande affaiblit le produit.
