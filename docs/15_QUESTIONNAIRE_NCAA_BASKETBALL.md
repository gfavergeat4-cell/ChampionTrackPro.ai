# 15 — QUESTIONNAIRE NCAA BASKETBALL · Proposition v3

> **Statut : PROPOSITION. Rien n'est activé.** Contenu et pondérations appartiennent au fondateur (Constitution art. 2). Décisions marquées 🔶.
>
> **v3 — alignement sur la méthode DAR.** Source : Stéphane Morin, *Penser l'entraînement — De la charge à l'effort*, chapitres 29 à 31 (Modèle DAR, parties 1 à 3). Corrections apportées par le fondateur : (a) l'état a toute sa place à côté du coût — « Team Spirit » est un état, et il est utile ; (b) les indicateurs doivent s'adapter au type de séance ; (c) on ne redemande pas deux fois dans la journée ce qui relève de la journée.
>
> Formes reprises : questionnaire Cesson-Rennes handball pro, référentiel Ligue 1. Rédigé le 31 juillet 2026.

---

## 1. Ce que la méthode DAR impose

Quatre décisions de design découlent directement du texte, et non de mon interprétation.

**Quatre familles de ressentis, pas trois** (partie 2, §D). Morin distingue : les ressentis *spécifiques à l'activité* (technique, tactique, réactivité, présence dans le jeu), les ressentis sur les *réactions physiques*, les ressentis *psychologiques*, et les ressentis *sociorelationnels*. Ta remarque sur le Team Spirit tombe exactement dans la quatrième famille — que mes deux versions précédentes avaient purement omise.

**Le coût ET l'état, ensemble.** Les ressentis physiques incluent explicitement « la perception de la disponibilité énergétique **avant** séance ». Ma v2 avait sur-corrigé en n'admettant que le coût. DAR mesure les deux, parce que l'un ne s'interprète pas sans l'autre.

**Deux temporalités distinctes** (partie 2, §C.1). Morin : *« il est souvent plus pertinent de proposer un recueil en fin de journée, à heure fixe […] permettant à l'athlète de réintégrer l'ensemble des sollicitations vécues, physiques, cognitives, sociales, affectives »*. Immédiatement après l'effort, l'athlète verbalise surtout la dernière impression, physiologique. C'est la clé de ton problème de double séance.

**Le sens de lecture ne s'inverse jamais** (partie 2, §E.2). *« le sens de lecture […] du "moins" vers le "plus", même lorsque la valence de la réponse change »*, et l'inversion numérique éventuelle *« doit rester invisible pour l'athlète »*. C'est exactement ce que fait le champ `inverted` de la base : la forme reste stable, le traitement s'ajuste.

## 2. Architecture : deux moments, deux natures

| | **A — Après chaque effort** | **B — Une fois par jour, heure fixe** |
|---|---|---|
| Nature | Coût de l'effort | État global de la journée |
| Familles DAR | Réactions physiques · Spécifiques à l'activité | Psychologiques · Sociorelationnels · Récupération |
| Fréquence | À chaque séance, y compris double séance | **Une seule fois**, quel que soit le nombre de séances |
| Varie selon le type de séance | **Oui** | Non |
| Alimente | `session_load`, `workload_au`, `sub_phy` / `sub_tec` / `sub_men` | baseline d'état, signaux faibles |

C'est la réponse à ta remarque : on ne demande pas deux fois dans la journée à quelqu'un s'il est confiant en lui. La confiance appartient à la journée, pas à la séance. La dépense musculaire, elle, appartient à la séance — et il est légitime de la demander après chacune.

## 3. Bloc A — Après l'effort

### Items disponibles

| metricKey | Famille DAR | Question (athlète) | Ancre gauche | Ancre droite |
|---|---|---|---|---|
| `reserveBefore` | Physique | Before you started, how much did you have in the tank? | Empty — nothing left | Completely full |
| `costMuscular` | Physique | How much did this session cost your muscles? | Nothing | Everything I had |
| `costCardio` | Physique | How much did it cost your engine — breathing, heart rate? | Nothing | Everything I had |
| `recoveryBetween` | Physique | Between reps and drills, how well did you get your air back? | Never recovered | Recovered every time |
| `costTechnical` | Activité | How much technical precision did it demand — handling, finishing, footwork? | Very little | Maximum |
| `costTactical` | Activité | How much reading and decision-making did it demand? | Very little | Constant |
| `costFocus` | Psychologique | How much concentration did it demand? | Very little | Maximum |
| `costEmotional` | Psychologique | How much did it cost you emotionally — pressure, frustration, nerves? | Nothing | A lot |

