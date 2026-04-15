import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// In-memory settings store
let settingsStore: Record<number, { riskSettingsJson: unknown; preferencesJson: unknown }> = {};

// Mock the db module
vi.mock("./db", () => {
  return {
    upsertUser: vi.fn(),
    getUserByOpenId: vi.fn(),
    createTrade: vi.fn(),
    getTradesByUser: vi.fn().mockResolvedValue([]),
    getTradeById: vi.fn(),
    updateTrade: vi.fn(),
    deleteTrade: vi.fn(),
    getTradeStats: vi.fn().mockResolvedValue({
      totalTrades: 0, wins: 0, losses: 0, breakeven: 0, winRate: 0, totalPnl: 0, totalPips: 0, avgRR: 0, strategyAdherence: 0,
    }),
    createBrokerConnection: vi.fn(),
    getBrokerConnectionsByUser: vi.fn().mockResolvedValue([]),
    getBrokerConnectionById: vi.fn(),
    updateBrokerConnection: vi.fn(),
    deleteBrokerConnection: vi.fn(),
    getClosedTradesForEquityCurve: vi.fn().mockResolvedValue([]),
    getBotConfig: vi.fn().mockResolvedValue(null),
    upsertBotConfig: vi.fn(),
    getTradeReasoningByPositionId: vi.fn().mockResolvedValue(null),
    getTradeReasoningByTradeId: vi.fn().mockResolvedValue(null),
    getRecentTradeReasonings: vi.fn().mockResolvedValue([]),
    getTradePostMortemByPositionId: vi.fn().mockResolvedValue(null),
    getTradePostMortemByTradeId: vi.fn().mockResolvedValue(null),
    getRecentTradePostMortems: vi.fn().mockResolvedValue([]),
    getUserSettings: vi.fn(async (userId: number) => {
      return settingsStore[userId] || undefined;
    }),
    upsertUserSettings: vi.fn(async (userId: number, data: { riskSettingsJson?: unknown; preferencesJson?: unknown }) => {
      if (!settingsStore[userId]) {
        settingsStore[userId] = { riskSettingsJson: null, preferencesJson: null };
      }
      if (data.riskSettingsJson !== undefined) settingsStore[userId].riskSettingsJson = data.riskSettingsJson;
      if (data.preferencesJson !== undefined) settingsStore[userId].preferencesJson = data.preferencesJson;
    }),
    updateTradeReasoningJson: vi.fn(),
    updateTradePostMortemJson: vi.fn(),
  };
});

// Mock other dependencies
vi.mock("./marketData", () => ({
  fetchCandlesFromYahoo: vi.fn().mockResolvedValue([]),
  fetchQuoteFromYahoo: vi.fn().mockResolvedValue({ price: 1.085, bid: 1.0849, ask: 1.0851, change: 0.001, changePercent: 0.1 }),
}));

vi.mock("./paperTrading", () => ({
  getStatus: vi.fn().mockReturnValue({
    balance: 10000, equity: 10000, unrealizedPnl: 0, marginUsed: 0, freeMargin: 10000,
    marginLevel: 0, dailyPnl: 0, drawdown: 0, positions: [], pendingOrders: [], tradeHistory: [],
    isRunning: false, isPaused: false, startedAt: null, uptime: 0, totalTrades: 0, winRate: 0,
    wins: 0, losses: 0, scanCount: 0, signalCount: 0, tradeCount: 0, rejectedCount: 0,
    strategy: { name: 'SMC', winRate: 0, avgRR: 0, profitFactor: 0, expectancy: 0, maxDrawdown: 0 },
    log: [],
  }),
  placeOrder: vi.fn(),
  closePosition: vi.fn(),
  placePendingOrder: vi.fn(),
  cancelPendingOrder: vi.fn(),
  startEngine: vi.fn(),
  pauseEngine: vi.fn(),
  stopEngine: vi.fn(),
  resetAccount: vi.fn(),
  setOwnerUserId: vi.fn(),
  getLog: vi.fn().mockReturnValue([]),
}));

vi.mock("./botConfig", () => ({
  getConfig: vi.fn().mockReturnValue({
    strategy: { enableBOS: true, enableCHoCH: true, enableOB: true, enableFVG: true, enableLiquiditySweep: true, minConfluenceScore: 6, htfBiasRequired: true },
    notifications: { notifyOnTrade: true, notifyOnSignal: false, notifyOnError: true, notifyDailySummary: true, notifyChannel: 'in_app' },
  }),
  updateConfig: vi.fn(),
  resetConfig: vi.fn(),
  loadConfigFromDb: vi.fn(),
  isConfigLoaded: vi.fn().mockReturnValue(true),
}));

vi.mock("./botEngine", () => ({
  startEngine: vi.fn(),
  stopEngine: vi.fn(),
  setAutoTrading: vi.fn(),
  getEngineState: vi.fn().mockReturnValue({ running: false, autoTrading: false, scanInterval: 60, lastScanTime: 0, totalScans: 0, totalSignals: 0, totalTradesPlaced: 0, totalRejected: 0, scanResults: [], tradeReasonings: {}, postMortems: [] }),
  getTradeReasoning: vi.fn(),
  getPostMortems: vi.fn().mockReturnValue([]),
  getLastScanResults: vi.fn().mockReturnValue([]),
  triggerManualScan: vi.fn(),
  generatePostMortem: vi.fn(),
}));

