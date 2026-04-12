import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Mock the db module
vi.mock("./db", () => {
  const mockTrades: any[] = [];
  let nextId = 1;

  return {
    upsertUser: vi.fn(),
    getUserByOpenId: vi.fn(),
    createTrade: vi.fn(async (trade: any) => {
      const id = nextId++;
      mockTrades.push({ id, ...trade });
      return id;
    }),
    getTradesByUser: vi.fn(async (userId: number, limit: number, offset: number) => {
      return mockTrades
        .filter((t) => t.userId === userId)
        .sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime())
        .slice(offset, offset + limit);
    }),
    getTradeById: vi.fn(async (tradeId: number, userId: number) => {
      return mockTrades.find((t) => t.id === tradeId && t.userId === userId);
    }),
    updateTrade: vi.fn(async (tradeId: number, userId: number, data: any) => {
      const idx = mockTrades.findIndex((t) => t.id === tradeId && t.userId === userId);
      if (idx !== -1) {
        mockTrades[idx] = { ...mockTrades[idx], ...data };
      }
    }),
    deleteTrade: vi.fn(async (tradeId: number, userId: number) => {
      const idx = mockTrades.findIndex((t) => t.id === tradeId && t.userId === userId);
      if (idx !== -1) {
        mockTrades.splice(idx, 1);
      }
    }),
    getTradeStats: vi.fn(async (userId: number) => {
      const userTrades = mockTrades.filter(
        (t) => t.userId === userId && t.status === "closed"
      );
      const totalTrades = userTrades.length;
      const wins = userTrades.filter((t) => t.pnlAmount && parseFloat(t.pnlAmount) > 0).length;
      const losses = userTrades.filter((t) => t.pnlAmount && parseFloat(t.pnlAmount) < 0).length;
      return {
        totalTrades,
        wins,
        losses,
        breakeven: totalTrades - wins - losses,
        winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
        totalPnl: userTrades.reduce((s: number, t: any) => s + (t.pnlAmount ? parseFloat(t.pnlAmount) : 0), 0),
        totalPips: 0,
        avgRR: 0,
        strategyAdherence: 0,
      };
    }),
  };
});

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

describe("trades router", () => {
  describe("trades.create", () => {
    it("creates a trade successfully for authenticated user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.trades.create({
        symbol: "EUR/USD",
        direction: "long",
        entryPrice: "1.08500",
        stopLoss: "1.08200",
        takeProfit: "1.09500",
        riskReward: "3.33",
        riskPercent: "1",
        timeframe: "4H",
        followedStrategy: true,
        setupType: "OB Retest",
        notes: "Clean order block retest on 4H",
        entryTime: new Date("2026-04-10T10:00:00Z"),
      });

      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    });

    it("rejects unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.trades.create({
          symbol: "EUR/USD",
          direction: "long",
          entryPrice: "1.08500",
          entryTime: new Date("2026-04-10T10:00:00Z"),
        })
      ).rejects.toThrow();
    });

    it("validates required fields", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.trades.create({
          symbol: "",
          direction: "long",
          entryPrice: "1.08500",
          entryTime: new Date("2026-04-10T10:00:00Z"),
        })
      ).rejects.toThrow();
    });

    it("validates direction enum", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.trades.create({
          symbol: "EUR/USD",
          direction: "sideways" as any,
          entryPrice: "1.08500",
          entryTime: new Date("2026-04-10T10:00:00Z"),
        })
      ).rejects.toThrow();
    });
  });

  describe("trades.list", () => {
    it("returns trades for authenticated user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.trades.list({ limit: 50, offset: 0 });

      expect(Array.isArray(result)).toBe(true);
    });

    it("rejects unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.trades.list({ limit: 50, offset: 0 })).rejects.toThrow();
    });
  });

  describe("trades.stats", () => {
    it("returns stats for authenticated user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.trades.stats();

      expect(result).toHaveProperty("totalTrades");
      expect(result).toHaveProperty("wins");
      expect(result).toHaveProperty("losses");
      expect(result).toHaveProperty("winRate");
      expect(result).toHaveProperty("totalPnl");
      expect(typeof result.winRate).toBe("number");
    });

    it("rejects unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.trades.stats()).rejects.toThrow();
    });
  });

  describe("trades.update", () => {
    it("updates a trade successfully", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // First create a trade
      const created = await caller.trades.create({
        symbol: "GBP/USD",
        direction: "short",
        entryPrice: "1.25000",
        entryTime: new Date("2026-04-11T08:00:00Z"),
      });

      // Then update it
      const result = await caller.trades.update({
        id: created.id,
        status: "closed",
        exitPrice: "1.24500",
        pnlPips: "50",
        pnlAmount: "250.00",
        exitTime: new Date("2026-04-11T14:00:00Z"),
      });

      expect(result).toEqual({ success: true });
    });

    it("rejects unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.trades.update({
          id: 1,
          status: "closed",
        })
      ).rejects.toThrow();
    });
  });

  describe("trades.delete", () => {
    it("deletes a trade successfully", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const created = await caller.trades.create({
        symbol: "XAU/USD",
        direction: "long",
        entryPrice: "2350.00",
        entryTime: new Date("2026-04-11T12:00:00Z"),
      });

      const result = await caller.trades.delete({ id: created.id });

      expect(result).toEqual({ success: true });
    });

    it("rejects unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.trades.delete({ id: 1 })).rejects.toThrow();
    });
  });
});
