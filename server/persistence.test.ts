import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB helpers — must match the actual imports in paperTradingPersistence.ts
const mockGetPaperAccount = vi.fn().mockResolvedValue(null);
const mockUpsertPaperAccount = vi.fn().mockResolvedValue(undefined);
const mockGetPaperPositions = vi.fn().mockResolvedValue([]);
const mockGetPaperPendingOrders = vi.fn().mockResolvedValue([]);
const mockInsertPaperPosition = vi.fn().mockResolvedValue(undefined);
const mockDeletePaperPosition = vi.fn().mockResolvedValue(undefined);
const mockDeleteAllPaperPositions = vi.fn().mockResolvedValue(undefined);
const mockInsertPaperTradeHistory = vi.fn().mockResolvedValue(undefined);
const mockGetPaperTradeHistory = vi.fn().mockResolvedValue([]);
const mockDeleteAllPaperTradeHistory = vi.fn().mockResolvedValue(undefined);

vi.mock("./db", () => ({
  getPaperAccount: (...args: any[]) => mockGetPaperAccount(...args),
  upsertPaperAccount: (...args: any[]) => mockUpsertPaperAccount(...args),
  getPaperPositions: (...args: any[]) => mockGetPaperPositions(...args),
  getPaperPendingOrders: (...args: any[]) => mockGetPaperPendingOrders(...args),
  insertPaperPosition: (...args: any[]) => mockInsertPaperPosition(...args),
  deletePaperPosition: (...args: any[]) => mockDeletePaperPosition(...args),
  deleteAllPaperPositions: (...args: any[]) => mockDeleteAllPaperPositions(...args),
  insertPaperTradeHistory: (...args: any[]) => mockInsertPaperTradeHistory(...args),
  getPaperTradeHistory: (...args: any[]) => mockGetPaperTradeHistory(...args),
  deleteAllPaperTradeHistory: (...args: any[]) => mockDeleteAllPaperTradeHistory(...args),
}));

import {
  saveAccountState,
  savePosition,
  removePosition,
  saveTradeRecord,
  restoreState,
  clearAllState,
} from "./paperTradingPersistence";

describe("Paper Trading Persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveAccountState", () => {
    it("should not throw when called with valid state", () => {
      const state = {
        balance: 10000,
        peakBalance: 10500,
        isRunning: true,
        isPaused: false,
        startedAt: new Date(),
        scanCount: 5,
        signalCount: 3,
        rejectedCount: 1,
        dailyPnlBase: 10000,
        dailyPnlDate: "2026-04-15",
        executionMode: "paper" as const,
        killSwitchActive: false,
      };

      // saveAccountState uses debounced save, should not throw
      expect(() => saveAccountState(1, state)).not.toThrow();
    });

    it("should handle live execution mode with kill switch", () => {
      const state = {
        balance: 9000,
        peakBalance: 10000,
        isRunning: false,
        isPaused: false,
        startedAt: null,
        scanCount: 20,
        signalCount: 10,
        rejectedCount: 5,
        dailyPnlBase: 10000,
        dailyPnlDate: "2026-04-15",
        executionMode: "live" as const,
        killSwitchActive: true,
      };

      expect(() => saveAccountState(1, state)).not.toThrow();
    });
  });

  describe("savePosition", () => {
    it("should call insertPaperPosition with position data", async () => {
      const position = {
        id: "pos-1",
        symbol: "EUR/USD",
        direction: "long" as const,
        size: 0.1,
        entryPrice: 1.085,
        currentPrice: 1.086,
        stopLoss: 1.08,
        takeProfit: 1.095,
        openTime: new Date().toISOString(),
        status: "open" as const,
        signalReason: "OB + FVG confluence",
        signalScore: 8,
        orderId: "ord-1",
      };

      await savePosition(1, position as any);
      expect(mockInsertPaperPosition).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          positionId: "pos-1",
          symbol: "EUR/USD",
          direction: "long",
        })
      );
    });
  });

  describe("removePosition", () => {
    it("should call deletePaperPosition", async () => {
      await removePosition(1, "pos-1");
      expect(mockDeletePaperPosition).toHaveBeenCalledWith(1, "pos-1");
    });
  });

  describe("saveTradeRecord", () => {
    it("should call insertPaperTradeHistory", async () => {
      const trade = {
        id: "trade-1",
        symbol: "EUR/USD",
        direction: "long" as const,
        size: 0.1,
        entryPrice: 1.085,
        exitPrice: 1.095,
        pnl: 100,
        pnlPips: 10,
        openTime: new Date().toISOString(),
        closedAt: new Date().toISOString(),
        closeReason: "tp" as const,
        signalReason: "OB + FVG",
        signalScore: 8,
        orderId: "ord-1",
      };

      await saveTradeRecord(1, trade as any);
      expect(mockInsertPaperTradeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          symbol: "EUR/USD",
          pnl: "100.00",
        })
      );
    });
  });

  describe("restoreState", () => {
    it("should return null when no account exists", async () => {
      mockGetPaperAccount.mockResolvedValue(null);
      const result = await restoreState(1);
      expect(result).toBeNull();
    });

    it("should restore account, positions, and history from DB", async () => {
      mockGetPaperAccount.mockResolvedValue({
        balance: "10500.00",
        peakBalance: "10500.00",
        isRunning: false,
        isPaused: false,
        startedAt: null,
        scanCount: 10,
        signalCount: 5,
        rejectedCount: 2,
        dailyPnlBase: "10000.00",
        dailyPnlDate: "2026-04-15",
        executionMode: "paper",
        killSwitchActive: false,
      });
      mockGetPaperPositions.mockResolvedValue([
        {
          positionId: "pos-1",
          symbol: "EUR/USD",
          direction: "long",
          size: "0.10",
          entryPrice: "1.08500",
          stopLoss: "1.08000",
          takeProfit: "1.09500",
          openTime: new Date().toISOString(),
          status: "open",
          signalReason: null,
          signalScore: null,
        },
      ]);
      mockGetPaperPendingOrders.mockResolvedValue([]);
      mockGetPaperTradeHistory.mockResolvedValue([]);

      const result = await restoreState(1);
      expect(result).not.toBeNull();
      expect(result!.balance).toBe(10500);
      expect(result!.positions).toHaveLength(1);
      expect(result!.positions[0].symbol).toBe("EUR/USD");
      expect(result!.executionMode).toBe("paper");
      expect(result!.killSwitchActive).toBe(false);
    });

    it("should restore live mode with kill switch active", async () => {
      mockGetPaperAccount.mockResolvedValue({
        balance: "9000.00",
        peakBalance: "10000.00",
        isRunning: false,
        isPaused: false,
        startedAt: null,
        scanCount: 20,
        signalCount: 10,
        rejectedCount: 5,
        dailyPnlBase: "10000.00",
        dailyPnlDate: "2026-04-15",
        executionMode: "live",
        killSwitchActive: true,
      });
      mockGetPaperPositions.mockResolvedValue([]);
      mockGetPaperPendingOrders.mockResolvedValue([]);
      mockGetPaperTradeHistory.mockResolvedValue([]);

      const result = await restoreState(1);
      expect(result).not.toBeNull();
      expect(result!.executionMode).toBe("live");
      expect(result!.killSwitchActive).toBe(true);
    });
  });

  describe("clearAllState", () => {
    it("should clear account, positions, and history", async () => {
      await clearAllState(1);
      expect(mockDeleteAllPaperPositions).toHaveBeenCalledWith(1);
      expect(mockDeleteAllPaperTradeHistory).toHaveBeenCalledWith(1);
    });
  });
});
