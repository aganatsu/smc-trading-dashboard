/**
 * Live Broker Execution Bridge
 * 
 * Routes paper trading orders to a real broker when execution mode is LIVE.
 * Supports OANDA and MetaApi brokers.
 * 
 * Safety features:
 * - Pre-trade validation against broker account balance
 * - Maximum position size limits
 * - Execution confirmation logging
 * - Automatic fallback to paper-only on broker errors
 * - All live trades are also tracked in the paper engine for unified P&L
 */

import { placeOandaMarketOrder, closeOandaTrade, getOandaAccountSummary, getOandaOpenTrades } from './brokers/oanda';
import { placeMetaApiMarketOrder, closeMetaApiPosition, getMetaApiAccountInfo } from './brokers/metaapi';
import { getBrokerConnectionsByUser, getBrokerConnectionById } from './db';
import { addLog } from './paperTrading';
import { notifyOwner } from './_core/notification';

// ─── Types ───────────────────────────────────────────────────────────

export interface LiveExecutionResult {
  success: boolean;
  brokerOrderId?: string;
  brokerTradeId?: string;
  fillPrice?: number;
  error?: string;
  broker?: string;
}

export interface BrokerConnectionInfo {
  id: number;
  brokerType: 'oanda' | 'metaapi';
  apiKey: string;
  accountId: string;
  isLive: boolean;
  displayName: string;
}

// ─── Configuration ──────────────────────────────────────────────────

// Maximum position size allowed for live execution (safety limit)
const MAX_LIVE_LOT_SIZE: Record<string, number> = {
  'EUR/USD': 5.0,
  'GBP/USD': 5.0,
  'USD/JPY': 5.0,
  'GBP/JPY': 3.0,
  'AUD/USD': 5.0,
  'USD/CAD': 5.0,
  'EUR/GBP': 5.0,
  'NZD/USD': 5.0,
  'BTC/USD': 0.5,
  'ETH/USD': 2.0,
  'XAU/USD': 1.0,
  'XAG/USD': 2.0,
};

const DEFAULT_MAX_LOT = 1.0;

// ─── Active Broker Connection ───────────────────────────────────────

let activeBrokerConnectionId: number | null = null;
let cachedConnection: BrokerConnectionInfo | null = null;

export function setActiveBrokerConnection(connectionId: number | null) {
  activeBrokerConnectionId = connectionId;
  cachedConnection = null; // Force refresh
  if (connectionId) {
    addLog('system', `Live broker connection set to ID: ${connectionId}`);
  } else {
    addLog('system', 'Live broker connection cleared');
  }
}

export function getActiveBrokerConnectionId(): number | null {
  return activeBrokerConnectionId;
}

async function getConnection(userId: number): Promise<BrokerConnectionInfo | null> {
  if (!activeBrokerConnectionId) {
    // Try to find the first active connection
    try {
      const connections = await getBrokerConnectionsByUser(userId);
      if (connections.length > 0) {
        const conn = connections[0];
        activeBrokerConnectionId = conn.id;
        cachedConnection = {
          id: conn.id,
          brokerType: conn.brokerType as 'oanda' | 'metaapi',
          apiKey: conn.apiKey,
          accountId: conn.accountId,
          isLive: conn.isLive,
          displayName: conn.displayName,
        };
        return cachedConnection;
      }
    } catch (err) {
      console.error('[LiveExecution] Failed to fetch broker connections:', err);
    }
    return null;
  }

  if (cachedConnection && cachedConnection.id === activeBrokerConnectionId) {
    return cachedConnection;
  }

  try {
    const conn = await getBrokerConnectionById(activeBrokerConnectionId, userId);
    if (!conn) return null;
    cachedConnection = {
      id: conn.id,
      brokerType: conn.brokerType as 'oanda' | 'metaapi',
      apiKey: conn.apiKey,
      accountId: conn.accountId,
      isLive: conn.isLive,
      displayName: conn.displayName,
    };
    return cachedConnection;
  } catch (err) {
    console.error('[LiveExecution] Failed to fetch broker connection:', err);
    return null;
  }
}

// ─── Pre-Trade Validation ───────────────────────────────────────────

