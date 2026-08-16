# 09 — AUDIT & ROADMAP · Ce qui manque, dans quel ordre

> **Statut : audit du 31 juillet 2026 — lots L1 à L4 implémentés le jour même.** Le corps de l'audit est conservé tel qu'écrit avant implémentation (valeur de point de comparaison) ; l'avancement se lit au §7, colonne *Statut*, et au §10 pour ce qui reste à vérifier sur le terrain.
> Audit réalisé le 31 juillet 2026 sur `APP/ChampionTrackPro-V2`, par lecture du code source. L'inventaire factuel qui le fonde est le document `08_CARTOGRAPHIE_TECHNIQUE.md`.
> Périmètre demandé : structure générale, avec priorité sur **l'interface admin** et **l'interface coach**.

---

## 1. Verdict en cinq lignes

Le socle serveur est bon et rare : le schéma, la RLS, le moteur SQL et la chaîne événementielle sont d'un niveau qui tient devant un audit technique d'acheteur. Le parcours **athlète** est complet de bout en bout. Ce qui n'existe pas encore, c'est **le produit du côté de celui qui paie** : le coach dispose d'un brief et de courbes, mais d'aucun outil de travail ; l'admin dispose d'une liste d'équipes, mais d'aucune console d'exploitation. Et une anomalie d'une ligne empêche toute notification de partir — ce qui, sans correction, condamne mécaniquement la compliance et donc la valeur perçue.

Ordre de traitement recommandé : **débloquer le push → réparer les trois écrans coach cassés → construire la console admin → enrichir l'outillage coach.**

## 2. Ce qui est solide (à ne pas retoucher)

| Bloc | Pourquoi c'est un actif |
|---|---|
| Schéma Postgres 18 tables + RLS | Isolation multi-tenant réelle, fenêtre d'écriture du check-in appliquée en base et non dans l'UI. Défendable en due diligence. |
| Moteur SQL (`v_daily_scores` → `v_engine`) | Le calcul est au même endroit pour tout le monde, versionné en migrations. `readiness_score` calculé par trigger : le client ne peut plus mentir. |
| Séparation calcul / règles / narration | `rules.enabled` par défaut `false`, `eval_rule` révoquée aux clients, payload LLM pseudonymisé et stocké. C'est l'argument différenciant face aux concurrents « IA ». |
| Chaîne événementielle | ICS → sessions → watcher → check-in → webhook → métriques → brief. Aucun humain dans la boucle quotidienne. |
| `ctpApi.ts` comme couche unique | Toute reprise future se fait à un seul endroit. À défendre : aucun écran ne doit rappeler Supabase en direct. |
| Parcours athlète | Accueil, planning et check-in sont branchés, avec les composants validés de l'ancienne version. |

## 3. Blocages critiques — P0

### P0-1 · Aucune notification ne peut partir

**Constat.** `registerVapidPush()` n'a qu'un seul appelant : `OnboardingNotifScreen.tsx:63`. Cet écran n'est rendu que si `!onboardingComplete` (`StitchNavigator.js:376`). Or la branche Supabase de `AuthGate` fixe `onboardingComplete: true` en dur (`:485`).

**Conséquence en chaîne.** Aucun athlète ne s'abonne → `push_subscriptions` reste vide → `session-watcher` notifie zéro personne → aucune relance → le taux de réponse dépend du fait que l'athlète pense à ouvrir l'app. Le brief du lendemain est alors calculé sur trois réponses au lieu de quinze, et le coach juge le produit inutile. **Tout le reste de la roadmap est secondaire tant que ceci n'est pas corrigé.**

**Direction (à valider, non implémentée).** Persister l'état d'onboarding par utilisateur côté Supabase — le plus propre étant une colonne sur `profiles` plutôt qu'un stockage local, pour survivre au changement d'appareil — et rendre l'écran tant qu'elle est fausse. Prévoir une porte de rattrapage dans le profil (« Notifications : activées / activer ») pour les comptes déjà créés.

**Critère de sortie.** Un athlète réel, sur son téléphone, reçoit la notification de fin de séance, puis la relance s'il ne répond pas. Tant que ce test n'est pas passé **sur un vrai appareil**, la fonctionnalité n'existe pas.

