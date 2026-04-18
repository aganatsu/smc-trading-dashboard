/**
 * FOTSI Currency Strength Meter
 * 
 * Displays 8-currency TSI-based strength with:
 * - Horizontal bar chart ranked by strength
 * - OB/OS zones color-coded
 * - Hook detection indicators
 * - Sparkline mini-charts
 * - Ranked pair opportunities table
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

// ─── Types (mirrored from server) ──────────────────────────────────

interface FOTSIStrength {
  currency: string;
  tsi: number;
  rank: number;
  zone: 'overbought' | 'oversold' | 'neutral_high' | 'neutral_low' | 'neutral';
  hookDirection: 'hooking_up' | 'hooking_down' | 'none';
  hookStrength: 'strong' | 'moderate' | 'weak' | 'none';
  series: number[];
}

interface RankedPair {
  pair: string;
  base: string;
  quote: string;
  baseTSI: number;
  quoteTSI: number;
  spread: number;
  direction: 'BUY' | 'SELL';
  hookScore: number;
  reason: string;
}

// ─── Helpers ───────────────────────────────────────────────────────

function getZoneColor(zone: FOTSIStrength['zone']): string {
  switch (zone) {
    case 'overbought': return 'text-red-400';
    case 'oversold': return 'text-emerald-400';
    case 'neutral_high': return 'text-amber-400';
    case 'neutral_low': return 'text-sky-400';
    default: return 'text-zinc-400';
  }
}

function getBarColor(zone: FOTSIStrength['zone']): string {
  switch (zone) {
    case 'overbought': return 'bg-red-500';
    case 'oversold': return 'bg-emerald-500';
    case 'neutral_high': return 'bg-amber-500';
    case 'neutral_low': return 'bg-sky-500';
    default: return 'bg-zinc-500';
  }
}

function getBarGradient(zone: FOTSIStrength['zone']): string {
  switch (zone) {
    case 'overbought': return 'from-red-600 to-red-400';
    case 'oversold': return 'from-emerald-600 to-emerald-400';
    case 'neutral_high': return 'from-amber-600 to-amber-400';
    case 'neutral_low': return 'from-sky-600 to-sky-400';
    default: return 'from-zinc-600 to-zinc-400';
  }
}

function getHookIcon(dir: FOTSIStrength['hookDirection'], strength: FOTSIStrength['hookStrength']): string {
  if (dir === 'none') return '';
  const arrow = dir === 'hooking_up' ? '↗' : '↘';
  if (strength === 'strong') return `${arrow}${arrow}`;
  if (strength === 'moderate') return arrow;
  return `(${arrow})`;
}

function getHookColor(dir: FOTSIStrength['hookDirection']): string {
  if (dir === 'hooking_up') return 'text-emerald-400';
  if (dir === 'hooking_down') return 'text-red-400';
  return '';
}

// ─── Sparkline SVG ─────────────────────────────────────────────────

function Sparkline({ data, width = 60, height = 20 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const lastVal = data[data.length - 1];
  const color = lastVal > 0 ? '#34d399' : lastVal < 0 ? '#f87171' : '#a1a1aa';

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Component ─────────────────────────────────────────────────────

export default function FOTSIMeter({ collapsed = false }: { collapsed?: boolean }) {
  const [showPairs, setShowPairs] = useState(false);
  const fotsi = trpc.fotsi.strengths.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000, // 5 min
    staleTime: 4 * 60 * 1000,
  });

  const strengths = fotsi.data?.strengths ?? [];
  const rankedPairs = fotsi.data?.rankedPairs ?? [];
  const pairCount = fotsi.data?.pairCount ?? 0;
  const computedAt = fotsi.data?.computedAt;

  if (collapsed) {
    // Compact view: just strongest/weakest
    const strongest = strengths[0];
    const weakest = strengths[strengths.length - 1];
    return (
      <div className="flex items-center gap-3 text-xs font-mono">
        <span className="text-zinc-500">FOTSI</span>
        {strongest && (
          <span className="text-emerald-400">{strongest.currency} +{strongest.tsi.toFixed(0)}</span>
        )}
        {weakest && (
          <span className="text-red-400">{weakest.currency} {weakest.tsi.toFixed(0)}</span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-sm font-bold uppercase tracking-wider text-foreground">FOTSI Strength</span>
          <span className="text-[10px] text-zinc-500 font-mono">{pairCount}/28 pairs</span>
        </div>
        <div className="flex items-center gap-2">
          {computedAt && (
            <span className="text-[10px] text-zinc-500 font-mono">
              {new Date(computedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          )}
          <button
            onClick={() => fotsi.refetch()}
            disabled={fotsi.isFetching}
            className="px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-mono uppercase tracking-wider transition disabled:opacity-50"
          >
            {fotsi.isFetching ? '...' : '↻'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {fotsi.isLoading && (
        <div className="px-4 py-8 text-center text-zinc-500 text-xs font-mono">
          Computing FOTSI strengths across 28 pairs...
        </div>
      )}

      {/* Strength Bars */}
      {strengths.length > 0 && (
        <div className="px-4 py-3 space-y-1.5">
          {strengths.map(s => {
            const absWidth = Math.min(Math.abs(s.tsi), 100);
            const isPositive = s.tsi >= 0;
            return (
              <div key={s.currency} className="flex items-center gap-2 h-6">
                {/* Currency label */}
                <span className={`w-8 text-xs font-bold font-mono ${getZoneColor(s.zone)}`}>
                  {s.currency}
                </span>
                {/* Rank */}
                <span className="w-4 text-[10px] text-zinc-600 font-mono text-right">
                  #{s.rank}
                </span>
                {/* Bar container */}
                <div className="flex-1 h-4 bg-zinc-900 rounded relative overflow-hidden">
                  {/* Center line */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-700 z-10" />
                  {/* OB/OS zone markers */}
                  <div className="absolute left-[75%] top-0 bottom-0 w-px bg-red-900/30" />
                  <div className="absolute left-[25%] top-0 bottom-0 w-px bg-emerald-900/30" />
                  {/* Bar */}
                  <div
                    className={`absolute top-0.5 bottom-0.5 rounded bg-gradient-to-r ${getBarGradient(s.zone)} transition-all duration-500`}
                    style={{
                      left: isPositive ? '50%' : `${50 - absWidth / 2}%`,
                      width: `${absWidth / 2}%`,
                    }}
                  />
                </div>
                {/* TSI value */}
                <span className={`w-12 text-right text-xs font-mono font-bold ${s.tsi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {s.tsi >= 0 ? '+' : ''}{s.tsi.toFixed(1)}
                </span>
                {/* Hook indicator */}
                <span className={`w-6 text-xs font-mono ${getHookColor(s.hookDirection)}`}>
                  {getHookIcon(s.hookDirection, s.hookStrength)}
                </span>
                {/* Sparkline */}
                <Sparkline data={s.series} width={48} height={16} />
              </div>
            );
          })}
        </div>
      )}

      {/* Zone Legend */}
      <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] font-mono text-zinc-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> OB (&gt;50)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> High (25-50)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-500" /> Neutral</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" /> Low (-25 to -50)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> OS (&lt;-50)</span>
      </div>

      {/* Pair Opportunities Toggle */}
      <div className="border-t border-border">
        <button
          onClick={() => setShowPairs(!showPairs)}
          className="w-full px-4 py-2 flex items-center justify-between text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition"
        >
          <span>Ranked Pair Opportunities ({rankedPairs.length})</span>
          <span>{showPairs ? '▲' : '▼'}</span>
        </button>

        {showPairs && rankedPairs.length > 0 && (
          <div className="px-2 pb-2">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-1 px-2">Pair</th>
                  <th className="text-center py-1 px-1">Dir</th>
                  <th className="text-right py-1 px-1">Base</th>
                  <th className="text-right py-1 px-1">Quote</th>
                  <th className="text-right py-1 px-1">Spread</th>
                  <th className="text-center py-1 px-1">Hook</th>
                </tr>
              </thead>
              <tbody>
                {rankedPairs.map((p, i) => (
                  <tr key={p.pair} className={`border-b border-zinc-800/50 ${i < 3 ? 'bg-zinc-800/30' : ''}`}>
                    <td className="py-1 px-2 text-zinc-200 font-bold">{p.pair}</td>
                    <td className={`text-center py-1 px-1 font-bold ${p.direction === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.direction}
                    </td>
                    <td className={`text-right py-1 px-1 ${p.baseTSI >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.baseTSI.toFixed(1)}
                    </td>
                    <td className={`text-right py-1 px-1 ${p.quoteTSI >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.quoteTSI.toFixed(1)}
                    </td>
                    <td className="text-right py-1 px-1 text-cyan-400">{p.spread.toFixed(0)}</td>
                    <td className="text-center py-1 px-1">
                      {p.hookScore >= 3 ? '🔥' : p.hookScore >= 2 ? '✓✓' : p.hookScore >= 1 ? '✓' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
