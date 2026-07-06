# 02 — MOTEUR DE RÈGLES SPORT SCIENCE
**Le cœur de l'ingénierie du produit. Statut de CE document : PROPOSITION structurée depuis la littérature — chaque règle est DRAFT tant que Gabin ne l'a pas validée, ajustée ou remplacée. Gabin est le législateur (Constitution art. 2) ; ce document est son établi, pré-rempli pour qu'il révise au lieu de partir de zéro.**

---

## 0. LE PRINCIPE FONDAMENTAL (loi suprême du moteur)

> **Une recommandation n'est JAMAIS produite à partir du seul questionnaire qui vient d'être rempli.** À chaque réponse, le système reconstruit automatiquement le contexte : 7 derniers jours, 28 derniers jours, microcycle en cours, séances comparables, charges cumulées, alertes passées, recommandations déjà émises et décisions du coach. Le moteur raisonne comme un préparateur physique expérimenté raisonne : sur l'évolution dans le temps, jamais sur une mesure isolée.

Traduction technique : chaque évaluation de règle a accès à `v_engine` (série complète), pas à la ligne du jour. C'est déjà l'architecture (CTE 28 j + fenêtres 7 j).

## 1. Couche 0 — Qualité des données (rien ne tire si la donnée est pourrie)

| ID | Règle proposée | Justification | Statut |
|---|---|---|---|
| Q-01 | Aucun flag individuel avant **10 jours de données réelles** (`min_data_days`, défaut moteur) | En dessous, la baseline EMA est du bruit ; MIN=3 actuel est indéfendable | DRAFT — Gabin fixe le seuil |
| Q-02 | Aucune lecture d'ÉQUIPE si compliance < **60 %** ce jour-là (les moyennes mentent) | Standard monitoring subjectif (Saw 2016 : la valeur dépend de l'adhésion) | DRAFT |
| Q-03 | Détection de réponse mécanique : ≥ 5 sliders identiques ±2 pts sur ≥ 5 jours consécutifs → flag DATA_QUALITY (au staff, jamais à l'athlète) | "Straight-lining" documenté dans tous les systèmes wellness | DRAFT |
| Q-04 | Réponse hors fenêtre (rappel : fenêtre actuelle 5 h) = exclue des baselines | Le ressenti tardif est contaminé | DRAFT — durée à valider |

## 2. Couche 1 — Définitions de calcul (déterministes, versionnées)

Toutes existantes ou prêtes dans `003_engine.sql`, sauf celles marquées ⏳ (attendent la mesure de charge sRPE — décision produit en attente, cf. SPEC_V4 §2).

| Grandeur | Définition | Source |
|---|---|---|
| Readiness | Σ (slider × poids), inversions appliquées, clamp 1-100 — poids depuis le template questionnaire | Système existant (V3) |
| Baseline individuelle | EMA 28 j, α = 0,069, carry-forward des jours manqués | Méthodologie Morin (validée Cesson) |
| Déviation | (valeur − EMA)/EMA × 100 ; zones GREEN ±15 % / BLUE < −15 % / YELLOW > +15 % | Méthodologie Morin |
| Z-score individuel | (valeur − moyenne 28 j)/écart-type 28 j — **à ajouter à v_engine** : plus défendable que la déviation % car il intègre la variabilité propre du joueur | Standard monitoring (Hooper & Mackinnon 1995) |
| ⏳ workloadAU | sRPE (CR-10 ou slider /10) × durée min | Foster 1998 — méthode de référence depuis 25 ans |
| ⏳ Monotonie | moyenne charge 7 j / écart-type 7 j | Foster : monotonie élevée + charge élevée = risque |
| ⏳ Strain | charge hebdo × monotonie | Foster |
| ⏳ ACWR | charge aiguë 7 j / chronique 28 j (version EWMA préférable à la moyenne simple — Williams 2017) | Gabbett 2016 — ⚠ CONTESTÉ (Impellizzeri 2020) : à présenter comme descriptif, JAMAIS comme prédicteur de blessure |

## 3. Couche 2 — Modules d'analyse ("agents" métier)

Ce que la vision appelle Agent Charge, Agent Fatigue, etc. s'implémente en **modules déterministes du moteur** — chacun a des entrées, des règles, des sorties structurées et un niveau de confiance. Pas des LLM : des fonctions. (Constitution art. 4 ; le LLM ne fait que narrer la synthèse.)

### Module CHARGE ⏳ (exige sRPE)
| ID | Condition proposée | Flag | Reco (mots de Gabin à écrire) | Source |
|---|---|---|---|---|
| C-01 | ACWR > 1,3 sur 3 j | LOAD_SPIKE | __ | Zone Gabbett, seuil conservateur |
| C-02 | Charge match = max hebdo récurrent (2 sem.) | UNDERPREPARED | __ (l'insight Cesson : sous-entraînés en intensité) | Cesson |
| C-03 | Monotonie 7 j > 2,0 | MONOTONY | __ | Foster |

### Module FATIGUE / RÉCUPÉRATION
| ID | Condition proposée | Flag | Source |
|---|---|---|---|
| F-01 | z(readiness) < −1,5 deux jours consécutifs | FATIGUE_WARNING | Hooper ; pattern standard |
| F-02 | Sous-score PHY < baseline PHY −15 % trois jours | PHY_DECLINE | Morin zones |
| F-03 | `recovery`/sommeil bas isolé 1 jour | RIEN (silence) | Principe fondamental : jamais une mesure isolée |

### Module TENDANCES
| ID | Condition proposée | Flag | Source |
|---|---|---|---|
| T-01 | Pente EMA readiness négative sur 21 j (régression sur la fenêtre) | TREND_DECLINE | **Pattern pré-blessure observé à Cesson (3 semaines)** — signal signature du produit |
| T-02 | Variabilité intra-joueur ÷2 vs habitude (aplatissement) | FLATLINE | Perte de réactivité du signal — précurseur documenté |

### Module SIGNAUX CORPS / "BLESSURE"
⚠ Cadre : détection de signaux, JAMAIS prédiction (Bahr 2016 : aucun screening ne prédit la blessure individuelle — écrit noir sur blanc dans nos assets).
| ID | Condition proposée | Flag | Source |
|---|---|---|---|
| B-01 | jointSoreness > 60 OU +20 pts vs baseline perso (si item V4 déployé) | BODY_WARNING (priorité haute, visible le matin même) | Standard wellness |
| B-02 | worry_level > 70 (existant) | WORRY_FLAG | Système V3 existant |

### Module PSYCHOSOCIAL / ÉQUIPE
| ID | Condition proposée | Flag | Source |
|---|---|---|---|
| P-01 | Chute simultanée du sous-score MEN chez ≥ 40 % de l'effectif sur 5 j SANS baisse PHY | TEAM_MENTAL | **Insight Cesson : la série de défaites était mentale, pas physique** |
| P-02 | mentalFatigue z < −1,5 en période d'examens (calendrier académique) | ACADEMIC_LOAD | Spécificité student-athlete NCAA |

### Module COHÉRENCE (méta)
| ID | Condition proposée | Sortie | 
|---|---|---|
| K-01 | Deux modules en contradiction (ex. readiness haut + soreness haut) | Baisse du score de confiance + mention explicite dans le brief |
| K-02 | Le coach a overridé le même flag 3× | Signal RULE_REVIEW vers Gabin (la règle est peut-être mal calibrée pour cette équipe) |

## 4. Synthèse et hiérarchisation (ce que le coach voit, dans quel ordre)

1. Priorité 1 : sécurité/corps (B-xx) et fatigue confirmée (F-01) — les décisions D'ENTRAÎNEMENT du jour d'abord (exigence Gabin).
2. Priorité 2 : charge/planification (C-xx, T-xx) — l'ajustement de la semaine.
3. Priorité 3 : équipe/mental (P-xx).
4. Priorité 4 : information (GREEN, progrès, retours de bons signaux).

**Score de confiance par recommandation** (0-100, calculé, affiché) = f(jours de données du joueur, compliance récente, convergence des modules, ancienneté de la baseline). Formule exacte : à écrire par Gabin ; proposition simple : `min(100, data_days×3) × compliance_28j × (1 − 0,25×contradictions)`.

## 5. Anti-règles (le système ne dit JAMAIS)
Jamais "risque de blessure de X %". Jamais "ne le faites pas jouer" (le flag dit "à évaluer par le staff avant la séance"). Jamais une cause ("il dort mal parce que…"). Jamais une reco sans citer le chiffre et la règle qui l'ont produite. Jamais un conseil médical.

## 6. Mécanique d'implémentation (déjà en place)
Chaque ligne validée par Gabin devient une ligne SQL dans `rules` : `insert into rules (id, description, metric, condition_sql, min_data_days, flag_code, severity, recommendation, priority, enabled) values (…)` — puis `enabled=true` l'active instantanément, sans déploiement. Versionnage par champ `version` (jamais de modification silencieuse : nouvelle version, ancienne conservée pour l'audit trail des briefs passés). Le champ `recommendation` contient TES mots — le LLM les cite tels quels.

## 7. Ce que Gabin doit faire sur ce document
1. Rayer/corriger chaque seuil (les valeurs proposées sont des points de départ littérature, pas des vérités).
2. Écrire les textes `recommendation` avec ses mots de terrain (EN, langage coach).
3. Trancher la mesure de charge (sRPE — débloque le module CHARGE entier, cf. SPEC_V4 §2).
4. Injecter ses ressources (dossier S. MORIN — 80+ articles, notebook Hormozi pour le wording des briefs commerciaux) : les seuils Morin réels priment sur mes propositions.
5. Décider l'ordre d'activation : recommandation d'exécution — d'abord Q-01/Q-02 + F-01 + T-01 + B-02 (le minimum crédible), le reste après 4 semaines de données pilote.
