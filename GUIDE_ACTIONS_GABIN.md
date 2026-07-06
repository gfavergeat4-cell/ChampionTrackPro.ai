# GUIDE D'EXÉCUTION — Ce que TU fais maintenant, manuellement, dans l'ordre
**ChampionTrackPro V2 — de dossier propre à produit qui tourne chez un staff NCAA.**
**Règle du guide : chaque étape a un livrable vérifiable. Ne passe pas à la suivante sans lui. Coche au fur et à mesure.**

---

## PHASE 0 — Valider que la V2 tourne (aujourd'hui, ~30 min)

- [ ] Ouvre un terminal dans `C:\GAB\PRO\ChampionTrackPRO\APP\ChampionTrackPro-V2`
- [ ] `npm install` (5-10 min)
- [ ] `npm run web` → l'app s'ouvre dans le navigateur, login fonctionne (elle pointe vers TON Firebase actuel, mêmes données)
- [ ] Teste le parcours complet : login athlète → questionnaire → login coach → dashboard
- [ ] Si un écran casse : note-le, on le corrige ensemble — ne bricole pas seul dans le code

**Livrable : l'app V2 tourne en local. Sinon, STOP, on debug ensemble avant tout le reste.**

## PHASE 1 — Mettre la V2 sous Git propre (aujourd'hui, ~15 min)

