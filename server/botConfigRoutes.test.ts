import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import { resetConfig, getConfig } from "./botConfig";
import { resetAccount, setOwnerUserId, stopEngine } from "./paperTrading";

// Create an authenticated caller context
function createAuthContext() {
  return {
    user: { id: 1, openId: "test-open-id", name: "Test User", role: "admin" as const },
  };
}

describe("Bot Config tRPC Routes", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    resetConfig();
    resetAccount();
    setOwnerUserId(1);
    caller = appRouter.createCaller(createAuthContext());
  });

  afterEach(() => {
    stopEngine();
    resetConfig();
  });

  describe("botConfig.get", () => {
    it("returns default config", async () => {
      const config = await caller.botConfig.get();
      expect(config).toBeDefined();
      expect(config.strategy).toBeDefined();
      expect(config.risk).toBeDefined();
      expect(config.entry).toBeDefined();
      expect(config.exit).toBeDefined();
      expect(config.instruments).toBeDefined();
      expect(config.sessions).toBeDefined();
      expect(config.notifications).toBeDefined();
      expect(config.protection).toBeDefined();
      expect(config.account).toBeDefined();
      // Check some defaults
      expect(config.strategy.minConfluenceScore).toBe(6);
      expect(config.risk.maxOpenPositions).toBe(5);
      expect(config.account.mode).toBe("paper");
    });
  });

  describe("botConfig.update", () => {
    it("updates strategy settings", async () => {
      await caller.botConfig.update({
        strategy: { minConfluenceScore: 3 },
      });
      const config = await caller.botConfig.get();
      expect(config.strategy.minConfluenceScore).toBe(3);
      // Other fields preserved
      expect(config.strategy.enableBOS).toBe(true);
    });

    it("updates risk settings", async () => {
      await caller.botConfig.update({
        risk: { maxOpenPositions: 10, minRiskReward: 2.5 },
      });
      const config = await caller.botConfig.get();
      expect(config.risk.maxOpenPositions).toBe(10);
      expect(config.risk.minRiskReward).toBe(2.5);
      expect(config.risk.riskPerTrade).toBe(1); // preserved
    });

    it("updates instrument filter", async () => {
      await caller.botConfig.update({
        instruments: {
          allowedInstruments: { "EUR/USD": false },
        },
      });
      const config = await caller.botConfig.get();
      expect(config.instruments.allowedInstruments["EUR/USD"]).toBe(false);
    });

    it("updates multiple sections at once", async () => {
      await caller.botConfig.update({
        strategy: { minConfluenceScore: 2 },
        risk: { riskPerTrade: 2 },
        notifications: { onTrade: false },
      });
      const config = await caller.botConfig.get();
      expect(config.strategy.minConfluenceScore).toBe(2);
      expect(config.risk.riskPerTrade).toBe(2);
      expect(config.notifications.onTrade).toBe(false);
    });
  });

  describe("botConfig.reset", () => {
    it("resets config to defaults", async () => {
      // Change something first
      await caller.botConfig.update({
        risk: { maxOpenPositions: 99 },
      });
      expect((await caller.botConfig.get()).risk.maxOpenPositions).toBe(99);

      // Reset
      await caller.botConfig.reset();
      const config = await caller.botConfig.get();
      expect(config.risk.maxOpenPositions).toBe(5);
      expect(config.strategy.minConfluenceScore).toBe(6);
    });
  });

  describe("Config enforcement on trades", () => {
    it("rejects paper trade when instrument is disabled", async () => {
      // Relax other limits but disable EUR/USD
      await caller.botConfig.update({
        strategy: { minConfluenceScore: 0 },
        risk: { minRiskReward: 0 },
        instruments: { allowedInstruments: { "EUR/USD": false } },
      });

      const result = await caller.paper.placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.01,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("disabled");
    });

    it("rejects pending order when instrument is disabled", async () => {
      await caller.botConfig.update({
        strategy: { minConfluenceScore: 0 },
        risk: { minRiskReward: 0 },
        instruments: { allowedInstruments: { "GBP/USD": false } },
      });

      const result = await caller.paper.placePendingOrder({
        symbol: "GBP/USD",
        direction: "long",
        size: 0.01,
        triggerPrice: 1.25,
        orderType: "buy_limit",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("disabled");
    });

    it("allows trade when config is relaxed", async () => {
      await caller.botConfig.update({
        strategy: { minConfluenceScore: 0 },
        risk: { minRiskReward: 0 },
      });

      const result = await caller.paper.placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.01,
      });
      expect(result.success).toBe(true);
    }, 15000);
  });
});
