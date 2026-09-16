# CLAUDE_CODE_HANDOFF

**Tu es le nouveau développeur principal de ce projet.**

Tu n'as pas accès à l'historique des conversations précédentes. Ce document constitue ton contexte de démarrage.

**NE COMMENCE PAS À MODIFIER LE CODE immédiatement.**

Commence par comprendre le projet, inspecter le dépôt, et comparer ton analyse avec `PROJECT_SOURCE_OF_TRUTH.md`.

Tu dois considérer **les fichiers du dépôt comme la source de vérité technique actuelle**. En cas de contradiction entre la documentation et le code :

1. inspecte le code ;
2. identifie la contradiction ;
3. ne suppose pas ;
4. documente la contradiction ;
5. demande une clarification si elle peut modifier le comportement produit.

---

## Ordre de lecture imposé

| # | Fichier | Ce que tu y trouves |
|---|---|---|
| 1 | `HANDOFF/CLAUDE_CODE_HANDOFF.md` | ce fichier — les règles de reprise |
| 2 | `HANDOFF/PROJECT_SOURCE_OF_TRUTH.md` | le produit, l'architecture, les règles métier, l'état réel |
| 3 | `HANDOFF/DO_NOT_BREAK.md` | ce qui casse le produit si tu y touches sans précaution |
| 4 | `HANDOFF/KNOWN_ISSUES.md` | bugs ouverts, bugs historiques, **solutions déjà tentées et échouées** |
| 5 | `HANDOFF/ARCHITECTURE_DECISIONS.md` | pourquoi les choix ont été faits, ce qu'on ne réouvre pas sans revue |
| 6 | `HANDOFF/FEATURE_STATUS.md` | matrice fonctionnalité par fonctionnalité |
| 7 | `HANDOFF/PROJECT_INVENTORY.md` | cartographie fichier par fichier, avec les risques |
| 8 | `HANDOFF/NEW_CLAUDE_STARTUP_CHECKLIST.md` | ta séquence de reprise, à suivre dans l'ordre |
| 9 | `CLAUDE.md` (racine) | document-mère du projet : les 6 LOIS, non négociables |
| 10 | `CONSTITUTION.md` (racine) | 12 articles + amendements datés |

Ensuite seulement, `docs/01` à `docs/16` selon le domaine sur lequel tu travailles.

---

## Les six lois du projet (extraites de `CLAUDE.md`, non négociables)

1. **Chaîne intangible** : CALCUL (code/SQL) → RÈGLES (écrites par le fondateur, versionnées en base) → TRADUCTION (un appel LLM, payload pseudonymisé, chaque phrase cite un chiffre) → DÉCISION (le coach, toujours).
2. **Ne JAMAIS inventer ni activer une règle d'interprétation.** La table `rules` est la propriété exclusive du fondateur. Toute proposition va en DRAFT dans `docs/02`. `enabled = true` est sa décision seule.
3. **Pas d'orchestrateur multi-agents LLM.** Les « agents » métier sont des modules déterministes du moteur.
4. **Jamais** : prédiction de blessure individuelle, décision automatique de repos, conseil médical, promesse de résultat sportif.
5. **RLS multi-tenant non négociable.** Secrets jamais en clair — ni code, ni chat, ni commit.
6. **Auditer avant de modifier.** Produit fonctionnel à chaque commit. Les chemins Firebase restent intacts derrière `if (USE_SUPABASE)` jusqu'à l'étape M8.

Une septième, ajoutée le 15 août 2026 :

7. **LOI DE PARITÉ.** L'ancienne version en production fait foi pour les fonctionnalités, écrans, questionnaires, textes et timings de notification, workflows et console admin. Ne jamais improviser un contenu qui existe déjà dans l'ancien code : ouvrir, copier, nettoyer. Détail : `docs/07_CONTRAT_DE_PARITE.md`.

---

## Ce qu'il faut savoir avant d'ouvrir un seul fichier

**Il y a DEUX applications, pas une.**
- `APP/ChampionTrackPro-LIVE` — l'ancienne version, en production sur `champtrackpro.com`, dépôt `gfavergeat4-cell/ChampionTrackPro_`, projet Vercel `champion-track-pro`. Backend Firebase/Firestore. **Elle sert de référence de parité, ce n'est pas la cible de développement.**
- `APP/ChampionTrackPro-V2` — **c'est ici que tu travailles.** Dépôt `gfavergeat4-cell/ChampionTrackPro.ai`, projet Vercel `champion-track-pro-ai`. Backend Supabase.

**Il y a DEUX backends dans la V2, gouvernés par un seul interrupteur.**
`EXPO_PUBLIC_USE_SUPABASE=1` active Supabase. À 0, l'application retombe sur Firebase. Les deux chemins coexistent volontairement. Ne supprime aucun chemin Firebase avant l'étape M8.

**Le moteur tourne à vide, et c'est voulu.**
Aucune règle d'interprétation n'est activée. Le brief quotidien décrit des chiffres sans dire ce qui mérite l'attention du coach. Ce n'est pas un bug : c'est la loi n° 2. N'active rien.

**Les données de l'équipe pilote sont fictives.**
15 athlètes `DEMO …`, ~1 200 réponses, deux mois d'historique, générés le 15 août 2026. Script de génération et de purge : `supabase/seed_demo_roster.sql`.

---

## Ta première réponse doit être un PROJECT TAKEOVER REPORT

Pas du code. Un rapport, structuré ainsi :

```
UNDERSTANDING
CURRENT STATE
ARCHITECTURE
WHAT WORKS
KNOWN ISSUES
RISKS
CONTRADICTIONS
MISSING INFORMATION
PROPOSED NEXT STEPS
```

---

## Convention de fiabilité utilisée dans toute cette documentation

| Marqueur | Sens |
|---|---|
| `CONFIRMED` | vérifié dans le code ou observé en exécution, à la date indiquée |
| `INFERRED` | déduit du code ou du contexte, non observé directement |
| `UNKNOWN` | information non disponible — **ne pas combler par une hypothèse** |
| `TODO` | nécessite une décision du fondateur |
| `CONFLICTING` | plusieurs sources se contredisent — vérifier avant d'agir |

Si tu rencontres « A ou B ? », cherche dans le code, la documentation, Git, la configuration, les règles métier. Si la réponse reste inconnue, écris `UNKNOWN — USER DECISION REQUIRED`. **Ne choisis pas arbitrairement.**

---

## Le fondateur

Gabin Favergeat. Français, direct, zéro flatterie attendue. Expert entraînement (M2 EOPS, méthodologie Morin, expérience Cesson-Rennes D1 handball). Ses domaines réservés, sur lesquels tu proposes mais ne décides jamais : **règles d'interprétation, science de l'entraînement, contenu du questionnaire, pricing, vente, vision produit**.

Il exécute vite. Donne-lui **une action à la fois**, avec le résultat attendu. Il relance parfois des commandes déjà réussies — vérifie l'état réel avant de conclure à un échec. S'il colle un secret dans un chat, arrête-le et fais-le révoquer.

Son environnement : **Windows + PowerShell 5**. Pas de `&&` (une commande par ligne), `curl.exe` et non `curl`, `Remove-Item -Recurse -Force`.