### P0-2 · Trois écrans du parcours coach s'affichent vides

`CoachTeamScreen` (313 l.), `CoachScheduleScreen` (720 l.) et `AthleteDetailScreen` (570 l.) lisent Firestore. Sous `USE_SUPABASE=1`, ils ne renvoient rien. Et comme `AthleteDetail` n'est atteignable que depuis `CoachTeamScreen`, le coach n'a **aucun moyen d'ouvrir la fiche d'un joueur**.

C'est le trou le plus visible du produit : le brief signale un joueur, le coach clique, il n'y a rien derrière. Le travail attendu est un rebranchement de données sur `ctpApi`, sans réécriture d'interface (loi de parité, doc 07) — `getTeamMembers`, `getTeamMetricsRange` et `listSessions` couvrent déjà l'essentiel du besoin.

### P0-3 · Le moteur tourne à vide

`rules` ne contient aucune ligne `enabled = true`. `compute-metrics` évalue donc zéro règle, `flags` reste vide, et le brief se limite à décrire des chiffres sans jamais dire ce qui mérite l'attention du coach.

**Ce n'est pas un bug, c'est une décision assumée** (Constitution art. 2) : les règles appartiennent au fondateur. Mais il faut le nommer pour ce que c'est — **le produit ne délivre pas encore sa promesse** tant que zéro règle n'est active. Les ~20 règles DRAFT sourcées du doc `02` attendent une session d'arbitrage. Trois à cinq règles activées suffiraient à transformer le brief.

**Ce point n'appartient qu'à Gabin. Aucun développeur, aucun agent ne l'active à sa place.**

## 4. Interface COACH — état et manques

### 4.1 Ce qui existe

| Onglet | Écran | État |
|---|---|---|
| Home | `CoachHomeSupabase.tsx` (554 l.) | ✅ Morning Brief, halo d'équipe avec count-up, roster trié par priorité, feedback Useful/Noise, réglage calendrier en accordéon |
| Team | `CoachTeamScreen.tsx` | ❌ Firestore — vide |
| Schedule | `CoachScheduleScreen.tsx` | ❌ Firestore — vide |
| Analytics | `PerformanceDashboard.tsx` (1591 l.) | ✅ branché `ctpApi` |
| Profile | `ProfileScreenSupabase.tsx` | ✅ |

### 4.2 Ce qui manque, par ordre de valeur pour le coach

1. **La fiche joueur** (P0-2). Sans elle, le brief est une impasse. Contenu attendu : courbe readiness vs baseline sur 28 jours, zone du jour, historique de compliance, dernières réponses, et de quoi écrire une note. C'est l'écran où le coach passe de « on me signale quelque chose » à « je décide ».
2. **Le roster de travail.** Aujourd'hui le coach voit une liste. Il lui faut trier, filtrer par zone, repérer qui n'a pas répondu, et relancer. La compliance est son problème autant que le nôtre — lui en donner le levier le rend acteur.
3. **La création de séance dans l'app.** Les colonnes `planned_load`, `objective`, `group_label` existent depuis la migration 008 et ne sont alimentées par aucune interface. Tant que la charge prévue n'est pas saisie, `workload_au` reste nul, donc `acwr` reste nul, donc tout un pan du moteur dort. C'est aussi ce qui permettrait de comparer prévu et ressenti — l'analyse que le brief ne peut pas encore produire.
4. **La boucle de décision tracée.** `coach_feedback` accepte `acknowledged` et `overridden`, mais l'interface n'expose que `useful` / `noise`. Enregistrer ce que le coach a fait d'un signal, c'est constituer le dataset qui rendra le système meilleur — et c'est aussi la preuve d'usage à montrer en renouvellement.
5. **L'export.** Un staff NCAA partage ses données avec le performance staff et parfois le corps médical. Un export CSV ou PDF hebdomadaire est un besoin réel, pas un confort.
6. **La vue cycle.** La table `cycles` existe, rien ne la lit. À garder pour plus tard : sans règles actives ni charge saisie, elle n'aurait rien à afficher.

### 4.3 Ce que le coach ne doit PAS recevoir

