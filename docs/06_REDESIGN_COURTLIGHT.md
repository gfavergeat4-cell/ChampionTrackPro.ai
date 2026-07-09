# 06 — COURTLIGHT · Le langage visuel ChampionTrackPro
**Évolution de « Stadium at night » (doc 03) vers une identité propriétaire. Règle immuable : la fonction d'abord — la beauté amplifie la clarté, jamais l'inverse. Prototype vivant : `docs/prototype_courtlight.html` (ouvrir dans Chrome). Implémentation : Claude Code, écran par écran, specs §7.**

---

## 1. L'idée fondatrice

Dans une salle éteinte, on reconnaît un joueur à la lumière qu'il renvoie. **Courtlight fait de la lumière le langage de la donnée** : chaque athlète est un point lumineux dont l'intensité et la teinte SONT sa readiness ; chaque chiffre vit toujours accroché à sa baseline personnelle ; et une seule source de lumière par écran désigne la prochaine décision. Ce n'est pas un thème sombre — c'est une grammaire.

## 2. Les cinq signatures (ce qui rend CTP reconnaissable sans logo)

1. **Le Readiness Halo** — le score vit dans un anneau dont la lueur porte la zone (vert/bleu/jaune) et dont un **cran lumineux sur l'anneau marque la baseline personnelle** : on VOIT l'écart avant de lire le chiffre. C'est notre cadran propriétaire — l'équivalent de l'anneau Apple Watch, mais racontant « toi versus toi ».
2. **Un score n'est jamais seul.** Grammaire absolue : tout chiffre s'affiche avec son référent (baseline, tendance 7 j, ou delta). Un nombre orphelin est une faute de design. C'est la philosophie produit rendue visible.
3. **Trois plans de matière** — le Court (fond, presque noir, marquages de terrain en filigrane à 3 %), les Cartes graphite (surfaces flottantes, ombre portée douce SOUS + liseré lumineux 1 px AU-DESSUS = éclairage volumétrique zénithal), et le Verre de focus (l'unique élément du plan supérieur : brief du coach, bouton Respond, slider actif — translucide, halo cyan). La profondeur dit la hiérarchie.
4. **La géométrie du terrain** — arcs de raquette et cercle central, tracés à peine visibles dans le fond, orientent subtilement chaque écran. Sur une capture sans logo : reconnaissable instantanément.
5. **Spring & settle** — tout mouvement a une physique (ressort discret, jamais de linéaire), tout état a une transition, et le rituel du matin a son moment : le score du brief **compte de 0 à sa valeur en 600 ms, une fois par jour**. Vivant, jamais agité.

## 3. Tokens v3 (étend `da` de `src/theme/tokens.ts`)

```ts
export const courtlight = {
  bg:      { court: "#070B14", vignette: "radial-gradient(1200px 800px at 50% -10%, #0D2545 0%, #070B14 60%)" },
  surface: { card: "rgba(17,26,45,0.92)", glass: "rgba(19,28,51,0.66)" },
  edge:    { rim: "inset 0 1px 0 rgba(160,220,255,0.10)",            // liseré zénithal
             hair: "1px solid rgba(0,212,255,0.10)" },
  shadowE: { e1: "0 8px 24px rgba(0,0,0,0.45)",                      // carte
             e2: "0 16px 48px rgba(0,0,0,0.55)",                     // verre de focus
             glowFocus: "0 0 40px rgba(0,180,255,0.22)" },           // UN par écran
  zoneGlow:{ GREEN: "0 0 18px rgba(0,200,83,0.45)", BLUE: "0 0 18px rgba(33,150,243,0.45)",
             YELLOW: "0 0 18px rgba(255,184,0,0.50)", NONE: "none" },
  motion:  { spring: "cubic-bezier(0.34, 1.3, 0.44, 1)", settle: "cubic-bezier(0.22, 1, 0.36, 1)",
             fast: 140, base: 260, hero: 600 },                       // ms — max absolu 700
  radius:  { card: 16, control: 10, halo: 999 },
} as const;
```
Couleurs d'état et grille 4 pt : inchangées (doc 03). **Typographie révisée (décision fondateur, 8 juil.)** : *luxe sportif intelligent*, pas geek — **Marcellus** (capitales romaines, gravure de trophée) pour l'identité et les moments de marque ; **Inter** (300/400/500/600, tracking −1 %) pour toute l'interface ; **les grands chiffres en Inter Light 300 + `tabular-nums`** — la finesse dit le luxe, jamais la graisse ; labels en petites capitales espacées (11 px, +16 %). Rajdhani et Cinzel sont retirés. Le rouge reste réservé aux flags priorité 1.

## 4. La 3D — doctrine Courtlight (révisée le 8 juil. — décision fondateur : la 3D EST l'interface)
Trois couches de 3D réelle, partout dans l'app :
1. **La scène ambiante (WebGL)** — le fond de chaque écran est une salle vivante : sol du terrain en perspective qui fuit dans la nuit, cercle central au sol, poussière de lumière en lévitation lente, caméra en parallaxe sur le mouvement (souris/gyroscope). Elle respire, elle n'attire jamais l'œil.
2. **La matière interactive** — les surfaces de focus sont des objets : inclinaison 3D sous le pointeur (±5°, perspective 900 px) avec reflet de lumière qui suit le doigt, boutons qui « touchent le sol » à l'appui, sliders physiques.
3. **Les moments héros** — count-up matinal du coach, anneau qui se referme à la complétion du check-in : chorégraphies 3D uniques, une par rituel.
Règle intangible : la 3D vit DERRIÈRE et DANS la matière — jamais entre l'utilisateur et son chiffre. **Dégradation par paliers obligatoire** : GPU faible / batterie basse / `prefers-reduced-motion` → la scène se fige en un rendu statique, les tilts deviennent des fondus ; le produit reste identique en information. Budget : 60 fps cible, jamais < 30 sur un téléphone d'étudiant — mesuré, pas espéré. Implémentation app : react-three-fiber (écrans web/PWA), fallback dégradé automatique.

## 5. Micro-interactions (chacune communique un état, jamais une décoration)
- **Boutons** : press = scale 0.97 + ombre qui s'écrase (le bouton « touche le sol ») ; release = spring 140 ms.
- **Slider du check-in** : le pouce grossit à la prise (1,15×), le rail s'illumine du côté parcouru, un tick haptique visuel aux ancres 25/50/75 ; au relâcher, settle 200 ms. Le geste doit être physiquement satisfaisant — c'est LA scène quotidienne de l'athlète.
- **Complétion questionnaire** : l'anneau du joueur se referme et pulse UNE fois + « Locked in. See you tomorrow. » + sa tendance 7 j — la récompense = de l'information sur soi, pas des confettis.
- **Cartes** : entrée en cascade 40 ms/carte, translateY 8 px → 0, spring.
- **Readiness update (coach)** : l'ancien chiffre glisse vers le haut, le nouveau settle ; le halo change de teinte en 260 ms.
- **Notification in-app** : descend du plan supérieur avec ombre e2, jamais de slide latéral.
- `prefers-reduced-motion` : tout devient fondu 120 ms, le count-up s'affiche directement.

## 6. États système (le premium se juge dans les creux)
- **Chargement** : jamais de spinner central — skeletons « warm-up » : les cartes existent déjà, la lumière se lève dedans (shimmer 1,2 s, 2 cycles max).
- **Vide (athlète à jour)** : « All caught up. Next session Thursday 3 pm. » + son halo du jour — le vide est une bonne nouvelle, on le montre.
- **Vide (coach, aucun check-in)** : la liste des joueurs en attente avec heure de relance prévue — le vide est une information de compliance, pas un écran mort.
- **Erreur** : carte graphite, message d'une ligne, action unique de retry. Jamais de rouge plein écran.

## 7. Écrans — spécifications d'implémentation (ordre pour Claude Code)

1. **Morning Brief (coach)** — le héros du produit. Ordre vertical : identité équipe (Marcellus, 13 px, espacé) → date + compliance (pastille X/Y) → **Verre de focus** : brief IA avec chaque chiffre cité rendu en Inter tabular + halo-badge de zone inline, boutons Useful/Noise intégrés au verre → roster trié par priorité : chaque rangée = mini-halo (28 px) + nom + delta vs baseline en langage clair (« +6 vs his norm ») → Team setup replié en accordéon en bas. Count-up du readiness d'équipe au premier affichage du jour.
2. **Check-in (athlète)** — un slider par écran (progression par points en haut, 6 étapes), question en 15-17 px, ancres sémantiques seules, fond Court avec l'arc de raquette orienté vers le slider. Swipe ou auto-avance au relâcher. Durée cible affichée à l'entrée (« 60 seconds »). Écran final : signature n° 5.
3. **Accueil athlète** — le Verre de focus est la carte « session à noter » avec temps restant de la fenêtre (« closes in 3 h 40 ») ; prochaines séances en cartes graphite discrètes ; son halo personnel du jour en en-tête.
4. **Onboarding notifications** — une phrase de valeur (« Your coach adapts training to how you feel — 60 seconds after each session ») + bouton unique ; la permission navigateur n'est demandée qu'après ce geste.
5. États, notifications, responsive : athlète = mobile-first 390 px ; coach = confortable au téléphone, dense au desktop (roster 2 colonnes ≥ 1024 px).

## 8. Garde-fous
Un seul élément lumineux par écran (inchangé, durci). Zones jamais décoratives. Aucune animation en boucle infinie hors shimmer de chargement. Contraste AA vérifié par écran. Budget interaction : réponse visuelle < 100 ms, transition < 700 ms. Si un choix oppose lisibilité à 6 h du matin et beauté : la lisibilité gagne, sans débat (Constitution, art. 9).
