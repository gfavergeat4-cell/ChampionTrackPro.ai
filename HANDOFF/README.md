# HANDOFF — dossier de passation

Créé le 15 août 2026. Destiné à un développeur, humain ou agent, qui reprend le projet **sans aucun accès à l'historique des conversations**.

| Fichier | Pour qui | Quand le lire |
|---|---|---|
| `EXEC_SUMMARY_PASTE_ME.md` | le nouveau chat | à coller dans le tout premier message |
| `CLAUDE_CODE_HANDOFF.md` | le nouveau développeur | en premier |
| `PROJECT_SOURCE_OF_TRUTH.md` | tous | référence principale, 35 sections |
| `DO_NOT_BREAK.md` | tous | avant toute modification |
| `KNOWN_ISSUES.md` | tous | avant toute correction — contient les échecs passés |
| `ARCHITECTURE_DECISIONS.md` | tous | avant de remettre en cause un choix |
| `FEATURE_STATUS.md` | tous | pour savoir ce qui marche réellement |
| `PROJECT_INVENTORY.md` | tous | cartographie fichier par fichier |
| `NEW_CLAUDE_STARTUP_CHECKLIST.md` | le nouveau développeur | séquence de reprise |
| `CONTEXT_VERSION.md` | tous | fraîcheur du contexte et lacunes connues |

La documentation métier et technique détaillée vit dans `docs/01` à `docs/16`. Le raisonnement daté derrière chaque bloc de travail vit dans `docs/CHANGELOG_IMPLEMENTATION.md`.

**Convention de fiabilité** : `CONFIRMED` · `INFERRED` · `UNKNOWN` · `TODO` · `CONFLICTING`. Une information absente reste absente — elle n'est jamais comblée par une hypothèse.
