/**
 * DARRawChart.tsx
 * Raw score chart — timeline (bars + EMA dashed line + Q1/Q2/Q3 reference lines)
 *                 or per-player workload bars + Q1/Q2/Q3.
 */

import React, { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { DARDataPoint } from '../utils/useDARAlgorithm';
import { DAR_COLORS } from '../utils/useDARAlgorithm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerWorkload {
  player: string;
  workloadAU: number;
}

interface DARRawChartProps {
  mode: 'timeline' | 'byPlayer';
  timelineData?: DARDataPoint[];
  playerData?: PlayerWorkload[];
  height?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function fmtDateTick(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function TimelineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DARDataPoint;
  return (
    <div style={{
      background: '#0D1526',
      border: '1px solid rgba(0,212,255,0.20)',
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: "'DM Sans', system-ui",
      fontSize: 12,
      minWidth: 160,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.50)', marginBottom: 8, fontSize: 11 }}>
        {fmtDateTick(label ?? '')}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
        <span style={{ color: 'rgba(255,255,255,0.55)' }}>Raw Score</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{d?.rawScore ?? '—'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
        <span style={{ color: 'rgba(255,255,255,0.55)' }}>Baseline (EMA)</span>
        <span style={{ color: 'rgba(255,255,255,0.80)' }}>{d?.ema != null ? Math.round(d.ema) : '—'}</span>
      </div>
      {d?.deviation != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>Deviation</span>
          <span style={{ color: d.deviation > 0 ? DAR_COLORS.YELLOW : DAR_COLORS.BLUE, fontWeight: 600 }}>
            {d.deviation > 0 ? '+' : ''}{d.deviation}%
          </span>
        </div>
      )}
    </div>
  );
}

function PlayerTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value as number;
  return (
    <div style={{
      background: '#0D1526',
      border: '1px solid rgba(0,212,255,0.20)',
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: "'DM Sans', system-ui",
      fontSize: 12,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.50)', marginBottom: 6, fontSize: 11 }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: 'rgba(255,255,255,0.55)' }}>Workload AU</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{Math.round(val)}</span>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DARRawChart({
  mode,
  timelineData = [],
  playerData = [],
  height = 280,
}: DARRawChartProps) {
  const timelineQuartiles = useMemo(() => {
    const scores = timelineData
      .filter((d) => d.rawScore !== null)
      .map((d) => d.rawScore as number);
    if (scores.length < 4) return null;
    return {
      q1: Math.round(percentile(scores, 25)),
      q2: Math.round(percentile(scores, 50)),
      q3: Math.round(percentile(scores, 75)),
    };
  }, [timelineData]);

  const playerQuartiles = useMemo(() => {
    const values = playerData.map((p) => p.workloadAU);
    if (values.length < 4) return null;
    return {
      q1: Math.round(percentile(values, 25)),
      q2: Math.round(percentile(values, 50)),
      q3: Math.round(percentile(values, 75)),
    };
  }, [playerData]);

  const timelineInterval = useMemo(
    () => Math.max(Math.floor(timelineData.length / 10), 6),
    [timelineData.length]
  );

  if (mode === 'timeline' && timelineData.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.22)', fontSize: 12, fontStyle: 'italic' }}>
        No data
      </div>
    );
  }

  if (mode === 'byPlayer' && playerData.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.22)', fontSize: 12, fontStyle: 'italic' }}>
        No data
      </div>
    );
  }

  // ── Timeline mode ─────────────────────────────────────────────────────────
  if (mode === 'timeline') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={timelineData}
          margin={{ top: 4, right: 4, left: -8, bottom: 24 }}
          barCategoryGap="20%"
        >
          <CartesianGrid horizontal vertical={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDateTick}
            tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            interval={timelineInterval}
            angle={-30}
            textAnchor="end"
          />
          <YAxis
            type="number"
            domain={[0, 100]}
            reversed={false}
            allowDataOverflow={false}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip content={<TimelineTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          {timelineQuartiles && (
            <>
              <ReferenceLine y={timelineQuartiles.q1} stroke="rgba(255,255,255,0.20)" strokeDasharray="3 3" label={{ value: 'Q1', fill: 'rgba(255,255,255,0.28)', fontSize: 8, position: 'insideTopRight' }} />
              <ReferenceLine y={timelineQuartiles.q2} stroke="rgba(0,212,255,0.40)" strokeDasharray="4 2" label={{ value: 'Q2', fill: 'rgba(0,212,255,0.55)', fontSize: 8, position: 'insideTopRight' }} />
              <ReferenceLine y={timelineQuartiles.q3} stroke="rgba(255,255,255,0.20)" strokeDasharray="3 3" label={{ value: 'Q3', fill: 'rgba(255,255,255,0.28)', fontSize: 8, position: 'insideTopRight' }} />
            </>
          )}
          <Bar
            dataKey="rawScore"
            maxBarSize={14}
            radius={[2, 2, 0, 0] as any}
            isAnimationActive={false}
          >
            {timelineData.map((d, i) => (
              <Cell
                key={i}
                fill={d.zone === 'INSUFFICIENT_DATA' ? 'rgba(255,255,255,0.10)' : DAR_COLORS[d.zone]}
                fillOpacity={d.rawScore === null ? 0 : 0.85}
              />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="ema"
            stroke="rgba(255,255,255,0.40)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  // ── byPlayer mode ─────────────────────────────────────────────────────────
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={playerData}
        margin={{ top: 4, right: 4, left: -8, bottom: 40 }}
        barCategoryGap="20%"
      >
        <CartesianGrid horizontal vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="player"
          tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-30}
          textAnchor="end"
        />
        <YAxis
          type="number"
          tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          width={34}
        />
        <Tooltip content={<PlayerTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {playerQuartiles && (
          <>
            <ReferenceLine y={playerQuartiles.q1} stroke="rgba(255,255,255,0.20)" strokeDasharray="3 3" label={{ value: 'Q1', fill: 'rgba(255,255,255,0.28)', fontSize: 8, position: 'insideTopRight' }} />
            <ReferenceLine y={playerQuartiles.q2} stroke="rgba(0,212,255,0.40)" strokeDasharray="4 2" label={{ value: 'Q2', fill: 'rgba(0,212,255,0.55)', fontSize: 8, position: 'insideTopRight' }} />
            <ReferenceLine y={playerQuartiles.q3} stroke="rgba(255,255,255,0.20)" strokeDasharray="3 3" label={{ value: 'Q3', fill: 'rgba(255,255,255,0.28)', fontSize: 8, position: 'insideTopRight' }} />
          </>
        )}
        <Bar dataKey="workloadAU" maxBarSize={20} radius={[2, 2, 0, 0] as any} isAnimationActive={false} fill={DAR_COLORS.GREEN} fillOpacity={0.85} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
