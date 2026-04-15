import { useState, useMemo, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import BotConfigPanel from '@/components/BotConfigPanel';

// ─── Helpers ────────────────────────────────────────────────────────

function formatDuration(openTime: string): string {
  const ms = Date.now() - new Date(openTime).getTime();
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatMoney(val: number, showSign = false): string {
  const abs = Math.abs(val);
  const str = abs >= 1000
    ? `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${abs.toFixed(2)}`;
  if (showSign) return val >= 0 ? `+${str}` : `-${str}`;
  return str;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

const SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'GBP/JPY', 'AUD/USD',
  'USD/CAD', 'EUR/GBP', 'NZD/USD', 'XAU/USD', 'XAG/USD',
  'BTC/USD', 'ETH/USD',
];

// ─── Component ──────────────────────────────────────────────────────

export default function BotView() {
  const { user, isAuthenticated } = useAuth();
  const status = trpc.paper.status.useQuery(undefined, { refetchInterval: 15000, staleTime: 10000 });
  const startMut = trpc.paper.start.useMutation({ onSuccess: () => status.refetch() });
  const pauseMut = trpc.paper.pause.useMutation({ onSuccess: () => status.refetch() });
  const stopMut = trpc.paper.stop.useMutation({ onSuccess: () => status.refetch() });
  const resetMut = trpc.paper.reset.useMutation({ onSuccess: () => status.refetch() });
  const placeMut = trpc.paper.placeOrder.useMutation({ onSuccess: () => status.refetch() });
  const closeMut = trpc.paper.closePosition.useMutation({ onSuccess: () => status.refetch() });
  const cancelPendingMut = trpc.paper.cancelPendingOrder.useMutation({ onSuccess: () => status.refetch() });

  // Autonomous engine state + controls
  const engineState = trpc.engine.state.useQuery(undefined, { refetchInterval: 15000, staleTime: 10000 });
  const scanResults = trpc.engine.scanResults.useQuery(undefined, { refetchInterval: 30000, staleTime: 15000 });
  const engineStartMut = trpc.engine.start.useMutation({ onSuccess: () => { engineState.refetch(); status.refetch(); } });
  const engineStopMut = trpc.engine.stop.useMutation({ onSuccess: () => { engineState.refetch(); status.refetch(); } });
  const engineAutoTradeMut = trpc.engine.setAutoTrading.useMutation({ onSuccess: () => engineState.refetch() });
  const engineManualScanMut = trpc.engine.manualScan.useMutation({ onSuccess: () => { engineState.refetch(); scanResults.refetch(); } });
  const [engineInterval, setEngineInterval] = useState(60);

  // Order form state
  const [symbol, setSymbol] = useState('EUR/USD');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [size, setSize] = useState('0.10');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [signalReason, setSignalReason] = useState('');
  const [signalScore, setSignalScore] = useState('7');
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [orderType, setOrderType] = useState<'market' | 'buy_limit' | 'sell_limit' | 'buy_stop' | 'sell_stop'>('market');
  const [triggerPrice, setTriggerPrice] = useState('');
  const placePendingMut = trpc.paper.placePendingOrder.useMutation({ onSuccess: () => status.refetch() });

  // Position tabs
  const [posTab, setPosTab] = useState<'open' | 'pending' | 'closedToday' | 'history'>('open');

  // Execution mode & safety
  const killSwitchMut = trpc.paper.killSwitch.useMutation({ onSuccess: () => status.refetch() });
  const executionModeMut = trpc.paper.executionMode.useMutation({ onSuccess: () => status.refetch() });
  const emergencyCloseMut = trpc.paper.emergencyCloseAll.useMutation({ onSuccess: () => status.refetch() });
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);

  // Listen for symbol sync from sidebar
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.symbol) setSymbol(detail.symbol);
    };
    window.addEventListener('symbolChange', handler);
    return () => window.removeEventListener('symbolChange', handler);
  }, []);

  const d = status.data;

  // Filter trade history for "closed today"
  const closedToday = useMemo(() => {
    if (!d) return [];
    const today = new Date().toISOString().split('T')[0];
    return d.tradeHistory.filter(t => t.closedAt.startsWith(today));
  }, [d]);

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <a href={getLoginUrl()} className="px-6 py-3 bg-emerald-500 text-white font-bold uppercase tracking-wider hover:bg-emerald-400 transition">
          Login to Trade
        </a>
      </div>
    );
  }

  if (!d) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground font-mono text-sm">Loading engine status...</div>
      </div>
    );
  }

  const handlePlace = () => {
    if (orderType === 'market') {
      placeMut.mutate({
        symbol,
        direction,
        size: parseFloat(size) || 0.01,
        stopLoss: sl ? parseFloat(sl) : undefined,
        takeProfit: tp ? parseFloat(tp) : undefined,
        signalReason: signalReason || undefined,
        signalScore: signalScore ? parseFloat(signalScore) : undefined,
      });
    } else {
      placePendingMut.mutate({
        symbol,
        direction,
        size: parseFloat(size) || 0.01,
        triggerPrice: parseFloat(triggerPrice) || 0,
        orderType,
        stopLoss: sl ? parseFloat(sl) : undefined,
        takeProfit: tp ? parseFloat(tp) : undefined,
        signalReason: signalReason || undefined,
        signalScore: signalScore ? parseFloat(signalScore) : undefined,
      });
    }
    setShowOrderForm(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0 gap-2 flex-wrap">
        {/* Left: Controls */}
        <div className="flex items-center gap-2">
          {d.isRunning ? (
            <>
              <button onClick={() => stopMut.mutate()} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded transition">
                Stop
              </button>
              <button onClick={() => pauseMut.mutate()} className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs uppercase tracking-wider rounded transition">
                Pause
              </button>
            </>
          ) : d.isPaused ? (
            <>
              <button onClick={() => startMut.mutate()} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs uppercase tracking-wider rounded transition">
                Resume
              </button>
              <button onClick={() => stopMut.mutate()} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded transition">
                Stop
              </button>
            </>
          ) : (
            <>
              <button onClick={() => startMut.mutate()} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs uppercase tracking-wider rounded transition">
                ▶ Start
              </button>
              <button onClick={() => resetMut.mutate()} className="px-5 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-bold text-xs uppercase tracking-wider rounded transition">
                ↻ Reset
              </button>
            </>
          )}
          <button onClick={() => setShowOrderForm(!showOrderForm)} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider rounded transition">
            + Order
          </button>
          <button onClick={() => setShowConfig(true)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-bold text-xs uppercase tracking-wider rounded transition">
            ⚙ Config
          </button>
        </div>

        {/* Center: Status */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              d.isRunning ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
              d.isPaused ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' :
              'bg-zinc-700/50 text-zinc-400 border border-zinc-600'
            }`}>
              <span className={`w-2 h-2 rounded-full ${d.isRunning ? 'bg-emerald-400 animate-pulse' : d.isPaused ? 'bg-orange-400' : 'bg-zinc-500'}`} />
              {d.isRunning ? 'Running' : d.isPaused ? 'Paused' : 'Stopped'}
            </span>
            {/* Execution Mode Badge — clickable to toggle */}
            <button
              onClick={() => {
                if (d.executionMode === 'paper') {
                  setShowLiveConfirm(true);
                } else {
                  executionModeMut.mutate({ mode: 'paper' });
                }
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border cursor-pointer transition ${
                d.executionMode === 'live'
                  ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
            >
              {d.executionMode === 'live' ? '● LIVE' : 'Paper Mode'}
            </button>
            {/* Kill Switch */}
            <button
              onClick={() => killSwitchMut.mutate({ active: !d.killSwitchActive })}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border transition ${
                d.killSwitchActive
                  ? 'bg-red-600/30 text-red-300 border-red-500/50 animate-pulse'
                  : 'bg-zinc-700/30 text-zinc-500 border-zinc-600/30 hover:bg-zinc-700/50 hover:text-zinc-400'
              }`}
              title={d.killSwitchActive ? 'Kill switch is ACTIVE — click to deactivate' : 'Click to activate kill switch (halt all trading)'}
            >
              {d.killSwitchActive ? '⚠ KILL SWITCH ON' : '⊘ Kill Switch'}
            </button>
          </div>
          {d.uptime > 0 && (
            <span className="text-[10px] text-muted-foreground mt-0.5 font-mono">Uptime: {formatUptime(d.uptime)}</span>
          )}
        </div>

        {/* Right: Stat Counters */}
        <div className="flex items-center gap-2">
          {[
            { label: 'Scans', value: d.scanCount, color: 'text-cyan-400' },
            { label: 'Signals', value: d.signalCount, color: 'text-cyan-400' },
            { label: 'Trades', value: d.tradeCount, color: 'text-cyan-400' },
            { label: 'Win Rate', value: `${d.winRate}%`, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="px-3 py-1.5 border border-border rounded bg-card/50 text-center min-w-[72px]">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
              <div className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ ORDER FORM (collapsible) ═══ */}
      {showOrderForm && (
        <div className="px-4 py-3 border-b border-border bg-card/30 flex-shrink-0">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Order Type</label>
              <select value={orderType} onChange={e => setOrderType(e.target.value as typeof orderType)} className="bg-background border border-border rounded px-2 py-1.5 text-sm font-mono w-28">
                <option value="market">Market</option>
                <option value="buy_limit">Buy Limit</option>
                <option value="sell_limit">Sell Limit</option>
                <option value="buy_stop">Buy Stop</option>
                <option value="sell_stop">Sell Stop</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Symbol</label>
              <select value={symbol} onChange={e => setSymbol(e.target.value)} className="bg-background border border-border rounded px-2 py-1.5 text-sm font-mono w-28">
                {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Direction</label>
              <div className="flex">
                <button onClick={() => setDirection('long')} className={`px-3 py-1.5 text-xs font-bold uppercase rounded-l border ${direction === 'long' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-background border-border text-muted-foreground'}`}>Buy</button>
                <button onClick={() => setDirection('short')} className={`px-3 py-1.5 text-xs font-bold uppercase rounded-r border-t border-b border-r ${direction === 'short' ? 'bg-red-500 text-white border-red-500' : 'bg-background border-border text-muted-foreground'}`}>Sell</button>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Size (lots)</label>
              <input value={size} onChange={e => setSize(e.target.value)} className="bg-background border border-border rounded px-2 py-1.5 text-sm font-mono w-20" />
            </div>
            {orderType !== 'market' && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Trigger Price</label>
                <input value={triggerPrice} onChange={e => setTriggerPrice(e.target.value)} placeholder="Price" className="bg-background border border-border rounded px-2 py-1.5 text-sm font-mono w-24" />
              </div>
            )}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">SL</label>
              <input value={sl} onChange={e => setSl(e.target.value)} placeholder="—" className="bg-background border border-border rounded px-2 py-1.5 text-sm font-mono w-24" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">TP</label>
              <input value={tp} onChange={e => setTp(e.target.value)} placeholder="—" className="bg-background border border-border rounded px-2 py-1.5 text-sm font-mono w-24" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Reason</label>
              <input value={signalReason} onChange={e => setSignalReason(e.target.value)} placeholder="e.g. RSI Oversold, BOS" className="bg-background border border-border rounded px-2 py-1.5 text-sm w-44" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Score</label>
              <input value={signalScore} onChange={e => setSignalScore(e.target.value)} placeholder="0-10" className="bg-background border border-border rounded px-2 py-1.5 text-sm font-mono w-14" />
            </div>
            <button onClick={handlePlace} disabled={placeMut.isPending || placePendingMut.isPending} className={`px-5 py-1.5 font-bold text-xs uppercase tracking-wider rounded transition ${direction === 'long' ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'bg-red-500 hover:bg-red-400 text-white'}`}>
              {(placeMut.isPending || placePendingMut.isPending) ? '...' : orderType === 'market' ? `${direction === 'long' ? 'BUY' : 'SELL'} ${symbol}` : `${orderType.replace('_', ' ').toUpperCase()} ${symbol}`}
            </button>
          </div>
          {placeMut.error && <p className="text-red-400 text-xs mt-1 font-mono">{placeMut.error.message}</p>}
          {placePendingMut.error && <p className="text-red-400 text-xs mt-1 font-mono">{placePendingMut.error.message}</p>}
        </div>
      )}

      {/* ═══ MAIN CONTENT — Two Columns ═══ */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT: Positions & History (~65%) */}
        <div className="flex-[2] flex flex-col border-r border-border overflow-hidden min-w-0">
          <div className="px-4 pt-3 pb-0 flex-shrink-0">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-2">Positions & History</h2>
            <div className="flex gap-1 border-b border-border">
              {[
                { key: 'open' as const, label: `Open Positions (${d.positions.length})` },
                { key: 'pending' as const, label: `Pending (${d.pendingOrders?.length ?? 0})` },
                { key: 'closedToday' as const, label: `Closed Today (${closedToday.length})` },
                { key: 'history' as const, label: 'All History' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setPosTab(tab.key)}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    posTab === tab.key
                      ? 'text-cyan-400 border-b-2 border-cyan-400'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto px-4 py-2 min-h-0">
            {posTab === 'open' && (
              d.positions.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm font-mono">
                  No open positions. Click "+ Order" to place a trade.
                </div>
              ) : (
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-muted-foreground uppercase tracking-wider border-b border-border">
                      <th className="text-left py-2 pr-2">Symbol</th>
                      <th className="text-left py-2 pr-2">Direction</th>
                      <th className="text-right py-2 pr-2">Entry</th>
                      <th className="text-right py-2 pr-2">Current</th>
                      <th className="text-right py-2 pr-2">P&L</th>
                      <th className="text-right py-2 pr-2">Size</th>
                      <th className="text-right py-2 pr-2">SL</th>
                      <th className="text-right py-2 pr-2">TP</th>
                      <th className="text-right py-2 pr-2">Duration</th>
                      <th className="text-left py-2 pr-2">Signal</th>
                      <th className="text-center py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.positions.map(pos => (
                      <tr key={pos.id} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                        <td className="py-2 pr-2 font-bold text-foreground">{pos.symbol.replace('/', '')}</td>
                        <td className="py-2 pr-2">
                          <span className={pos.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}>
                            {pos.direction === 'long' ? 'Long ↑' : 'Short ↓'}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-right text-foreground">{pos.entryPrice.toFixed(pos.symbol.includes('JPY') ? 3 : 5)}</td>
                        <td className="py-2 pr-2 text-right text-foreground">{pos.currentPrice.toFixed(pos.symbol.includes('JPY') ? 3 : 5)}</td>
                        <td className={`py-2 pr-2 text-right font-bold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatMoney(pos.pnl, true)}
                        </td>
                        <td className="py-2 pr-2 text-right text-foreground">{pos.size.toFixed(2)}</td>
                        <td className="py-2 pr-2 text-right text-muted-foreground">{pos.stopLoss?.toFixed(pos.symbol.includes('JPY') ? 3 : 5) ?? '—'}</td>
                        <td className="py-2 pr-2 text-right text-muted-foreground">{pos.takeProfit?.toFixed(pos.symbol.includes('JPY') ? 3 : 5) ?? '—'}</td>
                        <td className="py-2 pr-2 text-right text-muted-foreground">{formatDuration(pos.openTime)}</td>
                        <td className="py-2 pr-2 text-yellow-400/80 truncate max-w-[140px]" title={pos.signalReason}>
                          {pos.signalReason || '—'}
                          {pos.signalScore > 0 && <span className="text-muted-foreground ml-1">({pos.signalScore}/10)</span>}
                        </td>
                        <td className="py-2 text-center">
                          <button
                            onClick={() => closeMut.mutate({ positionId: pos.id })}
                            disabled={closeMut.isPending}
                            className="w-6 h-6 flex items-center justify-center rounded bg-red-500/20 text-red-400 hover:bg-red-500/40 transition text-xs"
                            title="Close position"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {posTab === 'pending' && (
              !d.pendingOrders?.length ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm font-mono">No pending orders.</div>
              ) : (
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-muted-foreground uppercase tracking-wider border-b border-border">
                      <th className="text-left py-2 pr-2">Symbol</th>
                      <th className="text-left py-2 pr-2">Type</th>
                      <th className="text-right py-2 pr-2">Trigger</th>
                      <th className="text-right py-2 pr-2">Size</th>
                      <th className="text-right py-2 pr-2">SL</th>
                      <th className="text-right py-2 pr-2">TP</th>
                      <th className="text-left py-2 pr-2">Signal</th>
                      <th className="text-left py-2 pr-2">Created</th>
                      <th className="text-center py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.pendingOrders.map(order => (
                      <tr key={order.id} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                        <td className="py-2 pr-2 font-bold text-foreground">{order.symbol.replace('/', '')}</td>
                        <td className="py-2 pr-2">
                          <span className={order.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}>
                            {order.orderType.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-right text-foreground">{order.triggerPrice.toFixed(order.symbol.includes('JPY') ? 3 : 5)}</td>
                        <td className="py-2 pr-2 text-right text-foreground">{order.size.toFixed(2)}</td>
                        <td className="py-2 pr-2 text-right text-muted-foreground">{order.stopLoss?.toFixed(order.symbol.includes('JPY') ? 3 : 5) ?? '—'}</td>
                        <td className="py-2 pr-2 text-right text-muted-foreground">{order.takeProfit?.toFixed(order.symbol.includes('JPY') ? 3 : 5) ?? '—'}</td>
                        <td className="py-2 pr-2 text-yellow-400/80 truncate max-w-[140px]" title={order.signalReason}>{order.signalReason}</td>
                        <td className="py-2 pr-2 text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</td>
                        <td className="py-2 text-center">
                          <button
                            onClick={() => cancelPendingMut.mutate({ orderId: order.id })}
                            disabled={cancelPendingMut.isPending}
                            className="w-6 h-6 flex items-center justify-center rounded bg-red-500/20 text-red-400 hover:bg-red-500/40 transition text-xs"
                            title="Cancel pending order"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {posTab === 'closedToday' && (
              closedToday.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm font-mono">No trades closed today.</div>
              ) : (
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-muted-foreground uppercase tracking-wider border-b border-border">
                      <th className="text-left py-2 pr-2">Symbol</th>
                      <th className="text-left py-2 pr-2">Direction</th>
                      <th className="text-right py-2 pr-2">Entry</th>
                      <th className="text-right py-2 pr-2">Exit</th>
                      <th className="text-right py-2 pr-2">P&L</th>
                      <th className="text-right py-2 pr-2">Size</th>
                      <th className="text-left py-2 pr-2">Close Reason</th>
                      <th className="text-left py-2">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedToday.map(t => (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                        <td className="py-2 pr-2 font-bold text-foreground">{t.symbol.replace('/', '')}</td>
                        <td className="py-2 pr-2">
                          <span className={t.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}>
                            {t.direction === 'long' ? 'Long ↑' : 'Short ↓'}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-right text-foreground">{t.entryPrice.toFixed(t.symbol.includes('JPY') ? 3 : 5)}</td>
                        <td className="py-2 pr-2 text-right text-foreground">{t.exitPrice.toFixed(t.symbol.includes('JPY') ? 3 : 5)}</td>
                        <td className={`py-2 pr-2 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatMoney(t.pnl, true)}
                        </td>
                        <td className="py-2 pr-2 text-right text-foreground">{t.size.toFixed(2)}</td>
                        <td className="py-2 pr-2 text-muted-foreground capitalize">{t.closeReason.replace('_', ' ')}</td>
                        <td className="py-2 text-yellow-400/80 truncate max-w-[160px]">{t.signalReason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {posTab === 'history' && (
              d.tradeHistory.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm font-mono">No trade history yet.</div>
              ) : (
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-muted-foreground uppercase tracking-wider border-b border-border">
                      <th className="text-left py-2 pr-2">Symbol</th>
                      <th className="text-left py-2 pr-2">Dir</th>
                      <th className="text-right py-2 pr-2">Entry</th>
                      <th className="text-right py-2 pr-2">Exit</th>
                      <th className="text-right py-2 pr-2">P&L</th>
                      <th className="text-right py-2 pr-2">Pips</th>
                      <th className="text-right py-2 pr-2">Size</th>
                      <th className="text-left py-2 pr-2">Close</th>
                      <th className="text-left py-2 pr-2">Signal</th>
                      <th className="text-left py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...d.tradeHistory].reverse().map(t => (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                        <td className="py-2 pr-2 font-bold text-foreground">{t.symbol.replace('/', '')}</td>
                        <td className="py-2 pr-2">
                          <span className={t.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}>
                            {t.direction === 'long' ? 'L' : 'S'}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-right">{t.entryPrice.toFixed(t.symbol.includes('JPY') ? 3 : 5)}</td>
                        <td className="py-2 pr-2 text-right">{t.exitPrice.toFixed(t.symbol.includes('JPY') ? 3 : 5)}</td>
                        <td className={`py-2 pr-2 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatMoney(t.pnl, true)}
                        </td>
                        <td className={`py-2 pr-2 text-right ${t.pnlPips >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.pnlPips >= 0 ? '+' : ''}{t.pnlPips.toFixed(1)}
                        </td>
                        <td className="py-2 pr-2 text-right">{t.size.toFixed(2)}</td>
                        <td className="py-2 pr-2 text-muted-foreground capitalize">{t.closeReason.replace('_', ' ')}</td>
                        <td className="py-2 pr-2 text-yellow-400/80 truncate max-w-[120px]" title={t.signalReason}>{t.signalReason}</td>
                        <td className="py-2 text-muted-foreground">{new Date(t.closedAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>

        {/* RIGHT: Account Summary + Strategy Performance (~35%) */}
        <div className="flex-[1] flex flex-col overflow-auto min-w-[280px]">
          {/* Account Summary */}
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">Account Summary</h3>
            <div className="space-y-2">
              {[
                { label: 'Balance', value: formatMoney(d.balance), className: 'text-foreground' },
                { label: 'Equity', value: formatMoney(d.equity), className: 'text-emerald-400 text-lg font-bold' },
                { label: 'Margin Used', value: formatMoney(d.marginUsed), className: 'text-foreground' },
                { label: 'Free Margin', value: formatMoney(d.freeMargin), className: 'text-foreground' },
                { label: 'Margin Level', value: d.marginLevel > 0 ? `${d.marginLevel}%` : '—', className: 'text-foreground' },
                { label: 'Daily P&L', value: formatMoney(d.dailyPnl, true), className: d.dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
                { label: 'Drawdown', value: `${d.drawdown}%`, className: d.drawdown < 5 ? 'text-emerald-400' : d.drawdown < 10 ? 'text-yellow-400' : 'text-red-400' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{row.label}:</span>
                  <span className={`text-sm font-mono ${row.className}`}>{row.value}</span>
                </div>
              ))}
            </div>
            {/* Mini equity sparkline */}
            <div className="mt-3 h-8 bg-card/50 rounded overflow-hidden relative">
              <div className="absolute inset-0 flex items-end px-1">
                {d.tradeHistory.slice(-20).map((t, i) => {
                  const maxPnl = Math.max(...d.tradeHistory.slice(-20).map(x => Math.abs(x.pnl)), 1);
                  const height = Math.max(10, (Math.abs(t.pnl) / maxPnl) * 100);
                  return (
                    <div key={i} className="flex-1 mx-px" style={{ height: `${height}%` }}>
                      <div className={`w-full h-full rounded-t-sm ${t.pnl >= 0 ? 'bg-emerald-500/60' : 'bg-red-500/60'}`} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Strategy Performance */}
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">Strategy Performance</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Active strategy</span>
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  {d.strategy.name}
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </span>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">Win Rate</span>
                  <span className="text-sm font-bold font-mono text-foreground">{d.strategy.winRate.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full transition-all" style={{ width: `${Math.min(100, d.strategy.winRate)}%` }} />
                </div>
              </div>
              {[
                { label: 'Avg R:R', value: `1:${d.strategy.avgRR}` },
                { label: 'Profit Factor', value: d.strategy.profitFactor.toFixed(2) },
                { label: 'Expectancy', value: `${d.strategy.expectancy >= 0 ? '+' : ''}$${d.strategy.expectancy.toFixed(2)}/trade` },
                { label: 'Max Drawdown', value: `${d.strategy.maxDrawdown}%` },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-mono text-foreground">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trade Summary Grid */}
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">Trade Summary</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-card/50 rounded p-2 text-center">
                <div className="text-lg font-bold font-mono text-foreground">{d.totalTrades}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Total Trades</div>
              </div>
              <div className="bg-card/50 rounded p-2 text-center">
                <div className="text-lg font-bold font-mono text-emerald-400">{d.wins}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Wins</div>
              </div>
              <div className="bg-card/50 rounded p-2 text-center">
                <div className="text-lg font-bold font-mono text-red-400">{d.losses}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Losses</div>
              </div>
              <div className="bg-card/50 rounded p-2 text-center">
                <div className="text-lg font-bold font-mono text-foreground">{d.rejectedCount}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Rejected</div>
              </div>
            </div>
          </div>

          {/* ═══ AUTONOMOUS ENGINE CONTROLS ═══ */}
          <div className="p-4 border-t border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3 flex items-center gap-2">
              Autonomous Engine
              {engineState.data?.running && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
              <span className={`ml-auto text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                engineState.data?.running
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-700/50 text-zinc-400 border-zinc-600'
              }`}>
                {engineState.data?.running ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </h3>

            {/* Engine Control Buttons */}
            <div className="flex gap-2 mb-3">
              {engineState.data?.running ? (
                <button
                  onClick={() => engineStopMut.mutate()}
                  disabled={engineStopMut.isPending}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded transition"
                >
                  {engineStopMut.isPending ? 'Stopping...' : '■ Stop Engine'}
                </button>
              ) : (
                <button
                  onClick={() => engineStartMut.mutate({ intervalSeconds: engineInterval })}
                  disabled={engineStartMut.isPending}
                  className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded transition"
                >
                  {engineStartMut.isPending ? 'Starting...' : '▶ Start Engine'}
                </button>
              )}
              <button
                onClick={() => engineManualScanMut.mutate()}
                disabled={engineManualScanMut.isPending}
                className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded transition"
              >
                {engineManualScanMut.isPending ? '...' : '⟳ Scan Now'}
              </button>
            </div>

            {/* Auto-Trade Toggle */}
            <div className="flex items-center justify-between mb-2 py-1.5 px-2 rounded bg-card/50 border border-border/50">
              <div>
                <div className="text-xs font-bold text-foreground">Auto-Trade</div>
                <div className="text-[10px] text-muted-foreground">Engine places trades automatically when signals meet config</div>
              </div>
              <button
                onClick={() => engineAutoTradeMut.mutate({ enabled: !engineState.data?.autoTrading })}
                disabled={engineAutoTradeMut.isPending}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  engineState.data?.autoTrading ? 'bg-emerald-500' : 'bg-zinc-600'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  engineState.data?.autoTrading ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Scan Interval */}
            <div className="flex items-center justify-between mb-3 py-1.5 px-2 rounded bg-card/50 border border-border/50">
              <div>
                <div className="text-xs font-bold text-foreground">Scan Interval</div>
                <div className="text-[10px] text-muted-foreground">Seconds between each scan cycle</div>
              </div>
              <select
                value={engineInterval}
                onChange={e => setEngineInterval(Number(e.target.value))}
                className="bg-background border border-border rounded px-2 py-1 text-xs font-mono"
              >
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={120}>2m</option>
                <option value={300}>5m</option>
                <option value={600}>10m</option>
              </select>
            </div>

            {/* Engine Stats */}
            {engineState.data && (
              <div className="grid grid-cols-4 gap-1 mb-3">
                {[
                  { label: 'Scans', value: engineState.data.totalScans, color: 'text-foreground' },
                  { label: 'Signals', value: engineState.data.totalSignals, color: 'text-cyan-400' },
                  { label: 'Trades', value: engineState.data.totalTradesPlaced, color: 'text-purple-400' },
                  { label: 'P-Mort', value: engineState.data.postMortemCount, color: 'text-yellow-400' },
                ].map(s => (
                  <div key={s.label} className="text-center py-1.5 rounded bg-card/30 border border-border/30">
                    <div className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</div>
                    <div className="text-[9px] text-muted-foreground uppercase">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Last Scan Results */}
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Latest Scan Results</h4>
            {scanResults.data && scanResults.data.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {scanResults.data.slice(0, 8).map((sr: any, i: number) => (
                  <div key={i} className="bg-card/50 border border-border/50 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold text-foreground">{sr.symbol}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono font-bold ${
                          sr.signal === 'buy' ? 'text-emerald-400' : sr.signal === 'sell' ? 'text-red-400' : 'text-muted-foreground'
                        }`}>
                          {sr.signal?.toUpperCase() || 'NEUTRAL'}
                        </span>
                        <span className={`text-[10px] font-bold px-1 rounded ${
                          sr.confluenceScore >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                          sr.confluenceScore >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-zinc-700/50 text-muted-foreground'
                        }`}>
                          {sr.confluenceScore}/100
                        </span>
                      </div>
                    </div>
                    {sr.reasoning?.summary && (
                      <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{sr.reasoning.summary}</div>
                    )}
                    {sr.reasoning?.factors && sr.reasoning.factors.filter((f: any) => f.present).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sr.reasoning.factors.filter((f: any) => f.present).map((f: any, j: number) => (
                          <span key={j} className="px-1 py-0.5 bg-cyan-500/10 text-cyan-400 text-[9px] border border-cyan-500/20 rounded">
                            {f.concept}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs font-mono text-muted-foreground text-center py-4 border border-dashed border-border/50 rounded">
                No scan results yet. Start the engine or click Scan Now.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM: Live Log ═══ */}
      <div className="flex-shrink-0 border-t border-border" style={{ height: '200px' }}>
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-card/30">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Live Log</h3>
          <span className="text-[10px] text-muted-foreground font-mono">{d.log.length} entries</span>
        </div>
        <div className="overflow-auto font-mono text-xs leading-relaxed px-4 py-2" style={{ height: 'calc(200px - 32px)' }}>
          {d.log.length === 0 ? (
            <div className="text-muted-foreground py-4 text-center">Paper trading engine ready. Press START to begin.</div>
          ) : (
            [...d.log].reverse().map((entry, i) => {
              const colorMap: Record<string, { icon: string; color: string }> = {
                system: { icon: '●', color: 'text-emerald-400' },
                signal: { icon: '⚡', color: 'text-yellow-400' },
                trade: { icon: '✓', color: 'text-emerald-400' },
                info: { icon: '●', color: 'text-cyan-400' },
                warning: { icon: '⚠', color: 'text-red-400' },
                error: { icon: '✕', color: 'text-red-500' },
              };
              const { icon, color } = colorMap[entry.level] || colorMap.info!;
              return (
                <div key={i} className="flex gap-2 py-0.5">
                  <span className="text-muted-foreground flex-shrink-0">{formatTime(entry.time)}</span>
                  <span className={`flex-shrink-0 ${color}`}>{icon}</span>
                  <span className={color}>{entry.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bot Config Modal */}
      {showConfig && <BotConfigPanel onClose={() => setShowConfig(false)} />}

      {/* ═══ KILL SWITCH BANNER ═══ */}
      {d.killSwitchActive && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠</span>
            <span className="font-bold text-sm uppercase tracking-wider">Kill Switch Active — All Trading Halted</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => emergencyCloseMut.mutate()}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold uppercase rounded transition"
            >
              Close All Positions
            </button>
            <button
              onClick={() => killSwitchMut.mutate({ active: false })}
              className="px-3 py-1 bg-white text-red-600 text-xs font-bold uppercase rounded hover:bg-white/90 transition"
            >
              Deactivate
            </button>
          </div>
        </div>
      )}

      {/* ═══ LIVE MODE CONFIRMATION DIALOG ═══ */}
      {showLiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-red-500/50 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-red-400 text-xl">⚠</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Switch to LIVE Mode?</h3>
                <p className="text-xs text-muted-foreground">This will route orders to your connected broker</p>
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded p-3 mb-4">
              <p className="text-sm text-red-300 font-medium mb-2">Warning: Live mode will execute real trades with real money.</p>
              <ul className="text-xs text-red-300/80 space-y-1">
                <li>• Orders will be sent to your connected broker (OANDA / MetaApi)</li>
                <li>• Paper positions will still be tracked for unified P&L</li>
                <li>• Use the Kill Switch to halt all trading immediately</li>
                <li>• Ensure your broker connection is configured in Settings</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLiveConfirm(false)}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-bold rounded transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  executionModeMut.mutate({ mode: 'live' });
                  setShowLiveConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded transition"
              >
                Enable LIVE Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LIVE MODE TOP BANNER ═══ */}
      {d.executionMode === 'live' && !d.killSwitchActive && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-red-600/90 text-white px-4 py-1 flex items-center justify-center gap-3">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider">Live Trading Active — Real Money at Risk</span>
          <button
            onClick={() => executionModeMut.mutate({ mode: 'paper' })}
            className="px-2 py-0.5 bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold uppercase rounded transition ml-2"
          >
            Switch to Paper
          </button>
        </div>
      )}
    </div>
  );
}
