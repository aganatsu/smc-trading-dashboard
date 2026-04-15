/**
 * ICTAnalysis — Dedicated ICT concepts analysis view
 * Panels: Session Map, Currency Strength Heatmap, Correlation Matrix,
 *         PD/PW Levels, Judas Swing, Premium/Discount Zone
 * All data fetched from server-side tRPC ICT endpoints
 */

import { useState, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Clock, TrendingUp, TrendingDown, Zap, BarChart3, Grid3X3,
  ArrowUpDown, Activity, Gauge, Sun, Moon, Target, AlertTriangle,
  ChevronDown, ChevronRight, Calendar, Newspaper
} from 'lucide-react';

const SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'GBP/JPY', 'AUD/USD',
  'USD/CAD', 'EUR/GBP', 'NZD/USD', 'XAU/USD', 'BTC/USD',
];

export default function ICTAnalysis() {
  const [selectedSymbol, setSelectedSymbol] = useState('EUR/USD');
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(
    new Set(['session', 'strength', 'correlations', 'pdpw', 'judas', 'premium', 'fundamentals'])
  );

  // Listen for symbol changes from AppShell sidebar
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.symbol) setSelectedSymbol(detail.symbol);
    };
    window.addEventListener('smc-symbol-change', handler);
    return () => window.removeEventListener('smc-symbol-change', handler);
  }, []);

  const togglePanel = (id: string) => {
    setExpandedPanels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Data Queries ────────────────────────────────────────────────
  const sessionInfo = trpc.ict.sessionInfo.useQuery(
    { symbol: selectedSymbol },
    { refetchInterval: 60000 }
  );
  const currencyStrength = trpc.ict.currencyStrength.useQuery(undefined, {
    refetchInterval: 120000,
  });
  const correlations = trpc.ict.correlations.useQuery(undefined, {
    refetchInterval: 300000,
  });
  const pdLevels = trpc.ict.pdLevels.useQuery(
    { symbol: selectedSymbol },
    { refetchInterval: 120000 }
  );
  const judasSwing = trpc.ict.judasSwing.useQuery(
    { symbol: selectedSymbol },
    { refetchInterval: 60000 }
  );
  const premiumDiscount = trpc.ict.premiumDiscount.useQuery(
    { symbol: selectedSymbol },
    { refetchInterval: 60000 }
  );

  // Correlation matrix data
  const correlationMatrix = useMemo(() => {
    if (!correlations.data) return null;
    const pairs = Array.from(new Set(correlations.data.flatMap(c => [c.pair1, c.pair2])));
    const matrix: Record<string, Record<string, number>> = {};
    pairs.forEach(p => { matrix[p] = {}; pairs.forEach(q => { matrix[p][q] = p === q ? 1 : 0; }); });
    correlations.data.forEach(c => {
      matrix[c.pair1][c.pair2] = c.coefficient;
      matrix[c.pair2][c.pair1] = c.coefficient;
    });
    return { pairs, matrix };
  }, [correlations.data]);

  const isJPY = selectedSymbol.includes('JPY');
  const decimals = isJPY ? 3 : 5;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Symbol selector sidebar */}
      <div className="w-40 flex-shrink-0 bg-card border-r border-border overflow-y-auto">
        <div className="px-3 py-2 border-b border-border">
          <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
            Instrument
          </div>
        </div>
        {SYMBOLS.map(sym => (
          <button
            key={sym}
            onClick={() => setSelectedSymbol(sym)}
            className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors border-b border-border/30 ${
              selectedSymbol === sym
                ? 'bg-cyan/10 text-cyan font-bold'
                : 'text-foreground hover:bg-muted/30'
            }`}
          >
            {sym}
          </button>
        ))}
      </div>

      {/* Main content — scrollable panels */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-cyan" />
              <h1 className="text-lg font-bold text-foreground tracking-tight">ICT Analysis</h1>
              <span className="text-sm font-mono text-cyan font-bold">{selectedSymbol}</span>
            </div>
          </div>

          {/* ═══ SESSION MAP ═══ */}
          <Panel
            id="session"
            title="Session Map / Kill Zones"
            icon={<Clock className="w-4 h-4" />}
            expanded={expandedPanels.has('session')}
            onToggle={() => togglePanel('session')}
          >
            {sessionInfo.isLoading ? <LoadingState /> : sessionInfo.data ? (
              <div className="space-y-4">
                {/* Current session status */}
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${sessionInfo.data.active ? 'bg-bullish animate-pulse' : 'bg-muted-foreground'}`} />
                  <div>
                    <div className="text-sm font-bold font-mono text-foreground">
                      {sessionInfo.data.name} Session
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {sessionInfo.data.active ? 'Currently Active' : 'Inactive'}
                      {sessionInfo.data.isKillZone && (
                        <span className="ml-2 text-warning font-bold">⚡ KILL ZONE</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Session levels */}
                {sessionInfo.data.sessionHigh > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/30 border border-border p-3">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Session Open</div>
                      <div className="text-sm font-bold font-mono text-foreground">
                        {sessionInfo.data.sessionOpen.toFixed(decimals)}
                      </div>
                    </div>
                    <div className="bg-muted/30 border border-border p-3">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Session High</div>
                      <div className="text-sm font-bold font-mono text-bullish">
                        {sessionInfo.data.sessionHigh.toFixed(decimals)}
                      </div>
                    </div>
                    <div className="bg-muted/30 border border-border p-3">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Session Low</div>
                      <div className="text-sm font-bold font-mono text-bearish">
                        {sessionInfo.data.sessionLow.toFixed(decimals)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Session timeline visualization */}
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">24h Session Timeline (UTC)</div>
                  <div className="flex h-8 rounded overflow-hidden border border-border">
                    {/* Asian: 00-08 */}
                    <div className="flex-[8] bg-purple-500/20 border-r border-border/50 flex items-center justify-center">
                      <span className="text-[9px] font-mono text-purple-400 font-bold">ASIAN</span>
                    </div>
                    {/* London: 08-16 */}
                    <div className="flex-[8] bg-blue-500/20 border-r border-border/50 flex items-center justify-center">
                      <span className="text-[9px] font-mono text-blue-400 font-bold">LONDON</span>
                    </div>
                    {/* New York: 13-21 */}
                    <div className="flex-[8] bg-amber-500/20 flex items-center justify-center">
                      <span className="text-[9px] font-mono text-amber-400 font-bold">NEW YORK</span>
                    </div>
                  </div>
                  {/* Kill zone indicators */}
                  <div className="flex gap-4 text-[10px] font-mono text-muted-foreground">
                    <span>🔴 London KZ: 07:00-09:00</span>
                    <span>🟡 NY KZ: 12:00-14:00</span>
                    <span>🟣 Asian KZ: 00:00-03:00</span>
                  </div>
                </div>
              </div>
            ) : <EmptyState text="Session data unavailable" />}
          </Panel>

          {/* ═══ CURRENCY STRENGTH HEATMAP ═══ */}
          <Panel
            id="strength"
            title="Currency Strength Heatmap"
            icon={<Gauge className="w-4 h-4" />}
            expanded={expandedPanels.has('strength')}
            onToggle={() => togglePanel('strength')}
          >
            {currencyStrength.isLoading ? <LoadingState /> : currencyStrength.data?.length ? (
              <div className="space-y-4">
                {/* Strength bars */}
                <div className="space-y-2">
                  {currencyStrength.data.map(cs => {
                    const absStrength = Math.abs(cs.strength);
                    const maxStrength = Math.max(...currencyStrength.data!.map(c => Math.abs(c.strength)), 0.01);
                    const barWidth = (absStrength / maxStrength) * 100;
                    const isPositive = cs.strength >= 0;
                    return (
                      <div key={cs.currency} className="flex items-center gap-3">
                        <div className="w-10 text-xs font-mono font-bold text-foreground">{cs.currency}</div>
                        <div className="flex-1 h-6 bg-muted/30 relative overflow-hidden border border-border/50">
                          {/* Center line */}
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
                          {/* Bar */}
                          <div
                            className={`absolute top-0.5 bottom-0.5 transition-all ${
                              isPositive ? 'bg-bullish/60' : 'bg-bearish/60'
                            }`}
                            style={{
                              left: isPositive ? '50%' : `${50 - barWidth / 2}%`,
                              width: `${barWidth / 2}%`,
                            }}
                          />
                        </div>
                        <div className={`w-16 text-right text-xs font-mono font-bold ${
                          isPositive ? 'text-bullish' : 'text-bearish'
                        }`}>
                          {cs.strength > 0 ? '+' : ''}{cs.strength.toFixed(2)}%
                        </div>
                        <div className="w-6 text-center text-[10px] font-mono text-muted-foreground">
                          #{cs.rank}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="flex gap-4 text-[10px] font-mono text-muted-foreground border-t border-border/50 pt-2">
                  <span>
                    Strongest: <span className="text-bullish font-bold">
                      {currencyStrength.data[0]?.currency}
                    </span>
                  </span>
                  <span>
                    Weakest: <span className="text-bearish font-bold">
                      {currencyStrength.data[currencyStrength.data.length - 1]?.currency}
                    </span>
                  </span>
                </div>
              </div>
            ) : <EmptyState text="Currency strength data unavailable" />}
          </Panel>

          {/* ═══ CORRELATION MATRIX ═══ */}
          <Panel
            id="correlations"
            title="Correlation Matrix"
            icon={<Grid3X3 className="w-4 h-4" />}
            expanded={expandedPanels.has('correlations')}
            onToggle={() => togglePanel('correlations')}
          >
            {correlations.isLoading ? <LoadingState /> : correlationMatrix ? (
              <div className="space-y-3">
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-[10px] font-mono">
                    <thead>
                      <tr>
                        <th className="p-1 text-left text-muted-foreground"></th>
                        {correlationMatrix.pairs.map(p => (
                          <th key={p} className="p-1 text-center text-muted-foreground whitespace-nowrap">
                            {p.replace('/', '')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {correlationMatrix.pairs.map(row => (
                        <tr key={row}>
                          <td className="p-1 font-bold text-foreground whitespace-nowrap">{row.replace('/', '')}</td>
                          {correlationMatrix.pairs.map(col => {
                            const val = correlationMatrix.matrix[row][col];
                            const bg = val === 1 ? 'bg-cyan/20' :
                              val > 0.7 ? 'bg-bullish/30' :
                              val > 0.3 ? 'bg-bullish/15' :
                              val < -0.7 ? 'bg-bearish/30' :
                              val < -0.3 ? 'bg-bearish/15' :
                              'bg-muted/20';
                            const textColor = val === 1 ? 'text-cyan' :
                              val > 0.5 ? 'text-bullish' :
                              val < -0.5 ? 'text-bearish' :
                              'text-muted-foreground';
                            return (
                              <td key={col} className={`p-1 text-center font-bold ${bg} ${textColor} border border-border/20`}>
                                {val === 1 ? '1.00' : val.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-bullish/30 border border-border/50" />
                    <span>Strong +</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-bullish/15 border border-border/50" />
                    <span>Moderate +</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-muted/20 border border-border/50" />
                    <span>Neutral</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-bearish/15 border border-border/50" />
                    <span>Moderate -</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-bearish/30 border border-border/50" />
                    <span>Strong -</span>
                  </div>
                </div>
              </div>
            ) : <EmptyState text="Correlation data unavailable" />}
          </Panel>

          {/* ═══ PD/PW LEVELS ═══ */}
          <Panel
            id="pdpw"
            title="PD/PW Levels (Previous Day / Week)"
            icon={<BarChart3 className="w-4 h-4" />}
            expanded={expandedPanels.has('pdpw')}
            onToggle={() => togglePanel('pdpw')}
          >
            {pdLevels.isLoading ? <LoadingState /> : pdLevels.data ? (
              <div className="space-y-4">
                {/* Previous Day */}
                <div>
                  <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Sun className="w-3 h-3" /> Previous Day
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <LevelCard label="PDH" value={pdLevels.data.pdh.toFixed(decimals)} color="text-bullish" />
                    <LevelCard label="PDL" value={pdLevels.data.pdl.toFixed(decimals)} color="text-bearish" />
                    <LevelCard label="PDO" value={pdLevels.data.pdo.toFixed(decimals)} color="text-foreground" />
                    <LevelCard label="PDC" value={pdLevels.data.pdc.toFixed(decimals)} color="text-foreground" />
                  </div>
                </div>

                {/* Previous Week */}
                <div>
                  <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Moon className="w-3 h-3" /> Previous Week
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <LevelCard label="PWH" value={pdLevels.data.pwh.toFixed(decimals)} color="text-bullish" />
                    <LevelCard label="PWL" value={pdLevels.data.pwl.toFixed(decimals)} color="text-bearish" />
                    <LevelCard label="PWO" value={pdLevels.data.pwo.toFixed(decimals)} color="text-foreground" />
                    <LevelCard label="PWC" value={pdLevels.data.pwc.toFixed(decimals)} color="text-foreground" />
                  </div>
                </div>

                {/* Range info */}
                <div className="grid grid-cols-2 gap-3 text-xs font-mono border-t border-border/50 pt-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Daily Range</span>
                    <span className="text-foreground font-bold">
                      {Math.abs(pdLevels.data.pdh - pdLevels.data.pdl).toFixed(decimals)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weekly Range</span>
                    <span className="text-foreground font-bold">
                      {Math.abs(pdLevels.data.pwh - pdLevels.data.pwl).toFixed(decimals)}
                    </span>
                  </div>
                </div>
              </div>
            ) : <EmptyState text="PD/PW level data unavailable" />}
          </Panel>

          {/* ═══ JUDAS SWING ═══ */}
          <Panel
            id="judas"
            title="Judas Swing Detection"
            icon={<AlertTriangle className="w-4 h-4" />}
            expanded={expandedPanels.has('judas')}
            onToggle={() => togglePanel('judas')}
          >
            {judasSwing.isLoading ? <LoadingState /> : judasSwing.data ? (
              <div className="space-y-3">
                {/* Detection status */}
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded flex items-center justify-center ${
                    judasSwing.data.detected
                      ? judasSwing.data.type === 'bullish'
                        ? 'bg-bullish/20 border border-bullish/40'
                        : 'bg-bearish/20 border border-bearish/40'
                      : 'bg-muted/30 border border-border'
                  }`}>
                    {judasSwing.data.detected ? (
                      judasSwing.data.type === 'bullish'
                        ? <TrendingUp className="w-5 h-5 text-bullish" />
                        : <TrendingDown className="w-5 h-5 text-bearish" />
                    ) : (
                      <Activity className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className={`text-sm font-bold font-mono ${
                      judasSwing.data.detected
                        ? judasSwing.data.type === 'bullish' ? 'text-bullish' : 'text-bearish'
                        : 'text-muted-foreground'
                    }`}>
                      {judasSwing.data.detected
                        ? `${judasSwing.data.type?.toUpperCase()} JUDAS SWING`
                        : 'No Judas Swing Detected'}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {judasSwing.data.description}
                    </div>
                  </div>
                </div>

                {/* Levels */}
                {judasSwing.data.detected && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 border border-border p-3">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Midnight Open</div>
                      <div className="text-sm font-bold font-mono text-foreground">
                        {judasSwing.data.midnightOpen.toFixed(decimals)}
                      </div>
                    </div>
                    {judasSwing.data.sweepHigh !== null && (
                      <div className="bg-muted/30 border border-border p-3">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Sweep High</div>
                        <div className="text-sm font-bold font-mono text-bullish">
                          {judasSwing.data.sweepHigh.toFixed(decimals)}
                        </div>
                      </div>
                    )}
                    {judasSwing.data.sweepLow !== null && (
                      <div className="bg-muted/30 border border-border p-3">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Sweep Low</div>
                        <div className="text-sm font-bold font-mono text-bearish">
                          {judasSwing.data.sweepLow.toFixed(decimals)}
                        </div>
                      </div>
                    )}
                    <div className="bg-muted/30 border border-border p-3">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Reversal</div>
                      <div className={`text-sm font-bold font-mono ${judasSwing.data.reversalConfirmed ? 'text-bullish' : 'text-muted-foreground'}`}>
                        {judasSwing.data.reversalConfirmed ? 'CONFIRMED' : 'PENDING'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Explanation */}
                <div className="text-[10px] font-mono text-muted-foreground bg-muted/20 p-2 border border-border/50">
                  <strong className="text-foreground">ICT Judas Swing:</strong> A false move (sweep) in one direction during the London or NY open, 
                  designed to trap retail traders before the real move begins in the opposite direction. 
                  The bot checks for liquidity sweeps above/below the midnight open during kill zone hours.
                </div>
              </div>
            ) : <EmptyState text="Judas swing data unavailable" />}
          </Panel>

          {/* ═══ PREMIUM / DISCOUNT ZONE ═══ */}
          <Panel
            id="premium"
            title="Premium / Discount Zone"
            icon={<Target className="w-4 h-4" />}
            expanded={expandedPanels.has('premium')}
            onToggle={() => togglePanel('premium')}
          >
            {premiumDiscount.isLoading ? <LoadingState /> : premiumDiscount.data ? (
              <div className="space-y-4">
                {/* Zone indicator */}
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border ${
                    premiumDiscount.data.currentZone === 'premium'
                      ? 'bg-bearish/20 text-bearish border-bearish/40'
                      : premiumDiscount.data.currentZone === 'discount'
                      ? 'bg-bullish/20 text-bullish border-bullish/40'
                      : 'bg-warning/20 text-warning border-warning/40'
                  }`}>
                    {premiumDiscount.data.currentZone.toUpperCase()} ZONE
                  </div>
                  {premiumDiscount.data.oteZone && (
                    <div className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-cyan/20 text-cyan border border-cyan/40">
                      OTE ZONE (62-79%)
                    </div>
                  )}
                </div>

                {/* Visual zone meter */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-bullish">Swing High: {premiumDiscount.data.swingHigh.toFixed(decimals)}</span>
                    <span className="text-bearish">Swing Low: {premiumDiscount.data.swingLow.toFixed(decimals)}</span>
                  </div>
                  <div className="relative h-8 border border-border overflow-hidden">
                    {/* Premium zone (top half) */}
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-bearish/10" />
                    {/* Discount zone (bottom half) */}
                    <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-bullish/10" />
                    {/* Equilibrium line */}
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-warning/60" />
                    {/* OTE zone (62-79%) */}
                    <div className="absolute bg-cyan/10 border-l border-r border-cyan/30"
                      style={{ top: `${100 - 79}%`, height: '17%', left: 0, right: 0 }} />
                    {/* Current price marker */}
                    <div
                      className="absolute w-full h-1 bg-foreground/80"
                      style={{ top: `${100 - premiumDiscount.data.zonePercent}%` }}
                    >
                      <div className="absolute right-0 -top-2 text-[9px] font-mono font-bold text-foreground bg-card px-1">
                        {premiumDiscount.data.zonePercent.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>100% (Premium)</span>
                    <span>EQ (50%)</span>
                    <span>0% (Discount)</span>
                  </div>
                </div>

                {/* Key levels */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/30 border border-border p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Equilibrium</div>
                    <div className="text-sm font-bold font-mono text-warning">
                      {premiumDiscount.data.equilibrium.toFixed(decimals)}
                    </div>
                  </div>
                  <div className="bg-muted/30 border border-border p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Zone %</div>
                    <div className="text-sm font-bold font-mono text-foreground">
                      {premiumDiscount.data.zonePercent.toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-muted/30 border border-border p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">OTE</div>
                    <div className={`text-sm font-bold font-mono ${premiumDiscount.data.oteZone ? 'text-cyan' : 'text-muted-foreground'}`}>
                      {premiumDiscount.data.oteZone ? 'YES' : 'NO'}
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                <div className="text-[10px] font-mono text-muted-foreground bg-muted/20 p-2 border border-border/50">
                  <strong className="text-foreground">ICT Premium/Discount:</strong> Price above the 50% equilibrium is in the 
                  <span className="text-bearish"> premium zone</span> (ideal for sells). Price below is in the 
                  <span className="text-bullish"> discount zone</span> (ideal for buys). The 
                  <span className="text-cyan"> OTE zone (62-79%)</span> is the Optimal Trade Entry area for retracements.
                </div>
              </div>
            ) : <EmptyState text="Premium/Discount data unavailable" />}
          </Panel>

          {/* ═══ FUNDAMENTALS / ECONOMIC CALENDAR ═══ */}
          <FundamentalsPanel
            selectedSymbol={selectedSymbol}
            expanded={expandedPanels.has('fundamentals')}
            onToggle={() => togglePanel('fundamentals')}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Fundamentals Panel ─────────────────────────────────────────────
function FundamentalsPanel({ selectedSymbol, expanded, onToggle }: {
  selectedSymbol: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const fundamentals = trpc.fundamentals.data.useQuery(undefined, { refetchInterval: 300000 });
  const pairEvents = trpc.fundamentals.eventsForPair.useQuery(
    { pair: selectedSymbol },
    { refetchInterval: 300000 }
  );
  const highImpact = trpc.fundamentals.highImpactCheck.useQuery(
    { pair: selectedSymbol, withinMinutes: 60 },
    { refetchInterval: 60000 }
  );

  const impactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-bearish bg-bearish/10 border-bearish/30';
      case 'medium': return 'text-warning bg-warning/10 border-warning/30';
      case 'low': return 'text-muted-foreground bg-muted/10 border-border';
      default: return 'text-muted-foreground';
    }
  };

  const impactDot = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-bearish';
      case 'medium': return 'bg-warning';
      case 'low': return 'bg-muted-foreground';
      default: return 'bg-muted-foreground';
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const countryFlag = (country: string) => {
    const flags: Record<string, string> = {
      US: '🇺🇸', EU: '🇪🇺', GB: '🇬🇧', JP: '🇯🇵', AU: '🇦🇺', CA: '🇨🇦', NZ: '🇳🇿', CH: '🇨🇭',
    };
    return flags[country] || country;
  };

  return (
    <Panel
      id="fundamentals"
      title="Fundamentals / Economic Calendar"
      icon={<Calendar className="w-4 h-4" />}
      expanded={expanded}
      onToggle={onToggle}
    >
      {fundamentals.isLoading ? <LoadingState /> : fundamentals.data ? (
        <div className="space-y-4">
          {/* High impact alert */}
          {highImpact.data?.hasEvent && highImpact.data.event && (
            <div className="bg-bearish/10 border border-bearish/30 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-bearish flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold font-mono text-bearish">HIGH IMPACT EVENT APPROACHING</div>
                <div className="text-[10px] font-mono text-foreground mt-1">
                  {highImpact.data.event.name} ({highImpact.data.event.currency}) at {formatTime(highImpact.data.event.scheduledTime)}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {highImpact.data.event.description}
                </div>
              </div>
            </div>
          )}

          {/* Impact summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-bearish/10 border border-bearish/30 p-2.5 text-center">
              <div className="text-lg font-bold font-mono text-bearish">{fundamentals.data.highImpactCount}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">High Impact</div>
            </div>
            <div className="bg-warning/10 border border-warning/30 p-2.5 text-center">
              <div className="text-lg font-bold font-mono text-warning">{fundamentals.data.mediumImpactCount}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Medium Impact</div>
            </div>
            <div className="bg-muted/30 border border-border p-2.5 text-center">
              <div className="text-lg font-bold font-mono text-muted-foreground">{fundamentals.data.lowImpactCount}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Low Impact</div>
            </div>
          </div>

          {/* Currency exposure this week */}
          {Object.keys(fundamentals.data.currencyExposure).length > 0 && (
            <div>
              <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2">Currency Event Exposure (This Week)</div>
              <div className="grid grid-cols-4 gap-1">
                {Object.entries(fundamentals.data.currencyExposure)
                  .sort(([, a], [, b]) => (b.high * 3 + b.medium * 2 + b.low) - (a.high * 3 + a.medium * 2 + a.low))
                  .map(([currency, counts]) => (
                    <div key={currency} className="bg-muted/20 border border-border p-2 text-center">
                      <div className="text-xs font-bold font-mono text-foreground">{currency}</div>
                      <div className="flex justify-center gap-1 mt-1">
                        {counts.high > 0 && <span className="text-[9px] font-mono text-bearish">{counts.high}H</span>}
                        {counts.medium > 0 && <span className="text-[9px] font-mono text-warning">{counts.medium}M</span>}
                        {counts.low > 0 && <span className="text-[9px] font-mono text-muted-foreground">{counts.low}L</span>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Events for selected pair */}
          <div>
            <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Events Affecting {selectedSymbol} (Next 7 Days)
            </div>
            {pairEvents.data && pairEvents.data.length > 0 ? (
              <div className="space-y-1">
                {pairEvents.data.slice(0, 15).map((event, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/20 border border-border/50 px-3 py-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${impactDot(event.impact)}`} />
                    <div className="text-[10px] font-mono text-muted-foreground w-10 flex-shrink-0">
                      {countryFlag(event.country)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono font-bold text-foreground truncate">{event.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {formatDate(event.scheduledTime)} at {formatTime(event.scheduledTime)}
                      </div>
                    </div>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${impactColor(event.impact)} uppercase`}>
                      {event.impact}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs font-mono text-muted-foreground py-2">No events affecting {selectedSymbol} in the next 7 days</div>
            )}
          </div>

          {/* Today's events */}
          <div>
            <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Today's Events ({fundamentals.data.todayEvents.length})
            </div>
            {fundamentals.data.todayEvents.length > 0 ? (
              <div className="space-y-1">
                {fundamentals.data.todayEvents.map((event, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/20 border border-border/50 px-3 py-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${impactDot(event.impact)}`} />
                    <div className="text-[10px] font-mono w-10 flex-shrink-0">{countryFlag(event.country)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono font-bold text-foreground truncate">{event.name}</div>
                    </div>
                    <div className="text-[10px] font-mono text-cyan flex-shrink-0">{formatTime(event.scheduledTime)}</div>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${impactColor(event.impact)} uppercase`}>
                      {event.impact}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs font-mono text-muted-foreground py-2">No economic events scheduled for today</div>
            )}
          </div>

          {/* Explanation */}
          <div className="text-[10px] font-mono text-muted-foreground bg-muted/20 p-2 border border-border/50">
            <strong className="text-foreground">Fundamentals Calendar:</strong> Shows upcoming economic events that can cause
            significant price volatility. <span className="text-bearish">High impact</span> events (NFP, CPI, central bank decisions)
            often cause 50-200+ pip moves. The bot's news filter can automatically pause trading before these events.
            Events are generated from known recurring schedules for major economies.
          </div>
        </div>
      ) : <EmptyState text="Fundamentals data unavailable" />}
    </Panel>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function Panel({ id, title, icon, expanded, onToggle, children }: {
  id: string;
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="text-cyan">{icon}</span>
          <span className="text-sm font-bold font-mono text-foreground uppercase tracking-wider">{title}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50">
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  );
}

function LevelCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-muted/30 border border-border p-2.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 font-mono">{label}</div>
      <div className={`text-sm font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-2 py-4">
      <div className="w-4 h-4 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono text-muted-foreground">Loading data...</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-4 text-center text-xs font-mono text-muted-foreground">{text}</div>
  );
}