vi.mock("./backtest", () => ({
  runBacktest: vi.fn(),
  getBacktestProgress: vi.fn().mockReturnValue(null),
  getLastBacktestResult: vi.fn().mockReturnValue(null),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

const testUser: AuthenticatedUser = {
  id: 1,
  openId: "test-open-id",
  name: "Test User",
  role: "admin",
};

function createAuthenticatedCaller() {
  return appRouter.createCaller({
    user: testUser,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  });
}

function createUnauthenticatedCaller() {
  return appRouter.createCaller({
    user: null,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  });
}

describe("Settings Routes", () => {
  beforeEach(() => {
    settingsStore = {};
  });

  describe("settings.get", () => {
    it("requires authentication", async () => {
      const caller = createUnauthenticatedCaller();
      await expect(caller.settings.get()).rejects.toThrow();
    });

    it("returns null/undefined settings when no data exists", async () => {
      const caller = createAuthenticatedCaller();
      const result = await caller.settings.get();
      expect(result.riskSettings).toBeFalsy();
      expect(result.preferences).toBeFalsy();
    });

    it("returns saved risk settings", async () => {
      settingsStore[1] = {
        riskSettingsJson: { maxRiskPerTrade: 2, maxPortfolioHeat: 8, maxPositions: 3 },
        preferencesJson: null,
      };
      const caller = createAuthenticatedCaller();
      const result = await caller.settings.get();
      expect(result.riskSettings).toEqual({
        maxRiskPerTrade: 2,
        maxPortfolioHeat: 8,
        maxPositions: 3,
      });
    });

    it("returns saved preferences", async () => {
      settingsStore[1] = {
        riskSettingsJson: null,
        preferencesJson: {
          defaultInstrument: "GBP/USD",
          defaultTimeframe: "1h",
          autoRefresh: false,
          refreshInterval: 60,
          theme: "dark",
        },
      };
      const caller = createAuthenticatedCaller();
      const result = await caller.settings.get();
      expect(result.preferences).toEqual({
        defaultInstrument: "GBP/USD",
        defaultTimeframe: "1h",
        autoRefresh: false,
        refreshInterval: 60,
        theme: "dark",
      });
    });
  });

  describe("settings.updateRisk", () => {
    it("requires authentication", async () => {
      const caller = createUnauthenticatedCaller();
      await expect(
        caller.settings.updateRisk({
          maxRiskPerTrade: 1,
          maxPortfolioHeat: 6,
          maxPositions: 5,
        })
      ).rejects.toThrow();
    });

    it("saves risk settings to DB", async () => {
      const caller = createAuthenticatedCaller();
      const result = await caller.settings.updateRisk({
        maxRiskPerTrade: 2,
        maxPortfolioHeat: 10,
        maxPositions: 3,
      });
      expect(result.success).toBe(true);
      expect(settingsStore[1].riskSettingsJson).toEqual({
        maxRiskPerTrade: 2,
        maxPortfolioHeat: 10,
        maxPositions: 3,
      });
    });

    it("validates maxRiskPerTrade range", async () => {
      const caller = createAuthenticatedCaller();
      await expect(
        caller.settings.updateRisk({
          maxRiskPerTrade: 0, // below min 0.1
          maxPortfolioHeat: 6,
          maxPositions: 5,
        })
      ).rejects.toThrow();
    });

    it("validates maxPositions is integer", async () => {
      const caller = createAuthenticatedCaller();
      await expect(
        caller.settings.updateRisk({
          maxRiskPerTrade: 1,
          maxPortfolioHeat: 6,
          maxPositions: 2.5, // not integer
        })
      ).rejects.toThrow();
    });
  });

  describe("settings.updatePreferences", () => {
    it("requires authentication", async () => {
      const caller = createUnauthenticatedCaller();
      await expect(
        caller.settings.updatePreferences({
          defaultInstrument: "EUR/USD",
          defaultTimeframe: "4h",
          autoRefresh: true,
          refreshInterval: 30,
        })
      ).rejects.toThrow();
    });

    it("saves preferences to DB", async () => {
      const caller = createAuthenticatedCaller();
      const result = await caller.settings.updatePreferences({
        defaultInstrument: "GBP/USD",
        defaultTimeframe: "1h",
        autoRefresh: false,
        refreshInterval: 60,
      });
      expect(result.success).toBe(true);
      expect(settingsStore[1].preferencesJson).toEqual({
        defaultInstrument: "GBP/USD",
        defaultTimeframe: "1h",
        autoRefresh: false,
        refreshInterval: 60,
      });
    });

    it("validates refreshInterval range", async () => {
      const caller = createAuthenticatedCaller();
      await expect(
        caller.settings.updatePreferences({
          defaultInstrument: "EUR/USD",
          defaultTimeframe: "4h",
          autoRefresh: true,
          refreshInterval: 3, // below min 5
        })
      ).rejects.toThrow();
    });

    it("preserves risk settings when updating preferences", async () => {
      const caller = createAuthenticatedCaller();
      // First save risk settings
      await caller.settings.updateRisk({
        maxRiskPerTrade: 2,
        maxPortfolioHeat: 8,
        maxPositions: 3,
      });
      // Then save preferences
      await caller.settings.updatePreferences({
        defaultInstrument: "USD/JPY",
        defaultTimeframe: "15min",
        autoRefresh: true,
        refreshInterval: 15,
      });
      // Risk settings should still be there
      expect(settingsStore[1].riskSettingsJson).toEqual({
        maxRiskPerTrade: 2,
        maxPortfolioHeat: 8,
        maxPositions: 3,
      });
      expect(settingsStore[1].preferencesJson).toEqual({
        defaultInstrument: "USD/JPY",
        defaultTimeframe: "15min",
        autoRefresh: true,
        refreshInterval: 15,
      });
    });
  });
});
