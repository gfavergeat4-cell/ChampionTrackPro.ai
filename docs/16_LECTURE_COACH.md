# 16 — LIRE LE TABLEAU COACH · Mode d'emploi et argumentaire

> Deux publics dans un seul document. **§1 à §5 : pour toi**, comment l'écran est construit et pourquoi. **§6 : le script**, ce que tu dis à un coach en trois minutes. **§7 : les objections** que tu vas recevoir.
>
> Fondement : Stéphane Morin, *Penser l'entraînement — De la charge à l'effort*, modèle DAR parties 2 et 3. Écran : `src/screens/CoachBoard.tsx`. Rédigé le 31 juillet 2026.

---

## 1. Les trois règles qui gouvernent l'écran

Chaque choix d'affichage vient d'une phrase du texte de Morin. Si un jour quelqu'un veut changer l'écran, c'est à ces trois règles qu'il faut se confronter.

**Trois marqueurs, jamais un seul chiffre.**
> « Chaque série possède sa propre tendance, sa zone de variations habituelles (±10) et ses zones d'écart. […] C'est cette articulation, et non une moyenne arithmétique, qui fonde une régulation fine. »

D'où trois colonnes — physique, technique, mental — et aucun score composite. Un joueur physiquement dans ses habitudes mais mentalement en surcharge n'existe pas dans un chiffre unique : il y disparaît.

**La couleur ET la courbe.**
> « La couleur seule, isolée de cette double lecture, ne suffit jamais à interpréter correctement la situation. Un vert n'est pas toujours synonyme de stabilité attendue, un jaune n'est pas toujours le signe d'une surcharge. »

D'où, sur chaque marqueur : une pastille de zone, l'écart en points, **et** une flèche de tendance. Trois informations, pas une.

**Aucune moyenne d'équipe.**
> « Toute tentative de normalisation interindividuelle constitue une erreur méthodologique. Comparer les ressentis de deux athlètes, établir des moyennes de groupe, déterminer des seuils standardisés, revient à effacer ce qui fait la richesse même du ressenti. »

D'où la barre de répartition au lieu du chiffre d'équipe : on montre **combien** de joueurs sont dans chaque zone, jamais la moyenne du groupe. C'est aussi ce qui reste vrai quand un joueur manque à l'appel — une moyenne sur 9 réponses au lieu de 15 est un chiffre faux qui a l'air juste.

## 2. Ce que chaque élément veut dire

| Élément | Lecture |
|---|---|
| `12 of 15 checked in` | La compliance. Premier chiffre, parce que tout le reste en dépend. |
| Barre de répartition | Pour chaque axe : la proportion de l'effectif en dessous / dans / au-dessus de ses habitudes. |
| Pastille de couleur | 🔵 en dessous de sa baseline · 🟢 dans ses habitudes · 🟡 au-dessus |
| Le nombre (`+14`, `−8`) | L'écart, **en points**, entre la valeur du jour et la moyenne mobile de l'athlète sur 28 jours. |
| La flèche | Où va sa tendance de fond sur 7 jours. ↗ elle monte · → elle est stable · ↘ elle descend. |
| Le libellé sous le nom | Un **motif** détecté entre les trois marqueurs. Une description, jamais une consigne. |
| Ligne grisée | Pas encore de check-in. |

**La zone est relative à l'athlète, jamais au groupe.** Un joueur dont la baseline est à 40 et qui déclare 52 est en jaune. Un autre à 78 qui déclare 80 est en vert. Le même chiffre brut n'a pas le même sens d'un joueur à l'autre — c'est le cœur de la méthode.

## 3. Les trois motifs, et ce que Morin en dit

Ce sont les trois configurations décrites au §8 de la partie 3. L'écran les nomme ; **il n'en tire aucune conclusion**, parce que c'est le rôle de l'entraîneur.

**Converging** — les trois marqueurs partent dans le même sens.
> « Cette convergence renforce la fiabilité de l'interprétation et légitime un ajustement clair. »

Quand tout bouge ensemble, le signal est solide. C'est le cas où le coach peut agir sans hésiter — dans le sens que son cycle commande.

**Technical only** — la technique monte, le physique reste dans ses habitudes.
> « Ce découplage invite à agir non pas sur la durée, mais sur la complexité du contenu, la densité décisionnelle ou la médiation pédagogique. »

Le corps encaisse, la tête travaille. Ce n'est pas un problème de charge : c'est une question de densité de décision dans la séance. Raccourcir l'entraînement ne changerait rien.

**Mental only** — le mental monte alors que physique et technique sont stables.
> « Traduit une dépense perçue élevée qui ne vient pas directement de l'entraînement mais du contexte (vie personnelle, sommeil, stress, relationnel). Ici, l'intervention pertinente est extra-sportive […] et non une simple modulation de la charge physique ou technique. »

C'est le motif le plus précieux, et le seul qu'aucun GPS ne verra jamais. En NCAA, la charge académique est souvent la réponse — et c'est exactement pour ça qu'elle est mesurée dans le check-in du soir. Un joueur en « Mental only » en semaine de finals ne demande pas moins d'entraînement : il demande une conversation.

## 4. Le geste quotidien du coach — 90 secondes

1. **La compliance.** Sous 70 %, tout le reste devient fragile : relancer avant d'analyser.
2. **Les trois barres.** Une équipe majoritairement verte est une équipe qui absorbe sa charge. Une bascule vers le jaune sur un axe précis raconte la semaine.
3. **Les lignes du haut.** Elles sont triées par nombre de marqueurs hors zone. Ce n'est pas un classement de gravité — c'est un ordre de lecture.
4. **Le motif, s'il y en a un.** Il oriente la nature de l'ajustement : intensité, complexité, ou hors-terrain.
5. **Ouvrir la fiche d'un joueur** quand quelque chose accroche, et **lui parler**. Morin : *« seul l'entraîneur peut interpréter »*.

