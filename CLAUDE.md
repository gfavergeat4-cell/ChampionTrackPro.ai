# CLAUDE.md — ChampionTrackPro V2 · Document-mère
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

## 3. Cartographie du repo
```
CLAUDE.md                ← ce fichier
CONSTITUTION.md          ← lois + amendements datés
GUIDE_ACTIONS_GABIN.md   ← checklist manuelle du fondateur
README.md                ← runbook migration M0-M8 + démarrage
docs/
  01_ETAT_DU_PROJET_HANDOVER.md      ← état exact, comptes test, problèmes ouverts
  02_MOTEUR_DE_REGLES_SPORT_SCIENCE.md ← l'établi de Gabin : ~20 règles DRAFT sourcées
  03_DIRECTION_ARTISTIQUE.md         ← DA « Stadium at night », tokens, doctrine 3D
  04_VISION_PRODUIT_10_ANS.md        ← mission, workflow canonique, actes 1-5
  CHANGELOG_IMPLEMENTATION.md        ← journal des modifs (À TENIR À JOUR à chaque session)
supabase/
  migrations/001-008     ← schéma, RLS, moteur SQL (EMA/zones/z-score), seeds, RPC
  functions/             ← compute-metrics · morning-brief · join-team · ics-sync (+ _shared/llm.ts)
src/lib/ctpApi.ts        ← COUCHE D'ACCÈS UNIQUE Supabase (tout écran migré passe par là)
src/lib/supabase.ts      ← client + flag USE_SUPABASE (.env)
src/theme/tokens.ts      ← export `da` = tokens DA v2 (utiliser pour tout nouvel écran)
src/screens/CoachHomeSupabase.tsx / AthleteHomeSupabase.tsx ← écrans migrés de référence
screens/Stitch*.js       ← écrans historiques (Login/CreateAccount/Questionnaire = migrés par branches USE_SUPABASE ; le reste = Firebase)
navigation/StitchNavigator.js ← AuthGate double (Supabase/Firebase) + routage par rôle
functions/index.js       ← anciennes Cloud Functions Firebase (ENCORE ACTIVES — extinction en M8, pas avant)
```

## 4. Infrastructure (prod)
- **Supabase** projet `wiopzitygsgincztwquz` (US East). Auth email/password, **Confirm email désactivé** (le réactiver casse l'inscription — quota emails).
- **Webhook DB** `on-response-submitted` : INSERT `responses` → edge `compute-metrics`.
- **Crons pg_cron** : `morning-brief-daily` 11h UTC (corps `{}` = toutes équipes) · `ics-sync-15min` (vérifier son existence).
- **Secrets** : `ANTHROPIC_API_KEY` via `supabase secrets`. Modèles : quotidien classe Haiku (~0,05 ¢/brief), synthèses lourdes classe Sonnet.
- **Comptes test** : athlète P-01, coach P-02, équipe « Pilot Team », code `CTP-PILOT`. `.env` local présent (gitignoré).

## 5. État & backlog priorisé (détail : docs/01 §5-6)
✅ Fait : blocs A-D + E1 code (auth, adhésion, questionnaire→Postgres, webhook→calcul, brief LLM, écran coach avec feedback, accueil athlète, import calendrier self-serve coach, moteur v2 z-score, brief multi-équipes, tokens DA).

Backlog, dans l'ordre :
1. **Clore E1** : test `ics-sync` en suspens — curl renvoie `upserted:0` ; diagnostiquer via `ics_bytes` (calendrier Google pas public ? → adresse secrète iCal). Limitation connue : TZID traité comme UTC → à corriger proprement.
2. **E2 Notifications** (priorité produit n° 1 : sans push, la compliance meurt) : cron minute → séances terminées → push athlètes + relances (vision Gabin : 20/40/60 min, table `pendingReminders`) + notif staff quand brief prêt. Choix d'infra À PROPOSER à Gabin avant d'implémenter : Web Push VAPID natif (candidat privilégié, zéro Firebase) vs garder FCM vs email Resend.
3. **Écrans restants** → migrer sur `ctpApi` : Schedule (lit `sessions`), Profile (+ **logout Supabase**, manquant), Analytics/PerformanceDashboard (lit `daily_metrics`), CoachTeam. Modèle à suivre : `CoachHomeSupabase.tsx`.
4. **Console admin** (Gabin) : créer org/équipe, lister ses équipes, générer codes, santé des crons. RPC service-role à créer (pattern `join-team`).
5. **Création de séance in-app** coach (colonnes `planned_load/objective/group_label` prêtes — migration 008) + UI cycles.
6. **Déploiement Vercel** (`npm run web:build`, sortie `web/dist`, `vercel.json` présent).
7. **M8 extinction Firebase** : seulement quand E2 fait + run parallèle vérifié (comparer chiffres) ; alors supprimer les CF Firebase, FCM, et les branches `!USE_SUPABASE`.

## 6. Consignes par domaine
- **Design** : appliquer `docs/03` — tokens `da` de `src/theme/tokens.ts`, fond `#0A0F1E`, UN seul élément lumineux par écran (glow = hiérarchie), zones GREEN/BLUE/YELLOW sacrées (jamais décoratives), jamais d'info par la couleur seule, cibles ≥ 44 pt, contraste AA, animations ≤ 700 ms, budgets : athlète ≤ 60 s, coach ≤ 90 s. 3D : landing seulement, jamais dans les écrans quotidiens.
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
