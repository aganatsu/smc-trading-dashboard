/**
 * Autonomous Bot Decision Engine
 * 
 * This is the "brain" of the trading bot. It:
 * 1. Auto-scans all enabled instruments on a configurable timer
 * 2. Runs full SMC analysis on each instrument
 * 3. Scores setups using the user's config parameters
 * 4. Auto-places trades when confluence meets threshold
 * 5. Generates detailed reasoning for every trade (why taken)
 * 6. Generates post-mortems when trades close (why won/lost)
 * 7. Manages trailing stops, break-even, partial TP, time-based exits
 */

import { getConfig, type BotConfig } from "./botConfig";
import {
  runFullServerAnalysis,
  calculateCurrencyStrength,
  calculateCorrelation,
  type FullAnalysis,
  type Candle,
} from "./smcAnalysis";
import { fetchCandlesFromYahoo, fetchQuoteFromYahoo, type CandleData } from "./marketData";
import {
  placeOrder,
  closePosition,
  getStatus,
  addLog,
  registerPostMortemGenerator,
  type PaperPosition,
} from "./paperTrading";
import { notifySignalDetected, notifyTradePlaced, notifyTradeClosed, notifyEngineError } from "./notifications";
import {
  insertTradeReasoning,
  insertTradePostMortem,
  getTradeReasoningByPositionId as dbGetReasoning,
  getTradePostMortemByPositionId as dbGetPostMortem,
  getRecentTradeReasonings as dbGetRecentReasonings,
  getRecentTradePostMortems as dbGetRecentPostMortems,
} from "./db";

// ─── Types ──────────────────────────────────────────────────────────

export interface TradeReasoning {
  summary: string;           // One-line summary
  confluenceScore: number;
  factors: ReasoningFactor[];
  session: string;
  timeframe: string;
  timestamp: number;
}

export interface ReasoningFactor {
  concept: string;           // e.g., "Order Block", "FVG", "Judas Swing"
  present: boolean;
  weight: number;            // How much it contributed to the score
  detail: string;            // Human-readable explanation
}

export interface TradePostMortem {
  tradeId: string;
  outcome: 'win' | 'loss' | 'breakeven';
  pnl: number;
  holdDuration: string;
  entryReasoning: TradeReasoning;
  exitReason: string;        // "SL Hit", "TP Hit", "Manual Close", "Time-based Exit"
  whatWorked: string[];
  whatFailed: string[];
  lessonLearned: string;
}

export interface ScanResult {
  symbol: string;
  analysis: FullAnalysis;
  signal: 'buy' | 'sell' | 'no_signal';
  confluenceScore: number;
  reasoning: TradeReasoning;
  tradePlaced: boolean;
  rejectionReason?: string;
}

export interface EngineState {
  running: boolean;
  autoTrading: boolean;
  scanInterval: number;       // seconds
  lastScanTime: number;
  totalScans: number;
  totalSignals: number;
  totalTradesPlaced: number;
  totalRejected: number;
  scanResults: ScanResult[];  // Last scan results
  tradeReasonings: Map<string, TradeReasoning>;  // positionId → reasoning
  postMortems: TradePostMortem[];
}

// ─── Engine State ───────────────────────────────────────────────────

const state: EngineState = {
  running: false,
  autoTrading: false,
  scanInterval: 60,
  lastScanTime: 0,
  totalScans: 0,
  totalSignals: 0,
  totalTradesPlaced: 0,
  totalRejected: 0,
  scanResults: [],
  tradeReasonings: new Map(),
  postMortems: [],
};

let scanTimer: ReturnType<typeof setInterval> | null = null;

// ─── Instrument Specs ───────────────────────────────────────────────

