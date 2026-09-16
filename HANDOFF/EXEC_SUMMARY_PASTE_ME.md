# RÉSUMÉ EXÉCUTIF — à coller dans le premier message du nouveau chat Claude Code

---

**PROJECT**
ChampionTrackPro — dépôt `gfavergeat4-cell/ChampionTrackPro.ai`, dossier de travail `APP/ChampionTrackPro-V2`.

**ONE-SENTENCE DESCRIPTION**
Système d'aide à la décision pour staffs de basketball NCAA : les athlètes déclarent en 60 secondes ce que chaque séance leur a coûté, un moteur SQL déterministe calcule leurs dérivés individuels, et un LLM narre au coach un brief quotidien où chaque phrase cite un chiffre.

**CURRENT STATE**
Produit fonctionnel de bout en bout, déployé, **sans aucun client**. Chaîne complète vérifiée en exécution réelle le 15 août 2026. Zéro règle d'interprétation active — décision du fondateur, pas un défaut.

**WHAT WORKS**
Authentification et adhésion par code avec rôle décidé côté serveur · import de calendrier iCal · détection de fin de séance et notifications Web Push (reçues sur appareil réel) · check-in athlète piloté par la donnée · moteur de calcul complet, readiness, baseline EMA 28 j, zones, charge, ACWR, sous-scores par axe · Morning Brief LLM avec payload pseudonymisé · tableau coach multi-marqueurs selon la méthode DAR · console santé admin · consentements versionnés et horodatés · isolation multi-tenant par RLS.

**WHAT DOESN'T WORK**
Aucune règle d'interprétation n'est activée, donc le brief décrit sans dire ce qui compte · confirmation d'email désactivée · aucun journal d'accès · push jamais testé sur iOS · relances jamais observées en conditions réelles · `ics-sync` n'annule jamais une séance retirée du calendrier · bucket journalier en UTC alors que `teams.timezone` existe · plusieurs optimisations de montée en charge en attente. Détail complet dans `HANDOFF/KNOWN_ISSUES.md`.

**MOST IMPORTANT TECHNICAL CONTEXT**
1. **Deux applications** : `APP/ChampionTrackPro-LIVE` (ancienne, en production sur `champtrackpro.com`, Firebase, sert de référence de parité) et `APP/ChampionTrackPro-V2` (cible de développement, Supabase).
2. **Deux backends dans la V2**, gouvernés par `EXPO_PUBLIC_USE_SUPABASE`. Les chemins Firebase restent intacts jusqu'à l'étape M8.
3. **`src/lib/ctpApi.ts` est le point d'accès unique** à Supabase. Aucun écran n'appelle Supabase directement.
4. **`f_engine_user` remplace `v_engine`** dès qu'on traite un seul athlète : PostgreSQL ne pousse pas un prédicat dans une `WITH RECURSIVE`, la vue recalculait toute la base.
5. **Les 19 migrations SQL sont appliquées à la main** dans le SQL editor — `supabase db push` ne les détecte pas (nommage sans horodatage).
6. Chaque `upsert` client exige une policy **UPDATE** en plus de l'INSERT. Ce piège a déjà coûté deux bugs silencieux.
7. Environnement du fondateur : **Windows + PowerShell 5**, pas de `&&`.

**MOST IMPORTANT BUSINESS CONTEXT**
Le produit ne prédit rien et ne décide rien : il rend visible ce qu'un coach ne voit pas depuis le bord du terrain, et **le coach décide, toujours**. Chaque athlète est comparé **à lui-même**, jamais à un coéquipier — la méthode DAR de Stéphane Morin proscrit explicitement toute normalisation interindividuelle. Le LLM ne reçoit que des pseudonymes. La table `rules` est la **propriété exclusive du fondateur** : aucun développeur n'y écrit. Le canal d'acquisition est un podcast d'interviews de coachs NCAA. Zéro client payant à ce jour.

**CURRENT PRIORITY**
Faire fonctionner le produit devant un vrai coach. Techniquement, dans l'ordre : réactiver la confirmation d'email après avoir configuré un SMTP · tester le push sur iOS · créer `privacy@championtrackpro.com` · journal d'accès. Mais la priorité absolue n'est pas technique : **l'activation de trois à cinq règles d'interprétation par le fondateur**, sans lesquelles le brief reste descriptif.

**DO NOT DO**
Ne jamais écrire ni activer une règle dans la table `rules` · ne jamais faire calculer ou décider le LLM · ne jamais élargir le payload LLM au-delà des dérivés pseudonymisés · ne jamais supprimer un chemin Firebase avant l'étape M8 · ne jamais purger `coach_feedback` · ne jamais ajouter de policy UPDATE ou DELETE sur `user_consents` · ne jamais utiliser `v_engine` pour un seul athlète · ne jamais réintroduire `git rev-parse HEAD` dans le script de build · ne jamais pousser du code V2 vers le dépôt `ChampionTrackPro_` (public) · ne jamais réécrire un écran de parité sans validation · ne jamais choisir arbitrairement entre deux options contradictoires : écrire `UNKNOWN — USER DECISION REQUIRED`.

**FIRST TASK**
Lire `HANDOFF/CLAUDE_CODE_HANDOFF.md`, puis suivre `HANDOFF/NEW_CLAUDE_STARTUP_CHECKLIST.md` phases 1 à 5, et produire un **PROJECT TAKEOVER REPORT**. Ne modifier aucun fichier avant d'avoir livré ce rapport.
