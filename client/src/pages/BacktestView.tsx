/**
 * BacktestView — Strategy backtesting interface
 * Run SMC strategy against historical data, view performance metrics,
 * equity curve, and individual trade results.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  FlaskConical, Play, Loader2, TrendingUp, TrendingDown,
  BarChart3, Target, AlertTriangle, ChevronDown, ChevronRight,
  Trophy, Skull, Minus
} from "lucide-react";

const SYMBOLS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "GBP/JPY", "AUD/USD",
  "USD/CAD", "EUR/GBP", "NZD/USD", "XAU/USD", "BTC/USD",
];

const TIMEFRAMES = [
  { value: "1h", label: "1 Hour" },
  { value: "4h", label: "4 Hours" },
  { value: "1day", label: "Daily" },
];

export default function BacktestView() {
  const [symbol, setSymbol] = useState("EUR/USD");
  const [timeframe, setTimeframe] = useState("1h");
  const [initialBalance, setInitialBalance] = useState(10000);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["performance", "equity", "trades"])
  );

  const runBacktest = trpc.backtest.run.useMutation();
  const progress = trpc.backtest.progress.useQuery(undefined, {
    refetchInterval: runBacktest.isPending ? 1000 : false,
  });

  const result = runBacktest.data;

  const handleRun = () => {
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - 3);
    runBacktest.mutate({
      symbol,
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      timeframe,
      initialBalance,
      useCurrentConfig: true,
    });
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Equity curve chart data
  const equityChartBars = useMemo(() => {
    if (!result?.equityCurve || result.equityCurve.length === 0) return [];
    const curve = result.equityCurve;
    const maxEquity = Math.max(...curve.map(p => p.equity));
    const minEquity = Math.min(...curve.map(p => p.equity));
    const range = maxEquity - minEquity || 1;
    return curve.map(p => ({
      ...p,
      height: ((p.equity - minEquity) / range) * 100,
      isProfit: p.equity >= result.initialBalance,
    }));
  }, [result]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left config panel */}
      <div className="w-64 flex-shrink-0 bg-card border-r border-border overflow-y-auto">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="w-5 h-5 text-cyan" />
            <h2 className="text-sm font-bold font-mono text-foreground uppercase tracking-wider">Backtest</h2>
          </div>

          {/* Symbol */}
          <div className="mb-3">
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">Symbol</label>
            <select
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              className="w-full bg-background border border-border text-foreground text-xs font-mono p-2 focus:border-cyan focus:outline-none"
            >
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Timeframe */}
          <div className="mb-3">
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">Timeframe</label>
            <select
              value={timeframe}
              onChange={e => setTimeframe(e.target.value)}
              className="w-full bg-background border border-border text-foreground text-xs font-mono p-2 focus:border-cyan focus:outline-none"
            >
              {TIMEFRAMES.map(tf => <option key={tf.value} value={tf.value}>{tf.label}</option>)}
            </select>
          </div>

          {/* Initial Balance */}
          <div className="mb-4">
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">Initial Balance</label>
            <input
              type="number"
              value={initialBalance}
              onChange={e => setInitialBalance(Number(e.target.value))}
              className="w-full bg-background border border-border text-foreground text-xs font-mono p-2 focus:border-cyan focus:outline-none"
              min={100}
              max={10000000}
            />
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

          {/* Config snapshot */}
          {result?.configSnapshot && (
            <div className="mt-4 space-y-1">
              <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider mb-1">Config Used</div>
              <ConfigRow label="Min Confluence" value={`${result.configSnapshot.minConfluence}/10`} />
              <ConfigRow label="Risk/Trade" value={`${result.configSnapshot.riskPerTrade}%`} />
              <ConfigRow label="Min R:R" value={`${result.configSnapshot.minRR}:1`} />
              <ConfigRow label="SL Method" value={result.configSnapshot.slMethod} />
              <ConfigRow label="TP Method" value={result.configSnapshot.tpMethod} />
            </div>
          )}
        </div>

        {/* Quick info */}
        <div className="p-4">
          <div className="text-[10px] font-mono text-muted-foreground bg-muted/20 p-2 border border-border/50">
            <strong className="text-foreground">How it works:</strong> The backtest walks through historical candles bar-by-bar,
            runs the same SMC analysis as the live engine, and simulates entries/exits using your current bot configuration.
            Results reflect your exact strategy settings.
          </div>
        </div>
      </div>

      {/* Main results area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!result && !runBacktest.isPending && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FlaskConical className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold font-mono text-foreground mb-2">Strategy Backtester</h3>
            <p className="text-sm font-mono text-muted-foreground max-w-md">
              Test your SMC strategy against historical data. Select a symbol, timeframe, and initial balance,
              then click Run Backtest to see how your current configuration would have performed.
            </p>
          </div>
        )}

        {runBacktest.isPending && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Loader2 className="w-12 h-12 text-cyan animate-spin mb-4" />
            <h3 className="text-sm font-bold font-mono text-foreground mb-2">Running Backtest...</h3>
            <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan transition-all duration-300"
                style={{ width: `${progress.data?.progress ?? 0}%` }}
              />
            </div>
            <p className="text-[10px] font-mono text-muted-foreground mt-2">
              Analyzing {symbol} on {timeframe} timeframe
            </p>
          </div>
        )}

        {result && result.status === "error" && (
          <div className="bg-bearish/10 border border-bearish/30 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-bearish flex-shrink-0" />
            <div>
              <div className="text-sm font-bold font-mono text-bearish">Backtest Error</div>
              <div className="text-xs font-mono text-muted-foreground mt-1">{result.error}</div>
            </div>
          </div>
        )}

        {result && result.status === "completed" && (
          <>
            {/* Header stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FlaskConical className="w-5 h-5 text-cyan" />
                <h1 className="text-lg font-bold text-foreground tracking-tight">Backtest Results</h1>
                <span className="text-sm font-mono text-cyan font-bold">{result.symbol}</span>
                <span className="text-xs font-mono text-muted-foreground">{result.timeframe} | {result.totalBars} bars | {result.executionTimeMs}ms</span>
              </div>
            </div>

            {/* Key metrics row */}
            <div className="grid grid-cols-6 gap-2">
              <MetricCard
                label="Net P&L"
                value={`$${result.netProfit.toFixed(2)}`}
                subtext={`${result.netProfitPercent >= 0 ? '+' : ''}${result.netProfitPercent.toFixed(1)}%`}
                color={result.netProfit >= 0 ? "text-bullish" : "text-bearish"}
              />
              <MetricCard
                label="Win Rate"
                value={`${result.winRate.toFixed(1)}%`}
                subtext={`${result.winningTrades}W / ${result.losingTrades}L`}
                color={result.winRate >= 50 ? "text-bullish" : "text-bearish"}
              />
              <MetricCard
                label="Profit Factor"
                value={result.profitFactor === Infinity ? "∞" : result.profitFactor.toFixed(2)}
                subtext={`$${result.grossProfit.toFixed(0)} / $${result.grossLoss.toFixed(0)}`}
                color={result.profitFactor >= 1 ? "text-bullish" : "text-bearish"}
              />
              <MetricCard
                label="Max Drawdown"
                value={`${result.maxDrawdownPercent.toFixed(1)}%`}
                subtext={`$${result.maxDrawdown.toFixed(2)}`}
                color={result.maxDrawdownPercent < 10 ? "text-bullish" : result.maxDrawdownPercent < 20 ? "text-warning" : "text-bearish"}
              />
              <MetricCard
                label="Expectancy"
                value={`$${result.expectancy.toFixed(2)}`}
                subtext="per trade"
                color={result.expectancy >= 0 ? "text-bullish" : "text-bearish"}
              />
              <MetricCard
                label="Sharpe Ratio"
                value={result.sharpeRatio.toFixed(2)}
                subtext="annualized"
                color={result.sharpeRatio >= 1 ? "text-bullish" : result.sharpeRatio >= 0 ? "text-warning" : "text-bearish"}
              />
            </div>

            {/* ═══ PERFORMANCE DETAILS ═══ */}
            <Section
              id="performance"
              title="Performance Details"
              icon={<BarChart3 className="w-4 h-4" />}
              expanded={expandedSections.has("performance")}
              onToggle={() => toggleSection("performance")}
            >
              <div className="grid grid-cols-4 gap-3">
                <StatCard label="Total Trades" value={result.totalTrades.toString()} />
                <StatCard label="Winning" value={result.winningTrades.toString()} color="text-bullish" />
                <StatCard label="Losing" value={result.losingTrades.toString()} color="text-bearish" />
                <StatCard label="Break Even" value={result.breakEvenTrades.toString()} />
                <StatCard label="Avg Win" value={`$${result.averageWin.toFixed(2)}`} color="text-bullish" />
                <StatCard label="Avg Loss" value={`$${result.averageLoss.toFixed(2)}`} color="text-bearish" />
                <StatCard label="Avg R:R" value={result.averageRR.toFixed(2)} />
                <StatCard label="Bars Analyzed" value={result.barsAnalyzed.toString()} />
                <StatCard label="Max Consec. Wins" value={result.maxConsecutiveWins.toString()} color="text-bullish" />
                <StatCard label="Max Consec. Losses" value={result.maxConsecutiveLosses.toString()} color="text-bearish" />
                <StatCard label="Gross Profit" value={`$${result.grossProfit.toFixed(2)}`} color="text-bullish" />
                <StatCard label="Gross Loss" value={`$${result.grossLoss.toFixed(2)}`} color="text-bearish" />
              </div>
            </Section>

            {/* ═══ EQUITY CURVE ═══ */}
            <Section
              id="equity"
              title="Equity Curve"
              icon={<TrendingUp className="w-4 h-4" />}
              expanded={expandedSections.has("equity")}
              onToggle={() => toggleSection("equity")}
            >
              {equityChartBars.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>Start: ${result.initialBalance.toLocaleString()}</span>
                    <span>End: ${(result.initialBalance + result.netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="relative h-40 bg-muted/10 border border-border overflow-hidden">
                    {/* Baseline (initial balance) */}
                    <div className="absolute left-0 right-0 border-t border-dashed border-muted-foreground/30"
                      style={{
                        bottom: `${((result.initialBalance - Math.min(...result.equityCurve.map(p => p.equity))) / (Math.max(...result.equityCurve.map(p => p.equity)) - Math.min(...result.equityCurve.map(p => p.equity)) || 1)) * 100}%`
                      }}
                    />
                    <div className="flex items-end h-full gap-px px-1">
                      {equityChartBars.map((bar, i) => (
                        <div
                          key={i}
                          className={`flex-1 min-w-[1px] transition-all ${bar.isProfit ? 'bg-bullish/60' : 'bg-bearish/60'}`}
                          style={{ height: `${Math.max(2, bar.height)}%` }}
                          title={`$${bar.equity.toFixed(2)} at bar ${bar.bar}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs font-mono text-muted-foreground py-4 text-center">No equity data</div>
              )}
            </Section>

            {/* ═══ TRADE LIST ═══ */}
            <Section
              id="trades"
              title={`Trade List (${result.trades.length})`}
              icon={<Target className="w-4 h-4" />}
              expanded={expandedSections.has("trades")}
              onToggle={() => toggleSection("trades")}
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
                        return (
                          <tr key={trade.id} className="border-b border-border/30 hover:bg-muted/10">
                            <td className="py-1.5 px-2 text-muted-foreground">{trade.id}</td>
                            <td className="py-1.5 px-2">
                              <span className={`font-bold ${trade.direction === "long" ? "text-bullish" : "text-bearish"}`}>
                                {trade.direction === "long" ? "▲ LONG" : "▼ SHORT"}
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
                            <td className="py-1.5 px-2">
                              <ExitBadge reason={trade.exitReason} />
                            </td>
                            <td className="py-1.5 px-2 text-right text-cyan">{trade.confluenceScore}/10</td>
                            <td className="py-1.5 px-2">
                              <div className="flex flex-wrap gap-0.5">
                                {trade.setupFactors.slice(0, 3).map((f, i) => (
                                  <span key={i} className="text-[8px] bg-muted/30 border border-border px-1 py-0.5 text-muted-foreground">
                                    {f}
                                  </span>
                                ))}
                                {trade.setupFactors.length > 3 && (
                                  <span className="text-[8px] text-muted-foreground">+{trade.setupFactors.length - 3}</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs font-mono text-muted-foreground py-4 text-center">
                  No trades were generated. Try lowering the minimum confluence score or adjusting filters.
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function Section({ id, title, icon, expanded, onToggle, children }: {
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

function MetricCard({ label, value, subtext, color }: {
  label: string;
  value: string;
  subtext: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-border p-3">
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      <div className="text-[10px] font-mono text-muted-foreground">{subtext}</div>
    </div>
  );
}

function StatCard({ label, value, color }: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-muted/20 border border-border p-2.5">
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-sm font-bold font-mono ${color || "text-foreground"}`}>{value}</div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[10px] font-mono py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-bold">{value}</span>
    </div>
  );
}

function ExitBadge({ reason }: { reason: string }) {
  const config: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    tp: { icon: <Trophy className="w-3 h-3" />, color: "text-bullish bg-bullish/10 border-bullish/30", label: "TP" },
    sl: { icon: <Skull className="w-3 h-3" />, color: "text-bearish bg-bearish/10 border-bearish/30", label: "SL" },
    time: { icon: <Minus className="w-3 h-3" />, color: "text-warning bg-warning/10 border-warning/30", label: "TIME" },
    reverse_signal: { icon: <TrendingDown className="w-3 h-3" />, color: "text-cyan bg-cyan/10 border-cyan/30", label: "REV" },
    end_of_data: { icon: <Minus className="w-3 h-3" />, color: "text-muted-foreground bg-muted/10 border-border", label: "END" },
  };
  const c = config[reason] || config.end_of_data;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold font-mono px-1.5 py-0.5 border ${c.color}`}>
      {c.icon} {c.label}
    </span>
  );
}
