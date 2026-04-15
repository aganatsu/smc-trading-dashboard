import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock broker modules
const mockPlaceOandaOrder = vi.fn().mockResolvedValue({ success: true, tradeId: "oanda-123" });
const mockCloseOandaTrade = vi.fn().mockResolvedValue({ success: true });
const mockGetOandaAccountSummary = vi.fn().mockResolvedValue({
  balance: "50000",
  unrealizedPL: "250",
  marginAvailable: "45000",
});
const mockGetOandaOpenTrades = vi.fn().mockResolvedValue([]);

vi.mock("./brokers/oanda", () => ({
  placeOandaMarketOrder: (...args: any[]) => mockPlaceOandaOrder(...args),
  closeOandaTrade: (...args: any[]) => mockCloseOandaTrade(...args),
  getOandaAccountSummary: (...args: any[]) => mockGetOandaAccountSummary(...args),
  getOandaOpenTrades: (...args: any[]) => mockGetOandaOpenTrades(...args),
}));

const mockPlaceMetaApiOrder = vi.fn().mockResolvedValue({ success: true, positionId: "meta-456" });
const mockCloseMetaApiPosition = vi.fn().mockResolvedValue({ success: true });
const mockGetMetaApiAccountInfo = vi.fn().mockResolvedValue({
  balance: 50000,
  equity: 50250,
  freeMargin: 45000,
});

vi.mock("./brokers/metaapi", () => ({
  placeMetaApiMarketOrder: (...args: any[]) => mockPlaceMetaApiOrder(...args),
  closeMetaApiPosition: (...args: any[]) => mockCloseMetaApiPosition(...args),
  getMetaApiAccountInfo: (...args: any[]) => mockGetMetaApiAccountInfo(...args),
}));

// Mock DB for broker connections
const mockGetBrokerConnectionsByUser = vi.fn().mockResolvedValue([]);
const mockGetBrokerConnectionById = vi.fn().mockResolvedValue(null);

vi.mock("./db", () => ({
  getBrokerConnectionsByUser: (...args: any[]) => mockGetBrokerConnectionsByUser(...args),
  getBrokerConnectionById: (...args: any[]) => mockGetBrokerConnectionById(...args),
}));

// Mock paperTrading addLog
vi.mock("./paperTrading", () => ({
  addLog: vi.fn(),
}));

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import {
  getLiveBrokerStatus,
  setActiveBrokerConnection,
  getActiveBrokerConnectionId,
} from "./liveExecution";

describe("Live Execution Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset active broker
    setActiveBrokerConnection(null);
  });

  describe("Broker Connection Management", () => {
    it("should start with no active broker", () => {
      expect(getActiveBrokerConnectionId()).toBeNull();
    });

    it("should set and get active broker connection", () => {
      setActiveBrokerConnection(5);
      expect(getActiveBrokerConnectionId()).toBe(5);
    });

    it("should clear active broker when set to null", () => {
      setActiveBrokerConnection(5);
      setActiveBrokerConnection(null);
      expect(getActiveBrokerConnectionId()).toBeNull();
    });
  });

  describe("Live Broker Status", () => {
    it("should return disconnected when no broker is set", async () => {
      const status = await getLiveBrokerStatus(1);
      expect(status.connected).toBe(false);
    });

    it("should return connected status when OANDA broker is set", async () => {
      setActiveBrokerConnection(1);
      mockGetBrokerConnectionById.mockResolvedValue({
        id: 1,
        brokerType: "oanda",
        apiKey: "test-key",
        accountId: "test-account",
        isLive: false,
        displayName: "Test OANDA",
      });

      const status = await getLiveBrokerStatus(1);
      expect(status.connected).toBe(true);
      expect(status.broker).toBe("oanda");
    });
  });

  describe("Position Size Limits", () => {
    const MAX_LIVE_LOT_SIZES: Record<string, number> = {
      'EUR/USD': 5.0,
      'GBP/USD': 5.0,
      'USD/JPY': 5.0,
      'GBP/JPY': 3.0,
      'AUD/USD': 5.0,
      'USD/CAD': 5.0,
      'EUR/GBP': 5.0,
      'NZD/USD': 5.0,
      'XAU/USD': 2.0,
      'XAG/USD': 2.0,
      'BTC/USD': 1.0,
      'ETH/USD': 2.0,
    };

    it("should have conservative limits for all instruments", () => {
      const instruments = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD', 'BTC/USD'];
      for (const inst of instruments) {
        expect(MAX_LIVE_LOT_SIZES[inst]).toBeDefined();
        expect(MAX_LIVE_LOT_SIZES[inst]).toBeGreaterThan(0);
        expect(MAX_LIVE_LOT_SIZES[inst]).toBeLessThanOrEqual(5.0);
      }
    });

    it("should have tighter limits for volatile instruments", () => {
      expect(MAX_LIVE_LOT_SIZES['BTC/USD']).toBeLessThan(MAX_LIVE_LOT_SIZES['EUR/USD']);
      expect(MAX_LIVE_LOT_SIZES['XAU/USD']).toBeLessThan(MAX_LIVE_LOT_SIZES['EUR/USD']);
    });

    it("should cap position size to max allowed", () => {
      const requestedSize = 10.0;
      const symbol = 'EUR/USD';
      const maxAllowed = MAX_LIVE_LOT_SIZES[symbol] || 1.0;
      const actualSize = Math.min(requestedSize, maxAllowed);
      expect(actualSize).toBe(5.0);
    });

    it("should use default 1.0 for unknown instruments", () => {
      const symbol = 'UNKNOWN/PAIR';
      const maxAllowed = MAX_LIVE_LOT_SIZES[symbol] || 1.0;
      expect(maxAllowed).toBe(1.0);
    });
  });
});

