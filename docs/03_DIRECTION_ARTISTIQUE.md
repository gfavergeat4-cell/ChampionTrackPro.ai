# 03 — DIRECTION ARTISTIQUE
**Système visuel ChampionTrackPro. Objectif : que le produit soit le plus bel outil qu'un coach NCAA ait jamais ouvert — niveau de finition des produits à 500 Md$ (Apple Fitness+, Whoop, Linear) — tout en restant lisible en 90 secondes à 6 h du matin dans un bureau de gymnase. Ressource d'exécution : skill `ui-ux-pro-max` (`APP/ui-ux-pro-max-skill-main` — 50+ styles, 161 palettes, 57 pairings typo, 99 guidelines UX, stack React Native/Tailwind).**

---

## 1. Concept directeur : « Stadium at night »

L'app est une salle de basket la nuit, juste avant que les projecteurs s'allument : fond bleu-noir profond, lumière cyan qui découpe l'information importante, matière sombre en couches (profondeur), zéro blanc pur. Le glow est déjà l'ADN de l'app actuelle (logo, boutons) — on le raffine au lieu de le renier : **le glow est réservé à ce qui demande une décision**. Tout le reste est mat et calme. C'est la règle n° 1 : la lumière = la hiérarchie.

## 2. Fondations (tokens — architecture 3 couches du skill design-system)

### Couleur (primitives → sémantiques)
| Token | Valeur | Rôle |
|---|---|---|
| `bg/void` | `#070B14` | Fond racine (plus profond que l'actuel) |
| `bg/court` | `#0A0F1E` | Fond écrans (existant, conservé) |
| `surface/1` | `#0E1528` | Cartes (existant) |
| `surface/2` | `#131C33` | Cartes surélevées, modales |
| `line/dim` | `rgba(0,212,255,0.14)` | Bordures (existant) |
| `accent/court-cyan` | `#00D4FF` | Action, focus, marque — JAMAIS décoratif |
| `accent/deep` | `#0066FF` | Dégradé d'action (avec cyan) |
| `state/green` | `#00C853` | Zone GREEN — adaptation normale |
| `state/blue` | `#2196F3` | Zone BLUE — sous la norme |
| `state/yellow` | `#FFB800` | Zone YELLOW — spike / vigilance |
| `state/red` | `#EF4444` | Réservé aux flags priorité 1 — rare = puissant |
| `text/hi` `#FFFFFF` · `text/mid` `#9CA3AF` · `text/low` `rgba(255,255,255,0.45)` | | 3 niveaux, jamais plus |

Règle : les 4 couleurs d'état sont sacrées (langage Morin) — aucun autre usage décoratif de vert/jaune/bleu/rouge nulle part.

### Typographie
- **Display / identité** : Marcellus — capitales romaines, luxe sportif gravé (révision du 8 juil. : Cinzel/Rajdhani retirées, jugées « geek/code vibe »).
- **Interface & données** : Inter (300/400/500/600, tracking −1 %) ; grands chiffres en **Light 300** + `tabular-nums` — la finesse comme signe de qualité ; labels en petites capitales espacées.
- Échelle : 34 (score héro) / 26 (titre écran) / 18 (section) / 15 (corps) / 12 (méta). Interlignage 1,5. Deux graisses max par écran.

### Espace, forme, profondeur
- Grille 4 pt. Padding cartes 16. Rayons : 12 (cartes), 8 (contrôles), 999 (pastilles).
- Profondeur par **couches + lueur**, pas par ombres portées grises : `shadow: 0 0 30px rgba(0,180,255,0.25)` uniquement sur l'élément d'action primaire de l'écran (un seul par écran).
- Verre (glassmorphism, avec parcimonie) : en-têtes collants et modales — `rgba(14,21,40,0.72)` + blur 20 — jamais sur les données.

## 3. La 3D — doctrine d'emploi
La 3D émerveille en marketing et ralentit en produit. Doctrine :
- **Landing / démo commerciale** : oui, plein feu — héro 3D (terrain wireframe cyan en rotation lente, particules de données convergeant vers le Morning Brief ; Three.js déjà dispo, ou Spline). C'est là que le "wow 500 Md$" se joue et que le coach est séduit.
- **Dans l'app** : 3D suggérée, pas rendue — dégradés radiaux profonds, layering, parallaxe légère au scroll, anneaux de readiness en pseudo-3D (SVG). Budget : 60 fps sur un téléphone d'étudiant à 200 $. Aucune scène 3D temps réel dans les écrans quotidiens.
- **Data-viz signature** (différenciant produit) : le "court map" — silhouette de demi-terrain où chaque joueur est un point lumineux coloré par sa zone. Un staff comprend l'équipe en 2 secondes. C'est NOTRE visuel propriétaire, à construire en SVG.

## 4. Motion design
- Micro-interactions 120-180 ms (ease-out) : press states scale 0.98 (déjà présent), apparition des cartes en cascade 40 ms.
- Le readiness "compte" de 0 à sa valeur à l'ouverture du brief (600 ms, une fois par jour) — le moment-café du coach.
- Les changements de zone pulsent UNE fois (jamais d'animation en boucle — c'est un outil de travail, pas un jeu).
- Transitions d'écran : fade+slide 8 px, 200 ms. Aucune animation > 700 ms nulle part.

## 5. Hiérarchie des écrans (ce que chaque persona voit en premier)
- **Coach — Morning Brief = l'écran héro du produit.** Ordre : titre équipe → compliance du jour → LE brief (carte lumineuse) → boutons Useful/Noise → roster trié par priorité de flag → Team setup en bas. Lisible en 90 s, décidable en 10.
- **Athlète — le check-in est l'écran héro.** Un slider à la fois si possible (V4), gros, pouce-friendly, ancres sémantiques sans chiffres (existant, bon), 45-60 s chrono, écran de merci qui montre SA tendance (rétribution immédiate = compliance).
- **Admin (Gabin)** : densité > beauté — tableaux, états, codes équipe, santé des crons.

## 6. Accessibilité et terrain
Contraste AA minimum sur fond sombre (cyan #00D4FF sur #0A0F1E passe ; vérifier chaque état). Cibles tactiles ≥ 44 pt. Mode plein soleil (parking, bus d'équipe) : test luminosité 50 %. Jamais d'information portée par la couleur seule (zone = pastille + libellé). Touche `prefers-reduced-motion` respectée.

## 7. Exécution
1. Formaliser les tokens ci-dessus dans `src/theme/tokens.ts` (fusionner avec l'existant, supprimer `src/constants/theme.ts` en doublon).
2. Passe de polish des 3 écrans migrés (CoachHomeSupabase, AthleteHomeSupabase, Questionnaire) avec le skill `ui-ux-pro-max` — app lancée, avec Gabin.
3. Landing page 3D (skill `banner-design` + `frontend-design` + Three.js) — asset commercial, après le pilote signé ou pour le closing des leads chauds.
4. Court map SVG — proto dans le PerformanceDashboard migré.

**Anti-goûts (interdits)** : white mode par défaut (identité = nuit), stock photos d'athlètes génériques, 6 couleurs par écran, skeuomorphisme boisé, confettis, dark patterns de gamification. La beauté ici = calme + profondeur + précision.