const INSTRUMENT_SPECS: Record<string, { pipSize: number; lotValue: number; marginReq: number }> = {
  'EUR/USD': { pipSize: 0.0001, lotValue: 100000, marginReq: 1000 },
  'GBP/USD': { pipSize: 0.0001, lotValue: 100000, marginReq: 1000 },
  'USD/JPY': { pipSize: 0.01, lotValue: 100000, marginReq: 1000 },
  'GBP/JPY': { pipSize: 0.01, lotValue: 100000, marginReq: 1000 },
  'AUD/USD': { pipSize: 0.0001, lotValue: 100000, marginReq: 1000 },
  'USD/CAD': { pipSize: 0.0001, lotValue: 100000, marginReq: 1000 },
  'EUR/GBP': { pipSize: 0.0001, lotValue: 100000, marginReq: 1000 },
  'NZD/USD': { pipSize: 0.0001, lotValue: 100000, marginReq: 1000 },
  'XAU/USD': { pipSize: 0.01, lotValue: 100, marginReq: 2000 },
  'XAG/USD': { pipSize: 0.001, lotValue: 5000, marginReq: 1000 },
  'BTC/USD': { pipSize: 0.01, lotValue: 1, marginReq: 5000 },
  'ETH/USD': { pipSize: 0.01, lotValue: 1, marginReq: 1000 },
};

// ─── Timeframe Mapping ─────────────────────────────────────────────
// BotConfig uses '1H', '15m', '5m', '1m', '1D', '1W', '4H'
// Yahoo Finance expects '1h', '15min', '5min', '1day', '1week', '4h'
const TF_MAP: Record<string, string> = {
  '1W': '1week', '1D': '1day', '4H': '4h',
  '1H': '1h', '15m': '15min', '5m': '5min', '1m': '5min', // 1m not supported, fallback to 5min
};
function mapTF(tf: string): string { return TF_MAP[tf] || tf; }

// ─── Core Engine Functions ──────────────────────────────────────────

