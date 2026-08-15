# 10 — SYSTÈME VISUEL (état réel, relevé le 15 août 2026)

**Nature de ce document.** Ce n'est pas une direction artistique nouvelle. C'est l'inventaire de ce qui existe déjà — logos, tokens, composants, couleurs réellement écrites dans le code — plus la liste des endroits où le code ne suit pas le système. Aucune couleur, aucune typographie, aucun concept n'a été inventé ici.

**Hiérarchie des sources.** `docs/06_REDESIGN_COURTLIGHT.md` fait autorité sur `docs/03_DIRECTION_ARTISTIQUE.md` (le doc 06 se déclare lui-même « évolution » du 03). Le présent document ne fait autorité sur rien : il décrit et signale.

**Méthode.** Couleurs des PNG relevées pixel par pixel (Pillow). Couleurs du code relevées par `grep -roE "#[0-9a-fA-F]{3,8}"` sur `src/`, `screens/`, `navigation/`, `App.js`. Les numéros de ligne correspondent aux fichiers au 15 août 2026.

---

## 1. Le logo

### 1.1 Les quatre fichiers de `VISUEL/logos officiels/`

| Fichier | Dimensions | Mode | Fond | Contenu |
|---|---|---|---|---|
| `8ea1daef-3a80-4285-919c-0414b6b59764.png` | 2172 × 724 | RGBA | **transparent** | Lockup complet : wordmark + baseline + emblème |
| `8fc2e2d3-0b39-46b8-8a9e-30737fe84a74.png` | 2172 × 724 | RGB | **noir opaque `#000000`** | Même composition, aplatie sur noir |
| `logo_test.png` | 2000 × 2000 | RGB | **bleu-noir opaque `#060C22`** | Emblème seul (pas de texte) |
| `logo-191-v2.png` | 500 × 500 | RGBA | **transparent** | Emblème seul |

`logo_test.png` est **binairement identique** à `VISUEL/logo_test.png` et à `VISUEL/mark.png` (md5 `f824fb714c…`). Trois noms, un seul fichier.

### 1.2 Description du lockup (fichiers A et B)

Trois blocs empilés, centrés. Mesures relevées sur le fichier A (2172 × 724, alpha > 40) :

| Bloc | Bande verticale (y) | Étendue horizontale (x) | Hauteur | Largeur |
|---|---|---|---|---|
| Wordmark `ChampionTrackPro` | 190 → 336 | 161 → 2015 | 147 px | 1855 px |
| Baseline `THE TRAINING INTELLIGENCE` | 373 → 416 | 523 → 1642 | 44 px | 1120 px |
| Emblème (pilule + orbe) | 440 → 609 | 884 → 1287 | 170 px | 404 px |

Interlignes : 37 px entre wordmark et baseline, 24 px entre baseline et emblème. Les trois blocs sont centrés sur x ≈ 1088, 1082, 1085 — centrage optique cohérent à ± 6 px.

**Wordmark.** Serif à empattements fins, style romain classique, en petites capitales : la première lettre de chaque mot en capitale pleine (`C`, `T`, `P`), le reste en petites capitales (`HAMPION`, `RACK`, `RO`). Rendu 3D léger : biseau + lueur externe blanche. `ChampionTrack` en blanc, `Pro` en cyan. La graisse apparente est un semi-bold. La police source n'est pas identifiable avec certitude depuis un raster ; les vectorisations existantes proposent la pile `Cinzel, Marcellus, 'Times New Roman', serif` (voir §1.4).

**Baseline.** Sans-serif géométrique, capitales, interlettrage très large (≈ 0,35 em à vue), blanc pur.

**Emblème.** Une pilule horizontale (rectangle à bouts arrondis, rayon = demi-hauteur) traversée en son centre par une sphère lumineuse en verre, plus grande que la pilule. C'est visuellement le pouce d'un slider posé sur son rail — cohérent avec le geste central du produit (le slider du check-in athlète, doc 06 §5).

Géométrie relevée sur `logo-191-v2.png` (500 × 500, bbox alpha `93,191 → 407,309`) :
- Emblème total : 314 × 118 px → ratio **2,66 : 1**
- Pilule : hauteur 64 px (y 218 → 281), largeur totale 314 px
- Orbe : diamètre 116 px (y 192 → 307) → **1,81 × la hauteur de la pilule**
- L'orbe est centré horizontalement (x ≈ 250 sur 500)

### 1.3 Couleurs relevées, en hexadécimal

**Wordmark — partie blanche.** Fichier A : `#FDFDFD` / `#FEFEFE` / `#FCFCFC` / `#FFFFFF` (dégradé de biseau, aucun aplat). Fichier B : mêmes valeurs, `#FFFFFF` dominant.

**Wordmark — « Pro ».** Divergence nette entre les deux fichiers :
- Fichier A (transparent) : cyan très clair et saturé, mode `#11F0FE` — `#13F3FE` (R ≈ 17, G ≈ 240, B ≈ 254)
- Fichier B (fond noir) : cyan nettement plus bleu, mode `#00BFFC` — `#00C8FA` (R = 0, G ≈ 191, B ≈ 252)

Le fichier A a subi un détourage qui a éclairci et désaturé vers le blanc les pixels du « Pro ». **Le fichier B porte la couleur juste.** Valeur de référence retenue pour le « Pro » : **`#00C2FD`** (moyenne des modes relevés sur B) — remarquer sa proximité avec le token existant `accentCyan #00C2FF` de `src/theme/tokens.ts:16`.

**Baseline.** `#FFFFFF` pur dans les deux fichiers.

**Emblème — dégradé de la pilule** (relevé sur `logo-191-v2.png`, ligne y = 250, de gauche à droite) :

| Position x | Valeur |
|---|---|
| 110 | `#86ECEE` |
| 150 | `#62D4EE` |
| 190 | `#51BFE2` |
| 250 (orbe) | `#FFFFFD` |
| 290 | `#4AA9ED` |
| 330 | `#1466C9` |
| 370 | `#2E53D7` |
| 390 | `#3552EB` |

Extrémités : gauche `#82E9EE`, droite `#334EE3`. Le dégradé va donc d'un **cyan-turquoise clair** à un **bleu-indigo saturé**, de gauche à droite.

**Emblème — orbe.** Cœur blanc pur (`#FFFFFD` / `#FDFFFD` au centre), halo `#B8FFFF` → `#94FAFC`, bord `#4FB4F2` environ.

Ces valeurs correspondent, à quelques points près, aux stops déjà écrits dans `VISUEL/logo_ctp_embleme.svg` — voir §1.4. **Aucune couleur nouvelle n'est nécessaire.**

### 1.4 Les vectorisations existantes

