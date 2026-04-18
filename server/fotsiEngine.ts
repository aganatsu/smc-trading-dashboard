/**
 * FOTSI Engine — Server-side currency strength computation
 * 
 * Implements the FOTSI (Forex Trend Strength Index) calculation:
 * - TSI (True Strength Index) with double EMA smoothing (25/15)
 * - 28-pair aggregation across 8 major currencies
 * - Hook detection for mean-reversion entry signals
 * - Pair ranking by divergence spread
 * 
 * Momentum = close - open (candle body), NOT close - close[1]
 * Matches Magala's TradingView indicator exactly.
 */

import { fetchCandlesFromYahoo, type CandleData } from './marketData';

// ─── Constants ─────────────────────────────────────────────────────

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'] as const;
export type Currency = typeof CURRENCIES[number];

export const FOTSI_OVERBOUGHT = 50;
export const FOTSI_OVERSOLD = -50;
export const FOTSI_NEUTRAL_UPPER = 25;
export const FOTSI_NEUTRAL_LOWER = -25;

// 28 unique pairs from 8 currencies
export const FOTSI_PAIRS: [string, Currency, Currency][] = [
  ['EUR/USD', 'EUR', 'USD'], ['GBP/USD', 'GBP', 'USD'], ['AUD/USD', 'AUD', 'USD'],
  ['NZD/USD', 'NZD', 'USD'], ['USD/CAD', 'USD', 'CAD'], ['USD/CHF', 'USD', 'CHF'],
  ['USD/JPY', 'USD', 'JPY'], ['EUR/GBP', 'EUR', 'GBP'], ['EUR/JPY', 'EUR', 'JPY'],
  ['EUR/AUD', 'EUR', 'AUD'], ['EUR/CAD', 'EUR', 'CAD'], ['EUR/CHF', 'EUR', 'CHF'],
  ['EUR/NZD', 'EUR', 'NZD'], ['GBP/JPY', 'GBP', 'JPY'], ['GBP/CHF', 'GBP', 'CHF'],
  ['GBP/AUD', 'GBP', 'AUD'], ['GBP/CAD', 'GBP', 'CAD'], ['GBP/NZD', 'GBP', 'NZD'],
  ['AUD/JPY', 'AUD', 'JPY'], ['AUD/CAD', 'AUD', 'CAD'], ['AUD/CHF', 'AUD', 'CHF'],
  ['AUD/NZD', 'AUD', 'NZD'], ['CAD/JPY', 'CAD', 'JPY'], ['CAD/CHF', 'CAD', 'CHF'],
  ['CHF/JPY', 'CHF', 'JPY'], ['NZD/JPY', 'NZD', 'JPY'], ['NZD/CAD', 'NZD', 'CAD'],
  ['NZD/CHF', 'NZD', 'CHF'],
];

// Yahoo Finance symbol mapping for all 28 pairs
const YAHOO_FOTSI_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EURUSD=X', 'GBP/USD': 'GBPUSD=X', 'AUD/USD': 'AUDUSD=X',
  'NZD/USD': 'NZDUSD=X', 'USD/CAD': 'USDCAD=X', 'USD/CHF': 'USDCHF=X',
  'USD/JPY': 'USDJPY=X', 'EUR/GBP': 'EURGBP=X', 'EUR/JPY': 'EURJPY=X',
  'EUR/AUD': 'EURAUD=X', 'EUR/CAD': 'EURCAD=X', 'EUR/CHF': 'EURCHF=X',
  'EUR/NZD': 'EURNZD=X', 'GBP/JPY': 'GBPJPY=X', 'GBP/CHF': 'GBPCHF=X',
  'GBP/AUD': 'GBPAUD=X', 'GBP/CAD': 'GBPCAD=X', 'GBP/NZD': 'GBPNZD=X',
  'AUD/JPY': 'AUDJPY=X', 'AUD/CAD': 'AUDCAD=X', 'AUD/CHF': 'AUDCHF=X',
  'AUD/NZD': 'AUDNZD=X', 'CAD/JPY': 'CADJPY=X', 'CAD/CHF': 'CADCHF=X',
  'CHF/JPY': 'CHFJPY=X', 'NZD/JPY': 'NZDJPY=X', 'NZD/CAD': 'NZDCAD=X',
  'NZD/CHF': 'NZDCHF=X',
};

// ─── EMA Helper ────────────────────────────────────────────────────

function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

// ─── TSI Calculation ───────────────────────────────────────────────

/**
 * Compute TSI (True Strength Index) for a single pair.
 * Uses double EMA smoothing of momentum (close - open).
 * 
 * TSI = 100 * EMA(EMA(momentum, long), short) / EMA(EMA(|momentum|, long), short)
 */