`reserveBefore` et `recoveryBetween` sont repris presque mot pour mot du référentiel Ligue 1 (blocs C3 et C4) et des indicateurs physiques listés par DAR. `recoveryBetween` est le seul indicateur du lot qui renseigne sur la **capacité d'enchaînement** — Morin en fait un marqueur à part entière, et le basket est un sport intermittent.

### Sélection selon le type de séance 🔶

Un item qui ne concerne pas la séance ne doit pas être posé : il produit du bruit et use la compliance.

| `session_type` | Items posés | Nb | Durée |
|---|---|---|---|
| `practice` · `scrimmage` | reserveBefore · costMuscular · costCardio · recoveryBetween · costTechnical · costTactical · costFocus · costEmotional | 8 | ~65 s |
| `game` | **strictement identiques à practice** | 8 | ~65 s |
| `conditioning` (S&C, prépa physique) | reserveBefore · costMuscular · costCardio · recoveryBetween · costFocus | 5 | ~40 s |
| `skill` (travail individuel) | reserveBefore · costMuscular · costTechnical · costFocus | 4 | ~35 s |
| `other` / récupération | reserveBefore · costMuscular | 2 | ~20 s |

**Règle non négociable : practice et game posent exactement les mêmes questions.** C'est la seule façon de répondre à *« est-ce qu'on s'entraîne pour la compétition ou pour s'entraîner ? »*. Toute autre variation est permise ; celle-là détruirait la comparaison.

**Deuxième règle : un item ne change jamais de formulation d'une variante à l'autre.** Seul le sous-ensemble varie. Une baseline individuelle n'est comparable dans le temps que si la question est rigoureusement identique — Morin insiste sur la stabilité du support comme condition de validité.

## 4. Bloc B — Fin de journée, une seule fois

Passation à heure fixe, indépendante des séances. C'est le moment où, selon DAR, l'athlète *« réintègre l'ensemble des sollicitations vécues »*.

| metricKey | Famille DAR | Question (athlète) | Ancre gauche | Ancre droite |
|---|---|---|---|---|
| `stateSleep` | Physique / récup. | How was last night's sleep? | Broken / poor | Deep / restorative |
| `stateMotivation` | Psychologique | How much did you want to be there today? | Didn't want to be there | Couldn't wait |
| `stateConfidence` | Psychologique | Today, how much did you trust your game? | Doubting myself | Full belief |
| `stateTeamSpirit` | Sociorelationnel | How was the energy in the group today? | Flat / tense | Connected / lifting each other |
| `stateBelonging` 🔶 | Sociorelationnel | Today, did you feel your role in this team was clear? | Completely unclear | Completely clear |
| `costAcademic` | Hors-sport | How much did school take out of you today — classes, study, deadlines? | Nothing | Everything I had |

`stateMotivation` et `stateConfidence` correspondent à « motivation perçue » et « sentiment d'efficacité personnelle » de DAR. `stateTeamSpirit` est ton exemple, et il correspond à l'axe « relation au collectif ». `stateBelonging` couvre l'axe « place dans le dispositif » — Morin le tient pour un modérateur puissant de l'engagement, mais c'est le plus sensible du lot en contexte universitaire américain : 🔶 à garder ou retirer selon ton jugement.

**Le bloc B est le seul endroit où la question « comment vas-tu ? » est posée.** Jamais après une séance.

### La charge académique — une source de dépense, pas un à-côté

DAR consacre plusieurs pages aux sources de dépense énergétique **hors entraînement** (partie 1, §E) : *« L'athlète reste avant tout un être humain évoluant dans une pluralité de sphères : scolaire, universitaire, professionnelle, sociale, familiale »*, et donne comme exemple qu'une *« préparation d'un exposé universitaire […] peut mobiliser autant, voire davantage, d'énergie qu'un footing de récupération »*. Ce ne sont pas des événements annexes, écrit-il, mais *« des sources d'effort, de dépense énergétique, de sollicitations adaptatives permanentes, qui concurrencent ou majorent les effets de l'entraînement »*.

En NCAA, cette sphère n'est pas périphérique : elle est structurante. Les semaines de midterms et de finals, les déplacements qui font manquer des cours, la pression de l'éligibilité académique produisent des pics de dépense qui n'apparaissent nulle part dans un suivi centré sur l'entraînement. Un staff qui voit une chute de disponibilité en semaine d'examens sans disposer de cette variable conclura à une mauvaise récupération, et corrigera la mauvaise chose.

