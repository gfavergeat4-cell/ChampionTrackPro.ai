# 04 — VISION PRODUIT À 10 ANS
**Le document que lit un investisseur, un futur CTO ou un acquéreur. Compatible Constitution (les ambitions y sont gouvernées par des portes d'activation mesurables, pas par de l'enthousiasme).**

---

## 1. Mission (reformulée)

> **Champion Track Pro est un système d'aide à la décision destiné aux staffs de performance.** Il ne collecte pas des perceptions d'effort : il les transforme en recommandations opérationnelles, expliquées et traçables, grâce à une chaîne d'analyse qui codifie le raisonnement des meilleurs préparateurs physiques. Chaque décision produite tient compte de la séance venant d'être réalisée, de l'historique individuel complet, de l'historique collectif, de la planification, des tendances sur plusieurs jours/semaines/cycles, et des règles méthodologiques définies par les experts.

Nuance constitutionnelle qui nous protège juridiquement ET commercialement : le système **codifie** le raisonnement expert en règles vérifiables — il ne « simule » pas un expert en boîte noire. Même puissance, zéro promesse invérifiable.

## 2. Le principe qui gouverne tout (gravé)

> Une recommandation n'est jamais produite à partir du seul questionnaire venant d'être rempli. Chaque analyse reconstruit automatiquement le contexte pertinent — 7 j, 28 j, microcycle, mésocycle, séances comparables, charges cumulées, alertes passées, recommandations émises, décisions du coach — et raisonne sur l'évolution dans le temps, jamais sur une mesure isolée.

## 3. Philosophie d'architecture (gravée)

**Tout est événement.** Équipe créée, séance planifiée, séance terminée, notification envoyée, réponse reçue, analyse produite, brief généré, alerte émise, décision coach enregistrée : chaque événement métier déclenche automatiquement les traitements suivants, sans intervention humaine. Composants faiblement couplés, extensibles indépendamment, dimensionnés pour des milliers d'équipes. (Implémentation actuelle : Postgres + webhooks + edge functions + crons — déjà conforme.)

## 4. Le workflow métier canonique (cible complète)

```
Admin crée l'organisation/équipe → coach créé → athlètes rejoignent par code sécurisé
→ chaque athlète possède profil, historique, questionnaires, analyses, stats, alertes
→ le coach construit son planning : date, début/fin, type, OBJECTIF, CHARGE PRÉVUE,
  durée prévue, groupe concerné (import calendrier OU création in-app)
→ fin de séance détectée automatiquement → notification immédiate au groupe concerné
→ questionnaire sliders (sRPE, fatigue, sommeil, douleurs, motivation, stress, humeur,
  récupération, commentaire libre — composition finale : ingénierie Gabin, doc 02)
→ relances automatiques 20 min / 40 min / 1 h jusqu'à réponse ou clôture coach
→ enregistrement relié au joueur, à la séance, à l'équipe, au cycle
→ ÉVÉNEMENT réponse → moteur : reconstruction du contexte complet
→ modules d'analyse spécialisés (Charge, Fatigue, Tendances, Signaux corps,
  Récupération, Variabilité, Qualité des données, Performance, Cohérence)
→ synthèse : score de confiance, arguments, risques, recommandations hiérarchisées
→ rapport coach : vue équipe, vue individuelle, joueurs critiques, évolution,
  alertes, actions recommandées, explication du raisonnement, niveau de confiance
→ décision coach tracée → nourrit le dataset → améliore la hiérarchisation
```

Écarts actuels vs cible (backlog) : charge prévue/objectif/groupe sur les séances (schéma à étendre : `sessions.planned_load, objective, group_id` + microcycles/mésocycles en table `cycles`), relances 20/40/60, clôture de séance par le coach, commentaire libre (avec filtrage avant LLM), création de séance in-app en plus de l'import ICS.

## 5. Les « agents » — doctrine en trois générations