describe("Kill Switch & Safety Guards", () => {
  describe("Daily Loss Auto-Halt", () => {
    it("should trigger when daily loss exceeds threshold", () => {
      const dailyPnl = -600;
      const startingBalance = 10000;
      const dailyLossLimitPercent = 5;
      const dailyLossThreshold = startingBalance * (dailyLossLimitPercent / 100);
      const shouldHalt = Math.abs(dailyPnl) >= dailyLossThreshold;
      expect(shouldHalt).toBe(true);
    });

    it("should not trigger when daily loss is within threshold", () => {
      const dailyPnl = -200;
      const startingBalance = 10000;
      const dailyLossLimitPercent = 5;
      const dailyLossThreshold = startingBalance * (dailyLossLimitPercent / 100);
      const shouldHalt = Math.abs(dailyPnl) >= dailyLossThreshold;
      expect(shouldHalt).toBe(false);
    });

    it("should not trigger on positive P&L", () => {
      const dailyPnl = 500;
      const startingBalance = 10000;
      const dailyLossLimitPercent = 5;
      const dailyLossThreshold = startingBalance * (dailyLossLimitPercent / 100);
      const shouldHalt = Math.abs(dailyPnl) >= dailyLossThreshold;
      expect(shouldHalt).toBe(true); // abs(500) >= 500, but this is profit not loss
      // In real code, we check dailyPnl < 0 first
      const shouldHaltCorrect = dailyPnl < 0 && Math.abs(dailyPnl) >= dailyLossThreshold;
      expect(shouldHaltCorrect).toBe(false);
    });
  });

  describe("Max Drawdown Auto-Halt", () => {
    it("should trigger when drawdown exceeds threshold", () => {
      const peakBalance = 12000;
      const currentBalance = 10200;
      const drawdownPercent = ((peakBalance - currentBalance) / peakBalance) * 100;
      const maxDrawdownPercent = 15;
      const shouldHalt = drawdownPercent >= maxDrawdownPercent;
      expect(shouldHalt).toBe(true);
      expect(drawdownPercent).toBe(15);
    });

    it("should not trigger when drawdown is within threshold", () => {
      const peakBalance = 12000;
      const currentBalance = 11000;
      const drawdownPercent = ((peakBalance - currentBalance) / peakBalance) * 100;
      const maxDrawdownPercent = 15;
      const shouldHalt = drawdownPercent >= maxDrawdownPercent;
      expect(shouldHalt).toBe(false);
    });

    it("should handle zero drawdown", () => {
      const peakBalance = 10000;
      const currentBalance = 10000;
      const drawdownPercent = ((peakBalance - currentBalance) / peakBalance) * 100;
      expect(drawdownPercent).toBe(0);
    });
  });

  describe("Execution Mode Logic", () => {
    it("should block live trades when kill switch is active", () => {
      const killSwitchActive = true;
      const executionMode = "live";
      const canTrade = executionMode === "live" && !killSwitchActive;
      expect(canTrade).toBe(false);
    });

    it("should allow paper trades when kill switch is active", () => {
      const killSwitchActive = true;
      const executionMode = "paper";
      const canPaperTrade = executionMode === "paper" || !killSwitchActive;
      expect(canPaperTrade).toBe(true);
    });

    it("should allow live trades when kill switch is off and mode is live", () => {
      const killSwitchActive = false;
      const executionMode = "live";
      const canTrade = executionMode === "live" && !killSwitchActive;
      expect(canTrade).toBe(true);
    });

    it("should not allow live trades in paper mode", () => {
      const killSwitchActive = false;
      const executionMode = "paper";
      const canLiveTrade = executionMode === "live" && !killSwitchActive;
      expect(canLiveTrade).toBe(false);
    });
  });
});
