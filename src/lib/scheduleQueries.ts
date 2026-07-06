import { db } from './firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  Unsubscribe,
  doc,
  getDoc,
  Timestamp,
  limit,
  QueryDocumentSnapshot,
  DocumentData,
  Firestore,
} from 'firebase/firestore';
import { DateTime } from 'luxon';
import { FirestoreEvent, fsTsToMillis, toJSDate, utcMillisToLocal, intervalToUtcTimestamps } from '../utils/time';
import { mapTrainingDoc, UiEvent } from './mapTraining';
import { getMyResponseInfo } from './responses';
import {
  computeQuestionnaireStatus,
  getQuestionnaireWindowFromEnd,
  getQuestionnaireState,
  QuestionnaireStatus,
  QuestionnaireState,
} from '../utils/questionnaire';
// Fonctions de date simples pour remplacer date-fns
const startOfWeek = (date: Date, options: { weekStartsOn: number } = { weekStartsOn: 0 }): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) - (options.weekStartsOn || 0);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfWeek = (date: Date, options: { weekStartsOn: number } = { weekStartsOn: 0 }): Date => {
  const d = startOfWeek(date, options);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const startOfMonth = (date: Date): Date => {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfMonth = (date: Date): Date => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
};

export interface ScheduleQueryOptions {
  teamId: string;
  startDate: Date;
  endDate: Date;
  timeZone?: string;
  playerUid?: string | null;
  filterByPlayer?: boolean;
}

export interface EventWithResponse extends FirestoreEvent {
  hasResponse: boolean;
  responseId?: string;
  responseStatus?: 'answered' | 'not_responded' | 'unknown';
  response?: {
    status?: 'completed';
    submittedAt?: Timestamp;
  } | null;
  questionnaireStatus: QuestionnaireStatus;  // Ancien format (pour compatibilité)
  questionnaireState?: QuestionnaireState;   // Nouveau format ('respond', 'comingSoon', 'expired', 'completed')
  questionnaireOpenAt?: number;   // ms UTC
  questionnaireCloseAt?: number;  // ms UTC
  // Inclure explicitement startMillis et endMillis pour les composants UI
  startMillis?: number;  // ms UTC
  endMillis?: number;    // ms UTC
}

function adaptTrainingSnapshot(
  snapshot: QueryDocumentSnapshot<DocumentData>
): FirestoreEvent | null {
  const raw = snapshot.data() || {};
  const uiEvent = mapTrainingDoc(snapshot);

  if (!uiEvent) {
    return null;
  }

  const startUtcTs = raw.startUtc as Timestamp | undefined;
  const endUtcTs = raw.endUtc as Timestamp | undefined;
  const displayTz = uiEvent.displayTz || raw.displayTz || raw.timeZone || 'Europe/Paris';

  return {
    id: snapshot.id,
    teamId: uiEvent.teamId,
    title: uiEvent.title,
    summary: uiEvent.title,
    description: (raw.description as string) ?? '',
    location: (raw.location as string) ?? '',
    startUtc: startUtcTs ?? Timestamp.fromMillis(uiEvent.startMillis),
    endUtc: endUtcTs ?? Timestamp.fromMillis(uiEvent.endMillis),
    startUTC: uiEvent.startMillis,
    endUTC: uiEvent.endMillis,
    timeZone: displayTz,
    displayTz,
    originalTzid: (raw.originalTzid as string) ?? null,
    calendarTz: (raw.calendarTz as string) ?? null,
    hasUtcSuffix: Boolean(raw.hasUtcSuffix),
    startLocalISO: (raw.startLocalISO as string) ?? null,
    endLocalISO: (raw.endLocalISO as string) ?? null,
    uid: raw.uid as string,
    rrule: raw.rrule as string | undefined,
    exdates: raw.exdates as string[] | undefined,
    status: (raw.status as string) ?? 'CONFIRMED',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    hasResponse: false,
    responseStatus: 'unknown',
    tzid: displayTz,
    source: raw.source as string | undefined,
    deepLink: raw.deepLink as string | undefined,
    players: Array.isArray(raw.players) ? (raw.players as string[]) : [],
    startDate: uiEvent.startDate,
    endDate: uiEvent.endDate,
  };
}

type GetEventsForDayArgs = {
  db?: Firestore;
  teamId: string;
  day: Date;
};

export async function getEventsForDay({ db: dbInstance = db, teamId, day }: GetEventsForDayArgs): Promise<UiEvent[]> {
  const safeDay = toJSDate(day);

  const startUtcMs = DateTime.fromJSDate(safeDay).startOf('day').toUTC().toMillis();
  const endUtcMs = DateTime.fromJSDate(safeDay).endOf('day').toUTC().toMillis();

  const colRef = collection(dbInstance, 'teams', teamId, 'trainings');
  const qRef = query(
    colRef,
    where('startUtc', '>=', Timestamp.fromMillis(startUtcMs)),
    where('startUtc', '<=', Timestamp.fromMillis(endUtcMs)),
    orderBy('startUtc', 'asc')
  );

  const snap = await getDocs(qRef);
  const items = snap.docs
    .map(mapTrainingDoc)
    .filter((event): event is UiEvent => Boolean(event));

  console.log('[SCHEDULE][DAY]', {
    teamId,
    dayLocal: DateTime.fromJSDate(safeDay).toISO(),
    startUtc: new Date(startUtcMs).toISOString(),
    endUtc: new Date(endUtcMs).toISOString(),
    count: items.length,
  });

  return items;
}

/**
 * Requête commune pour récupérer les trainings dans un intervalle DateTime
 * Retourne un tableau de UiEvent simplifié (id, title, startMillis, endMillis, displayTz)
 */
export async function fetchTrainingsRange(
  teamId: string,
  from: DateTime,
  to: DateTime
): Promise<UiEvent[]> {
  const { startUtc, endUtc } = intervalToUtcTimestamps(from, to);

  const ref = collection(db, 'teams', teamId, 'trainings');
  const q = query(
    ref,
    where('startUtc', '>=', startUtc),
    where('startUtc', '<=', endUtc),
    orderBy('startUtc', 'asc')
  );

  const snap = await getDocs(q);
  const out: UiEvent[] = [];

  snap.forEach((doc) => {
    const d = doc.data() as any;
    const s = fsTsToMillis(d.startUtc);
    const e = fsTsToMillis(d.endUtc) ?? s;

    if (s) {
      out.push({
        id: doc.id,
        teamId: d.teamId || teamId,
        title: d.title || d.summary || 'Training',
        startDate: new Date(s),
        endDate: new Date(e),
        startMillis: s,
        endMillis: e,
        displayTz: d.displayTz || d.tzid || d.timeZone,
      });
    }
  });

  console.log('[SCHEDULE][RANGE]', {
    teamId,
    from: from.toISO(),
    to: to.toISO(),
    count: out.length,
  });

  return out;
}

/**
 * Query les trainings pour une plage de dates
 * Utilise la collection 'trainings' (pas 'events')
 */
export async function getEventsForDateRange(options: ScheduleQueryOptions): Promise<FirestoreEvent[]> {
  try {
    const {
      teamId,
      startDate,
      endDate,
      playerUid,
      filterByPlayer = false,
    } = options;
    
    if (!teamId || !startDate || !endDate) {
      console.log("[CAL][QUERY] getEventsForDateRange: missing params", { teamId, startDate, endDate });
      return [];
    }
    
    const startBoundary = Timestamp.fromMillis(startDate.getTime());
    const endBoundary = Timestamp.fromMillis(endDate.getTime());
    const from = startBoundary.toMillis();
    const to = endBoundary.toMillis();
    const path = `teams/${teamId}/trainings`;
    
    console.log("[CAL][QUERY] trainings range", { 
      path, 
      rangeStart: new Date(from),
      rangeEnd: new Date(to),
      teamId,
      operation: "query"
    });
    
    const trainingsRef = collection(db, 'teams', String(teamId), 'trainings');
    // For day view, we want to show all events that start during the day
    // We query events that start before or during the day, then filter client-side
    // to include only those that overlap with the day (start during day OR end during day)
    const trainingsQuery = query(
      trainingsRef,
      where('startUtc', '<=', endBoundary),
      orderBy('startUtc', 'desc')
    );
    
    const snapshot = await getDocs(trainingsQuery);
    console.log('[CAL][QUERY] trainings query result', { 
      path, 
      size: snapshot.size,
      rangeStart: new Date(from),
      rangeEnd: new Date(to)
    });
    
    snapshot.docs.slice(0, 3).forEach((docSnap) => {
      const raw = docSnap.data();
      const ms = fsTsToMillis(raw?.startUtc);
      const tz = raw?.displayTz || 'Europe/Paris';
      const local = utcMillisToLocal(ms, tz)?.toFormat('dd MMM HH:mm') ?? 'NULL';
      console.log('[CAL][QUERY][ITEM]', docSnap.id, {
        title: raw?.title,
        tz,
        ms,
        local,
        startUtc: raw?.startUtc?.toMillis?.() ?? null,
        endUtc: raw?.endUtc?.toMillis?.() ?? null,
      });
    });
    
    const events = snapshot.docs
      .filter(docSnap => !docSnap.data().isTestSession)
      .map(adaptTrainingSnapshot)
      .filter((event): event is FirestoreEvent => Boolean(event));
    
    // DEBUG: Log all events before filtering
    console.log("[DEBUG][getEventsForDateRange] All events from Firestore before filtering:", {
      totalCount: events.length,
      queryRange: {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      },
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        startUTC: e.startUTC,
        endUTC: e.endUTC,
        startUtc: e.startUtc?.toMillis?.() ?? null,
        endUtc: e.endUtc?.toMillis?.() ?? null,
        startDate: e.startDate?.toISOString?.() ?? null,
        endDate: e.endDate?.toISOString?.() ?? null,
      })),
    });
    
    const filteredEvents = events
      .filter((event) => {
        const startMillis = event.startUTC ?? fsTsToMillis(event.startUtc) ?? null;
        const endMillis = event.endUTC ?? fsTsToMillis(event.endUtc) ?? null;
        
        if (startMillis === null) {
          console.warn("[UI][WARN] training without startUtc", event.id);
          return false;
        }
        
        // Include events that:
        // 1. Start during the day (startMillis >= dayStart && startMillis <= dayEnd)
        // 2. End during the day (endMillis >= dayStart && endMillis <= dayEnd)
        // 3. Span the entire day (startMillis < dayStart && endMillis > dayEnd)
        const startsInRange = startMillis >= from && startMillis <= to;
        const endsInRange = endMillis !== null && endMillis >= from && endMillis <= to;
        const spansRange = endMillis !== null && startMillis < from && endMillis > to;
        
        const included = startsInRange || endsInRange || spansRange;
        
        // DEBUG: Log filtering decision
        if (!included) {
          console.log("[DEBUG][getEventsForDateRange] Event excluded:", {
            id: event.id,
            title: event.title,
            startMillis,
            endMillis,
            startDate: new Date(startMillis).toISOString(),
            endDate: endMillis ? new Date(endMillis).toISOString() : 'N/A',
            startsInRange,
            endsInRange,
            spansRange,
            rangeFrom: new Date(from).toISOString(),
            rangeTo: new Date(to).toISOString(),
          });
        }
        
        return included;
      })
      .filter((event) => {
        if (!filterByPlayer || !playerUid) return true;
        return event.players?.includes?.(playerUid);
      });
    
    console.log("[CAL][QUERY] trainings filtered", { 
      path, 
      count: filteredEvents.length,
      beforeFilter: events.length,
      afterFilter: filteredEvents.length,
    });
    
    // DEBUG: Log filtered events
    console.log("[DEBUG][getEventsForDateRange] Filtered events:", {
      count: filteredEvents.length,
      events: filteredEvents.map((e) => ({
        id: e.id,
        title: e.title,
        startUTC: e.startUTC,
        endUTC: e.endUTC,
        startDate: e.startDate?.toISOString?.() ?? null,
        endDate: e.endDate?.toISOString?.() ?? null,
      })),
    });
    
    return filteredEvents;
  } catch (error: any) {
    const path = `teams/${options.teamId}/trainings`;
    console.error("[CAL][QUERY] trainings query error", { 
      path, 
      code: error?.code, 
      message: error?.message,
      error 
    });
    return [];
  }
}