async function validateLiveTrade(
  conn: BrokerConnectionInfo,
  symbol: string,
  size: number,
): Promise<{ valid: boolean; error?: string; accountBalance?: number }> {
  // Check max lot size
  const maxLot = MAX_LIVE_LOT_SIZE[symbol] || DEFAULT_MAX_LOT;
  if (size > maxLot) {
    return {
      valid: false,
      error: `Position size ${size} exceeds max live limit of ${maxLot} lots for ${symbol}`,
    };
  }

  // Check broker account balance
  try {
    if (conn.brokerType === 'oanda') {
      const summary = await getOandaAccountSummary({
        apiKey: conn.apiKey,
        accountId: conn.accountId,
        isLive: conn.isLive,
      });
      const marginAvailable = parseFloat(summary.marginAvailable || '0');
      if (marginAvailable < 100) {
        return {
          valid: false,
          error: `Insufficient margin on broker account (available: $${marginAvailable.toFixed(2)})`,
          accountBalance: parseFloat(summary.balance || '0'),
        };
      }
      return { valid: true, accountBalance: parseFloat(summary.balance || '0') };
    } else if (conn.brokerType === 'metaapi') {
      const info = await getMetaApiAccountInfo({
        token: conn.apiKey,
        accountId: conn.accountId,
      });
      const freeMargin = info.freeMargin || 0;
      if (freeMargin < 100) {
        return {
          valid: false,
          error: `Insufficient margin on broker account (available: $${freeMargin.toFixed(2)})`,
          accountBalance: info.balance || 0,
        };
      }
      return { valid: true, accountBalance: info.balance || 0 };
    }
  } catch (err: any) {
    return {
      valid: false,
      error: `Failed to validate broker account: ${err.message}`,
    };
  }

  return { valid: true };
}

// ─── Live Order Execution ───────────────────────────────────────────

export async function executeLiveOrder(
  userId: number,
  params: {
    symbol: string;
    direction: 'long' | 'short';
    size: number;
    stopLoss?: number;
    takeProfit?: number;
    signalReason?: string;
  },
): Promise<LiveExecutionResult> {
  const conn = await getConnection(userId);
  if (!conn) {
    addLog('error', 'LIVE EXECUTION FAILED: No broker connection configured');
    return { success: false, error: 'No broker connection configured. Add a broker in Settings.' };
  }

  addLog('trade', `[LIVE] Attempting ${params.direction.toUpperCase()} ${params.size} ${params.symbol} via ${conn.brokerType.toUpperCase()} (${conn.displayName})`);

  // Pre-trade validation
  const validation = await validateLiveTrade(conn, params.symbol, params.size);
  if (!validation.valid) {
    addLog('error', `[LIVE] Pre-trade validation failed: ${validation.error}`);
    return { success: false, error: validation.error };
  }

  try {
    if (conn.brokerType === 'oanda') {
      // OANDA uses units (positive = buy, negative = sell)
      // Standard lot = 100,000 units
      const units = params.direction === 'long'
        ? Math.round(params.size * 100000)
        : -Math.round(params.size * 100000);

      const result = await placeOandaMarketOrder(
        {
          apiKey: conn.apiKey,
          accountId: conn.accountId,
          isLive: conn.isLive,
        },
        {
          symbol: params.symbol,
          units,
          stopLoss: params.stopLoss?.toString(),
          takeProfit: params.takeProfit?.toString(),
        },
      );

      const fillTransaction = result.orderFillTransaction;
      const tradeId = fillTransaction?.tradeOpened?.tradeID || fillTransaction?.id;
      const fillPrice = parseFloat(fillTransaction?.price || '0');

      addLog('trade', `[LIVE] OANDA order filled: Trade #${tradeId} @ ${fillPrice}`);

      // Notify owner of live execution
      notifyOwner({
        title: `Live Trade Executed: ${params.symbol}`,
        content: `${params.direction.toUpperCase()} ${params.size} lots @ ${fillPrice}\nBroker: OANDA (${conn.displayName})\nReason: ${params.signalReason || 'Manual'}\nSL: ${params.stopLoss || 'None'} | TP: ${params.takeProfit || 'None'}`,
      });

      return {
        success: true,
        brokerOrderId: fillTransaction?.id,
        brokerTradeId: tradeId,
        fillPrice,
        broker: 'oanda',
      };
    } else if (conn.brokerType === 'metaapi') {
      const result = await placeMetaApiMarketOrder(
        {
          token: conn.apiKey,
          accountId: conn.accountId,
        },
        {
          symbol: params.symbol,
          direction: params.direction,
          volume: params.size,
          stopLoss: params.stopLoss,
          takeProfit: params.takeProfit,
        },
      );

      const positionId = result.positionId || result.orderId;

      addLog('trade', `[LIVE] MetaApi order filled: Position #${positionId}`);

      // Notify owner of live execution
      notifyOwner({
        title: `Live Trade Executed: ${params.symbol}`,
        content: `${params.direction.toUpperCase()} ${params.size} lots\nBroker: MetaApi (${conn.displayName})\nReason: ${params.signalReason || 'Manual'}\nSL: ${params.stopLoss || 'None'} | TP: ${params.takeProfit || 'None'}`,
      });

      return {
        success: true,
        brokerOrderId: result.orderId,
        brokerTradeId: positionId,
        broker: 'metaapi',
      };
    }

    return { success: false, error: `Unsupported broker type: ${conn.brokerType}` };
  } catch (err: any) {
    const errorMsg = err.response?.data?.errorMessage || err.message || 'Unknown broker error';
    addLog('error', `[LIVE] Broker execution failed: ${errorMsg}`);

    // Notify owner of failed execution
    notifyOwner({
      title: `Live Trade FAILED: ${params.symbol}`,
      content: `${params.direction.toUpperCase()} ${params.size} lots\nError: ${errorMsg}\nBroker: ${conn.brokerType.toUpperCase()} (${conn.displayName})`,
    });

    return { success: false, error: errorMsg };
  }
}

