// src/utils/questionnaire.ts
import { DateTime } from 'luxon';

export type QuestionnaireWindow = {
  openAt: DateTime;   // when the form becomes available
  closeAt: DateTime;  // when it closes
};

const OPEN_DELAY_MINUTES = 0;
const AVAILABLE_HOURS = 5;
const QUESTIONNAIRE_WINDOW_MINUTES = AVAILABLE_HOURS * 60;

/**
 * Calcule la fenêtre temporelle du questionnaire à partir de l'heure de fin du training
 * @param endMillis - Heure de fin du training en millisecondes UTC
 * @returns Fenêtre avec openAt et closeAt
 */
export function getQuestionnaireWindowFromEnd(
  endMillis: number
): QuestionnaireWindow {
  const end = DateTime.fromMillis(endMillis, { zone: 'utc' });
  const openAt = end.plus({ minutes: OPEN_DELAY_MINUTES });
  const closeAt = end.plus({ hours: AVAILABLE_HOURS });
  return { openAt, closeAt };
}

export type QuestionnaireStatus =
  | 'not_open_yet'
  | 'open'
  | 'closed'
  | 'completed';

/**
 * Nouveau type pour les états du questionnaire (noms simplifiés)
 */
export type QuestionnaireState =
  | 'respond'      // Questionnaire disponible (30 min à 5 h après la fin)
  | 'comingSoon'   // Training en cours ou pas encore terminé
  | 'expired'      // Fenêtre dépassée (> 5 h après la fin)
  | 'completed';   // Questionnaire déjà répondu

/**
 * Calcule le statut du questionnaire pour un training donné
 * @param endMillis - Heure de fin du training en millisecondes UTC (null si pas de fin)
 * @param responseCompleted - Si l'athlète a déjà complété le questionnaire
 * @param now - DateTime actuelle (par défaut: maintenant UTC)
 * @returns Statut du questionnaire (ancien format pour compatibilité)
 */
export function computeQuestionnaireStatus(
  endMillis: number | null,
  responseCompleted: boolean,
  now: DateTime = DateTime.utc()
): QuestionnaireStatus {
  if (responseCompleted) return 'completed';
  if (!endMillis) return 'closed';

  const nowMillis = now.toMillis();
  const endMillisNum = typeof endMillis === 'number' ? endMillis : (endMillis ? Number(endMillis) : null);

  // Si l'entraînement n'est pas encore terminé, le questionnaire n'est pas disponible
  if (nowMillis < endMillisNum) {
    return 'closed'; // L'entraînement n'est pas encore terminé
  }

  const { openAt, closeAt } = getQuestionnaireWindowFromEnd(endMillisNum);
  const openAtMillis = openAt.toMillis();
  const closeAtMillis = closeAt.toMillis();

  // Le questionnaire s'ouvre immédiatement après la fin de l'entraînement
  if (nowMillis < openAtMillis) return 'not_open_yet';
  if (nowMillis > closeAtMillis) return 'closed';
  return 'open';
}

/**
 * Calcule l'état du questionnaire pour un training donné (nouveau format)
 * @param trainingEndTime - Heure de fin du training en millisecondes UTC (null si pas de fin)
 * @param hasResponded - Si l'athlète a déjà répondu au questionnaire
 * @param now - DateTime actuelle (par défaut: maintenant UTC)
 * @param trainingStartTime - Heure de début du training en millisecondes UTC (optionnel, pour détecter les trainings futurs)
 * @returns État du questionnaire ('respond', 'comingSoon', 'expired', 'completed')
 */
export function getQuestionnaireState(
  trainingEndTime: number | null,
  hasResponded: boolean,
  now: DateTime = DateTime.utc(),
  trainingStartTime?: number | null
): QuestionnaireState {
  if (hasResponded) {
    return 'completed';
  }

  if (!trainingEndTime) {
    return 'expired';
  }

  const nowMillis = now.toMillis();

  let endMillisNum: number | null = null;
  if (trainingEndTime !== null && trainingEndTime !== undefined) {
    endMillisNum = typeof trainingEndTime === 'number' ? trainingEndTime : Number(trainingEndTime);
  }

  if (endMillisNum === null || isNaN(endMillisNum) || endMillisNum <= 0) {
    console.warn("[QUESTIONNAIRE][WARN] invalid trainingEndTime in getQuestionnaireState", { trainingEndTime, endMillisNum });
    return 'expired';
  }

  const startMillis = trainingStartTime !== null && trainingStartTime !== undefined
    ? (typeof trainingStartTime === 'number' ? trainingStartTime : Number(trainingStartTime))
    : null;

  if (startMillis && nowMillis < startMillis) {
    return 'comingSoon';
  }

  if (nowMillis < endMillisNum) {
    return 'comingSoon';
  }

  const deltaMinutes = (nowMillis - endMillisNum) / (1000 * 60);

  if (deltaMinutes < OPEN_DELAY_MINUTES) {
    return 'comingSoon';
  }

  if (deltaMinutes >= OPEN_DELAY_MINUTES && deltaMinutes <= QUESTIONNAIRE_WINDOW_MINUTES) {
    return 'respond';
  }

  return 'expired';
}


