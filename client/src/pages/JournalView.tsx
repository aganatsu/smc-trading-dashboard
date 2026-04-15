/**
 * JournalView — Trade journal with performance analytics
 * Tabs: Trades, Performance, Calculator
 * Auto-populated from paper trading + manual entry support
 * Filters: symbol, direction, date range
 */

import { useState, useMemo, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import {
  BookOpen, TrendingUp, TrendingDown, BarChart3, Target,
  Plus, Filter, ChevronDown, ArrowUpDown, Calculator, Calendar,
  Brain, AlertTriangle, CheckCircle, XCircle
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

type TabId = 'journal' | 'performance' | 'calculator';

export default function JournalView() {
  const [activeTab, setActiveTab] = useState<TabId>('journal');
  const [filterSymbol, setFilterSymbol] = useState('all');
  const [filterDirection, setFilterDirection] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<any>(null);

  const trades = trpc.trades.list.useQuery(
    { limit: 100, offset: 0 },
    { refetchInterval: 15000 }
  );

  const stats = trpc.trades.stats.useQuery(undefined, { refetchInterval: 30000 });

  const equityCurve = trpc.trades.equityCurve.useQuery(undefined, { refetchInterval: 30000 });

  const filteredTrades = useMemo(() => {
    if (!trades.data) return [];
    return trades.data.filter((t: any) => {
      if (filterSymbol !== 'all' && t.symbol !== filterSymbol) return false;
      if (filterDirection !== 'all' && t.direction !== filterDirection) return false;
      if (dateFrom && t.entryTime) {
        const tradeDate = new Date(t.entryTime).toISOString().split('T')[0];
        if (tradeDate < dateFrom) return false;
      }
      if (dateTo && t.entryTime) {
        const tradeDate = new Date(t.entryTime).toISOString().split('T')[0];
        if (tradeDate > dateTo) return false;
      }
      return true;
    });
  }, [trades.data, filterSymbol, filterDirection, dateFrom, dateTo]);

  const uniqueSymbols = useMemo(() => {
    if (!trades.data) return [];
    return Array.from(new Set(trades.data.map((t: any) => t.symbol)));
  }, [trades.data]);

  const totalPnl = stats.data?.totalPnl ?? 0;
  const winRate = stats.data?.winRate ?? 0;
  const totalTrades = stats.data?.totalTrades ?? 0;
  const wins = stats.data?.wins ?? 0;
  const losses = stats.data?.losses ?? 0;

  // Calculate additional stats
  const profitFactor = useMemo(() => {
    if (!trades.data) return 0;
    const closedTrades = trades.data.filter((t: any) => t.status === 'closed' && t.pnlAmount);
    const grossProfit = closedTrades.reduce((s: number, t: any) => {
      const pnl = parseFloat(t.pnlAmount || '0');
      return pnl > 0 ? s + pnl : s;
    }, 0);
    const grossLoss = Math.abs(closedTrades.reduce((s: number, t: any) => {
      const pnl = parseFloat(t.pnlAmount || '0');
      return pnl < 0 ? s + pnl : s;
    }, 0));
    return grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  }, [trades.data]);

  const avgRR = useMemo(() => {
    if (!trades.data) return 0;
    const withRR = trades.data.filter((t: any) => t.riskReward);
    if (withRR.length === 0) return 0;
    return withRR.reduce((s: number, t: any) => s + parseFloat(t.riskReward || '0'), 0) / withRR.length;
  }, [trades.data]);

  const equityData = useMemo(() => {
    if (!equityCurve.data?.length) return [];
    return equityCurve.data.map((d: any) => ({
      date: d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      cumulative: d.cumulative,
    }));
  }, [equityCurve.data]);

  // Daily P&L data for performance bar chart
  const dailyPnlData = useMemo(() => {
    if (!trades.data) return [];
    const byDay: Record<string, number> = {};
    trades.data.filter((t: any) => t.status === 'closed' && t.pnlAmount && t.exitTime).forEach((t: any) => {
      const day = new Date(t.exitTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      byDay[day] = (byDay[day] || 0) + parseFloat(t.pnlAmount || '0');
    });
    return Object.entries(byDay).map(([day, pnl]) => ({ day, pnl }));
  }, [trades.data]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold font-mono text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-cyan" />
          JOURNAL
        </h1>
        <div className="flex items-center gap-2">
          {(['journal', 'performance', 'calculator'] as TabId[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs font-mono font-bold transition-colors ${
                activeTab === tab ? 'bg-cyan/20 text-cyan' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'journal' ? 'Trades' : tab === 'performance' ? 'Performance' : 'Calculator'}
            </button>
          ))}
        </div>
      </div>

      {/* Performance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label="Total Trades" value={String(totalTrades)} />
        <StatCard label="Win Rate" value={`${winRate.toFixed(1)}%`} color={winRate >= 50 ? 'text-bullish' : 'text-bearish'} />
        <StatCard label="Wins / Losses" value={`${wins} / ${losses}`} />
        <StatCard label="Total P&L" value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`} color={totalPnl >= 0 ? 'text-bullish' : 'text-bearish'} />
        <StatCard label="Profit Factor" value={profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)} color={profitFactor >= 1 ? 'text-bullish' : 'text-bearish'} />
        <StatCard label="Avg R:R" value={avgRR.toFixed(2)} />
      </div>

      {activeTab === 'journal' ? (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterSymbol}
              onChange={e => setFilterSymbol(e.target.value)}
              className="bg-muted border border-border px-2 py-1 text-xs font-mono text-foreground"
            >
              <option value="all">All Symbols</option>
              {uniqueSymbols.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterDirection}
              onChange={e => setFilterDirection(e.target.value)}
              className="bg-muted border border-border px-2 py-1 text-xs font-mono text-foreground"
            >
              <option value="all">All Directions</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="bg-muted border border-border px-2 py-1 text-xs font-mono text-foreground"
                placeholder="From"
              />
              <span className="text-muted-foreground text-xs">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="bg-muted border border-border px-2 py-1 text-xs font-mono text-foreground"
                placeholder="To"
              />
            </div>
            {(dateFrom || dateTo || filterSymbol !== 'all' || filterDirection !== 'all') && (
              <button
                onClick={() => { setFilterSymbol('all'); setFilterDirection('all'); setDateFrom(''); setDateTo(''); }}
                className="text-[10px] font-mono text-cyan hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
            <div className="flex-1" />
            <span className="text-xs font-mono text-muted-foreground">
              {filteredTrades.length} trades
            </span>
          </div>

          <div className="flex gap-4">
            {/* Trade Table */}
            <div className={`${selectedTrade ? 'w-[65%]' : 'w-full'} bg-card border border-border overflow-x-auto transition-all`}>
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Symbol</th>
                    <th className="text-left py-2 px-3">Dir</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-right py-2 px-3">Entry</th>
                    <th className="text-right py-2 px-3">Exit</th>
                    <th className="text-right py-2 px-3">SL</th>
                    <th className="text-right py-2 px-3">TP</th>
                    <th className="text-right py-2 px-3">Size</th>
                    <th className="text-right py-2 px-3">P&L</th>
                    <th className="text-right py-2 px-3">R:R</th>
                    <th className="text-left py-2 px-3">Setup</th>
                    <th className="text-left py-2 px-3">TF</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((t: any) => {
                    const pnl = t.pnlAmount ? parseFloat(t.pnlAmount) : null;
                    return (
                      <tr
                        key={t.id}
                        className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer ${selectedTrade?.id === t.id ? 'bg-cyan/5' : ''}`}
                        onClick={() => setSelectedTrade(selectedTrade?.id === t.id ? null : t)}
                      >
                        <td className="py-2 px-3 text-muted-foreground">
                          {t.entryTime ? new Date(t.entryTime).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2 px-3 text-foreground font-bold">{t.symbol}</td>
                        <td className="py-2 px-3">
                          <span className={`px-1 py-0.5 text-[10px] font-bold ${t.direction === 'long' ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'}`}>
                            {t.direction === 'long' ? 'BUY' : 'SELL'}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] font-bold ${
                            t.status === 'closed' ? 'text-muted-foreground' :
                            t.status === 'open' ? 'text-cyan' : 'text-warning'
                          }`}>
                            {t.status?.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-foreground">{t.entryPrice}</td>
                        <td className="py-2 px-3 text-right text-foreground">{t.exitPrice || '—'}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{t.stopLoss || '—'}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{t.takeProfit || '—'}</td>
                        <td className="py-2 px-3 text-right text-foreground">{t.positionSize || '—'}</td>
                        <td className={`py-2 px-3 text-right font-bold ${pnl !== null ? (pnl >= 0 ? 'text-bullish' : 'text-bearish') : 'text-muted-foreground'}`}>
                          {pnl !== null ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-foreground">{t.riskReward || '—'}</td>
                        <td className="py-2 px-3 text-muted-foreground">{t.setupType || '—'}</td>
                        <td className="py-2 px-3 text-muted-foreground">{t.timeframe || '—'}</td>
                      </tr>
                    );
                  })}
                  {filteredTrades.length === 0 && (
                    <tr>
                      <td colSpan={13} className="py-8 text-center text-muted-foreground">
                        {trades.isLoading ? 'Loading trades...' : 'No trades found. Paper trades will appear here automatically.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Trade Detail Panel */}
            {selectedTrade && (
              <div className="w-[35%] bg-card border border-border p-4 space-y-4 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold font-mono text-foreground">Trade Details</h3>
                  <button onClick={() => setSelectedTrade(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <DetailRow label="Symbol" value={selectedTrade.symbol} />
                  <DetailRow label="Direction" value={selectedTrade.direction === 'long' ? 'BUY' : 'SELL'} valueColor={selectedTrade.direction === 'long' ? 'text-bullish' : 'text-bearish'} />
                  <DetailRow label="Status" value={selectedTrade.status?.toUpperCase()} />
                  <DetailRow label="Entry Price" value={selectedTrade.entryPrice} />
                  <DetailRow label="Exit Price" value={selectedTrade.exitPrice || '—'} />
                  <DetailRow label="Stop Loss" value={selectedTrade.stopLoss || '—'} />
                  <DetailRow label="Take Profit" value={selectedTrade.takeProfit || '—'} />
                  <DetailRow label="Position Size" value={selectedTrade.positionSize || '—'} />
                  {selectedTrade.pnlAmount && (
                    <DetailRow
                      label="P&L"
                      value={`${parseFloat(selectedTrade.pnlAmount) >= 0 ? '+' : ''}$${parseFloat(selectedTrade.pnlAmount).toFixed(2)}`}
                      valueColor={parseFloat(selectedTrade.pnlAmount) >= 0 ? 'text-bullish' : 'text-bearish'}
                    />
                  )}
                  <DetailRow label="Risk:Reward" value={selectedTrade.riskReward || '—'} />
                  <DetailRow label="Setup Type" value={selectedTrade.setupType || '—'} />
                  <DetailRow label="Timeframe" value={selectedTrade.timeframe || '—'} />
                  <DetailRow label="Entry Time" value={selectedTrade.entryTime ? new Date(selectedTrade.entryTime).toLocaleString() : '—'} />
                  <DetailRow label="Exit Time" value={selectedTrade.exitTime ? new Date(selectedTrade.exitTime).toLocaleString() : '—'} />
                  {selectedTrade.entryTime && selectedTrade.exitTime && (
                    <DetailRow label="Duration" value={formatTradeDuration(selectedTrade.entryTime, selectedTrade.exitTime)} />
                  )}
                </div>
                {selectedTrade.notes && (
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Notes</div>
                    <div className="text-xs font-mono text-foreground bg-muted/30 p-2 border border-border whitespace-pre-wrap">
                      {selectedTrade.notes}
                    </div>
                  </div>
                )}
                {/* Trade Reasoning from Bot Engine */}
                <TradeReasoningPanel tradeId={selectedTrade.id} />
                {/* Post-Mortem Analysis */}
                <PostMortemPanel tradeId={selectedTrade.id} status={selectedTrade.status} />
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'performance' ? (
        /* Performance Tab */
        <div className="space-y-4">
          {/* Equity Curve */}
          <div className="bg-card border border-border p-4">
            <h2 className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider mb-3">
              Equity Curve
            </h2>
            {equityData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityData}>
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
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
                    <Area type="monotone" dataKey="cumulative" stroke="oklch(0.85 0.18 192)" fill="url(#eqGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-xs font-mono">
                No closed trades yet.
              </div>
            )}
          </div>

          {/* Daily P&L Bar Chart */}
          <div className="bg-card border border-border p-4">
            <h2 className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider mb-3">
              Daily P&L
            </h2>
            {dailyPnlData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyPnlData}>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: '#141926', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 0, fontSize: 11, fontFamily: 'monospace' }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
                    />
                    <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                      {dailyPnlData.map((entry, index) => (
                        <Cell key={index} fill={entry.pnl >= 0 ? 'oklch(0.75 0.18 155)' : 'oklch(0.65 0.2 25)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-xs font-mono">
                No daily data yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Calculator Tab */
        <div className="max-w-xl space-y-4">
          <PositionSizeCalculator />
          <PipValueCalculator />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-card border border-border p-3">
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color || 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/30">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${valueColor || 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function formatTradeDuration(entryTime: string, exitTime: string): string {
  const ms = new Date(exitTime).getTime() - new Date(entryTime).getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function PositionSizeCalculator() {
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
    <div className="bg-card border border-border p-4 space-y-3">
      <h2 className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <Calculator className="w-4 h-4" />
        Position Size Calculator
      </h2>
      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
        <CalcInput label="Account Size ($)" value={accountSize} onChange={setAccountSize} />
        <CalcInput label="Risk %" value={riskPercent} onChange={setRiskPercent} />
        <CalcInput label="Entry Price" value={entryPrice} onChange={setEntryPrice} step="0.00001" />
        <CalcInput label="Stop Loss" value={stopLoss} onChange={setStopLoss} step="0.00001" />
        <div className="col-span-2">
          <CalcInput label="Take Profit" value={takeProfit} onChange={setTakeProfit} step="0.00001" />
        </div>
      </div>
      <div className="pt-3 border-t border-border/50 space-y-2 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Risk Amount</span>
          <span className="text-warning font-bold">${riskAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Position Size (lots)</span>
          <span className="text-cyan font-bold">{positionSize > 0 ? positionSize.toFixed(4) : '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Risk:Reward</span>
          <span className={`font-bold ${riskReward >= 2 ? 'text-bullish' : riskReward >= 1 ? 'text-warning' : 'text-bearish'}`}>
            {riskReward > 0 ? `1:${riskReward.toFixed(2)}` : '—'}
          </span>
        </div>
        {riskReward > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Potential Profit</span>
            <span className="text-bullish font-bold">${(riskAmount * riskReward).toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PipValueCalculator() {
  const [lotSize, setLotSize] = useState('0.01');
  const [pipSize, setPipSize] = useState('0.0001');

  const standardLot = 100000;
  const lots = parseFloat(lotSize) || 0;
  const pip = parseFloat(pipSize) || 0.0001;
  const pipValue = lots * standardLot * pip;

  return (
    <div className="bg-card border border-border p-4 space-y-3">
      <h2 className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <Target className="w-4 h-4" />
        Pip Value Calculator
      </h2>
      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
        <CalcInput label="Lot Size" value={lotSize} onChange={setLotSize} step="0.01" />
        <CalcInput label="Pip Size" value={pipSize} onChange={setPipSize} step="0.0001" />
      </div>
      <div className="pt-3 border-t border-border/50 space-y-2 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pip Value</span>
          <span className="text-cyan font-bold">${pipValue.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">10 Pips</span>
          <span className="text-foreground font-bold">${(pipValue * 10).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">50 Pips</span>
          <span className="text-foreground font-bold">${(pipValue * 50).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">100 Pips</span>
          <span className="text-foreground font-bold">${(pipValue * 100).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function CalcInput({ label, value, onChange, step }: { label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div>
      <label className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        step={step || '1'}
        className="w-full bg-muted border border-border px-2 py-1.5 text-foreground font-mono text-xs mt-0.5"
      />
    </div>
  );
}

function TradeReasoningPanel({ tradeId }: { tradeId: string }) {
  const reasoning = trpc.engine.tradeReasoning.useQuery(
    { positionId: tradeId },
    { refetchInterval: false }
  );

  const match = reasoning.data;

  if (!match) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Brain className="w-3 h-3 text-cyan" />
        Bot Reasoning
      </div>
      <div className="text-xs font-mono bg-cyan/5 border border-cyan/20 p-2 space-y-1.5">
        {/* Confluence score */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Confluence</span>
          <span className={`font-bold ${match.confluenceScore >= 70 ? 'text-bullish' : match.confluenceScore >= 50 ? 'text-warning' : 'text-bearish'}`}>
            {match.confluenceScore}/100
          </span>
        </div>
        {/* Session & Timeframe */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Session</span>
          <span className="text-foreground font-bold">{match.session}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Timeframe</span>
          <span className="text-foreground">{match.timeframe}</span>
        </div>
        {/* Factors (concepts that triggered) */}
        {match.factors && match.factors.length > 0 && (
          <div>
            <span className="text-muted-foreground text-[10px]">Concepts:</span>
            <div className="space-y-1 mt-0.5">
              {match.factors.filter(f => f.present).map((f, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-bullish text-[10px]">✓</span>
                  <span className="text-[10px] text-cyan font-bold">{f.concept}</span>
                  <span className="text-[10px] text-muted-foreground flex-1 truncate">{f.detail}</span>
                  <span className="text-[10px] text-foreground">+{f.weight}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Summary */}
        {match.summary && (
          <div className="text-[10px] text-foreground/80 whitespace-pre-wrap mt-1 border-t border-border/30 pt-1">
            {match.summary}
          </div>
        )}
      </div>
    </div>
  );
}

function PostMortemPanel({ tradeId, status }: { tradeId: string; status: string }) {
  const postMortems = trpc.engine.postMortems.useQuery(undefined, {
    refetchInterval: false,
  });

  const match = useMemo(() => {
    if (!postMortems.data) return null;
    return postMortems.data.find((pm: any) => pm.positionId === tradeId);
  }, [postMortems.data, tradeId]);

  if (!match || status !== 'closed') return null;

  const isWin = match.outcome === 'win';

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        {isWin ? <CheckCircle className="w-3 h-3 text-bullish" /> : <XCircle className="w-3 h-3 text-bearish" />}
        Post-Mortem Analysis
      </div>
      <div className={`text-xs font-mono p-2 space-y-1.5 border ${
        isWin ? 'bg-bullish/5 border-bullish/20' : 'bg-bearish/5 border-bearish/20'
      }`}>
        {/* Outcome */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Outcome</span>
          <span className={`font-bold ${isWin ? 'text-bullish' : 'text-bearish'}`}>
            {match.outcome?.toUpperCase()}
          </span>
        </div>
        {/* Exit reason */}
        {match.exitReason && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Exit Reason</span>
            <span className="text-foreground font-bold">{match.exitReason}</span>
          </div>
        )}
        {/* Hold duration */}
        {match.holdDuration && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span className="text-foreground">{match.holdDuration}</span>
          </div>
        )}
        {/* P&L */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">P&L</span>
          <span className={`font-bold ${match.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
            {match.pnl >= 0 ? '+' : ''}${match.pnl.toFixed(2)}
          </span>
        </div>
        {/* What worked */}
        {match.whatWorked && match.whatWorked.length > 0 && (
          <div className="mt-1">
            <span className="text-[10px] text-bullish font-bold">What worked:</span>
            <ul className="text-[10px] text-foreground/80 mt-0.5 list-disc list-inside">
              {match.whatWorked.map((item: string, i: number) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
        {/* What failed */}
        {match.whatFailed && match.whatFailed.length > 0 && (
          <div className="mt-1">
            <span className="text-[10px] text-bearish font-bold">What failed:</span>
            <ul className="text-[10px] text-foreground/80 mt-0.5 list-disc list-inside">
              {match.whatFailed.map((item: string, i: number) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
        {/* Lesson learned */}
        {match.lessonLearned && (
          <div className="mt-1">
            <span className="text-[10px] text-cyan font-bold">Lesson:</span>
            <div className="text-[10px] text-foreground/80 mt-0.5">{match.lessonLearned}</div>
          </div>
        )}
      </div>
    </div>
  );
}