// ─── Live Position Close ────────────────────────────────────────────

export async function closeLivePosition(
  userId: number,
  brokerTradeId: string,
): Promise<{ success: boolean; error?: string }> {
  const conn = await getConnection(userId);
  if (!conn) {
    return { success: false, error: 'No broker connection configured' };
  }

  try {
    if (conn.brokerType === 'oanda') {
      await closeOandaTrade(
        {
          apiKey: conn.apiKey,
          accountId: conn.accountId,
          isLive: conn.isLive,
        },
        brokerTradeId,
      );
      addLog('trade', `[LIVE] OANDA trade #${brokerTradeId} closed`);
      return { success: true };
    } else if (conn.brokerType === 'metaapi') {
      await closeMetaApiPosition(
        {
          token: conn.apiKey,
          accountId: conn.accountId,
        },
        brokerTradeId,
      );
      addLog('trade', `[LIVE] MetaApi position #${brokerTradeId} closed`);
      return { success: true };
    }
    return { success: false, error: `Unsupported broker type: ${conn.brokerType}` };
  } catch (err: any) {
    const errorMsg = err.response?.data?.errorMessage || err.message || 'Unknown error';
    addLog('error', `[LIVE] Failed to close broker position: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

// ─── Get Broker Account Status ──────────────────────────────────────

export async function getLiveBrokerStatus(userId: number): Promise<{
  connected: boolean;
  broker?: string;
  accountId?: string;
  displayName?: string;
  isLive?: boolean;
  balance?: number;
  equity?: number;
  marginAvailable?: number;
  openPositions?: number;
  error?: string;
}> {
  const conn = await getConnection(userId);
  if (!conn) {
    return { connected: false };
  }

  try {
    if (conn.brokerType === 'oanda') {
      const summary = await getOandaAccountSummary({
        apiKey: conn.apiKey,
        accountId: conn.accountId,
        isLive: conn.isLive,
      });
      const trades = await getOandaOpenTrades({
        apiKey: conn.apiKey,
        accountId: conn.accountId,
        isLive: conn.isLive,
      });
      return {
        connected: true,
        broker: 'oanda',
        accountId: conn.accountId,
        displayName: conn.displayName,
        isLive: conn.isLive,
        balance: parseFloat(summary.balance || '0'),
        equity: parseFloat(summary.NAV || '0'),
        marginAvailable: parseFloat(summary.marginAvailable || '0'),
        openPositions: trades?.length || 0,
      };
    } else if (conn.brokerType === 'metaapi') {
      const info = await getMetaApiAccountInfo({
        token: conn.apiKey,
        accountId: conn.accountId,
      });
      return {
        connected: true,
        broker: 'metaapi',
        accountId: conn.accountId,
        displayName: conn.displayName,
        isLive: false, // MetaApi doesn't distinguish in the same way
        balance: info.balance || 0,
        equity: info.equity || 0,
        marginAvailable: info.freeMargin || 0,
        openPositions: info.openTradeCount || 0,
      };
    }
  } catch (err: any) {
    return {
      connected: true,
      broker: conn.brokerType,
      displayName: conn.displayName,
      error: err.message || 'Failed to fetch broker status',
    };
  }

  return { connected: false };
}
