/**
 * SMC (Smart Money Concepts) Analysis Engine
 * 
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 * All analysis runs client-side on OHLCV data fetched from Twelve Data API.
 */

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
  mitigatedPercent: number; // how much of the OB has been tested (0-100)
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
  strength: number; // number of touches
  datetime: string;
  swept: boolean;
}

export interface FibLevel {
  level: number;
  price: number;
  label: string;
}

export interface MarketStructure {
  trend: 'bullish' | 'bearish' | 'ranging';
  swingPoints: SwingPoint[];
  bos: { index: number; type: 'bullish' | 'bearish'; price: number; datetime: string }[];
  choch: { index: number; type: 'bullish' | 'bearish'; price: number; datetime: string }[];
}

export interface AnalysisResult {
  structure: MarketStructure;
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
  liquidityPools: LiquidityPool[];
  fibLevels: FibLevel[];
  fiftyPercentLevel: number;
  keySupport: number[];
  keyResistance: number[];
  entryChecklist: EntryChecklist;
}

export interface EntryChecklist {
  retraceToOBFVG: { status: boolean; detail: string };
  confluenceWithKeyLevels: { status: boolean; detail: string };
  marketStructureShiftLTF: { status: boolean; detail: string };
  reversalCandleConfirmed: { status: boolean; detail: string };
  overallScore: number; // 0-4
  bias: 'bullish' | 'bearish' | 'neutral';
}

// Detect swing highs and lows using a lookback/lookforward window
export function detectSwingPoints(candles: Candle[], lookback: number = 3): SwingPoint[] {
  const swings: SwingPoint[] = [];
  
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
        isHigh = false;
      }
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
        isLow = false;
      }
    }
    
    if (isHigh) {
      swings.push({ index: i, price: candles[i].high, type: 'high', datetime: candles[i].datetime });
    }
    if (isLow) {
      swings.push({ index: i, price: candles[i].low, type: 'low', datetime: candles[i].datetime });
    }
  }
  
  return swings;
}

// Determine market structure (trend, BOS, CHoCH)
export function analyzeMarketStructure(candles: Candle[], lookback: number = 3): MarketStructure {
  const swings = detectSwingPoints(candles, lookback);
  const bos: MarketStructure['bos'] = [];
  const choch: MarketStructure['choch'] = [];
  
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  
  // Detect Break of Structure (BOS) and Change of Character (CHoCH)
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
  
  // Determine overall trend from recent swing points
  let trend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
  if (highs.length >= 2 && lows.length >= 2) {
    const recentHighs = highs.slice(-2);
    const recentLows = lows.slice(-2);
    const higherHighs = recentHighs[1].price > recentHighs[0].price;
    const higherLows = recentLows[1].price > recentLows[0].price;
    const lowerHighs = recentHighs[1].price < recentHighs[0].price;
    const lowerLows = recentLows[1].price < recentLows[0].price;
    
    if (higherHighs && higherLows) trend = 'bullish';
    else if (lowerHighs && lowerLows) trend = 'bearish';
  }
  
  return { trend, swingPoints: swings, bos, choch };
}

