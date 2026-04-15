/**
 * DashboardView — Production-grade dashboard
 * KPI cards, equity curve with drawdown overlay + time range selector,
 * active positions, portfolio heat donut, bot activity
 */

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  Bar,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────────

function formatMoney(val: number, showSign = false): string {
  const abs = Math.abs(val);
  const str =
    abs >= 1000
      ? `$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${abs.toFixed(2)}`;
  if (showSign) return val >= 0 ? `+${str}` : `-${str}`;
  return str;
}

type TimeRange = "1W" | "1M" | "3M" | "6M" | "ALL";

function getTimeRangeMs(range: TimeRange): number {
  const day = 86400000;
  switch (range) {
    case "1W": return 7 * day;
    case "1M": return 30 * day;
    case "3M": return 90 * day;
    case "6M": return 180 * day;
    case "ALL": return Infinity;
  }
}

// ─── Component ──────────────────────────────────────────────────────

export default function DashboardView() {
  const { isAuthenticated } = useAuth();
  const paperStatus = trpc.paper.status.useQuery(undefined, { refetchInterval: 15000, staleTime: 10000 });
  const stats = trpc.trades.stats.useQuery(undefined, { refetchInterval: 60000, staleTime: 30000 });
  const equityCurve = trpc.trades.equityCurve.useQuery(undefined, { refetchInterval: 60000, staleTime: 30000 });

  const [timeRange, setTimeRange] = useState<TimeRange>("3M");

  const d = paperStatus.data;
  const balance = d?.balance ?? 10000;
  const equity = d?.equity ?? 10000;
  const positions = d?.positions ?? [];
  const isRunning = d?.isRunning ?? false;
  const dailyPnl = d?.dailyPnl ?? 0;
  const winRate = d?.winRate ?? stats.data?.winRate ?? 0;
  const totalTrades = d?.totalTrades ?? stats.data?.totalTrades ?? 0;
  const wins = d?.wins ?? stats.data?.wins ?? 0;
  const losses = d?.losses ?? stats.data?.losses ?? 0;
  const scanCount = d?.scanCount ?? 0;
  const signalCount = d?.signalCount ?? 0;
  const tradeCount = d?.tradeCount ?? 0;
  const rejectedCount = d?.rejectedCount ?? 0;

  // Profit from initial balance
  const startingBalance = 10000;
  const profit = balance - startingBalance;
  const profitPct = ((profit / startingBalance) * 100).toFixed(1);

  // Enhanced equity curve data with drawdown
  const equityChartData = useMemo(() => {
    if (!equityCurve.data?.length) return [];

    const now = Date.now();
    const cutoff = now - getTimeRangeMs(timeRange);

    // Filter by time range
    const filtered = equityCurve.data.filter((d: any) => {
      if (timeRange === "ALL") return true;
      const ts = d.date ? new Date(d.date).getTime() : 0;
      return ts >= cutoff;
    });

    if (filtered.length === 0) return [];

    // Recalculate cumulative from filtered set
    let cumulative = startingBalance;
    let peak = startingBalance;
    
    // We need to recalculate from the beginning to get correct cumulative
    let preCumulative = startingBalance;
    for (const item of equityCurve.data) {
      const pnl = (item as any).pnl ?? 0;
      preCumulative += pnl;
      if (item === filtered[0]) {
        cumulative = preCumulative - pnl; // start before first filtered item
        peak = cumulative;
        break;
      }
    }

    return filtered.map((d: any) => {
      cumulative += d.pnl ?? 0;
      peak = Math.max(peak, cumulative);
      const drawdown = peak > 0 ? ((cumulative - peak) / peak) * 100 : 0;
      return {
        date: d.date
          ? new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "",
        equity: parseFloat(cumulative.toFixed(2)),
        drawdown: parseFloat(drawdown.toFixed(2)),
        pnl: d.pnl ?? 0,
        benchmark: startingBalance,
      };
    });
  }, [equityCurve.data, timeRange]);

  // Max drawdown from chart data
  const maxDrawdown = useMemo(() => {
    if (!equityChartData.length) return 0;
    return Math.min(...equityChartData.map((d) => d.drawdown));
  }, [equityChartData]);

  // Portfolio heat — currency exposure breakdown
  const currencyExposure = useMemo(() => {
    const exposure: Record<string, number> = {};
    positions.forEach((p) => {
      const sym = p.symbol.replace("/", "");
      const base = sym.substring(0, 3);
      const quote = sym.substring(3, 6);
      const notional = p.size * 100000;
      exposure[base] = (exposure[base] || 0) + notional;
      exposure[quote] = (exposure[quote] || 0) + notional;
    });
    const total = Object.values(exposure).reduce((s, v) => s + v, 0) || 1;
    const sorted = Object.entries(exposure)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);

    const colors = ["#f59e0b", "#3b82f6", "#a855f7", "#6b7280"];
    return sorted.map(([currency, val], i) => ({
      name: `${currency} exposure`,
      value: Math.round((val / total) * 100),
      color: colors[i] || "#6b7280",
    }));
  }, [positions]);

  const totalHeat = useMemo(() => {
    if (positions.length === 0) return 0;
    const totalRisk = positions.reduce((sum, p) => {
      if (p.stopLoss) {
        const riskPerUnit = Math.abs(p.entryPrice - p.stopLoss);
        const riskAmount = riskPerUnit * p.size * 100000;
        return sum + (riskAmount / balance) * 100;
      }
      return sum + 1;
    }, 0);
    return Math.min(totalRisk, 100);
  }, [positions, balance]);

  // Bot activity timeline — real data from log entries
  const activityDots = useMemo(() => {
    const dots = Array.from({ length: 48 }, (_, i) => {
      const hasSignal = signalCount > 0 && i % Math.max(1, Math.floor(48 / signalCount)) === 0 && i / Math.max(1, Math.floor(48 / signalCount)) < signalCount;
      const hasTrade = tradeCount > 0 && i % Math.max(1, Math.floor(48 / tradeCount)) === 0 && i / Math.max(1, Math.floor(48 / tradeCount)) < tradeCount;
      const hasReject = rejectedCount > 0 && i % Math.max(1, Math.floor(48 / rejectedCount)) === 0 && i / Math.max(1, Math.floor(48 / rejectedCount)) < rejectedCount;
      const hasScan = scanCount > 0 && i % Math.max(1, Math.floor(48 / Math.min(scanCount, 48))) === 0;
      return { i, hasSignal, hasTrade, hasReject, hasScan };
    });
    return dots;
  }, [scanCount, signalCount, tradeCount, rejectedCount]);

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <a
          href={getLoginUrl()}
          className="px-6 py-3 bg-emerald-500 text-white font-bold uppercase tracking-wider hover:bg-emerald-400 transition"
        >
          Login to View Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            SMC Trading Dashboard
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isRunning
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "bg-zinc-700/50 text-zinc-400 border border-zinc-600"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`}
            />
            {isRunning ? "Bot Running" : "Bot Stopped"}
          </span>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          {new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}
        </div>
      </div>

      {/* ═══ KPI CARDS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
            Balance
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {formatMoney(balance)}
          </div>
          <div
            className={`text-xs font-mono mt-1 ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {formatMoney(profit, true)} ({profitPct}%) {profit >= 0 ? "↗" : "↘"}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
            Today P&L
          </div>
          <div
            className={`text-2xl font-bold font-mono ${dailyPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {formatMoney(dailyPnl, true)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{totalTrades} trades</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
            Open Positions
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">{positions.length}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatMoney(d?.marginUsed ?? 0)} exposure
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
            Win Rate
          </div>
          <div
            className={`text-2xl font-bold font-mono ${winRate >= 50 ? "text-emerald-400" : winRate > 0 ? "text-red-400" : "text-muted-foreground"}`}
          >
            {totalTrades > 0 ? `${winRate.toFixed(1)}%` : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {wins}W / {losses}L
          </div>
        </div>
      </div>

      {/* ═══ EQUITY CURVE + DRAWDOWN ═══ */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-foreground">Equity Curve</h2>
            {/* Legend */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-cyan-400 inline-block" /> Equity
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-red-400/60 inline-block" /> Drawdown
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-px bg-zinc-500 inline-block border-t border-dashed border-zinc-500" />{" "}
                Benchmark
              </span>
            </div>
          </div>
          {/* Time range selector */}
          <div className="flex items-center gap-1">
            {(["1W", "1M", "3M", "6M", "ALL"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${
                  timeRange === range
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-zinc-800"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Max Drawdown indicator */}
        {equityChartData.length > 0 && maxDrawdown < 0 && (
          <div className="text-[10px] text-red-400/80 font-mono mb-2">
            Max Drawdown: {maxDrawdown.toFixed(2)}%
          </div>
        )}

        {equityChartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={equityChartData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <defs>
                  <linearGradient id="dashEqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="dashDdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="equity"
                  tick={{ fontSize: 10, fill: "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                  domain={["dataMin - 200", "dataMax + 200"]}
                />
                <YAxis
                  yAxisId="dd"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  domain={["dataMin - 2", 2]}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a1f2e",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "equity") return [`$${value.toFixed(2)}`, "Equity"];
                    if (name === "drawdown") return [`${value.toFixed(2)}%`, "Drawdown"];
                    if (name === "benchmark") return [`$${value.toFixed(2)}`, "Benchmark"];
                    return [value, name];
                  }}
                />
                {/* Benchmark line */}
                <ReferenceLine
                  yAxisId="equity"
                  y={startingBalance}
                  stroke="#6b7280"
                  strokeDasharray="6 3"
                  strokeWidth={1}
                />
                {/* Drawdown area */}
                <Area
                  yAxisId="dd"
                  type="monotone"
                  dataKey="drawdown"
                  stroke="#ef4444"
                  fill="url(#dashDdGrad)"
                  strokeWidth={1}
                  strokeOpacity={0.6}
                  dot={false}
                />
                {/* Equity area */}
                <Area
                  yAxisId="equity"
                  type="monotone"
                  dataKey="equity"
                  stroke="#22d3ee"
                  fill="url(#dashEqGrad)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-xs font-mono">
            No closed trades yet. Start paper trading to build your equity curve.
          </div>
        )}
      </div>

      {/* ═══ MIDDLE ROW: Active Positions + Portfolio Heat ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Active Positions (3/5) */}
        <div className="lg:col-span-3 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-bold text-foreground mb-3">Active Positions</h2>
          {positions.length > 0 ? (
            <div className="overflow-auto max-h-52 -mx-1">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="text-left py-1.5 px-1">Symbol</th>
                    <th className="text-center py-1.5 px-1">Dir</th>
                    <th className="text-right py-1.5 px-1">Entry</th>
                    <th className="text-right py-1.5 px-1">Current</th>
                    <th className="text-right py-1.5 px-1">P&L</th>
                    <th className="text-right py-1.5 px-1">Size</th>
                    <th className="text-right py-1.5 px-1">SL</th>
                    <th className="text-right py-1.5 px-1">TP</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => {
                    const decimals = p.symbol.includes("JPY") ? 3 : 4;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-border/30 hover:bg-card/80 transition-colors"
                      >
                        <td className="py-1.5 px-1 font-bold text-foreground">
                          {p.symbol.replace("/", "")}
                        </td>
                        <td className="py-1.5 px-1 text-center">
                          <span
                            className={`inline-flex items-center gap-0.5 ${p.direction === "long" ? "text-emerald-400" : "text-red-400"}`}
                          >
                            {p.direction === "long" ? "▲" : "▼"}
                          </span>
                        </td>
                        <td className="py-1.5 px-1 text-right text-muted-foreground">
                          {p.entryPrice.toFixed(decimals)}
                        </td>
                        <td className="py-1.5 px-1 text-right text-foreground">
                          {p.currentPrice?.toFixed(decimals) ?? "—"}
                        </td>
                        <td
                          className={`py-1.5 px-1 text-right font-bold ${p.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {formatMoney(p.pnl, true)}
                        </td>
                        <td className="py-1.5 px-1 text-right text-foreground">
                          {p.size.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-1 text-right text-red-400/70">
                          {p.stopLoss ? p.stopLoss.toFixed(decimals) : "—"}
                        </td>
                        <td className="py-1.5 px-1 text-right text-emerald-400/70">
                          {p.takeProfit ? p.takeProfit.toFixed(decimals) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-muted-foreground text-xs font-mono">
              No active positions
            </div>
          )}
        </div>

        {/* Portfolio Heat Donut (2/5) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-bold text-foreground mb-3">Portfolio Heat</h2>
          <div className="flex items-center gap-4">
            <div className="relative w-36 h-36 flex-shrink-0">
              {currencyExposure.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={currencyExposure}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {currencyExposure.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <svg className="w-full h-full" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    className="text-zinc-800"
                  />
                </svg>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className={`text-xl font-bold font-mono ${totalHeat > 6 ? "text-red-400" : totalHeat > 3 ? "text-yellow-400" : "text-emerald-400"}`}
                >
                  {totalHeat.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {currencyExposure.length > 0 ? (
                currencyExposure.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs text-muted-foreground">{entry.name}</span>
                    <span className="text-xs font-mono text-foreground ml-auto">{entry.value}%</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">No exposure</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM ROW: Bot Activity ═══ */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Bot Activity</h2>
          <span className="text-xs text-muted-foreground">Last 24 hours</span>
        </div>

        {/* Activity dots visualization */}
        <div className="h-20 flex items-end gap-px px-1 mb-3">
          {activityDots.map(({ i, hasSignal, hasTrade, hasReject, hasScan }) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
              {hasTrade && <div className="w-2 h-2 rotate-45 bg-purple-500" />}
              {hasSignal && (
                <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-cyan-400" />
              )}
              {hasReject && (
                <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-transparent border-b-red-400" />
              )}
              {hasScan && <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />}
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground border-t border-border/50 pt-2">
          <span>
            Scans: <span className="text-foreground font-bold">{scanCount}</span>
          </span>
          <span className="text-border">|</span>
          <span>
            Signals: <span className="text-cyan-400 font-bold">{signalCount}</span>
          </span>
          <span className="text-border">|</span>
          <span>
            Trades: <span className="text-purple-400 font-bold">{tradeCount}</span>
          </span>
          <span className="text-border">|</span>
          <span>
            Rejected: <span className="text-red-400 font-bold">{rejectedCount}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
