import { DateTime } from 'luxon';
import { Timestamp } from 'firebase/firestore';

// Types hérités (à rationaliser plus tard)
export interface EventTime {
  seconds: number;
  nanoseconds: number;
  timeZone: string;
}

export interface FirestoreEvent {
  id: string;
  teamId: string;
  summary: string;
  title?: string;
  description?: string;
  location?: string;
  startUTC: number; // milliseconds UTC
  endUTC: number; // milliseconds UTC
  timeZone: string; // ex: "Europe/Paris"
  displayTz?: string;
  originalTzid?: string | null;
  calendarTz?: string | null;
  hasUtcSuffix?: boolean;
  startLocalISO?: string; // ISO string in original timezone
  endLocalISO?: string;
  uid: string;
  rrule?: string;
  exdates?: string[];
  status?: string;
  createdAt: any;
  updatedAt: any;
  hasResponse?: boolean; // Added for client-side status
  startUtc?: Timestamp;
  endUtc?: Timestamp;
  tzid?: string;
  source?: string;
  deepLink?: string;
  players?: string[];
  startDate?: Date;
  endDate?: Date;
  responseStatus?: 'answered' | 'not_responded' | 'unknown';
}

/**
 * Convertit un timestamp UTC (milliseconds) en Date
 */
export const fromUTC = (utcMs: number): Date => {
  return new Date(utcMs);
};

/**
 * Convertit un timestamp Firestore en Date avec timezone (legacy)
 */
export const fromSeconds = (seconds: number): Date => {
  return new Date(seconds * 1000);
};

/**
 * Formate une plage horaire avec timezone
 */
export const fmtRange = (start: Date, end: Date, tz: string): string => {
  const startTime = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
    hour12: false
  }).format(start);
  
  const endTime = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
    hour12: false
  }).format(end);
  
  return `${startTime} – ${endTime}`;
};

/**
 * Formate une plage horaire à partir d'un événement Firestore
 */
export const fmtEventRangeOld = (event: FirestoreEvent): string => {
  const start = fromUTC(event.startUTC);
  const end = fromUTC(event.endUTC);
  return fmtRange(start, end, event.timeZone);
};


/**
 * Formate une date avec timezone
 */
export const fmtDate = (date: Date, tz: string): string => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: tz
  }).format(date);
};

/**
 * Formate une heure avec timezone
 */
export const fmtTime = (date: Date, tz: string): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
    hour12: false
  }).format(date);
};

/**
 * Formate une plage horaire à partir d'un événement avec startUTC/endUTC
 */
export const fmtEventRange = (ev: {startUTC: number; endUTC: number; timeZone?: string}): string => {
  const tz = ev.timeZone || 'Europe/Paris';
  const f = (ms: number) => new Intl.DateTimeFormat('fr-FR', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: tz 
  }).format(new Date(ms));
  
  return `${f(ev.startUTC)} – ${f(ev.endUTC)}`;
};

/**
 * Convertit une date en timestamp Firestore
 */
export const toFirestoreTimestamp = (date: Date): { seconds: number; nanoseconds: number } => {
  const seconds = Math.floor(date.getTime() / 1000);
  const nanoseconds = (date.getTime() % 1000) * 1000000;
  return { seconds, nanoseconds };
};

/**
 * Conversion robuste d'un champ Firestore (Timestamp/number/string) en ms UTC
 */
export function fsTsToMillis(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Convertit des millisecondes UTC vers un DateTime localisé
 */
export function utcMillisToLocal(msUtc: number | null, tz: string): DateTime | null {
  if (!msUtc || !Number.isFinite(msUtc)) return null;
  const targetTz = tz || 'Europe/Paris';
  return DateTime.fromMillis(msUtc, { zone: 'utc' }).setZone(targetTz);
}

/**
 * Force n'importe quelle valeur à être une Date JS
 * Accepte Date, DateTime (Luxon), number (millis), string
 */
export function toJSDate(d: Date | DateTime | number | string | null | undefined): Date {
  if (!d) return new Date(NaN);
  if (d instanceof Date) return d;
  
  // Luxon DateTime
  if ((d as any).isLuxonDateTime) {
    return (d as DateTime).toJSDate();
  }
  
  // Firestore Timestamp (via toDate)
  if (typeof (d as any)?.toDate === 'function') {
    const converted = (d as any).toDate();
    if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
      return converted;
    }
  }
  
  if (typeof d === 'number') return new Date(d);
  if (typeof d === 'string') {
    const parsed = Date.parse(d);
    return Number.isNaN(parsed) ? new Date(NaN) : new Date(parsed);
  }
  
  return new Date(NaN);
}

/**
 * Groupe les événements par jour
 */
export const groupEventsByDay = (events: FirestoreEvent[]): Record<string, FirestoreEvent[]> => {
  const grouped: Record<string, FirestoreEvent[]> = {};
  
  events.forEach(event => {
    const startDate = fromUTC(event.startUTC);
    const dayKey = startDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
    
    if (!grouped[dayKey]) {
      grouped[dayKey] = [];
    }
    
    grouped[dayKey].push(event);
  });
  
  // Trier les événements par heure dans chaque jour
  Object.keys(grouped).forEach(dayKey => {
    grouped[dayKey].sort((a, b) => a.startUTC - b.startUTC);
  });
  
  return grouped;
};

/**
 * Vérifie si un événement est dans une plage de dates
 */
export const isEventInRange = (event: FirestoreEvent, startDate: Date, endDate: Date): boolean => {
  const eventStart = fromUTC(event.startUTC);
  const eventEnd = fromUTC(event.endUTC);
  
  return eventStart >= startDate && eventStart < endDate;
};

/**
 * Convertit un intervalle DateTime (Luxon) en Timestamps Firestore UTC
 * Bornes inclusives pour les requêtes Firestore
 */
export function intervalToUtcTimestamps(from: DateTime, to: DateTime): { startUtc: Timestamp; endUtc: Timestamp } {
  const startUtc = Timestamp.fromMillis(from.toUTC().toMillis());
  const endUtc = Timestamp.fromMillis(to.toUTC().toMillis());
  return { startUtc, endUtc };
}