function buildTradeReasoning(
  analysis: FullAnalysis,
  signal: 'buy' | 'sell',
  config: BotConfig,
  symbol: string,
): TradeReasoning {
  const factors: ReasoningFactor[] = [];

  // Market Structure
  factors.push({
    concept: 'Market Structure',
    present: analysis.structure.trend !== 'ranging',
    weight: analysis.structure.trend !== 'ranging' ? 2 : 0,
    detail: analysis.structure.trend !== 'ranging'
      ? `${analysis.structure.trend} trend with ${analysis.structure.bos.length} BOS and ${analysis.structure.choch.length} CHoCH`
      : 'Ranging market — no clear directional bias',
  });

  // Order Block
  const currentPrice = analysis.orderBlocks.length > 0 ? 0 : 0; // placeholder
  const activeOBs = analysis.orderBlocks.filter(ob => !ob.mitigated);
  const relevantOB = signal === 'buy'
    ? activeOBs.find(ob => ob.type === 'bullish')
    : activeOBs.find(ob => ob.type === 'bearish');
  factors.push({
    concept: 'Order Block',
    present: !!relevantOB,
    weight: relevantOB ? 2 : 0,
    detail: relevantOB
      ? `${relevantOB.type} OB at ${relevantOB.low.toFixed(5)} - ${relevantOB.high.toFixed(5)} (${relevantOB.mitigatedPercent.toFixed(0)}% mitigated)`
      : 'No relevant unmitigated order block found',
  });

  // Fair Value Gap
  const activeFVGs = analysis.fvgs.filter(f => !f.mitigated);
  const relevantFVG = signal === 'buy'
    ? activeFVGs.find(f => f.type === 'bullish')
    : activeFVGs.find(f => f.type === 'bearish');
  factors.push({
    concept: 'Fair Value Gap',
    present: !!relevantFVG,
    weight: relevantFVG ? 1.5 : 0,
    detail: relevantFVG
      ? `${relevantFVG.type} FVG at ${relevantFVG.low.toFixed(5)} - ${relevantFVG.high.toFixed(5)}`
      : `${activeFVGs.length} unfilled FVGs in range but none directly relevant`,
  });

  // Premium/Discount
  const pdAligned = (signal === 'buy' && analysis.premiumDiscount.currentZone === 'discount')
    || (signal === 'sell' && analysis.premiumDiscount.currentZone === 'premium');
  factors.push({
    concept: 'Premium/Discount Zone',
    present: pdAligned,
    weight: pdAligned ? 1.5 : 0,
    detail: `Price in ${analysis.premiumDiscount.currentZone} zone (${analysis.premiumDiscount.zonePercent.toFixed(0)}%)${analysis.premiumDiscount.oteZone ? ' — OTE zone active' : ''}`,
  });

  // Session / Kill Zone
  factors.push({
    concept: 'Session/Kill Zone',
    present: analysis.session.isKillZone,
    weight: analysis.session.isKillZone ? 1 : 0,
    detail: `${analysis.session.name}${analysis.session.isKillZone ? ' — HIGH PROBABILITY window' : ''}`,
  });

  // Judas Swing
  const judasAligned = analysis.judasSwing.detected
    && ((signal === 'buy' && analysis.judasSwing.type === 'bullish')
      || (signal === 'sell' && analysis.judasSwing.type === 'bearish'));
  factors.push({
    concept: 'Judas Swing',
    present: judasAligned,
    weight: judasAligned ? 1 : 0,
    detail: analysis.judasSwing.description,
  });

  // PD/PW Levels
  factors.push({
    concept: 'PD/PW Levels',
    present: !!analysis.pdLevels,
    weight: analysis.pdLevels ? 0.5 : 0,
    detail: analysis.pdLevels
      ? `PDH=${analysis.pdLevels.pdh.toFixed(5)}, PDL=${analysis.pdLevels.pdl.toFixed(5)}, PWH=${analysis.pdLevels.pwh.toFixed(5)}, PWL=${analysis.pdLevels.pwl.toFixed(5)}`
      : 'Insufficient daily data for PD/PW levels',
  });

  // Liquidity
  const sweptPool = analysis.liquidityPools.find(lp => lp.swept);
  factors.push({
    concept: 'Liquidity Sweep',
    present: !!sweptPool,
    weight: sweptPool ? 0.5 : 0,
    detail: sweptPool
      ? `${sweptPool.type} liquidity swept at ${sweptPool.price.toFixed(5)} (${sweptPool.strength} touches)`
      : 'No recent liquidity sweep detected',
  });

  const presentFactors = factors.filter(f => f.present);
  const summary = `${signal.toUpperCase()} ${symbol}: ${presentFactors.length}/${factors.length} factors aligned (score: ${analysis.confluenceScore}/10). ${presentFactors.map(f => f.concept).join(', ')}`;

  return {
    summary,
    confluenceScore: analysis.confluenceScore,
    factors,
    session: analysis.session.name,
    timeframe: config.strategy.entryTimeframe,
    timestamp: Date.now(),
  };
}

function calculatePositionSize(
  config: BotConfig,
  entryPrice: number,
  stopLoss: number,
  symbol: string,
  balance: number,
): number {
  const spec = INSTRUMENT_SPECS[symbol] || { pipSize: 0.0001, lotValue: 100000, marginReq: 1000 };
  const riskAmount = balance * (config.risk.riskPerTrade / 100);
  const slPips = Math.abs(entryPrice - stopLoss) / spec.pipSize;

  if (config.risk.positionSizingMethod === 'fixed_lots') {
    return config.risk.fixedLotSize;
  }

  if (slPips === 0) return config.risk.fixedLotSize;

  // percent_risk: lots = riskAmount / (slPips * pipValue)
  const pipValue = spec.pipSize * spec.lotValue;
  const lots = riskAmount / (slPips * pipValue);
  return Math.round(lots * 100) / 100; // Round to 2 decimals
}

