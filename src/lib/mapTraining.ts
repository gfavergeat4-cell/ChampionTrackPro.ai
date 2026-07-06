import { DocumentData, DocumentSnapshot } from 'firebase/firestore';
import { fsTsToMillis } from '../utils/time';

export type UiEvent = {
  id: string;
  teamId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  startMillis: number;
  endMillis: number;
  displayTz?: string;
};

export function mapTrainingDoc(docSnap: DocumentSnapshot<DocumentData>): UiEvent | null {
  const data = docSnap.data();
  if (!data) {
    console.warn('[MAP][WARN] training without data', docSnap.id);
    return null;
  }

  const startMs = fsTsToMillis(data.startUtc);
  const endMs = fsTsToMillis(data.endUtc);

  if (!startMs) {
    console.warn('[MAP][WARN] training without startUtc', docSnap.id, data);
    return null;
  }

  const resolvedEnd = endMs ?? (startMs + 60 * 60 * 1000);

  return {
    id: docSnap.id,
    teamId: data.teamId,
    title: data.title || data.summary || 'Événement',
    startDate: new Date(startMs),
    endDate: new Date(resolvedEnd),
    startMillis: startMs,
    endMillis: resolvedEnd,
    displayTz: data.displayTz || data.tzid || data.timeZone,
  };
}