**`VISUEL/logo_ctp_embleme.svg`** (viewBox 0 0 640 400) — emblème seul, la plus fidèle des deux.
- Dégradé `#pill` : `#8CEFE0` (0 %) → `#4FC9F2` (35 %) → `#3D8BF7` (72 %) → `#2E5BF6` (100 %)
- Orbe `#orb` : `#FFFFFF` → `#DFF6FF` (28 %) → `#8ED9FF` (55 %) → `#4FB4F2` (85 %) → `#3E9BE8` (100 %)
- Cœur `#core` : `#FFFFFF` → `#EAF9FF` (50 %, α 0,9) → `#BDEBFF` (100 %, α 0)
- Halos : pilule `#pill` α 0,65 flouté 18 ; disque `#57C8FF` α 0,55 ; ellipse `#1E4BFF` α 0,45
- Géométrie : pilule 448 × 96, rx 48 ; orbe r = 78 → ratio orbe/pilule = **1,625**

Écart mesuré avec le PNG : le SVG donne un ratio orbe/pilule de 1,625, le PNG de 1,81. Le SVG a un orbe légèrement plus petit. Écart réel mais faible.

**`VISUEL/logo_ctp_lockup.svg`** (viewBox 0 0 1200 560) — lockup complet, **moins fidèle**.
- Wordmark : `font-family="Cinzel, Marcellus, 'Times New Roman', serif"`, poids 600, taille 108, letter-spacing 2 ; `ChampionTrack` en `#F4F7FB`, `Pro` en dégradé `#7FD8FF` → `#2E7BF6`
- Baseline : `Inter`, poids 400, taille 34, letter-spacing 14, couleur **`#C9D2DE`** (or le PNG donne du blanc pur)
- Emblème simplifié : dégradé à 3 stops seulement, orbe sans arc de reflet

Ce lockup SVG est une reconstruction approximative, pas une vectorisation du logo. Trois écarts explicites avec les PNG : la baseline est grise et non blanche, le « Pro » est un dégradé et non un aplat, et la police `Cinzel` a été **retirée par décision du fondateur le 8 juillet** (doc 03 §2, doc 06 §3) — elle ne devrait plus figurer dans un asset de marque.

### 1.5 `VISUEL/THE TRAINING INTELLIGENCE.png`

2000 × 2000, RGB, fond noir opaque `#000000` à 96,6 % de la surface. Contient le lockup complet (wordmark + baseline + emblème), centré, occupant environ le tiers médian de l'image. Ce n'est pas un fichier « baseline seule » : c'est le lockup entier sur un carré noir, avec beaucoup d'espace perdu. Utilisable tel quel uniquement en vignette carrée sur fond noir.

### 1.6 Fichier de référence recommandé

**`8fc2e2d3-…png` (fichier B) fait référence pour la couleur.** Raison : c'est le seul rendu non détouré ; les couleurs y sont celles du fichier d'origine. Le fichier A a des pixels de « Pro » lavés par le détourage (`#11F0FE` au lieu de `#00C2FD`) et des blancs à 253/255 au lieu de 255.

**`8ea1daef-…png` (fichier A) fait référence pour la forme et le placement.** Raison : c'est le seul lockup à fond transparent, donc le seul utilisable en superposition. Ses mesures (§1.2) sont celles à respecter.

**Recommandation :** régénérer un fichier A' — le fichier A avec les couleurs du fichier B (« Pro » à `#00C2FD`). Tant que ce fichier n'existe pas, le fichier A reste l'asset de production et l'écart de teinte du « Pro » est un défaut connu et toléré.

**`logo-191-v2.png` fait référence pour l'emblème seul** (transparent, 500 × 500, propre).

**`logo_test.png` est défectueux et ne doit pas être utilisé.** Il contient un **carré noir pur `#000000` de 180 × 155 px** dans le coin inférieur droit (bbox approximative x 1800-1980, y 1800-1955), sur un fond qui est ailleurs `#060C22`. C'est un artefact de génération. Ce défaut s'est propagé : voir §1.8.

### 1.7 Emploi par contexte

| Contexte | Asset | Justification |
|---|---|---|
| Favicon, icône PWA, icône d'app | Emblème seul (`logo-191-v2.png`) | Le wordmark est illisible sous 64 px |
| En-tête d'app (web) | Lockup transparent, largeur 300 px | C'est ce que fait déjà `ChampionTrackProLogo.tsx:12` |
| En-tête d'app (natif) | Lockup transparent, 280 × 80 | `ChampionTrackProLogo.tsx:19` |
| Splash / écran de chargement | Wordmark texte, pas d'image | `SplashScreen.tsx:28-30` — voir §1.9 |
| Document commercial, fond sombre | Fichier A (transparent) | Se pose sur n'importe quel fond sombre |
| Document commercial, fond clair | **Aucun asset existant** | Le wordmark est blanc : illisible sur clair. À produire si le besoin apparaît. |
| Vignette carrée fond noir | `THE TRAINING INTELLIGENCE.png` | Déjà cadré ainsi |