function calculateSLTP(
  config: BotConfig,
  entryPrice: number,
  direction: 'long' | 'short',
  analysis: FullAnalysis,
  symbol: string,
): { sl: number; tp: number } {
  const spec = INSTRUMENT_SPECS[symbol] || { pipSize: 0.0001, lotValue: 100000, marginReq: 1000 };

  // Stop Loss
  let sl: number;
  if (config.exit.stopLossMethod === 'fixed_pips') {
    sl = direction === 'long'
      ? entryPrice - config.exit.fixedSLPips * spec.pipSize
      : entryPrice + config.exit.fixedSLPips * spec.pipSize;
  } else if (config.exit.stopLossMethod === 'structure') {
    // Place SL below/above nearest swing point
    const swings = analysis.structure.swingPoints;
    if (direction === 'long') {
      const recentLows = swings.filter(s => s.type === 'low' && s.price < entryPrice).sort((a, b) => b.price - a.price);
      sl = recentLows[0]?.price ? recentLows[0].price - 2 * spec.pipSize : entryPrice - config.exit.fixedSLPips * spec.pipSize;
    } else {
      const recentHighs = swings.filter(s => s.type === 'high' && s.price > entryPrice).sort((a, b) => a.price - b.price);
      sl = recentHighs[0]?.price ? recentHighs[0].price + 2 * spec.pipSize : entryPrice + config.exit.fixedSLPips * spec.pipSize;
    }
  } else if (config.exit.stopLossMethod === 'below_ob') {
    const activeOBs = analysis.orderBlocks.filter(ob => !ob.mitigated);
    if (direction === 'long') {
      const bullOB = activeOBs.filter(ob => ob.type === 'bullish' && ob.low < entryPrice).sort((a, b) => b.low - a.low)[0];
      sl = bullOB ? bullOB.low - 2 * spec.pipSize : entryPrice - config.exit.fixedSLPips * spec.pipSize;
    } else {
      const bearOB = activeOBs.filter(ob => ob.type === 'bearish' && ob.high > entryPrice).sort((a, b) => a.high - b.high)[0];
      sl = bearOB ? bearOB.high + 2 * spec.pipSize : entryPrice + config.exit.fixedSLPips * spec.pipSize;
    }
  } else {
    sl = direction === 'long'
      ? entryPrice - config.exit.fixedSLPips * spec.pipSize
      : entryPrice + config.exit.fixedSLPips * spec.pipSize;
  }

  // Take Profit
  let tp: number;
  if (config.exit.takeProfitMethod === 'fixed_pips') {
    tp = direction === 'long'
      ? entryPrice + config.exit.fixedTPPips * spec.pipSize
      : entryPrice - config.exit.fixedTPPips * spec.pipSize;
  } else if (config.exit.takeProfitMethod === 'rr_ratio') {
    const slDistance = Math.abs(entryPrice - sl);
    tp = direction === 'long'
      ? entryPrice + slDistance * config.exit.tpRRRatio
      : entryPrice - slDistance * config.exit.tpRRRatio;
  } else if (config.exit.takeProfitMethod === 'next_level') {
    // Use nearest PD level or liquidity pool as TP
    if (direction === 'long') {
      const targets = [
        ...(analysis.pdLevels ? [analysis.pdLevels.pdh, analysis.pdLevels.pwh] : []),
        ...analysis.liquidityPools.filter(lp => lp.type === 'buy-side' && lp.price > entryPrice).map(lp => lp.price),
      ].filter(p => p > entryPrice).sort((a, b) => a - b);
      tp = targets[0] || entryPrice + config.exit.fixedTPPips * spec.pipSize;
    } else {
      const targets = [
        ...(analysis.pdLevels ? [analysis.pdLevels.pdl, analysis.pdLevels.pwl] : []),
        ...analysis.liquidityPools.filter(lp => lp.type === 'sell-side' && lp.price < entryPrice).map(lp => lp.price),
      ].filter(p => p < entryPrice).sort((a, b) => b - a);
      tp = targets[0] || entryPrice - config.exit.fixedTPPips * spec.pipSize;
    }
  } else {
    const slDistance = Math.abs(entryPrice - sl);
    tp = direction === 'long'
      ? entryPrice + slDistance * config.exit.tpRRRatio
      : entryPrice - slDistance * config.exit.tpRRRatio;
  }

  return { sl, tp };
}

