/**
 * Tests for detectEntryConfirmation — candle pattern detection for entry signals
 * 
 * Covers:
 * - Bullish/Bearish Engulfing detection
 * - Pin Bar (Hammer / Shooting Star) detection
 * - Inside Bar Breakout detection
 * - Doji + Follow-Through detection
 * - Morning Star / Evening Star detection
 * - CHoCH on entry timeframe detection
 * - No pattern scenario
 * - Insufficient data handling
 */
import { describe, it, expect } from "vitest";
import {
  detectEntryConfirmation,
  detectReversalCandle,
  type Candle,
  type MarketStructure,
} from "./smcAnalysis";

// Helper to create candle data
function makeCandle(o: number, h: number, l: number, c: number, idx: number = 0): Candle {
  return { datetime: `2024-01-${String(idx + 1).padStart(2, '0')}T00:00:00Z`, open: o, high: h, low: l, close: c };
}

const emptyStructure: MarketStructure = {
  trend: 'bullish',
  swingPoints: [],
  bos: [],
  choch: [],
};

describe("detectEntryConfirmation", () => {
  it("returns insufficient data for less than 4 candles", () => {
    const candles = [makeCandle(1, 2, 0.5, 1.5, 0), makeCandle(1.5, 2, 1, 1.8, 1)];
    const result = detectEntryConfirmation(candles, emptyStructure);
    expect(result.found).toBe(false);
    expect(result.summary).toBe('Insufficient data');
  });

  it("detects Bullish Engulfing", () => {
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.05, 1.1, 0.95, 1.0, 1),
      makeCandle(1.1, 1.15, 0.95, 0.96, 2), // bearish prev
      makeCandle(0.95, 1.2, 0.94, 1.15, 3), // bullish engulfing: open <= prev.close, close >= prev.open
    ];
    const result = detectEntryConfirmation(candles, emptyStructure);
    expect(result.found).toBe(true);
    expect(result.patterns.some(p => p.type === 'Bullish Engulfing')).toBe(true);
    expect(result.patterns.find(p => p.type === 'Bullish Engulfing')?.direction).toBe('bullish');
    expect(result.patterns.find(p => p.type === 'Bullish Engulfing')?.strength).toBe('strong');
  });

  it("detects Bearish Engulfing", () => {
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.05, 1.1, 0.95, 1.0, 1),
      makeCandle(0.95, 1.15, 0.94, 1.1, 2), // bullish prev
      makeCandle(1.11, 1.12, 0.85, 0.9, 3), // bearish engulfing: open >= prev.close, close <= prev.open
    ];
    const result = detectEntryConfirmation(candles, emptyStructure);
    expect(result.found).toBe(true);
    expect(result.patterns.some(p => p.type === 'Bearish Engulfing')).toBe(true);
    expect(result.patterns.find(p => p.type === 'Bearish Engulfing')?.direction).toBe('bearish');
  });

  it("detects Bullish Pin Bar (Hammer)", () => {
    // Pin bar: long lower wick, small body, tiny upper wick
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.05, 1.1, 0.95, 1.0, 1),
      makeCandle(1.0, 1.05, 0.95, 0.98, 2),
      makeCandle(1.05, 1.06, 0.90, 1.05, 3), // body=0, lowerWick=0.15, upperWick=0.01 → lowerWick > body*2
    ];
    // Need: lowerWick > body * 2 AND upperWick < body * 0.5
    // body = |1.05 - 1.05| = 0 → special case, body=0 means any wick > 0 satisfies > body*2
    // Let's use a proper pin bar
    const pinCandles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.05, 1.1, 0.95, 1.0, 1),
      makeCandle(1.0, 1.05, 0.95, 0.98, 2),
      makeCandle(1.00, 1.015, 0.85, 1.01, 3), // body=0.01, lowerWick=1.00-0.85=0.15, upperWick=1.015-1.01=0.005
    ];
    const result = detectEntryConfirmation(pinCandles, emptyStructure);
    expect(result.found).toBe(true);
    expect(result.patterns.some(p => p.type === 'Bullish Pin Bar (Hammer)')).toBe(true);
  });

  it("detects Bearish Pin Bar (Shooting Star)", () => {
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.05, 1.1, 0.95, 1.0, 1),
      makeCandle(1.0, 1.05, 0.95, 1.02, 2),
      makeCandle(1.02, 1.20, 1.015, 1.01, 3), // body=0.01, upperWick=1.20-1.02=0.18, lowerWick=1.01-1.015=-0.005→0
    ];
    const result = detectEntryConfirmation(candles, emptyStructure);
    expect(result.found).toBe(true);
    expect(result.patterns.some(p => p.type === 'Bearish Pin Bar (Shooting Star)')).toBe(true);
  });

  it("detects Inside Bar Breakout (Bullish)", () => {
    // prev2 has wide range, prev is inside prev2, last breaks above prev.high
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.05, 1.1, 0.95, 1.0, 1),       // prev2: range 0.95-1.1
      makeCandle(0.97, 1.05, 0.96, 1.02, 2),      // prev: inside prev2 (high=1.05 <= 1.1, low=0.96 >= 0.95)
      makeCandle(1.03, 1.12, 1.01, 1.08, 3),      // last: close=1.08 > prev.high=1.05 → bullish breakout
    ];
    const result = detectEntryConfirmation(candles, emptyStructure);
    expect(result.found).toBe(true);
    expect(result.patterns.some(p => p.type === 'Inside Bar Breakout (Bullish)')).toBe(true);
  });

  it("detects Inside Bar Breakout (Bearish)", () => {
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.05, 1.1, 0.95, 1.0, 1),       // prev2: range 0.95-1.1
      makeCandle(0.97, 1.05, 0.96, 1.02, 2),      // prev: inside prev2
      makeCandle(1.0, 1.02, 0.90, 0.93, 3),       // last: close=0.93 < prev.low=0.96 → bearish breakout
    ];
    const result = detectEntryConfirmation(candles, emptyStructure);
    expect(result.found).toBe(true);
    expect(result.patterns.some(p => p.type === 'Inside Bar Breakout (Bearish)')).toBe(true);
  });

  it("detects Doji + Bullish Follow-Through", () => {
    // prev is a doji (body < 10% of range), last is bullish with body > 50% of prev range
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.05, 1.1, 0.95, 1.0, 1),
      makeCandle(1.00, 1.05, 0.95, 1.005, 2),     // doji: body=0.005, range=0.10, body/range=0.05 < 0.1
      makeCandle(1.01, 1.10, 1.00, 1.08, 3),      // bullish: body=0.07 > 0.10*0.5=0.05 ✓
    ];
    const result = detectEntryConfirmation(candles, emptyStructure);
    expect(result.found).toBe(true);
    expect(result.patterns.some(p => p.type === 'Doji + Bullish Follow-Through')).toBe(true);
  });

  it("detects Doji + Bearish Follow-Through", () => {
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.05, 1.1, 0.95, 1.0, 1),
      makeCandle(1.00, 1.05, 0.95, 1.005, 2),     // doji
      makeCandle(1.01, 1.02, 0.92, 0.93, 3),      // bearish: body=0.08 > 0.10*0.5=0.05 ✓
    ];
    const result = detectEntryConfirmation(candles, emptyStructure);
    expect(result.found).toBe(true);
    expect(result.patterns.some(p => p.type === 'Doji + Bearish Follow-Through')).toBe(true);
  });

  it("detects Morning Star (3-candle bullish reversal)", () => {
    // c1: large bearish, c2: small body, c3: large bullish closing above c1 midpoint
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),        // filler
      makeCandle(1.10, 1.12, 0.90, 0.92, 1),      // c1 (prev2): large bearish, body=0.18, range=0.22, body/range=0.82 > 0.4 ✓
      makeCandle(0.92, 0.94, 0.90, 0.91, 2),      // c2 (prev): small body=0.01 < 0.18*0.3=0.054 ✓
      makeCandle(0.92, 1.08, 0.91, 1.06, 3),      // c3 (last): bullish, body=0.14 > 0.18*0.5=0.09 ✓, close=1.06 > (1.10+0.92)/2=1.01 ✓
    ];
    const result = detectEntryConfirmation(candles, emptyStructure);
    expect(result.found).toBe(true);
    expect(result.patterns.some(p => p.type === 'Morning Star')).toBe(true);
  });

  it("detects Evening Star (3-candle bearish reversal)", () => {
    // c1: large bullish, c2: small body, c3: large bearish closing below c1 midpoint
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),        // filler
      makeCandle(0.90, 1.12, 0.88, 1.10, 1),      // c1 (prev2): large bullish, body=0.20, range=0.24, body/range=0.83 > 0.4 ✓
      makeCandle(1.10, 1.12, 1.08, 1.11, 2),      // c2 (prev): small body=0.01 < 0.20*0.3=0.06 ✓
      makeCandle(1.10, 1.11, 0.88, 0.92, 3),      // c3 (last): bearish, body=0.18 > 0.20*0.5=0.10 ✓, close=0.92 < (0.90+1.10)/2=1.00 ✓
    ];
    const result = detectEntryConfirmation(candles, emptyStructure);
    expect(result.found).toBe(true);
    expect(result.patterns.some(p => p.type === 'Evening Star')).toBe(true);
  });

  it("detects CHoCH on entry timeframe when recent", () => {
    const structureWithChoch: MarketStructure = {
      trend: 'bullish',
      swingPoints: [],
      bos: [],
      choch: [{ index: 2, type: 'bullish', price: 1.05, datetime: '2024-01-03T00:00:00Z' }],
    };
    // 4 candles → candleCount=4, lastChoch.index=2, 4-5=-1 → 2 >= -1 ✓ (within last 5)
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.05, 1.1, 0.95, 1.0, 1),
      makeCandle(1.0, 1.05, 0.95, 1.02, 2),
      makeCandle(1.02, 1.08, 1.0, 1.06, 3),
    ];
    const result = detectEntryConfirmation(candles, structureWithChoch);
    expect(result.found).toBe(true);
    expect(result.chochOnEntry).toBe(true);
    expect(result.chochType).toBe('bullish');
    expect(result.patterns.some(p => p.type === 'CHoCH (bullish)')).toBe(true);
  });

  it("does NOT detect CHoCH when it's too old", () => {
    const structureWithOldChoch: MarketStructure = {
      trend: 'bullish',
      swingPoints: [],
      bos: [],
      choch: [{ index: 5, type: 'bullish', price: 1.05, datetime: '2024-01-06T00:00:00Z' }],
    };
    // 20 candles → candleCount=20, lastChoch.index=5, 20-5=15 → 5 < 15 ✗ (not within last 5)
    const candles = Array.from({ length: 20 }, (_, i) => makeCandle(1.0 + i * 0.01, 1.1 + i * 0.01, 0.9 + i * 0.01, 1.05 + i * 0.01, i));
    const result = detectEntryConfirmation(candles, structureWithOldChoch);
    expect(result.chochOnEntry).toBe(false);
  });

  it("returns no patterns for neutral candles", () => {
    // All candles are small-bodied, no clear pattern
    const candles = [
      makeCandle(1.00, 1.02, 0.99, 1.01, 0),
      makeCandle(1.01, 1.03, 1.00, 1.02, 1),
      makeCandle(1.02, 1.04, 1.01, 1.03, 2),
      makeCandle(1.03, 1.05, 1.02, 1.04, 3),
    ];
    const result = detectEntryConfirmation(candles, emptyStructure);
    // These are all bullish but tiny, no engulfing/pin bar/inside bar/doji
    expect(result.patterns.length).toBe(0);
    expect(result.found).toBe(false);
    expect(result.summary).toBe('No entry confirmation pattern detected');
  });

  it("summary concatenates multiple patterns", () => {
    // Create a candle that is both engulfing AND at a CHoCH
    const structureWithChoch: MarketStructure = {
      trend: 'bullish',
      swingPoints: [],
      bos: [],
      choch: [{ index: 2, type: 'bullish', price: 1.05, datetime: '2024-01-03T00:00:00Z' }],
    };
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.05, 1.1, 0.95, 1.0, 1),
      makeCandle(1.1, 1.15, 0.95, 0.96, 2), // bearish prev
      makeCandle(0.95, 1.2, 0.94, 1.15, 3), // bullish engulfing
    ];
    const result = detectEntryConfirmation(candles, structureWithChoch);
    expect(result.found).toBe(true);
    expect(result.patterns.length).toBeGreaterThanOrEqual(2);
    expect(result.summary).toContain('Bullish Engulfing');
    expect(result.summary).toContain('CHoCH (bullish)');
    expect(result.summary).toContain(' + ');
  });
});

