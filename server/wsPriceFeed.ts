/**
 * WebSocket Real-Time Price Feed
 * 
 * Streams live price quotes to all connected clients via WebSocket.
 * Server polls Yahoo Finance at a configurable interval and broadcasts
 * price updates to all subscribed clients.
 * 
 * Protocol:
 * - Client → Server: { type: "subscribe", symbols: ["EUR/USD", ...] }
 * - Client → Server: { type: "unsubscribe", symbols: ["EUR/USD", ...] }
 * - Client → Server: { type: "ping" }
 * - Server → Client: { type: "prices", data: { "EUR/USD": { price, bid, ask, change, changePercent, timestamp }, ... } }
 * - Server → Client: { type: "pong" }
 * - Server → Client: { type: "status", connected: true, subscribedSymbols: [...] }
 * - Server → Client: { type: "error", message: "..." }
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { fetchQuoteFromYahoo } from './marketData';

// ─── Types ───────────────────────────────────────────────────────────

export interface PriceQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  previousClose: number;
  timestamp: number;
}

interface ClientState {
  ws: WebSocket;
  subscribedSymbols: Set<string>;
  lastActivity: number;
}

// ─── Configuration ──────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL_MS = 5000; // 5 seconds
const CLIENT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity
const MAX_SYMBOLS_PER_CLIENT = 20;
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

// All supported symbols
const ALL_SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'GBP/JPY', 'AUD/USD',
  'USD/CAD', 'EUR/GBP', 'NZD/USD', 'XAU/USD', 'XAG/USD',
  'BTC/USD', 'ETH/USD',
];

// ─── State ──────────────────────────────────────────────────────────

const clients = new Map<WebSocket, ClientState>();
const latestPrices = new Map<string, PriceQuote>();
let pollInterval: ReturnType<typeof setInterval> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let wss: WebSocketServer | null = null;

// ─── Price Polling ──────────────────────────────────────────────────

function getActiveSymbols(): string[] {
  const symbols = new Set<string>();
  Array.from(clients.values()).forEach(client => {
    client.subscribedSymbols.forEach(sym => symbols.add(sym));
  });
  return Array.from(symbols);
}

async function pollPrices() {
  const symbols = getActiveSymbols();
  if (symbols.length === 0) return;

  const updates: Record<string, PriceQuote> = {};

  // Fetch prices in parallel (batched to avoid overwhelming Yahoo)
  const batchSize = 4;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (symbol) => {
        try {
          const quote = await fetchQuoteFromYahoo(symbol);
          if (!quote || !quote.price) return null;

          const priceQuote: PriceQuote = {
            symbol,
            price: quote.price,
            bid: quote.price, // Yahoo doesn't provide bid/ask for forex
            ask: quote.price,
            change: quote.change ?? 0,
            changePercent: quote.percentChange ?? 0,
            previousClose: quote.previousClose ?? quote.price,
            timestamp: Date.now(),
          };

          latestPrices.set(symbol, priceQuote);
          updates[symbol] = priceQuote;
          return priceQuote;
        } catch {
          return null;
        }
      })
    );
  }

  // Broadcast updates to subscribed clients
  if (Object.keys(updates).length > 0) {
    broadcastPrices(updates);
  }
}

function broadcastPrices(updates: Record<string, PriceQuote>) {
  const message = JSON.stringify({ type: 'prices', data: updates });

  Array.from(clients.entries()).forEach(([ws, client]) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Filter to only symbols this client cares about
    const clientUpdates: Record<string, PriceQuote> = {};
    for (const [symbol, quote] of Object.entries(updates)) {
      if (client.subscribedSymbols.has(symbol)) {
        clientUpdates[symbol] = quote;
      }
    }

    if (Object.keys(clientUpdates).length > 0) {
      try {
        ws.send(JSON.stringify({ type: 'prices', data: clientUpdates }));
      } catch {
        // Client disconnected, will be cleaned up
      }
    }
  });
}

// ─── Client Message Handling ────────────────────────────────────────

function handleMessage(ws: WebSocket, data: string) {
  const client = clients.get(ws);
  if (!client) return;

  client.lastActivity = Date.now();

  try {
    const msg = JSON.parse(data);

    switch (msg.type) {
      case 'subscribe': {
        const symbols = Array.isArray(msg.symbols) ? msg.symbols : [];
        const validSymbols = symbols
          .filter((s: string) => ALL_SYMBOLS.includes(s))
          .slice(0, MAX_SYMBOLS_PER_CLIENT);

        for (const sym of validSymbols) {
          client.subscribedSymbols.add(sym);
        }

        // Send current cached prices immediately
        const cached: Record<string, PriceQuote> = {};
        for (const sym of validSymbols) {
          const price = latestPrices.get(sym);
          if (price) cached[sym] = price;
        }
        if (Object.keys(cached).length > 0) {
          ws.send(JSON.stringify({ type: 'prices', data: cached }));
        }

        ws.send(JSON.stringify({
          type: 'status',
          connected: true,
          subscribedSymbols: Array.from(client.subscribedSymbols),
        }));
        break;
      }

      case 'unsubscribe': {
        const symbols = Array.isArray(msg.symbols) ? msg.symbols : [];
        for (const sym of symbols) {
          client.subscribedSymbols.delete(sym);
        }
        ws.send(JSON.stringify({
          type: 'status',
          connected: true,
          subscribedSymbols: Array.from(client.subscribedSymbols),
        }));
        break;
      }

      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      }

      default: {
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
      }
    }
  } catch {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message' }));
  }
}

// ─── Heartbeat & Cleanup ────────────────────────────────────────────

function cleanupStaleClients() {
  const now = Date.now();
  Array.from(clients.entries()).forEach(([ws, client]) => {
    if (now - client.lastActivity > CLIENT_TIMEOUT_MS) {
      console.log('[WS] Closing stale client connection');
      ws.close(1000, 'Inactivity timeout');
      clients.delete(ws);
    }
  });
}

// ─── Public API ─────────────────────────────────────────────────────

export function initWebSocketServer(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({
    server,
    path: '/ws/prices',
  });

  wss.on('connection', (ws) => {
    console.log(`[WS] Client connected (total: ${clients.size + 1})`);

    const clientState: ClientState = {
      ws,
      subscribedSymbols: new Set(),
      lastActivity: Date.now(),
    };
    clients.set(ws, clientState);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'status',
      connected: true,
      subscribedSymbols: [],
      availableSymbols: ALL_SYMBOLS,
    }));

    ws.on('message', (data) => {
      handleMessage(ws, data.toString());
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (total: ${clients.size})`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      clients.delete(ws);
    });
  });

  // Start price polling
  if (!pollInterval) {
    pollInterval = setInterval(pollPrices, DEFAULT_POLL_INTERVAL_MS);
    console.log(`[WS] Price feed started (${DEFAULT_POLL_INTERVAL_MS / 1000}s interval)`);
  }

  // Start heartbeat/cleanup
  if (!heartbeatInterval) {
    heartbeatInterval = setInterval(cleanupStaleClients, HEARTBEAT_INTERVAL_MS);
  }

  console.log('[WS] WebSocket server initialized on /ws/prices');
  return wss;
}

export function getConnectedClientCount(): number {
  return clients.size;
}

export function getLatestPrice(symbol: string): PriceQuote | undefined {
  return latestPrices.get(symbol);
}

export function getAllLatestPrices(): Record<string, PriceQuote> {
  const result: Record<string, PriceQuote> = {};
  Array.from(latestPrices.entries()).forEach(([symbol, quote]) => {
    result[symbol] = quote;
  });
  return result;
}

export function stopPriceFeed() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (wss) {
    wss.close();
    wss = null;
  }
  clients.clear();
  console.log('[WS] Price feed stopped');
}