- [ ] Crée un repo GitHub **privé** neuf : `championtrackpro-v2` (ne réutilise pas l'ancien)
- [ ] Dans le dossier V2 :
```bash
git init
git add .
git commit -m "V2 clean baseline - 67 fichiers traces + kit supabase + couche LLM"
git branch -M main
git remote add origin https://github.com/TON_USER/championtrackpro-v2.git
git push -u origin main
```
- [ ] Règle d'or désormais : **plus jamais de fichier `.bak`** — Git est ta machine à remonter le temps

**Livrable : repo GitHub propre, 1er commit.**

## PHASE 2 — Créer le projet Supabase (jour 2, ~45 min)

- [ ] Compte sur supabase.com → **New project**
- [ ] Nom : `championtrackpro` — **Région : East US (North Virginia)** — plan Free
- [ ] Note dans un gestionnaire de mots de passe : le **database password**, l'**URL du projet**, la clé **anon**, la clé **service_role** (Settings → API)
- [ ] Installe le CLI : `npm install -g supabase` puis `supabase login`
- [ ] Depuis le dossier V2 : `supabase link --project-ref TON_REF` (le ref est dans l'URL du projet)
- [ ] Applique le schéma : `supabase db push` → vérifie dans Table Editor que `teams`, `responses`, `daily_metrics`, `rules`, `briefs`, `coach_feedback` existent
- [ ] Copie `.env.example` → `.env`, remplis `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` (laisse `USE_SUPABASE=0` pour l'instant)

**Livrable : base Postgres vivante avec les 15 tables + RLS. L'app n'y touche pas encore — normal.**

## PHASE 3 — Clé Anthropic + edge functions (jour 2-3, ~45 min)

- [ ] Compte sur console.anthropic.com → **API Keys** → crée `ctp-production` → charge 5 $ de crédit (ça suffit pour des mois de briefs)
- [ ] `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
- [ ] Déploie : `supabase functions deploy compute-metrics morning-brief`
- [ ] Test manuel du brief (remplace REF et ANON) :
```bash
curl -X POST https://TON_REF.supabase.co/functions/v1/morning-brief -H "Authorization: Bearer TA_CLE_ANON" -H "Content-Type: application/json" -d "{\"team_id\":\"00000000-0000-0000-0000-000000000000\"}"
```
→ réponse `ok` = la tuyauterie LLM fonctionne (brief vide, base vide : normal)

**Livrable : un appel LLM part et revient, coût loggé dans `llm_logs`.**

## PHASE 4 — ~~Migration Firestore~~ ANNULÉE (base vide) → Seed + branchement auto

Firestore est vide : aucune migration nécessaire. L'app passe directement en Supabase-natif. À la place :

- [ ] **4a. Seed initial** : `supabase db push` (migration 006 : organisation + équipe pilote code `CTP-PILOT` + questionnaire Basketball V3)
- [ ] **4b. Webhook** (déclenche le calcul à chaque réponse) : Dashboard → **Database → Webhooks** → Create → table `responses`, événement `INSERT`, type **Supabase Edge Function** → `compute-metrics` → Create
- [ ] **4c. Cron du Morning Brief** : Dashboard → **Database → Extensions** → active `pg_cron` et `pg_net`, puis SQL Editor :
```sql
select cron.schedule('morning-brief-daily', '0 11 * * *',  -- 11h UTC = 6h ou 7h heure US Est
  $$select net.http_post(
      'https://wiopzitygsgincztwquz.supabase.co/functions/v1/morning-brief',
      '{"team_id":"b0000000-0000-4000-8000-000000000001"}'::jsonb,
      headers := '{"Content-Type":"application/json","Authorization":"Bearer TA_CLE_ANON"}'::jsonb)$$);
```

**Livrable : à chaque réponse insérée → métriques calculées ; chaque matin → brief généré.**

## PHASE 5 — TON ingénierie (la seule chose que personne ne peut faire à ta place)

C'est le cœur produit. Sessions de travail dédiées, pas entre deux emails :

- [ ] **5a. Questionnaire définitif** : tranche V3 actuel vs V4 (specs prêtes dans `ChampionTrackPro_-main/Fichiers consignes - audit - report/`) — décision + poids + mesure de charge oui/non
- [ ] **5b. Règles d'interprétation** : ouvre `supabase/migrations/004_seed_rules_placeholder.sql` — pour chaque règle R-01 → R-07 : condition exacte, seuil, jours de données minimum, ta phrase de recommandation (celle que le LLM citera mot pour mot), priorité d'affichage
- [ ] **5c. Hiérarchisation coach** : liste ce qui doit remonter EN PREMIER dans le brief (ton insight : l'entraînement d'abord, le repérage ensuite)
- [ ] Quand c'est écrit → on active ensemble (`enabled=true`) et on teste sur tes données migrées

**Livrable : le Morning Brief parle avec TES mots et TA hiérarchie. C'est ça, le produit.**

## PHASE 6 — Rebrancher l'app sur Supabase (avec moi, ~1-2 semaines de sessions)

Étape M6 du README : réécrire les data-hooks écran par écran (Firestore → Supabase Realtime), `USE_SUPABASE=1`, run parallèle, comparaison des chiffres, puis coupure Firebase. **Ne commence pas seul** — on le fait ensemble, écran par écran, app lancée.

- [ ] Redéploie sur Vercel depuis le nouveau repo (import GitHub → framework Expo/static → `npm run web:build`, output `web/dist`)

## PHASE 7 — EN PARALLÈLE DE TOUT : le pilote (c'est lui qui décide de tout le reste)

Le produit n'existe que s'il tourne chez un staff. Pendant que les phases 2-6 avancent :

- [ ] Relance tes leads chauds dans l'ordre : King (Gillespie), Emory & Henry (WhatsApp direct), WV State, Washburn, Minot State — avec le Morning Brief V2 en visuel, date ferme proposée dans chaque message (BAMFAM)
- [ ] Objectif : **1 équipe qui fait le check-in quotidien pendant 8 semaines dès la pré-saison (août-septembre 2026)**
- [ ] 3 métriques de vérité à tracker dès le jour 1 : taux de réponse athlètes (cible >70 %), briefs ouverts par le staff, flags jugés utiles vs bruit (`coach_feedback` est déjà dans la base pour ça)

---

## CE QUE TU NE FAIS PAS (discipline)

- ❌ Pas de refonte design avant que le pilote tourne — le thème actuel est vendable
- ❌ Pas de multi-agents, pas de features nouvelles, pas de 4ᵉ audit
- ❌ Pas de code modifié dans `ChampionTrackPro_-main` (l'original est figé, c'est ton filet de sécurité)
- ❌ Pas de démarrage de la Phase 6 sans avoir fini les Phases 4 et 5

## ORDRE RÉSUMÉ ET CHARGE RÉELLE

| Semaine | Toi | Nous deux |
|---|---|---|
| S1 | Phases 0-3 (~2 h 30 réparties) + relances leads | Debug éventuel Phase 0 |
| S2 | Phase 4 export + Phase 5a/5b (tes règles) | Session migration données |
| S3-S4 | Phase 5 finalisée + pipeline commercial | Phase 6 écran par écran |
| S5+ | Pilote signé, onboarding équipe | Activation règles + brief réel |

**Le chemin critique n'est pas technique : c'est 5b (tes règles) et 7 (un staff qui dit oui). Tout le reste est de la plomberie que je fais avec toi.**
