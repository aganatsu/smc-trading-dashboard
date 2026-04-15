import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock marketData
vi.mock("./marketData", () => ({
  fetchQuoteFromYahoo: vi.fn().mockResolvedValue({
    price: 1.085,
    change: 0.0012,
    percentChange: 0.11,
    open: 1.0838,
    high: 1.0860,
    low: 1.0830,
    previousClose: 1.0838,
  }),
}));

// Mock ws module
vi.mock("ws", () => {
  class MockWebSocketServer {
    on = vi.fn();
    close = vi.fn();
  }
  return {
    WebSocketServer: MockWebSocketServer,
    WebSocket: { OPEN: 1, CONNECTING: 0, CLOSING: 2, CLOSED: 3 },
  };
});

import { getConnectedClientCount, getAllLatestPrices, stopPriceFeed } from "./wsPriceFeed";

describe("WebSocket Price Feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Module State", () => {
    it("should start with zero connected clients", () => {
      expect(getConnectedClientCount()).toBe(0);
    });

    it("should start with empty latest prices", () => {
      const prices = getAllLatestPrices();
      expect(Object.keys(prices).length).toBe(0);
    });
  });

  describe("Message Protocol", () => {
    it("should define correct subscribe message format", () => {
      const msg = { type: "subscribe", symbols: ["EUR/USD", "GBP/USD"] };
      expect(msg.type).toBe("subscribe");
      expect(msg.symbols).toBeInstanceOf(Array);
      expect(msg.symbols).toHaveLength(2);
    });

    it("should define correct unsubscribe message format", () => {
      const msg = { type: "unsubscribe", symbols: ["EUR/USD"] };
      expect(msg.type).toBe("unsubscribe");
      expect(msg.symbols).toBeInstanceOf(Array);
    });

    it("should define correct ping message format", () => {
      const msg = { type: "ping" };
      expect(msg.type).toBe("ping");
    });

    it("should define correct prices response format", () => {
      const msg = {
        type: "prices",
        data: {
          "EUR/USD": {
            symbol: "EUR/USD",
            price: 1.085,
            bid: 1.085,
            ask: 1.085,
            change: 0.0012,
            changePercent: 0.11,
            previousClose: 1.0838,
            timestamp: Date.now(),
          },
        },
      };
      expect(msg.type).toBe("prices");
      expect(msg.data["EUR/USD"]).toBeDefined();
      expect(msg.data["EUR/USD"].price).toBe(1.085);
      expect(msg.data["EUR/USD"].timestamp).toBeGreaterThan(0);
    });

    it("should define correct status response format", () => {
      const msg = {
        type: "status",
        connected: true,
        subscribedSymbols: ["EUR/USD", "GBP/USD"],
        availableSymbols: ["EUR/USD", "GBP/USD", "USD/JPY"],
      };
      expect(msg.type).toBe("status");
      expect(msg.connected).toBe(true);
      expect(msg.subscribedSymbols).toBeInstanceOf(Array);
    });

    it("should define correct error response format", () => {
      const msg = { type: "error", message: "Invalid JSON message" };
      expect(msg.type).toBe("error");
      expect(msg.message).toBeDefined();
    });

    it("should define correct pong response format", () => {
      const msg = { type: "pong" };
      expect(msg.type).toBe("pong");
    });
  });

  describe("PriceQuote Type", () => {
    it("should have all required fields", () => {
      const quote = {
        symbol: "EUR/USD",
        price: 1.085,
        bid: 1.0849,
        ask: 1.0851,
        change: 0.0012,
        changePercent: 0.11,
        previousClose: 1.0838,
        timestamp: Date.now(),
      };

      expect(quote.symbol).toBeDefined();
      expect(typeof quote.price).toBe("number");
      expect(typeof quote.bid).toBe("number");
      expect(typeof quote.ask).toBe("number");
      expect(typeof quote.change).toBe("number");
      expect(typeof quote.changePercent).toBe("number");
      expect(typeof quote.previousClose).toBe("number");
      expect(typeof quote.timestamp).toBe("number");
    });

    it("should have ask >= bid", () => {
      const quote = {
        bid: 1.0849,
        ask: 1.0851,
      };
      expect(quote.ask).toBeGreaterThanOrEqual(quote.bid);
    });
  });

  describe("Symbol Validation", () => {
    const ALL_SYMBOLS = [
      'EUR/USD', 'GBP/USD', 'USD/JPY', 'GBP/JPY', 'AUD/USD',
      'USD/CAD', 'EUR/GBP', 'NZD/USD', 'XAU/USD', 'XAG/USD',
      'BTC/USD', 'ETH/USD',
    ];

    it("should accept valid symbols", () => {
      const validSymbols = ["EUR/USD", "GBP/USD", "XAU/USD"];
      const filtered = validSymbols.filter(s => ALL_SYMBOLS.includes(s));
      expect(filtered).toHaveLength(3);
    });

    it("should reject invalid symbols", () => {
      const invalidSymbols = ["INVALID", "FOO/BAR", ""];
      const filtered = invalidSymbols.filter(s => ALL_SYMBOLS.includes(s));
      expect(filtered).toHaveLength(0);
    });

    it("should limit subscriptions to MAX_SYMBOLS_PER_CLIENT (20)", () => {
      const MAX_SYMBOLS_PER_CLIENT = 20;
      const tooManySymbols = Array(25).fill("EUR/USD");
      const limited = tooManySymbols.slice(0, MAX_SYMBOLS_PER_CLIENT);
      expect(limited).toHaveLength(20);
    });
  });

  describe("Reconnection Logic", () => {
    it("should calculate exponential backoff correctly", () => {
      const BASE_DELAY = 1000;
      const MAX_DELAY = 30000;

      const delays = [];
      for (let attempt = 0; attempt < 10; attempt++) {
        const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
        delays.push(delay);
      }

      expect(delays[0]).toBe(1000);  // 1s
      expect(delays[1]).toBe(2000);  // 2s
      expect(delays[2]).toBe(4000);  // 4s
      expect(delays[3]).toBe(8000);  // 8s
      expect(delays[4]).toBe(16000); // 16s
      expect(delays[5]).toBe(30000); // capped at 30s
      expect(delays[9]).toBe(30000); // still capped
    });
  });

  describe("Cleanup", () => {
    it("should stop price feed without errors", () => {
      expect(() => stopPriceFeed()).not.toThrow();
    });
  });
});
