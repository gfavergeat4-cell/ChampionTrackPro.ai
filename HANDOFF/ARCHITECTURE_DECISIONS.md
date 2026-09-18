# ARCHITECTURE_DECISIONS

Chaque décision est datée. `DO NOT REVERSE WITHOUT REVIEW` signale celles qui engagent le produit, pas seulement le code.

---

## ADR-01 · Expo / React Native pour une PWA web
**CONTEXTE** Athlètes sur téléphone, coachs sur ordinateur et téléphone. Un développeur unique, non développeur de métier.
**DÉCISION** Expo + React Native, cible web en PWA. Pas d'app store à ce stade.
**ALTERNATIVES** Next.js pur ; Flutter.
**POURQUOI** Un seul code pour une éventuelle sortie native plus tard, sans passer par les stores maintenant. Un coach installe la PWA en deux gestes.
**CONSÉQUENCES** Le rendu web mélange composants React Native et `<div>` — c'est assumé et présent partout. Certaines API web (Service Worker, Push) ne sont accessibles que derrière `Platform.OS === "web"`.
**REVERSE** Non sans revue.

## ADR-02 · Migration Firestore → Supabase, derrière un interrupteur
**DATE** juillet 2026
**CONTEXTE** La V1 tournait sur Firestore. Les calculs se faisaient côté client, les règles de sécurité étaient difficiles à raisonner, et le multi-tenant reposait sur des conventions de chemins.
**DÉCISION** Postgres + RLS. Migration progressive derrière `EXPO_PUBLIC_USE_SUPABASE`, les deux chemins coexistant.
**POURQUOI** SQL permet de mettre le calcul au même endroit pour tout le monde, versionné en migrations. La RLS rend l'isolation multi-tenant démontrable devant un acheteur.
**CONSÉQUENCES** Deux backends dans le même dépôt jusqu'à l'étape M8. Tout écran sans branche `USE_SUPABASE` lit une base vide.
**REVERSE** Non. **DO NOT REVERSE WITHOUT REVIEW.**

## ADR-03 · La chaîne CALCUL → RÈGLES → TRADUCTION → DÉCISION
**CONTEXTE** Le fondateur refuse un produit où « l'IA décide ». Le marché est saturé d'outils qui prétendent prédire.
**DÉCISION** Quatre maillons strictement séparés. Le LLM **ne calcule jamais** et **ne décide jamais** : il narre des chiffres déjà produits par du SQL déterministe et des règles écrites par un humain.
**POURQUOI** C'est le différenciateur, et c'est aussi une protection juridique. Chaque phrase du brief peut être remontée à un chiffre et à une règle versionnée.
**CONSÉQUENCES** `briefs` stocke le payload exact envoyé au LLM. `eval_rule()` est révoquée aux clients. La table `rules` a `enabled = false` par défaut.
**REVERSE** Jamais. **Loi n° 1 de la Constitution.**

## ADR-04 · La table `rules` appartient au fondateur
**DÉCISION** Aucun développeur, aucun agent n'écrit ni n'active une règle d'interprétation. Les propositions vont en DRAFT dans `docs/02`.
**POURQUOI** Le fondateur est l'expert du domaine ; la crédibilité scientifique du produit repose sur le fait que les seuils viennent de lui et sont défendables.
**CONSÉQUENCE PRÉSENTE** Aucune règle n'est active : le brief décrit sans dire ce qui compte. **C'est un choix, pas un oubli.**
**REVERSE** Jamais.

## ADR-05 · Web Push VAPID natif, pas FCM
**DATE** 8 juillet 2026
**CONTEXTE** La V1 utilisait FCM. La V2 devait s'affranchir de Firebase.
**DÉCISION** Web Push standard, VAPID JWT ES256 + chiffrement ECE aes128gcm, écrit en WebCrypto pur.
**ALTERNATIVES** Garder FCM ; emails via Resend.
**POURQUOI** Zéro dépendance Firebase, zéro dépendance npm dans le runtime Deno, standard ouvert.
**CONSÉQUENCES** ~318 lignes de cryptographie maison dans `_shared/webpush.ts` — fonctionne, mais c'est du code sensible à ne pas modifier à la légère. iOS exige l'installation de la PWA.
**REVERSE** Non sans revue.