Pas de prédiction de blessure individuelle. Pas de décision automatique de repos. Pas de conseil médical. Pas de score composite de type « risque » qui donnerait une illusion de certitude. Ces limites sont dans la Constitution et sont aussi une protection juridique.

## 5. Interface ADMIN — état et manques

### 5.1 Ce qui existe

`AdminHomeScreen.tsx` (206 l.) liste les équipes via `getAdminTeams()`, avec le nombre de membres et le code d'invitation, et permet d'en créer une par un formulaire en ligne (`ctpApi.createTeam` → edge function). `AdminTeamDetailScreen.tsx` (527 l.) affiche les membres, met à jour l'équipe et retire un membre.

C'est un début honnête. Mais la console admin d'un SaaS multi-équipes sert à répondre à une question : **« est-ce que tout tourne, et sinon où ? »** — et à celle-là, l'interface actuelle ne répond pas du tout.

### 5.2 Problèmes structurels immédiats

| # | Constat | Effet |
|---|---|---|
| A1 | L'onglet « Teams » rend `AdminHomeScreen`, identique à l'onglet « AdminHome » | Deux onglets, un seul écran — impression de produit inachevé |
| A2 | `AdminTeamScreen.tsx` (490 l.) enregistré dans le stack, jamais atteint | 490 lignes mortes qui contredisent `AdminTeamDetailScreen` |
| A3 | `CreateTeamModal.tsx` (536 l.) inatteignable **et** écrit sur Firestore | Doublon dangereux de la création d'équipe |
| A4 | Aucun écran ne lit `llm_logs`, `flags`, `pending_reminders`, `briefs` | Aucune visibilité sur ce que fait le système |

### 5.3 Ce que la console admin doit devenir

L'admin, c'est le poste de pilotage du fondateur pendant la phase pilote, puis celui du support quand il y aura des clients. Quatre fonctions, par ordre de priorité :

1. **Santé du système.** Les crons ont-ils tourné ? Le brief d'hier a-t-il été généré pour chaque équipe ? Combien de sessions importées par l'ICS ? Combien de relances envoyées, combien en échec ? Aujourd'hui, la seule façon de le savoir est d'ouvrir le SQL editor de Supabase. Un écran qui lit `briefs`, `llm_logs`, `pending_reminders` et `sessions` répond à tout cela — et c'est du **read-only**, donc peu risqué à construire.
2. **Compliance par équipe.** Le taux de réponse est l'indicateur avancé de la rétention. Une équipe qui tombe sous 60 % ne renouvellera pas ; il faut le voir six semaines avant, pas au moment du renouvellement.
3. **Coût.** `llm_logs` enregistre déjà tokens et coût. Le coût par équipe et par mois est le chiffre qui décide du modèle de prix ; il doit être visible sans requête SQL.
4. **Administration des équipes.** Renommer, régénérer un code, changer le fuseau horaire, importer un calendrier, inviter un coach, désactiver une équipe. Une partie existe dans `AdminTeamDetailScreen` et mérite d'être consolidée plutôt que dupliquée.

**Non prioritaire malgré l'apparence :** l'éditeur de règles en interface. Tant que le nombre de règles est petit, le SQL editor suffit et coûte zéro développement. Construire une UI d'édition de règles avant d'avoir stabilisé les règles elles-mêmes serait bâtir l'outil avant de connaître le métier.

## 6. Dette technique — à traiter par opportunité, jamais en priorité

| Élément | Volume | Action suggérée |
|---|---|---|
| `AthleteHomeSupabase.tsx` + `ScheduleScreenSupabase.tsx` débranchés | 1 190 l. | Décider : archiver ou supprimer. Ne pas laisser deux vérités. |
| `AdminTeamScreen.tsx` + `CreateTeamModal.tsx` inatteignables | 1 026 l. | Idem, après consolidation de la console admin |
| Écrans `Stitch*` hérités non routés | ~2 300 l. | Conserver tant que `USE_SUPABASE` peut valoir 0 ; supprimer à l'étape M8 |
| Fichier `nul` à la racine | — | Supprimer |
| `dist/` et `web/` coexistants | — | Ne garder que `web/dist` (seul déclaré dans `vercel.json`) |
| Deux systèmes de questionnaire (Firestore + Postgres) | — | Se résoudra avec le questionnaire NCAA — **gelé** |
| Règle en dur `gabfavergeat@gmail.com` → admin | 1 bloc | Retirer à l'extinction Firebase (M8) |