## 5. Les quatre erreurs de lecture, listées par Morin

Elles méritent d'être dites explicitement à un coach, parce qu'elles sont toutes intuitives.

- **Prendre la tendance pour une vérité immédiate.** La moyenne mobile est une mémoire, pas un diagnostic du jour.
- **Lire une valeur brute sans la croiser avec la tendance.** 78 ne veut rien dire. 78 quand on est habituellement à 60, si.
- **Croire que le tableau suffit pour décider.** Il ouvre une conversation ; il ne la remplace pas.
- **Sur-interpréter une variation isolée.** Morin insiste sur la **récurrence** : un jour atypique est du bruit, trois jours de suite sont un signal. Le critère décisif est toujours temporel.

Un cinquième piège, propre à notre écran : **le bleu n'est pas une bonne nouvelle par défaut.** Il peut signaler une récupération réussie, une meilleure économie de mouvement — ou un désengagement, une fatigue qui ne s'exprime plus. Morin appelle ça la *récurrence silencieuse* : un joueur durablement en bleu sans rien dire mérite autant d'attention qu'un joueur en jaune.

## 6. Le script — expliquer l'écran à un coach en trois minutes

À dire tel quel, dans cet ordre. Il est construit pour désamorcer l'objection avant qu'elle arrive.

> « Vos joueurs répondent à quelques curseurs après chaque séance. Pas "comment tu vas" — **ce que la séance leur a coûté**, sur trois plans : physique, technique, mental.
>
> Ce que vous voyez ici, ce n'est pas une note. C'est un **écart**. Chaque joueur est comparé à lui-même, à sa propre moyenne sur les 28 derniers jours. Si Jordan est habituellement à 40 et qu'il déclare 52, il est en jaune. Si Marcus est à 78 et déclare 80, il est en vert. Le même chiffre ne veut pas dire la même chose selon le joueur — donc on ne les compare jamais entre eux.
>
> Trois colonnes, jamais un score global. Parce qu'un joueur peut être physiquement dans ses habitudes et mentalement à bout, et cette information-là disparaît dans une moyenne.
>
> La couleur vous dit où il est. La flèche vous dit où il va. **Les deux ensemble, jamais l'une sans l'autre.** Un jaune qui redescend et un jaune qui monte depuis une semaine, ce n'est pas la même conversation.
>
> Et quand les trois colonnes racontent la même histoire, on vous le signale. Quand seule la colonne mentale monte alors que le corps va bien, on vous le signale aussi — parce que là, la cause est en général en dehors du terrain. Souvent les examens.
>
> Ce que l'outil ne fait pas : il ne vous dit pas quoi faire. Il ne décide pas qui joue, ni qui se repose. Il vous montre ce que vous ne pouvez pas voir depuis le bord du terrain, et c'est vous qui décidez. »

**Trois choses à ne jamais dire** : « l'IA détecte les blessures », « le système recommande du repos », « vos joueurs sont notés ». Chacune est fausse, et chacune vous vaudra une question du staff médical ou du service juridique à laquelle vous n'aurez pas de bonne réponse.

## 7. Les objections que tu vas recevoir

| Objection | Réponse |
|---|---|
| « Mes joueurs vont mentir. » | C'est un risque réel, et Morin le traite longuement. La réponse est structurelle : c'est confidentiel, ce n'est jamais utilisé pour la sélection, et l'athlète le sait. Un joueur qui craint que ses réponses coûtent du temps de jeu déclare 50 partout — et le système ne vaut plus rien. **Ça se dit devant l'équipe, une fois, clairement.** |
| « J'ai déjà des GPS / des capteurs. » | Ils mesurent ce que le corps fait. Ceci mesure ce que le joueur vit — la fatigue cognitive, la charge des examens, la tension du groupe. Aucun capteur ne les voit, et ce sont souvent elles qui expliquent la contre-performance. Les deux se croisent, ils ne se remplacent pas. |
| « C'est subjectif. » | Oui, et c'est le point. Le ressenti n'est pas une approximation d'une mesure objective : c'est une information que rien d'autre ne donne. On ne compare jamais deux joueurs entre eux, seulement chaque joueur à lui-même — ce qui rend la subjectivité exploitable. |
| « 60 secondes par jour, mes joueurs ne le feront pas. » | C'est la vraie question, et vous la verrez en direct : la compliance est le premier chiffre de l'écran. Si elle tombe, l'outil vous le dit avant que la donnée devienne inutilisable. |
| « Qu'est-ce que je fais du jaune ? » | Vous en parlez au joueur. L'outil n'a pas de réponse — et un outil qui prétendrait en avoir une serait à jeter. |

## 8. Ce qui n'est pas encore là

Honnêteté sur l'état réel, à ne pas survendre :

- **Aucune règle d'interprétation n'est active.** `rules.enabled` est faux partout, donc aucun flag n'est levé. L'écran affiche des états, pas des alertes.
- **La fiche joueur** montre l'historique, pas encore les trois séries avec leur bande ±10 côte à côte — c'est le prolongement naturel de cet écran.
- **Les quartiles** (DAR partie 3, §D) ne sont pas implémentés. Ils permettraient de détecter les dérives lentes qu'un seuil fixe manque.
- **Deux seuils coexistent** : ±10 points sur les axes (méthode DAR), ±15 % sur le score global (moteur historique). Arbitrage en attente — doc 15 §7.1.
- **Le Morning Brief affiche encore une moyenne d'équipe**, contraire au §1 de ce document. À aligner.
