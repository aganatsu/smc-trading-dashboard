/**
 * Paper Trading Engine — Simulated trading with DB persistence
 * 
 * Features:
 * - Place paper market orders with SL/TP
 * - Track open positions with live P&L (via Yahoo quotes)
 * - Close positions manually or auto-close on SL/TP hit
 * - Portfolio heat / margin calculation
 * - Auto-log closed trades to the journal (trades table)
 * - Trade history tracking
 * - Signal tracking with reasons/scores
 * - Strategy performance stats
 * - Scan/signal/rejection counters
 * - Uptime tracking
 * - Terminal log with categorized entries
 * - **DB persistence** — balance, positions, history survive restarts
 * - **Execution mode** — PAPER or LIVE (with safety guards)
 * - **Kill switch** — emergency halt all trading
 */

import { nanoid } from 'nanoid';
import { notifyTradeClosed, notifyTradePlaced } from './notifications';
import { fetchQuoteFromYahoo } from './marketData';
import { createTrade } from './db';
import { validateTradeAgainstConfig, getConfig } from './botConfig';
import { executeLiveOrder, closeLivePosition, type LiveExecutionResult } from './liveExecution';
import {
  saveAccountState,
  savePosition,
  savePendingOrder,
  removePosition,
  saveTradeRecord,
  restoreState,
  clearAllState,
  type RestoredState,
} from './paperTradingPersistence';

// Lazy import to avoid circular dependency — botEngine imports paperTrading
let _generatePostMortem: ((position: PaperPosition, exitReason: string) => any) | null = null;
export function registerPostMortemGenerator(fn: (position: PaperPosition, exitReason: string) => any) {
  _generatePostMortem = fn;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface PaperPosition {
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
  signalReason: string;
  signalScore: number;
  orderId: string;
  /** Broker trade/position ID from live execution (OANDA trade ID or MetaApi position ID) */
  brokerTradeId?: string;
}

export interface PaperTradeRecord {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPips: number;
  openTime: string;
  closedAt: string;
  closeReason: 'manual' | 'stop_loss' | 'take_profit';
  signalReason: string;
  signalScore: number;
  orderId: string;
}

export type LogLevel = 'signal' | 'trade' | 'info' | 'warning' | 'error' | 'system';

export interface LogEntry {
  time: string;
  level: LogLevel;
  message: string;
}

export interface StrategyStats {
  name: string;
  winRate: number;
  avgRR: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
}

export interface PendingOrder {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  triggerPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  signalReason: string;
  signalScore: number;
  createdAt: string;
  orderType: 'buy_limit' | 'sell_limit' | 'buy_stop' | 'sell_stop';
}

export type ExecutionMode = 'paper' | 'live';

export interface PaperAccountState {
  // Account
  balance: number;
  equity: number;
  unrealizedPnl: number;
  marginUsed: number;
  freeMargin: number;
  marginLevel: number;
  dailyPnl: number;
  drawdown: number;
  
  // Positions & History
  positions: PaperPosition[];
  pendingOrders: PendingOrder[];
  tradeHistory: PaperTradeRecord[];
  
  // Engine state
  isRunning: boolean;
  isPaused: boolean;
  startedAt: string | null;
  uptime: number;
  
  // Counters
  totalTrades: number;
  winRate: number;
  wins: number;
  losses: number;
  scanCount: number;
  signalCount: number;
  tradeCount: number;
  rejectedCount: number;
  
  // Strategy
  strategy: StrategyStats;
  
  // Log
  log: LogEntry[];

  // Execution mode & safety
  executionMode: ExecutionMode;
  killSwitchActive: boolean;
}

// ─── Pip value helpers ───────────────────────────────────────────────

const INSTRUMENT_SPECS: Record<string, { pipSize: number; lotUnits: number; marginPerLot: number }> = {
  'EUR/USD': { pipSize: 0.0001, lotUnits: 100000, marginPerLot: 1000 },
  'GBP/USD': { pipSize: 0.0001, lotUnits: 100000, marginPerLot: 1000 },
  'USD/JPY': { pipSize: 0.01, lotUnits: 100000, marginPerLot: 1000 },
  'GBP/JPY': { pipSize: 0.01, lotUnits: 100000, marginPerLot: 1500 },
  'AUD/USD': { pipSize: 0.0001, lotUnits: 100000, marginPerLot: 800 },
  'USD/CAD': { pipSize: 0.0001, lotUnits: 100000, marginPerLot: 1000 },
  'EUR/GBP': { pipSize: 0.0001, lotUnits: 100000, marginPerLot: 1200 },
  'NZD/USD': { pipSize: 0.0001, lotUnits: 100000, marginPerLot: 700 },
  'BTC/USD': { pipSize: 1, lotUnits: 1, marginPerLot: 5000 },
  'ETH/USD': { pipSize: 0.01, lotUnits: 1, marginPerLot: 1000 },
  'XAU/USD': { pipSize: 0.01, lotUnits: 100, marginPerLot: 2000 },
  'XAG/USD': { pipSize: 0.001, lotUnits: 5000, marginPerLot: 1500 },
};

function calculatePnl(position: PaperPosition): { pnl: number; pnlPips: number } {
  const spec = INSTRUMENT_SPECS[position.symbol] || { pipSize: 0.0001, lotUnits: 100000, marginPerLot: 1000 };
  const priceDiff = position.direction === 'long'
    ? position.currentPrice - position.entryPrice
    : position.entryPrice - position.currentPrice;
  
  const pnlPips = priceDiff / spec.pipSize;
  const pnl = priceDiff * spec.lotUnits * position.size;
  
  return { pnl, pnlPips };
}

function calculateMargin(positions: PaperPosition[]): number {
  return positions.reduce((sum, pos) => {
    const spec = INSTRUMENT_SPECS[pos.symbol] || { pipSize: 0.0001, lotUnits: 100000, marginPerLot: 1000 };
    return sum + (spec.marginPerLot * pos.size);
  }, 0);
}

// ─── Engine State ────────────────────────────────────────────────────

const INITIAL_BALANCE = 10000;

let balance = INITIAL_BALANCE;
let peakBalance = INITIAL_BALANCE;
let positions: PaperPosition[] = [];
let pendingOrders: PendingOrder[] = [];
let tradeHistory: PaperTradeRecord[] = [];
let isRunning = false;
let isPaused = false;
let startedAt: Date | null = null;
let priceUpdateInterval: ReturnType<typeof setInterval> | null = null;
let ownerUserId: number | null = null;

// Execution mode & safety
let executionMode: ExecutionMode = 'paper';
let killSwitchActive = false;

// Counters
let scanCount = 0;
let signalCount = 0;
let rejectedCount = 0;
let dailyPnlBase = 0;
let dailyPnlDate = '';

// Log
let logEntries: LogEntry[] = [];
const MAX_LOG_ENTRIES = 200;

export function addLog(level: LogLevel, message: string) {
  const entry: LogEntry = {
    time: new Date().toISOString(),
    level,
    message,
  };
  logEntries.push(entry);
  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries = logEntries.slice(-MAX_LOG_ENTRIES);
  }
}

