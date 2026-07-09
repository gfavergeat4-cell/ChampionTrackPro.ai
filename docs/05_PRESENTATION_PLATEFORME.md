# ChampionTrackPro — Présentation de la plateforme
**Ce que la plateforme fait aujourd'hui, comment elle se présente, et comment on s'en sert. Document descriptif de l'existant (juillet 2026) — la vision long terme vit dans `04_VISION_PRODUIT_10_ANS.md`.**

---

## 1. En une phrase
ChampionTrackPro transforme 60 secondes de ressenti athlète par jour en un brief de décision lu par le coach en 90 secondes chaque matin — automatiquement, sans intervention humaine, chaque joueur étant comparé uniquement à sa propre baseline.

## 2. Les trois utilisateurs et leur logique d'usage

### L'athlète — « répondre, c'est tout »
Son parcours entier tient en 4 gestes :
1. Il reçoit le **code d'équipe** de son coach (ex. `CTP-PILOT`) → crée son compte en 30 s → il est rattaché à son équipe automatiquement.
2. Il installe l'app sur son téléphone (PWA — pas d'App Store, "Ajouter à l'écran d'accueil") et accepte les notifications.
3. Quand une séance se termine, **son téléphone vibre**. Il tape la notification → le questionnaire s'ouvre : 6 curseurs à ancres sémantiques (pas de chiffres), de "Running on empty" à "Fully charged". 60 secondes.
4. S'il oublie : relances automatiques à +20, +40 et +60 minutes, puis le système n'insiste plus. Fenêtre de réponse : 5 h après la séance (au-delà, le ressenti n'est plus fiable).
Son écran d'accueil montre : les séances à noter (bouton **Respond** lumineux) et ses prochaines séances — rien d'autre. Zéro friction, zéro distraction.

### Le coach — « lire, décider, c'est tout »
1. **Setup unique (5 minutes, autonome)** : il crée son compte coach avec le code équipe, colle l'adresse iCal de son Google Calendar dans la carte *Team setup* → toutes ses séances (practices, games, muscu) se synchronisent automatiquement toutes les 15 minutes, y compris les récurrences. Il partage le code d'invitation à ses joueurs. C'est terminé — il n'a plus jamais de saisie à faire.
2. **Chaque matin à 6 h**, notification : *"Your morning brief is ready."* Son écran affiche :
   - le **Morning Brief** — un texte généré par IA qui narre l'état de l'équipe en citant chaque chiffre (readiness, baseline, écart) et qui refuse d'extrapoler quand les données sont insuffisantes ;
   - les boutons **Useful / Noise** — son jugement en un tap, qui apprend au système ce qui compte pour lui ;
   - la **readiness du jour** de chaque joueur : pastille de zone (verte = adaptation normale, bleue = sous sa norme, jaune = pic inhabituel), score /100, écart vs sa baseline personnelle 28 jours ;
   - le **taux de check-ins** du jour (la compliance, métrique de survie du monitoring).
3. La règle du produit, affichée à l'écran : *"Signals are computed from each athlete's own 28-day baseline. Decisions stay yours."* Le système signale, le coach décide.

### L'administrateur (fondateur) — « légiférer, pas opérer »
Il crée les organisations et équipes, définit les questionnaires, et écrit les **règles d'interprétation** (seuils, conditions, textes de recommandation) dans un moteur versionné. Une fois écrites, les règles s'appliquent seules à chaque réponse, pour toutes les équipes, sans lui. Son intervention humaine n'est jamais requise dans la boucle quotidienne — c'est un produit, pas un service.

## 3. Ce qui se passe sous le capot (la chaîne autonome)

```
Google Calendar du coach → sync auto (15 min) → séances en base
→ fin de séance détectée (cron 1 min) → push athlètes → check-in 60 s
→ CALCUL serveur : readiness pondéré, baseline EMA 28 j (α=0,069),
  z-score individuel, zones ±15 % — jamais de comparaison entre joueurs
→ RÈGLES du fondateur (versionnées, traçables) → signaux hiérarchisés
→ TRADUCTION : un appel IA (données pseudonymisées P-01, P-02…) rédige
  le brief — interdiction système d'inventer un chiffre ou une prescription
→ brief + notification staff → décision coach → feedback Useful/Noise
  (chaque jugement enrichit le dataset propriétaire)
```

Principe non négociable : **aucune recommandation ne sort d'une mesure isolée** — chaque analyse reconstruit l'historique 7 j / 28 j du joueur. Et l'IA ne calcule ni ne décide jamais : elle traduit ce que les chiffres et les règles ont déjà établi.

## 4. Le design — « Stadium at night »
L'interface est une salle de basket la nuit : fond bleu-noir profond (`#0A0F1E`), surfaces sombres en couches, et une seule lumière cyan (`#00D4FF`) par écran — posée exactement sur ce qui demande une action (le bouton Respond de l'athlète, la carte du brief du coach). **La lumière EST la hiérarchie.** Les quatre couleurs d'état (vert/bleu/jaune/rouge) sont réservées au langage des zones — jamais décoratives. Typographies : Cinzel pour l'identité, Rajdhani pour l'interface et les scores. Contrastes AA, cibles tactiles 44 pt, aucune information portée par la couleur seule, animations courtes (< 700 ms) — c'est un outil de travail à 6 h du matin, pas un jeu. Détail complet : `03_DIRECTION_ARTISTIQUE.md`.

## 5. Fonctionnalités — état exact

| Fonctionnalité | État |
|---|---|
| Comptes athlète/coach par code d'équipe, routage par rôle | ✅ En production |
| Import calendrier Google (iCal) self-serve, récurrences, fuseaux horaires | ✅ En production |
| Détection auto de fin de séance + push + relances 20/40/60 | ✅ En production |
| Questionnaire 6 curseurs + friction/worry flag, fenêtre 5 h | ✅ En production |
| Moteur : readiness serveur, baseline EMA 28 j, z-score, zones, historisation | ✅ En production |
| Morning Brief IA quotidien + notification staff + coût tracé (~0,05 ¢/brief) | ✅ En production |
| Feedback coach Useful/Noise (dataset d'apprentissage) | ✅ En production |
| Sécurité : isolation multi-équipes (RLS), pseudonymisation vers l'IA, FERPA by design | ✅ En production |
| PWA installable (web + mobile), déployée sur Vercel | 🔄 En cours de mise en ligne |
| Règles d'interprétation expertes (seuils, recommandations) | 🔧 Moteur prêt — ingénierie fondateur en cours (`02_MOTEUR_DE_REGLES`) |
| ACWR / charge d'entraînement (sRPE) | 🔧 Moteur prêt — en attente du questionnaire de charge (décision produit) |
| Console admin multi-équipes, création de séance in-app, écrans stats avancés | 🗺 Backlog priorisé (`CLAUDE.md §5`) |

## 6. Ce que la plateforme refuse de faire (par conception)
Prédire une blessure individuelle. Décider qu'un joueur joue ou non. Comparer un athlète à ses coéquipiers. Produire une recommandation sans citer le chiffre et la règle qui la fondent. Donner un avis médical. Fonctionner en boîte noire. — Ces refus sont gravés dans la Constitution du produit et sont un argument de vente : chaque phrase d'un brief est auditable par un directeur athlétique ou un juriste d'université.