/**
 * Souscription aux trainings pour une plage de dates
 * Utilise la collection 'trainings' (pas 'events')
 */
export function subscribeToEvents(
  options: ScheduleQueryOptions,
  callback: (events: FirestoreEvent[]) => void
): Unsubscribe {
  const {
    teamId,
    startDate,
    endDate,
    playerUid,
    filterByPlayer = false,
  } = options;
  
  const startBoundary = Timestamp.fromMillis(startDate.getTime());
  const endBoundary = Timestamp.fromMillis(endDate.getTime());
  const from = startBoundary.toMillis();
  const to = endBoundary.toMillis();
  const path = `teams/${teamId}/trainings`;
  
    console.log("[CAL][QUERY] subscribe trainings range", { 
      path, 
      rangeStart: new Date(from),
      rangeEnd: new Date(to),
      operation: "onSnapshot",
      teamId 
    });
  
    const trainingsRef = collection(db, 'teams', String(teamId), 'trainings');
    // Use same query logic as getEventsForDateRange to include overlapping events
    const trainingsQuery = query(
      trainingsRef,
      where('startUtc', '<=', endBoundary),
      orderBy('startUtc', 'desc')
    );
    
    return onSnapshot(
      trainingsQuery,
    (snapshot) => {
      console.log('[CAL][QUERY] trainings snapshot', { 
        path, 
        size: snapshot.size,
        rangeStart: new Date(from),
        rangeEnd: new Date(to)
      });
      
      snapshot.docs.slice(0, 3).forEach((docSnap) => {
        const raw = docSnap.data();
        const ms = fsTsToMillis(raw?.startUtc);
        const tz = raw?.displayTz || 'Europe/Paris';
        const local = utcMillisToLocal(ms, tz)?.toFormat('dd MMM HH:mm') ?? 'NULL';
        console.log('[CAL][QUERY][ITEM]', docSnap.id, {
          title: raw?.title,
          tz,
          ms,
          local,
          startUtc: raw?.startUtc?.toMillis?.() ?? null,
          endUtc: raw?.endUtc?.toMillis?.() ?? null,
        });
      });
      
      const events = snapshot.docs
        .map(adaptTrainingSnapshot)
        .filter((event): event is FirestoreEvent => Boolean(event))
        .filter((event) => {
          const startMillis = event.startUTC ?? fsTsToMillis(event.startUtc) ?? null;
          const endMillis = event.endUTC ?? fsTsToMillis(event.endUtc) ?? null;
          
          if (startMillis === null) {
            return false;
          }
          
          // Include events that:
          // 1. Start during the day (startMillis >= dayStart && startMillis <= dayEnd)
          // 2. End during the day (endMillis >= dayStart && endMillis <= dayEnd)
          // 3. Span the entire day (startMillis < dayStart && endMillis > dayEnd)
          const startsInRange = startMillis >= from && startMillis <= to;
          const endsInRange = endMillis !== null && endMillis >= from && endMillis <= to;
          const spansRange = endMillis !== null && startMillis < from && endMillis > to;
          
          return startsInRange || endsInRange || spansRange;
        })
        .filter((event) => {
          if (!filterByPlayer || !playerUid) return true;
          return event.players?.includes?.(playerUid);
        });
      
      callback(events);
    },
    (error) => {
      console.error("[CAL][QUERY] trainings subscription error", { 
        path, 
        code: error?.code, 
        message: error?.message,
        error 
      });
    }
  );
}

