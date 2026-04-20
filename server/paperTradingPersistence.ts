/**
 * Paper Trading Persistence Layer
 * 
 * Wraps the in-memory paper trading engine with DB persistence.
 * Saves state after every mutation (trade, close, balance change).
 * Restores state from DB on server startup.
 */

import {
  getPaperAccount,
  upsertPaperAccount,
  getPaperPositions,
  getPaperPendingOrders,
  insertPaperPosition,
  deletePaperPosition,
  deleteAllPaperPositions,
  insertPaperTradeHistory,
  getPaperTradeHistory,
  deleteAllPaperTradeHistory,
} from './db';

import type { PaperPosition, PaperTradeRecord, PendingOrder, PaperAccountState } from './paperTrading';

// ─── Debounced account save ─────────────────────────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingAccountSave: { userId: number; data: any } | null = null;

function debouncedAccountSave(userId: number, data: any) {
  _pendingAccountSave = { userId, data };
  if (_saveTimer) return; // already scheduled
  _saveTimer = setTimeout(async () => {
    _saveTimer = null;
    if (_pendingAccountSave) {
      try {
        await upsertPaperAccount(_pendingAccountSave.userId, _pendingAccountSave.data);
      } catch (err) {
        console.error('[PaperPersistence] Failed to save account state:', err);
      }
      _pendingAccountSave = null;
    }
  }, 1000); // save at most once per second
}

// ─── Save Functions ─────────────────────────────────────────────────

export async function saveAccountState(
  userId: number,
  state: {
    balance: number;
    peakBalance: number;
    isRunning: boolean;
    isPaused: boolean;
    startedAt: Date | null;
    scanCount: number;
    signalCount: number;
    rejectedCount: number;
    dailyPnlBase: number;
    dailyPnlDate: string;
    executionMode?: 'paper' | 'live';
    killSwitchActive?: boolean;
  }
) {
  debouncedAccountSave(userId, {
    balance: state.balance.toFixed(2),
    peakBalance: state.peakBalance.toFixed(2),
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    startedAt: state.startedAt,
    scanCount: state.scanCount,
    signalCount: state.signalCount,
    rejectedCount: state.rejectedCount,
    dailyPnlBase: state.dailyPnlBase.toFixed(2),
    dailyPnlDate: state.dailyPnlDate,
    executionMode: state.executionMode ?? 'paper',
    killSwitchActive: state.killSwitchActive ?? false,
  });
}

export async function savePosition(userId: number, pos: PaperPosition) {
  try {
    await insertPaperPosition({
      userId,
      positionId: pos.id,
      symbol: pos.symbol,
      direction: pos.direction,
      size: pos.size.toString(),
      entryPrice: pos.entryPrice.toString(),
      currentPrice: pos.currentPrice.toString(),
      stopLoss: pos.stopLoss?.toString() ?? null,
      takeProfit: pos.takeProfit?.toString() ?? null,
      openTime: pos.openTime,
      signalReason: pos.signalReason,
      signalScore: pos.signalScore.toString(),
      orderId: pos.orderId,
      brokerTradeId: pos.brokerTradeId ?? null,
      status: 'open',
    });
  } catch (err) {
    console.error('[PaperPersistence] Failed to save position:', err);
  }
}

export async function savePendingOrder(userId: number, order: PendingOrder) {
  try {
    await insertPaperPosition({
      userId,
      positionId: order.id,
      symbol: order.symbol,
      direction: order.direction,
      size: order.size.toString(),
      entryPrice: order.triggerPrice.toString(),
      currentPrice: order.triggerPrice.toString(),
      stopLoss: order.stopLoss?.toString() ?? null,
      takeProfit: order.takeProfit?.toString() ?? null,
      openTime: order.createdAt,
      signalReason: order.signalReason,
      signalScore: order.signalScore.toString(),
      orderId: order.id,
      status: 'pending',
      triggerPrice: order.triggerPrice.toString(),
      orderType: order.orderType,
    });
  } catch (err) {
    console.error('[PaperPersistence] Failed to save pending order:', err);
  }
}

export async function removePosition(userId: number, positionId: string) {
  try {
    await deletePaperPosition(userId, positionId);
  } catch (err) {
    console.error('[PaperPersistence] Failed to remove position:', err);
  }
}

export async function saveTradeRecord(userId: number, record: PaperTradeRecord) {
  try {
    await insertPaperTradeHistory({
      userId,
      positionId: record.id,
      symbol: record.symbol,
      direction: record.direction,
      size: record.size.toString(),
      entryPrice: record.entryPrice.toString(),
      exitPrice: record.exitPrice.toString(),
      pnl: record.pnl.toFixed(2),
      pnlPips: record.pnlPips.toFixed(2),
      openTime: record.openTime,
      closedAt: record.closedAt,
      closeReason: record.closeReason,
      signalReason: record.signalReason,
      signalScore: record.signalScore.toString(),
      orderId: record.orderId,
    });
  } catch (err) {
    console.error('[PaperPersistence] Failed to save trade record:', err);
  }
}

