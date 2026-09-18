# KNOWN_ISSUES

**Audit du 15 août 2026.** Les bugs corrigés figurent aussi : *les solutions déjà tentées et échouées sont la partie la plus utile de ce document.* Ne refais pas les mêmes expériences.

---

# PARTIE 1 — BUGS OUVERTS

## BUG-01 · Confirmation d'email désactivée
**STATUS** OPEN
**SYMPTÔME** N'importe qui peut créer un compte avec l'adresse d'une autre personne.
**COMPORTEMENT ATTENDU** Vérification de l'adresse avant activation du compte.
**CAUSE RACINE** Le réglage « Confirm email » a été désactivé dans le tableau de bord Supabase parce que l'activer cassait l'inscription — le quota d'emails du plan était atteint et les messages de confirmation ne partaient pas.
**SOLUTIONS TENTÉES** Réactivation simple → l'inscription échoue à nouveau.
**SOLUTION ACTUELLE** Aucune. Le réglage reste off.
**PROCHAINE ACTION** Configurer un fournisseur SMTP personnalisé (Resend, Postmark) dans Supabase Auth, **puis** réactiver. Ne pas réactiver avant.
**RISQUE DE RÉGRESSION** Élevé — réactiver sans SMTP bloque toute nouvelle inscription.
**FICHIERS** Aucun. Réglage tableau de bord Supabase.

## BUG-02 · Aucun journal d'accès aux données d'athlète
**STATUS** OPEN
**SYMPTÔME** En cas d'incident, impossible de dire qui a consulté quoi.
**CONSÉQUENCE** Tout incident devient une notification au périmètre maximal. C'est la troisième question d'un service juridique universitaire.
**PROCHAINE ACTION** `docs/14_DURCISSEMENT_SECURITE.md` P1-4 contient la conception.

## BUG-04 · Le bucket journalier est en UTC alors que `teams.timezone` existe
**STATUS** OPEN
**SYMPTÔME** Une séance de fin d'après-midi en Californie est comptabilisée sur le jour suivant.
**CAUSE RACINE** `v_daily_scores` et `v_response_axes` groupent par `(submitted_at at time zone 'UTC')::date`. La colonne `teams.timezone` existe depuis la migration 001 et n'est lue nulle part.
**IMPACT** Décalage d'un jour sur les baselines des équipes des fuseaux Ouest. Silencieux.
**PROCHAINE ACTION** Grouper par le fuseau de l'équipe. Attention : change les valeurs historiques.
**RISQUE DE RÉGRESSION** Élevé — modifie des baselines déjà calculées.

## BUG-05 · `morning-brief` enchaîne les appels LLM en série
**STATUS** OPEN
**SYMPTÔME** Aucun aujourd'hui (une équipe). À 50 équipes, une seule invocation enchaîne 50 appels LLM et dépassera le temps d'exécution.
**PROCHAINE ACTION** Paralléliser par lots, ou une invocation par équipe déclenchée par le cron.

## BUG-06 · `ics-sync` traite tous les calendriers en série
**STATUS** PARTIALLY FIXED
**CORRIGÉ LE 15/08** Un coach ne synchronise plus que ses propres équipes.
**RESTE** Le cron, lui, parcourt toujours tous les clients en série.

## BUG-07 · `getAdminSystemHealth` fait 8 requêtes par équipe
**STATUS** OPEN
**SYMPTÔME** Écran de santé lent au-delà d'une dizaine d'équipes.
**FICHIERS** `src/lib/ctpApi.ts`

## BUG-08 · `getMyMembership()` est non déterministe en multi-équipes
**STATUS** OPEN
**SYMPTÔME** Un utilisateur membre de plusieurs équipes obtient une équipe différente d'un chargement à l'autre.
**CAUSE RACINE** `.limit(1)` sans `order by`.
**PROCHAINE ACTION** Sélecteur d'équipe explicite. Un tri arbitraire ne ferait que masquer le problème.

## BUG-09 · Un athlète qui change d'équipe corrompt sa baseline
**STATUS** OPEN
**CAUSE RACINE** Les vues du moteur agrègent par `user_id`, pas par `(user_id, team_id)`. Les réponses des deux équipes se mélangent dans la même série.
**PROCHAINE ACTION** Décider si la baseline suit la personne ou l'appartenance. **Décision produit, pas technique.**

