import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the dataApi module before importing marketData
vi.mock("./_core/dataApi", () => ({
  callDataApi: vi.fn(),
}));

import { callDataApi } from "./_core/dataApi";
import { fetchCandlesFromYahoo, fetchQuoteFromYahoo } from "./marketData";

const mockCallDataApi = vi.mocked(callDataApi);

// Sample Yahoo Finance response
const sampleChartResponse = {
  chart: {
    result: [
      {
        meta: {
          symbol: "EURUSD=X",
          currency: "USD",
          exchangeName: "CCY",
          regularMarketPrice: 1.1729,
          chartPreviousClose: 1.15,
          regularMarketOpen: 1.16,
          regularMarketDayHigh: 1.18,
          regularMarketDayLow: 1.15,
        },
        timestamp: [1712880000, 1712966400, 1713052800, 1713139200, 1713225600],
        indicators: {
          quote: [
            {
              open: [1.16, 1.165, 1.17, 1.168, 1.172],
              high: [1.17, 1.175, 1.18, 1.178, 1.182],
              low: [1.155, 1.16, 1.165, 1.163, 1.168],
              close: [1.165, 1.17, 1.168, 1.172, 1.1729],
              volume: [100000, 120000, 110000, 130000, 115000],
            },
          ],
        },
      },
    ],
  },
};

describe("fetchCandlesFromYahoo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns candle data for a valid forex symbol", async () => {
    mockCallDataApi.mockResolvedValue(sampleChartResponse);

    const candles = await fetchCandlesFromYahoo("EUR/USD", "1day", 200);

    expect(candles).toHaveLength(5);
    expect(candles[0]).toMatchObject({
      open: 1.16,
      high: 1.17,
      low: 1.155,
      close: 1.165,
      volume: 100000,
    });
    expect(candles[0].datetime).toBeDefined();
    expect(typeof candles[0].datetime).toBe("string");
  });

  it("calls Yahoo Finance API with correct symbol mapping", async () => {
    mockCallDataApi.mockResolvedValue(sampleChartResponse);

    await fetchCandlesFromYahoo("EUR/USD", "1day", 200);

    expect(mockCallDataApi).toHaveBeenCalledWith("YahooFinance/get_stock_chart", {
      query: {
        symbol: "EURUSD=X",
        interval: "1d",
        range: "1y",
        includeAdjustedClose: "true",
      },
    });
  });

  it("maps BTC/USD to BTC-USD", async () => {
    mockCallDataApi.mockResolvedValue(sampleChartResponse);

    await fetchCandlesFromYahoo("BTC/USD", "1day", 200);

    expect(mockCallDataApi).toHaveBeenCalledWith(
      "YahooFinance/get_stock_chart",
      expect.objectContaining({
        query: expect.objectContaining({ symbol: "BTC-USD" }),
      })
    );
  });

  it("maps XAU/USD to GC=F (Gold futures)", async () => {
    mockCallDataApi.mockResolvedValue(sampleChartResponse);

    await fetchCandlesFromYahoo("XAU/USD", "1day", 200);

    expect(mockCallDataApi).toHaveBeenCalledWith(
      "YahooFinance/get_stock_chart",
      expect.objectContaining({
        query: expect.objectContaining({ symbol: "GC=F" }),
      })
    );
  });

  it("throws for unknown symbols", async () => {
    await expect(fetchCandlesFromYahoo("UNKNOWN/PAIR", "1day", 200)).rejects.toThrow(
      "Unknown symbol"
    );
  });

  it("throws when API returns no data", async () => {
    mockCallDataApi.mockResolvedValue({ chart: { result: [] } });

    await expect(fetchCandlesFromYahoo("EUR/USD", "1day", 200)).rejects.toThrow(
      "No data returned"
    );
  });

  it("skips candles with null values", async () => {
    const responseWithNulls = {
      chart: {
        result: [
          {
            meta: {},
            timestamp: [1712880000, 1712966400, 1713052800],
            indicators: {
              quote: [
                {
                  open: [1.16, null, 1.17],
                  high: [1.17, null, 1.18],
                  low: [1.155, null, 1.165],
                  close: [1.165, null, 1.168],
                  volume: [100000, null, 110000],
                },
              ],
            },
          },
        ],
      },
    };
    mockCallDataApi.mockResolvedValue(responseWithNulls);

    const candles = await fetchCandlesFromYahoo("EUR/USD", "1day", 200);

    expect(candles).toHaveLength(2);
  });

  it("limits output to requested size", async () => {
    mockCallDataApi.mockResolvedValue(sampleChartResponse);

    const candles = await fetchCandlesFromYahoo("EUR/USD", "1day", 3);

    expect(candles).toHaveLength(3);
  });

  it("uses correct interval/range for weekly timeframe", async () => {
    mockCallDataApi.mockResolvedValue(sampleChartResponse);

    await fetchCandlesFromYahoo("EUR/USD", "1week", 200);

    expect(mockCallDataApi).toHaveBeenCalledWith(
      "YahooFinance/get_stock_chart",
      expect.objectContaining({
        query: expect.objectContaining({ interval: "1wk", range: "2y" }),
      })
    );
  });

  it("uses 60m interval for 4h timeframe and aggregates", async () => {
    // Create 8 hourly candles that should aggregate to 2 four-hour candles
    const hourlyResponse = {
      chart: {
        result: [
          {
            meta: {},
            timestamp: [
              1712880000, 1712883600, 1712887200, 1712890800,
              1712894400, 1712898000, 1712901600, 1712905200,
            ],
            indicators: {
              quote: [
                {
                  open: [1.16, 1.165, 1.17, 1.168, 1.172, 1.175, 1.18, 1.178],
                  high: [1.17, 1.175, 1.18, 1.178, 1.182, 1.185, 1.19, 1.188],
                  low: [1.155, 1.16, 1.165, 1.163, 1.168, 1.17, 1.175, 1.173],
                  close: [1.165, 1.17, 1.168, 1.172, 1.175, 1.18, 1.178, 1.182],
                  volume: [100, 120, 110, 130, 115, 125, 105, 135],
                },
              ],
            },
          },
        ],
      },
    };
    mockCallDataApi.mockResolvedValue(hourlyResponse);

    const candles = await fetchCandlesFromYahoo("EUR/USD", "4h", 200);

    expect(candles).toHaveLength(2);
    // First 4h candle: open from first 1h, close from 4th 1h, high = max, low = min
    expect(candles[0].open).toBe(1.16);
    expect(candles[0].close).toBe(1.172);
    expect(candles[0].high).toBe(1.18);
    expect(candles[0].low).toBe(1.155);
  });
});

describe("fetchQuoteFromYahoo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns quote data for a valid symbol", async () => {
    mockCallDataApi.mockResolvedValue(sampleChartResponse);

    const quote = await fetchQuoteFromYahoo("EUR/USD");

    expect(quote.price).toBe(1.1729);
    expect(quote.previousClose).toBe(1.15);
    expect(quote.change).toBeCloseTo(0.0229, 4);
    expect(quote.percentChange).toBeCloseTo(1.9913, 1);
    expect(quote.open).toBe(1.16);
    expect(quote.high).toBe(1.18);
    expect(quote.low).toBe(1.15);
  });

  it("throws for unknown symbols", async () => {
    await expect(fetchQuoteFromYahoo("UNKNOWN/PAIR")).rejects.toThrow("Unknown symbol");
  });

  it("throws when API returns no data", async () => {
    mockCallDataApi.mockResolvedValue({ chart: { result: null } });

    await expect(fetchQuoteFromYahoo("EUR/USD")).rejects.toThrow("No data returned");
  });
});