function computePairTSI(
  candles: CandleData[],
  longPeriod: number = 25,
  shortPeriod: number = 15,
): number[] {
  if (candles.length < 2) return [];

  // Momentum = close - open (candle body, NOT close-to-close)
  const momentum: number[] = candles.map(c => c.close - c.open);
  const absMomentum: number[] = momentum.map(m => Math.abs(m));

  // Double EMA smoothing
  const smoothedMom = ema(ema(momentum, longPeriod), shortPeriod);
  const smoothedAbsMom = ema(ema(absMomentum, longPeriod), shortPeriod);

  // TSI = 100 * smoothed / |smoothed|
  const tsi: number[] = [];
  for (let i = 0; i < smoothedMom.length; i++) {
    if (smoothedAbsMom[i] === 0) {
      tsi.push(0);
    } else {
      tsi.push(100 * smoothedMom[i] / smoothedAbsMom[i]);
    }
  }

  return tsi;
}

// ─── FOTSI Result Types ────────────────────────────────────────────

export interface FOTSIStrength {
  currency: Currency;
  tsi: number;
  rank: number;
  zone: 'overbought' | 'oversold' | 'neutral_high' | 'neutral_low' | 'neutral';
  hookDirection: 'hooking_up' | 'hooking_down' | 'none';
  hookStrength: 'strong' | 'moderate' | 'weak' | 'none';
  series: number[];  // Last 10 TSI values for sparkline
}

export interface RankedPair {
  pair: string;
  base: Currency;
  quote: Currency;
  baseTSI: number;
  quoteTSI: number;
  spread: number;
  direction: 'BUY' | 'SELL';
  hookScore: number;
  reason: string;
}

export interface FOTSIResult {
  strengths: FOTSIStrength[];
  rankedPairs: RankedPair[];
  pairCount: number;
  computedAt: string;
}

// ─── Cache ─────────────────────────────────────────────────────────

let cachedResult: FOTSIResult | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Main Computation ──────────────────────────────────────────────

/**
 * Compute FOTSI strengths for all 8 currencies.
 * Fetches daily candles for available pairs, computes TSI per pair,
 * aggregates per currency, and ranks by strength.
 */
export async function computeFOTSI(forceRefresh = false): Promise<FOTSIResult> {
  // Return cache if fresh
  if (!forceRefresh && cachedResult && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedResult;
  }

  console.log('[FOTSI] Computing currency strengths...');

  // Fetch daily candles for all available pairs
  const pairTSIs: Record<string, number[]> = {};
  let fetchedCount = 0;

  // Only fetch the 8 major pairs that Yahoo Finance supports in our mapping
  // (the full 28 pairs may not all be available via Yahoo)
  const availablePairs = FOTSI_PAIRS.filter(([pair]) => YAHOO_FOTSI_SYMBOLS[pair]);

  for (const [pair] of availablePairs) {
    try {
      const candles = await fetchCandlesFromYahoo(pair, '1day', 100);
      if (candles && candles.length > 20) {
        const tsi = computePairTSI(candles);
        if (tsi.length > 0) {
          pairTSIs[pair] = tsi;
          fetchedCount++;
        }
      }
    } catch (err) {
      // Skip pairs that fail (Yahoo may not support all 28)
      console.log(`[FOTSI] Skipped ${pair}: ${(err as Error).message}`);
    }
  }

  console.log(`[FOTSI] Fetched ${fetchedCount}/${availablePairs.length} pairs`);

  // Aggregate TSI per currency
  const currencyTSIs: Record<Currency, number[][]> = {} as any;
  for (const c of CURRENCIES) {
    currencyTSIs[c] = [];
  }

  for (const [pair, base, quote] of FOTSI_PAIRS) {
    const tsi = pairTSIs[pair];
    if (!tsi || tsi.length === 0) continue;

    // Base currency: positive TSI means base is strong
    currencyTSIs[base].push(tsi);
    // Quote currency: negative TSI means quote is strong (inverted)
    currencyTSIs[quote].push(tsi.map(v => -v));
  }

  // Average TSI series per currency
  const strengths: FOTSIStrength[] = [];

  for (const currency of CURRENCIES) {
    const series = currencyTSIs[currency];
    if (series.length === 0) {
      strengths.push({
        currency,
        tsi: 0,
        rank: 0,
        zone: 'neutral',
        hookDirection: 'none',
        hookStrength: 'none',
        series: [],
      });
      continue;
    }

    // Average across all pairs for this currency
    const maxLen = Math.max(...series.map(s => s.length));
    const averaged: number[] = [];
    for (let i = 0; i < maxLen; i++) {
      let sum = 0;
      let count = 0;
      for (const s of series) {
        if (i < s.length) {
          sum += s[i];
          count++;
        }
      }
      averaged.push(count > 0 ? sum / count : 0);
    }

    const currentTSI = averaged.length > 0 ? averaged[averaged.length - 1] : 0;
    const last10 = averaged.slice(-10);

    // Determine zone
    let zone: FOTSIStrength['zone'] = 'neutral';
    if (currentTSI >= FOTSI_OVERBOUGHT) zone = 'overbought';
    else if (currentTSI <= FOTSI_OVERSOLD) zone = 'oversold';
    else if (currentTSI >= FOTSI_NEUTRAL_UPPER) zone = 'neutral_high';
    else if (currentTSI <= FOTSI_NEUTRAL_LOWER) zone = 'neutral_low';

    // Detect hook
    const { direction: hookDirection, strength: hookStrength } = detectHook(averaged);

    strengths.push({
      currency,
      tsi: parseFloat(currentTSI.toFixed(2)),
      rank: 0, // Will be set after sorting
      zone,
      hookDirection,
      hookStrength,
      series: last10.map(v => parseFloat(v.toFixed(2))),
    });
  }

  // Rank by TSI (strongest first)
  strengths.sort((a, b) => b.tsi - a.tsi);
  strengths.forEach((s, i) => { s.rank = i + 1; });

  // Rank pairs by divergence
  const rankedPairs = rankPairsByDivergence(strengths);

  const result: FOTSIResult = {
    strengths,
    rankedPairs,
    pairCount: fetchedCount,
    computedAt: new Date().toISOString(),
  };

  cachedResult = result;
  cacheTimestamp = Date.now();

  console.log(`[FOTSI] Computation complete: ${strengths.map(s => `${s.currency}=${s.tsi.toFixed(1)}`).join(', ')}`);

  return result;
}

