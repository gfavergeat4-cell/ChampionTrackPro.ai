# NEW_CLAUDE_STARTUP_CHECKLIST

À suivre **dans l'ordre**. Ne passe pas à la phase suivante tant que la précédente n'est pas cochée.

---

## PHASE 1 — COMPRENDRE

- [ ] Lire `HANDOFF/CLAUDE_CODE_HANDOFF.md`
- [ ] Lire `HANDOFF/PROJECT_SOURCE_OF_TRUTH.md`
- [ ] Lire `HANDOFF/DO_NOT_BREAK.md`
- [ ] Lire `HANDOFF/KNOWN_ISSUES.md` — **en particulier la partie 2, les solutions déjà échouées**
- [ ] Lire `HANDOFF/ARCHITECTURE_DECISIONS.md`
- [ ] Lire `HANDOFF/FEATURE_STATUS.md`
- [ ] Lire `HANDOFF/PROJECT_INVENTORY.md`
- [ ] Lire `CLAUDE.md` et `CONSTITUTION.md` à la racine
- [ ] Parcourir `docs/CHANGELOG_IMPLEMENTATION.md` en partant de la fin — c'est le raisonnement derrière le code

## PHASE 2 — INSPECTER

- [ ] `git log --oneline -20` et `git status`
- [ ] `package.json` : scripts, dépendances, `engines.node`
- [ ] `app.json`, `app.config.js`, `vercel.json`, `public/manifest.json`
- [ ] `navigation/StitchNavigator.js` en entier — c'est le cœur
- [ ] `src/lib/ctpApi.ts` en entier — c'est la couche d'accès unique
- [ ] `src/lib/supabase.ts` et la valeur réelle de `EXPO_PUBLIC_USE_SUPABASE`
- [ ] Les 19 migrations, dans l'ordre
- [ ] Les 8 edge functions
- [ ] `supabase/migrations/002_rls.sql` + les policies ajoutées en 010, 015, 017
- [ ] Le tableau de bord Supabase : tables réelles, policies réelles, **crons réels**, secrets configurés
- [ ] Vercel : variables d'environnement du projet `champion-track-pro-ai`

## PHASE 3 — VÉRIFIER

- [ ] Le schéma réel en base correspond-il aux migrations ? (`information_schema`)
- [ ] Les crons `morning-brief-daily`, `session-watcher-1min`, `ics-sync-15min` existent-ils **réellement** ?
- [ ] Le webhook `on-response-submitted` est-il actif ?
- [ ] Les edge functions déployées correspondent-elles au code du dépôt ?
- [ ] `select key, version, status from legal_documents;` — `draft` ou `active` ?
- [ ] `select count(*) from rules where enabled;` — **doit valoir 0**
- [ ] Lister les contradictions trouvées entre documentation et code
- [ ] Lister les informations manquantes

## PHASE 4 — EXÉCUTER

- [ ] `npm install`
- [ ] `npx expo start --web --clear` → `localhost:8081`
- [ ] Se connecter en coach, en athlète, en admin (trois sessions : normale, privée, autre navigateur)
- [ ] `npm run web:build` → doit finir sur `[VERIFY] BUILD VERIFICATION PASSED`
- [ ] Vérifier la console : erreurs, avertissements, lignes `[VAPID]` et `[SUPA]`
- [ ] Dérouler le **test de santé de la chaîne** (`PROJECT_SOURCE_OF_TRUTH` §31)

## PHASE 5 — RAPPORTER

- [ ] Produire le **PROJECT TAKEOVER REPORT** : `UNDERSTANDING · CURRENT STATE · ARCHITECTURE · WHAT WORKS · KNOWN ISSUES · RISKS · CONTRADICTIONS · MISSING INFORMATION · PROPOSED NEXT STEPS`
- [ ] Lister les questions qui exigent une décision du fondateur
- [ ] Proposer un ordre de travail argumenté

## PHASE 6 — DÉVELOPPER

- [ ] Seulement maintenant.
- [ ] Une entrée datée dans `docs/CHANGELOG_IMPLEMENTATION.md` **à chaque modification significative**
- [ ] Mettre à jour `docs/08_CARTOGRAPHIE_TECHNIQUE.md` **dans le même commit** pour toute modification structurelle
- [ ] Mettre à jour `HANDOFF/CONTEXT_VERSION.md`

---

## Commandes de référence

```powershell
# Environnement : Windows + PowerShell 5 — pas de &&, une commande par ligne
cd C:\GAB\PRO\ChampionTrackPRO\APP\ChampionTrackPro-V2

npx expo start --web --clear     # développement, localhost:8081
npm run web:build                # build de production
supabase functions deploy <nom>  # déploiement d'une edge function
git add -A
git commit -m "message descriptif en français"
git push origin main             # déclenche Vercel
```

Les migrations SQL ne sont **pas** appliquées par `supabase db push` (nommage sans horodatage). Elles se collent dans le SQL editor. L'éditeur exécute tout dans **une transaction** : une erreur en fin de script annule tout ce qui précède.
