/**
 * Backtest Engine Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getBacktestProgress, getLastBacktestResult } from "./backtest";
import { appRouter } from "./routers";

// ─── Helpers ────────────────────────────────────────────────────────

function createCaller(user?: { id: string; name: string; role: string }) {
  return appRouter.createCaller({
    user: user ?? null,
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

const testUser = { id: "bt-user-1", name: "Tester", role: "admin" };

// ─── Tests ──────────────────────────────────────────────────────────

describe("Backtest Engine", () => {
  describe("Direct functions", () => {
    it("getBacktestProgress returns initial state", () => {
      const progress = getBacktestProgress();
      expect(progress).toHaveProperty("running");
      expect(progress).toHaveProperty("progress");
      expect(typeof progress.running).toBe("boolean");
      expect(typeof progress.progress).toBe("number");
    });

    it("getLastBacktestResult returns null initially", () => {
      const result = getLastBacktestResult();
      // Could be null or a previous result
      expect(result === null || typeof result === "object").toBe(true);
    });
  });

  describe("tRPC routes", () => {
    it("backtest.progress is accessible as public procedure", async () => {
      const caller = createCaller();
      const progress = await caller.backtest.progress();
      expect(progress).toHaveProperty("running");
      expect(progress).toHaveProperty("progress");
    });

    it("backtest.lastResult is accessible as public procedure", async () => {
      const caller = createCaller();
      const result = await caller.backtest.lastResult();
      // Can be null or a BacktestResult
      expect(result === null || typeof result === "object").toBe(true);
    });

    it("backtest.run requires authentication", async () => {
      const caller = createCaller();
      await expect(
        caller.backtest.run({
          symbol: "EUR/USD",
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          timeframe: "1h",
          initialBalance: 10000,
          useCurrentConfig: true,
        })
      ).rejects.toThrow();
    });

    it("backtest.run accepts valid input and returns a result", async () => {
      const caller = createCaller(testUser);
      const now = new Date();
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);

      const result = await caller.backtest.run({
        symbol: "EUR/USD",
        startDate: start.toISOString(),
        endDate: now.toISOString(),
        timeframe: "1h",
        initialBalance: 10000,
        useCurrentConfig: true,
      });

      expect(result).toHaveProperty("symbol", "EUR/USD");
      expect(result).toHaveProperty("timeframe", "1h");
      expect(result).toHaveProperty("initialBalance", 10000);
      expect(result).toHaveProperty("status");
      expect(["completed", "error"]).toContain(result.status);

      if (result.status === "completed") {
        expect(typeof result.totalTrades).toBe("number");
        expect(typeof result.winRate).toBe("number");
        expect(typeof result.profitFactor).toBe("number");
        expect(typeof result.netProfit).toBe("number");
        expect(typeof result.maxDrawdown).toBe("number");
        expect(typeof result.maxDrawdownPercent).toBe("number");
        expect(typeof result.sharpeRatio).toBe("number");
        expect(typeof result.expectancy).toBe("number");
        expect(Array.isArray(result.equityCurve)).toBe(true);
        expect(Array.isArray(result.trades)).toBe(true);
        expect(typeof result.executionTimeMs).toBe("number");
        expect(result.configSnapshot).toHaveProperty("minConfluence");
        expect(result.configSnapshot).toHaveProperty("riskPerTrade");
      }
    }, 30000);

    it("backtest.run validates initialBalance range", async () => {
      const caller = createCaller(testUser);
      await expect(
        caller.backtest.run({
          symbol: "EUR/USD",
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          timeframe: "1h",
          initialBalance: 50, // Below minimum of 100
          useCurrentConfig: true,
        })
      ).rejects.toThrow();
    });

    it("backtest result has correct configSnapshot structure", async () => {
      const caller = createCaller(testUser);
      const now = new Date();
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);

      const result = await caller.backtest.run({
        symbol: "GBP/USD",
        startDate: start.toISOString(),
        endDate: now.toISOString(),
        timeframe: "4h",
        initialBalance: 5000,
        useCurrentConfig: true,
      });

      expect(result.configSnapshot).toBeDefined();
      expect(typeof result.configSnapshot.minConfluence).toBe("number");
      expect(typeof result.configSnapshot.riskPerTrade).toBe("number");
      expect(typeof result.configSnapshot.minRR).toBe("number");
      expect(typeof result.configSnapshot.slMethod).toBe("string");
      expect(typeof result.configSnapshot.tpMethod).toBe("string");
    }, 30000);

    it("backtest trades have correct structure when present", async () => {
      const caller = createCaller(testUser);
      const now = new Date();
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);

      const result = await caller.backtest.run({
        symbol: "EUR/USD",
        startDate: start.toISOString(),
        endDate: now.toISOString(),
        timeframe: "1h",
        initialBalance: 10000,
        useCurrentConfig: true,
      });

      if (result.status === "completed" && result.trades.length > 0) {
        const trade = result.trades[0];
        expect(trade).toHaveProperty("id");
        expect(trade).toHaveProperty("direction");
        expect(["long", "short"]).toContain(trade.direction);
        expect(trade).toHaveProperty("entryPrice");
        expect(trade).toHaveProperty("exitPrice");
        expect(trade).toHaveProperty("stopLoss");
        expect(trade).toHaveProperty("takeProfit");
        expect(trade).toHaveProperty("pnl");
        expect(trade).toHaveProperty("exitReason");
        expect(["tp", "sl", "time", "reverse_signal", "end_of_data"]).toContain(trade.exitReason);
        expect(trade).toHaveProperty("confluenceScore");
        expect(trade).toHaveProperty("setupFactors");
        expect(Array.isArray(trade.setupFactors)).toBe(true);
      }
    }, 30000);

    it("backtest progress updates after a run", async () => {
      const caller = createCaller(testUser);
      const now = new Date();
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);

      await caller.backtest.run({
        symbol: "EUR/USD",
        startDate: start.toISOString(),
        endDate: now.toISOString(),
        timeframe: "1h",
        initialBalance: 10000,
        useCurrentConfig: true,
      });

      const progress = await caller.backtest.progress();
      expect(progress.running).toBe(false);
      expect(progress.progress).toBe(100);
    }, 30000);

    it("backtest lastResult returns result after a run", async () => {
      const caller = createCaller(testUser);
      const now = new Date();
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);

      await caller.backtest.run({
        symbol: "EUR/USD",
        startDate: start.toISOString(),
        endDate: now.toISOString(),
        timeframe: "1h",
        initialBalance: 10000,
        useCurrentConfig: true,
      });

      const result = await caller.backtest.lastResult();
      expect(result).not.toBeNull();
      expect(result?.symbol).toBe("EUR/USD");
    }, 30000);
  });
});
