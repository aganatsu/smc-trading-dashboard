/**
 * SMC (Smart Money Concepts) Analysis Engine — Server-side
 * 
 * Port of client/src/lib/smcAnalysis.ts for use by the autonomous bot.
 * Includes additional ICT concepts: Judas Swing, PD/PW levels, Session/Kill Zones,
 * Premium/Discount zones, and currency strength.
 */

// ─── Core Types ─────────────────────────────────────────────────────

export interface Candle {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SwingPoint {
  index: number;
  price: number;
  type: 'high' | 'low';
  datetime: string;
}

export interface OrderBlock {
  index: number;
  high: number;
  low: number;
  type: 'bullish' | 'bearish';
  datetime: string;
  mitigated: boolean;
  mitigatedPercent: number;
}

export interface FairValueGap {
  index: number;
  high: number;
  low: number;
  type: 'bullish' | 'bearish';
  datetime: string;
  mitigated: boolean;
}

export interface LiquidityPool {
  price: number;
  type: 'buy-side' | 'sell-side';
  strength: number;
  datetime: string;
  swept: boolean;
}

export interface MarketStructure {
  trend: 'bullish' | 'bearish' | 'ranging';
  swingPoints: SwingPoint[];
  bos: { index: number; type: 'bullish' | 'bearish'; price: number; datetime: string }[];
  choch: { index: number; type: 'bullish' | 'bearish'; price: number; datetime: string }[];
}

// ─── ICT-Specific Types ─────────────────────────────────────────────

export interface PDLevels {
  pdh: number;  // Previous Day High
  pdl: number;  // Previous Day Low
  pdo: number;  // Previous Day Open
  pdc: number;  // Previous Day Close
  pwh: number;  // Previous Week High
  pwl: number;  // Previous Week Low
  pwo: number;  // Previous Week Open
  pwc: number;  // Previous Week Close
}

export interface JudasSwing {
  detected: boolean;
  type: 'bullish' | 'bearish' | null;
  midnightOpen: number;
  sweepLow: number | null;
  sweepHigh: number | null;
  reversalConfirmed: boolean;
  description: string;
}

export interface SessionInfo {
  name: string;
  active: boolean;
  isKillZone: boolean;
  sessionHigh: number;
  sessionLow: number;
  sessionOpen: number;
}

export interface PremiumDiscount {
  swingHigh: number;
  swingLow: number;
  equilibrium: number;
  currentZone: 'premium' | 'discount' | 'equilibrium';
  zonePercent: number; // 0-100, where 0=swing low, 100=swing high
  oteZone: boolean;    // In Optimal Trade Entry zone (62-79%)
}

export interface CurrencyStrength {
  currency: string;
  strength: number; // -100 to +100
  rank: number;     // 1=strongest
}

export interface CorrelationPair {
  pair1: string;
  pair2: string;
  coefficient: number; // -1 to +1
}

export interface FullAnalysis {
  structure: MarketStructure;
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
  liquidityPools: LiquidityPool[];
  pdLevels: PDLevels | null;
  judasSwing: JudasSwing;
  session: SessionInfo;
  premiumDiscount: PremiumDiscount;
  confluenceScore: number;
  bias: 'bullish' | 'bearish' | 'neutral';
  reasoning: string[];
}

// ─── Core Analysis Functions ────────────────────────────────────────

export function detectSwingPoints(candles: Candle[], lookback: number = 3): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) isHigh = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) isLow = false;
    }
    if (isHigh) swings.push({ index: i, price: candles[i].high, type: 'high', datetime: candles[i].datetime });
    if (isLow) swings.push({ index: i, price: candles[i].low, type: 'low', datetime: candles[i].datetime });
  }
  return swings;
}

