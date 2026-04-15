/**
 * Tests for the Autonomous Bot Engine
 * 
 * Covers:
 * - Engine state management (start, stop, auto-trading toggle)
 * - tRPC route integration (engine.state, engine.start, engine.stop, engine.scanResults, etc.)
 * - Trade reasoning generation
 * - Post-mortem generation
 * - Scan result structure
 * - Timeframe mapping
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { resetConfig, updateConfig } from "./botConfig";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Mock the db module
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  createTrade: vi.fn(async () => 1),
  getTradesByUser: vi.fn(async () => []),
  getTradeById: vi.fn(async () => null),
  updateTrade: vi.fn(),
  deleteTrade: vi.fn(),
  getTradeStats: vi.fn(async () => ({
    totalTrades: 0, wins: 0, losses: 0, breakeven: 0,
    winRate: 0, totalPnl: 0, totalPips: 0, avgRR: 0, strategyAdherence: 0,
  })),
  createBrokerConnection: vi.fn(),
  getBrokerConnectionsByUser: vi.fn(async () => []),
  getBrokerConnectionById: vi.fn(),
  updateBrokerConnection: vi.fn(),
  deleteBrokerConnection: vi.fn(),
  getClosedTradesForEquityCurve: vi.fn(async () => []),
  getBotConfig: vi.fn(async () => null),
  upsertBotConfig: vi.fn(),
  insertTradeReasoning: vi.fn(),
  insertTradePostMortem: vi.fn(),
  getTradeReasoningByPositionId: vi.fn(async () => null),
  getTradeReasoningByTradeId: vi.fn(async () => null),
  getRecentTradeReasonings: vi.fn(async () => []),
  getTradePostMortemByPositionId: vi.fn(async () => null),
  getTradePostMortemByTradeId: vi.fn(async () => null),
  getRecentTradePostMortems: vi.fn(async () => []),
  getUserSettings: vi.fn(async () => undefined),
  upsertUserSettings: vi.fn(),
  updateTradeReasoningJson: vi.fn(),
  updateTradePostMortemJson: vi.fn(),
}));

// Mock the marketData module with realistic candle data
vi.mock("./marketData", () => ({
  fetchQuoteFromYahoo: vi.fn(async (symbol: string) => {
    const prices: Record<string, number> = {
      "EUR/USD": 1.085, "GBP/USD": 1.25, "USD/JPY": 150.5,
      "XAU/USD": 2350.0, "BTC/USD": 65000.0,
    };
    const price = prices[symbol];
    if (!price) throw new Error(`Unknown symbol: ${symbol}`);
    return {
      price, change: 0, percentChange: 0,
      open: price, high: price + 0.001, low: price - 0.001,
      previousClose: price - 0.0005,
    };
  }),
  fetchCandlesFromYahoo: vi.fn(async (symbol: string, interval: string, count: number) => {
    // Generate realistic candle data for testing
    const basePrice = symbol === "EUR/USD" ? 1.085 :
      symbol === "GBP/USD" ? 1.25 :
      symbol === "XAU/USD" ? 2350.0 : 1.0;
    
    const candles = [];
    for (let i = 0; i < Math.min(count, 200); i++) {
      const variation = (Math.sin(i * 0.3) * 0.005 + Math.cos(i * 0.1) * 0.003) * basePrice;
      const open = basePrice + variation;
      const close = open + (Math.random() - 0.5) * 0.002 * basePrice;
      const high = Math.max(open, close) + Math.random() * 0.001 * basePrice;
      const low = Math.min(open, close) - Math.random() * 0.001 * basePrice;
      
      candles.push({
        datetime: new Date(Date.now() - (count - i) * 3600000).toISOString(),
        open, high, low, close,
        volume: Math.floor(Math.random() * 10000),
      });
    }
    return candles;
  }),
}));

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId, openId: `test-user-${userId}`,
    email: "test@example.com", name: "Test User",
    loginMethod: "manus", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("Autonomous Bot Engine", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(async () => {
    // Reset paper trading engine
    const { resetAccount, setOwnerUserId, stopEngine: stopPaper } = await import("./paperTrading");
    stopPaper();
    resetAccount();
    setOwnerUserId(1);

    // Reset bot engine
    const { stopEngine: stopBot } = await import("./botEngine");
    stopBot();

    // Reset bot config and relax validation for tests
    resetConfig();
    updateConfig({
      strategy: { minConfluenceScore: 0 } as any,
      risk: { minRiskReward: 0 } as any,
    });

    caller = appRouter.createCaller(createAuthContext());
  });

  afterEach(async () => {
    const { stopEngine: stopBot } = await import("./botEngine");
    stopBot();
    const { stopEngine: stopPaper } = await import("./paperTrading");
    stopPaper();
  });

  // ─── Engine State ──────────────────────────────────────────────────

  describe("engine.state", () => {
    it("returns initial engine state (not running)", async () => {
      const state = await caller.engine.state();
      expect(state.running).toBe(false);
      expect(state.autoTrading).toBe(false);
      expect(state.totalScans).toBe(0);
      expect(state.totalSignals).toBe(0);
      expect(state.totalTradesPlaced).toBe(0);
      expect(state.totalRejected).toBe(0);
    });

    it("is accessible as a public procedure", async () => {
      const unauthCaller = appRouter.createCaller(createUnauthContext());
      const state = await unauthCaller.engine.state();
      expect(state).toHaveProperty("running");
      expect(state).toHaveProperty("autoTrading");
    });
  });

  // ─── Engine Start/Stop ─────────────────────────────────────────────

  describe("engine.start", () => {
    it("starts the engine with default parameters", async () => {
      const result = await caller.engine.start({ autoTrade: true, intervalSeconds: 60 });
      expect(result.success).toBe(true);

      const state = await caller.engine.state();
      expect(state.running).toBe(true);
      expect(state.autoTrading).toBe(true);
      expect(state.scanInterval).toBe(60);
    });

    it("starts the engine with auto-trade disabled", async () => {
      await caller.engine.start({ autoTrade: false, intervalSeconds: 120 });
      const state = await caller.engine.state();
      expect(state.running).toBe(true);
      expect(state.autoTrading).toBe(false);
      expect(state.scanInterval).toBe(120);
    });

    it("requires authentication", async () => {
      const unauthCaller = appRouter.createCaller(createUnauthContext());
      await expect(unauthCaller.engine.start({ autoTrade: true, intervalSeconds: 60 }))
        .rejects.toThrow();
    });

    it("rejects interval below 30 seconds", async () => {
      await expect(caller.engine.start({ autoTrade: true, intervalSeconds: 10 }))
        .rejects.toThrow();
    });
  });

  describe("engine.stop", () => {
    it("stops a running engine", async () => {
      await caller.engine.start({ autoTrade: true, intervalSeconds: 60 });
      const result = await caller.engine.stop();
      expect(result.success).toBe(true);

      const state = await caller.engine.state();
      expect(state.running).toBe(false);
      expect(state.autoTrading).toBe(false);
    });

    it("requires authentication", async () => {
      const unauthCaller = appRouter.createCaller(createUnauthContext());
      await expect(unauthCaller.engine.stop()).rejects.toThrow();
    });
  });

  // ─── Auto-Trading Toggle ──────────────────────────────────────────

  describe("engine.setAutoTrading", () => {
    it("toggles auto-trading on a running engine", async () => {
      await caller.engine.start({ autoTrade: true, intervalSeconds: 60 });
      
      await caller.engine.setAutoTrading({ enabled: false });
      let state = await caller.engine.state();
      expect(state.autoTrading).toBe(false);

      await caller.engine.setAutoTrading({ enabled: true });
      state = await caller.engine.state();
      expect(state.autoTrading).toBe(true);
    });

    it("requires authentication", async () => {
      const unauthCaller = appRouter.createCaller(createUnauthContext());
      await expect(unauthCaller.engine.setAutoTrading({ enabled: true })).rejects.toThrow();
    });
  });

  // ─── Scan Results ─────────────────────────────────────────────────

  describe("engine.scanResults", () => {
    it("returns empty array when no scans have run", async () => {
      const results = await caller.engine.scanResults();
      expect(results).toEqual([]);
    });

    it("is accessible as a public procedure", async () => {
      const unauthCaller = appRouter.createCaller(createUnauthContext());
      const results = await unauthCaller.engine.scanResults();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ─── Manual Scan ──────────────────────────────────────────────────

  describe("engine.manualScan", () => {
    it("triggers a manual scan and returns results", async () => {
      // Start engine first (required for scan to run)
      await caller.engine.start({ autoTrade: false, intervalSeconds: 3600 });

      // Enable some instruments
      updateConfig({
        instruments: {
          allowedInstruments: { "EUR/USD": true, "GBP/USD": false },
        } as any,
        sessions: {
          londonEnabled: true, londonStart: "00:00", londonEnd: "23:59",
          newYorkEnabled: true, newYorkStart: "00:00", newYorkEnd: "23:59",
          asianEnabled: true, asianStart: "00:00", asianEnd: "23:59",
          sydneyEnabled: true, sydneyStart: "00:00", sydneyEnd: "23:59",
          activeDays: {
            sunday: true, monday: true, tuesday: true,
            wednesday: true, thursday: true, friday: true, saturday: true,
          },
        } as any,
      });

      const result = await caller.engine.manualScan();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.scanResults)).toBe(true);

      // Should have scanned EUR/USD (enabled) but not GBP/USD (disabled)
      const symbols = result.scanResults.map(r => r.symbol);
      expect(symbols).toContain("EUR/USD");
      expect(symbols).not.toContain("GBP/USD");
    });

    it("scan results have correct structure", async () => {
      await caller.engine.start({ autoTrade: false, intervalSeconds: 3600 });
      updateConfig({
        instruments: { allowedInstruments: { "EUR/USD": true } } as any,
        sessions: {
          londonEnabled: true, londonStart: "00:00", londonEnd: "23:59",
          newYorkEnabled: true, newYorkStart: "00:00", newYorkEnd: "23:59",
          asianEnabled: true, asianStart: "00:00", asianEnd: "23:59",
          sydneyEnabled: true, sydneyStart: "00:00", sydneyEnd: "23:59",
          activeDays: {
            sunday: true, monday: true, tuesday: true,
            wednesday: true, thursday: true, friday: true, saturday: true,
          },
        } as any,
      });

      const result = await caller.engine.manualScan();
      if (result.scanResults.length > 0) {
        const scan = result.scanResults[0];
        expect(scan).toHaveProperty("symbol");
        expect(scan).toHaveProperty("signal");
        expect(scan).toHaveProperty("confluenceScore");
        expect(scan).toHaveProperty("tradePlaced");
        expect(scan).toHaveProperty("reasoning");
        expect(["buy", "sell", "no_signal"]).toContain(scan.signal);
        expect(typeof scan.confluenceScore).toBe("number");
      }
    });

    it("increments scan counter", async () => {
      await caller.engine.start({ autoTrade: false, intervalSeconds: 3600 });
      updateConfig({
        instruments: { allowedInstruments: { "EUR/USD": true } } as any,
        sessions: {
          londonEnabled: true, londonStart: "00:00", londonEnd: "23:59",
          newYorkEnabled: true, newYorkStart: "00:00", newYorkEnd: "23:59",
          asianEnabled: true, asianStart: "00:00", asianEnd: "23:59",
          sydneyEnabled: true, sydneyStart: "00:00", sydneyEnd: "23:59",
          activeDays: {
            sunday: true, monday: true, tuesday: true,
            wednesday: true, thursday: true, friday: true, saturday: true,
          },
        } as any,
      });

      await caller.engine.manualScan();
      const state = await caller.engine.state();
      expect(state.totalScans).toBeGreaterThanOrEqual(1);
    });

    it("requires authentication", async () => {
      const unauthCaller = appRouter.createCaller(createUnauthContext());
      await expect(unauthCaller.engine.manualScan()).rejects.toThrow();
    });
  });

  // ─── Trade Reasoning ──────────────────────────────────────────────

  describe("engine.tradeReasoning", () => {
    it("returns null for unknown position ID", async () => {
      const reasoning = await caller.engine.tradeReasoning({ positionId: "nonexistent" });
      expect(reasoning).toBeNull();
    });

    it("is accessible as a public procedure", async () => {
      const unauthCaller = appRouter.createCaller(createUnauthContext());
      const reasoning = await unauthCaller.engine.tradeReasoning({ positionId: "test" });
      expect(reasoning).toBeNull();
    });
  });

  // ─── Post-Mortems ─────────────────────────────────────────────────

  describe("engine.postMortems", () => {
    it("returns empty array initially", async () => {
      const postMortems = await caller.engine.postMortems();
      expect(postMortems).toEqual([]);
    });

    it("is accessible as a public procedure", async () => {
      const unauthCaller = appRouter.createCaller(createUnauthContext());
      const postMortems = await unauthCaller.engine.postMortems();
      expect(Array.isArray(postMortems)).toBe(true);
    });
  });

  // ─── Direct Engine Functions ──────────────────────────────────────

  describe("botEngine direct functions", () => {
    it("getEngineState returns full state", async () => {
      const { getEngineState } = await import("./botEngine");
      const state = getEngineState();
      expect(state).toHaveProperty("running");
      expect(state).toHaveProperty("autoTrading");
      expect(state).toHaveProperty("scanInterval");
      expect(state).toHaveProperty("lastScanTime");
      expect(state).toHaveProperty("totalScans");
      expect(state).toHaveProperty("totalSignals");
      expect(state).toHaveProperty("totalTradesPlaced");
      expect(state).toHaveProperty("totalRejected");
      expect(state).toHaveProperty("scanResults");
      expect(state).toHaveProperty("tradeReasonings");
      expect(state).toHaveProperty("postMortems");
    });

    it("getLastScanResults returns array", async () => {
      const { getLastScanResults } = await import("./botEngine");
      const results = getLastScanResults();
      expect(Array.isArray(results)).toBe(true);
    });

    it("getPostMortems returns array", async () => {
      const { getPostMortems } = await import("./botEngine");
      const postMortems = getPostMortems();
      expect(Array.isArray(postMortems)).toBe(true);
    });

    it("getTradeReasoning returns null for unknown ID", async () => {
      const { getTradeReasoning } = await import("./botEngine");
      expect(getTradeReasoning("unknown")).toBeNull();
    });
  });

  // ─── Post-Mortem Generation ───────────────────────────────────────

  describe("generatePostMortem", () => {
    it("generates a win post-mortem", async () => {
      const { generatePostMortem } = await import("./botEngine");
      const position = {
        id: "test-pos-1",
        symbol: "EUR/USD",
        direction: "long" as const,
        size: 0.1,
        entryPrice: 1.08,
        currentPrice: 1.09,
        pnl: 100,
        stopLoss: 1.075,
        takeProfit: 1.09,
        openTime: new Date(Date.now() - 3600000).toISOString(),
        signalReason: "OB + FVG confluence",
        signalScore: 7.5,
        orderId: "#12345678",
      };

      const pm = generatePostMortem(position, "take_profit");
      expect(pm.outcome).toBe("win");
      expect(pm.pnl).toBe(100);
      expect(pm.tradeId).toBe("test-pos-1");
      expect(pm.exitReason).toBe("take_profit");
      expect(pm.holdDuration).toMatch(/\d+h \d+m/);
      expect(pm.lessonLearned).toBeTruthy();
    });

    it("generates a loss post-mortem", async () => {
      const { generatePostMortem } = await import("./botEngine");
      const position = {
        id: "test-pos-2",
        symbol: "GBP/USD",
        direction: "short" as const,
        size: 0.1,
        entryPrice: 1.25,
        currentPrice: 1.255,
        pnl: -50,
        stopLoss: 1.255,
        takeProfit: 1.24,
        openTime: new Date(Date.now() - 7200000).toISOString(),
        signalReason: "Bearish OB rejection",
        signalScore: 6.0,
        orderId: "#87654321",
      };

      const pm = generatePostMortem(position, "stop_loss");
      expect(pm.outcome).toBe("loss");
      expect(pm.pnl).toBe(-50);
      expect(pm.exitReason).toBe("stop_loss");
      expect(pm.lessonLearned).toContain("invalidated");
    });

    it("generates a breakeven post-mortem", async () => {
      const { generatePostMortem } = await import("./botEngine");
      const position = {
        id: "test-pos-3",
        symbol: "EUR/USD",
        direction: "long" as const,
        size: 0.1,
        entryPrice: 1.085,
        currentPrice: 1.085,
        pnl: 0,
        stopLoss: 1.08,
        takeProfit: 1.09,
        openTime: new Date(Date.now() - 1800000).toISOString(),
        signalReason: "Manual",
        signalScore: 0,
        orderId: "#11111111",
      };

      const pm = generatePostMortem(position, "manual");
      expect(pm.outcome).toBe("breakeven");
      expect(pm.pnl).toBe(0);
      expect(pm.lessonLearned).toContain("breakeven");
    });

    it("post-mortems accumulate in engine state", async () => {
      const { generatePostMortem, getPostMortems } = await import("./botEngine");
      const position = {
        id: "test-pos-4",
        symbol: "EUR/USD",
        direction: "long" as const,
        size: 0.1,
        entryPrice: 1.08,
        currentPrice: 1.09,
        pnl: 100,
        stopLoss: 1.075,
        takeProfit: 1.09,
        openTime: new Date().toISOString(),
        signalReason: "Test",
        signalScore: 5,
        orderId: "#22222222",
      };

      const before = getPostMortems().length;
      generatePostMortem(position, "take_profit");
      const after = getPostMortems().length;
      expect(after).toBe(before + 1);
    });
  });

  // ─── Post-Mortem Registration ─────────────────────────────────────

  describe("post-mortem registration in paperTrading", () => {
    it("registerPostMortemGenerator is callable", async () => {
      const { registerPostMortemGenerator } = await import("./paperTrading");
      expect(typeof registerPostMortemGenerator).toBe("function");
      // Should not throw
      registerPostMortemGenerator(() => {});
    });
  });

  // ─── Engine Lifecycle ─────────────────────────────────────────────

  describe("engine lifecycle", () => {
    it("start → scan → stop lifecycle works", async () => {
      // Start
      await caller.engine.start({ autoTrade: false, intervalSeconds: 3600 });
      let state = await caller.engine.state();
      expect(state.running).toBe(true);

      // Stop
      await caller.engine.stop();
      state = await caller.engine.state();
      expect(state.running).toBe(false);
    });

    it("double start is idempotent", async () => {
      await caller.engine.start({ autoTrade: true, intervalSeconds: 60 });
      await caller.engine.start({ autoTrade: false, intervalSeconds: 120 }); // Should be ignored
      const state = await caller.engine.state();
      expect(state.running).toBe(true);
      // First start params should persist (second call ignored)
      expect(state.autoTrading).toBe(true);
      expect(state.scanInterval).toBe(60);
    });
  });
});