// Detect Order Blocks
export function detectOrderBlocks(candles: Candle[]): OrderBlock[] {
  const obs: OrderBlock[] = [];
  
  for (let i = 2; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const prevPrev = candles[i - 2];
    
    // Bullish OB: last bearish candle before a strong bullish move
    if (prev.close < prev.open && curr.close > curr.open && curr.close > prev.high) {
      const ob: OrderBlock = {
        index: i - 1,
        high: prev.high,
        low: prev.low,
        type: 'bullish',
        datetime: prev.datetime,
        mitigated: false,
        mitigatedPercent: 0,
      };
      
      // Check if mitigated by subsequent candles
      for (let j = i + 1; j < candles.length; j++) {
        const midPoint = (ob.high + ob.low) / 2;
        if (candles[j].low <= midPoint) {
          ob.mitigatedPercent = Math.min(100, ((ob.high - candles[j].low) / (ob.high - ob.low)) * 100);
          if (ob.mitigatedPercent >= 50) {
            ob.mitigated = true;
          }
          break;
        }
      }
      
      obs.push(ob);
    }
    
    // Bearish OB: last bullish candle before a strong bearish move
    if (prev.close > prev.open && curr.close < curr.open && curr.close < prev.low) {
      const ob: OrderBlock = {
        index: i - 1,
        high: prev.high,
        low: prev.low,
        type: 'bearish',
        datetime: prev.datetime,
        mitigated: false,
        mitigatedPercent: 0,
      };
      
      for (let j = i + 1; j < candles.length; j++) {
        const midPoint = (ob.high + ob.low) / 2;
        if (candles[j].high >= midPoint) {
          ob.mitigatedPercent = Math.min(100, ((candles[j].high - ob.low) / (ob.high - ob.low)) * 100);
          if (ob.mitigatedPercent >= 50) {
            ob.mitigated = true;
          }
          break;
        }
      }
      
      obs.push(ob);
    }
  }
  
  return obs;
}

// Detect Fair Value Gaps (FVGs)
export function detectFVGs(candles: Candle[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];
    
    // Bullish FVG: gap between c1.high and c3.low (c3.low > c1.high)
    if (c3.low > c1.high && c2.close > c2.open) {
      const fvg: FairValueGap = {
        index: i - 1,
        high: c3.low,
        low: c1.high,
        type: 'bullish',
        datetime: c2.datetime,
        mitigated: false,
      };
      
      // Check mitigation
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].low <= fvg.low) {
          fvg.mitigated = true;
          break;
        }
      }
      
      fvgs.push(fvg);
    }
    
    // Bearish FVG: gap between c3.high and c1.low (c1.low > c3.high)
    if (c1.low > c3.high && c2.close < c2.open) {
      const fvg: FairValueGap = {
        index: i - 1,
        high: c1.low,
        low: c3.high,
        type: 'bearish',
        datetime: c2.datetime,
        mitigated: false,
      };
      
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].high >= fvg.high) {
          fvg.mitigated = true;
          break;
        }
      }
      
      fvgs.push(fvg);
    }
  }
  
  return fvgs;
}

// Detect Liquidity Pools (equal highs/lows clusters)
export function detectLiquidityPools(candles: Candle[], tolerance: number = 0.001): LiquidityPool[] {
  const pools: LiquidityPool[] = [];
  const priceRange = Math.max(...candles.map(c => c.high)) - Math.min(...candles.map(c => c.low));
  const tol = priceRange * tolerance;
  
  // Find clusters of equal highs (buy-side liquidity)
  const highPrices = candles.map((c, i) => ({ price: c.high, index: i, datetime: c.datetime }));
  const usedHighs = new Set<number>();
  
  for (let i = 0; i < highPrices.length; i++) {
    if (usedHighs.has(i)) continue;
    let count = 1;
    for (let j = i + 1; j < highPrices.length; j++) {
      if (usedHighs.has(j)) continue;
      if (Math.abs(highPrices[i].price - highPrices[j].price) <= tol) {
        count++;
        usedHighs.add(j);
      }
    }
    if (count >= 2) {
      const lastCandle = candles[candles.length - 1];
      pools.push({
        price: highPrices[i].price,
        type: 'buy-side',
        strength: count,
        datetime: highPrices[i].datetime,
        swept: lastCandle.high > highPrices[i].price,
      });
    }
  }
  
  // Find clusters of equal lows (sell-side liquidity)
  const lowPrices = candles.map((c, i) => ({ price: c.low, index: i, datetime: c.datetime }));
  const usedLows = new Set<number>();
  
  for (let i = 0; i < lowPrices.length; i++) {
    if (usedLows.has(i)) continue;
    let count = 1;
    for (let j = i + 1; j < lowPrices.length; j++) {
      if (usedLows.has(j)) continue;
      if (Math.abs(lowPrices[i].price - lowPrices[j].price) <= tol) {
        count++;
        usedLows.add(j);
      }
    }
    if (count >= 2) {
      const lastCandle = candles[candles.length - 1];
      pools.push({
        price: lowPrices[i].price,
        type: 'sell-side',
        strength: count,
        datetime: lowPrices[i].datetime,
        swept: lastCandle.low < lowPrices[i].price,
      });
    }
  }
  
  return pools.sort((a, b) => b.strength - a.strength);
}

