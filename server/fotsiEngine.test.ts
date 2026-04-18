import { describe, expect, it, beforeEach } from "vitest";
import {
  getFOTSIConfig,
  updateFOTSIConfig,
  resetFOTSIConfig,
  getCachedFOTSI,
  clearFOTSICache,
  CURRENCIES,
  FOTSI_PAIRS,
  FOTSI_OVERBOUGHT,
  FOTSI_OVERSOLD,
  FOTSI_NEUTRAL_UPPER,
  FOTSI_NEUTRAL_LOWER,
  type FOTSIBotConfig,
  type FOTSIStrength,
  type FOTSIResult,
} from "./fotsiEngine";

// ─── Constants Tests ───────────────────────────────────────────────

describe("FOTSI constants", () => {
  it("has exactly 8 currencies", () => {
    expect(CURRENCIES).toHaveLength(8);
    expect(CURRENCIES).toContain("USD");
    expect(CURRENCIES).toContain("EUR");
    expect(CURRENCIES).toContain("GBP");
    expect(CURRENCIES).toContain("JPY");
    expect(CURRENCIES).toContain("AUD");
    expect(CURRENCIES).toContain("CAD");
    expect(CURRENCIES).toContain("CHF");
    expect(CURRENCIES).toContain("NZD");
  });

  it("has exactly 28 unique pairs", () => {
    expect(FOTSI_PAIRS).toHaveLength(28);
    // Verify uniqueness
    const pairNames = FOTSI_PAIRS.map(([p]) => p);
    expect(new Set(pairNames).size).toBe(28);
  });

  it("each pair has valid base/quote from CURRENCIES", () => {
    for (const [pair, base, quote] of FOTSI_PAIRS) {
      expect(CURRENCIES).toContain(base);
      expect(CURRENCIES).toContain(quote);
      expect(base).not.toBe(quote);
      expect(pair).toContain("/");
    }
  });

  it("has correct OB/OS thresholds", () => {
    expect(FOTSI_OVERBOUGHT).toBe(50);
    expect(FOTSI_OVERSOLD).toBe(-50);
    expect(FOTSI_NEUTRAL_UPPER).toBe(25);
    expect(FOTSI_NEUTRAL_LOWER).toBe(-25);
  });
});

// ─── Config Management Tests ───────────────────────────────────────

describe("FOTSI Config", () => {
  beforeEach(() => {
    resetFOTSIConfig();
  });

  it("returns default config with expected structure", () => {
    const config = getFOTSIConfig();
    expect(config).toBeDefined();
    expect(config.enabled).toBe(false);
    expect(config.minDivergenceSpread).toBe(40);
    expect(config.hookRequired).toBe(true);
    expect(config.hookBars).toBe(3);
    expect(config.minExtremeLevel).toBe(25);
    expect(config.riskPerTrade).toBe(1);
    expect(config.maxConcurrent).toBe(3);
    expect(config.cooldownMinutes).toBe(240);
    expect(config.maxDailyLoss).toBe(3);
    expect(config.maxDailyTrades).toBe(5);
    expect(config.slMethod).toBe("atr");
    expect(config.slATRMultiplier).toBe(2);
    expect(config.slFixedPips).toBe(50);
    expect(config.minRR).toBe(2);
    expect(config.tp1Method).toBe("ema50");
    expect(config.tp2Method).toBe("ema100");
    expect(config.tp1RR).toBe(1.5);
    expect(config.tp2RR).toBe(3);
    expect(config.partialClosePercent).toBe(50);
    expect(config.maxHoldHours).toBe(48);
    expect(config.breakEvenAfterTP1).toBe(true);
    expect(config.entryTimeframe).toBe("4h");
  });

  it("returns default session config", () => {
    const config = getFOTSIConfig();
    expect(config.sessions).toEqual({
      london: true,
      newYork: true,
      asian: false,
      sydney: false,
    });
  });

  it("updates config partially, preserving other fields", () => {
    const updated = updateFOTSIConfig({ enabled: true, riskPerTrade: 2 });
    expect(updated.enabled).toBe(true);
    expect(updated.riskPerTrade).toBe(2);
    // Other fields remain default
    expect(updated.minDivergenceSpread).toBe(40);
    expect(updated.hookRequired).toBe(true);
    expect(updated.maxConcurrent).toBe(3);
  });

  it("updates nested sessions config, preserving other sessions", () => {
    const updated = updateFOTSIConfig({ sessions: { asian: true, sydney: true } });
    expect(updated.sessions.asian).toBe(true);
    expect(updated.sessions.sydney).toBe(true);
    // Original session values preserved
    expect(updated.sessions.london).toBe(true);
    expect(updated.sessions.newYork).toBe(true);
  });

  it("persists multiple sequential updates", () => {
    updateFOTSIConfig({ enabled: true });
    updateFOTSIConfig({ riskPerTrade: 3 });
    updateFOTSIConfig({ maxConcurrent: 5 });
    const config = getFOTSIConfig();
    expect(config.enabled).toBe(true);
    expect(config.riskPerTrade).toBe(3);
    expect(config.maxConcurrent).toBe(5);
  });

  it("resets config to defaults", () => {
    updateFOTSIConfig({ enabled: true, riskPerTrade: 5, maxConcurrent: 10 });
    const reset = resetFOTSIConfig();
    expect(reset.enabled).toBe(false);
    expect(reset.riskPerTrade).toBe(1);
    expect(reset.maxConcurrent).toBe(3);
  });

  it("updates SL method and related fields", () => {
    const updated = updateFOTSIConfig({ slMethod: "fixed", slFixedPips: 80 });
    expect(updated.slMethod).toBe("fixed");
    expect(updated.slFixedPips).toBe(80);
    // ATR multiplier still has its default
    expect(updated.slATRMultiplier).toBe(2);
  });

  it("updates TP methods", () => {
    const updated = updateFOTSIConfig({
      tp1Method: "fixed_rr",
      tp1RR: 2,
      tp2Method: "fixed_rr",
      tp2RR: 4,
    });
    expect(updated.tp1Method).toBe("fixed_rr");
    expect(updated.tp1RR).toBe(2);
    expect(updated.tp2Method).toBe("fixed_rr");
    expect(updated.tp2RR).toBe(4);
  });
});

// ─── Cache Tests ───────────────────────────────────────────────────

describe("FOTSI Cache", () => {
  beforeEach(() => {
    clearFOTSICache();
  });

  it("returns null when no computation has been done", () => {
    const cached = getCachedFOTSI();
    expect(cached).toBeNull();
  });

  it("returns null after clearing cache", () => {
    clearFOTSICache();
    expect(getCachedFOTSI()).toBeNull();
  });
});