function isSessionAllowed(config: BotConfig): { allowed: boolean; reason: string } {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const currentTime = utcHour * 60 + utcMin;

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = dayNames[now.getUTCDay()];
  if (config.sessions.activeDays[today] === false) {
    return { allowed: false, reason: `${today} is disabled in session filter` };
  }

  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const inRange = (start: string, end: string) => {
    const s = parseTime(start);
    const e = parseTime(end);
    if (s <= e) return currentTime >= s && currentTime <= e;
    return currentTime >= s || currentTime <= e; // Overnight session
  };

  let anySessionActive = false;
  if (config.sessions.londonEnabled && inRange(config.sessions.londonStart, config.sessions.londonEnd)) anySessionActive = true;
  if (config.sessions.newYorkEnabled && inRange(config.sessions.newYorkStart, config.sessions.newYorkEnd)) anySessionActive = true;
  if (config.sessions.asianEnabled && inRange(config.sessions.asianStart, config.sessions.asianEnd)) anySessionActive = true;
  if (config.sessions.sydneyEnabled && inRange(config.sessions.sydneyStart, config.sessions.sydneyEnd)) anySessionActive = true;

  if (!anySessionActive) {
    return { allowed: false, reason: 'No active trading session right now' };
  }

  return { allowed: true, reason: 'Session active' };
}

async function scanInstrument(symbol: string, config: BotConfig): Promise<ScanResult> {
  const noSignal = (reason: string): ScanResult => ({
    symbol,
    analysis: null as any,
    signal: 'no_signal',
    confluenceScore: 0,
    reasoning: {
      summary: `${symbol}: No signal — ${reason}`,
      confluenceScore: 0,
      factors: [],
      session: '',
      timeframe: config.strategy.entryTimeframe,
      timestamp: Date.now(),
    },
    tradePlaced: false,
    rejectionReason: reason,
  });

  try {
    // Fetch candles for entry timeframe
    const entryCandles = await fetchCandlesFromYahoo(symbol, mapTF(config.strategy.entryTimeframe), 200);
    if (entryCandles.length < 50) return noSignal('Insufficient candle data');

    // Fetch daily candles for PD/PW levels
    let dailyCandles: CandleData[] | null = null;
    try {
      dailyCandles = await fetchCandlesFromYahoo(symbol, '1day', 30);
    } catch { /* daily data optional */ }

    // Run full analysis
    const analysis = runFullServerAnalysis(entryCandles, dailyCandles, 3);

    // Determine signal direction
    let signal: 'buy' | 'sell' | 'no_signal' = 'no_signal';
    if (analysis.bias === 'bullish' && analysis.confluenceScore >= config.strategy.minConfluenceScore) {
      signal = 'buy';
    } else if (analysis.bias === 'bearish' && analysis.confluenceScore >= config.strategy.minConfluenceScore) {
      signal = 'sell';
    }

    if (signal === 'no_signal') {
      return {
        symbol,
        analysis,
        signal: 'no_signal',
        confluenceScore: analysis.confluenceScore,
        reasoning: {
          summary: `${symbol}: Score ${analysis.confluenceScore}/10 (need ${config.strategy.minConfluenceScore}) — ${analysis.bias} bias`,
          confluenceScore: analysis.confluenceScore,
          factors: [],
          session: analysis.session.name,
          timeframe: config.strategy.entryTimeframe,
          timestamp: Date.now(),
        },
        tradePlaced: false,
        rejectionReason: `Confluence ${analysis.confluenceScore} < ${config.strategy.minConfluenceScore}`,
      };
    }

    // Build reasoning
    const direction: 'long' | 'short' = signal === 'buy' ? 'long' : 'short';
    const reasoning = buildTradeReasoning(analysis, signal, config, symbol);

    // Check HTF bias alignment if required
    if (config.strategy.htfBiasRequired) {
      try {
        const htfCandles = await fetchCandlesFromYahoo(symbol, mapTF(config.strategy.htfBiasTimeframe), 100);
        const htfStructure = runFullServerAnalysis(htfCandles, null, 3);
        if (htfStructure.structure.trend !== analysis.structure.trend) {
          return {
            symbol, analysis, signal, confluenceScore: analysis.confluenceScore, reasoning,
            tradePlaced: false,
            rejectionReason: `HTF bias mismatch: ${config.strategy.htfBiasTimeframe} is ${htfStructure.structure.trend}, entry TF is ${analysis.structure.trend}`,
          };
        }
      } catch { /* HTF check optional */ }
    }

    // Check premium/discount zone alignment
    if (config.strategy.premiumDiscountEnabled) {
      if (config.strategy.onlyBuyInDiscount && signal === 'buy' && analysis.premiumDiscount.currentZone === 'premium') {
        return {
          symbol, analysis, signal, confluenceScore: analysis.confluenceScore, reasoning,
          tradePlaced: false,
          rejectionReason: 'Buy signal rejected: price in premium zone (config: only buy in discount)',
        };
      }
      if (config.strategy.onlySellInPremium && signal === 'sell' && analysis.premiumDiscount.currentZone === 'discount') {
        return {
          symbol, analysis, signal, confluenceScore: analysis.confluenceScore, reasoning,
          tradePlaced: false,
          rejectionReason: 'Sell signal rejected: price in discount zone (config: only sell in premium)',
        };
      }
    }

    return {
      symbol, analysis, signal, confluenceScore: analysis.confluenceScore, reasoning,
      tradePlaced: false, // Will be set to true if trade is placed
    };
  } catch (err: any) {
    return noSignal(`Analysis error: ${err.message}`);
  }
}

