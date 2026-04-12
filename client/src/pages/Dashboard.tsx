/**
 * SMC Trading Dashboard — Main Page
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 * 
 * Layout: Left sidebar (instrument selector) + Main area (TradingView chart top 55%, analysis grid bottom 45%)
 * Colors: Deep charcoal #0A0A0F, electric cyan #00E5FF accent, sharp 0px radius everywhere
 * Mobile: Sidebar collapses, analysis panels stack vertically
 * 
 * TradingView Advanced Chart widget for charting.
 * SMC analysis engine runs on Yahoo Finance data via backend (no API key needed).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { INSTRUMENTS, TIMEFRAMES, fetchCandles, fetchQuote } from '@/lib/marketData';
import type { Instrument, Timeframe } from '@/lib/marketData';
import type { Candle, AnalysisResult } from '@/lib/smcAnalysis';
import { runFullAnalysis } from '@/lib/smcAnalysis';
import TradingViewChart from '@/components/TradingViewChart';
import MarketStructurePanel from '@/components/MarketStructurePanel';
import KeyLevelsPanel from '@/components/KeyLevelsPanel';
import EntryChecklistPanel from '@/components/EntryChecklistPanel';
import RiskManagementPanel from '@/components/RiskManagementPanel';
import AlertGeneratorPanel from '@/components/AlertGeneratorPanel';
import { RefreshCw, Zap, TrendingUp, TrendingDown, Minus, Search, Menu, X, Bell } from 'lucide-react';

type BottomTab = 'structure' | 'levels' | 'checklist' | 'risk' | 'alerts';

export default function Dashboard() {
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument>(INSTRUMENTS[0]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('4h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ price: number; change: number; percentChange: number } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<BottomTab>('checklist');

  // Multi-timeframe analysis state
  const [weeklyTrend, setWeeklyTrend] = useState<string>('—');
  const [dailyTrend, setDailyTrend] = useState<string>('—');

  const filteredInstruments = useMemo(() => {
    if (!searchQuery) return INSTRUMENTS;
    const q = searchQuery.toLowerCase();
    return INSTRUMENTS.filter(i =>
      i.displaySymbol.toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q) ||
      i.type.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [candleData, quoteData] = await Promise.all([
        fetchCandles(selectedInstrument.symbol, selectedTimeframe, 200),
        fetchQuote(selectedInstrument.symbol).catch(() => null),
      ]);
      
      setCandles(candleData);
      if (quoteData) setQuote(quoteData);
      
      // Run SMC analysis
      const result = runFullAnalysis(candleData);
      setAnalysis(result);
      setLastUpdated(new Date());
      
      // Fetch multi-timeframe trends
      try {
        const [weeklyCandles, dailyCandles] = await Promise.all([
          fetchCandles(selectedInstrument.symbol, '1week', 50),
          fetchCandles(selectedInstrument.symbol, '1day', 50),
        ]);
        const weeklyAnalysis = runFullAnalysis(weeklyCandles);
        const dailyAnalysis = runFullAnalysis(dailyCandles);
        setWeeklyTrend(weeklyAnalysis.structure.trend);
        setDailyTrend(dailyAnalysis.structure.trend);
      } catch {
        // Multi-TF analysis is supplementary
      }
      
    } catch (err: any) {
      const msg = err.message || 'Failed to load data';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedInstrument, selectedTimeframe]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const trendIcon = (trend: string) => {
    if (trend === 'bullish') return <TrendingUp className="w-4 h-4 text-bullish" />;
    if (trend === 'bearish') return <TrendingDown className="w-4 h-4 text-bearish" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const trendColor = (trend: string) => {
    if (trend === 'bullish') return 'text-bullish';
    if (trend === 'bearish') return 'text-bearish';
    return 'text-muted-foreground';
  };

  const panelTabs: { key: BottomTab; label: string; icon?: React.ReactNode }[] = [
    { key: 'structure', label: 'STRUCTURE' },
    { key: 'levels', label: 'LEVELS' },
    { key: 'checklist', label: 'CHECKLIST' },
    { key: 'risk', label: 'RISK' },
    { key: 'alerts', label: 'ALERTS', icon: <Bell className="w-3 h-3" /> },
  ];

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* LEFT SIDEBAR — Instrument Selector (hidden on mobile) */}
      <aside className={`hidden lg:flex ${sidebarCollapsed ? 'w-16' : 'w-64'} border-r-4 border-border bg-card flex-col transition-all duration-200`}>
        {/* Sidebar Header */}
        <div className="px-4 py-4 border-b-4 border-border flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan" />
              <span className="text-sm font-bold uppercase tracking-[0.1em] text-foreground">SMC</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-muted-foreground hover:text-cyan transition-colors p-1"
          >
            {sidebarCollapsed ? <Zap className="w-5 h-5" /> : <span className="text-xs">{'<<'}</span>}
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            {/* Search */}
            <div className="px-3 py-3 border-b-4 border-border">
              <div className="flex items-center gap-2 bg-muted px-3 py-2">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full font-mono"
                />
              </div>
            </div>

            {/* Instrument List */}
            <div className="flex-1 overflow-y-auto">
              {['forex', 'crypto', 'commodity'].map(type => {
                const items = filteredInstruments.filter(i => i.type === type);
                if (items.length === 0) return null;
                return (
                  <div key={type}>
                    <div className="px-4 py-2 section-label border-b border-border/50">
                      {type === 'commodity' ? 'METALS' : type.toUpperCase()}
                    </div>
                    {items.map(inst => (
                      <button
                        key={inst.symbol}
                        onClick={() => setSelectedInstrument(inst)}
                        className={`w-full text-left px-4 py-3 border-b border-border/30 transition-all duration-100 ${
                          selectedInstrument.symbol === inst.symbol
                            ? 'bg-accent glow-border-left text-accent-foreground'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div className="text-sm font-bold font-mono">{inst.displaySymbol}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{inst.name}</div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </aside>

      {/* MOBILE SIDEBAR OVERLAY */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r-4 border-border flex flex-col z-10">
            <div className="px-4 py-4 border-b-4 border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan" />
                <span className="text-sm font-bold uppercase tracking-[0.1em] text-foreground">SMC</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-3 py-3 border-b-4 border-border">
              <div className="flex items-center gap-2 bg-muted px-3 py-2">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full font-mono"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {['forex', 'crypto', 'commodity'].map(type => {
                const items = filteredInstruments.filter(i => i.type === type);
                if (items.length === 0) return null;
                return (
                  <div key={type}>
                    <div className="px-4 py-2 section-label border-b border-border/50">
                      {type === 'commodity' ? 'METALS' : type.toUpperCase()}
                    </div>
                    {items.map(inst => (
                      <button
                        key={inst.symbol}
                        onClick={() => { setSelectedInstrument(inst); setMobileMenuOpen(false); }}
                        className={`w-full text-left px-4 py-3 border-b border-border/30 transition-all duration-100 ${
                          selectedInstrument.symbol === inst.symbol
                            ? 'bg-accent glow-border-left text-accent-foreground'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div className="text-sm font-bold font-mono">{inst.displaySymbol}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{inst.name}</div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <header className="border-b-4 border-border bg-card px-3 lg:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 lg:gap-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-muted-foreground hover:text-cyan transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Symbol & Price */}
            <div className="flex items-center gap-2 lg:gap-4">
              <h1 className="text-base lg:text-xl font-bold font-mono text-foreground">
                {selectedInstrument.displaySymbol}
              </h1>
              {quote && (
                <div className="flex items-center gap-2 lg:gap-3">
                  <span className="text-lg lg:text-2xl font-bold font-mono price-display text-foreground">
                    {quote.price.toFixed(selectedInstrument.type === 'crypto' ? 2 : selectedInstrument.symbol.includes('JPY') ? 3 : 5)}
                  </span>
                  <span className={`text-xs lg:text-sm font-mono font-bold ${quote.change >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                    {quote.change >= 0 ? '+' : ''}{quote.percentChange.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            {/* Multi-TF Trend Summary — hidden on small screens */}
            <div className="hidden xl:flex items-center gap-4 border-l-4 border-border pl-6">
              <div className="flex items-center gap-1.5">
                <span className="section-label">W</span>
                {trendIcon(weeklyTrend)}
                <span className={`text-xs font-bold uppercase ${trendColor(weeklyTrend)}`}>{weeklyTrend}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="section-label">D</span>
                {trendIcon(dailyTrend)}
                <span className={`text-xs font-bold uppercase ${trendColor(dailyTrend)}`}>{dailyTrend}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            {/* Timeframe Selector */}
            <div className="flex border-4 border-border">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => setSelectedTimeframe(tf.value)}
                  className={`px-2 lg:px-3 py-1 lg:py-1.5 text-[10px] lg:text-xs font-bold font-mono uppercase transition-all duration-100 ${
                    selectedTimeframe === tf.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                  } ${tf.value !== TIMEFRAMES[TIMEFRAMES.length - 1].value ? 'border-r-2 border-border' : ''}`}
                >
                  {tf.shortLabel}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-muted-foreground hover:text-cyan transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Last Updated — hidden on mobile */}
            {lastUpdated && (
              <span className="hidden lg:inline text-[10px] text-muted-foreground font-mono">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {error && !candles.length ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 border-4 border-bearish/30 flex items-center justify-center">
                  <X className="w-8 h-8 text-bearish" />
                </div>
                <p className="text-bearish font-mono text-sm mb-2">CONNECTION ERROR</p>
                <p className="text-muted-foreground text-xs font-mono mb-6">{error}</p>
                <button
                  onClick={loadData}
                  className="px-6 py-3 bg-muted text-foreground font-bold text-sm uppercase tracking-wider hover:bg-muted/80 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* TRADINGVIEW CHART AREA */}
              <div className="h-[50%] lg:h-[55%] border-b-4 border-border">
                <TradingViewChart
                  instrument={selectedInstrument}
                  timeframe={selectedTimeframe}
                  loading={loading}
                />
              </div>

              {/* ANALYSIS PANELS */}
              {/* Desktop: 5-column grid with alert panel */}
              <div className="hidden lg:grid h-[45%] grid-cols-5 overflow-hidden">
                <div className="border-r-4 border-border overflow-y-auto">
                  <MarketStructurePanel
                    analysis={analysis}
                    weeklyTrend={weeklyTrend}
                    dailyTrend={dailyTrend}
                    currentTF={TIMEFRAMES.find(t => t.value === selectedTimeframe)?.label || ''}
                  />
                </div>
                <div className="border-r-4 border-border overflow-y-auto">
                  <KeyLevelsPanel analysis={analysis} instrument={selectedInstrument} />
                </div>
                <div className="border-r-4 border-border overflow-y-auto">
                  <EntryChecklistPanel analysis={analysis} />
                </div>
                <div className="border-r-4 border-border overflow-y-auto">
                  <RiskManagementPanel analysis={analysis} instrument={selectedInstrument} currentPrice={quote?.price || candles[candles.length - 1]?.close || 0} />
                </div>
                <div className="overflow-y-auto">
                  <AlertGeneratorPanel analysis={analysis} instrument={selectedInstrument} currentPrice={quote?.price || candles[candles.length - 1]?.close || 0} />
                </div>
              </div>

              {/* Mobile: Tabbed panels */}
              <div className="lg:hidden h-[50%] flex flex-col overflow-hidden">
                {/* Tab bar */}
                <div className="flex border-b-4 border-border bg-card">
                  {panelTabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActivePanel(tab.key)}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                        activePanel === tab.key
                          ? 'text-cyan border-b-2 border-cyan bg-cyan/5'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
                {/* Panel content */}
                <div className="flex-1 overflow-y-auto">
                  {activePanel === 'structure' && (
                    <MarketStructurePanel
                      analysis={analysis}
                      weeklyTrend={weeklyTrend}
                      dailyTrend={dailyTrend}
                      currentTF={TIMEFRAMES.find(t => t.value === selectedTimeframe)?.label || ''}
                    />
                  )}
                  {activePanel === 'levels' && (
                    <KeyLevelsPanel analysis={analysis} instrument={selectedInstrument} />
                  )}
                  {activePanel === 'checklist' && (
                    <EntryChecklistPanel analysis={analysis} />
                  )}
                  {activePanel === 'risk' && (
                    <RiskManagementPanel analysis={analysis} instrument={selectedInstrument} currentPrice={quote?.price || candles[candles.length - 1]?.close || 0} />
                  )}
                  {activePanel === 'alerts' && (
                    <AlertGeneratorPanel analysis={analysis} instrument={selectedInstrument} currentPrice={quote?.price || candles[candles.length - 1]?.close || 0} />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