## BUG-10 · Le Morning Brief affiche une moyenne d'équipe
**STATUS** OPEN — contradiction interne
**SYMPTÔME** `CoachHomeSupabase` affiche une readiness moyenne d'équipe en chiffre héros, alors que `CoachBoard` refuse par principe toute moyenne interindividuelle.
**CAUSE RACINE** Les deux écrans ont été construits à des moments différents, avant et après l'adoption de la méthode DAR.
**PROCHAINE ACTION** Arbitrage du fondateur (question ouverte n° 3).

## BUG-11 · Le motif du CoachBoard se déclenche sur une seule journée
**STATUS** OPEN
**SYMPTÔME** Un marqueur à +10,9 porte le même libellé qu'un marqueur à +17,4. Faux positifs quotidiens attendus.
**CAUSE RACINE** Le seuil est binaire, sans critère de récurrence, alors que Morin insiste : *« le critère temporel reste central »*.
**PROCHAINE ACTION** Deux options proposées au fondateur — exiger 3 jours consécutifs, et/ou graduer l'affichage (pastille entre +10 et +15, motif nommé au-delà). Non tranché.
**FICHIERS** `src/screens/CoachBoard.tsx`, fonction `pattern()`

## BUG-14 · Polices déclarées mais jamais chargées
**STATUS** OPEN
**SYMPTÔME** `Space Mono` et `DM Sans` sont déclarées ~50 fois dans 5 fichiers ; aucune n'est chargée. Elles retombent silencieusement sur la police système.
**FICHIERS** `DAR*Chart.tsx` (×3), `CreateTeamModal.tsx`, `StitchQuestionnaireScreen.js`

## BUG-15 · Fichiers morts atteignables uniquement par le code
**STATUS** OPEN — dette
`AthleteHomeSupabase.tsx` et `ScheduleScreenSupabase.tsx` (1 190 l.) débranchés · `AdminTeamScreen.tsx` et `CreateTeamModal.tsx` (1 026 l.) routes retirées, `CreateTeamModal` écrit encore sur Firestore · `public/logo/logo_clean.png` et `assets/logo.svg` (contient `Cinzel`, police retirée) à supprimer à la main · `toMs()` inutilisé dans `CoachScheduleScreen`.

---

# PARTIE 2 — BUGS CORRIGÉS ET CE QUI A ÉCHOUÉ AVANT

## FIXED-01 · La chaîne de notifications ne pouvait pas s'amorcer
**SYMPTÔME** Aucune notification ne partait. Les tests téléphone échouaient depuis des semaines.
**CAUSE RACINE** `registerVapidPush()` n'avait qu'un appelant : `OnboardingNotifScreen`. Or la branche Supabase de `AuthGate` fixait `onboardingComplete: true` **en dur**, et l'écran n'est rendu que si c'est faux. Aucun athlète ne pouvait donc s'abonner ; `push_subscriptions` restait vide.
**AGGRAVANT** Le bouton « Enable » du profil n'appelait que `Notification.requestPermission()` — il ne souscrivait pas. Les deux portes d'entrée étaient mortes.
**SOLUTION ÉCARTÉE** Ajouter une colonne `profiles.onboarding_complete`. **Rejetée** : un booléen serveur ment dès que l'athlète change d'appareil — il serait marqué « onboardé » sans souscription active, exactement le mode de panne qu'on corrigeait.
**SOLUTION RETENUE** L'état est **dérivé de la réalité de l'appareil** : `ensurePushSubscriptionSynced()` lit la souscription du `PushManager` et la ré-upsert (idempotent, répare une ligne perdue). Seul le renoncement explicite est mémorisé en local.
**VÉRIFIÉ** Notification reçue sur appareil réel le 15/08.

## FIXED-02 · 403 sur toute resynchronisation de souscription push
**SYMPTÔME** La première souscription passait, toutes les suivantes renvoyaient `new row violates row-level security policy (USING expression)`.
**CAUSE RACINE** `savePushSubscription()` fait un `upsert`. PostgREST le traduit en `INSERT … ON CONFLICT DO UPDATE`, qui exige une policy **UPDATE**. La migration 009 n'avait créé que SELECT / INSERT / DELETE.
**PORTÉE RÉELLE** Bien au-delà du blocage constaté : les endpoints push expirent et doivent être rafraîchis. Sans policy UPDATE, les athlètes auraient cessé de recevoir des notifications au bout de quelques semaines, **sans aucune erreur visible**.
**CORRECTIF** Migration 011.
**LEÇON GÉNÉRALISABLE** Chercher systématiquement le même trou partout où le client fait un `upsert`.