export function analyzeMarketStructure(candles: Candle[], lookback: number = 3): MarketStructure {
  const swings = detectSwingPoints(candles, lookback);
  const bos: MarketStructure['bos'] = [];
  const choch: MarketStructure['choch'] = [];
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  let currentTrend: string = 'ranging';

  for (let i = 1; i < highs.length; i++) {
    if (highs[i].price > highs[i - 1].price) {
      if (currentTrend === 'bearish') {
        choch.push({ index: highs[i].index, type: 'bullish', price: highs[i].price, datetime: highs[i].datetime });
      } else {
        bos.push({ index: highs[i].index, type: 'bullish', price: highs[i].price, datetime: highs[i].datetime });
      }
      currentTrend = 'bullish';
    }
  }
  for (let i = 1; i < lows.length; i++) {
    if (lows[i].price < lows[i - 1].price) {
      if (currentTrend === 'bullish') {
        choch.push({ index: lows[i].index, type: 'bearish', price: lows[i].price, datetime: lows[i].datetime });
      } else {
        bos.push({ index: lows[i].index, type: 'bearish', price: lows[i].price, datetime: lows[i].datetime });
      }
      currentTrend = 'bearish';
    }
  }

  let trend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
  if (highs.length >= 2 && lows.length >= 2) {
    const recentHighs = highs.slice(-2);
    const recentLows = lows.slice(-2);
    if (recentHighs[1].price > recentHighs[0].price && recentLows[1].price > recentLows[0].price) trend = 'bullish';
    else if (recentHighs[1].price < recentHighs[0].price && recentLows[1].price < recentLows[0].price) trend = 'bearish';
  }
  return { trend, swingPoints: swings, bos, choch };
}

export function detectOrderBlocks(candles: Candle[]): OrderBlock[] {
  const obs: OrderBlock[] = [];
  for (let i = 2; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    // Bullish OB
    if (prev.close < prev.open && curr.close > curr.open && curr.close > prev.high) {
      const ob: OrderBlock = { index: i - 1, high: prev.high, low: prev.low, type: 'bullish', datetime: prev.datetime, mitigated: false, mitigatedPercent: 0 };
      for (let j = i + 1; j < candles.length; j++) {
        const midPoint = (ob.high + ob.low) / 2;
        if (candles[j].low <= midPoint) {
          ob.mitigatedPercent = Math.min(100, ((ob.high - candles[j].low) / (ob.high - ob.low)) * 100);
          if (ob.mitigatedPercent >= 50) ob.mitigated = true;
          break;
        }
      }
      obs.push(ob);
    }
    // Bearish OB
    if (prev.close > prev.open && curr.close < curr.open && curr.close < prev.low) {
      const ob: OrderBlock = { index: i - 1, high: prev.high, low: prev.low, type: 'bearish', datetime: prev.datetime, mitigated: false, mitigatedPercent: 0 };
      for (let j = i + 1; j < candles.length; j++) {
        const midPoint = (ob.high + ob.low) / 2;
        if (candles[j].high >= midPoint) {
          ob.mitigatedPercent = Math.min(100, ((candles[j].high - ob.low) / (ob.high - ob.low)) * 100);
          if (ob.mitigatedPercent >= 50) ob.mitigated = true;
          break;
        }
      }
      obs.push(ob);
    }
  }
  return obs;
}

export function detectFVGs(candles: Candle[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];
    // Bullish FVG
    if (c3.low > c1.high && c2.close > c2.open) {
      const fvg: FairValueGap = { index: i - 1, high: c3.low, low: c1.high, type: 'bullish', datetime: c2.datetime, mitigated: false };
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].low <= fvg.low) { fvg.mitigated = true; break; }
      }
      fvgs.push(fvg);
    }
    // Bearish FVG
    if (c1.low > c3.high && c2.close < c2.open) {
      const fvg: FairValueGap = { index: i - 1, high: c1.low, low: c3.high, type: 'bearish', datetime: c2.datetime, mitigated: false };
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].high >= fvg.high) { fvg.mitigated = true; break; }
      }
      fvgs.push(fvg);
    }
  }
  return fvgs;
}

export function detectLiquidityPools(candles: Candle[], tolerance: number = 0.001): LiquidityPool[] {
  const pools: LiquidityPool[] = [];
  const priceRange = Math.max(...candles.map(c => c.high)) - Math.min(...candles.map(c => c.low));
  const tol = priceRange * tolerance;
  const lastCandle = candles[candles.length - 1];

  // Buy-side liquidity (equal highs)
  const usedHighs = new Set<number>();
  for (let i = 0; i < candles.length; i++) {
    if (usedHighs.has(i)) continue;
    let count = 1;
    for (let j = i + 1; j < candles.length; j++) {
      if (usedHighs.has(j)) continue;
      if (Math.abs(candles[i].high - candles[j].high) <= tol) { count++; usedHighs.add(j); }
    }
    if (count >= 2) {
      pools.push({ price: candles[i].high, type: 'buy-side', strength: count, datetime: candles[i].datetime, swept: lastCandle.high > candles[i].high });
    }
  }

  // Sell-side liquidity (equal lows)
  const usedLows = new Set<number>();
  for (let i = 0; i < candles.length; i++) {
    if (usedLows.has(i)) continue;
    let count = 1;
    for (let j = i + 1; j < candles.length; j++) {
      if (usedLows.has(j)) continue;
      if (Math.abs(candles[i].low - candles[j].low) <= tol) { count++; usedLows.add(j); }
    }
    if (count >= 2) {
      pools.push({ price: candles[i].low, type: 'sell-side', strength: count, datetime: candles[i].datetime, swept: lastCandle.low < candles[i].low });
    }
  }
  return pools.sort((a, b) => b.strength - a.strength);
}