describe("detectReversalCandle (existing — regression)", () => {
  it("detects Bullish Pin Bar", () => {
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.05, 1.1, 0.95, 1.0, 1),
      makeCandle(1.00, 1.015, 0.85, 1.01, 2),
    ];
    const result = detectReversalCandle(candles);
    expect(result.found).toBe(true);
    expect(result.type).toBe('Bullish Pin Bar');
  });

  it("detects Bearish Pin Bar", () => {
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.05, 1.1, 0.95, 1.0, 1),
      makeCandle(1.02, 1.20, 1.015, 1.01, 2),
    ];
    const result = detectReversalCandle(candles);
    expect(result.found).toBe(true);
    expect(result.type).toBe('Bearish Pin Bar');
  });

  it("detects Bullish Engulfing", () => {
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(1.1, 1.15, 0.95, 0.96, 1), // bearish
      makeCandle(0.95, 1.2, 0.94, 1.15, 2), // bullish engulfing
    ];
    const result = detectReversalCandle(candles);
    expect(result.found).toBe(true);
    expect(result.type).toBe('Bullish Engulfing');
  });

  it("detects Bearish Engulfing", () => {
    const candles = [
      makeCandle(1.0, 1.1, 0.9, 1.05, 0),
      makeCandle(0.95, 1.15, 0.94, 1.1, 1), // bullish
      makeCandle(1.11, 1.12, 0.85, 0.9, 2), // bearish engulfing
    ];
    const result = detectReversalCandle(candles);
    expect(result.found).toBe(true);
    expect(result.type).toBe('Bearish Engulfing');
  });

  it("returns false for no pattern", () => {
    const candles = [
      makeCandle(1.00, 1.02, 0.99, 1.01, 0),
      makeCandle(1.01, 1.03, 1.00, 1.02, 1),
      makeCandle(1.02, 1.04, 1.01, 1.03, 2),
    ];
    const result = detectReversalCandle(candles);
    expect(result.found).toBe(false);
    expect(result.type).toBe('');
  });
});
