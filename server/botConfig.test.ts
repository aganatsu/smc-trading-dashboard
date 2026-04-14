import { describe, expect, it, beforeEach } from "vitest";
import {
  getConfig,
  updateConfig,
  resetConfig,
  validateTradeAgainstConfig,
} from "./botConfig";

describe("Bot Configuration", () => {
  beforeEach(() => {
    resetConfig();
  });

  describe("getConfig", () => {
    it("returns default config", () => {
      const cfg = getConfig();
      expect(cfg.strategy.minConfluenceScore).toBe(6);
      expect(cfg.risk.maxOpenPositions).toBe(5);
      expect(cfg.risk.minRiskReward).toBe(1.5);
      expect(cfg.risk.riskPerTrade).toBe(1);
      expect(cfg.account.startingBalance).toBe(10000);
      expect(cfg.account.mode).toBe("paper");
    });
  });

  describe("updateConfig", () => {
    it("updates strategy settings partially", () => {
      updateConfig({ strategy: { minConfluenceScore: 3 } as any });
      const cfg = getConfig();
      expect(cfg.strategy.minConfluenceScore).toBe(3);
      // Other strategy settings should remain default
      expect(cfg.strategy.enableBOS).toBe(true);
    });

    it("updates risk settings partially", () => {
      updateConfig({ risk: { maxOpenPositions: 10, minRiskReward: 2 } as any });
      const cfg = getConfig();
      expect(cfg.risk.maxOpenPositions).toBe(10);
      expect(cfg.risk.minRiskReward).toBe(2);
      // Other risk settings should remain default
      expect(cfg.risk.riskPerTrade).toBe(1);
    });

    it("updates instrument filter", () => {
      updateConfig({
        instruments: {
          allowedInstruments: { "EUR/USD": false },
        } as any,
      });
      const cfg = getConfig();
      expect(cfg.instruments.allowedInstruments["EUR/USD"]).toBe(false);
    });
  });

  describe("resetConfig", () => {
    it("resets to default values", () => {
      updateConfig({ risk: { maxOpenPositions: 99 } as any });
      expect(getConfig().risk.maxOpenPositions).toBe(99);
      resetConfig();
      expect(getConfig().risk.maxOpenPositions).toBe(5);
    });
  });

  describe("validateTradeAgainstConfig", () => {
    const baseParams = {
      symbol: "EUR/USD",
      direction: "long" as const,
      size: 0.1,
      entryPrice: 1.085,
      currentPositions: 0,
      positionsForSymbol: 0,
      portfolioHeatPercent: 0,
      dailyLossPercent: 0,
      drawdownPercent: 0,
      confluenceScore: 8,
    };

    it("allows valid trade", () => {
      const result = validateTradeAgainstConfig(baseParams);
      expect(result.allowed).toBe(true);
    });

    it("rejects disabled instrument", () => {
      updateConfig({
        instruments: {
          allowedInstruments: { "EUR/USD": false },
        } as any,
      });
      const result = validateTradeAgainstConfig(baseParams);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("disabled");
    });

    it("rejects when max open positions reached", () => {
      const result = validateTradeAgainstConfig({
        ...baseParams,
        currentPositions: 5, // default max is 5
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Max open positions");
    });

    it("rejects when max positions per symbol reached", () => {
      const result = validateTradeAgainstConfig({
        ...baseParams,
        positionsForSymbol: 2, // default max is 2
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Max positions per symbol");
    });

    it("rejects when portfolio heat exceeds max", () => {
      const result = validateTradeAgainstConfig({
        ...baseParams,
        portfolioHeatPercent: 15, // default max is 10
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Portfolio heat");
    });

    it("rejects when daily loss limit reached", () => {
      const result = validateTradeAgainstConfig({
        ...baseParams,
        dailyLossPercent: 6, // default max is 5
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Daily loss limit");
    });

    it("rejects when max drawdown reached", () => {
      const result = validateTradeAgainstConfig({
        ...baseParams,
        drawdownPercent: 25, // default max is 20
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Max drawdown");
    });

    it("rejects when confluence score too low", () => {
      const result = validateTradeAgainstConfig({
        ...baseParams,
        confluenceScore: 3, // default min is 6
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Confluence score");
    });

    it("rejects when R:R ratio too low", () => {
      const result = validateTradeAgainstConfig({
        ...baseParams,
        stopLoss: 1.08,
        takeProfit: 1.09,
        // R:R = 0.005/0.005 = 1.0, default min is 1.5
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("R:R ratio");
    });

    it("allows trade with good R:R", () => {
      const result = validateTradeAgainstConfig({
        ...baseParams,
        stopLoss: 1.08,
        takeProfit: 1.10,
        // R:R = 0.015/0.005 = 3.0, above 1.5 min
      });
      expect(result.allowed).toBe(true);
    });

    it("allows trade after relaxing config", () => {
      updateConfig({
        strategy: { minConfluenceScore: 0 } as any,
        risk: { minRiskReward: 0, maxOpenPositions: 100 } as any,
      });
      const result = validateTradeAgainstConfig({
        ...baseParams,
        confluenceScore: 0,
        currentPositions: 50,
      });
      expect(result.allowed).toBe(true);
    });
  });
});