## ADR-06 · L'état d'onboarding push est dérivé, pas stocké
**DATE** 15 août 2026
**CONTEXTE** Correction du bug qui empêchait toute souscription.
**DÉCISION** La question posée est « ce navigateur possède-t-il une souscription valide ? », résolue à chaque démarrage, plutôt qu'un booléen en base.
**ALTERNATIVE REJETÉE** Colonne `profiles.onboarding_complete`.
**POURQUOI** Un booléen serveur ment au changement d'appareil : marqué « onboardé » sans souscription active — exactement la panne qu'on corrigeait. Un endpoint push appartient à un navigateur, pas à un compte.
**CONSÉQUENCES** Changer de téléphone redemande l'activation. C'est le comportement correct.
**REVERSE** Non sans revue.

## ADR-07 · Le rôle est déduit du code d'invitation, côté serveur
**DATE** 15 août 2026 — **décision fondateur**
**CONTEXTE** `join-team` lisait le rôle dans le corps de la requête : escalade de privilèges triviale.
**DÉCISION** Deux codes distincts par équipe, générés à la création : `XXXXXX-A` (athlètes) et `XXXXXX-C` (staff). Le serveur déduit le rôle du code présenté et ignore ce que le client déclare.
**ALTERNATIVES** Tout le monde athlète + promotion manuelle par l'admin ; code coach à usage unique.
**POURQUOI** Parité avec l'ancienne version, qui distinguait déjà `coachCode` et `codes.athlete`. Aucune friction supplémentaire pour le coach.
**CONSÉQUENCES** Le bouton ATHLETE/COACH de l'écran d'inscription n'a plus aucun effet. Corriger un rôle passe désormais par SQL — volontaire.
**REVERSE** Non. **DO NOT REVERSE WITHOUT REVIEW.**

## ADR-08 · Le questionnaire mesure le COÛT d'un effort, pas un état
**DATE** 15 août 2026 — **décision fondateur**, après deux corrections successives
**CONTEXTE** Trois matériaux sources : un brouillon NCAA orienté état, le questionnaire handball pro, le référentiel Ligue 1.
**DÉCISION** Chaque item mesure ce que l'effort a demandé, sur trois axes — physique, technique, mental. Deux temporalités : coût après chaque séance, état une fois par jour.
**POURQUOI** Fondé sur la méthode DAR de Stéphane Morin. Sans mesure de charge, `workload_au` reste nul et l'ACWR est mort.
**CONSÉQUENCES** `session_load = readiness_score / 10` uniquement si le questionnaire porte des items `role = "cost"`. Un questionnaire hérité mesure un état : le convertir en charge serait un contresens — d'où le garde-fou dans le trigger.
**RÈGLE ASSOCIÉE** Les items sont **rigoureusement identiques en practice et en match**. Toute variation détruirait la comparaison entraînement/compétition, qui est la valeur du système.
**REVERSE** Non sans revue. **Contenu = domaine réservé du fondateur.**

## ADR-09 · Trois marqueurs lus séparément, jamais une moyenne d'équipe
**DATE** 15 août 2026
**CONTEXTE** Méthode DAR, partie 3.
**DÉCISION** Le tableau coach affiche physique, technique et mental côte à côte, chacun avec sa propre baseline et sa tendance. L'équipe se lit en **distribution**, jamais en moyenne.
**POURQUOI** Morin : *« toute tentative de normalisation interindividuelle constitue une erreur méthodologique »*. Et une moyenne sur 12 réponses au lieu de 15 est un chiffre faux qui a l'air juste.
**CONSÉQUENCES** A nécessité une baseline par axe (migration 014). **Contredit `CoachHomeSupabase` qui affiche encore une moyenne** — arbitrage en attente.
**REVERSE** Non sans revue.

