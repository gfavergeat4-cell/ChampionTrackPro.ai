# FEATURE_STATUS

Audit du 15 août 2026. Statuts autorisés : `DONE` · `PARTIAL` · `IN PROGRESS` · `PLANNED` · `BLOCKED` · `UNKNOWN`.

**« TESTED » signifie testé en exécution réelle, pas « le code existe ».**

| Fonctionnalité | Statut | Front | Back | BDD | Testé | Notes |
|---|---|---|---|---|---|---|
| Authentification email / mot de passe | DONE | ✓ | ✓ | ✓ | ✓ | Confirmation d'email **désactivée** — BUG-01 |
| Adhésion par code, rôle serveur | DONE | ✓ | ✓ | ✓ | partiel | Testé en création ; **le rejet d'un athlète tentant `-C` n'a pas été testé** |
| Création d'équipe depuis l'app | DONE | ✓ | ✓ | ✓ | ✗ | Réparée le 15/08 — n'avait **jamais** fonctionné. À tester en priorité |
| Isolation multi-tenant (RLS) | DONE | — | ✓ | ✓ | partiel | Matrice complète dans `docs/11`. Jamais testée avec deux équipes réelles |
| Import calendrier iCal | PARTIAL | ✓ | ✓ | ✓ | partiel | Fonctionne. Annulation des séances retirées codée le 18/09 (FIXED-18) — **edge function pas encore redéployée**, donc pas encore vécu en production |
| Détection de fin de séance | DONE | — | ✓ | ✓ | ✓ | Rattrapage 3 h, idempotent |
| Notifications push (Web Push VAPID) | PARTIAL | ✓ | ✓ | ✓ | ✓ Android/desktop | **iOS jamais testé** — exige l'installation de la PWA |
| Relances +3 h / +6 h | PARTIAL | — | ✓ | ✓ | ✗ | Programmation vérifiée ; **déclenchement réel jamais observé** |
| Check-in athlète (questionnaire) | DONE | ✓ | ✓ | ✓ | ✓ | Écran piloté par la donnée, résolution par type de séance |
| Questionnaire NCAA (5 variantes) | DONE | ✓ | ✓ | ✓ | partiel | Seeds en base, équipe pilote basculée. **Formulations non validées** par le fondateur |
| Calcul readiness (trigger) | DONE | — | ✓ | ✓ | ✓ | |
| Calcul de charge (`session_load`, `workload_au`) | DONE | — | ✓ | ✓ | ✓ | Premier calcul réussi le 15/08 |
| ACWR | DONE | — | ✓ | ✓ | ✓ | Vivant (1,28 observé). Descriptif, controverse signalée dans `docs/02` |
| Sous-scores par axe | DONE | ✓ | ✓ | ✓ | ✓ | PHY / TEC / MEN / ACA |
| Baselines par axe (méthode DAR) | DONE | ✓ | ✓ | ✓ | ✓ | Seuil ±10 points — **diverge du moteur global à ±15 %** |
| Écart entraînement / compétition | PARTIAL | ✗ | ✓ | ✓ | ✗ | Vue `v_specificity` créée, **aucun écran ne l'affiche** |
| Moteur par athlète (`f_engine_user`) | DONE | — | ✓ | ✓ | ✓ | Non-régression : zéro écart |
| Règles d'interprétation | BLOCKED | — | ✓ | ✓ | ✗ | Mécanisme complet, **zéro règle activée**. Décision fondateur |
| Flags | BLOCKED | ✗ | ✓ | ✓ | ✗ | Reste vide tant qu'aucune règle n'est active |
| Morning Brief (LLM) | DONE | ✓ | ✓ | ✓ | partiel | Génère un texte. Sans règles, purement descriptif |
| Feedback coach (Useful / Noise) | DONE | ✓ | ✓ | ✓ | partiel | `acknowledged` / `overridden` **non exposés à l'interface** |
| Tableau coach multi-marqueurs | DONE | ✓ | ✓ | ✓ | ✓ | `CoachBoard`. Motif déclenché sur un seul jour — BUG-11 |
| Fiche joueur | PARTIAL | ✓ | ✓ | ✓ | partiel | Rebranchée. Pas encore les trois séries avec bande ±10 |
| Planning coach | DONE | ✓ | ✓ | ✓ | ✗ | Fenêtre bornée ±60 j |
| Dashboard analytics | PARTIAL | ✓ | ✓ | ✓ | partiel | Lit `daily_metrics`. Nécessitait un backfill manuel |
| Console santé admin | DONE | ✓ | ✓ | ✓ | partiel | Onglet Health |
| Détail équipe admin | DONE | ✓ | ✓ | ✓ | partiel | Renommage/suppression réparés le 15/08 |
| Suppression réelle d'un athlète | DONE | ✗ | ✓ | ✓ | ✗ | Fonctions et edge prêtes, **aucun bouton dans l'interface** — volontaire |
| Export des données d'un athlète | DONE | ✗ | ✓ | ✓ | ✗ | Idem |
| Consentements versionnés | DONE | ✓ | ✓ | ✓ | ✓ | Actifs. Textes non relus par un avocat |
| Pages légales publiques | DONE | ✓ | — | ✓ | partiel | `/legal/terms.html`, `privacy.html`, `athlete-notice.html` |
| Profil athlète | DONE | ✓ | ✓ | ✓ | ✓ | Réaligné visuellement sur Home le 15/08 |
| Accueil athlète | DONE | ✓ | ✓ | ✓ | ✓ | Composant de parité |
| Planning athlète | DONE | ✓ | ✓ | ✓ | ✓ | Composant de parité |
| Scène 3D de fond | DONE | ✓ | — | — | ✓ | Masquée par les fonds opaques des écrans athlète |
| Assets de marque | DONE | ✓ | — | — | partiel | Régénérés le 15/08. **Vider le cache PWA pour les voir** |
| Création de séance in-app | PLANNED | ✗ | ✗ | ✓ | ✗ | Colonnes prêtes depuis la migration 008 |
| Vue par cycles | PLANNED | ✗ | ✗ | ✓ | ✗ | Table `cycles` créée, lue par personne |
| Sélecteur d'équipe | PLANNED | ✗ | ✗ | — | ✗ | Nécessaire dès la deuxième équipe — BUG-08 |
| Journal d'accès | PLANNED | ✗ | ✗ | ✗ | ✗ | Bloquant pour un contrat universitaire |
| MFA staff | PLANNED | ✗ | ✗ | ✗ | ✗ | |
| Politique de rétention exécutée | PLANNED | — | ✗ | ✗ | ✗ | |
| Extinction Firebase (M8) | PLANNED | ✗ | ✗ | — | ✗ | **34** fichiers actifs référencent encore Firebase (mesuré le 15/08) |
| Tests automatisés | PLANNED | ✗ | ✗ | — | ✗ | Aucun runner configuré |
