# DO_NOT_BREAK

Ce que tu casses ici casse le produit, la sécurité, ou la confiance d'un client. Chaque modification doit être confrontée à cette liste.

---

## 1. La table `rules` et son mécanisme
**Ne jamais** écrire, activer ou modifier une règle d'interprétation. `enabled = false` partout est un état voulu, pas un oubli. `eval_rule()` doit rester révoquée aux clients. Propositions en DRAFT dans `docs/02` uniquement.

## 2. La séparation CALCUL / RÈGLES / TRADUCTION
Le LLM ne calcule jamais, ne décide jamais. Ne jamais élargir le payload envoyé au LLM au-delà des scores, flags et textes de règles **pseudonymisés**. `briefs.payload` doit continuer à stocker l'envoi exact.

## 3. La RLS multi-tenant
Toute nouvelle table porte une RLS **avant** d'être utilisée. Toute nouvelle opération cliente exige sa policy — y compris `UPDATE` quand le client fait un `upsert` (c'est le piège qui a déjà frappé deux fois). Ne jamais `revoke select` sur une vue `security_invoker` : la RLS des tables sous-jacentes suffit déjà, et le revoke casse l'écran en silence.

## 4. La fenêtre d'écriture du check-in
`end_utc → +8 h`, appliquée en base. Elle doit rester **strictement supérieure** au dernier offset de relance de `session-watcher` (+6 h). Modifier l'un sans l'autre renvoie l'athlète vers un formulaire fermé.

## 5. La chaîne de notifications
`session-watcher` (rattrapage 3 h, idempotence par `notified_at IS NULL`) · `notify` (service-role only) · `_shared/webpush.ts` (cryptographie VAPID écrite à la main, **ne pas toucher sans raison sérieuse**) · `public/ctp-sw.js` copié par `scripts/copy-service-worker.js`. Casser un maillon tue la compliance, donc le produit.

## 6. `f_engine_user` et les formules du moteur
Constantes à ne pas modifier sans décision : alpha `0.0690`, carry-forward, `data_days < 3`, fenêtres 7 j et 28 j. Tout refactor du moteur exige la **requête de non-régression** en fin de migration 018 — elle doit renvoyer zéro écart.

## 7. `coach_feedback`
C'est le futur jeu d'entraînement du système. Lecture et insertion seulement. **Ne jamais purger, ne jamais autoriser la suppression.**

## 8. `user_consents`
Immuable par construction. Ne jamais ajouter de policy `UPDATE` ou `DELETE`. Un consentement est un fait daté.

## 9. Les chemins Firebase
Ils restent intacts derrière `if (USE_SUPABASE)` jusqu'à l'étape M8. Ne supprime aucun fichier Firebase, aucune branche `!USE_SUPABASE`, tant que le run parallèle n'a pas été validé.

## 10. La parité avec l'ancienne version
Textes et timings de notification, écrans athlète, console admin : repris de `APP/ChampionTrackPro-LIVE`. Ne réécris pas, ne « améliore » pas sans validation. Le copywriting des relances est identique au mot près.

## 11. Les zones de couleur
`GREEN` / `BLUE` / `YELLOW` sont sacrées. Jamais décoratives, jamais réattribuées à autre chose. Aucune information portée par la couleur seule.

## 12. L'anonymat de l'athlète vis-à-vis du LLM
Seul le pseudonyme `P-xx` sort. Jamais un nom, jamais un email. `next_pseudonym()` garantit qu'un pseudonyme n'est jamais réattribué — ne pas revenir à un `count()`.

## 13. La production de l'ancienne version
`champtrackpro.com` sert l'ancienne app depuis un **autre dépôt** et un **autre projet Vercel**. Ne jamais pousser du code V2 vers `gfavergeat4-cell/ChampionTrackPro_`. Ce dépôt est **public** : aucun secret ne doit y entrer.

## 14. Le script de build
Ne jamais réintroduire `git rev-parse HEAD` dans `web:build` : les déploiements CLI n'ont pas de `.git`. `verify-build.js` doit continuer à exiger `index.html`, `firebase-messaging-sw.js` et `manifest.json`.

## 15. Les données de production
Il n'y en a pas encore — mais l'équipe pilote `b0000000-0000-4000-8000-000000000001` porte les seuls jeux de test et les comptes du fondateur. Le script de purge démo est en fin de `supabase/seed_demo_roster.sql` : lis-le avant de l'exécuter.

## 16. `src/lib/ctpApi.ts` comme point d'accès unique
Aucun écran ne doit rappeler Supabase en direct. Toute nouvelle requête passe par ce fichier. C'est ce qui a rendu possible chaque reprise jusqu'ici.