// ─── Hook Detection ────────────────────────────────────────────────

function detectHook(series: number[]): { direction: FOTSIStrength['hookDirection']; strength: FOTSIStrength['hookStrength'] } {
  if (series.length < 4) return { direction: 'none', strength: 'none' };

  const n = series.length;
  const current = series[n - 1];
  const prev1 = series[n - 2];
  const prev2 = series[n - 3];

  const delta1 = prev1 - prev2;
  const delta2 = current - prev1;

  // Must be outside neutral zone
  if (Math.abs(current) < FOTSI_NEUTRAL_UPPER) return { direction: 'none', strength: 'none' };

  // Hooking DOWN: was rising, now falling/flat
  if (current > FOTSI_NEUTRAL_UPPER && delta1 > 0.2 && delta2 < delta1 * 0.5) {
    const strength = delta2 < 0 ? 'strong' : delta2 < delta1 * 0.3 ? 'moderate' : 'weak';
    return { direction: 'hooking_down', strength };
  }

  // Hooking UP: was falling, now rising/flat
  if (current < FOTSI_NEUTRAL_LOWER && delta1 < -0.2 && delta2 > delta1 * 0.5) {
    const strength = delta2 > 0 ? 'strong' : delta2 > delta1 * 0.3 ? 'moderate' : 'weak';
    return { direction: 'hooking_up', strength };
  }

  // Already past hook — moving back toward zero
  if (current > FOTSI_NEUTRAL_UPPER && delta2 < -0.3) {
    return { direction: 'hooking_down', strength: 'moderate' };
  }
  if (current < FOTSI_NEUTRAL_LOWER && delta2 > 0.3) {
    return { direction: 'hooking_up', strength: 'moderate' };
  }

  return { direction: 'none', strength: 'none' };
}

// ─── Pair Ranking ──────────────────────────────────────────────────