function resetDailyPnl() {
  const today = new Date().toISOString().split('T')[0];
  if (dailyPnlDate !== today) {
    dailyPnlBase = balance;
    dailyPnlDate = today;
  }
}

// ─── Persistence Helper ─────────────────────────────────────────────

function persistAccountState() {
  if (!ownerUserId) return;
  saveAccountState(ownerUserId, {
    balance,
    peakBalance,
    isRunning,
    isPaused,
    startedAt,
    scanCount,
    signalCount,
    rejectedCount,
    dailyPnlBase,
    dailyPnlDate,
    executionMode,
    killSwitchActive,
  });
}

// ─── Strategy Stats Calculation ─────────────────────────────────────

function computeStrategyStats(): StrategyStats {
  const closed = tradeHistory;
  const wins = closed.filter(t => t.pnl > 0);
  const losses = closed.filter(t => t.pnl <= 0);
  
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  
  const rrValues = closed.map(t => {
    if (t.pnlPips === 0) return 0;
    return Math.abs(t.pnlPips) / 10;
  });
  const avgRR = rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0;
  
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  
  const expectancy = closed.length > 0 ? closed.reduce((sum, t) => sum + t.pnl, 0) / closed.length : 0;
  
  let peak = INITIAL_BALANCE;
  let maxDD = 0;
  let runningBal = INITIAL_BALANCE;
  for (const t of closed) {
    runningBal += t.pnl;
    if (runningBal > peak) peak = runningBal;
    const dd = ((peak - runningBal) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }
  
  return {
    name: 'SMC Default',
    winRate,
    avgRR: parseFloat(avgRR.toFixed(1)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(2)),
    maxDrawdown: parseFloat(maxDD.toFixed(1)),
  };
}

// ─── Price Update Loop ──────────────────────────────────────────────

export async function updatePrices() {
  if (positions.length === 0 && pendingOrders.length === 0) return;
  
  const symbols = Array.from(new Set(positions.map(p => p.symbol)));
  
  scanCount += symbols.length;
  
  for (const symbol of symbols) {
    try {
      const quote = await fetchQuoteFromYahoo(symbol);
      if (!quote || !quote.price) continue;
      
      for (const pos of positions) {
        if (pos.symbol === symbol) {
          pos.currentPrice = quote.price;
          const { pnl } = calculatePnl(pos);
          pos.pnl = pnl;
        }
      }
    } catch (err) {
      // Silently skip
    }
  }
  
  // Check SL/TP hits
  const toClose: { id: string; reason: 'stop_loss' | 'take_profit' }[] = [];
  
  for (const pos of positions) {
    if (pos.stopLoss !== null) {
      if (pos.direction === 'long' && pos.currentPrice <= pos.stopLoss) {
        toClose.push({ id: pos.id, reason: 'stop_loss' });
        addLog('warning', `${pos.symbol} hit Stop Loss @ ${pos.stopLoss}. Closing position.`);
      } else if (pos.direction === 'short' && pos.currentPrice >= pos.stopLoss) {
        toClose.push({ id: pos.id, reason: 'stop_loss' });
        addLog('warning', `${pos.symbol} hit Stop Loss @ ${pos.stopLoss}. Closing position.`);
      }
    }
    if (pos.takeProfit !== null) {
      if (pos.direction === 'long' && pos.currentPrice >= pos.takeProfit) {
        toClose.push({ id: pos.id, reason: 'take_profit' });
        addLog('info', `${pos.symbol} hit Take Profit @ ${pos.takeProfit}. Closing position.`);
      } else if (pos.direction === 'short' && pos.currentPrice <= pos.takeProfit) {
        toClose.push({ id: pos.id, reason: 'take_profit' });
        addLog('info', `${pos.symbol} hit Take Profit @ ${pos.takeProfit}. Closing position.`);
      }
    }
    
    if (pos.stopLoss !== null) {
      const distToSL = Math.abs(pos.currentPrice - pos.stopLoss);
      const totalRange = Math.abs(pos.entryPrice - pos.stopLoss);
      if (totalRange > 0 && distToSL / totalRange < 0.2 && !toClose.find(c => c.id === pos.id)) {
        addLog('warning', `${pos.symbol} Position Approaching Stop Loss`);
      }
    }
  }
  
  for (const { id, reason } of toClose) {
    await closePositionInternal(id, reason);
  }
  
  // Check pending orders for trigger
  const toTrigger: string[] = [];
  for (const order of pendingOrders) {
    const positionsForSymbol = positions.filter(p => p.symbol === order.symbol);
    const currentPrice = positionsForSymbol.length > 0 ? positionsForSymbol[0].currentPrice : null;
    if (!currentPrice) {
      try {
        const quote = await fetchQuoteFromYahoo(order.symbol);
        if (!quote?.price) continue;
        const price = quote.price;
        if ((order.orderType === 'buy_limit' && price <= order.triggerPrice) ||
            (order.orderType === 'sell_limit' && price >= order.triggerPrice) ||
            (order.orderType === 'buy_stop' && price >= order.triggerPrice) ||
            (order.orderType === 'sell_stop' && price <= order.triggerPrice)) {
          toTrigger.push(order.id);
        }
      } catch (err) {
        console.error(`[PaperTrading] Failed to fetch quote for pending order ${order.symbol}:`, err);
      }
    } else {
      if ((order.orderType === 'buy_limit' && currentPrice <= order.triggerPrice) ||
          (order.orderType === 'sell_limit' && currentPrice >= order.triggerPrice) ||
          (order.orderType === 'buy_stop' && currentPrice >= order.triggerPrice) ||
          (order.orderType === 'sell_stop' && currentPrice <= order.triggerPrice)) {
        toTrigger.push(order.id);
      }
    }
  }
  
  for (const orderId of toTrigger) {
    await triggerPendingOrder(orderId);
  }

  // Persist account state after price updates (debounced)
  persistAccountState();
}

// ─── Internal Close ──────────────────────────────────────────────────

async function closePositionInternal(positionId: string, reason: 'manual' | 'stop_loss' | 'take_profit'): Promise<PaperTradeRecord | null> {
  // Kill switch check
  if (killSwitchActive && reason !== 'manual') {
    addLog('warning', 'Kill switch active — auto-close blocked. Use manual close.');
    return null;
  }

  const idx = positions.findIndex(p => p.id === positionId);
  if (idx === -1) return null;
  
  const pos = positions[idx];
  const { pnl, pnlPips } = calculatePnl(pos);
  
  let exitPrice = pos.currentPrice;
  if (reason === 'stop_loss' && pos.stopLoss !== null) {
    exitPrice = pos.stopLoss;
  } else if (reason === 'take_profit' && pos.takeProfit !== null) {
    exitPrice = pos.takeProfit;
  }
  
  const finalPriceDiff = pos.direction === 'long'
    ? exitPrice - pos.entryPrice
    : pos.entryPrice - exitPrice;
  const spec = INSTRUMENT_SPECS[pos.symbol] || { pipSize: 0.0001, lotUnits: 100000, marginPerLot: 1000 };
  const finalPnl = finalPriceDiff * spec.lotUnits * pos.size;
  const finalPips = finalPriceDiff / spec.pipSize;
  
  const record: PaperTradeRecord = {
    id: pos.id,
    symbol: pos.symbol,
    direction: pos.direction,
    size: pos.size,
    entryPrice: pos.entryPrice,
    exitPrice,
    pnl: finalPnl,
    pnlPips: finalPips,
    openTime: pos.openTime,
    closedAt: new Date().toISOString(),
    closeReason: reason,
    signalReason: pos.signalReason,
    signalScore: pos.signalScore,
    orderId: pos.orderId,
  };
  
  balance += finalPnl;
  if (balance > peakBalance) peakBalance = balance;

  // ─── LIVE BROKER CLOSE ──────────────────────────────────────
  // If this position was opened via a live broker, close the broker position too
  if (executionMode === 'live' && pos.brokerTradeId && ownerUserId) {
    addLog('trade', `[LIVE] Closing broker position #${pos.brokerTradeId}...`);
    try {
      const closeResult = await closeLivePosition(ownerUserId, pos.brokerTradeId);
      if (closeResult.success) {
        addLog('trade', `[LIVE] Broker position #${pos.brokerTradeId} closed successfully`);
      } else {
        addLog('error', `[LIVE] Failed to close broker position #${pos.brokerTradeId}: ${closeResult.error}`);
      }
    } catch (err: any) {
      addLog('error', `[LIVE] Exception closing broker position #${pos.brokerTradeId}: ${err.message}`);
    }
  }
  
  // Generate post-mortem before removing position
  if (_generatePostMortem) {
    try {
      _generatePostMortem(pos, reason);
    } catch (err) {
      console.error('[PaperTrading] Post-mortem generation failed:', err);
    }
  }

  positions.splice(idx, 1);
  tradeHistory.push(record);
  
  const pnlStr = finalPnl >= 0 ? `+$${finalPnl.toFixed(2)}` : `-$${Math.abs(finalPnl).toFixed(2)}`;
  addLog('trade', `Position closed: ${pos.symbol} ${pos.direction.toUpperCase()} ${pos.size} lots. P&L: ${pnlStr}. Reason: ${reason.replace('_', ' ')}`);

  // Notify owner of trade closure
  notifyTradeClosed({
    symbol: pos.symbol,
    direction: pos.direction,
    size: pos.size,
    entryPrice: pos.entryPrice,
    exitPrice,
    pnl: finalPnl,
    pnlPips: finalPips,
    closeReason: reason,
  });

  // Persist: remove position, save trade record, update account
  if (ownerUserId) {
    removePosition(ownerUserId, pos.id);
    saveTradeRecord(ownerUserId, record);
    persistAccountState();
  }
  
  // Auto-log to journal
  if (ownerUserId) {
    try {
      let riskReward: string | undefined;
      if (pos.stopLoss !== null) {
        const riskPips = Math.abs(pos.entryPrice - pos.stopLoss) / spec.pipSize;
        if (riskPips > 0) {
          riskReward = Math.abs(finalPips / riskPips).toFixed(2);
        }
      }
      
      await createTrade({
        userId: ownerUserId,
        symbol: pos.symbol,
        direction: pos.direction,
        status: 'closed',
        entryPrice: pos.entryPrice.toString(),
        exitPrice: exitPrice.toString(),
        stopLoss: pos.stopLoss?.toString(),
        takeProfit: pos.takeProfit?.toString(),
        positionSize: pos.size.toString(),
        riskReward,
        pnlPips: finalPips.toFixed(2),
        pnlAmount: finalPnl.toFixed(2),
        timeframe: '4H',
        setupType: pos.signalReason || `Paper ${reason.replace('_', ' ')}`,
        notes: `Signal score: ${pos.signalScore}/10. Close reason: ${reason}. Order ID: ${pos.orderId}`,
        entryTime: new Date(pos.openTime),
        exitTime: new Date(),
      });
    } catch (err) {
      console.error('[PaperTrading] Failed to auto-log trade to journal:', err);
    }
  }

  // Check daily loss limit for auto-halt
    const config = getConfig();
    if (config.protection?.dailyLossLimit && config.protection.haltOnDailyLoss) {
      const currentDailyLoss = Math.max(0, -(balance - dailyPnlBase));
      if (currentDailyLoss >= config.protection.dailyLossLimit) {
        addLog('error', `DAILY LOSS LIMIT HIT ($${currentDailyLoss.toFixed(2)} >= $${config.protection.dailyLossLimit}). Auto-halting trading.`);
        killSwitchActive = true;
        persistAccountState();
      }
    }

    // Check max drawdown for auto-halt
    if (config.protection?.cumulativeLossLimit) {
      const totalLoss = Math.max(0, peakBalance - balance);
      if (totalLoss >= config.protection.cumulativeLossLimit) {
        addLog('error', `CUMULATIVE LOSS LIMIT HIT ($${totalLoss.toFixed(2)} >= $${config.protection.cumulativeLossLimit}). Auto-halting trading.`);
        killSwitchActive = true;
        persistAccountState();
      }
    }
  
  return record;
}

// ─── Public API ──────────────────────────────────────────────────────

export function setOwnerUserId(userId: number) {
  ownerUserId = userId;
}

export function getStatus(): PaperAccountState {
  resetDailyPnl();
  
  const unrealizedPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const equity = balance + unrealizedPnl;
  const marginUsed = calculateMargin(positions);
  const freeMargin = equity - marginUsed;
  const marginLevel = marginUsed > 0 ? (equity / marginUsed) * 100 : 0;
  const dailyPnl = balance - dailyPnlBase + unrealizedPnl;
  const drawdown = peakBalance > 0 ? ((peakBalance - equity) / peakBalance) * 100 : 0;
  
  const closedTrades = tradeHistory.length;
  const wins = tradeHistory.filter(t => t.pnl > 0).length;
  const losses = tradeHistory.filter(t => t.pnl <= 0).length;
  
  let uptime = 0;
  if (startedAt && isRunning) {
    uptime = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  }
  
  return {
    balance,
    equity,
    unrealizedPnl,
    marginUsed,
    freeMargin,
    marginLevel: parseFloat(marginLevel.toFixed(0)),
    dailyPnl,
    drawdown: parseFloat(Math.max(0, drawdown).toFixed(1)),
    
    positions: [...positions],
    pendingOrders: [...pendingOrders],
    tradeHistory: tradeHistory.slice(-100),
    
    isRunning,
    isPaused,
    startedAt: startedAt?.toISOString() || null,
    uptime,
    
    totalTrades: closedTrades,
    winRate: closedTrades > 0 ? parseFloat(((wins / closedTrades) * 100).toFixed(1)) : 0,
    wins,
    losses,
    scanCount,
    signalCount,
    tradeCount: closedTrades + positions.length,
    rejectedCount,
    
    strategy: computeStrategyStats(),
    
    log: logEntries.slice(-100),

    executionMode,
    killSwitchActive,
  };
}

export async function placeOrder(params: {
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  stopLoss?: number;
  takeProfit?: number;
  signalReason?: string;
  signalScore?: number;
}): Promise<{ success: boolean; position?: PaperPosition; entryPrice?: number; error?: string }> {
  const { symbol, direction, size, stopLoss, takeProfit, signalReason, signalScore } = params;

  // Kill switch check
  if (killSwitchActive) {
    return { success: false, error: 'Kill switch is active — all trading halted. Deactivate kill switch first.' };
  }
  
  if (!INSTRUMENT_SPECS[symbol]) {
    return { success: false, error: `Unsupported symbol: ${symbol}` };
  }
  
  if (size <= 0 || size > 100) {
    return { success: false, error: 'Invalid position size' };
  }

  // Bot Config Validation
  const positionsForSymbol = positions.filter(p => p.symbol === symbol).length;
  const totalMargin = positions.reduce((sum, p) => sum + (p.size * p.entryPrice * 100), 0);
  const portfolioHeatPercent = balance > 0 ? (totalMargin / balance) * 100 : 0;
  const currentDailyPnl = balance - dailyPnlBase;
  const dailyLossPercent = balance > 0 ? Math.max(0, -currentDailyPnl) / balance * 100 : 0;
  const drawdownPercent = peakBalance > 0 ? ((peakBalance - balance) / peakBalance) * 100 : 0;
  const configCheck = validateTradeAgainstConfig({
    symbol,
    direction,
    size,
    stopLoss,
    takeProfit,
    entryPrice: 0,
    currentPositions: positions.length,
    positionsForSymbol,
    portfolioHeatPercent,
    dailyLossPercent,
    drawdownPercent,
    confluenceScore: signalScore ?? 0,
  });
  if (!configCheck.allowed) {
    addLog('warning', `Trade rejected: ${configCheck.reason}`);
    rejectedCount++;
    return { success: false, error: configCheck.reason };
  }
  
  try {
    const quote = await fetchQuoteFromYahoo(symbol);
    if (!quote || !quote.price) {
      return { success: false, error: 'Could not get current price' };
    }
    
    const entryPrice = quote.price;
    
    if (stopLoss !== undefined) {
      if (direction === 'long' && stopLoss >= entryPrice) {
        return { success: false, error: 'Stop loss must be below entry for long positions' };
      }
      if (direction === 'short' && stopLoss <= entryPrice) {
        return { success: false, error: 'Stop loss must be above entry for short positions' };
      }
    }
    if (takeProfit !== undefined) {
      if (direction === 'long' && takeProfit <= entryPrice) {
        return { success: false, error: 'Take profit must be above entry for long positions' };
      }
      if (direction === 'short' && takeProfit >= entryPrice) {
        return { success: false, error: 'Take profit must be below entry for short positions' };
      }
    }
    
    const orderId = `#${Math.floor(10000000 + Math.random() * 90000000)}`;
    const reason = signalReason || 'Manual order';
    const score = signalScore ?? 0;
    
    const position: PaperPosition = {
      id: nanoid(8),
      symbol,
      direction,
      size,
      entryPrice,
      currentPrice: entryPrice,
      pnl: 0,
      stopLoss: stopLoss ?? null,
      takeProfit: takeProfit ?? null,
      openTime: new Date().toISOString(),
      signalReason: reason,
      signalScore: score,
      orderId,
    };
    
    positions.push(position);
    signalCount++;
    
    addLog('signal', `${symbol} ${direction === 'long' ? 'BUY' : 'SELL'} Signal Detected (${reason})`);
    addLog('trade', `Executing ${direction === 'long' ? 'BUY' : 'SELL'} ${size} ${symbol} @ ${entryPrice}. Order ID: ${orderId}`);

    // ─── LIVE BROKER EXECUTION ─────────────────────────────────
    let liveResult: LiveExecutionResult | null = null;
    if (executionMode === 'live' && ownerUserId) {
      addLog('trade', `[LIVE MODE] Routing order to broker...`);
      liveResult = await executeLiveOrder(ownerUserId, {
        symbol,
        direction,
        size,
        stopLoss,
        takeProfit,
        signalReason: reason,
      });
      if (liveResult.success) {
        addLog('trade', `[LIVE] Broker fill confirmed: ${liveResult.broker?.toUpperCase()} Trade #${liveResult.brokerTradeId}${liveResult.fillPrice ? ` @ ${liveResult.fillPrice}` : ''}`);
        // Store broker trade ID on position for close routing
        if (liveResult.brokerTradeId) {
          position.brokerTradeId = liveResult.brokerTradeId;
        }
        // Update entry price to actual fill price if available
        if (liveResult.fillPrice && liveResult.fillPrice > 0) {
          position.entryPrice = liveResult.fillPrice;
          position.currentPrice = liveResult.fillPrice;
        }
      } else {
        addLog('error', `[LIVE] Broker execution failed: ${liveResult.error}. Paper position still tracked.`);
      }
    }

    notifyTradePlaced({
      symbol,
      direction,
      size,
      entryPrice,
      stopLoss: stopLoss ?? null,
      takeProfit: takeProfit ?? null,
      reason,
      score,
    });

    // Persist position and account state
    if (ownerUserId) {
      savePosition(ownerUserId, position);
      persistAccountState();
    }
    
    return { success: true, position, entryPrice };
  } catch (err: any) {
    addLog('error', `Failed to place order: ${err.message}`);
    return { success: false, error: err.message || 'Failed to place order' };
  }
}

export async function closePosition(positionId: string): Promise<{ success: boolean; pnl?: number; error?: string }> {
  const pos = positions.find(p => p.id === positionId);
  if (!pos) {
    return { success: false, error: 'Position not found' };
  }
  
  try {
    const quote = await fetchQuoteFromYahoo(pos.symbol);
    if (quote?.price) {
      pos.currentPrice = quote.price;
    }
  } catch {}
  
  const record = await closePositionInternal(positionId, 'manual');
  if (!record) {
    return { success: false, error: 'Failed to close position' };
  }
  
  return { success: true, pnl: record.pnl };
}

// ─── Pending Orders ─────────────────────────────────────────────────

export function placePendingOrder(params: {
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  triggerPrice: number;
  orderType: 'buy_limit' | 'sell_limit' | 'buy_stop' | 'sell_stop';
  stopLoss?: number;
  takeProfit?: number;
  signalReason?: string;
  signalScore?: number;
}): { success: boolean; order?: PendingOrder; error?: string } {
  const { symbol, direction, size, triggerPrice, orderType, stopLoss, takeProfit, signalReason, signalScore } = params;

  // Kill switch check
  if (killSwitchActive) {
    return { success: false, error: 'Kill switch is active — all trading halted.' };
  }
  
  if (!INSTRUMENT_SPECS[symbol]) {
    return { success: false, error: `Unsupported symbol: ${symbol}` };
  }

  // Bot Config Validation
  const positionsForSymbol = positions.filter(p => p.symbol === symbol).length;
  const totalMargin = positions.reduce((sum, p) => sum + (p.size * p.entryPrice * 100), 0);
  const portfolioHeatPercent = balance > 0 ? (totalMargin / balance) * 100 : 0;
  const currentDailyPnlPending = balance - dailyPnlBase;
  const dailyLossPercent = balance > 0 ? Math.max(0, -currentDailyPnlPending) / balance * 100 : 0;
  const drawdownPercent = peakBalance > 0 ? ((peakBalance - balance) / peakBalance) * 100 : 0;
  const configCheck = validateTradeAgainstConfig({
    symbol,
    direction,
    size,
    stopLoss,
    takeProfit,
    entryPrice: triggerPrice,
    currentPositions: positions.length,
    positionsForSymbol,
    portfolioHeatPercent,
    dailyLossPercent,
    drawdownPercent,
    confluenceScore: signalScore ?? 0,
  });
  if (!configCheck.allowed) {
    addLog('warning', `Pending order rejected: ${configCheck.reason}`);
    rejectedCount++;
    return { success: false, error: configCheck.reason };
  }

  const order: PendingOrder = {
    id: nanoid(8),
    symbol,
    direction,
    size,
    triggerPrice,
    stopLoss: stopLoss ?? null,
    takeProfit: takeProfit ?? null,
    signalReason: signalReason || 'Pending order',
    signalScore: signalScore ?? 0,
    createdAt: new Date().toISOString(),
    orderType,
  };
  
  pendingOrders.push(order);
  addLog('trade', `Pending ${orderType.replace('_', ' ').toUpperCase()} placed: ${symbol} ${size} lots @ ${triggerPrice}`);

  // Persist pending order
  if (ownerUserId) {
    savePendingOrder(ownerUserId, order);
  }
  
  return { success: true, order };
}

export function cancelPendingOrder(orderId: string): { success: boolean; error?: string } {
  const idx = pendingOrders.findIndex(o => o.id === orderId);
  if (idx === -1) return { success: false, error: 'Pending order not found' };
  
  const order = pendingOrders[idx];
  pendingOrders.splice(idx, 1);
  addLog('info', `Pending order cancelled: ${order.symbol} ${order.orderType.replace('_', ' ')}`);

  // Remove from DB
  if (ownerUserId) {
    removePosition(ownerUserId, order.id);
  }
  
  return { success: true };
}

async function triggerPendingOrder(orderId: string) {
  const idx = pendingOrders.findIndex(o => o.id === orderId);
  if (idx === -1) return;
  
  const order = pendingOrders[idx];
  pendingOrders.splice(idx, 1);
  
  addLog('signal', `Pending order triggered: ${order.symbol} ${order.orderType.replace('_', ' ')} @ ${order.triggerPrice}`);

  // Remove pending from DB (placeOrder will save the new position)
  if (ownerUserId) {
    removePosition(ownerUserId, order.id);
  }
  
  await placeOrder({
    symbol: order.symbol,
    direction: order.direction,
    size: order.size,
    stopLoss: order.stopLoss ?? undefined,
    takeProfit: order.takeProfit ?? undefined,
    signalReason: order.signalReason,
    signalScore: order.signalScore,
  });
}

export function addScan(symbol: string) {
  scanCount++;
  addLog('info', `Scanning ${symbol}...`);
}

export function addRejection(symbol: string, reason: string) {
  rejectedCount++;
  addLog('info', `${symbol}: ${reason} - skipping`);
}

// ─── Engine Controls ────────────────────────────────────────────────

export function startEngine() {
  if (isRunning && !isPaused) return;
  isRunning = true;
  isPaused = false;
  
  if (!startedAt) {
    startedAt = new Date();
    resetDailyPnl();
    dailyPnlBase = balance;
  }
  
  addLog('system', `Bot started in ${executionMode.toUpperCase()} mode with all modules active`);
  
  priceUpdateInterval = setInterval(updatePrices, 15000);
  updatePrices();
  persistAccountState();
}

export function pauseEngine() {
  if (!isRunning) return;
  isPaused = true;
  isRunning = false;
  if (priceUpdateInterval) {
    clearInterval(priceUpdateInterval);
    priceUpdateInterval = null;
  }
  addLog('system', 'Bot paused');
  persistAccountState();
}

export function stopEngine() {
  isRunning = false;
  isPaused = false;
  startedAt = null;
  if (priceUpdateInterval) {
    clearInterval(priceUpdateInterval);
    priceUpdateInterval = null;
  }
  addLog('system', 'Bot stopped');
  persistAccountState();
}

export async function resetAccount() {
  stopEngine();
  balance = INITIAL_BALANCE;
  peakBalance = INITIAL_BALANCE;
  positions = [];
  pendingOrders = [];
  tradeHistory = [];
  scanCount = 0;
  signalCount = 0;
  rejectedCount = 0;
  dailyPnlBase = INITIAL_BALANCE;
  dailyPnlDate = '';
  logEntries = [];
  killSwitchActive = false;
  executionMode = 'paper';
  addLog('system', `Paper account RESET to $${INITIAL_BALANCE.toLocaleString()}`);

  // Clear all persisted state
  if (ownerUserId) {
    await clearAllState(ownerUserId);
  }
}

// ─── Execution Mode & Safety ────────────────────────────────────────

export function getExecutionMode(): ExecutionMode {
  return executionMode;
}

export function setExecutionMode(mode: ExecutionMode) {
  executionMode = mode;
  addLog('system', `Execution mode changed to ${mode.toUpperCase()}`);
  persistAccountState();
}

export function isKillSwitchActive(): boolean {
  return killSwitchActive;
}

export function activateKillSwitch() {
  killSwitchActive = true;
  addLog('error', 'KILL SWITCH ACTIVATED — All trading halted immediately');
  
  // Stop the engine
  if (isRunning) {
    pauseEngine();
  }
  persistAccountState();
}

export function deactivateKillSwitch() {
  killSwitchActive = false;
  addLog('system', 'Kill switch deactivated — Trading can resume');
  persistAccountState();
}

export async function emergencyCloseAll(): Promise<{ closed: number; errors: number }> {
  let closed = 0;
  let errors = 0;
  
  addLog('error', `EMERGENCY CLOSE ALL — Closing ${positions.length} positions`);
  
  // Close all positions
  const positionIds = positions.map(p => p.id);
  for (const id of positionIds) {
    const result = await closePositionInternal(id, 'manual');
    if (result) {
      closed++;
    } else {
      errors++;
    }
  }
  
  // Cancel all pending orders
  const orderIds = pendingOrders.map(o => o.id);
  for (const id of orderIds) {
    cancelPendingOrder(id);
  }
  
  addLog('system', `Emergency close complete: ${closed} positions closed, ${orderIds.length} pending orders cancelled`);
  
  return { closed, errors };
}

// ─── State Restoration ──────────────────────────────────────────────

export async function restoreFromDb(userId: number): Promise<boolean> {
  try {
    const state = await restoreState(userId);
    if (!state) {
      addLog('system', 'No saved state found — starting fresh');
      return false;
    }

    balance = state.balance;
    peakBalance = state.peakBalance;
    positions = state.positions;
    pendingOrders = state.pendingOrders;
    tradeHistory = state.tradeHistory;
    scanCount = state.scanCount;
    signalCount = state.signalCount;
    rejectedCount = state.rejectedCount;
    dailyPnlBase = state.dailyPnlBase;
    dailyPnlDate = state.dailyPnlDate;
    executionMode = state.executionMode;
    killSwitchActive = state.killSwitchActive;
    // Always start stopped after restart
    isRunning = false;
    isPaused = false;
    startedAt = null;

    addLog('system', `State restored from DB: $${balance.toFixed(2)} balance, ${positions.length} positions, ${pendingOrders.length} pending orders, ${tradeHistory.length} history records`);
    
    return true;
  } catch (err) {
    console.error('[PaperTrading] Failed to restore state from DB:', err);
    addLog('error', 'Failed to restore state from DB — starting fresh');
    return false;
  }
}

export function getLog(): LogEntry[] {
  return logEntries.slice(-100);
}