**Tailles minimales** (déduites des proportions relevées, non testées à l'impression) :
- Lockup complet : la baseline mesure 44 px pour 724 px de hauteur totale, soit 6 % ; sous **240 px de large**, la baseline devient une ligne grise illisible. Sous cette taille, utiliser le lockup sans baseline ou l'emblème seul.
- Emblème seul : ratio 2,66 : 1 ; l'arc de reflet de l'orbe disparaît sous **48 px de large**. Utilisable jusqu'à 24 px, mais l'orbe devient un point blanc.

**Zone de respiration.** Non définie dans les fichiers sources. Règle proposée à partir des mesures existantes : marge égale à la hauteur de l'emblème (170 px sur le fichier A, soit 23 % de la hauteur du lockup) sur les quatre côtés. **Cette règle est déduite, pas relevée** — à valider ou remplacer par le fondateur.

### 1.8 Assets logo dans l'application

| Chemin | Dimensions | Fond | État |
|---|---|---|---|
| `public/logo/logo_bon.png` | 701 × 356 | transparent | Lockup complet. Servi en web par `ChampionTrackProLogo.tsx:11` |
| `public/logo/logo_nobackground.png` | 492 × 250 | transparent | Lockup complet. Servi en natif par `ChampionTrackProLogo.tsx:4` |
| `public/logo/logo_clean.png` | 492 × 250 | transparent | **Doublon binaire exact** de `logo_nobackground.png` (md5 `8b31c5295a`). Non référencé dans le code. |
| `public/icons/icon-512-v2.png` | 512 × 512 | `#050C1F` | Emblème. **Porte le carré noir de `logo_test.png`** : bbox 461,461 → 506,500 |
| `public/icons/icon-512.png` | 512 × 512 | — | Doublon binaire exact de `icon-512-v2.png` (md5 `fecd79b0c0`) |
| `public/icons/icon-192-v2.png` | 192 × 192 | `#040B1E` | Emblème. **Même carré noir** : bbox 173,173 → 189,187 |
| `public/icons/icon-192.png` | 192 × 192 | — | Doublon binaire exact de `icon-192-v2.png` (md5 `4c300b4ba2`) |
| `assets/favicon.png` | 48 × 48 | transparent | **Icône Expo par défaut** (cube gris). Pas la marque. |
| `assets/icon.png` | 1024 × 1024 | `#F5F5F7` | **Icône Expo par défaut** (cercles gris sur grille). Pas la marque. |
| `assets/adaptive-icon.png` | 1024 × 1024 | transparent | **Icône Expo par défaut.** Pas la marque. |
| `assets/splash-icon.png` | 1024 × 1024 | transparent | **Doublon binaire de `adaptive-icon.png`** (md5 `97dae5a0e6`), donc l'icône Expo par défaut. Pas la marque. |
| `assets/logo.svg` | 400 × 120 | transparent | Wordmark en `font-family="Cinzel, serif"` — **police retirée le 8 juillet.** Non référencé dans le code. |

Le carré noir de `logo_test.png` est visible dans l'icône PWA installée sur l'écran d'accueil d'un coach. `app.json:26` et `app.config.js:13` pointent tous deux `favicon: "./assets/favicon.png"`, c'est-à-dire le cube Expo.

### 1.9 Divergence de traitement du wordmark

Le logo officiel met **`Pro` en cyan**, `ChampionTrack` en blanc.

Le code fait l'inverse : `src/components/SplashScreen.tsx:29` rend `CHAMPION<Text style={s.brandCyan}>TRACK</Text>PRO`, c'est-à-dire **`TRACK` en cyan**. Idem dans `docs/prototype_courtlight.html:99` (`CHAMPION<b>TRACK</b>PRO`, avec `.brand b{color:var(--cyan)}` ligne 21).

C'est une contradiction directe entre le logo de marque et la typographie de marque en produit. Elle doit être tranchée par le fondateur, pas ici.

---

## 2. La palette réelle

### 2.1 Les quatre sources de tokens coexistantes

| Export | Fichier | Consommateurs |
|---|---|---|
| `courtlight` | `src/theme/tokens.ts:195-249` | **13 fichiers** (composants + écrans Supabase + admin) |
| `tokens` (v1) | `src/theme/tokens.ts:1-151` | 3 fichiers : `stitch_components/AthleteHomeNew.tsx:7`, `stitch_components/ScheduleScreenNew.tsx`, `utils/responsive.ts` |
| `da` (v2) | `src/theme/tokens.ts:157-188` | **Aucun. Export mort.** `grep "\bda\."` ne retourne rien hors du fichier de définition. |
| `theme` | `src/constants/theme.ts` | 1 fichier : `src/screens/CoachHomeScreen.tsx` (écran débranché quand `USE_SUPABASE=1`) |

Le doc 03 §7.1 demandait déjà « supprimer `src/constants/theme.ts` en doublon ». Ce n'est pas fait.

### 2.2 Table unique — rôle sémantique → valeur → usage

Les lignes marquées **ÉCART** sont des hex en dur qui ne correspondent à aucun token.

#### Fonds

| Rôle | Valeur | Token | Occurrences | Où |
|---|---|---|---|---|
| Fond racine (Court) | `#070B14` | `courtlight.bg.court` | 17 | `StitchNavigator.js:731`, `App.js:56`, `AdminSystemHealthScreen.tsx:103,120`, `ScheduleScreenSupabase.tsx:505,532,655,713,745,755`, `OnboardingNotifScreen.tsx:125` |
| Stop de vignette | `#0D2545` | `courtlight.bg.vignette` | 6 | `AdminSystemHealthScreen.tsx:120`, `OnboardingNotifScreen.tsx:125`, `StitchQuestionnaireScreen.js` |
| Fond écran ancien | `#0A0F1E` | `da.bg.court` / `theme.bgPrimary` | **33** | **ÉCART** — `CoachTeamScreen.tsx:116,134,135`, `CoachScheduleScreen.tsx:11,475,589,674`, `AthleteDetailScreen.tsx:22,264`, `CoachHomeScreen.tsx:179,190,191`, `CoachProfileScreen.tsx:146,158,159,256`, `CreateTeamModal.tsx:51,175,275,423` |
| Fond écran Stitch | `#0A0F1A` | aucun | **20** | **ÉCART** — `AthleteHomeNew.tsx:791,1167`, `ScheduleScreenNew.tsx:805,820,958,1276,1512,1542,1663` |
| Stop de vignette ancien | `#0D1F3C` | aucun | 8 | **ÉCART** — `CoachTeamScreen.tsx:134`, `AthleteDetailScreen.tsx:264`, `CoachHomeScreen.tsx:190`, `CoachProfileScreen.tsx:158`, `CreateTeamModal.tsx:175,275` |
| Autres fonds de gradient Stitch | `#0F1623`, `#1A1F2E`, `#0D1117`, `#090F1F`, `#050910`, `#000000` | aucun | 3+3+3+1+1 | **ÉCART** — `AthleteHomeNew.tsx:809,1167`, `ScheduleScreenNew.tsx:820,1663` |

#### Surfaces

| Rôle | Valeur | Token | Occurrences | Où |
|---|---|---|---|---|
| Carte graphite | `rgba(17,26,45,0.92)` | `courtlight.surface.card` | — | `CardGraphite.tsx:46`, `CoachHomeSupabase.tsx:448`, écrans admin |
| Verre de focus | `rgba(19,28,51,0.66)` | `courtlight.surface.glass` | — | `GlassCard.tsx:96` |
| Carte opaque ancienne | `#0D1526` | `theme.bgCard` | **23** | **ÉCART** — `CoachTeamScreen.tsx:184`, `CoachScheduleScreen.tsx:13`, `AthleteDetailScreen.tsx:23`, `CoachProfileScreen.tsx:205,304,334,350`, `StitchQuestionnaireScreen.js` |
| Carte `surface/1` | `#0E1528` | `da.surface.s1` | 11 | **ÉCART** (`da` est mort) — `AthleteHomeNew.tsx:809`, `AthleteDetailScreen.tsx:254`, `app.json:12,18` |
| Carte `surface/2` | `#131C33` | `da.surface.s2` | 1 | **ÉCART** — usage résiduel |

#### Accent

| Rôle | Valeur | Token | Occurrences | Où |
|---|---|---|---|---|
| **Accent action/focus** | `#00D4FF` | `courtlight.accent.cyan` | **89** | La couleur la plus utilisée du projet. Partout. |
| Bleu profond (dégradé) | `#0066FF` | `courtlight.accent.deep` | 23 | `CoachHomeSupabase.tsx:529`, `ProfileScreenSupabase.tsx:606`, `AthleteDetailScreen.tsx:469` |
| Cyan Stitch | `#00EAFF` | aucun | **15** | **ÉCART** — `ScheduleScreenNew.tsx:879,881,1154,1173,1193,1232,1234,1246,1247,1512,1525` |
| Cyan bouton | `#00BFFF` | `theme.gradients.buttonPrimary` | 11 | **ÉCART** — `AdminHomeScreen.tsx:160,187`, `CoachProfileScreen.tsx:417`, `CreateTeamModal.tsx:252,450`, `OnboardingNotifScreen.tsx:168` |
| Cyan ombre | `#00C6FF` | aucun | 14 | **ÉCART** — `AthleteHomeNew.tsx:1557` |
| Cyan v1 | `#00C2FF` | `tokens.colors.accentCyan` | 7 | Correspond à la couleur du « Pro » du logo (§1.3) |
| Cyan vif bouton | `#00F5FF` | aucun | 3 | **ÉCART** — `StatusPill.tsx:135,363,548` |
| Autres cyans | `#00A8FF`, `#29C9FF`, `#2BC9FF`, `#00A8E6`, `#0077CC`, `#0055FF`, `#0044FF` | aucun | 2+2+1+1+1+1+2 | **ÉCART** — dispersés |
| Cyans clairs (texte/icône) | `#8DEBFF`, `#DFF8FF`, `#E3FBFF`, `#E8FBFF`, `#9FE9FF`, `#F7FBFF` | aucun | 7+2+2+1+1+4 | **ÉCART** — `StatusPill.tsx:61,63,97,98`, `AthleteHomeNew.tsx:1879,1884` |

**Il y a 15 cyans différents dans le code.** Un seul est tokenisé.

#### Couleurs d'état (« sacrées », doc 03 §2)

| Rôle | Valeur | Token | Occurrences | Où |
|---|---|---|---|---|
| Zone GREEN | `#00C853` | `courtlight.zone.GREEN` | 5 | `ReadinessHalo.tsx:21`, `CoachHomeSupabase.tsx:419`, `PerformanceDashboard.tsx:894,975` |
| Zone BLUE | `#2196F3` | `courtlight.zone.BLUE` | 3 | `ReadinessHalo.tsx:22` |
| Zone YELLOW | `#FFB800` | `courtlight.zone.YELLOW` | **21** | Bien diffusé. `CoachTeamScreen.tsx:126,127`, `AthleteDetailScreen.tsx:251,519,531`, `PerformanceDashboard.tsx:97` |
| Rouge flag P1 | `#EF4444` | `da.state.red` | 13 | **ÉCART formel** (le rouge n'est pas dans `courtlight`) — `AdminSystemHealthScreen.tsx:16`, `ProfileScreenSupabase.tsx:399,401`, `CoachHomeScreen.tsx:277,279` |

**Vert : cinq valeurs concurrentes pour le même sens.**

| Valeur | Occurrences | Où |
|---|---|---|
| `#00C853` (token) | 5 | ci-dessus |
| `#00FF9D` | **25** | **ÉCART** — `AdminSystemHealthScreen.tsx:14`, `ProfileScreenSupabase.tsx:370`, `AdminTeamDetailScreen.tsx:281,318,327,501,516,520`, `AdminTeamScreen.tsx:221,381,386,477,479`, `CreateTeamModal.tsx:220,412,524,526`, `PerformanceDashboard.tsx:96,111` |
| `#00FF88` | 8 | **ÉCART** — `CoachTeamScreen.tsx:125`, `AthleteDetailScreen.tsx:251,519`, `CoachProfileScreen.tsx:376`, `PerformanceDashboard.tsx:960,1549,1564` |
| `#00FFC2` / `#00FFC8` / `#00C16A` | 8+7+3 | **ÉCART** — `StatusPill.tsx:255,363,392,409,573,577,631,1671,1680` |
| `#22C55E` / `#16A34A` / `#4ADE80` / `#10B981` / `#96CEB4` | 2+1+1+1+2 | **ÉCART** — `tokens.ts` v1, `CoachScheduleScreen.tsx:179` |

**Rouge : dix valeurs concurrentes.** `#EF4444` (13), `#FCA5A5` (12), `#FF3B30` (7), `#FF003C` (5), `#FF6B6B` (4), `#FF4444` (4), `#F98A8A` (4), `#F87171` (2), `#FF7A93` (2), `#FF4B4B` (2), `#FF4D4D` (1), `#DC2626` (1), `#7F1D1D` (1), `#FF1D7C` (1). Le doc 03 §2 dit « le rouge reste réservé aux flags priorité 1 — rare = puissant » : 14 nuances de rouge contredisent ce principe.

**Orange : hors palette entièrement.** `#FB7100` (3), `#FF8C42` (2), `#FF9F43` (1), `#FFB347` (2). Utilisé pour l'état « friction » — `CoachTeamScreen.tsx:128`, `CoachHomeScreen.tsx:278`, `CoachScheduleScreen.tsx:15`, `PerformanceDashboard.tsx:99`, `CourtScene.tsx:81` (le panier du terrain 3D).

**Violet : hors palette entièrement.** `#6A5CFF` (4, token v1), `#A855F7` (3), `#7B61FF` (2), `#4A67FF` (10), `#4B73FF` (2), `#BFC7FF` (2). `#4A67FF` est notable : 10 usages dans `StatusPill.tsx` et les écrans coach, pour l'état « in progress » et des bordures de gradient.

#### Texte

| Rôle | Valeur | Token | Occurrences |
|---|---|---|---|
| Texte haut | `#FFFFFF` | `courtlight.text.hi` | **74** (+ 63 `#FFF` + 8 `#fff` minuscules) |
| Texte médian | `#9CA3AF` | `courtlight.text.mid` | 36 |
| **Texte médian concurrent** | `#9AA3B2` | aucun | **35** | **ÉCART** — `AthleteHomeNew.tsx:924,1143,1907`, `ScheduleScreenNew.tsx:930,1048,1103,1343,1404,1588,1630`, `CoachScheduleScreen.tsx:475` |
| Texte bas | `rgba(255,255,255,0.45)` | `courtlight.text.low` | — |
| Gris divers | `#E5E7EB` (11), `#374151` (8), `#6B7280` (5), `#D1D5DB` (2), `#1F2937` (4), `#A8B3C5` (1), `#7E90AB` (3) | aucun | **ÉCART** — palette Tailwind résiduelle |
| Texte sur bouton primaire | `#04121F` | aucun | 6 | **ÉCART cohérent** — répété à l'identique dans `CoachHomeSupabase.tsx:533`, `AthleteHomeSupabase.tsx:260`, `ProfileScreenSupabase.tsx:610`, `ScheduleScreenSupabase.tsx:812`, `StitchQuestionnaireScreen.js`. C'est un token de fait, non déclaré. |

`#FFFFFF` en 74 exemplaires + `#FFF` en 63 + `#fff` : trois écritures pour la même valeur. Cosmétique, mais rend tout `grep` de couleur incomplet.

### 2.3 Synthèse chiffrée

- **114 valeurs hexadécimales distinctes** dans `src/` + `screens/` + `navigation/` + `App.js`
- Tokens `courtlight` couverts : ~12 valeurs
- Donc **environ 100 hex en dur** sans équivalent tokenisé
- Fichiers les plus chargés : `screens/StitchQuestionnaireScreen.js` (66), `src/stitch_components/ScheduleScreenNew.tsx` (62), `src/components/StatusPill.tsx` (45), `screens/StitchProfileScreen.js` (44), `screens/StitchScheduleScreen.js` (42)

---

## 3. Typographie

### 3.1 Ce qui est réellement chargé

`App.js:6-13` charge, via `@expo-google-fonts` :
- **Marcellus** : `Marcellus_400Regular` (une seule graisse)
- **Inter** : `Inter_300Light`, `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`

`App.js:40` bloque le rendu jusqu'à ce que les deux familles soient prêtes (`ActivityIndicator` cyan `#00D4FF` sur fond `#070B14`).

`docs/prototype_courtlight.html:7` charge les mêmes familles via Google Fonts : `family=Marcellus&family=Inter:wght@300;400;500;600`. Cohérent.

### 3.2 La règle déjà décidée (doc 06 §3, révision du 8 juillet)

Reproduite sans modification :

> *luxe sportif intelligent*, pas geek — **Marcellus** (capitales romaines, gravure de trophée) pour l'identité et les moments de marque ; **Inter** (300/400/500/600, tracking −1 %) pour toute l'interface ; **les grands chiffres en Inter Light 300 + `tabular-nums`** — la finesse dit le luxe, jamais la graisse ; labels en petites capitales espacées (11 px, +16 %). Rajdhani et Cinzel sont retirés.

Échelle (doc 03 §2) : 34 (score héros) / 26 (titre écran) / 18 (section) / 15 (corps) / 12 (méta). Interlignage 1,5. Deux graisses maximum par écran.

### 3.3 Application réelle

| Famille | Occurrences | Fichiers |
|---|---|---|
| `Inter_600SemiBold` | 25 | Écrans Supabase + composants |
| `Inter_500Medium` | 7 | idem |
| `Inter_400Regular` | 5 | idem |
| `Inter_300Light` | **3** | `ReadinessHalo.tsx:136`, `CoachHomeSupabase.tsx:382`, `ProfileScreenSupabase.tsx:522` |
| `Marcellus_400Regular` | **4** | `SplashScreen.tsx:47`, `AthleteHomeSupabase.tsx:203`, `CoachHomeSupabase.tsx:356`, `ProfileScreenSupabase.tsx:481` |
| `'Marcellus', serif` (CSS web) | 2 | `AdminSystemHealthScreen.tsx:131`, `OnboardingNotifScreen.tsx:148` |
| `tabular-nums` | 6 | `CoachHomeSupabase.tsx` (×4), `ReadinessHalo.tsx:137`, `AdminSystemHealthScreen.tsx` |

**Familles hors système, encore présentes :**

| Famille | Occurrences | Où |
|---|---|---|
| `'DM Sans', system-ui` | ~20 | `CreateTeamModal.tsx` (×8), `StitchQuestionnaireScreen.js` (×11), `DARRawChart.tsx:65,101`, `DARStackedChart.tsx:62`, `DARPerformanceChart.tsx:266,406` |
| `'Space Mono', monospace` | ~18 | `CreateTeamModal.tsx:196,200,216,220,348,486,508`, `StitchQuestionnaireScreen.js` (×9), `DARPerformanceChart.tsx:79,280,298,392`, `DARStackedChart.tsx:172,220,228,236` |
| `'Palatino Linotype', Palatino, Georgia, serif` | 2 | `src/constants/theme.ts:19`, `CoachScheduleScreen.tsx:448` |
| `Cinzel` | 4 | `src/theme/tokens.ts:91` (token v1), `assets/logo.svg:27,43`, `StitchCreateAccountScreen.js:216,266` |
| `system-ui, -apple-system, …` | 7 | `AthleteDetailScreen.tsx:267`, `CoachHomeScreen.tsx:193`, `CoachProfileScreen.tsx:161`, `PWAInstallBanner.tsx:85,178`, `AdminTeamDetailScreen.tsx:421` |

Cinzel est **retirée par décision du 8 juillet** et figure encore dans quatre endroits, dont un écran de production (`StitchCreateAccountScreen.js` — écran de création de compte, vu par tout nouvel utilisateur) et le fichier de tokens.

Palatino n'a jamais été décidée nulle part : elle apparaît uniquement dans le `theme` de `src/constants/theme.ts` et son unique consommateur direct hors de ce fichier, `CoachScheduleScreen.tsx:448` (titre `<h1>` de l'écran Schedule du coach — **écran de production, visible en permanence par le coach**).

---

## 4. Les composants existants

### 4.1 Composants du système Courtlight

| Composant | Rôle | Props | Consommateurs | Devrait remplacer |
|---|---|---|---|---|
| **`ReadinessHalo.tsx`** | Signature n° 1 (doc 06 §2.1). Anneau SVG, lueur de zone, cran de baseline, count-up 600 ms. | `score: number\|null`, `zone: "GREEN"\|"BLUE"\|"YELLOW"\|"NONE"`, `size?=76`, `baselinePct?`, `fontSize?`, `animate?=false` | `CoachHomeSupabase.tsx`, `AthleteHomeSupabase.tsx` | La jauge SVG en dur de `AthleteDetailScreen.tsx:389` (texte `<text>` blanc, `fontWeight 700` — l'inverse de la règle Inter Light 300). Les pastilles de score de `CoachTeamScreen.tsx`. |
| **`GlassCard.tsx`** | Verre de focus (doc 06 §2.3, plan supérieur). Tilt 3D ±5° au pointeur, reflet suiveur, `backdrop-filter: blur(14px)`, ombre e2, `glow` optionnel. | `children`, `style?`, `glow?=false` | `CoachHomeSupabase.tsx`, `AthleteHomeSupabase.tsx` | Toute carte « qui demande une décision ». Aucun autre écran ne l'utilise. |
| **`CardGraphite.tsx`** | Carte graphite (plan intermédiaire). Ombre e1, liseré zénithal, cascade 40 ms × index. | `children`, `style?`, `index?=0` | **Aucun. Composant mort.** | Toutes les cartes en dur : `CoachTeamScreen.tsx:184`, `CoachProfileScreen.tsx:205,304,334,350`, `AthleteDetailScreen.tsx:254`. **Et le style `card` dupliqué dans `CoachHomeSupabase.tsx:447-457`, qui reproduit exactement `CardGraphite` ligne par ligne.** |
| **`CourtScene.tsx`** | Scène ambiante WebGL (doc 06 §4, couche 1). Terrain NBA 94×50 ft en canvas-texture, 180 particules, parallaxe, dégradation auto (`prefers-reduced-motion`, absence de WebGL, FPS < 28). Web uniquement. | aucune | `StitchNavigator.js:720` — montée une fois, sous toute l'app | — |
| **`SplashScreen.tsx`** | Chargement (doc 06 §6). Trois `ShimmerBar`, 2 cycles de 1,2 s, wordmark Marcellus. Pas de spinner. | aucune | `StitchNavigator.js:610,616` | L'`ActivityIndicator` de `App.js:43`, et les `ActivityIndicator` de `CoachTeamScreen.tsx:153`, `CoachProfileScreen.tsx:194`, `AdminSystemHealthScreen.tsx:142`, `CreateTeamModal.tsx:370,465` |

### 4.2 Composants de marque

| Composant | Rôle | Consommateurs | Remarque |
|---|---|---|---|
| **`ChampionTrackProLogo.tsx`** | Rend le lockup. Web : `<img src="/logo/logo_bon.png">` largeur 300 px. Natif : `require("../../public/logo/logo_nobackground.png")` 280 × 80. | `BrandHeader.tsx:22`, `StitchCreateAccountScreen.js` | Deux fichiers image différents selon la plateforme, de résolutions différentes (701×356 vs 492×250). Fonctionnel mais incohérent. |
| **`BrandHeader.tsx`** | Wrapper `<div>` centré autour du logo, padding 24/16. Web uniquement (balise `<div>` brute). | `AthleteHomeNew.tsx:22` | 25 lignes dont 20 de style inline. Ne consomme aucun token. |

### 4.3 Composants d'interface

| Composant | Rôle | Props | Consommateurs | Remarque |
|---|---|---|---|---|
| **`StatusPill.tsx`** | 8 variantes d'état d'entraînement (`respond`, `comingSoon`, `expired`, `inProgress`, `questionnaireOpen`, `completed`, `cooldown`, `default`). | `variant`, `onPress?`, `showNotificationDot?`, `testID?` | `AthleteHomeNew.tsx`, `ScheduleScreenNew.tsx` | **45 hex en dur, aucun token.** Contient les gradients `#00F5FF → #00A8FF → #4A67FF` (respond) et `#00FFC2 → #00C16A` (completed), et le point de notification `#FF003C`. Duplique intégralement sa logique de style entre le rendu web (lignes 116-356) et le rendu natif (lignes 358-511). |
| **`MobileViewport.tsx`** | Contrainte de largeur mobile. | — | 8 fichiers (le plus réutilisé du projet) | 6 hex |
| **`PWAInstallBanner.tsx`** | Bandeau d'installation PWA. | — | `StitchLandingScreen.js` | 12 hex, `system-ui` |
| **`SliderDivider.tsx`** | Séparateur. | — | `CoachHomeScreen.tsx` (écran débranché) | 4 hex |
| **`DARPerformanceChart` / `DARRawChart` / `DARStackedChart`** | Graphiques d'analyse. | — | `PerformanceDashboard.tsx` | Utilisent `'DM Sans'` et `'Space Mono'` — hors système typographique |

---

## 5. Écarts de cohérence

Classement par effort. **Rappel : quand `EXPO_PUBLIC_USE_SUPABASE=1` (valeur actuelle dans `.env:1`), les écrans réellement rendus sont** : coach → `CoachHomeSupabase`, `CoachTeamScreen`, `CoachScheduleScreen`, `PerformanceDashboard`, `ProfileScreenSupabase`, `AthleteDetailScreen` ; athlète → `AthleteHomeNew`, `ScheduleScreenNew`, `ProfileScreenSupabase`, `StitchQuestionnaireScreen`, `OnboardingNotifScreen` ; admin → `AdminHomeScreen`, `AdminSystemHealthScreen`, `PerformanceDashboard`, `AdminTeamDetailScreen`, `ProfileScreenSupabase`. Les écrans `AthleteHomeSupabase`, `ScheduleScreenSupabase`, `CoachHomeScreen`, `CoachProfileScreen`, `AdminTeamScreen`, `CreateTeamModal`, `StitchProfileScreen`, `StitchHomeScreenClean`, `StitchScheduleScreen` **ne sont pas rendus**. Corriger un écran mort n'a aucun effet visible.

### 5.1 Effort TRIVIAL (remplacement 1:1, aucun risque de régression)

| # | Fichier : lignes | Écart | Correction |
|---|---|---|---|
| T1 | `src/theme/tokens.ts:157-188` | Export `da` mort (0 consommateur) | Supprimer, ou marquer `@deprecated` en commentaire |
| T2 | `src/theme/tokens.ts:91` | `brand: "Cinzel, serif"` — police retirée le 8 juillet | Aligner sur `courtlight.type.brand` = `'Marcellus', serif` |
| T3 | `src/components/CardGraphite.tsx` | Composant mort (0 import) | Le brancher (voir M2) ou le supprimer |
| T4 | `public/logo/logo_clean.png` | Doublon binaire de `logo_nobackground.png` | Supprimer |
| T5 | `public/icons/icon-192.png`, `icon-512.png` | Doublons binaires des `-v2` | Supprimer |
| T6 | `assets/logo.svg` | `font-family="Cinzel, serif"`, non référencé | Supprimer |
| T7 | `app.json:12,18` vs `app.config.js:20,21` vs `public/manifest.json` | **Trois couleurs de thème différentes** : `#0E1528` (app.json splash + adaptiveIcon), `#0A0F1E` (app.json web), `#0A1F3C` (app.config.js + manifest.json). Aucune n'est `courtlight.bg.court` `#070B14`. | Unifier sur `#070B14` |
| T8 | `src/screens/CoachTeamScreen.tsx:116,117` · `CoachScheduleScreen.tsx:393` · `AthleteDetailScreen.tsx:239` | Écran de repli natif avec fond `#0A0F1E` en dur | `courtlight.bg.court` |
| T9 | `src/components/SplashScreen.tsx:29` + `docs/prototype_courtlight.html:99` | `TRACK` en cyan au lieu de `PRO` (§1.9) | **Décision fondateur requise** puis 1 ligne |

### 5.2 Effort MOYEN (un fichier, plusieurs lignes, périmètre clos)

| # | Fichier | Écart | Volume |
|---|---|---|---|
| M1 | **`src/screens/CoachTeamScreen.tsx`** | **Aucun import de token.** 20 hex en dur : `#0A0F1E` (l. 116, 134, 135), `#0D1526` (l. 184), `#00D4FF` (l. 148, 153, 213, 226, 233), `#00FF88` (l. 125), `#FFB800` (l. 126, 127), `#FB7100` (l. 128), `#0D1F3C` (l. 134), `#FCA5A5` (l. 157), `#4A67FF33` (l. 226) | 20 remplacements. **Écran de production, onglet Team du coach.** |
| M2 | **`src/screens/CoachScheduleScreen.tsx`** | **Aucun import de token.** Constantes locales l. 11-15 : `BG="#0A0F1E"`, `CYAN="#00D4FF"`, `CARD_BG="#0D1526"`, `ORANGE="#FF8C42"`. Plus `#FF4D4D` (l. 179), `#FFB800` (l. 179), `#4ADE80` (l. 179), `#9AA3B2` (l. 475), `#FF6B6B` (l. 434), et `fontFamily: "'Palatino Linotype'…"` (l. 448) | 23 hex + 1 famille typo. **Écran de production, onglet Schedule du coach.** |
| M3 | **`src/screens/AthleteDetailScreen.tsx`** | **Aucun import de token.** Constantes l. 21-23 : `CYAN`, `BG`, `CARD_BG`. Plus `#0E1528` (l. 254), `#0D1F3C` (l. 264), `#00FF88` (l. 251, 519), `#FFB800` (l. 251, 519, 531), `#FF4444` (l. 251, 519), `#0066FF` (l. 469), `#FCA5A5` (l. 353), `#4A67FF33` (l. 325), `system-ui` (l. 267). Jauge SVG en dur l. 389 (`fill="#FFFFFF" fontWeight="700"`) au lieu de `ReadinessHalo` | 21 hex + 1 composant + 1 famille typo. **Écran de production, atteint depuis l'onglet Team.** |
| M4 | **`src/components/StatusPill.tsx`** | 45 hex, aucun token. Web (l. 116-356) et natif (l. 358-511) dupliquent toute la logique de style. Gradients hors palette : `#00F5FF/#00A8FF/#4A67FF`, `#00FFC2/#00C16A`. Point rouge `#FF003C` (l. 173, 281, 346, 659) alors que le rouge est réservé aux flags P1 (doc 03 §2) | 45 remplacements + factorisation. **Composant de production, vu par tout athlète.** |
| M5 | `src/screens/CoachHomeSupabase.tsx:447-457` | Le style `card` reproduit `CardGraphite.tsx:45-54` à l'identique (mêmes `backgroundColor`, `borderColor "rgba(0,212,255,0.10)"`, `borderRadius`, `padding: 16`, même `boxShadow`) | Remplacer par `<CardGraphite>` |
| M6 | `src/screens/AdminSystemHealthScreen.tsx:14-16` | Objet de couleurs local `{ok:"#00FF9D", warn:"#FFB800", bad:"#EF4444"}` — deux des trois valeurs divergent des tokens de zone (`GREEN #00C853`) | 3 remplacements + décision sur le rouge |
| M7 | `src/constants/theme.ts` | Fichier de tokens n° 4, consommé par un seul écran mort. Le doc 03 §7.1 demandait sa suppression. | Supprimer avec `CoachHomeScreen.tsx` ou migrer les deux |
| M8 | `screens/StitchCreateAccountScreen.js:216,266` | Charge Cinzel depuis Google Fonts et l'applique. **Écran de production** (création de compte) | Remplacer par Marcellus |

### 5.3 Effort LOURD (fichiers de plus de 1000 lignes, refonte partielle)

| # | Fichier | Taille | Écart |
|---|---|---|---|
| L1 | **`src/stitch_components/AthleteHomeNew.tsx`** | 1912 lignes | 34 hex. Consomme `tokens` (v1) et non `courtlight` (l. 7). Fond `#0A0F1A` (l. 791, 1167) et gradient 5 stops `['#0A0F1A','#0F1623','#1A1F2E','#0D1117','#000000']` (l. 1167) — aucun rapport avec `courtlight.bg.vignette`. Texte secondaire `#9AA3B2` (l. 924, 1143, 1907) au lieu de `#9CA3AF`. **Écran d'accueil de l'athlète, en production.** |
| L2 | **`src/stitch_components/ScheduleScreenNew.tsx`** | ~2250 lignes | 62 hex. Consomme `tokens` (v1). Cyan `#00EAFF` × 11 au lieu de `#00D4FF`. Même gradient 5 stops (l. 820, 1663). `#9AA3B2` × 7. **Écran Schedule de l'athlète, en production.** |
| L3 | **`screens/StitchQuestionnaireScreen.js`** | — | 66 hex, mais **importe déjà `courtlight`** — donc partiellement migré. Familles `'DM Sans'` (×11) et `'Space Mono'` (×9). **Écran du check-in quotidien : l'écran héros de l'athlète (doc 03 §5).** |
| L4 | **`src/screens/PerformanceDashboard.tsx`** | — | 32 hex. Importe `courtlight` mais garde une palette de graphiques indépendante : l. 94-99 (`#00D4FF`, `#FF6B6B`, `#00FF9D`, `#FFB800`, `#7B61FF`, `#FF9F43`), l. 109-111, et deux palettes dupliquées l. 1549 et l. 1564 (`[cl.accent.cyan,"#00FF88","#A855F7","#FFB800","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4"]`). Les composants `DAR*Chart` utilisent `'DM Sans'` / `'Space Mono'`. |
| L5 | `screens/StitchProfileScreen.js` (44 hex), `StitchScheduleScreen.js` (42), `StitchHomeScreenClean.js` (26) | — | Écrans **débranchés** quand `USE_SUPABASE=1`. Effort lourd, gain visible nul. **Ne pas traiter** tant qu'ils ne sont pas rebranchés. |

### 5.4 Écarts d'assets (hors code)

| # | Écart | Effort |
|---|---|---|
| A1 | `assets/favicon.png`, `assets/icon.png`, `assets/adaptive-icon.png`, `assets/splash-icon.png` sont les **placeholders Expo par défaut** | Trivial (remplacer 4 fichiers) |
| A2 | `public/icons/icon-192-v2.png` et `icon-512-v2.png` portent le **carré noir** hérité de `logo_test.png` | Trivial (régénérer depuis `logo-191-v2.png`) |
| A3 | Aucune variante de logo pour fond clair | Moyen (création d'asset) |
| A4 | `VISUEL/logo_ctp_lockup.svg` contient `Cinzel` et une baseline grise `#C9D2DE` au lieu de blanche | Trivial (2 valeurs) |
| A5 | Le « Pro » du fichier A est lavé par le détourage (`#11F0FE` vs `#00C2FD`) | Moyen (retouche) |

---

## 6. Plan d'harmonisation minimal

Principe : **cohérence et propreté, pas de refonte.** L'ordre suit le rapport visibilité / risque. Chaque étape est indépendante et livrable seule.

### Étape 1 — Assainir les assets de marque (aucun code touché)

| Action | Fichier | Ce qui change |
|---|---|---|
| 1.1 | `public/icons/icon-192-v2.png`, `icon-512-v2.png` | Régénérer depuis `VISUEL/logos officiels/logo-191-v2.png` sur fond `#070B14`. Supprime le carré noir. |
| 1.2 | `assets/favicon.png`, `icon.png`, `adaptive-icon.png`, `splash-icon.png` | Remplacer les 4 placeholders Expo par l'emblème sur `#070B14` |
| 1.3 | `public/logo/logo_clean.png`, `public/icons/icon-192.png`, `icon-512.png`, `assets/logo.svg` | Supprimer (doublons / Cinzel) |
| 1.4 | `app.json:12,18,27,28`, `app.config.js:20,21`, `public/manifest.json` | Unifier `#0E1528` / `#0A0F1E` / `#0A1F3C` sur `#070B14` |

**Effet :** l'icône PWA sur l'écran d'accueil d'un coach cesse d'afficher un carré noir. C'est le premier contact avec le produit.

### Étape 2 — Décisions du fondateur (aucun code, mais bloquant)

| Question | Options | Impact |
|---|---|---|
| 2.1 Le cyan de marque | `#00D4FF` (89 usages code, token `courtlight`) ou `#00C2FD` (couleur du « Pro » du logo, ≈ `tokens.accentCyan #00C2FF`) | Détermine si le logo s'aligne sur le code ou l'inverse |
| 2.2 Le mot en cyan | `PRO` (logo officiel) ou `TRACK` (SplashScreen + prototype) | 2 lignes de code |
| 2.3 Le vert d'état | `#00C853` (token `courtlight.zone.GREEN`) — les 4 autres verts disparaissent | 40+ remplacements en aval |
| 2.4 Le rouge | `#EF4444` (token `da`, orphelin) à réintégrer dans `courtlight` | 14 nuances de rouge à réduire |
| 2.5 Le orange « friction » | Aucun token n'existe. Soit on en crée un (rupture avec « 4 couleurs d'état sacrées »), soit l'état friction bascule sur YELLOW | 4 valeurs |
| 2.6 Zone de respiration du logo | La règle du §1.7 est déduite, pas relevée | — |

### Étape 3 — Fermer le fichier de tokens

| Action | Fichier : lignes | Ce qui change |
|---|---|---|
| 3.1 | `src/theme/tokens.ts:157-188` | Supprimer `da` (0 consommateur) |
| 3.2 | `src/theme/tokens.ts:91` | `brand: "Cinzel, serif"` → `"'Marcellus', serif"` |
| 3.3 | `src/theme/tokens.ts` (ajout dans `courtlight`) | Ajouter les valeurs déjà utilisées mais non déclarées, décidées à l'étape 2 : `state.red`, `text.onAccent: "#04121F"` (6 usages identiques existants), `zone.ORANGE` si 2.5 le décide. **Aucune valeur nouvelle : uniquement des hex déjà présents dans le code.** |
| 3.4 | `src/constants/theme.ts` | Supprimer, avec `src/screens/CoachHomeScreen.tsx` (écran mort) |

### Étape 4 — Les trois écrans coach non harmonisés

Dans cet ordre (fréquence d'usage décroissante par le coach) :

| Action | Fichier | Ce qui change exactement |
|---|---|---|
| 4.1 | `src/screens/CoachTeamScreen.tsx` | Ajouter `import { courtlight as cl } from "../theme/tokens"`. Remplacer : l. 116/134/135 `#0A0F1E` → `cl.bg.court` ; l. 184 `#0D1526` → `cl.surface.card` ; l. 148/153/213/226/233 `#00D4FF` → `cl.accent.cyan` ; l. 125 `#00FF88` → `cl.zone.GREEN` ; l. 126/127 `#FFB800` → `cl.zone.YELLOW` ; l. 128 `#FB7100` → décision 2.5 ; l. 134 gradient `#0D1F3C→#0A0F1E` → `cl.bg.vignette` ; l. 157 `#FCA5A5` → décision 2.4 |
| 4.2 | `src/screens/CoachScheduleScreen.tsx` | Réécrire les constantes l. 11-15 en références `cl.*`. Supprimer `ORANGE` (l. 15) selon 2.5. l. 448 : `'Palatino Linotype'…` → `cl.type.brand`. l. 179 : les 4 couleurs d'état → tokens de zone. l. 475 `#9AA3B2` → `cl.text.mid` |
| 4.3 | `src/screens/AthleteDetailScreen.tsx` | Constantes l. 21-23 → `cl.*`. l. 254 `#0E1528` → `cl.surface.card`. l. 264 gradient → `cl.bg.vignette`. l. 251/519/531 couleurs de seuil → tokens de zone. l. 267 `system-ui…` → `cl.type.ui`. **l. 380-395 : remplacer la jauge SVG en dur par `<ReadinessHalo score={readiness7dAvg} zone={…} size={140} />`** |

**Effet :** les trois écrans coach cessent d'être visuellement étrangers aux autres. C'est le gain de cohérence le plus visible pour un prospect en démo.

### Étape 5 — `StatusPill` et `CardGraphite`

| Action | Fichier | Ce qui change |
|---|---|---|
| 5.1 | `src/components/StatusPill.tsx` | Importer `courtlight`. Remplacer les 45 hex par des tokens (gradient `respond` → `cl.accent.cyan` → `cl.accent.deep` ; `completed` → `cl.zone.GREEN` ; point de notification → décision 2.4). Extraire la table de configuration commune aux deux rendus (web/natif) hors des deux branches. |
| 5.2 | `src/screens/CoachHomeSupabase.tsx:447-457` | Supprimer le style `card` local, utiliser `<CardGraphite>` |
| 5.3 | `src/screens/CoachTeamScreen.tsx`, `CoachProfileScreen.tsx`, `AthleteDetailScreen.tsx` | Remplacer les `<div>` de carte en dur par `<CardGraphite>` |

### Étape 6 — Les deux gros écrans athlète (à ne lancer qu'après validation des étapes 1-5)

| Action | Fichier | Ce qui change |
|---|---|---|
| 6.1 | `src/stitch_components/AthleteHomeNew.tsx` | Basculer `import { tokens }` → `import { courtlight }` (l. 7). Remplacer le gradient 5 stops (l. 809, 1167) par `cl.bg.vignette`. `#9AA3B2` → `cl.text.mid`. Traiter les 34 hex. |
| 6.2 | `src/stitch_components/ScheduleScreenNew.tsx` | Idem. `#00EAFF` (×11) → `cl.accent.cyan`. 62 hex. |
| 6.3 | `screens/StitchQuestionnaireScreen.js` | Finir la migration déjà commencée (`courtlight` est déjà importé). `'DM Sans'` → `cl.type.ui`, `'Space Mono'` → `cl.type.mono`. 66 hex. |

### Ce qui n'est PAS dans ce plan, volontairement

- `screens/StitchProfileScreen.js`, `StitchScheduleScreen.js`, `StitchHomeScreenClean.js` : débranchés, 112 hex cumulés, gain visible nul.
- `src/screens/CreateTeamModal.tsx`, `AdminTeamScreen.tsx` : routes retirées (`StitchNavigator.js:44-47`).
- `src/screens/PerformanceDashboard.tsx` : sa palette de graphiques est un sujet distinct (lisibilité de séries multiples), qui mérite sa propre décision et pas un remplacement mécanique.
- Toute création de couleur, de police, de composant ou d'effet.

---

## 7. Ce que je n'ai pas pu déterminer

Énoncé explicitement, plutôt que comblé :

1. **La police exacte du wordmark.** Les PNG sont des rasters. Les vectorisations proposent `Cinzel, Marcellus, 'Times New Roman', serif` mais Cinzel a été retirée. Il faudrait le fichier source (Illustrator / Photoshop / l'outil de génération) pour trancher.
2. **La zone de respiration officielle.** Aucune spécification dans les fichiers sources. La règle du §1.7 est une déduction à partir des proportions mesurées.
3. **Les tailles minimales d'impression.** Déduites de la lisibilité à l'écran, non testées en impression.
4. **La provenance des quatre PNG.** Les deux fichiers à nom UUID (`8ea1daef`, `8fc2e2d3`) sont datés du 15 août 2026, les deux autres du 8 juin 2026. Rien dans le dossier n'indique lequel a été validé ni par quel processus.
5. **Si `#00C2FD` (« Pro » du logo) et `#00D4FF` (accent du code) sont censés être la même couleur** ou deux couleurs distinctes assumées. Décision 2.1.
6. **Le statut de `courtlight.zoneGlow`, `courtlight.motion`, `courtlight.shadow`.** Déclarés dans le token, partiellement consommés. Je n'ai pas audité leur application écran par écran — ce document couvre la couleur, la typographie et les composants, pas le motion design.
7. **`src/screens/AthleteHome.js` et `ScheduleScreenNewScreen.js`** sont des wrappers de 83 et 61 lignes sans style, qui délèguent à `stitch_components/`. Aucun impact visuel, mentionné pour l'exactitude de la carte.

---

*Document produit par extraction, sans invention. Toute valeur citée est vérifiable au chemin et à la ligne indiqués.*