// Calculate Fibonacci retracement levels
export function calculateFibLevels(swingHigh: number, swingLow: number): FibLevel[] {
  const diff = swingHigh - swingLow;
  const levels = [
    { level: 0, label: '0%' },
    { level: 0.236, label: '23.6%' },
    { level: 0.382, label: '38.2%' },
    { level: 0.5, label: '50%' },
    { level: 0.618, label: '61.8%' },
    { level: 0.786, label: '78.6%' },
    { level: 1, label: '100%' },
  ];
  
  return levels.map(l => ({
    level: l.level,
    price: swingHigh - diff * l.level,
    label: l.label,
  }));
}

// Calculate the 50% level of a major move
export function calculate50Percent(candles: Candle[]): number {
  const highest = Math.max(...candles.map(c => c.high));
  const lowest = Math.min(...candles.map(c => c.low));
  return (highest + lowest) / 2;
}

// Detect support and resistance levels
export function detectSupportResistance(candles: Candle[], swings: SwingPoint[]): { support: number[]; resistance: number[] } {
  const currentPrice = candles[candles.length - 1].close;
  
  const support = swings
    .filter(s => s.type === 'low' && s.price < currentPrice)
    .map(s => s.price)
    .sort((a, b) => b - a)
    .slice(0, 5);
  
  const resistance = swings
    .filter(s => s.type === 'high' && s.price > currentPrice)
    .map(s => s.price)
    .sort((a, b) => a - b)
    .slice(0, 5);
  
  return { support, resistance };
}

// Check for reversal candle patterns
export function detectReversalCandle(candles: Candle[]): { found: boolean; type: string } {
  if (candles.length < 3) return { found: false, type: '' };
  
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const body = Math.abs(last.close - last.open);
  const range = last.high - last.low;
  
  // Pin bar / hammer
  if (range > 0) {
    const lowerWick = Math.min(last.open, last.close) - last.low;
    const upperWick = last.high - Math.max(last.open, last.close);
    
    if (lowerWick > body * 2 && upperWick < body * 0.5) {
      return { found: true, type: 'Bullish Pin Bar' };
    }
    if (upperWick > body * 2 && lowerWick < body * 0.5) {
      return { found: true, type: 'Bearish Pin Bar' };
    }
  }
  
  // Engulfing
  if (last.close > last.open && prev.close < prev.open &&
      last.open <= prev.close && last.close >= prev.open) {
    return { found: true, type: 'Bullish Engulfing' };
  }
  if (last.close < last.open && prev.close > prev.open &&
      last.open >= prev.close && last.close <= prev.open) {
    return { found: true, type: 'Bearish Engulfing' };
  }
  
  return { found: false, type: '' };
}

