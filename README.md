# ChampionTrackPro V2 — Réplique propre + Kit de migration Supabase + Couche LLM

**Produit autonome : le monitoring tourne seul. Les règles d'interprétation appartiennent à Gabin et seront branchées plus tard (table `rules`, tout est `enabled=false`). Aucune intervention humaine requise dans la boucle produit.**

---

## 1. Ce que contient ce dossier

| Zone | Contenu | État |
|---|---|---|
| Racine, `src/`, `screens/`, `navigation/`, `services/`, `web/` | **67 fichiers réellement utilisés** par l'app, tracés par graphe d'imports depuis `index.js` / `App.js` / `app.config.js`. Copie exacte, zéro modification de code. | ✅ Fonctionnel (Firebase) |
| `assets/`, `public/` | Logos et icônes utiles uniquement (le `public/` d'origine faisait 41 Mo de variantes et pages de démo ; ici ~300 Ko). | ✅ |
| `functions/` | Les 13 Cloud Functions Firebase actuelles (notifications, sync ICS, membership). | ✅ Inchangées |
| `supabase/migrations/` | Schéma relationnel complet, RLS multi-tenant, moteur de calcul en SQL, squelette de règles. | 🔧 Prêt à appliquer |
| `supabase/functions/` | `compute-metrics` (calcul+règles), `morning-brief` (narration LLM Anthropic), `_shared/llm.ts`. | 🔧 Prêt à déployer |
| `scripts/migration/` | Export Firestore → JSON, transform & load → Postgres, vérification d'intégrité. | 🔧 Prêt |
| `src/lib/supabase.ts` + `.env.example` | Client Supabase **non branché** — bascule par `EXPO_PUBLIC_USE_SUPABASE=1`. | 🔧 |

**Exclus volontairement** (parasites de l'original) : ~50 scripts debug/seed racine, tous les `.bak`, écrans dupliqués non importés (`screens/Login.js`, `src/screens/CoachDashboard.js`, etc.), pages de démo personnalisées (`public/brenda|gsu|king|pilot`), 3 service workers de backup, doubles configs metro.

**Corrigé au passage** : 3 images cassées en prod — le code référence `/icons/icon-192.png`, `/icons/icon-512.png` et `/logo/logo_clean.png` qui n'existaient pas dans `public/` ; ils existent ici.

## 2. Démarrer

```bash
npm install
npm run web          # dev web (Firebase, comme avant)
npm run web:build    # build Vercel identique à l'original
```

## 3. La chaîne produit (automatisée de bout en bout)

```
Séance ICS → notification push fin de séance → questionnaire athlète (mobile)
→ responses (Postgres) → trigger → compute-metrics :
   MAILLON 1  CALCUL   port SQL exact des calculs existants
              (EMA 28 j α=0.069, déviation %, zones ±15 %, readiness pondéré serveur)
   MAILLON 2  RÈGLES   table `rules` — VIDE DE LOGIQUE, enabled=false partout.
              Hiérarchisation par champ `priority`. ← INGÉNIERIE GABIN, PLUS TARD
→ morning-brief (cron 6 h) :
   MAILLON 3  LLM      Anthropic API, payload pseudonymisé (P-07), zéro rétention,
              chaque phrase citable ; sans règles actives il narre les chiffres
              sans prescription. Brief stocké + coût loggé (llm_logs).
→ Morning Brief coach + boutons feedback (coach_feedback : useful / noise /
   acknowledged / overridden)
```

**Le carburant de ton futur entraînement de modèle** : `coach_feedback` (ce que les coachs jugent utile vs bruit) croisé avec `v_ai_dataset` (métriques pseudonymisées). C'est cette boucle qui fera "apparaître ce qui est important pour la décision coach" — avec des données réelles, pas des suppositions.

## 4. Runbook migration Firestore → Supabase (M0-M8)

1. **M0** Créer le projet Supabase — **région US East** (clients NCAA), plan Free pour migrer.
2. **M1-M3** `supabase db push` (les 4 fichiers de `supabase/migrations/` dans l'ordre).
3. **M4** `node scripts/migration/export-firestore.mjs` (service account Firebase).
4. **M5** Créer les comptes via `auth.admin.createUser`, remplir `userMap`, puis `node scripts/migration/transform-load.mjs`. Vérifier les comptes affichés (src = loaded).
5. **M6** Rebrancher l'app : `EXPO_PUBLIC_USE_SUPABASE=1` + réécrire les data-hooks (`src/lib/*.ts`, listeners → Realtime). *Seule étape de vrai dev — à faire écran par écran.*
6. **M7** Déployer les edge functions : `supabase functions deploy compute-metrics morning-brief` + `supabase secrets set ANTHROPIC_API_KEY=...` + webhook DB sur `responses` + pg_cron 6 h pour le brief. Re-porter la sync ICS et les push FCM.
7. **M8** Run parallèle : Firestore en lecture seule, comparer `daily_metrics` vs dashboards actuels, puis couper.

## 5. Design

Structure visuelle et logique inchangées (thème sombre `#0A0F1E`, tokens dans `src/theme/tokens.ts` + `src/constants/theme.ts`, logos officiels dans `public/logo/`). Améliorations faites : assets réparés (cf. §1), `public/` assaini. Une passe design réelle (Landing, Morning Brief UI, écrans coach) se fait sur app lancée — session dédiée recommandée, jamais à l'aveugle.

## 6. Ce qui attend Gabin (et rien d'autre)

1. Remplir/activer les règles dans `rules` (conditions, seuils, textes de reco, priorités) — fichier de départ : `004_seed_rules_placeholder.sql`.
2. Choisir le questionnaire définitif (V3 actuel copié tel quel ; V4 9-sliders documenté dans `Fichiers consignes - audit - report/`).
3. Décider la mesure de charge (sans elle, `workload_au` et ACWR restent NULL — assumé).
