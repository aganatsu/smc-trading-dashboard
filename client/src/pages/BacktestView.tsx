/**
 * BacktestView — Production-grade strategy backtesting workstation
 *
 * Full parameter controls for every strategy dimension:
 * - Strategy (BOS, CHoCH, OB, FVG, Liquidity, Premium/Discount)
 * - Risk Management (risk %, max DD, position sizing, R:R)
 * - Entry Rules (order type, cooldown, pyramiding, close-on-reverse)
 * - Exit Rules (SL/TP methods, trailing stop, break-even, partial TP, time exit)
 * - Session Filters (London, NY, Asian, Sydney, active days)
 * - Date Range & Timeframe
 *
 * Results dashboard with:
 * - Key metrics row, equity + drawdown overlay chart
 * - Monthly P&L heatmap, setup distribution, exit distribution
 * - Long vs Short breakdown, best/worst trade
 * - Trade-by-trade table with expandable reasoning
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  FlaskConical, Play, Loader2, TrendingUp, TrendingDown,
  BarChart3, Target, AlertTriangle, ChevronDown, ChevronRight,
  Trophy, Skull, Minus, Settings2, Shield, LogIn, LogOut,
  Clock, Zap, Calendar, ArrowUpDown, Filter, PieChart,
  Crosshair, RotateCcw, Save, GitCompare, Trash2, X, Layers,
} from "lucide-react";

// ─── Saved Run Types ─────────────────────────────────────────────

interface SavedRun {
  id: string;
  label: string;
  savedAt: number; // timestamp
  symbol: string;
  timeframe: string;
  lookbackMonths: number;
  totalTrades: number;
  winRate: number;
  netProfitPercent: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  expectancy: number;
  averageRR: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  longWinRate: number;
  shortWinRate: number;
  configSnapshot: { minConfluence: number; riskPerTrade: number; minRR: number; slMethod: string; tpMethod: string };
}

const STORAGE_KEY = "smc_backtest_saved_runs";

function loadSavedRuns(): SavedRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistSavedRuns(runs: SavedRun[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

// ─── Constants ────────────────────────────────────────────────────

const SYMBOLS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "GBP/JPY", "AUD/USD",
  "USD/CAD", "EUR/GBP", "NZD/USD", "XAU/USD", "BTC/USD",
];

const TIMEFRAMES = [
  { value: "5m", label: "5 Min" },
  { value: "15m", label: "15 Min" },
  { value: "1h", label: "1 Hour" },
  { value: "4h", label: "4 Hours" },
  { value: "1day", label: "Daily" },
];

const SL_METHODS = [
  { value: "fixed_pips", label: "Fixed Pips" },
  { value: "atr_based", label: "ATR Based" },
  { value: "structure", label: "Structure" },
  { value: "below_ob", label: "Below OB" },
];

const TP_METHODS = [
  { value: "fixed_pips", label: "Fixed Pips" },
  { value: "rr_ratio", label: "R:R Ratio" },
  { value: "next_level", label: "Next Level" },
  { value: "atr_multiple", label: "ATR Multiple" },
];

const POS_SIZING = [
  { value: "percent_risk", label: "% Risk" },
  { value: "fixed_lots", label: "Fixed Lots" },
  { value: "kelly", label: "Kelly Criterion" },
];

const ORDER_TYPES = [
  { value: "market", label: "Market" },
  { value: "limit", label: "Limit" },
  { value: "stop", label: "Stop" },
];

const DAYS = ["mon", "tue", "wed", "thu", "fri"];
const DAY_LABELS: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri" };

// ─── Config State Types ───────────────────────────────────────────

interface StrategyConfig {
  enableBOS: boolean;
  enableCHoCH: boolean;
  enableOB: boolean;
  enableFVG: boolean;
  enableLiquiditySweep: boolean;
  minConfluenceScore: number;
  htfBiasRequired: boolean;
  premiumDiscountEnabled: boolean;
  onlyBuyInDiscount: boolean;
  onlySellInPremium: boolean;
  liquiditySweepRequired: boolean;
}

interface RiskConfig {
  riskPerTrade: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  positionSizingMethod: "fixed_lots" | "percent_risk" | "kelly";
  fixedLotSize: number;
  maxOpenPositions: number;
  minRiskReward: number;
}

interface EntryConfig {
  defaultOrderType: "market" | "limit" | "stop";
  closeOnReverse: boolean;
  cooldownMinutes: number;
  pyramidingEnabled: boolean;
}

interface ExitConfig {
  takeProfitMethod: "fixed_pips" | "rr_ratio" | "next_level" | "atr_multiple";
  fixedTPPips: number;
  tpRRRatio: number;
  stopLossMethod: "fixed_pips" | "atr_based" | "structure" | "below_ob";
  fixedSLPips: number;
  trailingStopEnabled: boolean;
  trailingStopPips: number;
  breakEvenEnabled: boolean;
  breakEvenTriggerPips: number;
  partialTPEnabled: boolean;
  partialTPPercent: number;
  partialTPLevel: number;
  timeBasedExitEnabled: boolean;
  maxHoldHours: number;
}

interface SessionConfig {
  londonEnabled: boolean;
  newYorkEnabled: boolean;
  asianEnabled: boolean;
  sydneyEnabled: boolean;
  activeDays: Record<string, boolean>;
}

// ─── Defaults ─────────────────────────────────────────────────────

const DEFAULT_STRATEGY: StrategyConfig = {
  enableBOS: true, enableCHoCH: true, enableOB: true, enableFVG: true,
  enableLiquiditySweep: true, minConfluenceScore: 6, htfBiasRequired: true,
  premiumDiscountEnabled: true, onlyBuyInDiscount: true, onlySellInPremium: true,
  liquiditySweepRequired: false,
};

const DEFAULT_RISK: RiskConfig = {
  riskPerTrade: 1, maxDailyLoss: 5, maxDrawdown: 15,
  positionSizingMethod: "percent_risk", fixedLotSize: 0.1,
  maxOpenPositions: 3, minRiskReward: 2,
};

const DEFAULT_ENTRY: EntryConfig = {
  defaultOrderType: "market", closeOnReverse: true,
  cooldownMinutes: 30, pyramidingEnabled: false,
};

const DEFAULT_EXIT: ExitConfig = {
  takeProfitMethod: "rr_ratio", fixedTPPips: 30, tpRRRatio: 2,
  stopLossMethod: "structure", fixedSLPips: 20,
  trailingStopEnabled: false, trailingStopPips: 15,
  breakEvenEnabled: true, breakEvenTriggerPips: 20,
  partialTPEnabled: false, partialTPPercent: 50, partialTPLevel: 1,
  timeBasedExitEnabled: false, maxHoldHours: 48,
};

const DEFAULT_SESSION: SessionConfig = {
  londonEnabled: true, newYorkEnabled: true, asianEnabled: false, sydneyEnabled: false,
  activeDays: { mon: true, tue: true, wed: true, thu: true, fri: true },
};

// ─── Main Component ───────────────────────────────────────────────

export default function BacktestView() {
  // Core settings
  const [symbol, setSymbol] = useState("EUR/USD");
  const [timeframe, setTimeframe] = useState("1h");
  const [initialBalance, setInitialBalance] = useState(10000);
  const [lookbackMonths, setLookbackMonths] = useState(3);
  const [useCurrentConfig, setUseCurrentConfig] = useState(true);

  // Config overrides
  const [strategy, setStrategy] = useState<StrategyConfig>({ ...DEFAULT_STRATEGY });
  const [risk, setRisk] = useState<RiskConfig>({ ...DEFAULT_RISK });
  const [entry, setEntry] = useState<EntryConfig>({ ...DEFAULT_ENTRY });
  const [exit, setExit] = useState<ExitConfig>({ ...DEFAULT_EXIT });
  const [session, setSession] = useState<SessionConfig>({ ...DEFAULT_SESSION });

  // Spread & slippage simulation
  const [useRealisticSpread, setUseRealisticSpread] = useState(true);
  const [customSpreadPips, setCustomSpreadPips] = useState(0);
  const [slippagePips, setSlippagePips] = useState(0.5);

  // UI state
  const [expandedConfig, setExpandedConfig] = useState<Set<string>>(new Set(["general"]));
  const [expandedResults, setExpandedResults] = useState<Set<string>>(
    new Set(["metrics", "equity", "monthly", "trades"])
  );
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);

  // Comparison mode state
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>(() => loadSavedRuns());
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Persist saved runs to localStorage
  useEffect(() => { persistSavedRuns(savedRuns); }, [savedRuns]);

  const runBacktest = trpc.backtest.run.useMutation();
  const progress = trpc.backtest.progress.useQuery(undefined, {
    refetchInterval: runBacktest.isPending ? 500 : false,
  });

  const result = runBacktest.data;

  const handleSaveRun = useCallback(() => {
    if (!result || result.status !== "completed") return;
    const label = saveLabel.trim() || `${result.symbol} ${result.timeframe} ${new Date().toLocaleString()}`;
    const run: SavedRun = {
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label,
      savedAt: Date.now(),
      symbol: result.symbol,
      timeframe: result.timeframe,
      lookbackMonths,
      totalTrades: result.totalTrades,
      winRate: result.winRate,
      netProfitPercent: result.netProfitPercent,
      profitFactor: result.profitFactor,
      maxDrawdownPercent: result.maxDrawdownPercent,
      sharpeRatio: result.sharpeRatio,
      expectancy: result.expectancy,
      averageRR: result.averageRR,
      maxConsecutiveWins: result.maxConsecutiveWins,
      maxConsecutiveLosses: result.maxConsecutiveLosses,
      longWinRate: result.longStats.winRate,
      shortWinRate: result.shortStats.winRate,
      configSnapshot: result.configSnapshot,
    };
    setSavedRuns(prev => [run, ...prev].slice(0, 20)); // Keep max 20 runs
    setSaveLabel("");
    setShowSaveDialog(false);
  }, [result, saveLabel, lookbackMonths]);

  const handleDeleteRun = useCallback((id: string) => {
    setSavedRuns(prev => prev.filter(r => r.id !== id));
    if (compareA === id) setCompareA(null);
    if (compareB === id) setCompareB(null);
  }, [compareA, compareB]);

  const handleClearAllRuns = useCallback(() => {
    setSavedRuns([]);
    setCompareA(null);
    setCompareB(null);
    setCompareMode(false);
  }, []);

  const runA = useMemo(() => savedRuns.find(r => r.id === compareA) || null, [savedRuns, compareA]);
  const runB = useMemo(() => savedRuns.find(r => r.id === compareB) || null, [savedRuns, compareB]);

  const toggleConfig = useCallback((id: string) => {
    setExpandedConfig(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleResult = useCallback((id: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleRun = () => {
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - lookbackMonths);

    const overrides = useCurrentConfig ? undefined : {
      strategy, risk, entry, exit, sessions: session,
    };

    runBacktest.mutate({
      symbol,
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      timeframe,
      initialBalance,
      useCurrentConfig,
      configOverrides: overrides,
      spreadPips: useRealisticSpread ? undefined : customSpreadPips,
      slippagePips,
      useRealisticSpread,
    });
  };

  const handleReset = () => {
    setStrategy({ ...DEFAULT_STRATEGY });
    setRisk({ ...DEFAULT_RISK });
    setEntry({ ...DEFAULT_ENTRY });
    setExit({ ...DEFAULT_EXIT });
    setSession({ ...DEFAULT_SESSION });
  };

  // Toggle compare selection
  const toggleCompareSelect = useCallback((id: string) => {
    if (compareA === id) { setCompareA(null); return; }
    if (compareB === id) { setCompareB(null); return; }
    if (!compareA) { setCompareA(id); return; }
    if (!compareB) { setCompareB(id); return; }
    // Both slots full, replace B
    setCompareB(id);
  }, [compareA, compareB]);

  // Equity + drawdown chart data
  const chartData = useMemo(() => {
    if (!result?.equityCurve || result.equityCurve.length === 0) return [];
    const curve = result.equityCurve;
    const maxEq = Math.max(...curve.map(p => p.equity));
    const minEq = Math.min(...curve.map(p => p.equity));
    const eqRange = maxEq - minEq || 1;
    const maxDD = Math.max(...curve.map(p => p.drawdownPercent), 1);
    return curve.map(p => ({
      ...p,
      eqHeight: ((p.equity - minEq) / eqRange) * 100,
      ddHeight: (p.drawdownPercent / maxDD) * 100,
      isProfit: p.equity >= result.initialBalance,
    }));
  }, [result]);

  const selectedTrade = useMemo(() => {
    if (!result || selectedTradeId === null) return null;
    return result.trades.find(t => t.id === selectedTradeId) || null;
  }, [result, selectedTradeId]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ═══════════════════ LEFT PANEL — CONFIG ═══════════════════ */}
      <div className="w-80 flex-shrink-0 bg-card border-r border-border overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-cyan" />
              <h2 className="text-sm font-bold font-mono text-foreground uppercase tracking-wider">Backtest Lab</h2>
            </div>
            <button
              onClick={handleReset}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              title="Reset to defaults"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={runBacktest.isPending}
            className="w-full flex items-center justify-center gap-2 bg-cyan text-background font-bold text-xs font-mono uppercase tracking-wider py-2.5 px-4 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {runBacktest.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running... {progress.data?.progress ?? 0}%
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Backtest
              </>
            )}
          </button>
        </div>

        {/* Config sections */}
        <div className="divide-y divide-border/50">
          {/* ── General ── */}
          <ConfigSection
            id="general"
            title="General"
            icon={<Settings2 className="w-3.5 h-3.5" />}
            expanded={expandedConfig.has("general")}
            onToggle={() => toggleConfig("general")}
          >
            <Field label="Symbol">
              <select value={symbol} onChange={e => setSymbol(e.target.value)} className="cfg-select">
                {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Timeframe">
              <select value={timeframe} onChange={e => setTimeframe(e.target.value)} className="cfg-select">
                {TIMEFRAMES.map(tf => <option key={tf.value} value={tf.value}>{tf.label}</option>)}
              </select>
            </Field>
            <Field label="Lookback Period">
              <div className="flex items-center gap-2">
                <input
                  type="range" min={1} max={12} value={lookbackMonths}
                  onChange={e => setLookbackMonths(Number(e.target.value))}
                  className="flex-1 accent-cyan"
                />
                <span className="text-xs font-mono text-foreground w-12 text-right">{lookbackMonths}mo</span>
              </div>
            </Field>
            <Field label="Initial Balance">
              <input
                type="number" value={initialBalance} min={100} max={10000000}
                onChange={e => setInitialBalance(Number(e.target.value))}
                className="cfg-input"
              />
            </Field>
            <Field label="Config Source">
              <div className="flex gap-1">
                <button
                  onClick={() => setUseCurrentConfig(true)}
                  className={`flex-1 text-[10px] font-mono py-1.5 px-2 border transition-colors ${
                    useCurrentConfig
                      ? "bg-cyan/20 border-cyan text-cyan font-bold"
                      : "bg-transparent border-border text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  Dashboard Config
                </button>
                <button
                  onClick={() => setUseCurrentConfig(false)}
                  className={`flex-1 text-[10px] font-mono py-1.5 px-2 border transition-colors ${
                    !useCurrentConfig
                      ? "bg-cyan/20 border-cyan text-cyan font-bold"
                      : "bg-transparent border-border text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  Custom Override
                </button>
              </div>
            </Field>
          </ConfigSection>

          {/* ── Strategy ── */}
          <ConfigSection
            id="strategy"
            title="Strategy Setups"
            icon={<Crosshair className="w-3.5 h-3.5" />}
            expanded={expandedConfig.has("strategy")}
            onToggle={() => toggleConfig("strategy")}
            disabled={useCurrentConfig}
          >
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <Toggle label="BOS" value={strategy.enableBOS} onChange={v => setStrategy(s => ({ ...s, enableBOS: v }))} />
              <Toggle label="CHoCH" value={strategy.enableCHoCH} onChange={v => setStrategy(s => ({ ...s, enableCHoCH: v }))} />
              <Toggle label="Order Blocks" value={strategy.enableOB} onChange={v => setStrategy(s => ({ ...s, enableOB: v }))} />
              <Toggle label="FVG / Imbalance" value={strategy.enableFVG} onChange={v => setStrategy(s => ({ ...s, enableFVG: v }))} />
              <Toggle label="Liquidity Sweep" value={strategy.enableLiquiditySweep} onChange={v => setStrategy(s => ({ ...s, enableLiquiditySweep: v }))} />
              <Toggle label="HTF Bias Required" value={strategy.htfBiasRequired} onChange={v => setStrategy(s => ({ ...s, htfBiasRequired: v }))} />
              <Toggle label="Premium/Discount" value={strategy.premiumDiscountEnabled} onChange={v => setStrategy(s => ({ ...s, premiumDiscountEnabled: v }))} />
              <Toggle label="Buy in Discount" value={strategy.onlyBuyInDiscount} onChange={v => setStrategy(s => ({ ...s, onlyBuyInDiscount: v }))} />
              <Toggle label="Sell in Premium" value={strategy.onlySellInPremium} onChange={v => setStrategy(s => ({ ...s, onlySellInPremium: v }))} />
              <Toggle label="Liq Sweep Req'd" value={strategy.liquiditySweepRequired} onChange={v => setStrategy(s => ({ ...s, liquiditySweepRequired: v }))} />
            </div>
            <Field label={`Min Confluence Score: ${strategy.minConfluenceScore}/10`}>
              <input
                type="range" min={1} max={10} value={strategy.minConfluenceScore}
                onChange={e => setStrategy(s => ({ ...s, minConfluenceScore: Number(e.target.value) }))}
                className="w-full accent-cyan"
              />
              <div className="flex justify-between text-[9px] font-mono text-muted-foreground mt-0.5">
                <span>Aggressive (1)</span><span>Conservative (10)</span>
              </div>
            </Field>
          </ConfigSection>

          {/* ── Risk ── */}
          <ConfigSection
            id="risk"
            title="Risk Management"
            icon={<Shield className="w-3.5 h-3.5" />}
            expanded={expandedConfig.has("risk")}
            onToggle={() => toggleConfig("risk")}
            disabled={useCurrentConfig}
          >
            <Field label={`Risk Per Trade: ${risk.riskPerTrade}%`}>
              <input
                type="range" min={0.1} max={5} step={0.1} value={risk.riskPerTrade}
                onChange={e => setRisk(r => ({ ...r, riskPerTrade: Number(e.target.value) }))}
                className="w-full accent-cyan"
              />
            </Field>
            <Field label={`Max Daily Loss: ${risk.maxDailyLoss}%`}>
              <input
                type="range" min={1} max={20} step={0.5} value={risk.maxDailyLoss}
                onChange={e => setRisk(r => ({ ...r, maxDailyLoss: Number(e.target.value) }))}
                className="w-full accent-cyan"
              />
            </Field>
            <Field label={`Max Drawdown: ${risk.maxDrawdown}%`}>
              <input
                type="range" min={0} max={50} step={1} value={risk.maxDrawdown}
                onChange={e => setRisk(r => ({ ...r, maxDrawdown: Number(e.target.value) }))}
                className="w-full accent-cyan"
              />
            </Field>
            <Field label={`Min R:R: ${risk.minRiskReward}:1`}>
              <input
                type="range" min={0.5} max={5} step={0.5} value={risk.minRiskReward}
                onChange={e => setRisk(r => ({ ...r, minRiskReward: Number(e.target.value) }))}
                className="w-full accent-cyan"
              />
            </Field>
            <Field label="Position Sizing">
              <select
                value={risk.positionSizingMethod}
                onChange={e => setRisk(r => ({ ...r, positionSizingMethod: e.target.value as any }))}
                className="cfg-select"
              >
                {POS_SIZING.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            {risk.positionSizingMethod === "fixed_lots" && (
              <Field label="Fixed Lot Size">
                <input
                  type="number" value={risk.fixedLotSize} min={0.01} max={100} step={0.01}
                  onChange={e => setRisk(r => ({ ...r, fixedLotSize: Number(e.target.value) }))}
                  className="cfg-input"
                />
              </Field>
            )}
            <Field label={`Max Open Positions: ${risk.maxOpenPositions}`}>
              <input
                type="range" min={1} max={10} value={risk.maxOpenPositions}
                onChange={e => setRisk(r => ({ ...r, maxOpenPositions: Number(e.target.value) }))}
                className="w-full accent-cyan"
              />
            </Field>
          </ConfigSection>

          {/* ── Entry Rules ── */}
          <ConfigSection
            id="entry"
            title="Entry Rules"
            icon={<LogIn className="w-3.5 h-3.5" />}
            expanded={expandedConfig.has("entry")}
            onToggle={() => toggleConfig("entry")}
            disabled={useCurrentConfig}
          >
            <Field label="Order Type">
              <select
                value={entry.defaultOrderType}
                onChange={e => setEntry(en => ({ ...en, defaultOrderType: e.target.value as any }))}
                className="cfg-select"
              >
                {ORDER_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label={`Cooldown: ${entry.cooldownMinutes} min`}>
              <input
                type="range" min={0} max={240} step={5} value={entry.cooldownMinutes}
                onChange={e => setEntry(en => ({ ...en, cooldownMinutes: Number(e.target.value) }))}
                className="w-full accent-cyan"
              />
            </Field>
            <Toggle label="Close on Reverse Signal" value={entry.closeOnReverse} onChange={v => setEntry(en => ({ ...en, closeOnReverse: v }))} />
            <Toggle label="Pyramiding" value={entry.pyramidingEnabled} onChange={v => setEntry(en => ({ ...en, pyramidingEnabled: v }))} />
          </ConfigSection>

          {/* ── Exit Rules ── */}
          <ConfigSection
            id="exit"
            title="Exit Rules"
            icon={<LogOut className="w-3.5 h-3.5" />}
            expanded={expandedConfig.has("exit")}
            onToggle={() => toggleConfig("exit")}
            disabled={useCurrentConfig}
          >
            <Field label="Stop Loss Method">
              <select
                value={exit.stopLossMethod}
                onChange={e => setExit(ex => ({ ...ex, stopLossMethod: e.target.value as any }))}
                className="cfg-select"
              >
                {SL_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            {exit.stopLossMethod === "fixed_pips" && (
              <Field label="SL Pips">
                <input type="number" value={exit.fixedSLPips} min={1} max={200}
                  onChange={e => setExit(ex => ({ ...ex, fixedSLPips: Number(e.target.value) }))}
                  className="cfg-input" />
              </Field>
            )}
            <Field label="Take Profit Method">
              <select
                value={exit.takeProfitMethod}
                onChange={e => setExit(ex => ({ ...ex, takeProfitMethod: e.target.value as any }))}
                className="cfg-select"
              >
                {TP_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            {exit.takeProfitMethod === "fixed_pips" && (
              <Field label="TP Pips">
                <input type="number" value={exit.fixedTPPips} min={1} max={500}
                  onChange={e => setExit(ex => ({ ...ex, fixedTPPips: Number(e.target.value) }))}
                  className="cfg-input" />
              </Field>
            )}
            {exit.takeProfitMethod === "rr_ratio" && (
              <Field label={`TP R:R Ratio: ${exit.tpRRRatio}:1`}>
                <input type="range" min={1} max={10} step={0.5} value={exit.tpRRRatio}
                  onChange={e => setExit(ex => ({ ...ex, tpRRRatio: Number(e.target.value) }))}
                  className="w-full accent-cyan" />
              </Field>
            )}
            <div className="border-t border-border/30 pt-2 mt-2">
              <Toggle label="Trailing Stop" value={exit.trailingStopEnabled} onChange={v => setExit(ex => ({ ...ex, trailingStopEnabled: v }))} />
              {exit.trailingStopEnabled && (
                <Field label={`Trail Distance: ${exit.trailingStopPips} pips`}>
                  <input type="range" min={5} max={50} value={exit.trailingStopPips}
                    onChange={e => setExit(ex => ({ ...ex, trailingStopPips: Number(e.target.value) }))}
                    className="w-full accent-cyan" />
                </Field>
              )}
            </div>
            <div className="border-t border-border/30 pt-2 mt-2">
              <Toggle label="Break Even" value={exit.breakEvenEnabled} onChange={v => setExit(ex => ({ ...ex, breakEvenEnabled: v }))} />
              {exit.breakEvenEnabled && (
                <Field label={`BE Trigger: ${exit.breakEvenTriggerPips} pips`}>
                  <input type="range" min={5} max={50} value={exit.breakEvenTriggerPips}
                    onChange={e => setExit(ex => ({ ...ex, breakEvenTriggerPips: Number(e.target.value) }))}
                    className="w-full accent-cyan" />
                </Field>
              )}
            </div>
            <div className="border-t border-border/30 pt-2 mt-2">
              <Toggle label="Partial TP" value={exit.partialTPEnabled} onChange={v => setExit(ex => ({ ...ex, partialTPEnabled: v }))} />
              {exit.partialTPEnabled && (
                <>
                  <Field label={`Close ${exit.partialTPPercent}% at ${exit.partialTPLevel}R`}>
                    <div className="flex gap-2">
                      <input type="number" value={exit.partialTPPercent} min={10} max={90} step={5}
                        onChange={e => setExit(ex => ({ ...ex, partialTPPercent: Number(e.target.value) }))}
                        className="cfg-input flex-1" placeholder="%" />
                      <input type="number" value={exit.partialTPLevel} min={0.5} max={5} step={0.5}
                        onChange={e => setExit(ex => ({ ...ex, partialTPLevel: Number(e.target.value) }))}
                        className="cfg-input flex-1" placeholder="R" />
                    </div>
                  </Field>
                </>
              )}
            </div>
            <div className="border-t border-border/30 pt-2 mt-2">
              <Toggle label="Time-Based Exit" value={exit.timeBasedExitEnabled} onChange={v => setExit(ex => ({ ...ex, timeBasedExitEnabled: v }))} />
              {exit.timeBasedExitEnabled && (
                <Field label={`Max Hold: ${exit.maxHoldHours}h`}>
                  <input type="range" min={1} max={168} value={exit.maxHoldHours}
                    onChange={e => setExit(ex => ({ ...ex, maxHoldHours: Number(e.target.value) }))}
                    className="w-full accent-cyan" />
                </Field>
              )}
            </div>
          </ConfigSection>

          {/* ── Sessions ── */}
          <ConfigSection
            id="sessions"
            title="Session Filters"
            icon={<Clock className="w-3.5 h-3.5" />}
            expanded={expandedConfig.has("sessions")}
            onToggle={() => toggleConfig("sessions")}
            disabled={useCurrentConfig}
          >
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <Toggle label="London" value={session.londonEnabled} onChange={v => setSession(s => ({ ...s, londonEnabled: v }))} />
              <Toggle label="New York" value={session.newYorkEnabled} onChange={v => setSession(s => ({ ...s, newYorkEnabled: v }))} />
              <Toggle label="Asian" value={session.asianEnabled} onChange={v => setSession(s => ({ ...s, asianEnabled: v }))} />
              <Toggle label="Sydney" value={session.sydneyEnabled} onChange={v => setSession(s => ({ ...s, sydneyEnabled: v }))} />
            </div>
            <Field label="Active Days">
              <div className="flex gap-1">
                {DAYS.map(d => (
                  <button
                    key={d}
                    onClick={() => setSession(s => ({
                      ...s,
                      activeDays: { ...s.activeDays, [d]: !s.activeDays[d] },
                    }))}
                    className={`flex-1 text-[10px] font-mono py-1.5 border transition-colors ${
                      session.activeDays[d]
                        ? "bg-cyan/20 border-cyan text-cyan font-bold"
                        : "bg-transparent border-border text-muted-foreground"
                    }`}
                  >
                    {DAY_LABELS[d]}
                  </button>
                ))}
              </div>
            </Field>
          </ConfigSection>

          {/* Spread & Slippage */}
          <ConfigSection
            id="spread"
            title="Spread & Slippage"
            icon={<TrendingDown className="w-3.5 h-3.5" />}
            expanded={expandedConfig.has("spread")}
            onToggle={() => toggleConfig("spread")}
          >
            <Toggle label="Realistic Spreads" value={useRealisticSpread} onChange={setUseRealisticSpread} />
            <p className="text-[10px] font-mono text-muted-foreground -mt-1 mb-1">
              {useRealisticSpread ? "Using per-instrument default spreads (e.g., EUR/USD: 1.0 pip)" : "Using custom fixed spread"}
            </p>
            {!useRealisticSpread && (
              <Field label="Custom Spread (pips)">
                <input
                  type="number" min={0} max={50} step={0.1}
                  value={customSpreadPips}
                  onChange={e => setCustomSpreadPips(Number(e.target.value))}
                  className="w-full bg-background border border-border text-foreground text-xs font-mono px-2 py-1.5 focus:border-cyan focus:outline-none"
                />
              </Field>
            )}
            <Field label="Max Slippage (pips)">
              <input
                type="number" min={0} max={10} step={0.1}
                value={slippagePips}
                onChange={e => setSlippagePips(Number(e.target.value))}
                className="w-full bg-background border border-border text-foreground text-xs font-mono px-2 py-1.5 focus:border-cyan focus:outline-none"
              />
            </Field>
            <p className="text-[10px] font-mono text-muted-foreground">
              Slippage is applied adversely on SL hits. Set to 0 for ideal fills.
            </p>
          </ConfigSection>
        </div>
      </div>

      {/* ═══════════════════ RIGHT PANEL — RESULTS ═══════════════════ */}
      <div className="flex-1 overflow-y-auto">
        {/* Empty state */}
        {!result && !runBacktest.isPending && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-cyan/10 rounded-full blur-xl" />
              <FlaskConical className="relative w-20 h-20 text-cyan/40" />
            </div>
            <h3 className="text-xl font-bold font-mono text-foreground mb-3">Strategy Backtest Lab</h3>
            <p className="text-sm font-mono text-muted-foreground max-w-lg mb-6 leading-relaxed">
              Configure your strategy parameters in the left panel, then hit Run Backtest.
              The engine walks through historical candles bar-by-bar using the same SMC analysis
              as the live autonomous engine — BOS, CHoCH, Order Blocks, FVG, liquidity sweeps,
              session filters, and confluence scoring.
            </p>
            <div className="grid grid-cols-3 gap-4 text-center max-w-md">
              <div className="bg-card border border-border p-3">
                <Crosshair className="w-5 h-5 text-cyan mx-auto mb-1" />
                <div className="text-[10px] font-mono text-muted-foreground">Tune Setups</div>
              </div>
              <div className="bg-card border border-border p-3">
                <Shield className="w-5 h-5 text-cyan mx-auto mb-1" />
                <div className="text-[10px] font-mono text-muted-foreground">Adjust Risk</div>
              </div>
              <div className="bg-card border border-border p-3">
                <BarChart3 className="w-5 h-5 text-cyan mx-auto mb-1" />
                <div className="text-[10px] font-mono text-muted-foreground">Analyze Results</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {runBacktest.isPending && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Loader2 className="w-16 h-16 text-cyan animate-spin mb-6" />
            <h3 className="text-sm font-bold font-mono text-foreground mb-3">Running Backtest...</h3>
            <div className="w-64 h-2 bg-muted rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-cyan transition-all duration-300"
                style={{ width: `${progress.data?.progress ?? 0}%` }}
              />
            </div>
            <p className="text-[10px] font-mono text-muted-foreground">
              Analyzing {symbol} on {timeframe} · {lookbackMonths} months of data
            </p>
          </div>
        )}

        {/* Error state */}
        {result && result.status === "error" && (
          <div className="p-6">
            <div className="bg-bearish/10 border border-bearish/30 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-bearish flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold font-mono text-bearish">Backtest Failed</div>
                <div className="text-xs font-mono text-muted-foreground mt-1">{result.error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && result.status === "completed" && (
          <div className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FlaskConical className="w-5 h-5 text-cyan" />
                <h1 className="text-lg font-bold text-foreground tracking-tight">Results</h1>
                <span className="text-sm font-mono text-cyan font-bold">{result.symbol}</span>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 border border-border">
                  {result.timeframe} · {result.totalBars} bars · {result.executionTimeMs}ms
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-lg font-bold font-mono ${result.netProfit >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {result.netProfit >= 0 ? "+" : ""}{result.netProfitPercent.toFixed(1)}%
                </div>
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-cyan border border-border hover:border-cyan px-2 py-1 transition-colors"
                  title="Save this run for comparison"
                >
                  <Save className="w-3 h-3" /> Save Run
                </button>
                {savedRuns.length >= 2 && (
                  <button
                    onClick={() => setCompareMode(!compareMode)}
                    className={`flex items-center gap-1 text-[10px] font-mono border px-2 py-1 transition-colors ${
                      compareMode
                        ? "text-cyan border-cyan bg-cyan/10"
                        : "text-muted-foreground hover:text-cyan border-border hover:border-cyan"
                    }`}
                    title="Compare saved runs"
                  >
                    <GitCompare className="w-3 h-3" /> Compare
                  </button>
                )}
              </div>
            </div>

            {/* ── Save Dialog ── */}
            {showSaveDialog && (
              <div className="bg-card border border-cyan/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-mono text-cyan uppercase tracking-wider font-bold">Save Current Run</div>
                  <button onClick={() => setShowSaveDialog(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={saveLabel}
                    onChange={e => setSaveLabel(e.target.value)}
                    placeholder={`${result.symbol} ${result.timeframe} — describe this run...`}
                    className="cfg-input flex-1"
                    onKeyDown={e => e.key === "Enter" && handleSaveRun()}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveRun}
                    className="bg-cyan text-background text-[10px] font-mono font-bold px-3 py-1.5 hover:opacity-90 transition-opacity"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* ── Comparison Mode ── */}
            {compareMode && (
              <div className="bg-card border border-border">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-cyan" />
                    <span className="text-sm font-bold font-mono text-foreground uppercase tracking-wider">Compare Runs</span>
                    <span className="text-[10px] font-mono text-muted-foreground">({savedRuns.length} saved)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClearAllRuns}
                      className="text-[9px] font-mono text-bearish/60 hover:text-bearish transition-colors"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={() => { setCompareMode(false); setCompareA(null); setCompareB(null); }}
                      className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Saved runs list */}
                <div className="px-4 py-2 space-y-1 max-h-48 overflow-y-auto">
                  {savedRuns.length === 0 && (
                    <div className="text-xs font-mono text-muted-foreground py-4 text-center">No saved runs yet. Run a backtest and click Save Run.</div>
                  )}
                  {savedRuns.map(run => {
                    const isA = compareA === run.id;
                    const isB = compareB === run.id;
                    const isSelected = isA || isB;
                    return (
                      <div
                        key={run.id}
                        className={`flex items-center gap-2 p-2 border transition-colors cursor-pointer ${
                          isSelected ? "border-cyan bg-cyan/5" : "border-border hover:border-muted-foreground"
                        }`}
                        onClick={() => toggleCompareSelect(run.id)}
                      >
                        <div className={`w-5 h-5 flex items-center justify-center text-[9px] font-bold font-mono border ${
                          isA ? "bg-cyan text-background border-cyan" :
                          isB ? "bg-purple-500 text-white border-purple-500" :
                          "border-border text-muted-foreground"
                        }`}>
                          {isA ? "A" : isB ? "B" : ""}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-mono text-foreground truncate">{run.label}</div>
                          <div className="text-[9px] font-mono text-muted-foreground">
                            {run.symbol} · {run.timeframe} · {run.totalTrades} trades · {new Date(run.savedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className={`text-xs font-bold font-mono ${
                          run.netProfitPercent >= 0 ? "text-bullish" : "text-bearish"
                        }`}>
                          {run.netProfitPercent >= 0 ? "+" : ""}{run.netProfitPercent.toFixed(1)}%
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteRun(run.id); }}
                          className="text-muted-foreground hover:text-bearish transition-colors p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Comparison table */}
                {runA && runB && (
                  <div className="px-4 pb-4 pt-2 border-t border-border/50">
                    <div className="text-[10px] font-mono text-cyan uppercase tracking-wider font-bold mb-2">Side-by-Side Comparison</div>
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                          <th className="text-left py-1.5 px-2">Metric</th>
                          <th className="text-right py-1.5 px-2">
                            <span className="bg-cyan/20 text-cyan px-1.5 py-0.5 border border-cyan/30">A</span>
                          </th>
                          <th className="text-right py-1.5 px-2">
                            <span className="bg-purple-500/20 text-purple-400 px-1.5 py-0.5 border border-purple-500/30">B</span>
                          </th>
                          <th className="text-right py-1.5 px-2">Delta</th>
                        </tr>
                      </thead>
                      <tbody>
                        <CompareRow label="Net P&L %" a={runA.netProfitPercent} b={runB.netProfitPercent} fmt="pct" higherBetter />
                        <CompareRow label="Win Rate" a={runA.winRate} b={runB.winRate} fmt="pct" higherBetter />
                        <CompareRow label="Profit Factor" a={runA.profitFactor} b={runB.profitFactor} fmt="num" higherBetter />
                        <CompareRow label="Max Drawdown" a={runA.maxDrawdownPercent} b={runB.maxDrawdownPercent} fmt="pct" higherBetter={false} />
                        <CompareRow label="Sharpe Ratio" a={runA.sharpeRatio} b={runB.sharpeRatio} fmt="num" higherBetter />
                        <CompareRow label="Expectancy" a={runA.expectancy} b={runB.expectancy} fmt="dollar" higherBetter />
                        <CompareRow label="Avg R:R" a={runA.averageRR} b={runB.averageRR} fmt="num" higherBetter />
                        <CompareRow label="Total Trades" a={runA.totalTrades} b={runB.totalTrades} fmt="int" />
                        <CompareRow label="Max Consec W" a={runA.maxConsecutiveWins} b={runB.maxConsecutiveWins} fmt="int" higherBetter />
                        <CompareRow label="Max Consec L" a={runA.maxConsecutiveLosses} b={runB.maxConsecutiveLosses} fmt="int" higherBetter={false} />
                        <CompareRow label="Long WR" a={runA.longWinRate} b={runB.longWinRate} fmt="pct" higherBetter />
                        <CompareRow label="Short WR" a={runA.shortWinRate} b={runB.shortWinRate} fmt="pct" higherBetter />
                      </tbody>
                    </table>

                    {/* Config diff */}
                    <div className="mt-3 text-[10px] font-mono text-cyan uppercase tracking-wider font-bold mb-1">Config Differences</div>
                    <div className="grid grid-cols-3 gap-1">
                      {(["minConfluence", "riskPerTrade", "minRR", "slMethod", "tpMethod"] as const).map(key => {
                        const aVal = String(runA.configSnapshot[key]);
                        const bVal = String(runB.configSnapshot[key]);
                        const isDiff = aVal !== bVal;
                        return (
                          <div key={key} className={`p-1.5 border ${
                            isDiff ? "border-warning/30 bg-warning/5" : "border-border bg-muted/10"
                          }`}>
                            <div className="text-[9px] text-muted-foreground uppercase">{key}</div>
                            <div className="flex justify-between">
                              <span className={`text-[10px] ${isDiff ? "text-cyan font-bold" : "text-foreground"}`}>{aVal}</span>
                              <span className={`text-[10px] ${isDiff ? "text-purple-400 font-bold" : "text-foreground"}`}>{bVal}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Prompt to select */}
                {(!runA || !runB) && savedRuns.length >= 2 && (
                  <div className="px-4 pb-3 text-[10px] font-mono text-muted-foreground text-center">
                    Click two runs above to compare them side-by-side
                    {runA && !runB && " — select one more"}
                  </div>
                )}
              </div>
            )}

            {/* ── Saved Runs Badge (when not in compare mode) ── */}
            {!compareMode && savedRuns.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-mono text-muted-foreground">
                  {savedRuns.length} saved run{savedRuns.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => setCompareMode(true)}
                  className="text-[10px] font-mono text-cyan hover:underline"
                >
                  Open Compare
                </button>
              </div>
            )}

            {/* ── Key Metrics ── */}
            <ResultSection
              id="metrics"
              title="Performance Metrics"
              icon={<BarChart3 className="w-4 h-4" />}
              expanded={expandedResults.has("metrics")}
              onToggle={() => toggleResult("metrics")}
            >
              <div className="grid grid-cols-6 gap-2 mb-3">
                <MetricCard label="Net P&L" value={`$${result.netProfit.toFixed(2)}`}
                  subtext={`${result.netProfitPercent >= 0 ? '+' : ''}${result.netProfitPercent.toFixed(1)}%`}
                  color={result.netProfit >= 0 ? "text-bullish" : "text-bearish"} />
                <MetricCard label="Win Rate" value={`${result.winRate.toFixed(1)}%`}
                  subtext={`${result.winningTrades}W / ${result.losingTrades}L`}
                  color={result.winRate >= 50 ? "text-bullish" : "text-bearish"} />
                <MetricCard label="Profit Factor" value={result.profitFactor === Infinity ? "∞" : result.profitFactor.toFixed(2)}
                  subtext={`$${result.grossProfit.toFixed(0)} / $${result.grossLoss.toFixed(0)}`}
                  color={result.profitFactor >= 1 ? "text-bullish" : "text-bearish"} />
                <MetricCard label="Max Drawdown" value={`${result.maxDrawdownPercent.toFixed(1)}%`}
                  subtext={`$${result.maxDrawdown.toFixed(2)}`}
                  color={result.maxDrawdownPercent < 10 ? "text-bullish" : result.maxDrawdownPercent < 20 ? "text-warning" : "text-bearish"} />
                <MetricCard label="Expectancy" value={`$${result.expectancy.toFixed(2)}`}
                  subtext="per trade"
                  color={result.expectancy >= 0 ? "text-bullish" : "text-bearish"} />
                <MetricCard label="Sharpe Ratio" value={result.sharpeRatio.toFixed(2)}
                  subtext="annualized"
                  color={result.sharpeRatio >= 1 ? "text-bullish" : result.sharpeRatio >= 0 ? "text-warning" : "text-bearish"} />
              </div>

              {/* Extended stats grid */}
              <div className="grid grid-cols-6 gap-2">
                <StatCard label="Total Trades" value={result.totalTrades.toString()} />
                <StatCard label="Avg Win" value={`$${result.averageWin.toFixed(2)}`} color="text-bullish" />
                <StatCard label="Avg Loss" value={`$${result.averageLoss.toFixed(2)}`} color="text-bearish" />
                <StatCard label="Avg R:R" value={result.averageRR.toFixed(2)} />
                <StatCard label="Max Consec W" value={result.maxConsecutiveWins.toString()} color="text-bullish" />
                <StatCard label="Max Consec L" value={result.maxConsecutiveLosses.toString()} color="text-bearish" />
              </div>

              {/* Best / Worst + Long / Short */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {result.bestTrade && (
                  <div className="bg-bullish/5 border border-bullish/20 p-2.5">
                    <div className="text-[10px] font-mono text-bullish uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> Best Trade
                    </div>
                    <div className="text-sm font-bold font-mono text-bullish">+${result.bestTrade.pnl.toFixed(2)}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {result.bestTrade.direction.toUpperCase()} · {result.bestTrade.exitReason.toUpperCase()}
                    </div>
                  </div>
                )}
                {result.worstTrade && (
                  <div className="bg-bearish/5 border border-bearish/20 p-2.5">
                    <div className="text-[10px] font-mono text-bearish uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Skull className="w-3 h-3" /> Worst Trade
                    </div>
                    <div className="text-sm font-bold font-mono text-bearish">${result.worstTrade.pnl.toFixed(2)}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {result.worstTrade.direction.toUpperCase()} · {result.worstTrade.exitReason.toUpperCase()}
                    </div>
                  </div>
                )}
              </div>

              {/* Long vs Short */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-muted/20 border border-border p-2.5">
                  <div className="text-[10px] font-mono text-bullish uppercase tracking-wider mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Long Trades
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">{result.longStats.trades} trades</span>
                    <span className="text-foreground">{result.longStats.winRate.toFixed(0)}% WR</span>
                    <span className={result.longStats.pnl >= 0 ? "text-bullish" : "text-bearish"}>
                      ${result.longStats.pnl.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="bg-muted/20 border border-border p-2.5">
                  <div className="text-[10px] font-mono text-bearish uppercase tracking-wider mb-1 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> Short Trades
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">{result.shortStats.trades} trades</span>
                    <span className="text-foreground">{result.shortStats.winRate.toFixed(0)}% WR</span>
                    <span className={result.shortStats.pnl >= 0 ? "text-bullish" : "text-bearish"}>
                      ${result.shortStats.pnl.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Spread & Slippage Impact */}
              {result.spreadSlippageConfig && (
                <div className="bg-muted/20 border border-border p-2.5 mt-2">
                  <div className="text-[10px] font-mono text-warning uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> Spread & Slippage Impact
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Spread</div>
                      <div className="text-foreground">{result.spreadSlippageConfig.spreadPips.toFixed(1)} pips</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Slippage</div>
                      <div className="text-foreground">{result.spreadSlippageConfig.slippagePips.toFixed(1)} pips</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Total Spread Cost</div>
                      <div className="text-bearish">${result.totalSpreadCost.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Total Slippage Cost</div>
                      <div className="text-bearish">${result.totalSlippageCost.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1.5 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground">Avg spread/trade: </span>
                      <span className="text-bearish">${result.avgSpreadCostPerTrade.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Avg slippage/trade: </span>
                      <span className="text-bearish">${result.avgSlippageCostPerTrade.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </ResultSection>

            {/* ── Equity + Drawdown ── */}
            <ResultSection
              id="equity"
              title="Equity & Drawdown"
              icon={<TrendingUp className="w-4 h-4" />}
              expanded={expandedResults.has("equity")}
              onToggle={() => toggleResult("equity")}
            >
              {chartData.length > 0 ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>Start: ${result.initialBalance.toLocaleString()}</span>
                    <span className={result.netProfit >= 0 ? "text-bullish" : "text-bearish"}>
                      End: ${(result.initialBalance + result.netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {/* Equity bars */}
                  <div className="relative h-32 bg-muted/10 border border-border overflow-hidden">
                    <div className="absolute left-0 right-0 border-t border-dashed border-muted-foreground/20"
                      style={{
                        bottom: `${((result.initialBalance - Math.min(...result.equityCurve.map(p => p.equity))) / (Math.max(...result.equityCurve.map(p => p.equity)) - Math.min(...result.equityCurve.map(p => p.equity)) || 1)) * 100}%`
                      }}
                    />
                    <div className="flex items-end h-full gap-px px-0.5">
                      {chartData.map((bar, i) => (
                        <div key={i} className={`flex-1 min-w-[1px] ${bar.isProfit ? 'bg-bullish/50' : 'bg-bearish/50'}`}
                          style={{ height: `${Math.max(2, bar.eqHeight)}%` }}
                          title={`$${bar.equity.toFixed(2)} | DD: ${bar.drawdownPercent.toFixed(1)}%`}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Drawdown bars (inverted) */}
                  <div className="text-[10px] font-mono text-muted-foreground">Drawdown %</div>
                  <div className="relative h-16 bg-muted/10 border border-border overflow-hidden">
                    <div className="flex items-start h-full gap-px px-0.5">
                      {chartData.map((bar, i) => (
                        <div key={i} className="flex-1 min-w-[1px] bg-bearish/40"
                          style={{ height: `${Math.max(0, bar.ddHeight)}%` }}
                          title={`DD: ${bar.drawdownPercent.toFixed(1)}%`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs font-mono text-muted-foreground py-4 text-center">No equity data</div>
              )}
            </ResultSection>

            {/* ── Monthly P&L ── */}
            {result.monthlyPnL.length > 0 && (
              <ResultSection
                id="monthly"
                title="Monthly P&L"
                icon={<Calendar className="w-4 h-4" />}
                expanded={expandedResults.has("monthly")}
                onToggle={() => toggleResult("monthly")}
              >
                <div className="grid grid-cols-4 gap-2">
                  {result.monthlyPnL.map(m => (
                    <div key={m.month} className={`border p-2.5 ${m.pnl >= 0 ? 'border-bullish/20 bg-bullish/5' : 'border-bearish/20 bg-bearish/5'}`}>
                      <div className="text-[10px] font-mono text-muted-foreground">{m.month}</div>
                      <div className={`text-sm font-bold font-mono ${m.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                        {m.pnl >= 0 ? '+' : ''}{m.pnl.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {m.trades} trades · {m.winRate.toFixed(0)}% WR
                      </div>
                    </div>
                  ))}
                </div>
              </ResultSection>
            )}

            {/* ── Setup Distribution ── */}
            {result.setupDistribution.length > 0 && (
              <ResultSection
                id="setups"
                title="Setup Distribution"
                icon={<PieChart className="w-4 h-4" />}
                expanded={expandedResults.has("setups")}
                onToggle={() => toggleResult("setups")}
              >
                <div className="space-y-1.5">
                  {result.setupDistribution.map(s => {
                    const maxCount = Math.max(...result.setupDistribution.map(x => x.count));
                    return (
                      <div key={s.factor} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground w-28 truncate">{s.factor}</span>
                        <div className="flex-1 h-4 bg-muted/20 border border-border relative overflow-hidden">
                          <div
                            className={`h-full ${s.winRate >= 50 ? 'bg-bullish/30' : 'bg-bearish/30'}`}
                            style={{ width: `${(s.count / maxCount) * 100}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-foreground">
                            {s.count}x · {s.winRate.toFixed(0)}% WR
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ResultSection>
            )}

            {/* ── Exit Distribution ── */}
            {result.exitDistribution.length > 0 && (
              <ResultSection
                id="exits"
                title="Exit Reasons"
                icon={<Filter className="w-4 h-4" />}
                expanded={expandedResults.has("exits")}
                onToggle={() => toggleResult("exits")}
              >
                <div className="grid grid-cols-3 gap-2">
                  {result.exitDistribution.map(e => (
                    <div key={e.reason} className="bg-muted/20 border border-border p-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <ExitBadge reason={e.reason} />
                      </div>
                      <div className="text-xs font-mono text-foreground">{e.count} trades</div>
                      <div className={`text-[10px] font-mono ${e.avgPnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                        Avg: {e.avgPnl >= 0 ? '+' : ''}{e.avgPnl.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </ResultSection>
            )}

            {/* ── Trade List ── */}
            <ResultSection
              id="trades"
              title={`Trade List (${result.trades.length})`}
              icon={<Target className="w-4 h-4" />}
              expanded={expandedResults.has("trades")}
              onToggle={() => toggleResult("trades")}
            >
              {result.trades.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-[10px] uppercase tracking-wider">
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-2">Dir</th>
                        <th className="text-right py-2 px-2">Entry</th>
                        <th className="text-right py-2 px-2">Exit</th>
                        <th className="text-right py-2 px-2">SL</th>
                        <th className="text-right py-2 px-2">TP</th>
                        <th className="text-right py-2 px-2">P&L</th>
                        <th className="text-right py-2 px-2">P&L %</th>
                        <th className="text-left py-2 px-2">Exit</th>
                        <th className="text-right py-2 px-2">Score</th>
                        <th className="text-left py-2 px-2">Factors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map(trade => {
                        const isJPY = result.symbol.includes("JPY");
                        const dec = isJPY ? 3 : 5;
                        const isSelected = selectedTradeId === trade.id;
                        return (
                          <>
                            <tr
                              key={trade.id}
                              onClick={() => setSelectedTradeId(isSelected ? null : trade.id)}
                              className={`border-b border-border/30 cursor-pointer transition-colors ${
                                isSelected ? 'bg-cyan/10' : 'hover:bg-muted/10'
                              }`}
                            >
                              <td className="py-1.5 px-2 text-muted-foreground">{trade.id}</td>
                              <td className="py-1.5 px-2">
                                <span className={`font-bold ${trade.direction === "long" ? "text-bullish" : "text-bearish"}`}>
                                  {trade.direction === "long" ? "▲" : "▼"}
                                </span>
                              </td>
                              <td className="py-1.5 px-2 text-right">{trade.entryPrice.toFixed(dec)}</td>
                              <td className="py-1.5 px-2 text-right">{trade.exitPrice.toFixed(dec)}</td>
                              <td className="py-1.5 px-2 text-right text-bearish">{trade.stopLoss.toFixed(dec)}</td>
                              <td className="py-1.5 px-2 text-right text-bullish">{trade.takeProfit.toFixed(dec)}</td>
                              <td className={`py-1.5 px-2 text-right font-bold ${trade.pnl >= 0 ? "text-bullish" : "text-bearish"}`}>
                                {trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(2)}
                              </td>
                              <td className={`py-1.5 px-2 text-right ${trade.pnlPercent >= 0 ? "text-bullish" : "text-bearish"}`}>
                                {trade.pnlPercent >= 0 ? "+" : ""}{trade.pnlPercent.toFixed(1)}%
                              </td>
                              <td className="py-1.5 px-2"><ExitBadge reason={trade.exitReason} /></td>
                              <td className="py-1.5 px-2 text-right text-cyan">{trade.confluenceScore}/10</td>
                              <td className="py-1.5 px-2">
                                <div className="flex flex-wrap gap-0.5">
                                  {trade.setupFactors.slice(0, 3).map((f, i) => (
                                    <span key={i} className="text-[8px] bg-muted/30 border border-border px-1 py-0.5 text-muted-foreground">{f}</span>
                                  ))}
                                  {trade.setupFactors.length > 3 && (
                                    <span className="text-[8px] text-muted-foreground">+{trade.setupFactors.length - 3}</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {/* Expanded trade detail */}
                            {isSelected && (
                              <tr key={`${trade.id}-detail`}>
                                <td colSpan={11} className="bg-muted/10 border-b border-border p-3">
                                  <div className="grid grid-cols-3 gap-4">
                                    <div>
                                      <div className="text-[10px] font-mono text-cyan uppercase tracking-wider mb-1">Entry Details</div>
                                      <div className="text-[10px] font-mono text-muted-foreground space-y-0.5">
                                        <div>Time: {trade.entryTime}</div>
                                        <div>Bar: {trade.entryBar}</div>
                                        <div>Bias: <span className="text-foreground">{trade.bias}</span></div>
                                        <div>Size: {trade.size.toFixed(4)} lots</div>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-mono text-cyan uppercase tracking-wider mb-1">Exit Details</div>
                                      <div className="text-[10px] font-mono text-muted-foreground space-y-0.5">
                                        <div>Time: {trade.exitTime}</div>
                                        <div>Bar: {trade.exitBar}</div>
                                        <div>Reason: <span className="text-foreground">{trade.exitReason.toUpperCase()}</span></div>
                                        <div>Bars Held: {trade.exitBar - trade.entryBar}</div>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-mono text-cyan uppercase tracking-wider mb-1">Setup Factors</div>
                                      <div className="flex flex-wrap gap-1">
                                        {trade.setupFactors.map((f, i) => (
                                          <span key={i} className="text-[9px] bg-cyan/10 border border-cyan/30 text-cyan px-1.5 py-0.5 font-mono">{f}</span>
                                        ))}
                                      </div>
                                      <div className="mt-2 text-[10px] font-mono text-muted-foreground">
                                        Confluence: <span className="text-cyan font-bold">{trade.confluenceScore}/10</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs font-mono text-muted-foreground py-6 text-center">
                  No trades generated. Try lowering the minimum confluence score, enabling more setups, or widening the session filter.
                </div>
              )}
            </ResultSection>

            {/* ── Config Snapshot ── */}
            <ResultSection
              id="config"
              title="Config Snapshot"
              icon={<Settings2 className="w-4 h-4" />}
              expanded={expandedResults.has("config")}
              onToggle={() => toggleResult("config")}
            >
              <div className="grid grid-cols-5 gap-2">
                <StatCard label="Min Confluence" value={`${result.configSnapshot.minConfluence}/10`} color="text-cyan" />
                <StatCard label="Risk/Trade" value={`${result.configSnapshot.riskPerTrade}%`} />
                <StatCard label="Min R:R" value={`${result.configSnapshot.minRR}:1`} />
                <StatCard label="SL Method" value={result.configSnapshot.slMethod} />
                <StatCard label="TP Method" value={result.configSnapshot.tpMethod} />
              </div>
            </ResultSection>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function ConfigSection({ id, title, icon, expanded, onToggle, disabled, children }: {
  id: string; title: string; icon: React.ReactNode;
  expanded: boolean; onToggle: () => void;
  disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/20 transition-colors">
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          <span className="text-cyan">{icon}</span>
          <span className="text-[11px] font-bold font-mono text-foreground uppercase tracking-wider">{title}</span>
        </div>
        {disabled && <span className="text-[9px] font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 border border-border">LOCKED</span>}
      </button>
      {expanded && !disabled && (
        <div className="px-3 pb-3 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

function ResultSection({ id, title, icon, expanded, onToggle, children }: {
  id: string; title: string; icon: React.ReactNode;
  expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="text-cyan">{icon}</span>
          <span className="text-sm font-bold font-mono text-foreground uppercase tracking-wider">{title}</span>
        </div>
      </button>
      {expanded && <div className="px-4 pb-4 border-t border-border/50"><div className="pt-3">{children}</div></div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center gap-2 py-1 group"
    >
      <div className={`w-7 h-4 rounded-full transition-colors relative ${value ? 'bg-cyan' : 'bg-muted'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${value ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </div>
      <span className={`text-[10px] font-mono ${value ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
    </button>
  );
}

function MetricCard({ label, value, subtext, color }: { label: string; value: string; subtext: string; color: string }) {
  return (
    <div className="bg-card border border-border p-2.5">
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-base font-bold font-mono ${color}`}>{value}</div>
      <div className="text-[10px] font-mono text-muted-foreground">{subtext}</div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-muted/20 border border-border p-2">
      <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-xs font-bold font-mono ${color || "text-foreground"}`}>{value}</div>
    </div>
  );
}

function CompareRow({ label, a, b, fmt, higherBetter }: {
  label: string; a: number; b: number;
  fmt: "pct" | "num" | "dollar" | "int";
  higherBetter?: boolean;
}) {
  const delta = a - b;
  const fmtVal = (v: number) => {
    switch (fmt) {
      case "pct": return `${v.toFixed(1)}%`;
      case "dollar": return `$${v.toFixed(2)}`;
      case "int": return String(Math.round(v));
      default: return v.toFixed(2);
    }
  };
  const deltaColor = higherBetter === undefined
    ? "text-muted-foreground"
    : (delta > 0 ? (higherBetter ? "text-bullish" : "text-bearish") : delta < 0 ? (higherBetter ? "text-bearish" : "text-bullish") : "text-muted-foreground");

  return (
    <tr className="border-b border-border/30 hover:bg-muted/10">
      <td className="py-1.5 px-2 text-muted-foreground text-[10px]">{label}</td>
      <td className="py-1.5 px-2 text-right text-foreground">{fmtVal(a)}</td>
      <td className="py-1.5 px-2 text-right text-foreground">{fmtVal(b)}</td>
      <td className={`py-1.5 px-2 text-right font-bold ${deltaColor}`}>
        {delta > 0 ? "+" : ""}{fmtVal(delta)}
      </td>
    </tr>
  );
}

function ExitBadge({ reason }: { reason: string }) {
  const config: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    tp: { icon: <Trophy className="w-3 h-3" />, color: "text-bullish bg-bullish/10 border-bullish/30", label: "TP" },
    sl: { icon: <Skull className="w-3 h-3" />, color: "text-bearish bg-bearish/10 border-bearish/30", label: "SL" },
    time: { icon: <Minus className="w-3 h-3" />, color: "text-warning bg-warning/10 border-warning/30", label: "TIME" },
    reverse_signal: { icon: <ArrowUpDown className="w-3 h-3" />, color: "text-cyan bg-cyan/10 border-cyan/30", label: "REV" },
    end_of_data: { icon: <Minus className="w-3 h-3" />, color: "text-muted-foreground bg-muted/10 border-border", label: "END" },
  };
  const c = config[reason] || config.end_of_data;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold font-mono px-1.5 py-0.5 border ${c.color}`}>
      {c.icon} {c.label}
    </span>
  );
}
