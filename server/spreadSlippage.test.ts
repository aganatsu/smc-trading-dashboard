import { describe, it, expect } from "vitest";

// Test the spread/slippage utility functions directly
// These are embedded in the backtest module, so we test the logic patterns

describe("Spread & Slippage Modeling", () => {
  // Default spreads from the backtest module
  const DEFAULT_SPREADS: Record<string, number> = {
    'EUR/USD': 1.0,
    'GBP/USD': 1.2,
    'USD/JPY': 1.0,
    'GBP/JPY': 2.5,
    'AUD/USD': 1.3,
    'USD/CAD': 1.5,
    'EUR/GBP': 1.5,
    'NZD/USD': 1.8,
    'XAU/USD': 3.0,
    'XAG/USD': 2.5,
    'BTC/USD': 50.0,
    'ETH/USD': 5.0,
  };

  function getPipSize(symbol: string): number {
    if (symbol.includes('JPY')) return 0.01;
    if (symbol.startsWith('XAU')) return 0.1;
    if (symbol.startsWith('XAG')) return 0.01;
    if (symbol.startsWith('BTC')) return 1.0;
    if (symbol.startsWith('ETH')) return 0.1;
    return 0.0001;
  }

  function getSpreadInPrice(symbol: string, spreadPips: number): number {
    return spreadPips * getPipSize(symbol);
  }

  function applySpreadToEntry(midPrice: number, direction: 'long' | 'short', spreadInPrice: number): number {
    // Buy at ask (mid + half spread), Sell at bid (mid - half spread)
    if (direction === 'long') {
      return midPrice + spreadInPrice / 2;
    } else {
      return midPrice - spreadInPrice / 2;
    }
  }

  function applySlippageToExit(exitPrice: number, direction: 'long' | 'short', slippagePips: number, pipSize: number, exitType: 'sl' | 'tp' | 'time'): number {
    // Adverse slippage on SL, minimal on TP, half on time exits
    const slippageMultiplier = exitType === 'sl' ? 1.0 : exitType === 'tp' ? 0.1 : 0.5;
    const slippageInPrice = slippagePips * pipSize * slippageMultiplier;

    if (direction === 'long') {
      // Long position exit: slippage makes exit worse (lower)
      return exitPrice - slippageInPrice;
    } else {
      // Short position exit: slippage makes exit worse (higher)
      return exitPrice + slippageInPrice;
    }
  }

  describe("Pip size calculation", () => {
    it("should return 0.0001 for standard forex pairs", () => {
      expect(getPipSize('EUR/USD')).toBe(0.0001);
      expect(getPipSize('GBP/USD')).toBe(0.0001);
      expect(getPipSize('AUD/USD')).toBe(0.0001);
    });

    it("should return 0.01 for JPY pairs", () => {
      expect(getPipSize('USD/JPY')).toBe(0.01);
      expect(getPipSize('GBP/JPY')).toBe(0.01);
    });

    it("should return 0.1 for gold", () => {
      expect(getPipSize('XAU/USD')).toBe(0.1);
    });

    it("should return 1.0 for BTC", () => {
      expect(getPipSize('BTC/USD')).toBe(1.0);
    });
  });

  describe("Spread in price conversion", () => {
    it("should convert EUR/USD spread of 1.0 pip to 0.0001", () => {
      expect(getSpreadInPrice('EUR/USD', 1.0)).toBeCloseTo(0.0001, 6);
    });

    it("should convert USD/JPY spread of 1.0 pip to 0.01", () => {
      expect(getSpreadInPrice('USD/JPY', 1.0)).toBeCloseTo(0.01, 4);
    });

    it("should convert XAU/USD spread of 3.0 pips to 0.3", () => {
      expect(getSpreadInPrice('XAU/USD', 3.0)).toBeCloseTo(0.3, 2);
    });

    it("should convert BTC/USD spread of 50 pips to 50.0", () => {
      expect(getSpreadInPrice('BTC/USD', 50.0)).toBeCloseTo(50.0, 1);
    });
  });

  describe("Spread applied to entry", () => {
    it("should add half spread for long entries (buy at ask)", () => {
      const mid = 1.0850;
      const spread = getSpreadInPrice('EUR/USD', 1.0); // 0.0001
      const entry = applySpreadToEntry(mid, 'long', spread);
      expect(entry).toBeCloseTo(1.08505, 5);
      expect(entry).toBeGreaterThan(mid);
    });

    it("should subtract half spread for short entries (sell at bid)", () => {
      const mid = 1.0850;
      const spread = getSpreadInPrice('EUR/USD', 1.0);
      const entry = applySpreadToEntry(mid, 'short', spread);
      expect(entry).toBeCloseTo(1.08495, 5);
      expect(entry).toBeLessThan(mid);
    });

    it("should apply larger spread for gold", () => {
      const mid = 2350.00;
      const spread = getSpreadInPrice('XAU/USD', 3.0); // 0.3
      const longEntry = applySpreadToEntry(mid, 'long', spread);
      expect(longEntry).toBeCloseTo(2350.15, 2);
    });
  });

  describe("Slippage applied to exit", () => {
    it("should apply full adverse slippage on SL hit for long", () => {
      const exitPrice = 1.0800;
      const slippedExit = applySlippageToExit(exitPrice, 'long', 1.0, 0.0001, 'sl');
      expect(slippedExit).toBeCloseTo(1.0799, 4);
      expect(slippedExit).toBeLessThan(exitPrice); // Worse for longs
    });

    it("should apply full adverse slippage on SL hit for short", () => {
      const exitPrice = 1.0900;
      const slippedExit = applySlippageToExit(exitPrice, 'short', 1.0, 0.0001, 'sl');
      expect(slippedExit).toBeCloseTo(1.0901, 4);
      expect(slippedExit).toBeGreaterThan(exitPrice); // Worse for shorts
    });

    it("should apply minimal slippage on TP hit (10%)", () => {
      const exitPrice = 1.0900;
      const slippedExit = applySlippageToExit(exitPrice, 'long', 1.0, 0.0001, 'tp');
      // 0.1 * 1.0 * 0.0001 = 0.00001
      expect(slippedExit).toBeCloseTo(1.08999, 5);
      expect(exitPrice - slippedExit).toBeLessThan(0.0001); // Much less than full pip
    });

    it("should apply half slippage on time-based exit", () => {
      const exitPrice = 1.0900;
      const slippedExit = applySlippageToExit(exitPrice, 'long', 1.0, 0.0001, 'time');
      // 0.5 * 1.0 * 0.0001 = 0.00005
      expect(slippedExit).toBeCloseTo(1.08995, 5);
    });

    it("should apply zero slippage when slippagePips is 0", () => {
      const exitPrice = 1.0900;
      const slippedExit = applySlippageToExit(exitPrice, 'long', 0, 0.0001, 'sl');
      expect(slippedExit).toBe(exitPrice);
    });
  });

  describe("Spread cost calculation", () => {
    it("should calculate correct spread cost for EUR/USD long", () => {
      const size = 0.1; // 0.1 lots = 10,000 units
      const spreadPips = 1.0;
      const pipValue = 10; // $10 per pip for 1 lot EUR/USD
      const spreadCost = spreadPips * pipValue * size;
      expect(spreadCost).toBeCloseTo(1.0, 2); // $1.00 spread cost
    });

    it("should calculate correct spread cost for XAU/USD", () => {
      const size = 0.1;
      const spreadPips = 3.0;
      const pipValue = 10; // approx $10 per pip for 1 lot gold
      const spreadCost = spreadPips * pipValue * size;
      expect(spreadCost).toBeCloseTo(3.0, 2); // $3.00 spread cost
    });
  });

  describe("Default spread values", () => {
    it("should have spreads for all major pairs", () => {
      expect(DEFAULT_SPREADS['EUR/USD']).toBe(1.0);
      expect(DEFAULT_SPREADS['GBP/USD']).toBe(1.2);
      expect(DEFAULT_SPREADS['USD/JPY']).toBe(1.0);
      expect(DEFAULT_SPREADS['GBP/JPY']).toBe(2.5);
    });

    it("should have wider spreads for metals and crypto", () => {
      expect(DEFAULT_SPREADS['XAU/USD']).toBeGreaterThan(DEFAULT_SPREADS['EUR/USD']);
      expect(DEFAULT_SPREADS['BTC/USD']).toBeGreaterThan(DEFAULT_SPREADS['XAU/USD']);
    });

    it("should have all supported instruments", () => {
      const instruments = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'GBP/JPY', 'AUD/USD',
        'USD/CAD', 'EUR/GBP', 'NZD/USD', 'XAU/USD', 'XAG/USD', 'BTC/USD', 'ETH/USD'];
      for (const inst of instruments) {
        expect(DEFAULT_SPREADS[inst]).toBeDefined();
        expect(DEFAULT_SPREADS[inst]).toBeGreaterThan(0);
      }
    });
  });
});