// ─── ICT Concept: PD/PW Levels ──────────────────────────────────────

export function calculatePDLevels(dailyCandles: Candle[]): PDLevels | null {
  if (dailyCandles.length < 6) return null;

  // Previous day = second to last daily candle
  const pd = dailyCandles[dailyCandles.length - 2];
  
  // Previous week = aggregate last 5 trading days before current
  const weekCandles = dailyCandles.slice(-7, -2); // 5 days before yesterday
  if (weekCandles.length < 3) return null;

  return {
    pdh: pd.high,
    pdl: pd.low,
    pdo: pd.open,
    pdc: pd.close,
    pwh: Math.max(...weekCandles.map(c => c.high)),
    pwl: Math.min(...weekCandles.map(c => c.low)),
    pwo: weekCandles[0].open,
    pwc: weekCandles[weekCandles.length - 1].close,
  };
}

// ─── ICT Concept: Judas Swing Detection ─────────────────────────────

export function detectJudasSwing(candles: Candle[]): JudasSwing {
  const noJudas: JudasSwing = {
    detected: false, type: null, midnightOpen: 0,
    sweepLow: null, sweepHigh: null, reversalConfirmed: false,
    description: 'No Judas Swing detected in current session',
  };

  if (candles.length < 10) return noJudas;

  // Use the last ~20 candles to detect session open behavior
  const recent = candles.slice(-20);
  const sessionOpen = recent[0].open;
  
  let lowestLow = Infinity;
  let highestHigh = -Infinity;
  let lowestIdx = 0;
  let highestIdx = 0;

  // Find the extreme move in first half of the window
  const halfPoint = Math.floor(recent.length / 2);
  for (let i = 0; i < halfPoint; i++) {
    if (recent[i].low < lowestLow) { lowestLow = recent[i].low; lowestIdx = i; }
    if (recent[i].high > highestHigh) { highestHigh = recent[i].high; highestIdx = i; }
  }

  const currentPrice = recent[recent.length - 1].close;
  const range = highestHigh - lowestLow;
  if (range === 0) return noJudas;

  const sweepThreshold = range * 0.3; // 30% of range constitutes a sweep

  // Bullish Judas: price dropped below session open, then reversed up
  if (lowestLow < sessionOpen - sweepThreshold && currentPrice > sessionOpen) {
    return {
      detected: true,
      type: 'bullish',
      midnightOpen: sessionOpen,
      sweepLow: lowestLow,
      sweepHigh: null,
      reversalConfirmed: currentPrice > sessionOpen,
      description: `Bullish Judas Swing: Price swept below session open (${sessionOpen.toFixed(5)}) to ${lowestLow.toFixed(5)}, then reversed above. Current: ${currentPrice.toFixed(5)}`,
    };
  }

  // Bearish Judas: price rose above session open, then reversed down
  if (highestHigh > sessionOpen + sweepThreshold && currentPrice < sessionOpen) {
    return {
      detected: true,
      type: 'bearish',
      midnightOpen: sessionOpen,
      sweepLow: null,
      sweepHigh: highestHigh,
      reversalConfirmed: currentPrice < sessionOpen,
      description: `Bearish Judas Swing: Price swept above session open (${sessionOpen.toFixed(5)}) to ${highestHigh.toFixed(5)}, then reversed below. Current: ${currentPrice.toFixed(5)}`,
    };
  }

  return noJudas;
}

// ─── ICT Concept: Session / Kill Zone ───────────────────────────────

