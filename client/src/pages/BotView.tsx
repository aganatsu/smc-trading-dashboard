/**
 * BotView — Paper trading command center
 * Controls, account stats, trade chart, positions table, terminal log
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { INSTRUMENTS, type Instrument, type Timeframe } from '@/lib/marketData';
import {
  Play, Pause, Square, RotateCcw, TrendingUp, TrendingDown,
  DollarSign, Activity, AlertCircle, ChevronDown
} from 'lucide-react';
import TradeChart from '@/components/TradeChart';

interface PaperPosition {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openTime: string;
}

interface PaperStatus {
  balance: number;
  equity: number;
  unrealizedPnl: number;
  positions: PaperPosition[];
  tradeHistory: PaperTradeHistory[];
  isRunning: boolean;
  totalTrades: number;
  winRate: number;
}

interface PaperTradeHistory {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  closedAt: string;
}

interface LogEntry {
  time: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

// Helper to format duration
function formatDuration(openTime: string): string {
  const ms = Date.now() - new Date(openTime).getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export default function BotView() {
  const [status, setStatus] = useState<PaperStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: new Date().toISOString(), level: 'info', message: 'Paper trading engine ready. Press START to begin.' },
  ]);
  const [selectedSymbol, setSelectedSymbol] = useState('EUR/USD');

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
  const [orderDirection, setOrderDirection] = useState<'long' | 'short'>('long');
  const [orderSize, setOrderSize] = useState('0.01');
  const [orderSL, setOrderSL] = useState('');
  const [orderTP, setOrderTP] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev.slice(-200), { time: new Date().toISOString(), level, message }]);
  }, []);

  // Fetch paper status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/trpc/paper.status?input=' + encodeURIComponent(JSON.stringify({ json: {} })));
      const data = await res.json();
      if (data?.result?.data?.json) {
        setStatus(data.result.data.json);
        setIsRunning(data.result.data.json.isRunning);
      }
    } catch {
      // Paper trading not available yet
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Auto-scroll terminal
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleStart = async () => {
    try {
      const res = await fetch('/api/trpc/paper.start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: {} }),
      });
      const data = await res.json();
      if (data?.result?.data?.json?.success) {
        setIsRunning(true);
        addLog('success', 'Paper trading engine STARTED');
      }
    } catch (e: any) {
      addLog('error', `Failed to start: ${e.message}`);
    }
  };

  const handlePause = async () => {
    try {
      const res = await fetch('/api/trpc/paper.pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: {} }),
      });
      const data = await res.json();
      if (data?.result?.data?.json?.success) {
        setIsRunning(false);
        addLog('warning', 'Paper trading engine PAUSED');
      }
    } catch (e: any) {
      addLog('error', `Failed to pause: ${e.message}`);
    }
  };

  const handleStop = async () => {
    try {
      const res = await fetch('/api/trpc/paper.stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: {} }),
      });
      const data = await res.json();
      if (data?.result?.data?.json?.success) {
        setIsRunning(false);
        addLog('info', 'Paper trading engine STOPPED');
      }
    } catch (e: any) {
      addLog('error', `Failed to stop: ${e.message}`);
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch('/api/trpc/paper.reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: {} }),
      });
      const data = await res.json();
      if (data?.result?.data?.json?.success) {
        setIsRunning(false);
        addLog('info', 'Paper account RESET to $10,000');
        await fetchStatus();
      }
    } catch (e: any) {
      addLog('error', `Failed to reset: ${e.message}`);
    }
  };

  const handlePlaceOrder = async () => {
    try {
      const res = await fetch('/api/trpc/paper.placeOrder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            symbol: selectedSymbol,
            direction: orderDirection,
            size: parseFloat(orderSize),
            stopLoss: orderSL ? parseFloat(orderSL) : undefined,
            takeProfit: orderTP ? parseFloat(orderTP) : undefined,
          },
        }),
      });
      const data = await res.json();
      if (data?.result?.data?.json?.success) {
        addLog('success', `${orderDirection.toUpperCase()} ${orderSize} ${selectedSymbol} @ ${data.result.data.json.entryPrice?.toFixed(5) || 'market'}`);
        await fetchStatus();
      } else {
        addLog('error', `Order rejected: ${data?.error?.message || 'Unknown error'}`);
      }
    } catch (e: any) {
      addLog('error', `Order failed: ${e.message}`);
    }
  };

  const handleClosePosition = async (positionId: string) => {
    try {
      const res = await fetch('/api/trpc/paper.closePosition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { positionId } }),
      });
      const data = await res.json();
      if (data?.result?.data?.json?.success) {
        const pnl = data.result.data.json.pnl;
        addLog(pnl >= 0 ? 'success' : 'warning', `Position closed. P&L: ${pnl >= 0 ? '+' : ''}$${pnl?.toFixed(2)}`);
        await fetchStatus();
      }
    } catch (e: any) {
      addLog('error', `Close failed: ${e.message}`);
    }
  };

  const balance = status?.balance ?? 10000;
  const equity = status?.equity ?? 10000;
  const unrealizedPnl = status?.unrealizedPnl ?? 0;
  const positions = status?.positions ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar: Controls + Account Stats */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card flex-shrink-0">
        {/* Status Badge */}
        <div className={`px-2 py-0.5 text-[10px] font-mono font-bold ${isRunning ? 'bg-bullish/20 text-bullish' : 'bg-muted text-muted-foreground'}`}>
          {isRunning ? 'RUNNING' : 'STOPPED'}
        </div>
        <div className="px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan/20 text-cyan">
          PAPER
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleStart}
            disabled={isRunning}
            className="p-1.5 text-bullish hover:bg-bullish/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Start"
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={handlePause}
            disabled={!isRunning}
            className="p-1.5 text-warning hover:bg-warning/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Pause"
          >
            <Pause className="w-4 h-4" />
          </button>
          <button
            onClick={handleStop}
            disabled={!isRunning}
            className="p-1.5 text-bearish hover:bg-bearish/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Reset Account"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Account Stats */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-muted-foreground mr-1">BAL</span>
            <span className="text-foreground font-bold">${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div>
            <span className="text-muted-foreground mr-1">EQ</span>
            <span className="text-foreground font-bold">${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div>
            <span className="text-muted-foreground mr-1">P&L</span>
            <span className={`font-bold ${unrealizedPnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content: Order Form + Positions + Terminal */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Order Form + Positions */}
        <div className="w-[300px] flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
          {/* Order Form */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider">Place Order</div>
            
            <select
              value={selectedSymbol}
              onChange={e => setSelectedSymbol(e.target.value)}
              className="w-full bg-muted border border-border px-2 py-1.5 text-xs font-mono text-foreground"
            >
              {INSTRUMENTS.map(inst => (
                <option key={inst.symbol} value={inst.symbol}>{inst.symbol}</option>
              ))}
            </select>

            <div className="flex gap-1">
              <button
                onClick={() => setOrderDirection('long')}
                className={`flex-1 py-1.5 text-xs font-mono font-bold transition-colors ${
                  orderDirection === 'long'
                    ? 'bg-bullish text-background'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => setOrderDirection('short')}
                className={`flex-1 py-1.5 text-xs font-mono font-bold transition-colors ${
                  orderDirection === 'short'
                    ? 'bg-bearish text-background'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                SELL
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1">
              <div>
                <label className="text-[10px] text-muted-foreground font-mono">Size</label>
                <input
                  type="number"
                  value={orderSize}
                  onChange={e => setOrderSize(e.target.value)}
                  className="w-full bg-muted border border-border px-2 py-1 text-xs font-mono text-foreground"
                  step="0.01"
                  min="0.01"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-mono">SL</label>
                <input
                  type="number"
                  value={orderSL}
                  onChange={e => setOrderSL(e.target.value)}
                  className="w-full bg-muted border border-border px-2 py-1 text-xs font-mono text-foreground"
                  step="0.00001"
                  placeholder="—"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-mono">TP</label>
                <input
                  type="number"
                  value={orderTP}
                  onChange={e => setOrderTP(e.target.value)}
                  className="w-full bg-muted border border-border px-2 py-1 text-xs font-mono text-foreground"
                  step="0.00001"
                  placeholder="—"
                />
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              className={`w-full py-2 text-xs font-mono font-bold transition-colors ${
                orderDirection === 'long'
                  ? 'bg-bullish hover:bg-bullish/80 text-background'
                  : 'bg-bearish hover:bg-bearish/80 text-background'
              }`}
            >
              {orderDirection === 'long' ? 'BUY' : 'SELL'} {selectedSymbol}
            </button>
          </div>

          {/* Positions */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider mb-2">
              Positions ({positions.length})
            </div>
            {positions.length > 0 ? (
              <div className="space-y-2">
                {positions.map(p => (
                  <div key={p.id} className="bg-muted/30 border border-border p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-foreground">{p.symbol}</span>
                      <span className={`text-[10px] font-mono font-bold px-1 ${p.direction === 'long' ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'}`}>
                        {p.direction === 'long' ? 'BUY' : 'SELL'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground">Entry: {p.entryPrice.toFixed(5)}</span>
                      <span className="text-muted-foreground">Size: {p.size}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground">Current: {p.currentPrice.toFixed(5)}</span>
                      <span className={`font-bold ${p.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                        {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground">Duration: {formatDuration(p.openTime)}</span>
                    </div>
                    {(p.stopLoss || p.takeProfit) && (
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                        {p.stopLoss && <span>SL: {p.stopLoss.toFixed(5)}</span>}
                        {p.takeProfit && <span>TP: {p.takeProfit.toFixed(5)}</span>}
                      </div>
                    )}
                    <button
                      onClick={() => handleClosePosition(p.id)}
                      className="w-full py-1 text-[10px] font-mono font-bold bg-muted hover:bg-destructive/20 hover:text-bearish text-muted-foreground transition-colors"
                    >
                      CLOSE
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] font-mono text-muted-foreground text-center py-4">
                No open positions
              </div>
            )}
          </div>
        </div>

        {/* Right: Trade Chart + Terminal Log */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Trade Chart */}
          <div className="flex-1 min-h-[200px]">
            <TradeChart
              symbol={selectedSymbol}
              positions={positions}
              tradeHistory={status?.tradeHistory ?? []}
            />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card">
            <span className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider">Terminal</span>
            <button
              onClick={() => setLogs([])}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-[#0A0A0F] p-2 font-mono text-[11px]">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2 py-0.5">
                <span className="text-muted-foreground flex-shrink-0">
                  {new Date(log.time).toLocaleTimeString()}
                </span>
                <span className={
                  log.level === 'success' ? 'text-bullish' :
                  log.level === 'warning' ? 'text-warning' :
                  log.level === 'error' ? 'text-bearish' :
                  'text-foreground'
                }>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