async function executeTrade(scanResult: ScanResult, config: BotConfig): Promise<boolean> {
  if (scanResult.signal === 'no_signal' || !scanResult.analysis) return false;

  const symbol = scanResult.symbol;
  const direction: 'long' | 'short' = scanResult.signal === 'buy' ? 'long' : 'short';

  try {
    const quote = await fetchQuoteFromYahoo(symbol);
    const entryPrice = quote.price;

    // Calculate SL/TP from analysis
    const { sl, tp } = calculateSLTP(config, entryPrice, direction, scanResult.analysis, symbol);

    // Calculate position size
    const status = getStatus();
    const size = calculatePositionSize(config, entryPrice, sl, symbol, status.balance);

    // Place the order
    const result = await placeOrder({
      symbol,
      direction,
      size: Math.max(0.01, size),
      stopLoss: sl,
      takeProfit: tp,
      signalReason: scanResult.reasoning.summary,
      signalScore: scanResult.confluenceScore,
    });

    if (result.success && result.position) {
      // Store reasoning in memory AND persist to DB
      state.tradeReasonings.set(result.position.id, scanResult.reasoning);
      state.totalTradesPlaced++;
      addLog('trade', `AUTO-TRADE: ${direction.toUpperCase()} ${symbol} ${size} lots @ ${entryPrice.toFixed(5)} | SL: ${sl.toFixed(5)} | TP: ${tp.toFixed(5)} | Score: ${scanResult.confluenceScore}/10`);
      addLog('info', `REASON: ${scanResult.reasoning.summary}`);

      // Notify owner of trade placement
      notifyTradePlaced({
        symbol,
        direction,
        size,
        entryPrice,
        stopLoss: sl,
        takeProfit: tp,
        reason: scanResult.reasoning.summary,
        score: scanResult.confluenceScore,
      });

      // Persist reasoning to DB (fire-and-forget, don't block trade)
      persistReasoning(result.position.id, symbol, direction, scanResult.reasoning).catch((err: any) =>
        console.warn('[Engine] Failed to persist reasoning:', err.message)
      );

      return true;
    } else {
      state.totalRejected++;
      addLog('warning', `REJECTED: ${symbol} ${direction} — ${result.error || 'Config validation failed'}`);
      return false;
    }
  } catch (err: any) {
    addLog('error', `ERROR: Failed to execute ${symbol} trade — ${err.message}`);
    notifyEngineError({ context: `Trade execution: ${symbol}`, error: err.message });
    return false;
  }
}

// ─── DB Persistence Helpers ────────────────────────────────────────

