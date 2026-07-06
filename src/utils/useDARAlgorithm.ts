/**
 * useDARAlgorithm.ts — DAR (Dynamic Adaptive Reserve) Zone-based EMA methodology
 *
 * Classifies each daily score as GREEN / BLUE / YELLOW based on its
 * deviation from a 28-day Exponential Moving Average (EMA) baseline.
 * Missing days carry the EMA forward without breaking the baseline.
 */

import { extractV2Metrics } from './analytics';
import type { RawResponse } from './analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DARZone = 'GREEN' | 'BLUE' | 'YELLOW' | 'INSUFFICIENT_DATA';

export interface DailyLog {
  date: string;       // ISO date 'YYYY-MM-DD'
  rawScore: number | null; // null = athlete missed that day
}

export interface DARDataPoint {
  date: string;
  rawScore: number | null;
  ema: number;
  deviation: number | null; // percentage deviation from EMA
  zone: DARZone;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DAR_COLORS: Record<DARZone, string> = {
  GREEN:             '#00C853',
  BLUE:              '#2196F3',
  YELLOW:            '#FFB800',
  INSUFFICIENT_DATA: 'rgba(255,255,255,0.15)',
};

const EMA_WINDOW       = 28;
const YELLOW_THRESHOLD = 15;   // deviation > +15% → YELLOW
const BLUE_THRESHOLD   = -15;  // deviation < -15% → BLUE
const MIN_DATA_POINTS  = 3;    // below this → INSUFFICIENT_DATA for all points

// ─── Core Algorithm ───────────────────────────────────────────────────────────

/**
 * Step A: EMA calculation with carry-forward on null days.
 * Step B: Deviation = ((rawScore - ema) / ema) × 100, rounded to 1 decimal.
 * Step C: Zone classification by threshold comparison.
 */
export function processDARData(
  logs: DailyLog[],
  windowSize = EMA_WINDOW
): DARDataPoint[] {
  if (logs.length === 0) return [];

  const alpha = 2 / (windowSize + 1); // ≈ 0.0690 for 28-day window

  const nonNullCount = logs.filter((l) => l.rawScore !== null).length;
  const insufficientData = nonNullCount < MIN_DATA_POINTS;

  // Seed EMA with first non-null rawScore
  let currentEma = 50; // fallback if all null
  for (const log of logs) {
    if (log.rawScore !== null) {
      currentEma = log.rawScore;
      break;
    }
  }

  const result: DARDataPoint[] = [];

  for (const log of logs) {
    if (log.rawScore !== null) {
      // Standard EMA update
      currentEma = parseFloat(
        (log.rawScore * alpha + currentEma * (1 - alpha)).toFixed(2)
      );
    }
    // null rawScore → EMAₜ = EMAₜ₋₁ (carry forward, baseline unbroken)

    let deviation: number | null = null;
    let zone: DARZone;

    if (log.rawScore === null || insufficientData) {
      zone = 'INSUFFICIENT_DATA';
    } else {
      deviation = parseFloat(
        (((log.rawScore - currentEma) / currentEma) * 100).toFixed(1)
      );
      if (deviation > YELLOW_THRESHOLD) zone = 'YELLOW';
      else if (deviation < BLUE_THRESHOLD) zone = 'BLUE';
      else zone = 'GREEN';
    }

    result.push({
      date: log.date,
      rawScore: log.rawScore,
      ema: parseFloat(currentEma.toFixed(1)),
      deviation,
      zone,
    });
  }

  return result;
}

// ─── Response → DailyLog Converter ───────────────────────────────────────────

export type MetricExtractor = (r: RawResponse) => number | null;

function toDateKey(r: RawResponse): string | null {
  const s = r.submittedAt;
  if (!s) return null;
  const dt =
    typeof s.toDate === 'function' ? s.toDate() : new Date(s);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

/**
 * Converts RawResponse[] into a continuous daily log, then runs DAR algorithm.
 * Accepts a custom extractor to support single metrics and compound averages.
 * Days with no response are filled with rawScore = null (EMA carries forward).
 */
export function getDARDataForResponses(
  responses: RawResponse[],
  extractor: MetricExtractor,
  windowSize = EMA_WINDOW
): DARDataPoint[] {
  // Aggregate by date (average multiple responses on same day)
  const byDate: Record<string, number[]> = {};

  for (const r of responses) {
    const value = extractor(r);
    if (value === null || value === undefined) continue;
    const dateKey = toDateKey(r);
    if (!dateKey) continue;
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(value);
  }

  const dates = Object.keys(byDate).sort();
  if (dates.length === 0) return [];

  // Fill continuous date range — gaps become rawScore: null
  const logs: DailyLog[] = [];
  const cur = new Date(dates[0] + 'T12:00:00Z');
  const end = new Date(dates[dates.length - 1] + 'T12:00:00Z');

  while (cur <= end) {
    const dateKey = cur.toISOString().slice(0, 10);
    const vals = byDate[dateKey];
    const avg =
      vals && vals.length > 0
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        : null;
    logs.push({ date: dateKey, rawScore: avg });
    cur.setDate(cur.getDate() + 1);
  }

  return processDARData(logs, windowSize);
}

/**
 * Convenience wrapper: extracts a single named metric from a response
 * using extractV2Metrics(), then runs the DAR algorithm.
 * Handles both V2 (1-10 scale → scaled to 1-100) and V3 (1-100 native).
 */
export function getDARZoneForMetric(
  responses: RawResponse[],
  metric: string,
  windowSize = EMA_WINDOW
): DARDataPoint[] {
  const extractor: MetricExtractor = (r) => {
    // V3: check r.metrics directly (1-100 scale)
    if (r.metrics) {
      const v = (r.metrics as any)[metric];
      if (typeof v === 'number') {
        // V3 values are 1-100 (> 10), V2 are 1-10
        return v > 10 ? v : Math.round(((v - 1) / 9) * 99 + 1);
      }
    }
    // V2 fallback via extractV2Metrics
    const m2 = extractV2Metrics(r);
    if (m2) {
      const v = (m2 as any)[metric];
      if (typeof v === 'number') {
        return Math.round(((v - 1) / 9) * 99 + 1); // 1-10 → 1-100
      }
    }
    return null;
  };

  return getDARDataForResponses(responses, extractor, windowSize);
}
