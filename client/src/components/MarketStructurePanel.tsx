/**
 * MarketStructurePanel — Shows trend direction, swing points, BOS/CHoCH
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 */

import type { AnalysisResult } from '@/lib/smcAnalysis';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  analysis: AnalysisResult | null;
  weeklyTrend: string;
  dailyTrend: string;
  currentTF: string;
}

export default function MarketStructurePanel({ analysis, weeklyTrend, dailyTrend, currentTF }: Props) {
  const trendIcon = (trend: string) => {
    if (trend === 'bullish') return <TrendingUp className="w-3.5 h-3.5 text-bullish" />;
    if (trend === 'bearish') return <TrendingDown className="w-3.5 h-3.5 text-bearish" />;
    return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const trendBadge = (trend: string) => {
    const colors = trend === 'bullish'
      ? 'bg-bullish/10 text-bullish border-bullish/30'
      : trend === 'bearish'
        ? 'bg-bearish/10 text-bearish border-bearish/30'
        : 'bg-muted text-muted-foreground border-border';
    return (
      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${colors}`}>
        {trend}
      </span>
    );
  };

  return (
    <div className="h-full">
      <div className="panel-header">
        <span className="panel-header-title">Market Structure</span>
        <span className="status-dot status-dot-active" />
      </div>
      <div className="panel-body space-y-4">
        {/* Multi-Timeframe Trend */}
        <div>
          <div className="section-label mb-2">TREND ALIGNMENT</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1.5 px-3 bg-muted/50 border-l-2 border-border">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-12">WEEKLY</span>
                {trendIcon(weeklyTrend)}
              </div>
              {trendBadge(weeklyTrend)}
            </div>
            <div className="flex items-center justify-between py-1.5 px-3 bg-muted/50 border-l-2 border-border">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-12">DAILY</span>
                {trendIcon(dailyTrend)}
              </div>
              {trendBadge(dailyTrend)}
            </div>
            <div className="flex items-center justify-between py-1.5 px-3 bg-muted/50 border-l-2 border-cyan/30">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-cyan w-12">{currentTF}</span>
                {analysis && trendIcon(analysis.structure.trend)}
              </div>
              {analysis && trendBadge(analysis.structure.trend)}
            </div>
          </div>
        </div>

        {/* Alignment Check */}
        {analysis && (
          <div className={`px-3 py-2 border-l-3 ${
            weeklyTrend === dailyTrend && dailyTrend === analysis.structure.trend
              ? 'border-l-bullish bg-bullish/5'
              : 'border-l-warning bg-warning/5'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {weeklyTrend === dailyTrend && dailyTrend === analysis.structure.trend
                ? 'ALIGNED — All timeframes agree'
                : 'DIVERGENT — Timeframes disagree'}
            </span>
          </div>
        )}

        {/* BOS & CHoCH Events */}
        {analysis && (
          <div>
            <div className="section-label mb-2">STRUCTURE EVENTS</div>
            <div className="space-y-1">
              {analysis.structure.bos.slice(-3).map((b, i) => (
                <div key={`bos-${i}`} className="flex items-center justify-between py-1 px-2 text-[11px] font-mono">
                  <span className="text-muted-foreground">BOS</span>
                  <span className={b.type === 'bullish' ? 'text-bullish' : 'text-bearish'}>
                    {b.type.toUpperCase()}
                  </span>
                  <span className="text-muted-foreground">{b.price.toFixed(4)}</span>
                </div>
              ))}
              {analysis.structure.choch.slice(-3).map((c, i) => (
                <div key={`choch-${i}`} className="flex items-center justify-between py-1 px-2 text-[11px] font-mono bg-warning/5">
                  <span className="text-warning">CHoCH</span>
                  <span className={c.type === 'bullish' ? 'text-bullish' : 'text-bearish'}>
                    {c.type.toUpperCase()}
                  </span>
                  <span className="text-muted-foreground">{c.price.toFixed(4)}</span>
                </div>
              ))}
              {analysis.structure.bos.length === 0 && analysis.structure.choch.length === 0 && (
                <div className="text-[11px] text-muted-foreground font-mono py-1">No events detected</div>
              )}
            </div>
          </div>
        )}

        {/* Swing Points Summary */}
        {analysis && (
          <div>
            <div className="section-label mb-2">SWING POINTS</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/30 px-3 py-2">
                <div className="text-[10px] text-muted-foreground">SWING HIGHS</div>
                <div className="text-sm font-bold font-mono text-bearish">
                  {analysis.structure.swingPoints.filter(s => s.type === 'high').length}
                </div>
              </div>
              <div className="bg-muted/30 px-3 py-2">
                <div className="text-[10px] text-muted-foreground">SWING LOWS</div>
                <div className="text-sm font-bold font-mono text-bullish">
                  {analysis.structure.swingPoints.filter(s => s.type === 'low').length}
                </div>
              </div>
            </div>
          </div>
        )}

        {!analysis && (
          <div className="text-xs text-muted-foreground font-mono">Loading analysis...</div>
        )}
      </div>
    </div>
  );
}