// ─── Restore Functions ──────────────────────────────────────────────

export interface RestoredState {
  balance: number;
  peakBalance: number;
  isRunning: boolean;
  isPaused: boolean;
  startedAt: Date | null;
  scanCount: number;
  signalCount: number;
  rejectedCount: number;
  dailyPnlBase: number;
  dailyPnlDate: string;
  executionMode: 'paper' | 'live';
  killSwitchActive: boolean;
  positions: PaperPosition[];
  pendingOrders: PendingOrder[];
  tradeHistory: PaperTradeRecord[];
}

export async function restoreState(userId: number): Promise<RestoredState | null> {
  try {
    const account = await getPaperAccount(userId);
    if (!account) return null;

    const dbPositions = await getPaperPositions(userId);
    const dbPending = await getPaperPendingOrders(userId);
    const dbHistory = await getPaperTradeHistory(userId, 100);

    const positions: PaperPosition[] = dbPositions.map(row => ({
      id: row.positionId,
      symbol: row.symbol,
      direction: row.direction as 'long' | 'short',
      size: parseFloat(row.size),
      entryPrice: parseFloat(row.entryPrice),
      currentPrice: parseFloat(row.currentPrice),
      pnl: 0, // will be recalculated on next price update
      stopLoss: row.stopLoss ? parseFloat(row.stopLoss) : null,
      takeProfit: row.takeProfit ? parseFloat(row.takeProfit) : null,
      openTime: row.openTime,
      signalReason: row.signalReason || '',
      signalScore: parseFloat(row.signalScore),
      orderId: row.orderId,
      brokerTradeId: row.brokerTradeId ?? undefined,
    }));

    const pendingOrders: PendingOrder[] = dbPending.map(row => ({
      id: row.positionId,
      symbol: row.symbol,
      direction: row.direction as 'long' | 'short',
      size: parseFloat(row.size),
      triggerPrice: row.triggerPrice ? parseFloat(row.triggerPrice) : parseFloat(row.entryPrice),
      stopLoss: row.stopLoss ? parseFloat(row.stopLoss) : null,
      takeProfit: row.takeProfit ? parseFloat(row.takeProfit) : null,
      signalReason: row.signalReason || '',
      signalScore: parseFloat(row.signalScore),
      createdAt: row.openTime,
      orderType: (row.orderType as PendingOrder['orderType']) || 'buy_limit',
    }));

    const tradeHistory: PaperTradeRecord[] = dbHistory.map(row => ({
      id: row.positionId,
      symbol: row.symbol,
      direction: row.direction as 'long' | 'short',
      size: parseFloat(row.size),
      entryPrice: parseFloat(row.entryPrice),
      exitPrice: parseFloat(row.exitPrice),
      pnl: parseFloat(row.pnl),
      pnlPips: parseFloat(row.pnlPips),
      openTime: row.openTime,
      closedAt: row.closedAt,
      closeReason: row.closeReason as PaperTradeRecord['closeReason'],
      signalReason: row.signalReason || '',
      signalScore: parseFloat(row.signalScore),
      orderId: row.orderId,
    }));

    return {
      balance: parseFloat(account.balance),
      peakBalance: parseFloat(account.peakBalance),
      isRunning: false, // always start stopped after restart — user must manually restart
      isPaused: false,
      startedAt: null,
      scanCount: account.scanCount,
      signalCount: account.signalCount,
      rejectedCount: account.rejectedCount,
      dailyPnlBase: parseFloat(account.dailyPnlBase),
      dailyPnlDate: account.dailyPnlDate,
      executionMode: (account.executionMode as 'paper' | 'live') || 'paper',
      killSwitchActive: Boolean(account.killSwitchActive),
      positions,
      pendingOrders,
      tradeHistory,
    };
  } catch (err) {
    console.error('[PaperPersistence] Failed to restore state:', err);
    return null;
  }
}

export async function clearAllState(userId: number) {
  try {
    await deleteAllPaperPositions(userId);
    await deleteAllPaperTradeHistory(userId);
    await upsertPaperAccount(userId, {
      balance: "10000.00",
      peakBalance: "10000.00",
      isRunning: false,
      isPaused: false,
      startedAt: null,
      scanCount: 0,
      signalCount: 0,
      rejectedCount: 0,
      dailyPnlBase: "10000.00",
      dailyPnlDate: "",
      killSwitchActive: false,
    });
  } catch (err) {
    console.error('[PaperPersistence] Failed to clear state:', err);
  }
}