/**
 * Vérifie si un utilisateur a répondu à un événement
 * Utilise getDoc() directement (pas de query/list) pour lire le document de réponse
 * Tolérant aux erreurs permission-denied (doc inexistant autorisé par les règles)
 * 
 * Cette fonction délègue à getMyResponseInfo de src/lib/responses.ts
 */
export async function checkEventResponse(
  teamId: string,
  trainingId: string,
  currentUid: string
): Promise<{ hasResponse: boolean; responseId?: string; responseStatus: 'completed' | 'not_responded' | 'unknown' }> {
  const info = await getMyResponseInfo(teamId, trainingId, currentUid);
  return {
    hasResponse: info.hasResponse,
    responseId: info.responseId,
    responseStatus: info.responseStatus === 'completed' ? 'completed' : (info.hasResponse ? 'not_responded' : 'unknown'),
  };
}

/**
 * Query les trainings avec statut de réponse
 * Utilise la collection 'trainings' (pas 'events')
 */
export async function getEventsWithResponseStatus(
  options: ScheduleQueryOptions,
  userId: string
): Promise<EventWithResponse[]> {
  try {
    const events = await getEventsForDateRange(options);

    if (!Array.isArray(events)) {
      console.warn("[UI][WARN] Events is not an array in getEventsWithResponseStatus:", events);
      return [];
    }

    const now = DateTime.utc();
    const eventsWithResponse: EventWithResponse[] = [];

    for (const event of events) {
      try {
        // Récupérer le statut de réponse
        let responseInfo: { hasResponse: boolean; responseId?: string; responseStatus: 'completed' | 'not_responded' | 'unknown' } = { hasResponse: false, responseId: undefined, responseStatus: 'unknown' as const };
        let responseDoc = null;
        
        if (userId) {
          try {
            responseInfo = await checkEventResponse(options.teamId, event.id, userId);
            // Récupérer le document de réponse pour obtenir status et submittedAt
            if (responseInfo.hasResponse) {
              const responseRef = doc(db, 'teams', options.teamId, 'trainings', event.id, 'responses', userId);
              const responseSnap = await getDoc(responseRef);
              if (responseSnap.exists()) {
                responseDoc = responseSnap.data();
              }
            }
          } catch (error: any) {
            const responsePath = `teams/${options.teamId}/trainings/${event.id}/responses/${userId}`;
            console.error("[CAL][QUERY] training response error", { 
              path: responsePath,
              trainingId: event.id,
              code: error?.code,
              message: error?.message,
            });
          }
        }

        // Calculer le statut du questionnaire
        const endMillis = event.endUTC ?? fsTsToMillis(event.endUtc) ?? null;
        // Vérifier si la réponse est complétée via responseDoc.status === 'completed'
        const hasCompleted = responseDoc !== null && responseDoc?.status === 'completed';
        const hasResponded = hasCompleted || responseInfo.hasResponse;
        
        // Normaliser endMillis avant de calculer l'état
        const endMillisNormalized = endMillis 
          ? (typeof endMillis === 'number' ? endMillis : Number(endMillis))
          : null;
        
        if (!endMillisNormalized || isNaN(endMillisNormalized)) {
          console.warn("[QUESTIONNAIRE][WARN] invalid endMillis for", event.id, { endMillis, endUTC: event.endUTC, endUtc: event.endUtc });
        }
        
        // Calculer l'état du questionnaire (nouveau format)
        const questionnaireState = getQuestionnaireState(endMillisNormalized, hasResponded, now);
        // Calculer le statut du questionnaire (ancien format pour compatibilité)
        const questionnaireStatus = computeQuestionnaireStatus(endMillisNormalized, hasCompleted, now);

        // Log temporaire détaillé pour vérifier que les 4 états peuvent apparaître
        const nowMillis = now.toMillis();
        const openTime = endMillisNormalized ? endMillisNormalized : null;
        const closeTime = endMillisNormalized ? endMillisNormalized + 300 * 60 * 1000 : null;
        console.log("[DBG][EVENT_STATE]", {
          id: event.id,
          title: event.title,
          endMillis: endMillisNormalized,
          endDate: endMillisNormalized ? new Date(endMillisNormalized).toISOString() : null,
          nowMillis,
          nowDate: new Date(nowMillis).toISOString(),
          openTime: openTime ? new Date(openTime).toISOString() : null,
          closeTime: closeTime ? new Date(closeTime).toISOString() : null,
          timeSinceEnd: endMillisNormalized ? (nowMillis - endMillisNormalized) / (1000 * 60) : null, // minutes depuis la fin
          hasResponded,
          questionnaireState,
          questionnaireStatus,
          isPast: endMillisNormalized ? nowMillis > endMillisNormalized : null,
          isBeforeOpen: endMillisNormalized && openTime ? nowMillis < openTime : null,
          isAfterClose: endMillisNormalized && closeTime ? nowMillis > closeTime : null,
        });

        // Calculer les fenêtres temporelles
        let questionnaireOpenAt: number | undefined;
        let questionnaireCloseAt: number | undefined;
        if (endMillisNormalized) {
          const { openAt, closeAt } = getQuestionnaireWindowFromEnd(endMillisNormalized);
          questionnaireOpenAt = openAt.toMillis();
          questionnaireCloseAt = closeAt.toMillis();
        }

        // Calculer startMillis explicitement pour les composants UI
        const startMillis = event.startUTC ?? fsTsToMillis(event.startUtc) ?? null;
        
        eventsWithResponse.push({
          ...event,
          // Inclure explicitement startMillis et endMillis pour les composants UI
          startMillis: startMillis ?? (event.startDate ? event.startDate.getTime() : null),
          endMillis: endMillisNormalized ?? (event.endDate ? event.endDate.getTime() : null),
          hasResponse: responseInfo.hasResponse,
          responseId: responseInfo.responseId,
          responseStatus: responseInfo.responseStatus,
          response: responseInfo.hasResponse && responseDoc
            ? {
                status: responseDoc.status as 'completed' | undefined,
                submittedAt: responseDoc.submittedAt as Timestamp | undefined,
                completedAt: responseDoc.completedAt as Timestamp | undefined,
              }
            : null,
          questionnaireStatus,
          questionnaireState,
          questionnaireOpenAt,
          questionnaireCloseAt,
        });
      } catch (error: any) {
        const responsePath = `teams/${options.teamId}/trainings/${event.id}/responses/${userId || 'unknown'}`;
        console.error("[CAL][QUERY] training processing error", { 
          path: responsePath,
          trainingId: event.id,
          code: error?.code,
          message: error?.message,
        });
        // Continuer l'affichage avec status par défaut
        const endMillis = event.endUTC ?? fsTsToMillis(event.endUtc) ?? null;
        const endMillisNormalized = endMillis 
          ? (typeof endMillis === 'number' ? endMillis : Number(endMillis))
          : null;
        
        if (!endMillisNormalized || isNaN(endMillisNormalized)) {
          console.warn("[QUESTIONNAIRE][WARN] invalid endMillis in error handler for", event.id, { endMillis, endUTC: event.endUTC, endUtc: event.endUtc });
        }
        
        const questionnaireState = getQuestionnaireState(endMillisNormalized, false, now);
        const questionnaireStatus = computeQuestionnaireStatus(endMillisNormalized, false, now);
        let questionnaireOpenAt: number | undefined;
        let questionnaireCloseAt: number | undefined;
        if (endMillisNormalized) {
          const { openAt, closeAt } = getQuestionnaireWindowFromEnd(endMillisNormalized);
          questionnaireOpenAt = openAt.toMillis();
          questionnaireCloseAt = closeAt.toMillis();
        }
        
        // Log temporaire pour vérifier que les 4 états peuvent apparaître
        console.log("[DBG][EVENT_STATE][ERROR]", {
          id: event.id,
          title: event.title,
          endMillis: endMillisNormalized,
          hasResponded: false,
          questionnaireState,
          questionnaireStatus,
        });
        
        // Calculer startMillis et endMillis explicitement pour les composants UI
        const startMillis = event.startUTC ?? fsTsToMillis(event.startUtc) ?? null;
        
        eventsWithResponse.push({
          ...event,
          // Inclure explicitement startMillis et endMillis pour les composants UI
          startMillis: startMillis ?? (event.startDate ? event.startDate.getTime() : null),
          endMillis: endMillisNormalized ?? (event.endDate ? event.endDate.getTime() : null),
          hasResponse: false,
          responseStatus: 'unknown',
          response: null,
          questionnaireStatus,
          questionnaireState,
          questionnaireOpenAt,
          questionnaireCloseAt,
        });
      }
    }

    console.log("[CAL][QUERY] trainings with response status", { 
      path: `teams/${options.teamId}/trainings`,
      count: eventsWithResponse.length 
    });
    return eventsWithResponse;
  } catch (error: any) {
    const path = `teams/${options.teamId}/trainings`;
    console.error("[CAL][QUERY] getEventsWithResponseStatus error", { 
      path, 
      code: error?.code,
      message: error?.message,
      error 
    });
    return [];
  }
}