## FIXED-03 · `create-team` n'a jamais fonctionné
**SYMPTÔME** Aucune équipe ne pouvait être créée depuis le produit.
**CAUSE RACINE** L'insertion visait `org_id` alors que la colonne s'appelle `organization_id`.
**CONSÉQUENCE** Toutes les équipes existantes viennent des seeds SQL.

## FIXED-04 · Deux fonctions d'administration renvoyaient « succès » sans rien écrire
**SYMPTÔME** Renommer une équipe ou retirer un membre affichait un succès ; rien n'était modifié.
**CAUSE RACINE** `teams` n'avait aucune policy UPDATE, `memberships` aucune policy DELETE. PostgreSQL filtre **sans erreur**, PostgREST répond 204, l'écran conclut au succès.
**LEÇON** Pire qu'un refus, parce qu'invisible. Vérifier l'existence d'une policy pour **chaque** opération, pas seulement pour la lecture.

## FIXED-05 · Escalade de privilèges par le code d'invitation
**SYMPTÔME** Tout athlète possédant le code d'équipe pouvait se réinscrire en cochant « coach » et lire les réponses nominatives du roster.
**CAUSE RACINE** `join-team` lisait `role` dans le corps de la requête. Régression : l'ancienne version résolvait le rôle côté serveur.
**SOLUTION RETENUE** (décision fondateur) Deux codes distincts générés à la création : `XXXXXX-A` et `XXXXXX-C`. Le serveur déduit le rôle du code présenté et **ignore** le champ `role`. Un membre existant ne change plus jamais de rôle.

## FIXED-06 · Pseudonymes réattribués après un départ
**CAUSE RACINE** Le pseudonyme était calculé par `count()` sur les membres. Un joueur part, le suivant hérite de son `P-07`.
**PORTÉE** C'est le **seul identifiant transmis au LLM** : deux athlètes se seraient retrouvés confondus dans les briefs, sans erreur nulle part.
**CORRECTIF** `teams.pseudonym_seq`, compteur qui ne décroît jamais, alloué par `next_pseudonym()`.

## FIXED-07 · `updateMyProfile` écrivait dans des colonnes inexistantes
**CAUSE RACINE** `jersey_number` et `position` vivent sur `memberships`, pas sur `profiles`. L'édition du profil échouait intégralement.

## FIXED-08 · Le moteur recalculait toute la base à chaque réponse
**SYMPTÔME OBSERVÉ** 1 206 réponses insérées → `daily_metrics` remplie sur **18 lignes** au lieu de 780. Le webhook n'a pas tenu.
**CAUSE RACINE** PostgreSQL ne pousse jamais un prédicat dans une `WITH RECURSIVE`. Interroger `v_engine` pour un athlète recalculait d'abord la série complète de **tous les athlètes de tous les clients**.
**CORRECTIF** `f_engine_user(uuid)`, migration 018. Formules et constantes recopiées à l'identique.
**VÉRIFIÉ** Requête de non-régression comparant ligne à ligne l'ancien et le nouveau calcul : **zéro écart**.
**LEÇON** Ne jamais utiliser `v_engine` pour un seul athlète.

## FIXED-09 · La relance de +6 h renvoyait vers un formulaire fermé
**SYMPTÔME** L'athlète recevait la relance, remplissait ses 60 secondes, et prenait un rejet silencieux.
**CAUSE RACINE** Les relances partent à +3 h et +6 h ; la policy d'insertion fermait à +5 h.
**ARBITRAGE** Des deux valeurs, la fenêtre était l'arbitraire — inventée en V2, alors que les timings de relance viennent de la version éprouvée. **On a élargi la fenêtre à 8 h**, pas déplacé les relances.
**INVARIANT À TENIR** La fenêtre doit rester **strictement supérieure** au dernier offset de relance.