export function detectSession(candles: Candle[]): SessionInfo {
  const now = new Date();
  const nyHour = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }));

  let name = 'Off-Hours';
  let isKillZone = false;

  if (nyHour >= 20 || nyHour < 0) { name = 'Asian Session'; isKillZone = true; }
  else if (nyHour >= 2 && nyHour < 5) { name = 'London Kill Zone'; isKillZone = true; }
  else if (nyHour >= 5 && nyHour < 7) { name = 'London Session'; isKillZone = false; }
  else if (nyHour >= 7 && nyHour < 10) { name = 'New York Kill Zone'; isKillZone = true; }
  else if (nyHour >= 10 && nyHour < 12) { name = 'London Close Kill Zone'; isKillZone = true; }
  else if (nyHour >= 12 && nyHour < 17) { name = 'New York PM Session'; isKillZone = false; }
  else { name = 'Off-Hours'; isKillZone = false; }

  // Calculate session range from recent candles
  const last10 = candles.slice(-10);
  const sessionHigh = Math.max(...last10.map(c => c.high));
  const sessionLow = Math.min(...last10.map(c => c.low));
  const sessionOpen = last10[0]?.open || 0;

  return { name, active: true, isKillZone, sessionHigh, sessionLow, sessionOpen };
}

// ─── ICT Concept: Premium / Discount Zone ───────────────────────────

export function calculatePremiumDiscount(candles: Candle[], swingPoints: SwingPoint[]): PremiumDiscount {
  const highs = swingPoints.filter(s => s.type === 'high').sort((a, b) => b.price - a.price);
  const lows = swingPoints.filter(s => s.type === 'low').sort((a, b) => a.price - b.price);

  const swingHigh = highs[0]?.price ?? Math.max(...candles.map(c => c.high));
  const swingLow = lows[0]?.price ?? Math.min(...candles.map(c => c.low));
  const equilibrium = (swingHigh + swingLow) / 2;
  const currentPrice = candles[candles.length - 1].close;
  const range = swingHigh - swingLow;
  const zonePercent = range > 0 ? ((currentPrice - swingLow) / range) * 100 : 50;

  let currentZone: 'premium' | 'discount' | 'equilibrium' = 'equilibrium';
  if (zonePercent > 55) currentZone = 'premium';
  else if (zonePercent < 45) currentZone = 'discount';

  // OTE zone = 62-79% retracement (which is 21-38% from swing high in our 0-100 scale)
  const oteZone = zonePercent >= 21 && zonePercent <= 38;

  return { swingHigh, swingLow, equilibrium, currentZone, zonePercent, oteZone };
}

// ─── Currency Strength Calculation ──────────────────────────────────

export function calculateCurrencyStrength(
  quotes: Record<string, { price: number; previousClose: number }>
): CurrencyStrength[] {
  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];
  const pairMap: Record<string, { base: string; quote: string; key: string }> = {
    'EUR/USD': { base: 'EUR', quote: 'USD', key: 'EUR/USD' },
    'GBP/USD': { base: 'GBP', quote: 'USD', key: 'GBP/USD' },
    'USD/JPY': { base: 'USD', quote: 'JPY', key: 'USD/JPY' },
    'AUD/USD': { base: 'AUD', quote: 'USD', key: 'AUD/USD' },
    'USD/CAD': { base: 'USD', quote: 'CAD', key: 'USD/CAD' },
    'NZD/USD': { base: 'NZD', quote: 'USD', key: 'NZD/USD' },
    'EUR/GBP': { base: 'EUR', quote: 'GBP', key: 'EUR/GBP' },
    'GBP/JPY': { base: 'GBP', quote: 'JPY', key: 'GBP/JPY' },
  };

  const strengthMap: Record<string, number[]> = {};
  currencies.forEach(c => { strengthMap[c] = []; });

  for (const [, info] of Object.entries(pairMap)) {
    const q = quotes[info.key];
    if (!q || q.previousClose === 0) continue;
    const pctChange = ((q.price - q.previousClose) / q.previousClose) * 100;
    // Base currency gains when pair goes up
    strengthMap[info.base]?.push(pctChange);
    // Quote currency loses when pair goes up
    strengthMap[info.quote]?.push(-pctChange);
  }

  const result: CurrencyStrength[] = currencies.map(currency => {
    const values = strengthMap[currency] || [];
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { currency, strength: Math.round(avg * 100) / 100, rank: 0 };
  });

  // Sort by strength descending and assign ranks
  result.sort((a, b) => b.strength - a.strength);
  result.forEach((r, i) => { r.rank = i + 1; });

  return result;
}

