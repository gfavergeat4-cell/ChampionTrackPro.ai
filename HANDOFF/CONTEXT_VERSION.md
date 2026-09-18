# CONTEXT_VERSION

```
CONTEXT VERSION: 1.0.0

LAST AUDIT:               2026-08-15
LAST CODE AUDIT:          2026-08-15
LAST DOCUMENTATION AUDIT: 2026-08-15
LAST DATABASE AUDIT:      2026-08-15 (migrations 001-019 lues ; schéma distant vérifié par requêtes ponctuelles)
LAST DEPLOYMENT VERIFIED: 2026-08-15
```

## PROJECT STATE

Produit fonctionnel de bout en bout, **sans aucun client**. La chaîne complète a été vérifiée en exécution réelle le 15 août 2026 : notification push reçue sur appareil, check-in soumis, charge calculée, ACWR vivant, tableau coach peuplé, consentement horodaté.

**Zéro règle d'interprétation active** — décision du fondateur, pas un défaut.

## KNOWN CONTEXT GAPS

| Sujet | Ce qui manque |
|---|---|
| iOS | comportement push jamais testé |
| Multi-équipes | jamais testé avec deux équipes réelles simultanées |
| Relances | déclenchement à +3 h / +6 h jamais observé en conditions réelles |
| Crons | existence réelle de `ics-sync-15min` en production non revérifiée |
| Firebase | le projet Firebase/Firestore de la V1 n'a jamais été audité en détail dans cette passe |
| Charge | aucun test de montée en charge exécuté (protocole écrit dans `docs/11` §7) |
| Coûts | estimation LLM non confrontée aux `llm_logs` réels |
| Utilisateurs | aucun athlète ni coach réel n'a utilisé le produit |

## HISTORIQUE DES VERSIONS DE CONTEXTE

| Version | Date | Événement |
|---|---|---|
| 1.0.0 | 2026-08-15 | Premier dossier de passation complet. Audit intégral code + base + déploiement + documentation. |

## RÈGLE DE MISE À JOUR

Toute modification structurelle — écran ajouté ou supprimé, table, edge function, changement de routage, bascule de backend — met à jour dans le **même commit** :

1. `docs/08_CARTOGRAPHIE_TECHNIQUE.md`
2. `docs/CHANGELOG_IMPLEMENTATION.md` (entrée datée)
3. `HANDOFF/FEATURE_STATUS.md` si un statut change
4. `HANDOFF/CONTEXT_VERSION.md` (incrémenter la version et la date)

Un écart entre cette documentation et le code est un **bug**, pas un détail.
