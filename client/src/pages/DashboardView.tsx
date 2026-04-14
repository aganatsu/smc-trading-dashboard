/**
 * DashboardView — Overview with KPI cards, equity curve, portfolio heat, positions
 * Pulls data from paper trading engine + journal
 */

import { useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import {
  DollarSign, TrendingUp, TrendingDown, Activity, Target, Flame,
  BarChart3, Zap
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardView() {
  // Paper trading status (real-time)
  const paperStatus = trpc.paper.status.useQuery(undefined, { refetchInterval: 5000 });
  // Journal stats (historical)
  const stats = trpc.trades.stats.useQuery(undefined, { refetchInterval: 30000 });
  // Equity curve
  const equityCurve = trpc.trades.equityCurve.useQuery(undefined, { refetchInterval: 30000 });

  const balance = paperStatus.data?.balance ?? 10000;
  const equity = paperStatus.data?.equity ?? 10000;
  const unrealizedPnl = paperStatus.data?.unrealizedPnl ?? 0;
  const positions = paperStatus.data?.positions ?? [];
  const isRunning = paperStatus.data?.isRunning ?? false;
  const winRate = stats.data?.winRate ?? paperStatus.data?.winRate ?? 0;
  const totalTrades = stats.data?.totalTrades ?? paperStatus.data?.totalTrades ?? 0;

  // Portfolio heat: sum of risk per position (approximate)
  const portfolioHeat = useMemo(() => {
    if (positions.length === 0) return 0;
    // Approximate: each position's risk as % of balance
    const totalRisk = positions.reduce((sum, p) => {
      if (p.stopLoss) {
        const riskPerUnit = Math.abs(p.entryPrice - p.stopLoss);
        const riskAmount = riskPerUnit * p.size * 100000; // simplified for forex
        return sum + (riskAmount / balance) * 100;
      }
      return sum + 1; // default 1% if no SL
    }, 0);
    return Math.min(totalRisk, 100);
  }, [positions, balance]);

  // Equity curve data
  const equityData = useMemo(() => {
    if (!equityCurve.data?.length) return [];
    return equityCurve.data.map((d: any) => ({
      date: d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      cumulative: d.cumulative,
    }));
  }, [equityCurve.data]);

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold font-mono text-foreground flex items-center gap-2">
          <Zap className="w-5 h-5 text-cyan" />
          DASHBOARD
        </h1>
        <div className={`px-2 py-0.5 text-[10px] font-mono font-bold ${isRunning ? 'bg-bullish/20 text-bullish' : 'bg-muted text-muted-foreground'}`}>
          {isRunning ? 'ENGINE RUNNING' : 'ENGINE STOPPED'}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard
          icon={DollarSign}
          label="Balance"
          value={`$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          color="text-foreground"
        />
        <KPICard
          icon={TrendingUp}
          label="Equity"
          value={`$${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          color="text-cyan"
        />
        <KPICard
          icon={unrealizedPnl >= 0 ? TrendingUp : TrendingDown}
          label="Open P&L"
          value={`${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)}`}
          color={unrealizedPnl >= 0 ? 'text-bullish' : 'text-bearish'}
        />
        <KPICard
          icon={Target}
          label="Win Rate"
          value={totalTrades > 0 ? `${winRate.toFixed(1)}%` : '—'}
          color={winRate >= 50 ? 'text-bullish' : winRate > 0 ? 'text-bearish' : 'text-muted-foreground'}
        />
        <KPICard
          icon={Activity}
          label="Active Positions"
          value={String(positions.length)}
          color="text-foreground"
        />
      </div>

      {/* Main Grid: Equity Curve + Portfolio Heat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Equity Curve (2/3 width) */}
        <div className="lg:col-span-2 bg-card border border-border p-4">
          <h2 className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider mb-3">
            Equity Curve
          </h2>
          {equityData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityData}>
                  <defs>
                    <linearGradient id="dashEqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.85 0.18 192)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="oklch(0.85 0.18 192)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#141926', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 0, fontSize: 11, fontFamily: 'monospace' }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cumulative P&L']}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="oklch(0.85 0.18 192)" fill="url(#dashEqGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-xs font-mono">
              No closed trades yet. Start paper trading to build your equity curve.
            </div>
          )}
        </div>

        {/* Portfolio Heat Gauge (1/3 width) */}
        <div className="bg-card border border-border p-4">
          <h2 className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" />
            Portfolio Heat
          </h2>
          <div className="flex flex-col items-center justify-center h-40">
            <div className="relative w-32 h-32">
              {/* Background circle */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  strokeWidth="8"
                  strokeLinecap="butt"
                  strokeDasharray={`${(portfolioHeat / 100) * 314} 314`}
                  className={portfolioHeat > 6 ? 'stroke-bearish' : portfolioHeat > 3 ? 'stroke-warning' : 'stroke-bullish'}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold font-mono ${portfolioHeat > 6 ? 'text-bearish' : portfolioHeat > 3 ? 'text-warning' : 'text-bullish'}`}>
                  {portfolioHeat.toFixed(1)}%
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">of account</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] font-mono text-muted-foreground text-center">
              Max recommended: 6%
            </div>
          </div>
        </div>
      </div>

      {/* Active Positions Table */}
      <div className="bg-card border border-border">
        <div className="px-4 py-2 border-b border-border">
          <h2 className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider">
            Active Positions ({positions.length})
          </h2>
        </div>
        {positions.length > 0 ? (
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted-foreground border-b border-border/50">
                <th className="text-left py-2 px-4">Symbol</th>
                <th className="text-left py-2 px-4">Dir</th>
                <th className="text-right py-2 px-4">Size</th>
                <th className="text-right py-2 px-4">Entry</th>
                <th className="text-right py-2 px-4">Current</th>
                <th className="text-right py-2 px-4">SL</th>
                <th className="text-right py-2 px-4">TP</th>
                <th className="text-right py-2 px-4">P&L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => (
                <tr key={p.id} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="py-2 px-4 font-bold text-foreground">{p.symbol}</td>
                  <td className="py-2 px-4">
                    <span className={`px-1 py-0.5 text-[10px] font-bold ${p.direction === 'long' ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'}`}>
                      {p.direction === 'long' ? 'BUY' : 'SELL'}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-right text-foreground">{p.size}</td>
                  <td className="py-2 px-4 text-right text-foreground">{p.entryPrice.toFixed(5)}</td>
                  <td className="py-2 px-4 text-right text-foreground">{p.currentPrice.toFixed(5)}</td>
                  <td className="py-2 px-4 text-right text-muted-foreground">{p.stopLoss?.toFixed(5) ?? '—'}</td>
                  <td className="py-2 px-4 text-right text-muted-foreground">{p.takeProfit?.toFixed(5) ?? '—'}</td>
                  <td className={`py-2 px-4 text-right font-bold ${p.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                    {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-8 text-center text-muted-foreground text-xs font-mono">
            No active positions. Open a paper trade from the Bot view.
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border p-3">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Total Trades</div>
          <div className="text-lg font-bold font-mono text-foreground">{totalTrades}</div>
        </div>
        <div className="bg-card border border-border p-3">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Wins</div>
          <div className="text-lg font-bold font-mono text-bullish">{stats.data?.wins ?? 0}</div>
        </div>
        <div className="bg-card border border-border p-3">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Losses</div>
          <div className="text-lg font-bold font-mono text-bearish">{stats.data?.losses ?? 0}</div>
        </div>
        <div className="bg-card border border-border p-3">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Total P&L</div>
          <div className={`text-lg font-bold font-mono ${(stats.data?.totalPnl ?? 0) >= 0 ? 'text-bullish' : 'text-bearish'}`}>
            {(stats.data?.totalPnl ?? 0) >= 0 ? '+' : ''}${(stats.data?.totalPnl ?? 0).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-border p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}