C'est aussi, commercialement, un angle que ne couvre aucun outil de monitoring de charge : le contexte universitaire américain est le seul où l'exigence académique est un impératif réglementaire, et personne ne la mesure à côté de la charge d'entraînement.

⚠️ **Garde-fou de conformité, non négociable.** On mesure une **perception de dépense**, jamais une performance scolaire. Ne jamais demander de notes, de résultats, de cours suivis, de statut d'éligibilité ni de difficulté dans une matière. Ces éléments constituent des *education records* au sens FERPA, et les collecter transformerait un simple contrat de suivi sportif en traitement de données scolaires — avec le service juridique de l'université en face. La formulation retenue ne demande que l'énergie dépensée, ce qui reste du ressenti de l'athlète et non un dossier académique. Voir docs 12 et 13.

🔶 Un second item est envisageable — *« Combien de cours as-tu manqués à cause du basket cette semaine ? »* — qui rendrait visible le conflit sport/études. Puissant pour le coach, mais politiquement inflammable dans un environnement NCAA. À arbitrer, pas à décider à ta place.

## 5. Bloc douleur — quotidien, attaché au bloc B

| Étape | Question | Format | Colonne |
|---|---|---|---|
| D1 | Anything hurting or bothering you today? | Oui / Non | `has_friction` |
| D2 | *(si oui)* What kind? | Physical · Mental / emotional · Both | `friction_type` |
| D3 | *(si physique)* Where? | Head/neck · Shoulder · Back · Hip/groin · Thigh · Knee · Calf/shin · Ankle · Foot · Hand/wrist · Other | 🔶 colonne à créer |
| D4 | How much did it get in your way? | Curseur — Didn't affect me → Couldn't play through it | `friction_impact` |
| D5 | How worried are you about it? | Curseur — Not worried → Very worried | `worry_level` → `worry_flag` si > 70 |

Attaché au bloc B et non à chaque séance : une douleur appartient à la journée, pas à l'effort. Elle n'entre dans aucun score et remonte telle quelle au staff — pondérer une douleur par algorithme est interdit par la Constitution.

## 6. Ce que le serveur en tire

```
-- Bloc A, par séance
sub_phy      = moyenne(costMuscular, costCardio, recoveryBetween*)   -- *valence inversée
sub_tec      = moyenne(costTechnical, costTactical)                  -- NULL si non posés
sub_men      = moyenne(costFocus, costEmotional)
session_load = somme pondérée des items de coût de la séance / 10
workload_au  = session_load × durée réelle                           -- alimente enfin l'ACWR

-- Bloc B, par jour
state_index  = somme pondérée des items d'état                       -- baseline propre
```

⚠️ `sub_tec` est **NULL** un jour de musculation, pas zéro. On ne fabrique pas une donnée qu'on n'a pas mesurée. Le moteur doit propager le NULL, et les moyennes doivent l'ignorer plutôt que le compter comme 0.

### L'écart entraînement / compétition

Le calcul qui justifie la règle du §3. **Calculé par athlète, jamais sur une moyenne d'équipe** — voir §7.

```
Pour chaque athlète, sur fenêtre glissante :
  écart_spécificité[axe] = moyenne(sub_axe | session_type='practice')
                         / moyenne(sub_axe | session_type='game')
```

Le coach lit, joueur par joueur, dans quelle mesure l'entraînement reproduit l'exigence du match sur chacun des trois axes. 🔶 Fenêtre, nombre minimum de matchs avant affichage, et seuils : ta décision.

## 7. Trois contradictions entre la méthode DAR et ce qui tourne aujourd'hui 🔶

Elles ne sont pas mineures et n'ont jamais été arbitrées. Elles t'appartiennent.

### 7.1 Les zones : ±10 points, ou ±15 % ?

DAR (partie 3, §C) construit ses trois zones sur un **écart absolu de ±10 points autour de la MME**, et argumente ce choix : trois zones parce que *« moins que / à peu près comme / plus que »* est un schéma cognitif robuste, et que multiplier les seuils *« donne une illusion de finesse »*.

Ton moteur (`v_zones`, migration 003) utilise un **écart relatif de ±15 %**. Les deux coïncident autour d'une MME de 65 — et divergent fortement ailleurs : à une MME de 30, ±10 points valent ±33 %, à une MME de 85, ±11,8 %. Un athlète à baseline basse est aujourd'hui déclaré « habituel » sur des écarts que Morin classerait en sursollicitation.

