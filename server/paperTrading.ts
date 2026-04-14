/**
 * Paper Trading Engine — In-memory simulated trading
 * 
 * Features:
 * - Place paper market orders with SL/TP
 * - Track open positions with live P&L (via Yahoo quotes)
 * - Close positions manually or auto-close on SL/TP hit
 * - Portfolio heat calculation
 * - Auto-log closed trades to the journal (trades table)
 * - Trade history tracking
 */

import { nanoid } from 'nanoid';
import { fetchQuoteFromYahoo } from './marketData';
import { createTrade } from './db';

// ─── Types ───────────────────────────────────────────────────────────

export interface PaperPosition {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  size: number;          // lot size (e.g., 0.01 = micro lot)
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openTime: string;      // ISO string
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
}

export interface PaperAccountState {
  balance: number;
  equity: number;
  unrealizedPnl: number;
  positions: PaperPosition[];
  tradeHistory: PaperTradeRecord[];
  isRunning: boolean;
  totalTrades: number;
  winRate: number;
}

// ─── Pip value helpers ───────────────────────────────────────────────

// Standard lot = 100,000 units for forex, 1 unit for gold, etc.
const INSTRUMENT_SPECS: Record<string, { pipSize: number; lotUnits: number }> = {
  'EUR/USD': { pipSize: 0.0001, lotUnits: 100000 },
  'GBP/USD': { pipSize: 0.0001, lotUnits: 100000 },
  'USD/JPY': { pipSize: 0.01, lotUnits: 100000 },
  'GBP/JPY': { pipSize: 0.01, lotUnits: 100000 },
  'AUD/USD': { pipSize: 0.0001, lotUnits: 100000 },
  'USD/CAD': { pipSize: 0.0001, lotUnits: 100000 },
  'EUR/GBP': { pipSize: 0.0001, lotUnits: 100000 },
  'NZD/USD': { pipSize: 0.0001, lotUnits: 100000 },
  'BTC/USD': { pipSize: 1, lotUnits: 1 },
  'ETH/USD': { pipSize: 0.01, lotUnits: 1 },
  'XAU/USD': { pipSize: 0.01, lotUnits: 100 },   // 1 lot = 100 oz
  'XAG/USD': { pipSize: 0.001, lotUnits: 5000 },  // 1 lot = 5000 oz
};

function calculatePnl(position: PaperPosition): { pnl: number; pnlPips: number } {
  const spec = INSTRUMENT_SPECS[position.symbol] || { pipSize: 0.0001, lotUnits: 100000 };
  const priceDiff = position.direction === 'long'
    ? position.currentPrice - position.entryPrice
    : position.entryPrice - position.currentPrice;
  
  const pnlPips = priceDiff / spec.pipSize;
  // P&L in USD: priceDiff * lotUnits * lotSize
  const pnl = priceDiff * spec.lotUnits * position.size;
  
  return { pnl, pnlPips };
}

// ─── Engine State ────────────────────────────────────────────────────

const INITIAL_BALANCE = 10000;

let balance = INITIAL_BALANCE;
let positions: PaperPosition[] = [];
let tradeHistory: PaperTradeRecord[] = [];
let isRunning = false;
let priceUpdateInterval: ReturnType<typeof setInterval> | null = null;
let ownerUserId: number | null = null;

// ─── Price Update Loop ──────────────────────────────────────────────

async function updatePrices() {
  if (positions.length === 0) return;
  
  // Get unique symbols
  const symbols = Array.from(new Set(positions.map(p => p.symbol)));
  
  for (const symbol of symbols) {
    try {
      const quote = await fetchQuoteFromYahoo(symbol);
      if (!quote || !quote.price) continue;
      
      // Update all positions for this symbol
      for (const pos of positions) {
        if (pos.symbol === symbol) {
          pos.currentPrice = quote.price;
          const { pnl } = calculatePnl(pos);
          pos.pnl = pnl;
        }
      }
    } catch (err) {
      // Silently skip failed quotes
    }
  }
  
  // Check SL/TP hits
  const toClose: { id: string; reason: 'stop_loss' | 'take_profit' }[] = [];
  
  for (const pos of positions) {
    if (pos.stopLoss !== null) {
      if (pos.direction === 'long' && pos.currentPrice <= pos.stopLoss) {
        toClose.push({ id: pos.id, reason: 'stop_loss' });
      } else if (pos.direction === 'short' && pos.currentPrice >= pos.stopLoss) {
        toClose.push({ id: pos.id, reason: 'stop_loss' });
      }
    }
    if (pos.takeProfit !== null) {
      if (pos.direction === 'long' && pos.currentPrice >= pos.takeProfit) {
        toClose.push({ id: pos.id, reason: 'take_profit' });
      } else if (pos.direction === 'short' && pos.currentPrice <= pos.takeProfit) {
        toClose.push({ id: pos.id, reason: 'take_profit' });
      }
    }
  }
  
  // Close triggered positions
  for (const { id, reason } of toClose) {
    await closePositionInternal(id, reason);
  }
}

