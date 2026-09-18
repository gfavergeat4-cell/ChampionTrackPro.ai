# Mode showcase — plateau de capture

Écrans réels de l'app, données figées, animations rejouables. Sert à quatre choses :
capture vidéo publicitaire, partage d'écran en discovery call, extraits pour les
emails de relance, visuels de landing page.

## Lancer

```
npx expo start --web
```

puis ouvrir **`http://localhost:8081/?showcase=1`**

Accessible **uniquement en développement**. `__DEV__` valant `false` au build de
production, le bundler élimine le module : ces écrans ne sont pas atteignables
sur `champtrackpro.com`. C'est volontaire — ils affichent des données fictives.

## Raccourcis

| Touche | Effet |
|---|---|
| `1` `2` `3` | Choisir la scène |
| `Espace` ou `R` | Rejouer la prise |
| `D` | Morning Brief : bascule 9:16 ↔ 16:9 |
| `C` | **Mode propre** — masque toute l'interface de contrôle |
| `+` `−` | Échelle de rendu (mettre `2×` ou `3×` avant de capturer) |

**Avant d'enregistrer : passer en mode propre (`C`) et monter l'échelle à `2×`.**
L'écran ne contient alors plus que le cadre. Chaque scène boucle automatiquement,
donc l'enregistrement peut tourner sur plusieurs passes sans intervention.

## Les trois scènes

| # | Écran | Format | Durée | Légende prévue au montage |
|---|---|---|---|---|
| 1 | Check-in athlète | 9:16 | ~9 s | *Vos athlètes vous transmettent comment ils ont vécu chaque effort.* |
| 2 | Morning Brief | 9:16 + 16:9 | ~6 s | *Sachez exactement la forme de vos athlètes chaque matin, en un seul écran.* |
| 3 | Détail joueur / baseline | 9:16 | ~7 s | *Chaque indicateur est lu contre sa propre baseline — pas une moyenne, sa norme à lui.* |

Scène 1 enchaîne les trois états demandés : repos → réponse en cours (les curseurs
glissent un par un) → validation. Le curseur est le **vrai** `LogoSlider` de
production, pas une imitation.

Scène 3 ouvre M. Johnson, le seul `RECOVER`. Son intérêt : son physique décroche de
31 points quand son mental n'en perd que 12. C'est précisément ce qu'une moyenne
d'équipe écrase et qu'une baseline individuelle fait ressortir.

## Libellés de statut

`READY` / `WATCH` / `RECOVER` — décision fondateur du 28/08/2026, en remplacement
de `PUSH` / `MONITOR` / `PROTECT` utilisés dans les one-pagers. Ces derniers sont
des **ordres adressés au coach** ; ils contredisent l'article 4 de
`CONSTITUTION.md` et exposent juridiquement. Les nouveaux décrivent **l'état de
l'athlète**, le coach en tire l'action.

Seuils, alignés sur la méthode DAR déjà implémentée en base (`v_axis_zones`,
migration 014) :

| Statut | Écart à sa baseline |
|---|---|
| `READY` | ≥ −10 — dans sa bande habituelle, ou au-dessus |
| `WATCH` | entre −20 et −10 — sorti de sa bande par le bas |
| `RECOVER` | ≤ −20 — nettement sous sa bande |

Les libellés sont centralisés dans `showcaseTheme.ts` → `STATUS`. Un seul endroit
à changer.

## Palette

Ce module utilise la palette du **matériel de vente** (`#070C18`, `#00D4FF`,
`#00FF9D`, Bebas Neue + DM Sans), relevée dans les one-pagers envoyés à Thune,
Rozier, Shelton et Stark — pas les tokens Courtlight de l'app. Un coach qui a reçu
le PDF puis voit la vidéo doit reconnaître le même produit.

**Cet écart entre l'app et le matériel de vente n'est pas résolu**, il est
seulement contourné ici. Voir `HANDOFF/PROJECT_SOURCE_OF_TRUTH.md`, section
contradictions ouvertes.

## Vérifier avant de capturer

```
npx esbuild src/showcase/verifyShowcase.ts --bundle --platform=node --format=cjs --outfile=tmp_verify.js
node tmp_verify.js
```

21 assertions : les badges correspondent aux écarts affichés, la courbe reste dans
le cadre, le pourcentage d'équipe est juste. À relancer après toute modification de
`showcaseData.ts` — une incohérence dans une vidéo publique ne se rattrape pas.

## Fichiers

| Fichier | Rôle |
|---|---|
| `showcaseTheme.ts` | Palette vente, statuts, seuils, chargement des polices |
| `showcaseData.ts` | Roster figé, série 21 jours, questions |
| `useTimeline.ts` | Horloge d'animation — scènes = fonctions pures du temps |
| `Scene1Questionnaire.tsx` | Check-in athlète |
| `Scene2MorningBrief.tsx` | Morning Brief, mobile et desktop |
| `Scene3Baseline.tsx` | Détail joueur vs baseline |
| `ShowcaseScreen.tsx` | Cadre, barre d'état factice, contrôles |
| `verifyShowcase.ts` | Contrôle de cohérence |

Aucun de ces fichiers n'est importé par un écran de production. Le seul point de
contact est le court-circuit `__DEV__` dans `App.js`.