## FIXED-10 · Fenêtre de détection de 2 minutes sans rattrapage
**SYMPTÔME** Un tick de cron manqué — déploiement, démarrage à froid — et toute une équipe ratait son check-in, en silence.
**CORRECTIF** Fenêtre portée à 3 h, `notified_at IS NULL` garantissant l'idempotence. Les relances sont désormais ancrées sur `end_utc` et non sur l'instant du cron.

## FIXED-11 · Écrans coach lisant une base vide
**SYMPTÔME** `CoachTeamScreen`, `CoachScheduleScreen`, `AthleteDetailScreen` s'affichaient vides. La fiche joueur était inaccessible : elle n'était atteignable que depuis `CoachTeamScreen`, lui-même cassé.
**CAUSE RACINE** Ils lisaient Firestore alors que `USE_SUPABASE=1`.
**CORRECTIF** Rebranchés sur `ctpApi` **sans toucher au rendu** (loi de parité). `CoachTeamScreen` a ensuite été remplacé par `CoachBoard`.
**NOTE** `AthleteDetailScreen` conserve un **contrat de forme** : son rendu attend des champs camelCase et un `submittedAt` façon Timestamp Firestore. Le chargement remappe les lignes Postgres vers ce contrat plutôt que de réécrire 400 lignes d'affichage.

## FIXED-12 · `revoke select` bloquant le tableau coach
**SYMPTÔME** `CoachBoard` affichait « 0 of 16 » sans erreur.
**CAUSE RACINE** Prudence excessive : `revoke select … from authenticated` sur les vues de la migration 014. Or ces vues sont en `security_invoker` — la RLS des tables sous-jacentes suffit déjà.
**AGGRAVANT** `safe()` avalait l'erreur (voir BUG-12).
**CORRECTIF** `grant select … to authenticated` sur les cinq vues.

## FIXED-13 · Doublons de séances
**SYMPTÔME** 187 séances là où on en attendait 60.
**CAUSE RACINE** La contrainte `unique (team_id, ics_uid, start_utc)` ne protège rien quand `ics_uid` est NULL — en SQL, NULL n'entre jamais en conflit.
**CORRECTIF** Index unique partiel `uq_sessions_manual` sur les séances non-ICS.

## FIXED-14 · `main` écrasé sur le dépôt de l'ancienne version
**SYMPTÔME** `main` réduit à 70 fichiers au lieu de 603 ; build en échec.
**CAUSE RACINE** Un `git push --force` depuis un dossier local dont le dépôt Git ne suivait que `navigation/`, `public/` et `vercel.json`. Le reste de l'application n'y était pas versionné.
**RÉCUPÉRATION** Restauration depuis la branche de sauvegarde créée juste avant.
**LEÇON** Vérifier `git ls-tree -r --name-only HEAD | wc -l` avant tout push forcé. Toujours créer une branche de sauvegarde d'abord.

## FIXED-15 · Historique technique antérieur
Recensé pour éviter la répétition :
- `uuid_generate_v4()` indisponible → `gen_random_uuid()`.
- CTE auto-référençante → `WITH RECURSIVE`.
- Advisor Supabase « Security Definer View » → `security_invoker = true` sur les vues du moteur (migration 005).
- Boucle de 429 à l'inscription → cause réelle : « Confirm email » actif et quota atteint.
- Compte coach routé comme athlète → course entre l'événement d'auth et l'écriture du membership ; corrigé par `supa.auth.refreshSession()` après `joinTeam`.
- Jointure imbriquée PostgREST échouant en silence dans `getTeamMembers` → **scindée en deux requêtes**.
- Bibliothèque `rrule` npm → `BOOT_ERROR` dans le runtime Deno → parser RRULE écrit à la main.
- `ics-sync` renvoyant `upserted:0` puis timeouts → 2 100 occurrences insérées une par une ; corrigé par upsert en lots de 200 + `AbortController` + `?dry_run=1`.
- TZID traité comme UTC → parsing des blocs `VTIMEZONE` ; a nécessité une purge (`delete from sessions where ics_uid is not null`) avant resynchronisation pour éviter les doublons.
- URL publique Google Calendar → 429 depuis une IP de datacenter → utiliser l'**adresse iCal secrète**.
- `babel-preset-expo` absent de `package.json`, fonctionnait grâce à un `node_modules` pollué → `npx expo install babel-preset-expo`.
- `git rev-parse HEAD` dans le script de build → échec des déploiements CLI (`fatal: not a git repository`) → retiré.
- Écriture d'un gros fichier `.tsx` à travers un montage réseau → **troncature silencieuse**. Restauré en trois ajouts avec vérification du nombre de lignes et de l'équilibre des accolades.

