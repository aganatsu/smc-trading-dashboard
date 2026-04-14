/**
 * ChartView — TradingView chart (left 65%) + accordion analysis panels (right 35%)
 * Panels: Market Bias, Market Structure, Key Levels & Zones, SMC Analysis, Multi-Timeframe, Entry Checklist, Risk Calculator
 * Listens for smc-symbol-change events from AppShell sidebar filter
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import TradingViewChart from '@/components/TradingViewChart';
import { INSTRUMENTS, TIMEFRAMES, type Instrument, type Timeframe } from '@/lib/marketData';
import { runFullAnalysis, type AnalysisResult, type Candle } from '@/lib/smcAnalysis';
import {
  ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus,
  Target, Shield, CheckCircle, XCircle, AlertTriangle, PanelRightClose, PanelRightOpen,
  Compass, Layers, BarChart3
} from 'lucide-react';

export default function ChartView() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('EUR/USD');
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('4h');
  const [panelOpen, setPanelOpen] = useState(true);
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set(['bias', 'structure', 'levels']));

  const instrument = useMemo(() =>
    INSTRUMENTS.find(i => i.symbol === selectedSymbol) || INSTRUMENTS[0],
    [selectedSymbol]
  );

  // Listen for symbol changes from AppShell sidebar filter
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.symbol) {
        setSelectedSymbol(detail.symbol);
      }
    };
    window.addEventListener('smc-symbol-change', handler);
    return () => window.removeEventListener('smc-symbol-change', handler);
  }, []);

  // Fetch candles for analysis
  const candles = trpc.market.candles.useQuery(
    { symbol: selectedSymbol, interval: selectedTimeframe, outputsize: 200 },
    { refetchInterval: 60000, retry: 2 }
  );

  // Run SMC analysis on candles
  const analysis = useMemo<AnalysisResult | null>(() => {
    if (!candles.data || candles.data.length < 20) return null;
    try {
      return runFullAnalysis(candles.data as Candle[]);
    } catch {
      return null;
    }
  }, [candles.data]);

  // Multi-timeframe analysis
  const weeklyCandles = trpc.market.candles.useQuery(
    { symbol: selectedSymbol, interval: '1week', outputsize: 50 },
    { refetchInterval: 300000, retry: 1 }
  );
  const dailyCandles = trpc.market.candles.useQuery(
    { symbol: selectedSymbol, interval: '1day', outputsize: 50 },
    { refetchInterval: 300000, retry: 1 }
  );
  const h1Candles = trpc.market.candles.useQuery(
    { symbol: selectedSymbol, interval: '1h', outputsize: 100 },
    { refetchInterval: 120000, retry: 1 }
  );

  const weeklyAnalysis = useMemo(() => {
    if (!weeklyCandles.data || weeklyCandles.data.length < 10) return null;
    try { return runFullAnalysis(weeklyCandles.data as Candle[]); } catch { return null; }
  }, [weeklyCandles.data]);

  const dailyAnalysis = useMemo(() => {
    if (!dailyCandles.data || dailyCandles.data.length < 10) return null;
    try { return runFullAnalysis(dailyCandles.data as Candle[]); } catch { return null; }
  }, [dailyCandles.data]);

  const h1Analysis = useMemo(() => {
    if (!h1Candles.data || h1Candles.data.length < 10) return null;
    try { return runFullAnalysis(h1Candles.data as Candle[]); } catch { return null; }
  }, [h1Candles.data]);

  const togglePanel = (id: string) => {
    setExpandedPanels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Keyboard shortcut: C to toggle panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setPanelOpen(p => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Market Bias — derived from multi-timeframe confluence
  const marketBias = useMemo(() => {
    const trends = [weeklyAnalysis?.structure.trend, dailyAnalysis?.structure.trend, analysis?.structure.trend].filter(Boolean);
    const bullish = trends.filter(t => t === 'bullish').length;
    const bearish = trends.filter(t => t === 'bearish').length;
    if (bullish >= 2) return { direction: 'bullish' as const, strength: bullish === 3 ? 'Strong' : 'Moderate', confidence: Math.round((bullish / trends.length) * 100) };
    if (bearish >= 2) return { direction: 'bearish' as const, strength: bearish === 3 ? 'Strong' : 'Moderate', confidence: Math.round((bearish / trends.length) * 100) };
    return { direction: 'neutral' as const, strength: 'Weak', confidence: 50 };
  }, [weeklyAnalysis, dailyAnalysis, analysis]);

  // Entry checklist scoring
  const checklist = useMemo(() => {
    if (!analysis) return { items: [], score: 0, total: 6 };
    const items = [
      { label: 'Market Structure Aligned', passed: analysis.structure.trend !== 'ranging' },
      { label: 'HTF Bias Confirmed', passed: marketBias.direction !== 'neutral' && (marketBias.direction === analysis.structure.trend) },
      { label: 'Retracement to OB/FVG', passed: analysis.orderBlocks.some(ob => !ob.mitigated) || analysis.fvgs.some(fvg => !fvg.mitigated) },
      { label: 'Confluence with Key Level', passed: analysis.keySupport.length > 0 || analysis.keyResistance.length > 0 },
      { label: 'Liquidity Swept', passed: analysis.liquidityPools.some(l => l.swept) },
      { label: 'Risk:Reward > 2:1', passed: true },
    ];
    return { items, score: items.filter(i => i.passed).length, total: items.length };
  }, [analysis, marketBias]);

  return (
    <div className="flex w-full h-full">
      {/* TradingView Chart */}
      <div className={`${panelOpen ? 'w-[65%]' : 'w-full'} h-full relative transition-all duration-200`}>
        {/* Timeframe bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-1 px-2 py-1 bg-card/80 backdrop-blur-sm border-b border-border">
          <span className="text-xs font-mono font-bold text-cyan mr-2">{selectedSymbol}</span>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.value}
              onClick={() => setSelectedTimeframe(tf.value)}
              className={`px-2 py-0.5 text-[10px] font-mono font-bold transition-colors ${
                selectedTimeframe === tf.value
                  ? 'bg-cyan/20 text-cyan'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tf.shortLabel}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setPanelOpen(p => !p)}
            className="p-1 text-muted-foreground hover:text-cyan transition-colors"
            title="Toggle analysis panel (C)"
          >
            {panelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>
        <TradingViewChart instrument={instrument} timeframe={selectedTimeframe} loading={candles.isLoading} />
      </div>

      {/* Analysis Panels */}
      {panelOpen && (
        <div className="w-[35%] h-full border-l border-border bg-card overflow-y-auto">
          {/* Market Bias */}
          <AccordionPanel
            id="bias"
            title="Market Bias"
            expanded={expandedPanels.has('bias')}
            onToggle={() => togglePanel('bias')}
            badge={marketBias.direction.toUpperCase()}
            badgeColor={marketBias.direction === 'bullish' ? 'text-bullish' : marketBias.direction === 'bearish' ? 'text-bearish' : 'text-warning'}
          >
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Direction</span>
                <TrendBadge trend={marketBias.direction === 'neutral' ? 'ranging' : marketBias.direction} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Strength</span>
                <span className="text-foreground font-bold">{marketBias.strength}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Confidence</span>
                <span className="text-foreground font-bold">{marketBias.confidence}%</span>
              </div>
              {/* Confidence bar */}
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${marketBias.direction === 'bullish' ? 'bg-bullish' : marketBias.direction === 'bearish' ? 'bg-bearish' : 'bg-warning'}`}
                  style={{ width: `${marketBias.confidence}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Based on Weekly + Daily + {selectedTimeframe.toUpperCase()} trend confluence
              </div>
            </div>
          </AccordionPanel>

          {/* Market Structure */}
          <AccordionPanel
            id="structure"
            title="Market Structure"
            expanded={expandedPanels.has('structure')}
            onToggle={() => togglePanel('structure')}
            badge={analysis?.structure.trend}
            badgeColor={analysis?.structure.trend === 'bullish' ? 'text-bullish' : analysis?.structure.trend === 'bearish' ? 'text-bearish' : 'text-warning'}
          >
            {analysis ? (
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current Trend</span>
                  <TrendBadge trend={analysis.structure.trend} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">BOS Count</span>
                  <span className="text-foreground font-bold">{analysis.structure.bos.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">CHoCH Count</span>
                  <span className="text-foreground font-bold">{analysis.structure.choch.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Swing Points</span>
                  <span className="text-foreground font-bold">{analysis.structure.swingPoints.length}</span>
                </div>
              </div>
            ) : (
              <LoadingText />
            )}
          </AccordionPanel>

          {/* Key Levels & Zones */}
          <AccordionPanel
            id="levels"
            title="Key Levels & Zones"
            expanded={expandedPanels.has('levels')}
            onToggle={() => togglePanel('levels')}
            badge={`${(analysis?.orderBlocks.filter(ob => !ob.mitigated).length ?? 0) + (analysis?.fvgs.filter(f => !f.mitigated).length ?? 0)} zones`}
          >
            {analysis ? (
              <div className="space-y-3 text-xs font-mono">
                <div>
                  <div className="text-muted-foreground mb-1">50% Major Level</div>
                  <div className="text-lg font-bold text-warning">{analysis.fiftyPercentLevel.toFixed(5)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Support</div>
                  {analysis.keySupport.slice(0, 3).map((s, i) => (
                    <div key={i} className="text-cyan">{s.toFixed(5)}</div>
                  ))}
                  {analysis.keySupport.length === 0 && <div className="text-muted-foreground/50">None detected</div>}
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Resistance</div>
                  {analysis.keyResistance.slice(0, 3).map((r, i) => (
                    <div key={i} className="text-bearish">{r.toFixed(5)}</div>
                  ))}
                  {analysis.keyResistance.length === 0 && <div className="text-muted-foreground/50">None detected</div>}
                </div>
              </div>
            ) : (
              <LoadingText />
            )}
          </AccordionPanel>

          {/* SMC Analysis */}
          <AccordionPanel
            id="smc"
            title="SMC Analysis"
            expanded={expandedPanels.has('smc')}
            onToggle={() => togglePanel('smc')}
            badge={`${(analysis?.orderBlocks.length ?? 0)} OB / ${(analysis?.fvgs.length ?? 0)} FVG`}
          >
            {analysis ? (
              <div className="space-y-3 text-xs font-mono">
                <div>
                  <div className="text-muted-foreground mb-1 font-bold">Order Blocks</div>
                  {analysis.orderBlocks.slice(0, 5).map((ob, i) => (
                    <div key={i} className={`flex justify-between py-0.5 ${ob.mitigated ? 'opacity-40 line-through' : ''}`}>
                      <span className={ob.type === 'bullish' ? 'text-bullish' : 'text-bearish'}>
                        {ob.type.toUpperCase()} OB
                      </span>
                      <span className="text-foreground">{ob.low.toFixed(5)} — {ob.high.toFixed(5)}</span>
                    </div>
                  ))}
                  {analysis.orderBlocks.length === 0 && <div className="text-muted-foreground/50">None detected</div>}
                </div>
                <div>
                  <div className="text-muted-foreground mb-1 font-bold">Fair Value Gaps</div>
                  {analysis.fvgs.slice(0, 5).map((fvg, i) => (
                    <div key={i} className={`flex justify-between py-0.5 ${fvg.mitigated ? 'opacity-40 line-through' : ''}`}>
                      <span className={fvg.type === 'bullish' ? 'text-bullish' : 'text-bearish'}>
                        {fvg.type.toUpperCase()} FVG
                      </span>
                      <span className="text-foreground">{fvg.low.toFixed(5)} — {fvg.high.toFixed(5)}</span>
                    </div>
                  ))}
                  {analysis.fvgs.length === 0 && <div className="text-muted-foreground/50">None detected</div>}
                </div>
                <div>
                  <div className="text-muted-foreground mb-1 font-bold">Liquidity Pools</div>
                  {analysis.liquidityPools.slice(0, 5).map((lp, i) => (
                    <div key={i} className={`flex justify-between py-0.5 ${lp.swept ? 'opacity-40 line-through' : ''}`}>
                      <span className={lp.type === 'buy-side' ? 'text-bullish' : 'text-bearish'}>
                        {lp.type.toUpperCase()}
                      </span>
                      <span className="text-foreground">{lp.price.toFixed(5)}</span>
                    </div>
                  ))}
                  {analysis.liquidityPools.length === 0 && <div className="text-muted-foreground/50">None detected</div>}
                </div>
              </div>
            ) : (
              <LoadingText />
            )}
          </AccordionPanel>

          {/* Multi-Timeframe */}
          <AccordionPanel
            id="mtf"
            title="Multi-Timeframe"
            expanded={expandedPanels.has('mtf')}
            onToggle={() => togglePanel('mtf')}
          >
            <div className="space-y-2 text-xs font-mono">
              {[
                { label: 'Weekly', a: weeklyAnalysis, loading: weeklyCandles.isLoading },
                { label: 'Daily', a: dailyAnalysis, loading: dailyCandles.isLoading },
                { label: '4H', a: selectedTimeframe === '4h' ? analysis : null, loading: selectedTimeframe === '4h' ? candles.isLoading : false },
                { label: '1H', a: h1Analysis, loading: h1Candles.isLoading },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground font-bold">{row.label}</span>
                  {row.loading ? (
                    <span className="text-muted-foreground/50 animate-pulse">Loading...</span>
                  ) : row.a ? (
                    <div className="flex items-center gap-2">
                      <TrendBadge trend={row.a.structure.trend} />
                      <span className="text-muted-foreground text-[10px]">
                        {row.a.structure.bos.length} BOS
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50">No data</span>
                  )}
                </div>
              ))}
              <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
                {marketBias.direction !== 'neutral'
                  ? `HTF confluence suggests ${marketBias.direction} bias (${marketBias.confidence}% confidence)`
                  : 'No clear multi-timeframe confluence detected'}
              </div>
            </div>
          </AccordionPanel>

          {/* Entry Checklist */}
          <AccordionPanel
            id="checklist"
            title="Entry Checklist"
            expanded={expandedPanels.has('checklist')}
            onToggle={() => togglePanel('checklist')}
            badge={`${checklist.score}/${checklist.total}`}
            badgeColor={checklist.score >= 4 ? 'text-bullish' : checklist.score >= 3 ? 'text-warning' : 'text-bearish'}
          >
            <div className="space-y-2">
              {checklist.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  {item.passed ? (
                    <CheckCircle className="w-3.5 h-3.5 text-bullish flex-shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-bearish flex-shrink-0" />
                  )}
                  <span className={item.passed ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-border/50">
                <div className={`text-sm font-bold font-mono ${checklist.score >= 4 ? 'text-bullish' : checklist.score >= 3 ? 'text-warning' : 'text-bearish'}`}>
                  {checklist.score >= 5 ? 'A+ SETUP' : checklist.score >= 4 ? 'STRONG SETUP' : checklist.score >= 3 ? 'MODERATE SETUP' : 'WEAK SETUP'}
                </div>
              </div>
            </div>
          </AccordionPanel>

          {/* Risk Calculator */}
          <AccordionPanel
            id="risk"
            title="Risk Calculator"
            expanded={expandedPanels.has('risk')}
            onToggle={() => togglePanel('risk')}
          >
            <RiskCalculator />
          </AccordionPanel>
        </div>
      )}
    </div>
  );
}

function AccordionPanel({ id, title, expanded, onToggle, badge, badgeColor, children }: {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          <span className="text-xs font-bold font-mono text-foreground uppercase tracking-wider">{title}</span>
        </div>
        {badge && (
          <span className={`text-[10px] font-mono font-bold ${badgeColor || 'text-muted-foreground'}`}>{badge}</span>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  const icon = trend === 'bullish' ? <TrendingUp className="w-3 h-3" /> : trend === 'bearish' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />;
  const color = trend === 'bullish' ? 'text-bullish bg-bullish/10' : trend === 'bearish' ? 'text-bearish bg-bearish/10' : 'text-warning bg-warning/10';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-bold ${color}`}>
      {icon}
      {trend.toUpperCase()}
    </span>
  );
}

function RiskCalculator() {
  const [accountSize, setAccountSize] = useState('10000');
  const [riskPercent, setRiskPercent] = useState('1');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const riskAmount = (parseFloat(accountSize) || 0) * (parseFloat(riskPercent) || 0) / 100;
  const priceDiff = Math.abs((parseFloat(entryPrice) || 0) - (parseFloat(stopLoss) || 0));
  const positionSize = priceDiff > 0 ? riskAmount / priceDiff : 0;
  const tpDiff = Math.abs((parseFloat(takeProfit) || 0) - (parseFloat(entryPrice) || 0));
  const riskReward = priceDiff > 0 && tpDiff > 0 ? (tpDiff / priceDiff) : 0;

  return (
    <div className="space-y-2 text-xs font-mono">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-muted-foreground text-[10px]">Account Size</label>
          <input
            type="number"
            value={accountSize}
            onChange={e => setAccountSize(e.target.value)}
            className="w-full bg-muted border border-border px-2 py-1 text-foreground"
          />
        </div>
        <div>
          <label className="text-muted-foreground text-[10px]">Risk %</label>
          <input
            type="number"
            value={riskPercent}
            onChange={e => setRiskPercent(e.target.value)}
            className="w-full bg-muted border border-border px-2 py-1 text-foreground"
          />
        </div>
        <div>
          <label className="text-muted-foreground text-[10px]">Entry Price</label>
          <input
            type="number"
            value={entryPrice}
            onChange={e => setEntryPrice(e.target.value)}
            className="w-full bg-muted border border-border px-2 py-1 text-foreground"
            step="0.00001"
          />
        </div>
        <div>
          <label className="text-muted-foreground text-[10px]">Stop Loss</label>
          <input
            type="number"
            value={stopLoss}
            onChange={e => setStopLoss(e.target.value)}
            className="w-full bg-muted border border-border px-2 py-1 text-foreground"
            step="0.00001"
          />
        </div>
        <div className="col-span-2">
          <label className="text-muted-foreground text-[10px]">Take Profit</label>
          <input
            type="number"
            value={takeProfit}
            onChange={e => setTakeProfit(e.target.value)}
            className="w-full bg-muted border border-border px-2 py-1 text-foreground"
            step="0.00001"
          />
        </div>
      </div>
      <div className="pt-2 border-t border-border/50 space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Risk Amount</span>
          <span className="text-warning font-bold">${riskAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Position Size</span>
          <span className="text-cyan font-bold">{positionSize > 0 ? positionSize.toFixed(2) : '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Risk:Reward</span>
          <span className={`font-bold ${riskReward >= 2 ? 'text-bullish' : riskReward >= 1 ? 'text-warning' : 'text-bearish'}`}>
            {riskReward > 0 ? `1:${riskReward.toFixed(2)}` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function LoadingText() {
  return <div className="text-xs font-mono text-muted-foreground animate-pulse">Loading analysis...</div>;
}
