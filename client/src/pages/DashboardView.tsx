/**
 * DashboardView — Matches mockup-dashboard-overview.png
 * KPI cards, equity curve, active positions, portfolio heat donut, bot activity
 */

import { useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ─── Helpers ────────────────────────────────────────────────────────

function formatMoney(val: number, showSign = false): string {
  const abs = Math.abs(val);
  const str = abs >= 1000
    ? `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${abs.toFixed(2)}`;
  if (showSign) return val >= 0 ? `+${str}` : `-${str}`;
  return str;
}

// ─── Component ──────────────────────────────────────────────────────

export default function DashboardView() {
  const { isAuthenticated } = useAuth();
  const paperStatus = trpc.paper.status.useQuery(undefined, { refetchInterval: 5000 });
  const stats = trpc.trades.stats.useQuery(undefined, { refetchInterval: 30000 });
  const equityCurve = trpc.trades.equityCurve.useQuery(undefined, { refetchInterval: 30000 });

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
  const profit = balance - 10000;
  const profitPct = ((profit / 10000) * 100).toFixed(1);

  // Equity curve data
  const equityData = useMemo(() => {
    if (!equityCurve.data?.length) return [];
    return equityCurve.data.map((d: any) => ({
      date: d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      cumulative: d.cumulative,
    }));
  }, [equityCurve.data]);

  // Portfolio heat — currency exposure breakdown
  const currencyExposure = useMemo(() => {
    const exposure: Record<string, number> = {};
    positions.forEach(p => {
      const sym = p.symbol.replace('/', '');
      // Extract base and quote currencies
      const base = sym.substring(0, 3);
      const quote = sym.substring(3, 6);
      const notional = p.size * 100000; // simplified
      exposure[base] = (exposure[base] || 0) + notional;
      exposure[quote] = (exposure[quote] || 0) + notional;
    });
    const total = Object.values(exposure).reduce((s, v) => s + v, 0) || 1;
    const sorted = Object.entries(exposure)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);

    const colors = ['#f59e0b', '#3b82f6', '#a855f7', '#6b7280'];
    return sorted.map(([currency, val], i) => ({
      name: `${currency} exposure`,
      value: Math.round((val / total) * 100),
      color: colors[i] || '#6b7280',
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

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <a href={getLoginUrl()} className="px-6 py-3 bg-emerald-500 text-white font-bold uppercase tracking-wider hover:bg-emerald-400 transition">
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
          <h1 className="text-lg font-bold text-foreground tracking-tight">SMC Trading Dashboard</h1>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            isRunning
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
            {isRunning ? 'Bot Running' : 'Bot Stopped'}
          </span>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
        </div>
      </div>

      {/* ═══ KPI CARDS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Balance */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Balance</div>
          <div className="text-2xl font-bold font-mono text-foreground">{formatMoney(balance)}</div>
          <div className={`text-xs font-mono mt-1 ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatMoney(profit, true)} ({profitPct}%) {profit >= 0 ? '↗' : '↘'}
          </div>
        </div>

        {/* Today P&L */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Today P&L</div>
          <div className={`text-2xl font-bold font-mono ${dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatMoney(dailyPnl, true)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{totalTrades} trades</div>
        </div>

        {/* Open Positions */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Open Positions</div>
          <div className="text-2xl font-bold font-mono text-foreground">{positions.length}</div>
          <div className="text-xs text-muted-foreground mt-1">{formatMoney(d?.marginUsed ?? 0)} exposure</div>
        </div>

        {/* Win Rate */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Win Rate</div>
          <div className={`text-2xl font-bold font-mono ${winRate >= 50 ? 'text-emerald-400' : winRate > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
            {totalTrades > 0 ? `${winRate.toFixed(1)}%` : '—'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{wins}W / {losses}L</div>
        </div>
      </div>

      {/* ═══ MIDDLE ROW: Equity Curve + Active Positions ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Equity Curve (3/5) */}
        <div className="lg:col-span-3 bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">Equity Curve</h2>
            <span className="text-xs text-muted-foreground">3 months</span>
          </div>
          {equityData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityData}>
                  <defs>
                    <linearGradient id="dashEqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} domain={['dataMin - 500', 'dataMax + 500']} />
                  <Tooltip
                    contentStyle={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11, fontFamily: 'monospace' }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Equity']}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="#22d3ee" fill="url(#dashEqGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-xs font-mono">
              No closed trades yet. Start paper trading to build your equity curve.
            </div>
          )}
        </div>

        {/* Active Positions (2/5) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-bold text-foreground mb-3">Active Positions</h2>
          {positions.length > 0 ? (
            <div className="overflow-auto max-h-52 -mx-1">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="text-left py-1.5 px-1">Symbol</th>
                    <th className="text-center py-1.5 px-1"></th>
                    <th className="text-right py-1.5 px-1">Entry</th>
                    <th className="text-right py-1.5 px-1">P&L</th>
                    <th className="text-right py-1.5 px-1">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map(p => (
                    <tr key={p.id} className="border-b border-border/30 hover:bg-card/80 transition-colors">
                      <td className="py-1.5 px-1 font-bold text-foreground">{p.symbol.replace('/', '')}</td>
                      <td className="py-1.5 px-1 text-center">
                        <span className={p.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}>
                          {p.direction === 'long' ? '↑' : '↓'}
                        </span>
                      </td>
                      <td className="py-1.5 px-1 text-right text-muted-foreground">
                        ${p.entryPrice.toFixed(p.symbol.includes('JPY') ? 3 : 4)}
                      </td>
                      <td className={`py-1.5 px-1 text-right font-bold ${p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatMoney(p.pnl, true)}
                      </td>
                      <td className="py-1.5 px-1 text-right text-foreground">{p.size.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-xs font-mono">
              No active positions
            </div>
          )}
        </div>
      </div>

      {/* ═══ BOTTOM ROW: Portfolio Heat + Bot Activity ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Portfolio Heat Donut (2/5) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-bold text-foreground mb-3">Portfolio Heat</h2>
          <div className="flex items-center gap-4">
            {/* Donut */}
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
                  <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="12" className="text-zinc-800" />
                </svg>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xl font-bold font-mono ${totalHeat > 6 ? 'text-red-400' : totalHeat > 3 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  {totalHeat.toFixed(0)}%
                </span>
              </div>
            </div>
            {/* Legend */}
            <div className="space-y-2">
              {currencyExposure.length > 0 ? currencyExposure.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs text-muted-foreground">{entry.name}</span>
                  <span className="text-xs font-mono text-foreground ml-auto">{entry.value}%</span>
                </div>
              )) : (
                <div className="text-xs text-muted-foreground">No exposure</div>
              )}
            </div>
          </div>
        </div>

        {/* Bot Activity (3/5) */}
        <div className="lg:col-span-3 bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">Bot Activity</h2>
            <span className="text-xs text-muted-foreground">Last 24 hours</span>
          </div>

          {/* Activity dots visualization */}
          <div className="h-20 flex items-end gap-px px-1 mb-3">
            {Array.from({ length: 48 }, (_, i) => {
              // Simulate activity dots based on engine data
              const hasSignal = i % 7 === 0 && i < signalCount * 2;
              const hasTrade = i % 11 === 0 && i < tradeCount * 5;
              const hasReject = i % 9 === 0 && i < rejectedCount * 3;
              const hasScan = i % 2 === 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                  {hasTrade && <div className="w-2 h-2 rotate-45 bg-purple-500" />}
                  {hasSignal && <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-cyan-400" />}
                  {hasReject && <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-transparent border-b-red-400" />}
                  {hasScan && <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />}
                </div>
              );
            })}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground border-t border-border/50 pt-2">
            <span>Scans: <span className="text-foreground font-bold">{scanCount}</span></span>
            <span className="text-border">|</span>
            <span>Signals: <span className="text-cyan-400 font-bold">{signalCount}</span></span>
            <span className="text-border">|</span>
            <span>Trades: <span className="text-purple-400 font-bold">{tradeCount}</span></span>
            <span className="text-border">|</span>
            <span>Rejected: <span className="text-red-400 font-bold">{rejectedCount}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