// ─── Correlation Matrix ─────────────────────────────────────────────

export function calculateCorrelation(prices1: number[], prices2: number[]): number {
  const n = Math.min(prices1.length, prices2.length);
  if (n < 5) return 0;

  const p1 = prices1.slice(-n);
  const p2 = prices2.slice(-n);

  const mean1 = p1.reduce((a, b) => a + b, 0) / n;
  const mean2 = p2.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = p1[i] - mean1;
    const dy = p2[i] - mean2;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  return denom === 0 ? 0 : Math.round((sumXY / denom) * 100) / 100;
}

// ─── Reversal Candle Detection ──────────────────────────────────────

export function detectReversalCandle(candles: Candle[]): { found: boolean; type: string } {
  if (candles.length < 3) return { found: false, type: '' };
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const body = Math.abs(last.close - last.open);
  const range = last.high - last.low;

  if (range > 0) {
    const lowerWick = Math.min(last.open, last.close) - last.low;
    const upperWick = last.high - Math.max(last.open, last.close);
    if (lowerWick > body * 2 && upperWick < body * 0.5) return { found: true, type: 'Bullish Pin Bar' };
    if (upperWick > body * 2 && lowerWick < body * 0.5) return { found: true, type: 'Bearish Pin Bar' };
  }

  if (last.close > last.open && prev.close < prev.open && last.open <= prev.close && last.close >= prev.open) {
    return { found: true, type: 'Bullish Engulfing' };
  }
  if (last.close < last.open && prev.close > prev.open && last.open >= prev.close && last.close <= prev.open) {
    return { found: true, type: 'Bearish Engulfing' };
  }
  return { found: false, type: '' };
}

// ─── Full Analysis Pipeline ─────────────────────────────────────────

