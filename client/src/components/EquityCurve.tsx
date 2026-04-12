/**
 * Equity Curve — Cumulative P&L visualization for the Trade Journal.
 * Uses Recharts for a clean line chart with the Obsidian Forge theme.
 * Includes daily/weekly/monthly P&L breakdown.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from "recharts";
import { TrendingUp, BarChart3, Calendar } from "lucide-react";

type PeriodView = "curve" | "daily" | "weekly" | "monthly";

function groupByPeriod(
  data: Array<{ date: string | Date | null; pnl: number; symbol: string }>,
  period: "daily" | "weekly" | "monthly"
) {
  const groups: Record<string, { label: string; pnl: number; trades: number }> = {};

  data.forEach((point) => {
    if (!point.date) return;
    const d = new Date(point.date);
    let key: string;
    let label: string;

    if (period === "daily") {
      key = d.toISOString().slice(0, 10);
      label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else if (period === "weekly") {
      // Get the Monday of the week
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      key = monday.toISOString().slice(0, 10);
      label = `W ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }

    if (!groups[key]) {
      groups[key] = { label, pnl: 0, trades: 0 };
    }
    groups[key].pnl += point.pnl;
    groups[key].trades += 1;
  });

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

export default function EquityCurve() {
  const { data: curveData, isLoading } = trpc.trades.equityCurve.useQuery();
  const [view, setView] = useState<PeriodView>("curve");

  const chartData = useMemo(() => {
    if (!curveData) return [];
    return curveData.map((point) => ({
      date: point.date
        ? new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "",
      rawDate: point.date,
      pnl: point.pnl,
      cumulative: point.cumulative,
      symbol: point.symbol,
    }));
  }, [curveData]);

  const periodData = useMemo(() => {
    if (!curveData || view === "curve") return [];
    return groupByPeriod(
      curveData.map((p) => ({ date: p.date, pnl: p.pnl, symbol: p.symbol })),
      view as "daily" | "weekly" | "monthly"
    );
  }, [curveData, view]);

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <BarChart3 className="w-5 h-5 text-cyan animate-pulse" />
      </div>
    );
  }

  if (!curveData || curveData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center border-2 border-border bg-card/30">
        <div className="text-center">
          <TrendingUp className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Close trades to see your equity curve
          </p>
        </div>
      </div>
    );
  }

  const maxCumulative = Math.max(...chartData.map((d) => d.cumulative));
  const minCumulative = Math.min(...chartData.map((d) => d.cumulative));
  const isPositive = chartData[chartData.length - 1]?.cumulative >= 0;

  const tabs: { key: PeriodView; label: string }[] = [
    { key: "curve", label: "Equity" },
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
  ];

  return (
    <div className="border-2 border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan" />
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground font-mono">
            Performance
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`px-2 py-1 text-[9px] font-mono uppercase tracking-wider transition-colors ${
                view === tab.key
                  ? "bg-cyan/20 text-cyan border border-cyan/40"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Equity Curve View */}
      {view === "curve" && (
        <>
          <div className="flex items-center justify-end gap-3 text-[10px] font-mono mb-2">
            <span className="text-muted-foreground">
              Trades: <span className="text-foreground">{chartData.length}</span>
            </span>
            <span className={isPositive ? "text-green-400" : "text-red-400"}>
              {isPositive ? "+" : ""}
              ${chartData[chartData.length - 1]?.cumulative.toFixed(2)}
            </span>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={isPositive ? "#00E5FF" : "#ef4444"}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={isPositive ? "#00E5FF" : "#ef4444"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#666", fontFamily: "IBM Plex Mono" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#666", fontFamily: "IBM Plex Mono" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                  domain={[
                    Math.min(minCumulative * 1.1, 0),
                    Math.max(maxCumulative * 1.1, 0),
                  ]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0A0A0F",
                    border: "2px solid #1a1a2e",
                    borderRadius: 0,
                    fontFamily: "IBM Plex Mono",
                    fontSize: 11,
                  }}
                  labelStyle={{ color: "#666", fontSize: 10 }}
                  formatter={(value: number, name: string) => {
                    if (name === "cumulative") {
                      return [`$${value.toFixed(2)}`, "Cumulative P&L"];
                    }
                    return [`$${value.toFixed(2)}`, "Trade P&L"];
                  }}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke={isPositive ? "#00E5FF" : "#ef4444"}
                  strokeWidth={2}
                  fill="url(#equityGradient)"
                  dot={{
                    r: 3,
                    fill: "#0A0A0F",
                    stroke: isPositive ? "#00E5FF" : "#ef4444",
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 5,
                    fill: isPositive ? "#00E5FF" : "#ef4444",
                    stroke: "#0A0A0F",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Per-trade P&L bar visualization */}
          <div className="mt-3 flex items-end gap-0.5 h-8">
            {chartData.map((point, i) => {
              const maxAbs = Math.max(
                ...chartData.map((d) => Math.abs(d.pnl)),
                1
              );
              const height = Math.max((Math.abs(point.pnl) / maxAbs) * 100, 5);
              return (
                <div
                  key={i}
                  className="flex-1 relative group"
                  style={{ height: "100%" }}
                >
                  <div
                    className={`absolute bottom-0 w-full transition-all ${
                      point.pnl >= 0 ? "bg-green-400/60" : "bg-red-400/60"
                    } hover:opacity-80`}
                    style={{ height: `${height}%` }}
                  />
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-card border border-border px-1.5 py-0.5 text-[8px] font-mono text-foreground whitespace-nowrap z-10">
                    {point.symbol} {point.pnl >= 0 ? "+" : ""}${point.pnl.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[8px] font-mono text-muted-foreground">
            <span>Oldest</span>
            <span>Per-trade P&L</span>
            <span>Newest</span>
          </div>
        </>
      )}

      {/* Period Breakdown View (Daily / Weekly / Monthly) */}
      {view !== "curve" && periodData.length > 0 && (
        <>
          <div className="flex items-center justify-end gap-3 text-[10px] font-mono mb-2">
            <span className="text-muted-foreground">
              Periods: <span className="text-foreground">{periodData.length}</span>
            </span>
            <span
              className={
                periodData.reduce((s, d) => s + d.pnl, 0) >= 0
                  ? "text-green-400"
                  : "text-red-400"
              }
            >
              Total: {periodData.reduce((s, d) => s + d.pnl, 0) >= 0 ? "+" : ""}$
              {periodData.reduce((s, d) => s + d.pnl, 0).toFixed(2)}
            </span>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#666", fontFamily: "IBM Plex Mono" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#666", fontFamily: "IBM Plex Mono" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0A0A0F",
                    border: "2px solid #1a1a2e",
                    borderRadius: 0,
                    fontFamily: "IBM Plex Mono",
                    fontSize: 11,
                  }}
                  labelStyle={{ color: "#666", fontSize: 10 }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "P&L"]}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                  {periodData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.pnl >= 0 ? "#00E5FF" : "#ef4444"}
                      fillOpacity={0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Period summary table */}
          <div className="mt-3 max-h-32 overflow-y-auto">
            <table className="w-full text-[9px] font-mono">
              <thead>
                <tr className="text-muted-foreground uppercase tracking-wider border-b border-border/30">
                  <th className="text-left py-1 px-2">Period</th>
                  <th className="text-right py-1 px-2">Trades</th>
                  <th className="text-right py-1 px-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {periodData.map((row, i) => (
                  <tr key={i} className="border-b border-border/10 hover:bg-muted/20">
                    <td className="py-1 px-2 text-foreground">{row.label}</td>
                    <td className="py-1 px-2 text-right text-foreground">{row.trades}</td>
                    <td
                      className={`py-1 px-2 text-right font-bold ${
                        row.pnl >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {row.pnl >= 0 ? "+" : ""}${row.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view !== "curve" && periodData.length === 0 && (
        <div className="h-52 flex items-center justify-center">
          <div className="text-center">
            <Calendar className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              No data for this period
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
