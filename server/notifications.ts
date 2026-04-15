/**
 * Trading Notifications — Wires bot events to the Manus notification system
 * 
 * Respects the NotificationSettings from BotConfig:
 * - notifyOnTrade: trade placements and closures (SL/TP hits)
 * - notifyOnSignal: high-confluence signal detections
 * - notifyOnError: engine errors and critical failures
 * - notifyDailySummary: end-of-day summary (placeholder for future cron)
 * 
 * All calls are fire-and-forget to avoid blocking trade execution.
 */

import { notifyOwner } from "./_core/notification";
import { getConfig } from "./botConfig";

// ─── Helpers ────────────────────────────────────────────────────────

function getNotificationConfig() {
  return getConfig().notifications;
}

function fireAndForget(title: string, content: string): void {
  notifyOwner({ title, content }).catch((err) => {
    console.warn('[Notifications] Failed to send:', err);
  });
}

// ─── Signal Notifications ───────────────────────────────────────────

export function notifySignalDetected(params: {
  symbol: string;
  direction: 'buy' | 'sell';
  confluenceScore: number;
  summary: string;
}): void {
  const config = getNotificationConfig();
  if (!config.notifyOnSignal) return;

  const emoji = params.direction === 'buy' ? '🟢' : '🔴';
  fireAndForget(
    `${emoji} Signal: ${params.direction.toUpperCase()} ${params.symbol}`,
    `Confluence: ${params.confluenceScore}/10\n${params.summary}`
  );
}

// ─── Trade Placement Notifications ──────────────────────────────────

export function notifyTradePlaced(params: {
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entryPrice: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  reason?: string;
  score?: number;
}): void {
  const config = getNotificationConfig();
  if (!config.notifyOnTrade) return;

  const emoji = params.direction === 'long' ? '📈' : '📉';
  const slStr = params.stopLoss ? `SL: ${params.stopLoss.toFixed(5)}` : 'No SL';
  const tpStr = params.takeProfit ? `TP: ${params.takeProfit.toFixed(5)}` : 'No TP';

  fireAndForget(
    `${emoji} Trade Opened: ${params.direction.toUpperCase()} ${params.symbol}`,
    [
      `Size: ${params.size} lots @ ${params.entryPrice.toFixed(5)}`,
      `${slStr} | ${tpStr}`,
      params.reason ? `Reason: ${params.reason}` : '',
      params.score ? `Score: ${params.score}/10` : '',
    ].filter(Boolean).join('\n')
  );
}

// ─── Trade Closure Notifications ────────────────────────────────────

export function notifyTradeClosed(params: {
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPips: number;
  closeReason: 'manual' | 'stop_loss' | 'take_profit';
}): void {
  const config = getNotificationConfig();
  if (!config.notifyOnTrade) return;

  const isWin = params.pnl >= 0;
  const emoji = params.closeReason === 'stop_loss' ? '🛑' 
    : params.closeReason === 'take_profit' ? '🎯' 
    : '✋';
  const pnlStr = isWin ? `+$${params.pnl.toFixed(2)}` : `-$${Math.abs(params.pnl).toFixed(2)}`;
  const reasonLabel = params.closeReason === 'stop_loss' ? 'Stop Loss Hit'
    : params.closeReason === 'take_profit' ? 'Take Profit Hit'
    : 'Manual Close';

  fireAndForget(
    `${emoji} Trade Closed: ${params.symbol} — ${pnlStr}`,
    [
      `${params.direction.toUpperCase()} ${params.size} lots`,
      `Entry: ${params.entryPrice.toFixed(5)} → Exit: ${params.exitPrice.toFixed(5)}`,
      `P&L: ${pnlStr} (${params.pnlPips.toFixed(1)} pips)`,
      `Reason: ${reasonLabel}`,
    ].join('\n')
  );
}

// ─── Error Notifications ────────────────────────────────────────────

export function notifyEngineError(params: {
  context: string;
  error: string;
}): void {
  const config = getNotificationConfig();
  if (!config.notifyOnError) return;

  fireAndForget(
    `⚠️ Bot Error: ${params.context}`,
    params.error
  );
}

// ─── Daily Summary (called externally, e.g., from a cron or end-of-day check) ──

export function notifyDailySummary(params: {
  balance: number;
  dailyPnl: number;
  tradesPlaced: number;
  wins: number;
  losses: number;
  winRate: number;
  maxDrawdown: number;
}): void {
  const config = getNotificationConfig();
  if (!config.notifyDailySummary) return;

  const pnlStr = params.dailyPnl >= 0 
    ? `+$${params.dailyPnl.toFixed(2)}` 
    : `-$${Math.abs(params.dailyPnl).toFixed(2)}`;

  fireAndForget(
    `📊 Daily Summary — ${pnlStr}`,
    [
      `Balance: $${params.balance.toFixed(2)}`,
      `Trades: ${params.tradesPlaced} (${params.wins}W / ${params.losses}L)`,
      `Win Rate: ${params.winRate.toFixed(1)}%`,
      `Max Drawdown: ${params.maxDrawdown.toFixed(1)}%`,
    ].join('\n')
  );
}