**Aligner ou assumer l'écart, mais le savoir.** C'est un paramètre du moteur, donc ton domaine exclusif.

### 7.2 Les moyennes d'équipe

DAR est catégorique (partie 2, §E.4) : *« toute tentative de normalisation interindividuelle constitue une erreur méthodologique. Comparer les ressentis de deux athlètes, établir des moyennes de groupe, déterminer des seuils standardisés, revient à effacer ce qui fait la richesse même du ressenti. »*

Or `CoachHomeSupabase` affiche une **readiness moyenne d'équipe** en chiffre héros, avec animation de comptage. C'est le premier chiffre que voit le coach chaque matin, et c'est précisément ce que la méthode interdit.

Ce que DAR propose à la place (partie 3, §D) : une lecture par **quartiles et distributions**, qui montre la stratification interne du groupe au lieu de l'écraser. Concrètement, remplacer « 72 » par *« 3 joueurs en sursollicitation, 9 habituels, 3 en sous-sollicitation »* — plus honnête, et plus actionnable pour le coach.

🔶 Décision : garder la moyenne (simple, vendeur, méthodologiquement faux) ou passer à la distribution (fidèle à la méthode, un peu plus exigeant à lire).

### 7.3 Le moment du recueil

Ta RLS autorise la réponse entre la fin de séance et **+5 heures** (`002_rls.sql:70`). DAR recommande un recueil **en fin de journée à heure fixe** pour les ressentis globaux.

L'architecture à deux blocs résout la contradiction — mais impose deux fenêtres différentes : le bloc A garde la fenêtre post-séance, le bloc B a besoin d'une fenêtre journalière indépendante. Ce n'est pas ce que fait la RLS aujourd'hui.

Note connexe : `session-watcher` programme une relance à **+6 h** alors que la fenêtre se ferme à +5 h. L'athlète remplit 60 secondes et prend un refus — signalé aussi dans l'audit backend.

## 8. Pondérations 🔶

Poids proposés — **aucun n'a été mesuré sur ta population**. Point de départ défendable, à réviser après 6 à 8 semaines de données réelles et de feedback coach.

**Bloc A, séance complète (practice / game)** — les 7 items de coût somment à 1.0 ; `reserveBefore` est du contexte, poids 0.

| Item | Axe | Poids |
|---|---|---|
| `costMuscular` | PHY | 0.18 |
| `costCardio` | PHY | 0.18 |
| `recoveryBetween` | PHY | 0.12 |
| `costTechnical` | TEC | 0.14 |
| `costTactical` | TEC | 0.14 |
| `costFocus` | MEN | 0.13 |
| `costEmotional` | MEN | 0.11 |
| `reserveBefore` | — | 0.00 |

Soit 48 % physique, 28 % technique, 24 % mental. **Les variantes doivent renormaliser à 1.0** sur les items réellement posés — sinon une séance de musculation produit mécaniquement un coût plus faible qu'une practice, ce qui serait un artefact et non une mesure.

**Bloc B** — les items d'état somment à 1.0. `costAcademic` est un **coût**, pas un état : comme `reserveBefore` au bloc A, il porte un poids de 0 dans l'indice d'état et se lit séparément, en regard de la charge d'entraînement. Le confondre avec un état d'humeur ferait baisser mécaniquement la disponibilité perçue en semaine d'examens, alors que c'est précisément la distinction qu'on cherche à rendre visible. 🔶 Répartition à ta main. Prudence sur `stateTeamSpirit` : c'est un ressenti *collectif*, il varie pour tout le monde le même jour et écrasera la baseline individuelle si son poids est élevé.

## 9. Échelle et affichage

- Curseur **1 à 100**, EVA continue sans repère préalable — conforme à DAR partie 2, §E.1.
- **Aucun chiffre affiché à l'athlète.** DAR : l'EVA *« ne mesure rien de mesurable »*, elle localise une expérience. Afficher un nombre invite à la comparaison entre coéquipiers, que la méthode proscrit.
- **Sens de lecture identique partout**, du moins vers le plus. L'inversion de valence est un traitement serveur, invisible côté athlète.
- Un curseur par écran, ancres aux deux extrémités.
- 🔶 Position de départ : non initialisée. Le départ au centre produit un biais de centralité massif en passation quotidienne.
- **Confidentialité affichée.** DAR fait de la transparence une condition de validité : *« L'athlète doit savoir qui lit, qui utilise, et dans quel but. »* Un athlète qui doute de l'usage minore ses réponses — la méthode donne l'exemple d'un écart de 70 à 50 sur la fatigue selon le dispositif. C'est aussi une exigence de conformité (docs 12-13).