## 7. Séquence recommandée

Chaque lot a un critère de sortie vérifiable. Un lot n'est pas « fait » parce que le code est écrit — il est fait quand le critère passe.

| Lot | Contenu | Critère de sortie | Statut |
|---|---|---|---|
| **L1** | Débloquer l'onboarding push (P0-1) + porte de rattrapage dans le profil | Un athlète sur son téléphone reçoit la notification de fin de séance **et** la relance | ✅ **vérifié 15/08** — notification reçue, relances programmées (+3 h / +6 h) |
| **L2** | Rebrancher `CoachTeamScreen`, `AthleteDetailScreen`, `CoachScheduleScreen` sur `ctpApi` | Depuis le brief, le coach ouvre la fiche d'un joueur et voit sa courbe 28 j | ✅ 15/08 — `CoachTeamScreen` remplacé par `CoachBoard` (lecture DAR multi-marqueurs) |
| **L3** | Console admin — santé du système, compliance, coût (lecture seule) | Un écran répond à « le brief d'hier est-il parti pour chaque équipe ? » sans ouvrir Supabase | ✅ 15/08 — migration appliquée, onglet Health en ligne |
| **L4** | Nettoyage admin : fusionner les doublons, retirer le code mort, corriger l'onglet Teams | Chaque onglet mène à un écran distinct et atteignable | ✅ 31/07 |
| **L5** | Création de séance in-app avec `planned_load` / `objective` / `group_label` | Une séance créée dans l'app alimente `workload_au`, et `acwr` cesse d'être nul | ⬜ non commencé |
| **L6** | Boucle de décision étendue (`acknowledged` / `overridden`) + export hebdomadaire | Le coach trace ce qu'il a fait d'un signal ; l'export s'ouvre dans Excel | ⬜ non commencé |
| **L7** | M8 — extinction Firebase | Aucune référence `firebase/*` dans le graphe d'imports actif | ⬜ non commencé |

### Comment L1 a été résolu (et pourquoi pas par une colonne en base)

La solution évidente aurait été d'ajouter `profiles.onboarding_complete`. Elle a été écartée : un booléen serveur ment dès que l'athlète change de navigateur ou de téléphone — il serait marqué « onboardé » sans aucune souscription active, exactement le mode de panne qu'on vient de corriger. L'état retenu est donc **dérivé de la réalité de l'appareil** : une souscription `PushManager` valide, resynchronisée à chaque démarrage vers `push_subscriptions` (upsert idempotent, qui répare au passage les lignes perdues). Seul le refus explicite est mémorisé, en local. Détail : doc `08 §13.1`.

### Ce que L3 apporte concrètement

`AdminSystemHealthScreen` affiche, par équipe : date du dernier brief et son âge, nombre de briefs sur 7 j, compliance (réponses ÷ séances terminées × athlètes), séances passées et à venir, relances envoyées et en attente, coût LLM sur 30 j et erreurs. Le bandeau supérieur agrège : équipes en retard de brief, équipes sous 50 % de compliance, coût total. Lecture seule, aucune action destructrice.

**Hors séquence, et prioritaire sur tout :** l'activation des premières règles d'interprétation (P0-3). Ce n'est pas un lot de développement, c'est une décision de fondateur. Elle peut être prise en parallèle de L1.

## 8. Ce que cet audit ne dit pas — et qui compte plus

Le produit n'a pas de client. Chaque lot ci-dessus améliore un produit que personne n'utilise encore en conditions réelles. Le classement L1 → L7 est le bon **à condition qu'il serve un pilote réel** : une équipe, un coach, quinze athlètes, six semaines. Sans ce pilote, on optimise une hypothèse.

Deux ordres de grandeur pour trancher : L1 et L2 sont indispensables avant de mettre l'app entre les mains d'un coach — sans eux, le produit se disqualifie en trois jours. L3 à L7 peuvent attendre le retour du terrain, qui les réordonnera probablement mieux que cet audit.