async function persistReasoning(
  positionId: string,
  symbol: string,
  direction: 'long' | 'short',
  reasoning: TradeReasoning,
): Promise<void> {
  try {
    await insertTradeReasoning({
      positionId,
      symbol,
      direction,
      confluenceScore: reasoning.confluenceScore,
      session: reasoning.session || null,
      timeframe: reasoning.timeframe || null,
      bias: null,
      factorsJson: reasoning.factors,
      summary: reasoning.summary,
    });
  } catch (err: any) {
    console.warn('[Engine] persistReasoning failed:', err.message);
  }
}

async function persistPostMortem(
  position: PaperPosition,
  exitReason: string,
  postMortem: TradePostMortem,
): Promise<void> {
  try {
    await insertTradePostMortem({
      positionId: position.id,
      symbol: position.symbol,
      exitReason,
      whatWorked: postMortem.whatWorked.join('\n'),
      whatFailed: postMortem.whatFailed.join('\n'),
      lessonLearned: postMortem.lessonLearned,
      exitPrice: position.currentPrice?.toString() ?? null,
      pnl: postMortem.pnl?.toString() ?? null,
      detailJson: postMortem,
    });
  } catch (err: any) {
    console.warn('[Engine] persistPostMortem failed:', err.message);
  }
}

// ─── Main Scan Loop ─────────────────────────────────────────────────

