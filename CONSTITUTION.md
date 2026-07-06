# CONSTITUTION — Champion Track Pro
**v1.0 — 6 juillet 2026. Document fondateur. Se modifie par amendement daté, jamais par réécriture. Les annexes évoluent ; la Constitution, presque jamais.**

---

## Article 1 — Identité

**Mission** : donner à chaque staff sportif la connaissance de l'état réel de ses athlètes, pour performer plus, plus souvent, aux bons moments, en réduisant les blessures liées à la charge.

**Problème** : les coachs devinent qui est prêt à jouer au lieu de le savoir. Les solutions existantes sont soit du hardware coûteux réservé à l'élite (Catapult), soit de la logistique sans science (Teamworks), soit de l'enterprise inaccessible (Kitman). Personne ne sert les 1 600+ programmes D2/D3.

**Vision 5 ans** : le standard de l'aide à la décision d'entraînement du basketball universitaire américain. **Vision 10 ans** : le système d'exploitation de la décision coach, multisport, alimenté par le seul dataset au monde reliant ressenti athlète et décisions d'entraînement réelles.

**Valeurs** : vérité scientifique avant marketing · l'athlète comparé à lui-même, jamais aux autres · le coach décide, toujours · chaque phrase rattachable à un chiffre · simplicité terrain avant sophistication technique.

## Article 2 — Gouvernance des rôles

- **Gabin** détient et décide seul : les règles d'interprétation et leur ingénierie (méthodologie Morin), la science, le pricing, la vente, la vision.
- **Claude** est associé stratégique et constructeur : architecture, code, systèmes, analyse, assets commerciaux, contradiction obligatoire quand une décision affaiblit le produit. Claude ne valide jamais une mauvaise décision parce qu'elle est demandée, ne flatte pas, et adopte le rôle pertinent au moment pertinent — jamais vingt à la fois : une réponse tranchée depuis le bon angle vaut mieux qu'un comité.
- Ce que Claude ne fait jamais : inventer une règle d'interprétation, promettre un résultat sportif, présenter une hypothèse comme un fait.
- **Gabin est législateur, pas opérateur.** Il écrit les règles une fois ; le système les applique seul, à chaque réponse, sans son intervention. Le fonctionnement quotidien de la plateforme n'exige la présence d'aucun humain côté Champion Track Pro — c'est ce qui en fait un produit et non un service. L'intervention humaine de Gabin est une offre additionnelle (consulting), jamais une dépendance du produit.

## Article 3 — Philosophie produit

Champion Track Pro n'est pas une app de questionnaires : le questionnaire n'est qu'un capteur. Ce n'est pas non plus un expert simulé : **le système fait remonter des signaux evidence-based, expliqués et traçables ; il ne reproduit pas le raisonnement d'un expert humain et ne décide à la place de personne.** Chaque recommandation est expliquée, justifiée, traçable — parce qu'elle sort d'une règle écrite par un humain qualifié, pas d'une boîte noire.

## Article 4 — L'architecture est une chaîne (intangible)

```
1. CALCUL      code/SQL    scores, baselines individuelles EMA 28 j, zones, charge
2. RÈGLES      code        flags + recommandations — écrites par Gabin, versionnées
3. TRADUCTION  LLM         narration pour le coach — un appel, payload pseudonymisé,
                           zéro rétention, chaque phrase cite son chiffre source
4. DÉCISION    humain      le coach valide/ignore — tracé (coach_feedback)
```

Le LLM ne calcule jamais, ne décide jamais, ne voit jamais nom + données de santé ensemble. Toute proposition qui brise cette chaîne est anticonstitutionnelle.

**Amendement conditionnel (agents multiples)** : une architecture multi-agents ne pourra être reconsidérée que si les trois conditions sont réunies — plus de 20 équipes payantes, compliance athlète > 70 % tenue en saison, preuve documentée que la chaîne simple ne couvre plus un besoin client réel. Jusque-là, le sujet est clos (Audit stratégique, juillet 2026).

## Article 5 — Le système est événementiel

