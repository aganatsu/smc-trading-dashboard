import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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
    totalTrades: 0,
    wins: 0,
    losses: 0,
    breakeven: 0,
    winRate: 0,
    totalPnl: 0,
    totalPips: 0,
    avgRR: 0,
    strategyAdherence: 0,
  })),
}));

// Mock the marketData module
vi.mock("./marketData", () => ({
  fetchQuoteFromYahoo: vi.fn(async (symbol: string) => {
    const prices: Record<string, number> = {
      "EUR/USD": 1.085,
      "GBP/USD": 1.25,
      "USD/JPY": 150.5,
      "XAU/USD": 2350.0,
      "BTC/USD": 65000.0,
    };
    const price = prices[symbol];
    if (!price) throw new Error(`Unknown symbol: ${symbol}`);
    return {
      price,
      change: 0,
      percentChange: 0,
      open: price,
      high: price + 0.001,
      low: price - 0.001,
      previousClose: price - 0.0005,
    };
  }),
  fetchCandlesFromYahoo: vi.fn(async () => []),
}));

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("paper trading tRPC routes", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(async () => {
    // Reset the paper trading engine between tests
    const { resetAccount, setOwnerUserId, stopEngine } = await import(
      "./paperTrading"
    );
    stopEngine();
    resetAccount();
    setOwnerUserId(1);
    // Reset bot config and relax validation so unit tests pass without signal scores or strict R:R
    resetConfig();
    updateConfig({
      strategy: { minConfluenceScore: 0 } as any,
      risk: { minRiskReward: 0 } as any,
    });
    caller = appRouter.createCaller(createAuthContext());
  });

  afterEach(async () => {
    const { stopEngine } = await import("./paperTrading");
    stopEngine();
  });

  describe("paper.status", () => {
    it("returns paper trading status for authenticated user", async () => {
      const result = await caller.paper.status();

      expect(result).toHaveProperty("balance");
      expect(result).toHaveProperty("equity");
      expect(result).toHaveProperty("unrealizedPnl");
      expect(result).toHaveProperty("positions");
      expect(result).toHaveProperty("tradeHistory");
      expect(result).toHaveProperty("isRunning");
      expect(result).toHaveProperty("totalTrades");
      expect(result).toHaveProperty("winRate");
      expect(result.balance).toBe(10000);
    });

    it("returns status for unauthenticated users (public route)", async () => {
      const unauthCaller = appRouter.createCaller(createUnauthContext());
      const result = await unauthCaller.paper.status();
      expect(result).toHaveProperty("balance");
      expect(result.balance).toBe(10000);
    });
  });

  describe("paper.placeOrder", () => {
    it("places a long order via tRPC", async () => {
      const result = await caller.paper.placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
      });

      expect(result.success).toBe(true);
      expect(result.position).toBeDefined();
      expect(result.position!.symbol).toBe("EUR/USD");
      expect(result.position!.direction).toBe("long");
    });

    it("places a short order with SL/TP via tRPC", async () => {
      const result = await caller.paper.placeOrder({
        symbol: "GBP/USD",
        direction: "short",
        size: 0.05,
        stopLoss: 1.26,
        takeProfit: 1.24,
      });

      expect(result.success).toBe(true);
      expect(result.position!.stopLoss).toBe(1.26);
      expect(result.position!.takeProfit).toBe(1.24);
    });

    it("rejects invalid orders via tRPC", async () => {
      const result = await caller.paper.placeOrder({
        symbol: "INVALID/PAIR",
        direction: "long",
        size: 0.1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("rejects unauthenticated users", async () => {
      const unauthCaller = appRouter.createCaller(createUnauthContext());
      await expect(
        unauthCaller.paper.placeOrder({
          symbol: "EUR/USD",
          direction: "long",
          size: 0.1,
        })
      ).rejects.toThrow();
    });
  });

  describe("paper.closePosition", () => {
    it("closes a position via tRPC", async () => {
      // First place an order
      const orderResult = await caller.paper.placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
      });

      expect(orderResult.success).toBe(true);
      const positionId = orderResult.position!.id;

      // Then close it
      const closeResult = await caller.paper.closePosition({
        positionId,
      });

      expect(closeResult.success).toBe(true);
      expect(typeof closeResult.pnl).toBe("number");

      // Verify position is gone
      const status = await caller.paper.status();
      expect(status.positions).toHaveLength(0);
      expect(status.tradeHistory).toHaveLength(1);
    });

    it("returns error for non-existent position", async () => {
      const result = await caller.paper.closePosition({
        positionId: "nonexistent-id",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("paper.start / paper.pause / paper.stop", () => {
    it("starts the paper trading engine", async () => {
      const result = await caller.paper.start();
      expect(result.success).toBe(true);

      const status = await caller.paper.status();
      expect(status.isRunning).toBe(true);
    });

    it("pauses the engine", async () => {
      await caller.paper.start();
      const result = await caller.paper.pause();
      expect(result.success).toBe(true);

      const status = await caller.paper.status();
      expect(status.isRunning).toBe(false);
    });

    it("stops the engine", async () => {
      await caller.paper.start();
      const result = await caller.paper.stop();
      expect(result.success).toBe(true);

      const status = await caller.paper.status();
      expect(status.isRunning).toBe(false);
    });
  });

  describe("paper.reset", () => {
    it("resets the account to initial state", async () => {
      // Place an order first
      await caller.paper.placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
      });

      // Reset
      const result = await caller.paper.reset();
      expect(result.success).toBe(true);

      // Verify clean state
      const status = await caller.paper.status();
      expect(status.balance).toBe(10000);
      expect(status.positions).toHaveLength(0);
      expect(status.tradeHistory).toHaveLength(0);
    });
  });

  describe("paper.placePendingOrder", () => {
    it("places a pending buy limit order via tRPC", async () => {
      const result = await caller.paper.placePendingOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        triggerPrice: 1.08,
        orderType: "buy_limit",
      });

      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order!.orderType).toBe("buy_limit");
      expect(result.order!.triggerPrice).toBe(1.08);

      const status = await caller.paper.status();
      expect(status.pendingOrders).toHaveLength(1);
    });

    it("places a pending order with signal reason and score", async () => {
      const result = await caller.paper.placePendingOrder({
        symbol: "GBP/USD",
        direction: "short",
        size: 0.05,
        triggerPrice: 1.24,
        orderType: "sell_stop",
        stopLoss: 1.25,
        takeProfit: 1.23,
        signalReason: "BOS + OB retest",
        signalScore: 8,
      });

      expect(result.success).toBe(true);
      expect(result.order!.signalReason).toBe("BOS + OB retest");
      expect(result.order!.signalScore).toBe(8);
    });

    it("rejects unauthenticated users", async () => {
      const unauthCaller = appRouter.createCaller(createUnauthContext());
      await expect(
        unauthCaller.paper.placePendingOrder({
          symbol: "EUR/USD",
          direction: "long",
          size: 0.1,
          triggerPrice: 1.08,
          orderType: "buy_limit",
        })
      ).rejects.toThrow();
    });
  });

  describe("paper.cancelPendingOrder", () => {
    it("cancels a pending order via tRPC", async () => {
      const placeResult = await caller.paper.placePendingOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        triggerPrice: 1.08,
        orderType: "buy_limit",
      });

      const cancelResult = await caller.paper.cancelPendingOrder({
        orderId: placeResult.order!.id,
      });

      expect(cancelResult.success).toBe(true);

      const status = await caller.paper.status();
      expect(status.pendingOrders).toHaveLength(0);
    });

    it("returns error for non-existent pending order", async () => {
      const result = await caller.paper.cancelPendingOrder({
        orderId: "nonexistent",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("full paper trading flow", () => {
    it("complete flow: start -> place order -> close -> verify journal logging", async () => {
      const { createTrade } = await import("./db");

      // 1. Start engine
      await caller.paper.start();
      let status = await caller.paper.status();
      expect(status.isRunning).toBe(true);

      // 2. Place order
      const order = await caller.paper.placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        stopLoss: 1.08,
        takeProfit: 1.09,
      });
      expect(order.success).toBe(true);

      status = await caller.paper.status();
      expect(status.positions).toHaveLength(1);

      // 3. Close position
      const close = await caller.paper.closePosition({
        positionId: order.position!.id,
      });
      expect(close.success).toBe(true);

      // 4. Verify journal auto-logging
      expect(createTrade).toHaveBeenCalled();
      const callArgs = (createTrade as any).mock.calls[0][0];
      expect(callArgs.symbol).toBe("EUR/USD");
      expect(callArgs.direction).toBe("long");
      expect(callArgs.status).toBe("closed");

      // 5. Verify trade history
      status = await caller.paper.status();
      expect(status.positions).toHaveLength(0);
      expect(status.tradeHistory).toHaveLength(1);
      expect(status.totalTrades).toBe(1);

      // 6. Stop engine
      await caller.paper.stop();
      status = await caller.paper.status();
      expect(status.isRunning).toBe(false);
    });

    it("multiple positions flow", async () => {
      // Place multiple orders
      const order1 = await caller.paper.placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
      });
      const order2 = await caller.paper.placeOrder({
        symbol: "GBP/USD",
        direction: "short",
        size: 0.05,
      });

      expect(order1.success).toBe(true);
      expect(order2.success).toBe(true);

      let status = await caller.paper.status();
      expect(status.positions).toHaveLength(2);

      // Close first position
      await caller.paper.closePosition({ positionId: order1.position!.id });
      status = await caller.paper.status();
      expect(status.positions).toHaveLength(1);
      expect(status.tradeHistory).toHaveLength(1);

      // Close second position
      await caller.paper.closePosition({ positionId: order2.position!.id });
      status = await caller.paper.status();
      expect(status.positions).toHaveLength(0);
      expect(status.tradeHistory).toHaveLength(2);
      expect(status.totalTrades).toBe(2);
    });
  });
});