async function runScanCycle(): Promise<void> {
  if (!state.running) return;

  const config = getConfig();
  state.totalScans++;
  state.lastScanTime = Date.now();

  addLog('info', `SCAN #${state.totalScans}: Scanning ${Object.entries(config.instruments.allowedInstruments).filter(([, v]) => v).length} instruments...`);

  // Check session filter
  const sessionCheck = isSessionAllowed(config);
  if (!sessionCheck.allowed) {
    addLog('info', `SKIP: ${sessionCheck.reason}`);
    return;
  }

  // Get enabled instruments
  const enabledInstruments = Object.entries(config.instruments.allowedInstruments)
    .filter(([, enabled]) => enabled)
    .map(([symbol]) => symbol);

  const results: ScanResult[] = [];

  for (const symbol of enabledInstruments) {
    try {
      const result = await scanInstrument(symbol, config);
      results.push(result);

      if (result.signal !== 'no_signal') {
        state.totalSignals++;
        addLog('signal', `SIGNAL: ${result.signal.toUpperCase()} ${symbol} (score: ${result.confluenceScore}/10)`);

        // Notify owner of signal detection
        notifySignalDetected({
          symbol,
          direction: result.signal,
          confluenceScore: result.confluenceScore,
          summary: result.reasoning.summary,
        });

        if (result.rejectionReason) {
          state.totalRejected++;
          addLog('warning', `FILTERED: ${symbol} — ${result.rejectionReason}`);
        } else if (state.autoTrading) {
          const placed = await executeTrade(result, config);
          result.tradePlaced = placed;
        }
      }
    } catch (err: any) {
      addLog('error', `ERROR: ${symbol} scan failed — ${err.message}`);
    }

    // Small delay between instruments to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  state.scanResults = results;
}

// ─── Post-Mortem Generation ─────────────────────────────────────────

export function generatePostMortem(
  position: PaperPosition,
  exitReason: string,
): TradePostMortem {
  const reasoning = state.tradeReasonings.get(position.id);
  const pnl = position.pnl || 0;
  const outcome = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven';

  const holdMs = Date.now() - new Date(position.openTime).getTime();
  const holdHours = Math.floor(holdMs / 3600000);
  const holdMins = Math.floor((holdMs % 3600000) / 60000);
  const holdDuration = `${holdHours}h ${holdMins}m`;

  const whatWorked: string[] = [];
  const whatFailed: string[] = [];

  if (reasoning) {
    for (const factor of reasoning.factors) {
      if (factor.present) {
        if (outcome === 'win') {
          whatWorked.push(`${factor.concept}: ${factor.detail}`);
        } else {
          // Even in a loss, some factors may have been correct
          whatFailed.push(`${factor.concept}: ${factor.detail} — setup was present but price didn't follow through`);
        }
      }
    }
  }

  let lessonLearned: string;
  if (outcome === 'win') {
    lessonLearned = `Trade executed as planned. ${reasoning?.factors.filter(f => f.present).length || 0} confluence factors aligned correctly. The ${position.direction} bias was confirmed by price action.`;
  } else if (outcome === 'loss') {
    lessonLearned = `Trade invalidated. Possible causes: market structure changed after entry, or the setup lacked sufficient confluence. Consider: was the entry timeframe too aggressive? Was the SL placed correctly relative to structure?`;
    if (reasoning && reasoning.confluenceScore < 7) {
      lessonLearned += ` Note: Confluence score was ${reasoning.confluenceScore}/10 — consider raising the minimum threshold.`;
    }
  } else {
    lessonLearned = 'Trade closed at breakeven. The setup was partially valid but lacked momentum for follow-through.';
  }

  const postMortem: TradePostMortem = {
    tradeId: position.id,
    outcome,
    pnl,
    holdDuration,
    entryReasoning: reasoning || {
      summary: 'Manual trade — no auto-reasoning available',
      confluenceScore: 0,
      factors: [],
      session: '',
      timeframe: '',
      timestamp: typeof position.openTime === 'number' ? position.openTime : Date.now(),
    },
    exitReason,
    whatWorked,
    whatFailed,
    lessonLearned,
  };

  state.postMortems.push(postMortem);
  if (state.postMortems.length > 100) state.postMortems.shift(); // Keep last 100

  // Persist post-mortem to DB (fire-and-forget)
  persistPostMortem(position, exitReason, postMortem).catch((err: any) =>
    console.warn('[Engine] Failed to persist post-mortem:', err.message)
  );

  return postMortem;
}

// ─── Public API ─────────────────────────────────────────────────────

export function startEngine(autoTrade: boolean = true, intervalSeconds: number = 60): void {
  if (state.running) return;

  // Register post-mortem generator so paperTrading can call it on close
  registerPostMortemGenerator(generatePostMortem);
  state.running = true;
  state.autoTrading = autoTrade;
  state.scanInterval = intervalSeconds;

  addLog('info', `ENGINE STARTED: Auto-trading=${autoTrade}, Scan interval=${intervalSeconds}s`);

  // Run first scan immediately
    runScanCycle().catch(err => addLog('error', `Scan error: ${err.message}`));

  // Set up recurring scan
  scanTimer = setInterval(() => {
    runScanCycle().catch(err => addLog('error', `Scan error: ${err.message}`));
  }, intervalSeconds * 1000);
}

export function stopEngine(): void {
  state.running = false;
  state.autoTrading = false;
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  addLog('info', 'ENGINE STOPPED');
}

export function setAutoTrading(enabled: boolean): void {
  state.autoTrading = enabled;
  addLog('info', `Auto-trading ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

export function getEngineState(): Omit<EngineState, 'tradeReasonings'> & { tradeReasonings: Record<string, TradeReasoning> } {
  const reasoningsObj: Record<string, TradeReasoning> = {};
  state.tradeReasonings.forEach((v, k) => { reasoningsObj[k] = v; });
  return {
    running: state.running,
    autoTrading: state.autoTrading,
    scanInterval: state.scanInterval,
    lastScanTime: state.lastScanTime,
    totalScans: state.totalScans,
    totalSignals: state.totalSignals,
    totalTradesPlaced: state.totalTradesPlaced,
    totalRejected: state.totalRejected,
    scanResults: state.scanResults,
    tradeReasonings: reasoningsObj,
    postMortems: state.postMortems,
  };
}

export function getTradeReasoning(positionId: string): TradeReasoning | null {
  return state.tradeReasonings.get(positionId) || null;
}

export function getPostMortems(): TradePostMortem[] {
  return [...state.postMortems];
}

export function getLastScanResults(): ScanResult[] {
  return [...state.scanResults];
}

export function triggerManualScan(): Promise<void> {
  return runScanCycle();
}