Tout traitement découle d'un événement : séance terminée → notification → questionnaire rempli → calcul → règles → brief matinal → décision coach → feedback. Implémentation actuelle : webhooks Postgres + edge functions + pg_cron (Supabase). Rien d'implicite, tout historisé.

## Article 6 — Règles de raisonnement du moteur

Jamais de flag sur une mesure isolée : séance actuelle + historique individuel + tendance + contexte (cycle, calendrier, adversaire quand disponible). Baseline individuelle obligatoire — aucun seuil absolu identique pour tous. Minimum de données avant tout flag (défaut moteur : 10 jours ; ajustable par règle par Gabin). Une règle non activée par Gabin n'existe pas.

## Article 7 — Validation scientifique

Toute affirmation produit s'appuie sur littérature, consensus ou pratique du haut niveau, avec niveau de preuve. Sujets controversés (ex. ACWR comme prédicteur) : signalés comme tels, jamais vendus comme faits. Interdictions définitives dans les assets : « prédit les blessures », « remplace l'expert », toute décision automatique de mise au repos. Formulation autorisée : visibilité, signaux, information pour mieux décider.

## Article 8 — Sécurité, qualité, échelle

RLS multi-tenant non négociable (données de santé multi-clients). Secrets jamais dans le code ni le chat. FERPA by design ; conformité santé avancée le jour où un programme l'exige. Chaque décision d'architecture répond à : tient-elle à 10 / 100 / 1 000 / 10 000 équipes ? — sans sur-construire pour 10 000 quand il y a 0 client. Auditer avant de modifier ; produit fonctionnel à chaque étape ; technologies éprouvées ; décisions importantes documentées ; hypothèses explicites ; alternatives comparées quand elles existent.

## Article 9 — UX

Contrats de temps : athlète ≤ 60 s, coach ≤ 90 s. Toute fonctionnalité se juge sur : friction, compréhension immédiate, taux de complétion, réduction de charge mentale. La compliance athlète est LA métrique de survie du produit — visible du coach en permanence.

## Article 10 — Distribution

Wedge : WBB/MBB D2-D3 — coachs seuls décideurs, sous-sollicités, sensibles à l'argument blessures. Consulting-first → SaaS self-serve → expansion. Preuve fondatrice : Cesson-Rennes D1 (+4 places, 0 blessure de charge, 2 mois) — seule référence utilisable tant qu'un pilote NCAA n'a pas conclu. Règles terrain gravées : BAMFAM (toute interaction finit avec une date), réponse aux signaux < 2 h, visuel du brief à chaque appel, prix seulement après engagement d'agenda, zéro référence inventée. Toute décision produit sert d'abord : devenir la référence du marché universitaire américain avant toute expansion.

## Article 11 — Ce que nous ne construisons pas

Orchestrateur multi-agents (cf. art. 4) · prédiction individuelle de blessure · recommandations tactiques/techniques/5 majeur depuis du ressenti · décisions automatiques sans humain · LLM local · features demandées par personne · réécritures de ce qui fonctionne · un 4ᵉ audit de l'existant.

## Article 12 — Annexes (évolutives)

A. Audits (juillet 2026) : `ChampionTrackPro_-main/Fichiers consignes - audit - report/` — B. Specs questionnaires V4 : même dossier — C. Schéma et moteur : `supabase/migrations/` — D. Runbook : `README.md` — E. Actions en cours : `GUIDE_ACTIONS_GABIN.md` — F. Architecture visuelle : board Figma + concept produit.

---

## Amendement n° 1 — 6 juillet 2026 : autonomie totale de la boucle quotidienne

La chaîne de l'article 4 tourne de bout en bout sans intervention humaine : réponse joueur → calculs → règles du fondateur (écrites à l'avance, versionnées) → narration LLM → brief au coach. Le seul humain dans la boucle quotidienne est le **coach destinataire**, qui garde la décision finale. Le fondateur n'intervient que pour légiférer (créer, ajuster, activer des règles) — jamais pour opérer. Toute conception qui rendrait une recommandation dépendante de la présence du fondateur est anticonstitutionnelle.

---
*Amender par ajout daté en fin de document. Si une session de travail contredit la Constitution, la Constitution gagne — ou on l'amende consciemment, jamais par glissement.*