## 10. À construire côté serveur

1. **Deux questionnaires distincts** : `tpl-bball-effort` (bloc A, variantes par `session_type`) et `tpl-bball-daily` (bloc B). Aujourd'hui `team_questionnaires` lie une équipe à un seul questionnaire, sans notion de type.
2. **Résolution séance → variante** par `sessions.session_type`, avec repli par défaut.
3. **Renormalisation des poids** à l'exécution, sur les items réellement posés.
4. **Trigger `session_load` / `workload_au`** — ranime l'ACWR, nul depuis le début.
5. **Alimentation de `sub_phy` / `sub_tec` / `sub_men`** avec propagation correcte des NULL.
6. **Fenêtre journalière** pour le bloc B, distincte de la fenêtre post-séance.
7. **Anti-doublon** : une seule réponse bloc B par athlète et par jour, même en double séance.
8. **Colonne zone corporelle** (D3).
9. **Garde-fou somme des poids** = 1.0 à l'insertion d'un questionnaire.
10. 🔶 **Vue de distribution** (quartiles) si tu arbitres le §7.2 en faveur de la méthode.

## 11. Ce qui a été écarté, et pourquoi

| Écarté | Source | Raison |
|---|---|---|
| Brouillon NCAA à 9 curseurs | Gabin, v1 | Mélange coût et état sans distinguer les temporalités. Remplacé par l'architecture à deux blocs. |
| Un questionnaire unique pour tous les types de séance | ma v2 | Erreur : poser « précision technique » après une séance de force produit du bruit. Corrigé par le fondateur. |
| Capacité / technique / tactique **adverses** | Handball | Analyse de match, pas suivi de charge. N'alimente aucun calcul. |
| Qualité technique perçue (« tes passes étaient-elles précises ? ») | Ligue 1, B1-B4 | Auto-évaluation de performance devant le coach → réponses biaisées. DAR sépare nettement le ressenti de dépense du jugement de réussite. |
| Bien-être personnel / relationnel séparés | Handball | Fusionnés dans `stateTeamSpirit` et `stateBelonging`. |
| Disponibilité à l'apprentissage, clarté de la communication | DAR, familles 3 et 4 | Pertinents, mais budget quotidien saturé. Candidats à une passation **hebdomadaire**, cohérente avec la « lecture hebdomadaire » de DAR (partie 2, §B.2). |
| Fréquence d'apparition de la douleur | Ligue 1, A4 | Coût cognitif élevé pour un athlète qui a mal. Reconstituable côté serveur. |
| Douleur affective / relationnelle en catégories distinctes | Ligue 1, A2 | Fusionnées. Un athlète de 19 ans ne fera pas la distinction de façon fiable. |

## 12. Les décisions qui t'appartiennent 🔶

1. **Les formulations.** Le point critique. DAR : *« La question doit parler au corps, pas au dictionnaire. »* Un item mal compris produit du bruit toute la saison.
2. **Zones : ±10 points ou ±15 %** (§7.1). Paramètre de moteur, ton domaine exclusif.
3. **Moyenne d'équipe ou distribution** (§7.2). Décision produit autant que méthodologique.
4. **La sélection par type de séance** (§3) — tu es le seul à savoir ce que contient réellement une séance NCAA.
5. **Les pondérations** (§8), et le poids de `stateTeamSpirit` en particulier.
6. **Garder ou retirer `stateBelonging`** — le plus sensible du lot.
6bis. **Le second item académique** (cours manqués) — utile ou politiquement intenable ?
7. **La constante de la MME.** Le moteur utilise 28 jours (α = 2/29). DAR consacre une section au choix de la constante et met en garde contre une constante *« arbitraire, déconnectée du rythme réel »*. Une saison NCAA a un rythme hebdomadaire marqué.
8. **L'heure fixe du bloc B.**
9. Plus tard, avec des données réelles : les **seuils d'interprétation** (doc 02).

---

*Une fois arbitré : deux migrations (seeds + colonne zone corporelle + fenêtre journalière), un trigger de calcul de coût, la résolution séance → variante, et l'adaptation de l'écran de check-in.*