// Generate the entry checklist based on all analysis
export function generateEntryChecklist(
  candles: Candle[],
  structure: MarketStructure,
  orderBlocks: OrderBlock[],
  fvgs: FairValueGap[],
  fibLevels: FibLevel[],
  support: number[],
  resistance: number[],
): EntryChecklist {
  const currentPrice = candles[candles.length - 1].close;
  const bias = structure.trend;
  
  // 1. Check retrace to OB/FVG
  const nearOB = orderBlocks.filter(ob => !ob.mitigated).some(ob => {
    return currentPrice >= ob.low && currentPrice <= ob.high;
  });
  const nearFVG = fvgs.filter(f => !f.mitigated).some(f => {
    return currentPrice >= f.low && currentPrice <= f.high;
  });
  const retraceToOBFVG = nearOB || nearFVG;
  
  // 2. Check confluence with key levels
  const fib50 = fibLevels.find(f => f.label === '50%');
  const fib618 = fibLevels.find(f => f.label === '61.8%');
  const nearFib = fib50 && fib618 ? (
    Math.abs(currentPrice - fib50.price) / currentPrice < 0.005 ||
    Math.abs(currentPrice - fib618.price) / currentPrice < 0.005
  ) : false;
  const nearSR = [...support, ...resistance].some(level => 
    Math.abs(currentPrice - level) / currentPrice < 0.003
  );
  const confluenceWithKeyLevels = nearFib || nearSR;
  
  // 3. Market structure shift on LTF (approximated by recent BOS/CHoCH)
  const recentBOS = structure.bos.length > 0;
  const recentCHOCH = structure.choch.length > 0;
  const marketStructureShiftLTF = recentBOS || recentCHOCH;
  
  // 4. Reversal candle
  const reversal = detectReversalCandle(candles);
  
  let score = 0;
  if (retraceToOBFVG) score++;
  if (confluenceWithKeyLevels) score++;
  if (marketStructureShiftLTF) score++;
  if (reversal.found) score++;
  
  return {
    retraceToOBFVG: {
      status: retraceToOBFVG,
      detail: retraceToOBFVG 
        ? `Price at ${nearOB ? 'Order Block' : 'Fair Value Gap'} zone`
        : 'Price not at any OB/FVG zone',
    },
    confluenceWithKeyLevels: {
      status: confluenceWithKeyLevels,
      detail: confluenceWithKeyLevels
        ? `Confluence: ${nearFib ? 'Fibonacci level' : ''}${nearFib && nearSR ? ' + ' : ''}${nearSR ? 'S/R level' : ''}`
        : 'No confluence detected at current price',
    },
    marketStructureShiftLTF: {
      status: marketStructureShiftLTF,
      detail: marketStructureShiftLTF
        ? `${recentCHOCH ? 'CHoCH detected' : 'BOS confirmed'} — ${structure.trend} bias`
        : 'No clear structure shift detected',
    },
    reversalCandleConfirmed: {
      status: reversal.found,
      detail: reversal.found ? reversal.type : 'No reversal pattern on latest candle',
    },
    overallScore: score,
    bias: bias === 'ranging' ? 'neutral' : bias,
  };
}

// Full analysis pipeline
export function runFullAnalysis(candles: Candle[], lookback: number = 3): AnalysisResult {
  const structure = analyzeMarketStructure(candles, lookback);
  const orderBlocks = detectOrderBlocks(candles);
  const fvgs = detectFVGs(candles);
  const liquidityPools = detectLiquidityPools(candles);
  
  // Find most significant swing high and low for Fibonacci
  const swingHighs = structure.swingPoints.filter(s => s.type === 'high').sort((a, b) => b.price - a.price);
  const swingLows = structure.swingPoints.filter(s => s.type === 'low').sort((a, b) => a.price - b.price);
  
  const majorHigh = swingHighs[0]?.price ?? Math.max(...candles.map(c => c.high));
  const majorLow = swingLows[0]?.price ?? Math.min(...candles.map(c => c.low));
  
  const fibLevels = calculateFibLevels(majorHigh, majorLow);
  const fiftyPercentLevel = calculate50Percent(candles);
  const { support, resistance } = detectSupportResistance(candles, structure.swingPoints);
  
  const entryChecklist = generateEntryChecklist(
    candles, structure, orderBlocks, fvgs, fibLevels, support, resistance
  );
  
  return {
    structure,
    orderBlocks,
    fvgs,
    liquidityPools,
    fibLevels,
    fiftyPercentLevel,
    keySupport: support,
    keyResistance: resistance,
    entryChecklist,
  };
}