## FIXED-16 · `safe()` transformait une erreur de permission en « pas de données » (ex-BUG-12)
**CORRIGÉ LE** 18/09/2026
**SYMPTÔME** Un écran affichait zéro donnée sans aucune erreur, alors que la requête avait été refusée (`CoachBoard` à « 0 of 16 » lors de l'incident `revoke select` — une heure perdue, cf. FIXED-12).
**CAUSE RACINE** `safe()` déstructurait `{ data }` et ignorait `error` — Supabase-js renvoie `{ data: null, error }` **sans lever d'exception** sur un refus RLS ; le `catch` ne se déclenchait donc jamais.
**CORRECTIF** `error` est désormais destructuré et loggué en console (`[ctpApi] safe() query failed: …`) avant le repli sur `fallback`. Le `catch` logue aussi (`[ctpApi] safe() threw: …`) pour les échecs réseau. **Comportement inchangé** : la fonction retourne toujours `fallback`, aucun écran ne peut casser — seule la visibilité change.
**PORTÉE** Les 9 appelants de `safe()`, dont `getCoachBoard` et `getPendingConsents`.
**FICHIERS** `src/lib/ctpApi.ts`

## FIXED-17 · Faux gras sur toute l'interface (ex-BUG-13)
**CORRIGÉ LE** 18/09/2026
**CAUSE RACINE** `Inter_700Bold` n'était pas chargé dans `App.js` alors que `fontWeight: 700` est utilisé ~59 fois ; le navigateur synthétisait un gras.
**CORRECTIF** Poids ajouté à l'import `@expo-google-fonts/inter` et à `useFonts`.
**FICHIERS** `App.js`

## FIXED-18 · `ics-sync` n'annulait jamais une séance retirée du calendrier (ex-BUG-03)
**CORRIGÉ LE** 18/09/2026
**SYMPTÔME** Un coach supprimait un entraînement de son calendrier ; la séance restait en base, les athlètes recevaient une notification pour une séance qui n'avait pas eu lieu.
**CAUSE RACINE** La synchronisation ne faisait qu'`upsert`. Aucun mécanisme de réconciliation ni de `cancelled = true`.
**CORRECTIF** Après l'upsert du lot synchronisé, lecture des séances non annulées de l'équipe dans la fenêtre `[now-30j, now+180j]`, différence avec les `ics_uid` du flux courant, et `update cancelled = true` par `id` sur celles qui ont disparu. Ne supprime jamais une ligne (des réponses peuvent y être rattachées, cf. `DO_NOT_BREAK.md` #4).
**GARDE** La réconciliation ne s'exécute que si la réponse HTTP ressemble à un calendrier ICS valide (`is_ics`) — une réponse vide ou une erreur de fetch ne doit jamais être lue comme « plus aucun événement », qui annulerait tout le roster.
**BÉNÉFICE SECONDAIRE** `session-watcher` filtre déjà `cancelled = false` (ligne 111) : la correction à la source supprime aussi les fausses notifications sans y toucher.
**NON VÉRIFIÉ** Edge function non redéployée (`supabase functions deploy ics-sync` requis) — testé par lecture de code et `tsc`/build uniquement, pas en exécution réelle contre un vrai calendrier.
**FICHIERS** `supabase/functions/ics-sync/index.ts`

## FIXED-19 · `morning-brief-daily` renvoyait 403 en silence depuis 34 jours (18/09/2026)
**GRAVITÉ** Critique — panne totale, silencieuse, de la fonctionnalité qui constitue la valeur centrale du produit.
**SYMPTÔME** Aucun Morning Brief généré entre le 15 août et le 18 septembre 2026 (34 jours), alors que `select * from cron.job_run_details` indiquait `status = succeeded` chaque jour à 11h00 UTC.
**CAUSE RACINE** Le commit de durcissement sécurité du 15/08 (`e134a1e`) a ajouté une garde `isServiceRole()` à `morning-brief` (doc 11 P0-3 : sans elle, n'importe qui muni de la clé anon peut déclencher un brief sur l'équipe de son choix). Le job `cron.job` `morning-brief-daily`, lui, avait été créé **avant** cette garde avec un jeton **anon**, jamais mis à jour depuis. Chaque appel quotidien recevait donc `403 forbidden` — confirmé en lisant directement `net._http_response` (`body: "forbidden"`, `status_code: 403`, horodaté exactement 11:00:00 chaque jour).
**POURQUOI PERSONNE NE L'A VU** `cron.job_run_details.status` ne reflète que la réussite de la *soumission* de la requête HTTP asynchrone via `pg_net`, jamais le code de statut de la réponse. Un `succeeded` au niveau pg_cron ne garantit rien sur ce que l'edge function a réellement fait — même angle mort que BUG-12 (`safe()`), à un niveau d'infrastructure différent.
**CORRECTIF** Jeton `service_role` (déjà utilisé par `session-watcher-1min`, qui fonctionnait) réinjecté dans le job via `cron.unschedule` + `cron.schedule`, sans jamais faire transiter le jeton en clair par un canal visible (extraction et réinjection dans un seul bloc `DO $$` côté serveur).
**VÉRIFIÉ** Invocation manuelle immédiate après correctif → `200 "ok"` → nouvelle ligne dans `briefs` pour 2026-09-18, coût réel `$0.00045`, modèle `claude-haiku-4-5-20251001`. La chaîne complète (garde → lecture métriques → appel LLM → écriture `briefs` + `llm_logs` → push staff) fonctionne de bout en bout.
**RESTE À FAIRE** Vérifier `ics-sync-15min` (créé le même jour, voir plus bas) et tout autre job `pg_cron` existant ou futur contre la même classe d'erreur à chaque ajout de garde `isServiceRole()`/`isAdmin()` sur une edge function invoquée par cron.
**FICHIERS** Aucun fichier de code — réglage `cron.job` en base uniquement.

## FIXED-20 · `ics-sync-15min` n'existait pas en production (18/09/2026)
**CONTEXTE** Question ouverte n° 8 de `PROJECT_SOURCE_OF_TRUTH.md` §34 : « `ics-sync-15min` existe-t-il réellement en production ? » — **Réponse : non**, confirmé par `select * from cron.job` (seuls `morning-brief-daily` et `session-watcher-1min` existaient).
**IMPACT** Le calendrier ne se synchronisait jamais automatiquement. Seul le bouton « Sync Now » d'un coach déclenchait `ics-sync` — sans clic manuel régulier, aucune nouvelle séance, donc aucune notification de check-in.
**CORRECTIF** Job créé (`*/15 * * * *`), même jeton `service_role` que `session-watcher-1min`, même méthode d'extraction sans exposition.
**NON VÉRIFIÉ** Aucune équipe pilote n'a de `ics_url` renseignée activement testée depuis ; le prochain déclenchement réel (15 min max) reste à observer dans les logs de la fonction.
**FICHIERS** Aucun fichier de code — réglage `cron.job` en base uniquement.

## 🚨 Incident — clé service_role exposée dans une session Claude (18/09/2026)
**QUOI** En inspectant `cron.job.command` pour comprendre comment reproduire l'authentification de `session-watcher-1min`, la commande complète — jeton `service_role` en clair inclus — a été affichée dans la sortie d'un outil, donc dans la transcription de la session.
**PORTÉE** Le jeton `service_role` contourne intégralement la RLS sur toute la base. Sa présence en clair dans `cron.job.command` est **antérieure** à cet incident (c'est déjà comme ça que `session-watcher-1min` et `morning-brief-daily` fonctionnent) — l'incident est sa **ré-exposition dans un canal supplémentaire** (la session).
**ACTION REQUISE — fondateur** Rotation de la clé `service_role` depuis le tableau de bord Supabase (Settings → API). **Conséquence en cascade** : `session-watcher-1min`, `morning-brief-daily` et `ics-sync-15min` référencent tous l'ancienne clé dans `cron.job.command` et cesseront de fonctionner (403/401) jusqu'à ce que les trois jobs soient recréés avec la nouvelle clé.
**AMÉLIORATION STRUCTURELLE À CONSIDÉRER** Stocker le jeton une fois via `vault`/`app.settings` plutôt que dans le texte de la commande `cron.job`, pour qu'une rotation future n'exige pas de retoucher trois jobs à la main.