// ─── Internal Close ──────────────────────────────────────────────────

async function closePositionInternal(positionId: string, reason: 'manual' | 'stop_loss' | 'take_profit'): Promise<PaperTradeRecord | null> {
  const idx = positions.findIndex(p => p.id === positionId);
  if (idx === -1) return null;
  
  const pos = positions[idx];
  const { pnl, pnlPips } = calculatePnl(pos);
  
  // Determine exit price
  let exitPrice = pos.currentPrice;
  if (reason === 'stop_loss' && pos.stopLoss !== null) {
    exitPrice = pos.stopLoss;
  } else if (reason === 'take_profit' && pos.takeProfit !== null) {
    exitPrice = pos.takeProfit;
  }
  
  // Recalculate with exact exit price
  const finalPriceDiff = pos.direction === 'long'
    ? exitPrice - pos.entryPrice
    : pos.entryPrice - exitPrice;
  const spec = INSTRUMENT_SPECS[pos.symbol] || { pipSize: 0.0001, lotUnits: 100000 };
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
  };
  
  // Update balance
  balance += finalPnl;
  
  // Remove from positions
  positions.splice(idx, 1);
  
  // Add to history
  tradeHistory.push(record);
  
  // Auto-log to journal (trades table) if we have a user ID
  if (ownerUserId) {
    try {
      // Calculate risk-reward if SL was set
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
        setupType: `Paper ${reason.replace('_', ' ')}`,
        notes: `Paper trade auto-logged. Close reason: ${reason}`,
        entryTime: new Date(pos.openTime),
        exitTime: new Date(),
      });
    } catch (err) {
      console.error('[PaperTrading] Failed to auto-log trade to journal:', err);
    }
  }
  
  return record;
}

// ─── Public API ──────────────────────────────────────────────────────

export function setOwnerUserId(userId: number) {
  ownerUserId = userId;
}

export function getStatus(): PaperAccountState {
  const unrealizedPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const closedTrades = tradeHistory.length;
  const wins = tradeHistory.filter(t => t.pnl > 0).length;
  
  return {
    balance,
    equity: balance + unrealizedPnl,
    unrealizedPnl,
    positions: [...positions],
    tradeHistory: tradeHistory.slice(-50),
    isRunning,
    totalTrades: closedTrades,
    winRate: closedTrades > 0 ? (wins / closedTrades) * 100 : 0,
  };
}

export async function placeOrder(params: {
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  stopLoss?: number;
  takeProfit?: number;
}): Promise<{ success: boolean; position?: PaperPosition; entryPrice?: number; error?: string }> {
  const { symbol, direction, size, stopLoss, takeProfit } = params;
  
  // Validate symbol
  if (!INSTRUMENT_SPECS[symbol]) {
    return { success: false, error: `Unsupported symbol: ${symbol}` };
  }
  
  // Validate size
  if (size <= 0 || size > 100) {
    return { success: false, error: 'Invalid position size' };
  }
  
  // Get current price
  try {
    const quote = await fetchQuoteFromYahoo(symbol);
    if (!quote || !quote.price) {
      return { success: false, error: 'Could not get current price' };
    }
    
    const entryPrice = quote.price;
    
    // Validate SL/TP logic
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
    };
    
    positions.push(position);
    
    return { success: true, position, entryPrice };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to place order' };
  }
}

export async function closePosition(positionId: string): Promise<{ success: boolean; pnl?: number; error?: string }> {
  // Update price first
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

export function startEngine() {
  if (isRunning) return;
  isRunning = true;
  
  // Update prices every 15 seconds
  priceUpdateInterval = setInterval(updatePrices, 15000);
  // Run immediately
  updatePrices();
}

export function pauseEngine() {
  isRunning = false;
  if (priceUpdateInterval) {
    clearInterval(priceUpdateInterval);
    priceUpdateInterval = null;
  }
}

export function stopEngine() {
  isRunning = false;
  if (priceUpdateInterval) {
    clearInterval(priceUpdateInterval);
    priceUpdateInterval = null;
  }
}

export function resetAccount() {
  stopEngine();
  balance = INITIAL_BALANCE;
  positions = [];
  tradeHistory = [];
}