/**
 * Query les trainings pour une semaine
 * Utilise la collection 'trainings' (pas 'events')
 */
export async function getEventsForWeek(
  teamId: string,
  weekStart: Date,
  userId: string
): Promise<EventWithResponse[]> {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  
  console.log("[CAL][QUERY] getEventsForWeek", { 
    teamId, 
    weekStart: new Date(weekStart.getTime()),
    weekEnd: new Date(weekEnd.getTime()),
    userId 
  });
  
  return getEventsWithResponseStatus({
    teamId,
    startDate: weekStart,
    endDate: weekEnd,
    timeZone: 'Europe/Paris'
  }, userId);
}

// Legacy compatibility: re-export signature expecting (teamId, date, userId)
export async function getEventsForDayLegacy(
  teamId: string,
  date: Date,
  userId: string
): Promise<EventWithResponse[]> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  console.log('[CAL][QUERY] getEventsForDayLegacy', {
    teamId,
    date: new Date(date.getTime()),
    dayStart: new Date(dayStart.getTime()),
    dayEnd: new Date(dayEnd.getTime()),
    dayStartISO: dayStart.toISOString(),
    dayEndISO: dayEnd.toISOString(),
    userId,
  });

  // Query a wider range to ensure we catch all events that overlap with the day
  // We query events that start up to 24 hours before the day (to catch events that span into the day)
  // and up to the end of the day
  const queryStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000); // 24 hours before day start
  const queryEnd = dayEnd;

  console.log('[CAL][QUERY] getEventsForDayLegacy - expanded query range', {
    queryStart: queryStart.toISOString(),
    queryEnd: queryEnd.toISOString(),
  });

  return getEventsWithResponseStatus(
    {
      teamId,
      startDate: queryStart,
      endDate: queryEnd,
      timeZone: 'Europe/Paris',
    },
    userId
  );
}