export function runFullServerAnalysis(
  candles: Candle[],
  dailyCandles: Candle[] | null = null,
  lookback: number = 3,
): FullAnalysis {
  const structure = analyzeMarketStructure(candles, lookback);
  const orderBlocks = detectOrderBlocks(candles);
  const fvgs = detectFVGs(candles);
  const liquidityPools = detectLiquidityPools(candles);
  const pdLevels = dailyCandles ? calculatePDLevels(dailyCandles) : null;
  const judasSwing = detectJudasSwing(candles);
  const session = detectSession(candles);
  const premiumDiscount = calculatePremiumDiscount(candles, structure.swingPoints);
  const reversal = detectReversalCandle(candles);

  // Build reasoning and score
  const reasoning: string[] = [];
  let score = 0;
  const maxScore = 10;

  // 1. Market Structure (0-2 points)
  if (structure.trend !== 'ranging') {
    score += 1;
    reasoning.push(`HTF Bias: ${structure.trend === 'bullish' ? 'Bullish' : 'Bearish'} (${structure.bos.length} BOS, ${structure.choch.length} CHoCH)`);
  } else {
    reasoning.push('HTF Bias: Ranging — no clear directional bias');
  }
  if (structure.choch.length > 0) {
    score += 1;
    const lastChoch = structure.choch[structure.choch.length - 1];
    reasoning.push(`Structure: CHoCH detected (${lastChoch.type}) at ${lastChoch.price.toFixed(5)}`);
  } else if (structure.bos.length > 0) {
    score += 0.5;
    const lastBos = structure.bos[structure.bos.length - 1];
    reasoning.push(`Structure: BOS confirmed (${lastBos.type}) at ${lastBos.price.toFixed(5)}`);
  }

  // 2. Order Block (0-2 points)
  const activeOBs = orderBlocks.filter(ob => !ob.mitigated);
  const currentPrice = candles[candles.length - 1].close;
  const nearbyOB = activeOBs.find(ob => currentPrice >= ob.low && currentPrice <= ob.high);
  if (nearbyOB) {
    score += 2;
    reasoning.push(`Order Block: Price at ${nearbyOB.type} OB (${nearbyOB.low.toFixed(5)} - ${nearbyOB.high.toFixed(5)})`);
  } else if (activeOBs.length > 0) {
    score += 0.5;
    reasoning.push(`Order Block: ${activeOBs.length} active OBs nearby`);
  }

  // 3. Fair Value Gap (0-1.5 points)
  const activeFVGs = fvgs.filter(f => !f.mitigated);
  const nearbyFVG = activeFVGs.find(f => currentPrice >= f.low && currentPrice <= f.high);
  if (nearbyFVG) {
    score += 1.5;
    reasoning.push(`FVG: Price inside ${nearbyFVG.type} FVG (${nearbyFVG.low.toFixed(5)} - ${nearbyFVG.high.toFixed(5)})`);
  } else if (activeFVGs.length > 0) {
    score += 0.5;
    reasoning.push(`FVG: ${activeFVGs.length} unfilled FVGs in range`);
  }

  // 4. Premium/Discount Zone (0-1.5 points)
  if (premiumDiscount.currentZone === 'discount' && structure.trend === 'bullish') {
    score += 1.5;
    reasoning.push(`PD Zone: Price in DISCOUNT (${premiumDiscount.zonePercent.toFixed(0)}%) — ideal for longs`);
  } else if (premiumDiscount.currentZone === 'premium' && structure.trend === 'bearish') {
    score += 1.5;
    reasoning.push(`PD Zone: Price in PREMIUM (${premiumDiscount.zonePercent.toFixed(0)}%) — ideal for shorts`);
  } else {
    reasoning.push(`PD Zone: ${premiumDiscount.currentZone} (${premiumDiscount.zonePercent.toFixed(0)}%)`);
  }
  if (premiumDiscount.oteZone) {
    score += 0.5;
    reasoning.push('OTE: Price in Optimal Trade Entry zone (62-79% retracement)');
  }

  // 5. Session / Kill Zone (0-1 point)
  if (session.isKillZone) {
    score += 1;
    reasoning.push(`Session: ${session.name} — HIGH PROBABILITY window`);
  } else {
    reasoning.push(`Session: ${session.name}`);
  }

  // 6. Judas Swing (0-1 point)
  if (judasSwing.detected && judasSwing.reversalConfirmed) {
    score += 1;
    reasoning.push(`Judas Swing: ${judasSwing.type === 'bullish' ? 'Bullish' : 'Bearish'} Judas completed and confirmed`);
  } else if (judasSwing.detected) {
    score += 0.5;
    reasoning.push(`Judas Swing: ${judasSwing.type === 'bullish' ? 'Bullish' : 'Bearish'} Judas detected, awaiting confirmation`);
  }

  // 7. PD/PW Levels proximity (0-0.5 points)
  if (pdLevels) {
    const pdTargets = [
      { name: 'PDH', price: pdLevels.pdh },
      { name: 'PDL', price: pdLevels.pdl },
      { name: 'PWH', price: pdLevels.pwh },
      { name: 'PWL', price: pdLevels.pwl },
    ];
    const nearPD = pdTargets.find(t => Math.abs(currentPrice - t.price) / currentPrice < 0.002);
    if (nearPD) {
      score += 0.5;
      reasoning.push(`PD Levels: Price near ${nearPD.name} (${nearPD.price.toFixed(5)}) — liquidity target`);
    } else {
      reasoning.push(`PD Levels: PDH=${pdLevels.pdh.toFixed(5)}, PDL=${pdLevels.pdl.toFixed(5)}`);
    }
  }

  // 8. Reversal candle (0-0.5 points)
  if (reversal.found) {
    score += 0.5;
    reasoning.push(`Reversal: ${reversal.type} confirmed on latest candle`);
  }

  // 9. Liquidity (0-0.5 points)
  const recentSweep = liquidityPools.find(lp => lp.swept && lp.strength >= 2);
  if (recentSweep) {
    score += 0.5;
    reasoning.push(`Liquidity: ${recentSweep.type} liquidity swept at ${recentSweep.price.toFixed(5)} (${recentSweep.strength} touches)`);
  }

  // Normalize score to 0-10
  const normalizedScore = Math.min(10, Math.round(score * 10) / 10);

  // Determine bias
  let bias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (structure.trend === 'bullish' && premiumDiscount.currentZone !== 'premium') bias = 'bullish';
  else if (structure.trend === 'bearish' && premiumDiscount.currentZone !== 'discount') bias = 'bearish';

  return {
    structure, orderBlocks, fvgs, liquidityPools,
    pdLevels, judasSwing, session, premiumDiscount,
    confluenceScore: normalizedScore,
    bias,
    reasoning,
  };
}
