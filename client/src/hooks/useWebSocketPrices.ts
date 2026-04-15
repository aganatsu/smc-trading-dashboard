/**
 * useWebSocketPrices — React hook for real-time price updates via WebSocket
 * 
 * Usage:
 *   const { prices, connected, reconnecting } = useWebSocketPrices(['EUR/USD', 'GBP/USD']);
 *   // prices['EUR/USD'] = { price: 1.0850, change: 0.0012, changePercent: 0.11, timestamp: ... }
 */

import { useState, useEffect, useRef, useCallback } from 'react';

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

export type PriceMap = Record<string, PriceQuote>;

interface WebSocketState {
  prices: PriceMap;
  connected: boolean;
  reconnecting: boolean;
  clientCount?: number;
}

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const PING_INTERVAL = 25000;

export function useWebSocketPrices(symbols: string[]): WebSocketState {
  const [prices, setPrices] = useState<PriceMap>({});
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const symbolsRef = useRef(symbols);

  // Keep symbols ref up to date
  symbolsRef.current = symbols;

  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/prices`;
  }, []);

  const cleanup = useCallback(() => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();

    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to price feed');
      setConnected(true);
      setReconnecting(false);
      reconnectAttempts.current = 0;

      // Subscribe to symbols
      if (symbolsRef.current.length > 0) {
        ws.send(JSON.stringify({ type: 'subscribe', symbols: symbolsRef.current }));
      }

      // Start ping interval
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'prices') {
          setPrices(prev => ({ ...prev, ...msg.data }));
        }
        // status and pong messages are informational, no action needed
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = (event) => {
      console.log(`[WS] Disconnected (code: ${event.code})`);
      setConnected(false);

      if (pingTimer.current) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }

      // Auto-reconnect with exponential backoff
      if (event.code !== 1000) { // 1000 = normal close
        setReconnecting(true);
        const delay = Math.min(
          RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts.current),
          RECONNECT_MAX_DELAY
        );
        reconnectAttempts.current++;
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      // Error event is always followed by close event
      console.error('[WS] Connection error');
    };
  }, [cleanup, getWsUrl]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  // Re-subscribe when symbols change
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && symbols.length > 0) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', symbols }));
    }
  }, [symbols.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return { prices, connected, reconnecting };
}

/**
 * Singleton-style hook that shares a single WebSocket connection
 * across all components. Uses a global price store.
 */
const globalPrices: PriceMap = {};
const globalListeners = new Set<(prices: PriceMap) => void>();
let globalWs: WebSocket | null = null;
let globalConnected = false;
let globalReconnecting = false;
let globalSubscribedSymbols = new Set<string>();
let globalReconnectAttempts = 0;
let globalReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let globalPingTimer: ReturnType<typeof setInterval> | null = null;

function notifyListeners() {
  const snapshot = { ...globalPrices };
  globalListeners.forEach(fn => fn(snapshot));
}

function globalConnect() {
  if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}/ws/prices`;
  const ws = new WebSocket(url);
  globalWs = ws;

  ws.onopen = () => {
    globalConnected = true;
    globalReconnecting = false;
    globalReconnectAttempts = 0;

    // Re-subscribe to all symbols
    if (globalSubscribedSymbols.size > 0) {
      ws.send(JSON.stringify({ type: 'subscribe', symbols: Array.from(globalSubscribedSymbols) }));
    }

    globalPingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_INTERVAL);

    notifyListeners();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'prices') {
        Object.assign(globalPrices, msg.data);
        notifyListeners();
      }
    } catch { /* ignore */ }
  };

  ws.onclose = (event) => {
    globalConnected = false;
    if (globalPingTimer) { clearInterval(globalPingTimer); globalPingTimer = null; }

    if (event.code !== 1000) {
      globalReconnecting = true;
      const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, globalReconnectAttempts), RECONNECT_MAX_DELAY);
      globalReconnectAttempts++;
      globalReconnectTimer = setTimeout(globalConnect, delay);
    }
    notifyListeners();
  };

  ws.onerror = () => { /* close event follows */ };
}

export function useGlobalPriceFeed(symbols: string[]): WebSocketState {
  const [state, setState] = useState<WebSocketState>({
    prices: { ...globalPrices },
    connected: globalConnected,
    reconnecting: globalReconnecting,
  });

  useEffect(() => {
    // Add symbols to global subscription
    let newSymbols = false;
    for (const sym of symbols) {
      if (!globalSubscribedSymbols.has(sym)) {
        globalSubscribedSymbols.add(sym);
        newSymbols = true;
      }
    }

    // Connect if not already
    globalConnect();

    // Subscribe new symbols
    if (newSymbols && globalWs?.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify({ type: 'subscribe', symbols }));
    }

    // Listen for updates
    const listener = (prices: PriceMap) => {
      setState({
        prices,
        connected: globalConnected,
        reconnecting: globalReconnecting,
      });
    };
    globalListeners.add(listener);

    return () => {
      globalListeners.delete(listener);
      // Don't disconnect — other components may still be using it
    };
  }, [symbols.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