/**
 * Query les trainings pour un mois
 * Utilise la collection 'trainings' (pas 'events')
 */
export async function getEventsForMonth(
  teamId: string,
  monthStart: Date,
  userId: string
): Promise<EventWithResponse[]> {
  const monthEnd = endOfMonth(monthStart);
  
  console.log("[CAL][QUERY] getEventsForMonth", { 
    teamId, 
    monthStart: new Date(monthStart.getTime()),
    monthEnd: new Date(monthEnd.getTime()),
    userId 
  });
  
  return getEventsWithResponseStatus({
    teamId,
    startDate: monthStart,
    endDate: monthEnd,
    timeZone: 'Europe/Paris'
  }, userId);
}

export async function getUpcomingTrainings(
  teamId: string,
  userId: string,
  limitCount = 3,
  rangeDays = 30
): Promise<EventWithResponse[]> {
  try {
    if (!teamId || !userId) {
      console.log('📅 Missing teamId or userId for getUpcomingTrainings');
      return [];
    }

    const nowMillis = Date.now();
    const startDate = new Date(nowMillis - 24 * 60 * 60 * 1000); // Inclure les trainings passés récents
    const endDate = new Date(nowMillis + rangeDays * 24 * 60 * 60 * 1000);

    console.log("[CAL][QUERY] get upcoming trainings", { 
      path: `teams/${teamId}/trainings`, 
      startDate, 
      endDate, 
      operation: "query",
      teamId,
      limitCount 
    });

    // Utiliser getEventsWithResponseStatus qui calcule déjà questionnaireStatus
    const allEvents = await getEventsWithResponseStatus(
      {
        teamId,
        startDate,
        endDate,
      },
      userId
    );
    // Exclure les sessions de test (créées par testNotificationFlow)
    const events = allEvents.filter(ev => !(ev as any).isTestSession && !(ev as any).isTest);

    // Filtrer selon les règles d'affichage :
    // - Training futur → Coming Soon (à afficher)
    // - Training passé < 30 min → Respond (à afficher)
    // - Training passé entre 30 min et 5h → Expired (ne pas afficher)
    // - Training passé > 5h → Expired (ne pas afficher)
    // - Questionnaire rempli → Completed (peut être affiché)
    // IMPORTANT: Utiliser uniquement questionnaireState (pas de fallback)
    // IMPORTANT: TOUS les événements avec questionnaireState === 'respond' doivent être inclus
    const allRespond = events.filter(ev => {
      if (!ev.questionnaireState) {
        console.warn("[UPCOMING][FILTER][WARN] questionnaireState missing for", ev.id, ev.title, "excluding from pending");
        return false;
      }
      return ev.questionnaireState === 'respond';
    }).sort((a, b) => (a.endMillis ?? 0) - (b.endMillis ?? 0));

    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const recentlyCompleted = events.filter(ev => {
      if (!ev.questionnaireState || ev.questionnaireState !== 'completed') {
        return false;
      }
      // Inclure uniquement les sessions complétées récemment (moins de 5 minutes)
      const completedAt = ev.response?.completedAt;
      if (!completedAt) return false;
      const completedAtMillis = typeof completedAt === 'number' 
        ? completedAt 
        : (typeof completedAt?.toMillis === 'function' ? completedAt.toMillis() : completedAt.seconds * 1000);
      const ageMs = nowMillis - completedAtMillis;
      return ageMs <= FIVE_MINUTES_MS && ageMs >= 0;
    }).sort((a, b) => (a.endMillis ?? 0) - (b.endMillis ?? 0));

    const otherPending = events.filter(ev => {
      if (!ev.questionnaireState) {
        return false;
      }
      const state: QuestionnaireState = ev.questionnaireState;
      // Inclure : 'comingSoon', mais exclure 'completed' qui est déjà dans recentlyCompleted
      // et 'respond' qui est déjà dans allRespond
      return state === 'comingSoon';
    }).sort((a, b) => {
      return (a.endMillis ?? 0) - (b.endMillis ?? 0);
    });

    // Combiner: TOUS les 'respond' + TOUTES les sessions complétées récemment + autres jusqu'à la limite
    const combined = [
      ...allRespond,
      ...recentlyCompleted, // Toujours inclure toutes les sessions complétées récemment
      ...otherPending.slice(0, Math.max(0, limitCount - allRespond.length - recentlyCompleted.length))
    ];

    if (combined.length > 0) {
      console.log("[CAL][QUERY] upcoming trainings", { 
        respondCount: allRespond.length,
        recentlyCompletedCount: recentlyCompleted.length,
        otherCount: otherPending.length,
        totalCount: combined.length 
      });
      return combined;
    }

    // Sinon, prochains trainings à venir
    const upcoming = events
      .filter(ev => ev.startMillis > nowMillis)
      .sort((a, b) => a.startMillis - b.startMillis);

    console.log("[CAL][QUERY] upcoming trainings (next upcoming)", { count: upcoming.length });
    return upcoming.slice(0, limitCount);
  } catch (error: any) {
    const path = `teams/${teamId}/trainings`;
    console.error('[CAL][QUERY] upcoming trainings error', { 
      path, 
      code: error?.code,
      message: error?.message,
      error 
    });
    return [];
  }
}