## ADR-10 · `f_engine_user` remplace `v_engine` pour un athlète
**DATE** 15 août 2026
**CONTEXTE** 1 206 réponses insérées → 18 lignes calculées.
**DÉCISION** Fonction SQL bornée à un athlète, formules recopiées à l'identique.
**POURQUOI** PostgreSQL ne pousse pas un prédicat dans une `WITH RECURSIVE`.
**VALIDATION** Non-régression ligne à ligne contre `v_engine` : zéro écart.
**RÈGLE** Ne jamais réutiliser `v_engine` pour un seul athlète.

## ADR-11 · Fenêtre de réponse alignée sur les relances, pas l'inverse
**DATE** 15 août 2026
**DÉCISION** Fenêtre RLS portée de 5 h à 8 h ; relances maintenues à +3 h et +6 h.
**POURQUOI** Les timings de relance viennent de la version éprouvée ; la fenêtre de 5 h avait été inventée en V2. On aligne l'arbitraire sur l'éprouvé.
**INVARIANT** Fenêtre **strictement supérieure** au dernier offset de relance.

## ADR-12 · Loi de parité avec l'ancienne version
**DATE** 15 juillet 2026 — **décision fondateur**
**DÉCISION** L'ancienne version fait foi pour fonctionnalités, écrans, questionnaires, textes et timings de notification, workflows, console admin. On ouvre, on copie, on nettoie — on n'improvise pas.
**CONTEXTE** Une réécriture d'écran athlète avait produit un résultat jugé « inférieur à ce que j'avais déjà construit ».
**CONSÉQUENCES** Les composants `stitch_components/` sont des reprises directes, rebranchées sur `ctpApi` sans toucher au rendu. Le copywriting des notifications est repris mot pour mot.
**REVERSE** Non. **DO NOT REVERSE WITHOUT REVIEW.**

## ADR-13 · Le curseur du check-in EST l'emblème de marque
**DATE** 15 août 2026
**DÉCISION** `LogoSlider` reproduit la géométrie et les dégradés du logo — rail 12 px, orbe 22 px (ratio 1,81 relevé sur le PNG), huit stops de dégradé mesurés pixel par pixel.
**POURQUOI** L'emblème est déjà, visuellement, le pouce d'un slider. Le geste quotidien de l'athlète devient la marque.
**DÉTAIL NON ÉVIDENT** Le rail reste **entièrement coloré** quelle que soit la position : c'est ce qui le fait lire comme un emblème et non comme une barre de progression.

## ADR-14 · Les documents juridiques sont versionnés et activables
**DATE** 15 août 2026
**DÉCISION** Table `legal_documents` avec un statut `draft` / `active`. En `draft`, les textes sont publiés mais jamais imposés. Une commande d'une ligne les rend opposables.
**POURQUOI** Ne pas rendre contraignants des textes que personne de qualifié n'a validés, tout en ayant la machinerie prête et testée.
**ÉTAT ACTUEL** `CONFLICTING` — les trois documents sont passés en `active` le 15/08 alors qu'ils portent toujours un bandeau « Draft — not reviewed by counsel ». À clarifier.

## ADR-15 · Pas de test automatisé, un test de chaîne à la place
**DÉCISION** Aucun runner de test. Une procédure de vérification manuelle en cinq étapes (`PROJECT_SOURCE_OF_TRUTH` §31), plus une vérification statique du graphe d'imports.
**POURQUOI** Développeur unique, produit sans utilisateur, priorité au terrain.
**CONSÉQUENCE** Chaque refactor du moteur exige une requête de non-régression écrite à la main. C'est ce qui a été fait pour `f_engine_user`, et ça a fonctionné.
**REVERSE** Oui — dès qu'il y a un client réel, des tests deviennent moins chers que les régressions.

## ADR-16 · Migrations nommées sans horodatage, appliquées à la main
**ÉTAT** `CONFLICTING` — convention subie plutôt que choisie.
**FAIT** `supabase db push` ne détecte pas `001_…` à `019_…`. Toutes ont été appliquées manuellement via le SQL editor.
**RISQUE** Aucune trace centralisée de ce qui est réellement appliqué en production.
**PROCHAINE ACTION** Soit renommer avec horodatage et réconcilier l'historique distant, soit assumer et documenter. **Ne pas renommer sans vérifier d'abord `supabase_migrations.schema_migrations`.**