- **Gén. 1 (maintenant)** : les agents sont des **modules déterministes** du moteur de règles (doc 02) — entrées définies, sorties structurées, niveau de confiance, 100 % auditables. Un seul appel LLM en bout de chaîne pour la narration. C'est ce qui rend le produit vendable à un staff et défendable devant un directeur juridique d'université.
- **Gén. 2 (porte d'activation : > 20 équipes payantes, compliance > 70 % en saison, besoin documenté)** : agents d'analyse LLM en second rideau — reformulation contextuelle riche, réponses aux questions du coach en langage naturel (« pourquoi P-07 est jaune ? » → réponse tracée sur les chiffres), synthèses hebdo/mensuelles multi-sources. Le déterministe reste juge ; le LLM reste narrateur augmenté.
- **Gén. 3 (porte : dataset multi-saisons, partenariat académique pour validation)** : modèles appris sur le corpus propriétaire (voir §6) pour la hiérarchisation et la personnalisation des seuils par profil de joueur. Publication scientifique = fossé de crédibilité.

## 6. Le fossé concurrentiel : le dataset de décision

Personne au monde ne possède le corpus « ressenti quotidien × contexte d'entraînement × recommandation émise × **décision réelle du coach** × suite de la saison ». Catapult a du GPS, Teamworks a de la logistique, Kitman a des données enterprise cloisonnées. Notre `coach_feedback` (useful/noise/acknowledged/overridden) étiquette chaque recommandation dès le premier client. À 100 équipes × 15 athlètes × 150 check-ins/saison, c'est ~225 000 points de décision étiquetés PAR AN. C'est l'actif qui se valorise à 9 chiffres — et il ne s'achète pas, il se collecte. Chaque saison d'avance est une saison inrattrapable.

## 7. Trajectoire 10 ans (jalons falsifiables)

| Acte | Horizon | Produit | Preuve de passage |
|---|---|---|---|
| 1. Le monitoring qui parle coach | 2026 | Chaîne actuelle + règles Morin activées + pilote instrumenté | 1 pilote NCAA 8 sem., compliance > 70 %, staff qui lit > 80 % des briefs |
| 2. L'aide à la décision apprise | 2027 | Gén. 2, planning in-app, cycles, relances intelligentes, console admin, wearables v1 (import Catapult/Polar API) | 15-30 programmes payants, > 50 % des flags jugés « useful », rétention saison 2 > 80 % |
| 3. Le standard multi-sport | 2028-2029 | Templates volleyball/soccer/football, benchmarks anonymisés par poste/division (effet réseau data), API publique | 100+ programmes, 1 M$+ ARR, 2 sports hors basket en prod |
| 4. L'OS de la performance universitaire | 2030-2033 | Licence départements athlétiques (tous sports d'une fac), Gén. 3 validée académiquement, expansion Europe | Renouvellements multi-annuels, étude publiée, 1 000+ équipes |
| 5. Sortie ou domination | 2034-2036 | Position : « la couche décision au-dessus de tous les capteurs » | Acquéreurs naturels : Hudl, Teamworks, Catapult — 50-150 M$+ selon ARR et dataset |

## 8. Ce qui peut tuer cette vision (et les parades)
1. **Compliance athlète qui s'effondre** → design du check-in (45 s, rétribution immédiate), visibilité coach, culture d'équipe embarquée dans l'onboarding. Métrique n° 1 du produit, pour toujours.
2. **Un faux positif retentissant devant un staff** → règles conservatrices au lancement, score de confiance affiché, vocabulaire de signal, human-in-the-loop tracé.
3. **La dispersion du fondateur** → Constitution art. 11 ; une seule question à chaque nouvelle idée : « est-ce que ça fait signer ou réussir le pilote ? »
4. **Un géant qui copie l'interface** → il ne peut pas copier le dataset (§6) ni la crédibilité méthodologique terrain (Cesson, puis pilotes). Vitesse = protection.
5. **La dépendance au fondateur pour l'interprétation** → résolue par design : les règles sont dans la base, versionnées, exécutées par la machine (Constitution, amendement n° 1).

## 9. Boussole de décision permanente
À chaque arbitrage produit/technique, dans l'ordre : (1) Est-ce que ça augmente la compliance athlète ? (2) Est-ce que ça fait gagner du temps ou de la confiance au coach ? (3) Est-ce que ça enrichit le dataset de décision ? (4) Est-ce que ça tient à 1 000 équipes ? (5) Est-ce vendable tel quel au pilote actuel ? Deux non sur les trois premières = on ne le construit pas.
