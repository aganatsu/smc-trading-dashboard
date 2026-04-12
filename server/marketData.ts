/**
 * Market Data Service — Yahoo Finance via Manus Data API
 * No API key required from the user.
 */
import { callDataApi } from "./_core/dataApi";

// Yahoo Finance symbol mapping
const YAHOO_SYMBOLS: Record<string, string> = {
  "EUR/USD": "EURUSD=X",
  "GBP/USD": "GBPUSD=X",
  "USD/JPY": "USDJPY=X",
  "GBP/JPY": "GBPJPY=X",
  "AUD/USD": "AUDUSD=X",
  "USD/CAD": "USDCAD=X",
  "EUR/GBP": "EURGBP=X",
  "NZD/USD": "NZDUSD=X",
  "BTC/USD": "BTC-USD",
  "ETH/USD": "ETH-USD",
  "XAU/USD": "GC=F",
  "XAG/USD": "SI=F",
};

// Timeframe to Yahoo Finance interval mapping
const YAHOO_INTERVALS: Record<string, string> = {
  "1week": "1wk",
  "1day": "1d",
  "4h": "60m",   // Yahoo doesn't have 4h, use 60m and we'll aggregate
  "1h": "60m",
  "15min": "15m",
  "5min": "5m",
};

// Timeframe to range mapping (how much history to fetch)
const YAHOO_RANGES: Record<string, string> = {
  "1week": "2y",
  "1day": "1y",
  "4h": "60d",
  "1h": "30d",    // Yahoo limits intraday to ~30 days for 60m
  "15min": "5d",   // Yahoo limits to ~60 days for 15m
  "5min": "5d",    // Yahoo limits to ~60 days for 5m
};

export interface CandleData {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface QuoteData {
  price: number;
  change: number;
  percentChange: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
}

function aggregateTo4H(candles: CandleData[]): CandleData[] {
  if (candles.length === 0) return [];

  const aggregated: CandleData[] = [];
  let bucket: CandleData | null = null;
  let count = 0;

  for (const c of candles) {
    if (!bucket) {
      bucket = { ...c };
      count = 1;
    } else {
      bucket.high = Math.max(bucket.high, c.high);
      bucket.low = Math.min(bucket.low, c.low);
      bucket.close = c.close;
      bucket.volume = (bucket.volume || 0) + (c.volume || 0);
      count++;
    }

    if (count >= 4) {
      aggregated.push(bucket);
      bucket = null;
      count = 0;
    }
  }

  // Push remaining partial bucket
  if (bucket) {
    aggregated.push(bucket);
  }

  return aggregated;
}

export async function fetchCandlesFromYahoo(
  symbol: string,
  interval: string,
  outputsize: number = 200
): Promise<CandleData[]> {
  const yahooSymbol = YAHOO_SYMBOLS[symbol];
  if (!yahooSymbol) {
    throw new Error(`Unknown symbol: ${symbol}`);
  }

  const yahooInterval = YAHOO_INTERVALS[interval] || "1d";
  const yahooRange = YAHOO_RANGES[interval] || "1y";

  const result = (await callDataApi("YahooFinance/get_stock_chart", {
    query: {
      symbol: yahooSymbol,
      interval: yahooInterval,
      range: yahooRange,
      includeAdjustedClose: "true",
    },
  })) as any;

  if (!result?.chart?.result?.[0]) {
    throw new Error("No data returned from Yahoo Finance");
  }

  const chartResult = result.chart.result[0];
  const timestamps: number[] = chartResult.timestamp || [];
  const quotes = chartResult.indicators?.quote?.[0];

  if (!quotes || timestamps.length === 0) {
    throw new Error("No price data available");
  }

  let candles: CandleData[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const open = quotes.open?.[i];
    const high = quotes.high?.[i];
    const low = quotes.low?.[i];
    const close = quotes.close?.[i];
    const volume = quotes.volume?.[i];

    // Skip null/undefined entries
    if (open == null || high == null || low == null || close == null) continue;

    const date = new Date(timestamps[i] * 1000);
    const datetime = date.toISOString().replace("T", " ").substring(0, 19);

    candles.push({
      datetime,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: volume != null ? Number(volume) : undefined,
    });
  }

  // Aggregate 60m candles to 4H if needed
  if (interval === "4h") {
    candles = aggregateTo4H(candles);
  }

  // Limit to requested output size
  if (candles.length > outputsize) {
    candles = candles.slice(candles.length - outputsize);
  }

  return candles;
}

export async function fetchQuoteFromYahoo(symbol: string): Promise<QuoteData> {
  const yahooSymbol = YAHOO_SYMBOLS[symbol];
  if (!yahooSymbol) {
    throw new Error(`Unknown symbol: ${symbol}`);
  }

  // Fetch minimal data to get current quote
  const result = (await callDataApi("YahooFinance/get_stock_chart", {
    query: {
      symbol: yahooSymbol,
      interval: "1d",
      range: "5d",
      includeAdjustedClose: "true",
    },
  })) as any;

  if (!result?.chart?.result?.[0]) {
    throw new Error("No data returned from Yahoo Finance");
  }

  const meta = result.chart.result[0].meta;
  const previousClose = meta.chartPreviousClose || meta.previousClose || 0;
  const currentPrice = meta.regularMarketPrice || 0;
  const change = currentPrice - previousClose;
  const percentChange = previousClose > 0 ? (change / previousClose) * 100 : 0;

  return {
    price: currentPrice,
    change,
    percentChange,
    open: meta.regularMarketOpen || currentPrice,
    high: meta.regularMarketDayHigh || currentPrice,
    low: meta.regularMarketDayLow || currentPrice,
    previousClose,
  };
}