function rankPairsByDivergence(strengths: FOTSIStrength[]): RankedPair[] {
  const strengthMap: Record<string, FOTSIStrength> = {};
  for (const s of strengths) {
    strengthMap[s.currency] = s;
  }

  const ranked: RankedPair[] = [];

  for (const [pair, base, quote] of FOTSI_PAIRS) {
    const baseS = strengthMap[base];
    const quoteS = strengthMap[quote];
    if (!baseS || !quoteS) continue;

    const spread = Math.abs(baseS.tsi - quoteS.tsi);
    if (spread < 20) continue; // Min divergence threshold

    // At least one must be outside neutral
    if (Math.abs(baseS.tsi) < FOTSI_NEUTRAL_UPPER && Math.abs(quoteS.tsi) < FOTSI_NEUTRAL_UPPER) continue;

    // Direction: sell overbought, buy oversold
    const direction: 'BUY' | 'SELL' = baseS.tsi > quoteS.tsi ? 'SELL' : 'BUY';

    // Hook score
    let hookScore = 0;
    if (direction === 'SELL') {
      if (baseS.hookDirection === 'hooking_down') hookScore += baseS.hookStrength === 'strong' ? 2 : 1;
      if (quoteS.hookDirection === 'hooking_up') hookScore += quoteS.hookStrength === 'strong' ? 2 : 1;
    } else {
      if (baseS.hookDirection === 'hooking_up') hookScore += baseS.hookStrength === 'strong' ? 2 : 1;
      if (quoteS.hookDirection === 'hooking_down') hookScore += quoteS.hookStrength === 'strong' ? 2 : 1;
    }

    const hookLabel = hookScore >= 3 ? 'Strong hook' : hookScore >= 2 ? 'Good hook' : hookScore >= 1 ? 'Mild hook' : 'No hook';

    ranked.push({
      pair,
      base,
      quote,
      baseTSI: baseS.tsi,
      quoteTSI: quoteS.tsi,
      spread: parseFloat(spread.toFixed(1)),
      direction,
      hookScore,
      reason: `${direction} ${pair}: ${base} ${baseS.tsi.toFixed(1)} | ${quote} ${quoteS.tsi.toFixed(1)} | Spread ${spread.toFixed(1)} | ${hookLabel}`,
    });
  }

  ranked.sort((a, b) => {
    if (b.hookScore !== a.hookScore) return b.hookScore - a.hookScore;
    return b.spread - a.spread;
  });

  return ranked.slice(0, 15); // Top 15 opportunities
}

// ─── Bot #2 Config Types ───────────────────────────────────────────

export interface FOTSIBotConfig {
  enabled: boolean;
  minDivergenceSpread: number;
  hookRequired: boolean;
  hookBars: number;
  minExtremeLevel: number;
  riskPerTrade: number;
  maxConcurrent: number;
  cooldownMinutes: number;
  maxDailyLoss: number;
  maxDailyTrades: number;
  slMethod: 'structure' | 'atr' | 'fixed';
  slATRMultiplier: number;
  slFixedPips: number;
  minRR: number;
  tp1Method: 'ema50' | 'fixed_rr';
  tp2Method: 'ema100' | 'fixed_rr';
  tp1RR: number;
  tp2RR: number;
  partialClosePercent: number;
  maxHoldHours: number;
  breakEvenAfterTP1: boolean;
  sessions: {
    london: boolean;
    newYork: boolean;
    asian: boolean;
    sydney: boolean;
  };
  entryTimeframe: '1h' | '4h';
}

export const DEFAULT_FOTSI_CONFIG: FOTSIBotConfig = {
  enabled: false,
  minDivergenceSpread: 40,
  hookRequired: true,
  hookBars: 3,
  minExtremeLevel: 25,
  riskPerTrade: 1.0,
  maxConcurrent: 3,
  cooldownMinutes: 240,
  maxDailyLoss: 3.0,
  maxDailyTrades: 5,
  slMethod: 'atr',
  slATRMultiplier: 2.0,
  slFixedPips: 50,
  minRR: 2.0,
  tp1Method: 'ema50',
  tp2Method: 'ema100',
  tp1RR: 1.5,
  tp2RR: 3.0,
  partialClosePercent: 50,
  maxHoldHours: 48,
  breakEvenAfterTP1: true,
  sessions: { london: true, newYork: true, asian: false, sydney: false },
  entryTimeframe: '4h',
};

// In-memory config (will be persisted via botConfigs table)
let fotsiConfig: FOTSIBotConfig = { ...DEFAULT_FOTSI_CONFIG };

export function getFOTSIConfig(): FOTSIBotConfig {
  return { ...fotsiConfig };
}

export function updateFOTSIConfig(partial: Partial<FOTSIBotConfig>): FOTSIBotConfig {
  const prevSessions = { ...fotsiConfig.sessions };
  fotsiConfig = { ...fotsiConfig, ...partial };
  if (partial.sessions) {
    fotsiConfig.sessions = { ...prevSessions, ...partial.sessions };
  }
  return { ...fotsiConfig };
}

export function resetFOTSIConfig(): FOTSIBotConfig {
  fotsiConfig = { ...DEFAULT_FOTSI_CONFIG };
  return { ...fotsiConfig };
}

export function loadFOTSIConfigFromJson(json: Record<string, any> | null): void {
  if (!json) return;
  fotsiConfig = { ...DEFAULT_FOTSI_CONFIG, ...json };
  if (json.sessions) {
    fotsiConfig.sessions = { ...DEFAULT_FOTSI_CONFIG.sessions, ...json.sessions };
  }
}

/**
 * Get cached result without recomputing (for quick status checks)
 */
export function getCachedFOTSI(): FOTSIResult | null {
  return cachedResult;
}

/**
 * Clear the FOTSI cache (for testing)
 */
export function clearFOTSICache(): void {
  cachedResult = null;
  cacheTimestamp = 0;
}