## 9. Décisions qui n'appartiennent qu'au fondateur

- Quelles règles d'interprétation activer, avec quels seuils et quels textes (doc `02`).
- Le contenu du questionnaire NCAA basketball — **gelé, aucune décision par anticipation**.
- L'arbitrage entre profondeur produit et démarrage du pilote.
- Le modèle de prix, à confronter au coût réel par équipe une fois `llm_logs` exploité.

---

*Mise à jour de ce document : à chaque fin de lot, remplir le critère de sortie (atteint / non atteint, date) plutôt que réécrire l'audit. Un audit qu'on réécrit perd sa valeur de point de comparaison.*

---

## 10. Vérifications de terrain en attente (post-implémentation L1-L4)

Le code est écrit et le graphe d'imports est propre. Rien de tout cela n'est *prouvé* tant que les cinq points suivants ne sont pas passés. Tant qu'un critère n'est pas coché, le lot correspondant reste ouvert.

| # | À faire | Où | Attendu |
|---|---|---|---|
| V1 | `supabase db push` | terminal | Migration `010_admin_health_read.sql` appliquée — sans elle, la console santé affiche `—` pour le coût et 0 relance |
| V2 | Se connecter en athlète sur un **vrai téléphone** | app | L'écran « NEVER MISS A SESSION » apparaît ; après « Enable Notifications », `push_subscriptions` +1 |
| V3 | Insérer une séance test (`end_utc = now() − 1 min`) | SQL | Notification reçue sur le téléphone dans la minute ; sans réponse, relance à +3 h |
| V4 | Ouvrir l'app en coach → onglet Team → cliquer un joueur | app | Roster peuplé avec les statuts ; la fiche joueur affiche la courbe readiness |
| V5 | Ouvrir l'app en admin → onglet Health | app | Une ligne par équipe, dernier brief daté, compliance chiffrée |

Un échec sur V2 ou V3 signifie que la chaîne de notification n'est toujours pas vivante — c'est le seul résultat qui remet en cause la priorisation.

## 11. Ce que ces lots ne changent pas

Le brief reste descriptif : aucune règle n'est activée. Un coach qui ouvrirait l'app demain verrait une interface complète et cohérente qui ne lui dit toujours pas **ce qui mérite son attention**. Les lots L1-L4 rendent le produit utilisable ; ils ne le rendent pas encore utile. Cet écart se referme par une décision, pas par du code — l'activation de trois à cinq règles du doc `02`.


---

## 12. État au 15 août 2026, fin de journée

**Vérifié en conditions réelles :** notification push reçue sur appareil · `session_load` et `workload_au` calculés pour la première fois · ACWR vivant (1,28 sur l'athlète en surcharge simulée) · tableau coach multi-marqueurs peuplé sur 15 athlètes et 2 mois d'historique · porte de consentement active, acceptations horodatées en base · **moteur par athlète validé à zéro écart** contre l'ancien calcul.

**Fermé côté sécurité :** rôle décidé par le serveur (deux codes par équipe) · gardes d'appelant sur les edge functions · policies manquantes sur `teams` et `memberships` · `coach_feedback` en lecture-insertion seule · `create-team` réparé (il n'avait jamais fonctionné) · pseudonymes non réutilisables · suppression et export réels d'un athlète.

**Reste ouvert, par ordre de valeur :**
1. **Activer trois à cinq règles d'interprétation** (doc `02`). Sans elles le brief décrit des chiffres sans dire ce qui compte. Une heure d'expertise fondateur, et c'est ce qui sépare une démo d'un produit.
2. Relecture juridique des trois textes — ils sont `active` mais portent un bandeau « Draft ».
3. Confirmation d'email toujours désactivée · boîte `privacy@` inexistante · journal d'accès absent.
4. Performance : `morning-brief` en série, `ics-sync` en série, `getAdminSystemHealth` en 8N+1, bucket journalier en UTC.
5. Décisions visuelles : cyan de marque, seuils ±10 vs ±15 %, moyenne d'équipe vs distribution.