/**
 * Filtre les événements par jour de la semaine (mardi et jeudi)
 */
export function filterEventsByDayOfWeek(events: EventWithResponse[]): EventWithResponse[] {
  return events.filter(event => {
    const eventDate =
      event.startDate instanceof Date
        ? event.startDate
        : new Date(event.startUTC);
    const dayOfWeek = eventDate.getDay();
    return dayOfWeek === 2 || dayOfWeek === 4; // Mardi ou jeudi
  });
}

/**
 * Query la prochaine session (next training)
 * Utilise la collection 'trainings' (pas 'events')
 */
export async function getNextSession(
  teamId: string, 
  userId: string
): Promise<EventWithResponse | null> {
  try {
    const nowTimestamp = Timestamp.fromMillis(Date.now());
    const from = nowTimestamp.toMillis();
    const path = `teams/${teamId}/trainings`;
    
    console.log("[CAL][QUERY] get next session", { 
      path, 
      from: new Date(from),
      operation: "query",
      teamId 
    });
    
    const trainingsRef = collection(db, 'teams', String(teamId), 'trainings');
    const q = query(
      trainingsRef,
      where('startUtc', '>=', nowTimestamp),
      orderBy('startUtc', 'asc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    console.log('[CAL][QUERY] next session query result', { 
      path, 
      size: snapshot.size,
      from: new Date(from)
    });
    
    snapshot.docs.slice(0, 1).forEach((docSnap) => {
      const raw = docSnap.data();
      const ms = fsTsToMillis(raw?.startUtc);
      const tz = raw?.displayTz || 'Europe/Paris';
      const local = utcMillisToLocal(ms, tz)?.toFormat('dd MMM HH:mm') ?? 'NULL';
      console.log('[CAL][QUERY][ITEM]', docSnap.id, {
        title: raw?.title,
        tz,
        ms,
        local,
        startUtc: raw?.startUtc?.toMillis?.() ?? null,
        endUtc: raw?.endUtc?.toMillis?.() ?? null,
      });
    });
    
    if (snapshot.empty) {
      console.log(`[CAL][QUERY] no next session found`, { path });
      return null;
    }
    
    const eventDoc = snapshot.docs[0];
    const eventData = adaptTrainingSnapshot(eventDoc);
    if (!eventData) {
      console.log('[CAL][QUERY] next session could not be mapped', { 
        path, 
        docId: eventDoc.id 
      });
      return null;
    }
    
    // Vérifier si l'utilisateur a déjà répondu
    let responseInfo: { hasResponse: boolean; responseId?: string; responseStatus: 'completed' | 'not_responded' | 'unknown' } = { hasResponse: false, responseId: undefined, responseStatus: 'unknown' as const };
    let responseDoc = null;
    try {
      responseInfo = await checkEventResponse(teamId, eventDoc.id, userId);
      // Récupérer le document de réponse pour obtenir status et submittedAt
      if (responseInfo.hasResponse) {
        const responseRef = doc(db, 'teams', teamId, 'trainings', eventDoc.id, 'responses', userId);
        const responseSnap = await getDoc(responseRef);
        if (responseSnap.exists()) {
          responseDoc = responseSnap.data();
        }
      }
    } catch (error: any) {
      console.error('[CAL][QUERY] next session response error', { 
        path: `teams/${teamId}/trainings/${eventDoc.id}/responses/${userId}`,
        code: error?.code,
        message: error?.message,
        error 
      });
    }
    
    // Calculer le statut du questionnaire
    const endMillis = eventData.endUTC ?? fsTsToMillis(eventData.endUtc) ?? null;
    const endMillisNormalized = endMillis 
      ? (typeof endMillis === 'number' ? endMillis : Number(endMillis))
      : null;
    
    if (!endMillisNormalized || isNaN(endMillisNormalized)) {
      console.warn("[QUESTIONNAIRE][WARN] invalid endMillis for next session", eventDoc.id, { endMillis, endUTC: eventData.endUTC, endUtc: eventData.endUtc });
    }
    
    // Vérifier si la réponse est complétée via responseDoc.status === 'completed'
    const hasCompleted = responseDoc !== null && responseDoc?.status === 'completed';
    const hasResponded = hasCompleted || responseInfo.hasResponse;
    
    // Calculer l'état du questionnaire (nouveau format)
    const now = DateTime.utc();
    const questionnaireState = getQuestionnaireState(endMillisNormalized, hasResponded, now);
    // Calculer le statut du questionnaire (ancien format pour compatibilité)
    const questionnaireStatus = computeQuestionnaireStatus(endMillisNormalized, hasCompleted, now);
    
    // Calculer les fenêtres temporelles
    let questionnaireOpenAt: number | undefined;
    let questionnaireCloseAt: number | undefined;
    if (endMillisNormalized) {
      const { openAt, closeAt } = getQuestionnaireWindowFromEnd(endMillisNormalized);
      questionnaireOpenAt = openAt.toMillis();
      questionnaireCloseAt = closeAt.toMillis();
    }
    
    // Calculer startMillis et endMillis explicitement pour les composants UI
    const startMillis = eventData.startUTC ?? fsTsToMillis(eventData.startUtc) ?? null;
    
    const nextEvent: EventWithResponse = {
      ...eventData,
      // Inclure explicitement startMillis et endMillis pour les composants UI
      startMillis: startMillis ?? (eventData.startDate ? eventData.startDate.getTime() : null),
      endMillis: endMillisNormalized ?? (eventData.endDate ? eventData.endDate.getTime() : null),
      hasResponse: responseInfo.hasResponse,
      responseId: responseInfo.responseId,
      responseStatus: responseInfo.responseStatus,
      response: responseInfo.hasResponse && responseDoc
        ? {
            status: responseDoc.status as 'completed' | undefined,
            submittedAt: responseDoc.submittedAt as Timestamp | undefined,
            completedAt: responseDoc.completedAt as Timestamp | undefined,
          }
        : null,
      questionnaireStatus,
      questionnaireState,
      questionnaireOpenAt,
      questionnaireCloseAt,
    };
    const nextLocal = utcMillisToLocal(
      fsTsToMillis(nextEvent.startUtc) ?? nextEvent.startUTC ?? null,
      nextEvent.displayTz || nextEvent.timeZone || 'Europe/Paris'
    );
    
    console.log(
      `[CAL][QUERY] next session found`, { 
        path,
        id: nextEvent.id,
        startUTC: nextEvent.startUTC, 
        tz: nextEvent.timeZone, 
        local: nextLocal?.toFormat('dd MMM HH:mm'),
        hasResponse: nextEvent.hasResponse,
        responseStatus: nextEvent.responseStatus,
        questionnaireState: nextEvent.questionnaireState,
        questionnaireStatus: nextEvent.questionnaireStatus
      }
    );
    return nextEvent;
    
  } catch (error: any) {
    const path = `teams/${teamId}/trainings`;
    console.error('[CAL][QUERY] next session error', { 
      path, 
      code: error?.code,
      message: error?.message,
      error 
    });
    return null;
  }
}
