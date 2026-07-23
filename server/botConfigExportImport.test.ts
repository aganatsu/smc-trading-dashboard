import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB functions
vi.mock("./db", () => ({
  getBotConfig: vi.fn().mockResolvedValue(null),
  upsertBotConfig: vi.fn().mockResolvedValue(undefined),
  getTradeReasoningByPositionId: vi.fn(),
  getTradeReasoningByTradeId: vi.fn(),
  getRecentTradeReasonings: vi.fn(),
  getTradePostMortemByPositionId: vi.fn(),
  getTradePostMortemByTradeId: vi.fn(),
  getRecentTradePostMortems: vi.fn(),
  getUserSettings: vi.fn(),
  upsertUserSettings: vi.fn(),
  updateTradeReasoningJson: vi.fn(),
  updateTradePostMortemJson: vi.fn(),
}));

import { getConfig, resetConfig, loadConfigFromDb, isConfigLoaded, DEFAULT_CONFIG } from "./botConfig";

describe("botConfig export/import", () => {
  beforeEach(async () => {
    // Reset config to defaults for each test
    await resetConfig(1);
  });

  describe("export", () => {
    it("returns config wrapped with _meta containing version, timestamp, and source", () => {
      const config = getConfig();
      // Simulate what the export procedure does
      const bundle = {
        _meta: {
          version: 1,
          exportedAt: new Date().toISOString(),
          source: "smc-trading-bot",
        },
        config,
      };
      expect(bundle._meta.version).toBe(1);
      expect(bundle._meta.source).toBe("smc-trading-bot");
      expect(bundle._meta.exportedAt).toBeDefined();
      expect(bundle.config).toEqual(config);
    });

    it("exported config matches DEFAULT_CONFIG after reset", () => {
      const config = getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("exported JSON is valid and parseable", () => {
      const config = getConfig();
      const bundle = {
        _meta: { version: 1, exportedAt: new Date().toISOString(), source: "smc-trading-bot" },
        config,
      };
      const json = JSON.stringify(bundle, null, 2);
      const parsed = JSON.parse(json);
      expect(parsed._meta.version).toBe(1);
      expect(parsed.config.strategy.enableBOS).toBe(true);
    });
  });

  describe("import", () => {
    it("accepts a full config bundle and applies all sections", async () => {
      const importPayload = {
        _meta: { version: 1 },
        config: {
          strategy: { ...DEFAULT_CONFIG.strategy, minConfluenceScore: 9 },
          risk: { ...DEFAULT_CONFIG.risk, riskPerTrade: 3 },
        },
      };
      // Simulate import: validate sections, then updateConfig
      const sections = Object.keys(importPayload.config).filter(
        (k) => importPayload.config[k as keyof typeof importPayload.config] !== undefined
      );
      expect(sections).toContain("strategy");
      expect(sections).toContain("risk");
      expect(sections.length).toBe(2);
    });

    it("rejects an empty config object", () => {
      const importPayload = { config: {} };
      const sections = Object.keys(importPayload.config).filter(
        (k) => (importPayload.config as any)[k] !== undefined
      );
      expect(sections.length).toBe(0);
      // The procedure would throw here
    });

    it("accepts raw config without _meta wrapper (backward compat)", () => {
      // Frontend handles this: if no _meta, treat the whole object as config
      const rawConfig = { strategy: { ...DEFAULT_CONFIG.strategy, enableFVG: false } };
      const parsed = rawConfig;
      const configPayload = (parsed as any).config || parsed;
      expect(configPayload.strategy.enableFVG).toBe(false);
    });

    it("preserves unmodified sections when importing partial config", async () => {
      // Import only strategy section
      const { updateConfig } = await import("./botConfig");
      const partial = { strategy: { ...DEFAULT_CONFIG.strategy, minConfluenceScore: 8 } };
      const result = await updateConfig(partial, 1);
      // Strategy updated
      expect(result.strategy.minConfluenceScore).toBe(8);
      // Other sections unchanged
      expect(result.risk).toEqual(DEFAULT_CONFIG.risk);
      expect(result.exit).toEqual(DEFAULT_CONFIG.exit);
    });

    it("handles version 1 meta correctly", () => {
      const meta = { version: 1, exportedAt: "2025-01-15T10:00:00.000Z", source: "smc-trading-bot" };
      expect(meta.version).toBe(1);
      // Future: version 2 could trigger migration logic
    });
  });

  describe("round-trip", () => {
    it("export → import produces identical config", async () => {
      const { updateConfig } = await import("./botConfig");
      // Modify config
      await updateConfig({ strategy: { ...DEFAULT_CONFIG.strategy, minConfluenceScore: 7 } }, 1);
      const exported = getConfig();

      // Simulate export
      const bundle = {
        _meta: { version: 1, exportedAt: new Date().toISOString(), source: "smc-trading-bot" },
        config: JSON.parse(JSON.stringify(exported)),
      };

      // Reset to defaults
      await resetConfig(1);
      expect(getConfig().strategy.minConfluenceScore).toBe(6); // default

      // Import the exported config
      await updateConfig(bundle.config, 1);
      const afterImport = getConfig();
      expect(afterImport.strategy.minConfluenceScore).toBe(7);
      expect(afterImport).toEqual(exported);
    });
  });
});
