/**
 * analytics.ts — Shared analytics utilities (DEC-13)
 * Extracted from PerformanceDashboard.tsx and AthleteDetailScreen.tsx
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface V2Metrics {
  cardioLoad?: number;
  neuroLoad?: number;
  sleepQuality?: number;
  stressLevel?: number;
  motorControl?: number | null;
  tacticalLucidity?: number | null;
  sessionRPE?: number;
}

export interface RawResponse {
  userId: string;
  teamId: string;
  trainingId?: string;
  submittedAt?: any;
  status?: string;
  isTest?: boolean;
  // V1 French fields (legacy)
  intensiteMoyenne?: number;
  hautesIntensites?: number;
  impactCardiaque?: number;
  impactMusculaire?: number;
  fatigue?: number;
  concentration?: number;
  confiance?: number;
  bienEtre?: number;
  nervosite?: number;
  sommeil?: number;
  technique?: number;
  tactique?: number;
  dynamisme?: number;
  values?: { [key: string]: number | undefined };
  // V2 fields
  metrics?: V2Metrics;
  readinessScore?: number;
  workloadAU?: number;
  sessionType?: string;
  [key: string]: any;
}

// ─── EMA ──────────────────────────────────────────────────────────────────────

/**
 * Calculate Exponential Moving Average for a series.
 * @param values  Input series; null entries carry forward the previous EMA.
 * @param N       Window size (e.g. 7 for acute, 28 for chronic).
 * @returns       EMA array of the same length. Seeded with first non-null value or 5.
 */
export function calculateEMA(values: (number | null)[], N: number): number[] {
  const alpha = 2 / (N + 1);
  const ema: number[] = [];
  values.forEach((v, i) => {
    if (i === 0) {
      ema.push(v ?? 5);
    } else {
      const prev = ema[i - 1];
      ema.push(v !== null ? parseFloat((v * alpha + prev * (1 - alpha)).toFixed(2)) : prev);
    }
  });
  return ema;
}

// ─── Deviation ────────────────────────────────────────────────────────────────

/**
 * Percentage deviation of a value from its EMA baseline.
 * ((value - ema) / ema) × 100
 */
export function calculateDeviation(value: number, ema: number): number {
  return ema === 0 ? 0 : parseFloat((((value - ema) / ema) * 100).toFixed(1));
}

// ─── Readiness Score ──────────────────────────────────────────────────────────

/**
 * Readiness Score 0-100.
 * High metric = bad → inverted: (10 - value) before weighting.
 * Weights: cardio 0.20 | neuro 0.25 | sleep 0.20 | stress 0.15 | motor 0.10 | tactical 0.10
 * tacticalLucidity defaults to stressLevel when absent.
 */
export function calculateReadiness(m: V2Metrics): number {
  const scores = {
    cardio:   (10 - (m.cardioLoad   ?? 5)) * 0.20,
    neuro:    (10 - (m.neuroLoad    ?? 5)) * 0.25,
    sleep:    (10 - (m.sleepQuality ?? 5)) * 0.20,
    stress:   (10 - (m.stressLevel  ?? 5)) * 0.15,
    motor:    (10 - (m.motorControl ?? 5)) * 0.10,
    tactical: (10 - ((m.tacticalLucidity ?? m.stressLevel) ?? 5)) * 0.10,
  };
  const weighted = Object.values(scores).reduce((a, b) => a + b, 0);
  return Math.round((weighted / 10) * 100);
}

// ─── V1 → V2 Field Mapping ────────────────────────────────────────────────────

/**
 * Extract V2Metrics from a response document.
 * Priority: V2 metrics.* fields → V1 French field fallback → undefined for missing.
 * Returns null if no metrics can be derived (completely missing data).
 * DEC-04: preserves historical V1 data in dashboard while supporting V2 schema.
 */
export function extractV2Metrics(r: RawResponse): V2Metrics | null {
  if (r.metrics) return r.metrics;

  // Check if any V1 field is present
  const hasV1 = [
    r.impactCardiaque, r.impactMusculaire, r.sommeil,
    r.nervosite, r.technique, r.tactique, r.fatigue,
  ].some((v) => v !== undefined && v !== null);

  if (!hasV1) return null;

  // Normalize V1 fields (0-100 scale) to V2 scale (1-10)
  // V1 high = bad, except sommeil (sleep) where high = good → invert
  const norm = (v: number | undefined): number | null =>
    v !== undefined && v !== null ? Math.round((v / 10) * 10) / 10 : null;
  const normInvert = (v: number | undefined): number | null =>
    v !== undefined && v !== null ? Math.round(((100 - v) / 10) * 10) / 10 : null;

  return {
    cardioLoad:       norm(r.impactCardiaque)   ?? undefined,
    neuroLoad:        norm(r.impactMusculaire)   ?? undefined,
    sleepQuality:     normInvert(r.sommeil)      ?? undefined,
    stressLevel:      norm(r.nervosite)          ?? undefined,
    motorControl:     normInvert(r.technique)    ?? undefined,
    tacticalLucidity: normInvert(r.tactique)     ?? undefined,
    sessionRPE:       norm(r.fatigue)            ?? undefined,
  };
}
