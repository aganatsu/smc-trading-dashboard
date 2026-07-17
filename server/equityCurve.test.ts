/**
 * Tests for equity curve data transformation logic
 * Verifies: formatMoney, getTimeRangeMs, equityChartData computation,
 * Y-axis domain function, and initialBalance integration.
 */
import { describe, expect, it } from "vitest";

// ─── Re-implement the pure functions from DashboardView for testing ───

function formatMoney(val: number, showSign = false): string {
  const abs = Math.abs(val);
  const decimals = abs >= 1000 ? 0 : 2;
  const str =
    abs >= 1000
      ? `$${abs.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
      : `$${abs.toFixed(2)}`;
  if (showSign) return val >= 0 ? `+${str}` : `-${str}`;
  return str;
}

type TimeRange = "1W" | "1M" | "3M" | "6M" | "ALL";

function getTimeRangeMs(range: TimeRange): number {
  const day = 86400000;
  switch (range) {
    case "1W": return 7 * day;
    case "1M": return 30 * day;
    case "3M": return 90 * day;
    case "6M": return 180 * day;
    case "ALL": return Infinity;
  }
}

/**
 * Extracted equity chart data computation logic (mirrors DashboardView useMemo)
 */
function computeEquityChartData(
  rawData: Array<{ date: string; pnl: number; cumulative: number }>,
  timeRange: TimeRange,
  startingBalance: number
) {
  if (!rawData?.length) return [];

  const now = Date.now();
  const cutoff = now - getTimeRangeMs(timeRange);

  // Filter by time range
  const filtered = rawData.filter((d) => {
    if (timeRange === "ALL") return true;
    const ts = d.date ? new Date(d.date).getTime() : 0;
    return ts >= cutoff;
  });

  if (filtered.length === 0) return [];

  // Recalculate cumulative from filtered set
  let cumulative = startingBalance;
  let peak = startingBalance;

  // We need to recalculate from the beginning to get correct cumulative
  let preCumulative = startingBalance;
  for (const item of rawData) {
    const pnl = item.pnl ?? 0;
    preCumulative += pnl;
    if (item === filtered[0]) {
      cumulative = preCumulative - pnl; // start before first filtered item
      peak = cumulative;
      break;
    }
  }

  return filtered.map((d) => {
    cumulative += d.pnl ?? 0;
    peak = Math.max(peak, cumulative);
    const drawdown = peak > 0 ? ((cumulative - peak) / peak) * 100 : 0;
    return {
      date: d.date
        ? new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "",
      equity: parseFloat(cumulative.toFixed(2)),
      drawdown: parseFloat(drawdown.toFixed(2)),
      pnl: d.pnl ?? 0,
      benchmark: startingBalance,
    };
  });
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("formatMoney", () => {
  it("shows 0 decimals for values >= $1,000", () => {
    expect(formatMoney(1000)).toBe("$1,000");
    expect(formatMoney(99500)).toBe("$99,500");
    expect(formatMoney(110000)).toBe("$110,000");
  });

  it("shows 2 decimals for values < $1,000", () => {
    expect(formatMoney(500)).toBe("$500.00");
    expect(formatMoney(42.5)).toBe("$42.50");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("handles negative values correctly", () => {
    expect(formatMoney(-5000)).toBe("$5,000");
    expect(formatMoney(-5000, true)).toBe("-$5,000");
    expect(formatMoney(-50, true)).toBe("-$50.00");
  });

  it("shows + sign for positive values when showSign is true", () => {
    expect(formatMoney(1500, true)).toBe("+$1,500");
    expect(formatMoney(25.5, true)).toBe("+$25.50");
  });
});

describe("getTimeRangeMs", () => {
  it("returns correct milliseconds for each range", () => {
    const day = 86400000;
    expect(getTimeRangeMs("1W")).toBe(7 * day);
    expect(getTimeRangeMs("1M")).toBe(30 * day);
    expect(getTimeRangeMs("3M")).toBe(90 * day);
    expect(getTimeRangeMs("6M")).toBe(180 * day);
    expect(getTimeRangeMs("ALL")).toBe(Infinity);
  });
});

describe("computeEquityChartData", () => {
  // Sample trade data
  const now = Date.now();
  const day = 86400000;

  const sampleTrades = [
    { date: new Date(now - 100 * day).toISOString(), pnl: 500, cumulative: 500 },
    { date: new Date(now - 80 * day).toISOString(), pnl: -200, cumulative: 300 },
    { date: new Date(now - 60 * day).toISOString(), pnl: 1000, cumulative: 1300 },
    { date: new Date(now - 40 * day).toISOString(), pnl: -300, cumulative: 1000 },
    { date: new Date(now - 20 * day).toISOString(), pnl: 800, cumulative: 1800 },
    { date: new Date(now - 5 * day).toISOString(), pnl: 200, cumulative: 2000 },
  ];

  it("uses startingBalance correctly for cumulative calculation", () => {
    const result = computeEquityChartData(sampleTrades, "ALL", 100000);
    // First trade: 100000 + 500 = 100500
    expect(result[0].equity).toBe(100500);
    // Last trade: 100000 + 500 - 200 + 1000 - 300 + 800 + 200 = 102000
    expect(result[result.length - 1].equity).toBe(102000);
  });

  it("uses a different startingBalance (e.g., 10000)", () => {
    const result = computeEquityChartData(sampleTrades, "ALL", 10000);
    expect(result[0].equity).toBe(10500);
    expect(result[result.length - 1].equity).toBe(12000);
  });

  it("benchmark line equals startingBalance for all data points", () => {
    const result = computeEquityChartData(sampleTrades, "ALL", 99000);
    for (const point of result) {
      expect(point.benchmark).toBe(99000);
    }
  });

  it("returns empty array for empty input", () => {
    expect(computeEquityChartData([], "ALL", 10000)).toEqual([]);
  });

  it("filters by 1W time range correctly", () => {
    const result = computeEquityChartData(sampleTrades, "1W", 10000);
    // Only the last trade (5 days ago) should be within 1W
    expect(result.length).toBe(1);
    // Cumulative should account for all prior trades: 10000 + 500 - 200 + 1000 - 300 + 800 = 11800, then + 200 = 12000
    expect(result[0].equity).toBe(12000);
  });

  it("filters by 1M time range correctly", () => {
    const result = computeEquityChartData(sampleTrades, "1M", 10000);
    // Trades within 30 days: 20 days ago and 5 days ago
    expect(result.length).toBe(2);
  });

  it("filters by 3M time range correctly", () => {
    const result = computeEquityChartData(sampleTrades, "3M", 10000);
    // Trades within 90 days: 80, 60, 40, 20, 5 days ago (all except 100 days ago)
    expect(result.length).toBe(5);
  });

  it("ALL returns all trades", () => {
    const result = computeEquityChartData(sampleTrades, "ALL", 10000);
    expect(result.length).toBe(6);
  });

  it("calculates drawdown correctly", () => {
    const result = computeEquityChartData(sampleTrades, "ALL", 10000);
    // After trade 1: equity = 10500, peak = 10500, drawdown = 0
    expect(result[0].drawdown).toBe(0);
    // After trade 2: equity = 10300, peak = 10500, drawdown = (10300-10500)/10500 * 100 = -1.90%
    expect(result[1].drawdown).toBeCloseTo(-1.90, 1);
    // After trade 3: equity = 11300, peak = 11300, drawdown = 0
    expect(result[2].drawdown).toBe(0);
  });

  it("correctly recalculates cumulative for filtered subset", () => {
    // When filtering to 1M, the cumulative should account for all prior trades
    const result = computeEquityChartData(sampleTrades, "1M", 50000);
    // Before the first filtered item (20 days ago), cumulative = 50000 + 500 - 200 + 1000 - 300 = 51000
    // First filtered item: 51000 + 800 = 51800
    expect(result[0].equity).toBe(51800);
    // Second filtered item: 51800 + 200 = 52000
    expect(result[1].equity).toBe(52000);
  });

  it("handles trades with zero pnl", () => {
    const tradesWithZero = [
      { date: new Date(now - 10 * day).toISOString(), pnl: 0, cumulative: 0 },
      { date: new Date(now - 5 * day).toISOString(), pnl: 100, cumulative: 100 },
    ];
    const result = computeEquityChartData(tradesWithZero, "ALL", 10000);
    expect(result[0].equity).toBe(10000);
    expect(result[1].equity).toBe(10100);
  });
});

describe("Y-axis domain function", () => {
  // The domain functions from DashboardView
  const domainMin = (dataMin: number) => Math.floor(dataMin - (dataMin * 0.002));
  const domainMax = (dataMax: number) => Math.ceil(dataMax + (dataMax * 0.002));

  it("provides padding below dataMin", () => {
    // For a balance around $100,000
    const min = domainMin(99000);
    expect(min).toBeLessThan(99000);
    expect(min).toBeGreaterThan(98000); // Should be close, not massive padding
  });

  it("provides padding above dataMax", () => {
    const max = domainMax(110000);
    expect(max).toBeGreaterThan(110000);
    expect(max).toBeLessThan(111000); // Should be close, not massive padding
  });

  it("scales padding proportionally to data magnitude", () => {
    // Larger values get proportionally larger padding
    const padding10k = 10000 - domainMin(10000);
    const padding100k = 100000 - domainMin(100000);
    expect(padding100k).toBeGreaterThan(padding10k);
  });

  it("does not produce negative domain for positive data", () => {
    expect(domainMin(1000)).toBeGreaterThan(0);
    expect(domainMin(100)).toBeGreaterThan(0);
  });
});

describe("Y-axis tickFormatter", () => {
  const tickFormatter = (v: number) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`;

  it("formats large values as $Xk with no decimals", () => {
    expect(tickFormatter(99000)).toBe("$99k");
    expect(tickFormatter(110000)).toBe("$110k");
    expect(tickFormatter(1500)).toBe("$2k"); // rounds to nearest k
    expect(tickFormatter(99500)).toBe("$100k"); // rounds up
  });

  it("formats small values as $X with no decimals", () => {
    expect(tickFormatter(500)).toBe("$500");
    expect(tickFormatter(999)).toBe("$999");
    expect(tickFormatter(0)).toBe("$0");
  });
});

describe("initialBalance integration", () => {
  it("INITIAL_BALANCE constant is 10000", async () => {
    // Import the actual module to verify the constant
    // This tests that the server returns initialBalance correctly
    const { getStatus } = await import("./paperTrading");
    const status = getStatus();
    expect(status.initialBalance).toBe(10000);
  });

  it("profit calculation uses initialBalance correctly", () => {
    const balance = 110500;
    const initialBalance = 100000;
    const profit = balance - initialBalance;
    const profitPct = ((profit / initialBalance) * 100).toFixed(1);
    expect(profit).toBe(10500);
    expect(profitPct).toBe("10.5");
  });

  it("profit calculation with default fallback (10000)", () => {
    const balance = 12000;
    const initialBalance = 10000; // fallback when d?.initialBalance is undefined
    const profit = balance - initialBalance;
    const profitPct = ((profit / initialBalance) * 100).toFixed(1);
    expect(profit).toBe(2000);
    expect(profitPct).toBe("20.0");
  });
});
