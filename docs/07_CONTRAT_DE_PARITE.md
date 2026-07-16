# 07 — CONTRAT DE PARITÉ avec l'ancienne version
**Loi (décision fondateur, 15 juil.) : l'ancienne version EN LIGNE (`C:\GAB\PRO\ChampionTrackPro_-main`) fait foi pour TOUTES les fonctionnalités, écrans, contenus, textes de notifications, timings et règles déjà ingéniérés. La V2 = copie exacte et nettoyée de l'ancienne + backend SQL + améliorations explicitement validées (Courtlight = habillage validé, appliqué SUR la structure copiée). RIEN ne s'improvise. En cas de doute : ouvrir l'ancien code et copier.**

## Matrice de parité (état au 15 juil.)

| Élément | Référence (ancien) | V2 actuelle | Verdict |
|---|---|---|---|
| Questionnaire athlète | `src/stitch_components/QuestionnaireScreenNew.tsx` — 13 curseurs (averageIntensity, highIntensity, cardiacImpact, muscularImpact, fatigue, technique, tactics, dynamism, nervousness, concentration, confidence, wellBeing, sleepQuality) + question douleur (No/Yes), libellés et sous-titres EXACTS de l'écran en ligne | 6 sliders V3 | 🔒 GELÉ (décision fondateur 15 juil.) : Gabin créera un NOUVEAU questionnaire NCAA basketball plus tard. D'ici là : NE RIEN CHANGER au questionnaire (ni copier l'ancien, ni modifier l'actuel). Aucune décision autonome autorisée sur ce sujet. |
| Notification T+0 | « ChampionTrackPro ⚡ / Tell us — how did that session hit you? » (cron 1 min, fenêtre fin de séance) | identique (titre + emoji ⚡) | ✓ |
| Relance 1 | +3 h — « Still got 60 seconds? ⏱ / Your coach needs your data to make tomorrow better for everyone. » | +3 h, texte EXACT copié | ✓ (corrigé 16 juil.) |
| Relance 2 | +6 h — « Final reminder 🔒 / Don't let your session go untracked. » | +6 h, texte EXACT copié | ✓ (corrigé 16 juil.) |
| Fenêtre de réponse | fin de séance → +5 h (rules) | identique | ✓ |
| Accueil athlète | « WELCOME BACK / UPCOMING SESSIONS » + heure→titre + bouton Respond + pastille non-répondu | proche (Courtlight) | ✓ |
| Console ADMIN | AdminHomeScreen (toutes les équipes), AdminTeamScreen/AdminTeamDetailScreen, PerformanceDashboard (graphiques, temporalité) | Portés sur ctpApi + Courtlight | ✓ (porté 16 juil.) |
| Écrans Schedule / Profile / logout | existants | ScheduleScreenSupabase + ProfileScreenSupabase + signOut Supabase | ✓ (porté 16 juil.) |
| Moteur (EMA 28 j, zones ±15 %, readiness) | analytics existants | port SQL fidèle | ✓ |
| Design | Stadium at night d'origine | Courtlight (validé fondateur) | ✓ amélioration autorisée |

## Règles permanentes
1. Avant d'écrire un écran/texte/règle : chercher son équivalent dans l'ancien repo. S'il existe → copier (logique, textes, seuils, ordres d'affichage), puis nettoyer (types, dead code), puis habiller (Courtlight).
2. Le QUESTIONNAIRE est gelé : nouveau questionnaire NCAA à créer par Gabin — aucune initiative dessus. Les documents 02 (règles sport science) et SPEC_V4 sont des PROPOSITIONS D'AMÉLIORATION FUTURES — aucune ne remplace l'existant sans validation écrite de Gabin.
3. Toute déviation découverte entre V2 et l'ancien = bug de parité → changelog + correction.
