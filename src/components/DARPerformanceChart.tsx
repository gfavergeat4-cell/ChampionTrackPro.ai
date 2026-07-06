/**
 * DARPerformanceChart.tsx
 * 2×2 quadrant container for the DAR analytics view.
 *
 * ┌─────────────────────┬─────────────────────┐
 * │  Score Relatif      │  Score Relatif      │
 * │  Évolution (TL)     │  Période (byPlayer) │
 * ├─────────────────────┼─────────────────────┤
 * │  Score Brut         │  Score Brut         │
 * │  Évolution (TL)     │  Période (workload) │
 * └─────────────────────┴─────────────────────┘
 *
 * Metric selector (top): ⚡ Physical Engine | 🧠 Mental Energy | ⚙️ Technical Execution
 * Zone distribution row (bottom): mini stacked bars per player.
 */

import React, { useMemo, useState } from 'react';
import type { RawResponse } from '../utils/analytics';
import { getDARDataForResponses, DAR_COLORS } from '../utils/useDARAlgorithm';
import type { DARDataPoint } from '../utils/useDARAlgorithm';
import DARStackedChart from './DARStackedChart';
import type { StackedZonePoint } from './DARStackedChart';
import DARRawChart from './DARRawChart';
import type { PlayerWorkload } from './DARRawChart';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  displayName?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
}

type ActiveMetric = 'physical' | 'mental' | 'technical';
type PlayerSort  = 'alpha' | 'spike';

interface DARPerformanceChartProps {
  filteredResponses: RawResponse[];
  members: Member[];
  selectedPlayerIds: string[];
}

// ─── Metric definitions ───────────────────────────────────────────────────────

const METRICS: { key: ActiveMetric; icon: string; label: string }[] = [
  { key: 'physical',  icon: '⚡', label: 'Physical Engine'   },
  { key: 'mental',    icon: '🧠', label: 'Mental Energy'     },
  { key: 'technical', icon: '⚙️', label: 'Technical Execution' },
];

function getExtractor(metric: ActiveMetric) {
  return (r: RawResponse): number | null => {
    const m = ((r as any).metrics ?? {}) as Record<string, number>;
    if (metric === 'physical') {
      if (m.tankLevel == null || m.legBounce == null || m.cardioLoad == null) return null;
      return Math.round((m.tankLevel + m.legBounce + (101 - m.cardioLoad)) / 3);
    }
    if (metric === 'mental') {
      return typeof m.teamChemistry === 'number' ? m.teamChemistry : null;
    }
    // technical
    if (m.motorControl == null || m.tacticalSharpness == null) return null;
    return Math.round((m.motorControl + m.tacticalSharpness) / 2);
  };
}

function memberName(m: Member): string {
  return m.fullName || m.displayName || m.firstName || m.id;
}

// ─── Quadrant header ──────────────────────────────────────────────────────────

function QuadrantHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 9,
      fontFamily: "'Space Mono', monospace",
      letterSpacing: '1.5px',
      textTransform: 'uppercase' as const,
      color: 'rgba(0,212,255,0.50)',
      marginBottom: 6,
    }}>
      {label}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DARPerformanceChart({
  filteredResponses,
  members,
  selectedPlayerIds,
}: DARPerformanceChartProps) {
  const [activeMetric, setActiveMetric] = useState<ActiveMetric>('physical');
  const [playerSort, setPlayerSort] = useState<PlayerSort>('alpha');

  const isSinglePlayer = selectedPlayerIds.length === 1;

  // ── Filtered members (only selected players, or ALL when nothing selected) ──
  const selectedMembers = useMemo(
    () => selectedPlayerIds.length > 0
      ? members.filter((m) => selectedPlayerIds.includes(m.id))
      : members,
    [members, selectedPlayerIds]
  );

  // ── Per-member DARDataPoint[] for the active metric ──────────────────────
  const memberTimelines = useMemo(() => {
    const extractor = getExtractor(activeMetric);
    return selectedMembers.map((m) => ({
      id: m.id,
      name: memberName(m),
      data: getDARDataForResponses(
        filteredResponses.filter((r) => r.userId === m.id),
        extractor
      ),
    }));
  }, [filteredResponses, selectedMembers, activeMetric]);

  // ── TOP-LEFT: timeline stacked (team % per day, or single-player colored bars)
  const timelineStackedData = useMemo((): StackedZonePoint[] => {
    if (memberTimelines.length === 0) return [];

    if (isSinglePlayer) {
      const mt = memberTimelines[0];
      return mt.data
        .filter((d) => d.rawScore !== null && d.zone !== 'INSUFFICIENT_DATA')
        .map((d) => ({
          key: d.date,
          blue:   d.zone === 'BLUE'   ? 100 : 0,
          green:  d.zone === 'GREEN'  ? 100 : 0,
          yellow: d.zone === 'YELLOW' ? 100 : 0,
          total: 1,
          value: 100,
          zone: d.zone as 'GREEN' | 'BLUE' | 'YELLOW',
          zoneLabel: d.zone === 'BLUE' ? 'U' : d.zone === 'YELLOW' ? 'S' : 'N',
        }));
    }

    // Collect all unique dates across all members
    const dateSet = new Set<string>();
    for (const mt of memberTimelines) {
      for (const d of mt.data) dateSet.add(d.date);
    }
    const allDates = [...dateSet].sort();

    // Build lookup: memberId → date → zone
    const lookup: Record<string, Record<string, DARDataPoint>> = {};
    for (const mt of memberTimelines) {
      lookup[mt.id] = {};
      for (const d of mt.data) lookup[mt.id][d.date] = d;
    }

    return allDates
      .map((date) => {
        let blue = 0, green = 0, yellow = 0, total = 0;
        for (const mt of memberTimelines) {
          const pt = lookup[mt.id]?.[date];
          if (!pt || pt.rawScore === null || pt.zone === 'INSUFFICIENT_DATA') continue;
          total++;
          if (pt.zone === 'BLUE')   blue++;
          else if (pt.zone === 'GREEN')  green++;
          else if (pt.zone === 'YELLOW') yellow++;
        }
        if (total === 0) return null;
        const bluePct   = Math.round(blue   / total * 100);
        const greenPct  = Math.round(green  / total * 100);
        const yellowPct = 100 - bluePct - greenPct;
        return { key: date, blue: bluePct, green: greenPct, yellow: yellowPct, total };
      })
      .filter((x): x is StackedZonePoint => x !== null);
  }, [memberTimelines, isSinglePlayer]);

  // ── TOP-RIGHT: per-player zone distribution (stacked bar, byPlayer) ─────────
  const playerStackedData = useMemo((): StackedZonePoint[] => {
    const rows = memberTimelines
      .map((mt) => {
        const withData = mt.data.filter(
          (d) => d.rawScore !== null && d.zone !== 'INSUFFICIENT_DATA'
        );
        if (withData.length === 0) return null;
        const total = withData.length;
        const blue   = Math.round(withData.filter((d) => d.zone === 'BLUE').length   / total * 100);
        const green  = Math.round(withData.filter((d) => d.zone === 'GREEN').length  / total * 100);
        const yellow = 100 - blue - green;
        return { key: mt.name, blue, green, yellow, total };
      })
      .filter((x): x is StackedZonePoint => x !== null);

    if (playerSort === 'spike') {
      return [...rows].sort((a, b) => b.yellow - a.yellow);
    }
    return rows.sort((a, b) => a.key.localeCompare(b.key));
  }, [memberTimelines, playerSort]);

  // ── BOTTOM-LEFT: team-level raw timeline (avg score per day) ─────────────────
  // filteredResponses is already scoped to selectedPlayerIds by PerformanceDashboard
  const rawTimelineData = useMemo((): DARDataPoint[] => {
    if (filteredResponses.length === 0) return [];
    const extractor = getExtractor(activeMetric);
    return getDARDataForResponses(filteredResponses, extractor);
  }, [filteredResponses, activeMetric]);

  // ── BOTTOM-RIGHT: workload AU per player ──────────────────────────────────
  // filteredResponses already scoped to selectedPlayerIds by PerformanceDashboard
  const playerWorkloadData = useMemo((): PlayerWorkload[] => {
    const totals: Record<string, number> = {};
    for (const r of filteredResponses) {
      const w = typeof (r as any).workloadAU === 'number' ? (r as any).workloadAU : 0;
      totals[r.userId] = (totals[r.userId] ?? 0) + w;
    }
    const rows = selectedMembers
      .map((m) => ({
        player: memberName(m),
        workloadAU: Math.round(totals[m.id] ?? 0),
      }))
      .filter((r) => r.workloadAU > 0);

    if (playerSort === 'spike') {
      return [...rows].sort((a, b) => b.workloadAU - a.workloadAU);
    }
    return rows.sort((a, b) => a.player.localeCompare(b.player));
  }, [filteredResponses, selectedMembers, playerSort]);

  // ── Zone distribution (per-player mini bars, below grid) ──────────────────
  const zoneDist = useMemo(() => {
    const activeMetricLabel = METRICS.find((m) => m.key === activeMetric)?.label ?? '';
    return { rows: playerStackedData, metricLabel: activeMetricLabel };
  }, [playerStackedData, activeMetric]);

  const hasData =
    timelineStackedData.length > 0 ||
    rawTimelineData.length > 0 ||
    playerStackedData.length > 0 ||
    playerWorkloadData.length > 0;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* ── Metric selector ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' as const }}>
        {METRICS.map(({ key, icon, label }) => {
          const active = key === activeMetric;
          return (
            <button
              key={key}
              onClick={() => setActiveMetric(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                border: active
                  ? '1px solid rgba(0,212,255,0.50)'
                  : '1px solid rgba(255,255,255,0.10)',
                background: active
                  ? 'rgba(0,212,255,0.10)'
                  : 'rgba(255,255,255,0.04)',
                color: active ? '#00D4FF' : 'rgba(255,255,255,0.50)',
                fontSize: 12,
                fontFamily: "'DM Sans', system-ui",
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}

        {/* Sort toggle — pushed right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: "'Space Mono', monospace", letterSpacing: '1px' }}>
            SORT
          </span>
          {(['alpha', 'spike'] as PlayerSort[]).map((s) => (
            <button
              key={s}
              onClick={() => setPlayerSort(s)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: playerSort === s
                  ? '1px solid rgba(0,212,255,0.40)'
                  : '1px solid rgba(255,255,255,0.08)',
                background: playerSort === s
                  ? 'rgba(0,212,255,0.08)'
                  : 'transparent',
                color: playerSort === s ? '#00D4FF' : 'rgba(255,255,255,0.35)',
                fontSize: 10,
                fontFamily: "'Space Mono', monospace",
                cursor: 'pointer',
                letterSpacing: '0.5px',
              }}
            >
              {s === 'alpha' ? 'A–Z' : '% Spike ↓'}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.28)', fontSize: 13 }}>
          No V3 questionnaire data in the selected period.
        </div>
      ) : (
        <>
          {/* ── 2×2 grid ──────────────────────────────────────────────────── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
            marginBottom: 28,
          }}>
            {/* Top-left: Relative Score Timeline */}
            <div style={{
              background: '#0D1526',
              borderRadius: 10,
              border: '1px solid rgba(0,212,255,0.08)',
              padding: '14px 12px 10px',
            }}>
              <QuadrantHeader label="Relative Score · Timeline" />
              <DARStackedChart
                data={timelineStackedData}
                mode="timeline"
                singlePlayer={isSinglePlayer}
                height={260}
              />
            </div>

            {/* Top-right: Relative Score Period */}
            <div style={{
              background: '#0D1526',
              borderRadius: 10,
              border: '1px solid rgba(0,212,255,0.08)',
              padding: '14px 12px 10px',
            }}>
              <QuadrantHeader label="Relative Score · Period" />
              <DARStackedChart
                data={playerStackedData}
                mode="byPlayer"
                height={260}
              />
            </div>

            {/* Bottom-left: Raw Score Timeline */}
            <div style={{
              background: '#0D1526',
              borderRadius: 10,
              border: '1px solid rgba(0,212,255,0.08)',
              padding: '14px 12px 10px',
            }}>
              <QuadrantHeader label="Raw Score · Timeline" />
              <DARRawChart
                mode="timeline"
                timelineData={rawTimelineData}
                height={260}
              />
            </div>

            {/* Bottom-right: Raw Score Period (workload) */}
            <div style={{
              background: '#0D1526',
              borderRadius: 10,
              border: '1px solid rgba(0,212,255,0.08)',
              padding: '14px 12px 10px',
            }}>
              <QuadrantHeader label="Raw Score · Period" />
              <DARRawChart
                mode="byPlayer"
                playerData={playerWorkloadData}
                height={260}
              />
            </div>
          </div>

          {/* ── Zone distribution row ──────────────────────────────────────── */}
          {zoneDist.rows.length > 0 && (
            <div style={{
              borderTop: '1px solid rgba(0,212,255,0.10)',
              paddingTop: 20,
            }}>
              <div style={{
                fontSize: 10,
                fontFamily: "'Space Mono', monospace",
                letterSpacing: '1.5px',
                textTransform: 'uppercase' as const,
                color: 'rgba(0,212,255,0.55)',
                marginBottom: 14,
              }}>
                Zone Distribution — {zoneDist.metricLabel}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                {zoneDist.rows.map((row) => (
                  <div key={row.key}>
                    <div style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.55)',
                      fontFamily: "'DM Sans', system-ui",
                      marginBottom: 4,
                    }}>
                      {row.key}
                      {' — '}
                      <span style={{ color: DAR_COLORS.GREEN }}>{row.green}% Normal</span>
                      {' · '}
                      <span style={{ color: DAR_COLORS.BLUE }}>{row.blue}% Under-load</span>
                      {' · '}
                      <span style={{ color: DAR_COLORS.YELLOW }}>{row.yellow}% Spike</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      height: 5,
                      borderRadius: 3,
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ width: `${row.green}%`,  background: DAR_COLORS.GREEN,  transition: 'width 0.3s' }} />
                      <div style={{ width: `${row.blue}%`,   background: DAR_COLORS.BLUE,   transition: 'width 0.3s' }} />
                      <div style={{ width: `${row.yellow}%`, background: DAR_COLORS.YELLOW, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
