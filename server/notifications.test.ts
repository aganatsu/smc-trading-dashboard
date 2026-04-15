import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the notification helper
const mockNotifyOwner = vi.fn().mockResolvedValue(true);
vi.mock("./_core/notification", () => ({
  notifyOwner: (...args: any[]) => mockNotifyOwner(...args),
}));

// Mock botConfig to control notification settings
let mockConfig = {
  notifications: {
    notifyOnTrade: true,
    notifyOnSignal: true,
    notifyOnError: true,
    notifyDailySummary: true,
    notifyChannel: "in_app" as const,
  },
};

vi.mock("./botConfig", () => ({
  getConfig: () => mockConfig,
}));

import {
  notifySignalDetected,
  notifyTradePlaced,
  notifyTradeClosed,
  notifyEngineError,
  notifyDailySummary,
} from "./notifications";

describe("Notifications Module", () => {
  beforeEach(() => {
    mockNotifyOwner.mockClear();
    // Reset config to all enabled
    mockConfig = {
      notifications: {
        notifyOnTrade: true,
        notifyOnSignal: true,
        notifyOnError: true,
        notifyDailySummary: true,
        notifyChannel: "in_app",
      },
    };
  });

  describe("notifySignalDetected", () => {
    it("sends notification when notifyOnSignal is enabled", async () => {
      notifySignalDetected({
        symbol: "EUR/USD",
        direction: "buy",
        confluenceScore: 8,
        summary: "Strong bullish setup with OB + FVG",
      });
      // Fire-and-forget, give it a tick
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner).toHaveBeenCalledTimes(1);
      expect(mockNotifyOwner).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("BUY EUR/USD"),
          content: expect.stringContaining("8/10"),
        })
      );
    });

    it("does NOT send notification when notifyOnSignal is disabled", async () => {
      mockConfig.notifications.notifyOnSignal = false;
      notifySignalDetected({
        symbol: "EUR/USD",
        direction: "sell",
        confluenceScore: 7,
        summary: "Bearish setup",
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner).not.toHaveBeenCalled();
    });

    it("includes correct emoji for buy vs sell", async () => {
      notifySignalDetected({
        symbol: "GBP/USD",
        direction: "buy",
        confluenceScore: 6,
        summary: "test",
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner.mock.calls[0][0].title).toContain("🟢");

      mockNotifyOwner.mockClear();
      notifySignalDetected({
        symbol: "GBP/USD",
        direction: "sell",
        confluenceScore: 6,
        summary: "test",
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner.mock.calls[0][0].title).toContain("🔴");
    });
  });

  describe("notifyTradePlaced", () => {
    it("sends notification when notifyOnTrade is enabled", async () => {
      notifyTradePlaced({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        entryPrice: 1.08500,
        stopLoss: 1.08200,
        takeProfit: 1.09000,
        reason: "OB + FVG confluence",
        score: 8,
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner).toHaveBeenCalledTimes(1);
      expect(mockNotifyOwner.mock.calls[0][0].title).toContain("LONG EUR/USD");
      expect(mockNotifyOwner.mock.calls[0][0].content).toContain("0.1 lots");
    });

    it("does NOT send when notifyOnTrade is disabled", async () => {
      mockConfig.notifications.notifyOnTrade = false;
      notifyTradePlaced({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        entryPrice: 1.08500,
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner).not.toHaveBeenCalled();
    });
  });

  describe("notifyTradeClosed", () => {
    it("sends notification for stop loss hit", async () => {
      notifyTradeClosed({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        entryPrice: 1.08500,
        exitPrice: 1.08200,
        pnl: -30,
        pnlPips: -30,
        closeReason: "stop_loss",
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner).toHaveBeenCalledTimes(1);
      expect(mockNotifyOwner.mock.calls[0][0].title).toContain("🛑");
      expect(mockNotifyOwner.mock.calls[0][0].title).toContain("-$30.00");
    });

    it("sends notification for take profit hit", async () => {
      notifyTradeClosed({
        symbol: "GBP/USD",
        direction: "short",
        size: 0.5,
        entryPrice: 1.26000,
        exitPrice: 1.25500,
        pnl: 250,
        pnlPips: 50,
        closeReason: "take_profit",
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner).toHaveBeenCalledTimes(1);
      expect(mockNotifyOwner.mock.calls[0][0].title).toContain("🎯");
      expect(mockNotifyOwner.mock.calls[0][0].title).toContain("+$250.00");
    });

    it("sends notification for manual close", async () => {
      notifyTradeClosed({
        symbol: "USD/JPY",
        direction: "long",
        size: 0.2,
        entryPrice: 150.000,
        exitPrice: 150.500,
        pnl: 100,
        pnlPips: 50,
        closeReason: "manual",
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner.mock.calls[0][0].title).toContain("✋");
    });

    it("does NOT send when notifyOnTrade is disabled", async () => {
      mockConfig.notifications.notifyOnTrade = false;
      notifyTradeClosed({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        entryPrice: 1.08500,
        exitPrice: 1.08200,
        pnl: -30,
        pnlPips: -30,
        closeReason: "stop_loss",
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner).not.toHaveBeenCalled();
    });
  });

  describe("notifyEngineError", () => {
    it("sends error notification when enabled", async () => {
      notifyEngineError({
        context: "Trade execution: EUR/USD",
        error: "Failed to fetch quote",
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner).toHaveBeenCalledTimes(1);
      expect(mockNotifyOwner.mock.calls[0][0].title).toContain("Bot Error");
      expect(mockNotifyOwner.mock.calls[0][0].content).toContain("Failed to fetch quote");
    });

    it("does NOT send when notifyOnError is disabled", async () => {
      mockConfig.notifications.notifyOnError = false;
      notifyEngineError({
        context: "Scan",
        error: "Some error",
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner).not.toHaveBeenCalled();
    });
  });

  describe("notifyDailySummary", () => {
    it("sends daily summary when enabled", async () => {
      notifyDailySummary({
        balance: 10500,
        dailyPnl: 500,
        tradesPlaced: 5,
        wins: 3,
        losses: 2,
        winRate: 60,
        maxDrawdown: 2.5,
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner).toHaveBeenCalledTimes(1);
      expect(mockNotifyOwner.mock.calls[0][0].title).toContain("Daily Summary");
      expect(mockNotifyOwner.mock.calls[0][0].title).toContain("+$500.00");
      expect(mockNotifyOwner.mock.calls[0][0].content).toContain("$10500.00");
    });

    it("does NOT send when notifyDailySummary is disabled", async () => {
      mockConfig.notifications.notifyDailySummary = false;
      notifyDailySummary({
        balance: 10000,
        dailyPnl: 0,
        tradesPlaced: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        maxDrawdown: 0,
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner).not.toHaveBeenCalled();
    });

    it("formats negative daily P&L correctly", async () => {
      notifyDailySummary({
        balance: 9500,
        dailyPnl: -500,
        tradesPlaced: 3,
        wins: 0,
        losses: 3,
        winRate: 0,
        maxDrawdown: 5,
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNotifyOwner.mock.calls[0][0].title).toContain("-$500.00");
    });
  });
});
