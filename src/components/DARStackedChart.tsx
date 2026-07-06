/**
 * DARStackedChart.tsx
 * 100% stacked bar chart — zone distribution per day (timeline) or per player.
 * Segments (bottom→top): BLUE (Under-load) → GREEN (Normal) → YELLOW (Spike).
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts';
import { DAR_COLORS } from '../utils/useDARAlgorithm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StackedZonePoint {
  key: string;       // ISO date (timeline) or short player name (byPlayer)
  blue: number;      // % in Under-load zone
  green: number;     // % in Normal zone
  yellow: number;    // % in Spike zone
  total: number;     // number of data points contributing
  // single-player timeline only:
  value?: number;    // always 100 when singlePlayer mode
  zoneLabel?: string; // 'N' | 'U' | 'S'
  zone?: 'GREEN' | 'BLUE' | 'YELLOW';
}

interface DARStackedChartProps {
  data: StackedZonePoint[];
  mode: 'timeline' | 'byPlayer';
  singlePlayer?: boolean;
  height?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTick(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function StackedTooltip({ active, payload, label, mode }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as StackedZonePoint;
  const displayLabel = mode === 'timeline' ? fmtDateTick(label ?? '') : (label ?? '');

  return (
    <div style={{
      background: '#0D1526',
      border: '1px solid rgba(0,212,255,0.20)',
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: "'DM Sans', system-ui",
      fontSize: 12,
      minWidth: 152,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.50)', marginBottom: 8, fontSize: 11 }}>
        {displayLabel}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
        <span style={{ color: DAR_COLORS.BLUE }}>Under-load</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{Math.round(d?.blue ?? 0)}%</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
        <span style={{ color: DAR_COLORS.GREEN }}>Normal</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{Math.round(d?.green ?? 0)}%</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: DAR_COLORS.YELLOW }}>Spike</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{Math.round(d?.yellow ?? 0)}%</span>
      </div>
      {d?.total != null && (
        <div style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10, marginTop: 6 }}>
          {mode === 'timeline'
            ? `${d.total} athlete${d.total !== 1 ? 's' : ''}`
            : `${d.total} sessions`}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DARStackedChart({
  data,
  mode,
  singlePlayer = false,
  height = 280,
}: DARStackedChartProps) {
  if (data.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.22)', fontSize: 12, fontStyle: 'italic',
      }}>
        No data
      </div>
    );
  }

  const interval = mode === 'timeline'
    ? Math.max(Math.floor(data.length / 10), 6)
    : 0;

  const xTickFmt = (key: string) =>
    mode === 'timeline' ? fmtDateTick(key) : key;

  // ── Single-player: each bar is full height colored by zone ─────────────────
  if (singlePlayer) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: -8, bottom: mode === 'byPlayer' ? 40 : 24 }}
          barCategoryGap="20%"
        >
          <CartesianGrid horizontal vertical={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="key"
            tickFormatter={xTickFmt}
            tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            interval={interval}
            angle={-30}
            textAnchor="end"
          />
          <YAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <Tooltip
            content={<StackedTooltip mode={mode} />}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar
            dataKey="value"
            maxBarSize={20}
            radius={[2, 2, 0, 0] as any}
            isAnimationActive={false}
          >
            {data.map((d, i) => {
              const fill =
                d.zone === 'BLUE'   ? DAR_COLORS.BLUE   :
                d.zone === 'YELLOW' ? DAR_COLORS.YELLOW :
                                      DAR_COLORS.GREEN;
              return <Cell key={i} fill={fill} fillOpacity={0.85} />;
            })}
            <LabelList
              dataKey="zoneLabel"
              position="inside"
              style={{
                fill: 'rgba(255,255,255,0.75)',
                fontSize: 9,
                fontFamily: "'Space Mono', monospace",
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ── Team stacked: BLUE → GREEN → YELLOW ────────────────────────────────────
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 4, left: -8, bottom: mode === 'byPlayer' ? 40 : 24 }}
        barCategoryGap="20%"
      >
        <CartesianGrid horizontal vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="key"
          tickFormatter={xTickFmt}
          tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          interval={interval}
          angle={-30}
          textAnchor="end"
        />
        <YAxis
          type="number"
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={35}
        />
        <Tooltip
          content={<StackedTooltip mode={mode} />}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />

        <Bar dataKey="blue"   name="Under-load" stackId="z" fill={DAR_COLORS.BLUE}   maxBarSize={20} isAnimationActive={false}>
          <LabelList
            dataKey="blue"
            position="center"
            formatter={(v: any) => (typeof v === 'number' && v > 8 ? `${Math.round(v)}%` : '')}
            style={{ fill: 'rgba(255,255,255,0.85)', fontSize: 9, fontFamily: "'Space Mono', monospace" }}
          />
        </Bar>
        <Bar dataKey="green"  name="Normal"     stackId="z" fill={DAR_COLORS.GREEN}  maxBarSize={20} isAnimationActive={false}>
          <LabelList
            dataKey="green"
            position="center"
            formatter={(v: any) => (typeof v === 'number' && v > 8 ? `${Math.round(v)}%` : '')}
            style={{ fill: 'rgba(255,255,255,0.85)', fontSize: 9, fontFamily: "'Space Mono', monospace" }}
          />
        </Bar>
        <Bar dataKey="yellow" name="Spike"      stackId="z" fill={DAR_COLORS.YELLOW} maxBarSize={20} radius={[2, 2, 0, 0] as any} isAnimationActive={false}>
          <LabelList
            dataKey="yellow"
            position="center"
            formatter={(v: any) => (typeof v === 'number' && v > 8 ? `${Math.round(v)}%` : '')}
            style={{ fill: 'rgba(255,255,255,0.85)', fontSize: 9, fontFamily: "'Space Mono', monospace" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
