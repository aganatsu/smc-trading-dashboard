/**
 * Backtest Engine
 *
 * Walks through historical candle data bar-by-bar, runs SMC analysis at each step,
 * simulates entries/exits using the user's BotConfig parameters, and produces
 * a full performance report.
 *
 * Reuses the same analysis logic as the live engine (smcAnalysis, botConfig)
 * so backtest results reflect the actual strategy configuration.
 */

import { getConfig, type BotConfig } from "./botConfig";
import {
  runFullServerAnalysis,
  type FullAnalysis,
} from "./smcAnalysis";
import { fetchCandlesFromYahoo, type CandleData } from "./marketData";

// ─── Types ──────────────────────────────────────────────────────────

export interface BacktestConfig {
  symbol: string;
  startDate: string;       // ISO date string
  endDate: string;         // ISO date string
  timeframe: string;       // '1h', '4h', '1day'
  initialBalance: number;
  useCurrentConfig: boolean; // Use current BotConfig or custom overrides
  configOverrides?: Partial<BotConfig>;
}

export interface BacktestTrade {
  id: number;
  entryBar: number;
  exitBar: number;
  entryTime: string;
  exitTime: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  size: number;
  pnl: number;
  pnlPercent: number;
  exitReason: "tp" | "sl" | "time" | "reverse_signal" | "end_of_data";
  confluenceScore: number;
  bias: string;
  setupFactors: string[];
}

export interface BacktestResult {
  // Config used
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  configSnapshot: {
    minConfluence: number;
    riskPerTrade: number;
    minRR: number;
    slMethod: string;
    tpMethod: string;
  };

  // Performance
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number;           // 0-100
  profitFactor: number;      // gross profit / gross loss
  netProfit: number;
  netProfitPercent: number;
  grossProfit: number;
  grossLoss: number;

  // Risk metrics
  maxDrawdown: number;       // $ amount
  maxDrawdownPercent: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  averageWin: number;
  averageLoss: number;
  averageRR: number;         // Average risk-reward achieved
  sharpeRatio: number;
  expectancy: number;        // Average $ per trade

  // Equity curve
  equityCurve: { bar: number; time: string; equity: number }[];

  // Individual trades
  trades: BacktestTrade[];

  // Execution info
  totalBars: number;
  barsAnalyzed: number;
  executionTimeMs: number;
  status: "completed" | "error";
  error?: string;
}

// ─── Instrument Specs (same as botEngine) ───────────────────────────

const INSTRUMENT_SPECS: Record<string, { pipSize: number; lotValue: number }> = {
  "EUR/USD": { pipSize: 0.0001, lotValue: 100000 },
  "GBP/USD": { pipSize: 0.0001, lotValue: 100000 },
  "USD/JPY": { pipSize: 0.01, lotValue: 100000 },
  "GBP/JPY": { pipSize: 0.01, lotValue: 100000 },
  "AUD/USD": { pipSize: 0.0001, lotValue: 100000 },
  "USD/CAD": { pipSize: 0.0001, lotValue: 100000 },
  "EUR/GBP": { pipSize: 0.0001, lotValue: 100000 },
  "NZD/USD": { pipSize: 0.0001, lotValue: 100000 },
  "XAU/USD": { pipSize: 0.01, lotValue: 100 },
  "BTC/USD": { pipSize: 0.01, lotValue: 1 },
};

// ─── Timeframe Mapping ──────────────────────────────────────────────
const TF_MAP: Record<string, string> = {
  "1W": "1week", "1D": "1day", "4H": "4h",
  "1H": "1h", "15m": "15min", "5m": "5min", "1m": "5min",
  "1week": "1week", "1day": "1day", "4h": "4h",
  "1h": "1h", "15min": "15min", "5min": "5min",
};
function mapTF(tf: string): string { return TF_MAP[tf] || tf; }

// ─── Backtest State ─────────────────────────────────────────────────

let currentBacktest: {
  running: boolean;
  progress: number;
  result: BacktestResult | null;
} = {
  running: false,
  progress: 0,
  result: null,
};

// ─── Core Backtest Logic ────────────────────────────────────────────

function calculatePositionSize(
  config: BotConfig,
  entryPrice: number,
  stopLoss: number,
  symbol: string,
  balance: number,
): number {
  const spec = INSTRUMENT_SPECS[symbol] || { pipSize: 0.0001, lotValue: 100000 };
  const riskAmount = balance * (config.risk.riskPerTrade / 100);
  const slPips = Math.abs(entryPrice - stopLoss) / spec.pipSize;

  if (config.risk.positionSizingMethod === "fixed_lots") {
    return config.risk.fixedLotSize;
  }

  if (slPips === 0) return config.risk.fixedLotSize;

  const pipValue = spec.pipSize * spec.lotValue;
  const lots = riskAmount / (slPips * pipValue);
  return Math.round(lots * 100) / 100;
}

function calculateSLTP(
  config: BotConfig,
  entryPrice: number,
  direction: "long" | "short",
  analysis: FullAnalysis,
  symbol: string,
): { sl: number; tp: number } {
  const spec = INSTRUMENT_SPECS[symbol] || { pipSize: 0.0001, lotValue: 100000 };

  // Stop Loss
  let sl: number;
  if (config.exit.stopLossMethod === "fixed_pips") {
    sl = direction === "long"
      ? entryPrice - config.exit.fixedSLPips * spec.pipSize
      : entryPrice + config.exit.fixedSLPips * spec.pipSize;
  } else if (config.exit.stopLossMethod === "structure") {
    const swings = analysis.structure.swingPoints;
    if (direction === "long") {
      const recentLows = swings.filter(s => s.type === "low" && s.price < entryPrice).sort((a, b) => b.price - a.price);
      sl = recentLows[0]?.price ? recentLows[0].price - 2 * spec.pipSize : entryPrice - config.exit.fixedSLPips * spec.pipSize;
    } else {
      const recentHighs = swings.filter(s => s.type === "high" && s.price > entryPrice).sort((a, b) => a.price - b.price);
      sl = recentHighs[0]?.price ? recentHighs[0].price + 2 * spec.pipSize : entryPrice + config.exit.fixedSLPips * spec.pipSize;
    }
  } else if (config.exit.stopLossMethod === "below_ob") {
    const activeOBs = analysis.orderBlocks.filter(ob => !ob.mitigated);
    if (direction === "long") {
      const bullOB = activeOBs.filter(ob => ob.type === "bullish" && ob.low < entryPrice).sort((a, b) => b.low - a.low)[0];
      sl = bullOB ? bullOB.low - 2 * spec.pipSize : entryPrice - config.exit.fixedSLPips * spec.pipSize;
    } else {
      const bearOB = activeOBs.filter(ob => ob.type === "bearish" && ob.high > entryPrice).sort((a, b) => a.high - b.high)[0];
      sl = bearOB ? bearOB.high + 2 * spec.pipSize : entryPrice + config.exit.fixedSLPips * spec.pipSize;
    }
  } else {
    sl = direction === "long"
      ? entryPrice - config.exit.fixedSLPips * spec.pipSize
      : entryPrice + config.exit.fixedSLPips * spec.pipSize;
  }

  // Take Profit
  let tp: number;
  if (config.exit.takeProfitMethod === "fixed_pips") {
    tp = direction === "long"
      ? entryPrice + config.exit.fixedTPPips * spec.pipSize
      : entryPrice - config.exit.fixedTPPips * spec.pipSize;
  } else if (config.exit.takeProfitMethod === "rr_ratio") {
    const slDistance = Math.abs(entryPrice - sl);
    tp = direction === "long"
      ? entryPrice + slDistance * config.exit.tpRRRatio
      : entryPrice - slDistance * config.exit.tpRRRatio;
  } else if (config.exit.takeProfitMethod === "next_level") {
    if (direction === "long") {
      const targets = [
        ...(analysis.pdLevels ? [analysis.pdLevels.pdh, analysis.pdLevels.pwh] : []),
      ].filter(p => p > entryPrice).sort((a, b) => a - b);
      tp = targets[0] || entryPrice + config.exit.fixedTPPips * spec.pipSize;
    } else {
      const targets = [
        ...(analysis.pdLevels ? [analysis.pdLevels.pdl, analysis.pdLevels.pwl] : []),
      ].filter(p => p < entryPrice).sort((a, b) => b - a);
      tp = targets[0] || entryPrice - config.exit.fixedTPPips * spec.pipSize;
    }
  } else {
    const slDistance = Math.abs(entryPrice - sl);
    tp = direction === "long"
      ? entryPrice + slDistance * config.exit.tpRRRatio
      : entryPrice - slDistance * config.exit.tpRRRatio;
  }

  return { sl, tp };
}

/**
 * Run a backtest on historical data
 */
export async function runBacktest(btConfig: BacktestConfig): Promise<BacktestResult> {
  const startTime = Date.now();
  currentBacktest.running = true;
  currentBacktest.progress = 0;
  currentBacktest.result = null;

  const config = btConfig.useCurrentConfig ? getConfig() : { ...getConfig(), ...btConfig.configOverrides };
  const spec = INSTRUMENT_SPECS[btConfig.symbol] || { pipSize: 0.0001, lotValue: 100000 };

  const emptyResult = (error: string): BacktestResult => ({
    symbol: btConfig.symbol,
    timeframe: btConfig.timeframe,
    startDate: btConfig.startDate,
    endDate: btConfig.endDate,
    initialBalance: btConfig.initialBalance,
    configSnapshot: {
      minConfluence: config.strategy.minConfluenceScore,
      riskPerTrade: config.risk.riskPerTrade,
      minRR: config.risk.minRiskReward,
      slMethod: config.exit.stopLossMethod,
      tpMethod: config.exit.takeProfitMethod,
    },
    totalTrades: 0, winningTrades: 0, losingTrades: 0, breakEvenTrades: 0,
    winRate: 0, profitFactor: 0, netProfit: 0, netProfitPercent: 0,
    grossProfit: 0, grossLoss: 0, maxDrawdown: 0, maxDrawdownPercent: 0,
    maxConsecutiveWins: 0, maxConsecutiveLosses: 0,
    averageWin: 0, averageLoss: 0, averageRR: 0,
    sharpeRatio: 0, expectancy: 0,
    equityCurve: [], trades: [],
    totalBars: 0, barsAnalyzed: 0,
    executionTimeMs: Date.now() - startTime,
    status: "error", error,
  });

  try {
    // Fetch historical candles
    const yahooTF = mapTF(btConfig.timeframe);
    const candles = await fetchCandlesFromYahoo(btConfig.symbol, yahooTF, 500);

    if (candles.length < 100) {
      const errResult = emptyResult("Insufficient historical data (need at least 100 candles)");
      currentBacktest.result = errResult;
      currentBacktest.running = false;
      currentBacktest.progress = 100;
      return errResult;
    }

    // Also fetch daily candles for PD/PW levels
    let dailyCandles: CandleData[] | null = null;
    try {
      dailyCandles = await fetchCandlesFromYahoo(btConfig.symbol, "1day", 30);
    } catch { /* optional */ }

    const totalBars = candles.length;
    const lookback = 50; // Minimum candles needed for analysis
    let balance = btConfig.initialBalance;
    let peakBalance = balance;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    const trades: BacktestTrade[] = [];
    const equityCurve: { bar: number; time: string; equity: number }[] = [];
    let tradeId = 0;
    let openTrade: {
      id: number;
      entryBar: number;
      entryTime: string;
      direction: "long" | "short";
      entryPrice: number;
      stopLoss: number;
      takeProfit: number;
      size: number;
      confluenceScore: number;
      bias: string;
      setupFactors: string[];
    } | null = null;

    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let cooldownUntilBar = 0;

    // Walk through candles bar-by-bar
    for (let i = lookback; i < totalBars; i++) {
      const currentCandle = candles[i];
      currentBacktest.progress = Math.round(((i - lookback) / (totalBars - lookback)) * 100);

      // Check if open trade hits SL or TP on this bar
      if (openTrade) {
        let exitPrice: number | null = null;
        let exitReason: BacktestTrade["exitReason"] | null = null;

        if (openTrade.direction === "long") {
          // Check SL first (worst case)
          if (currentCandle.low <= openTrade.stopLoss) {
            exitPrice = openTrade.stopLoss;
            exitReason = "sl";
          }
          // Check TP
          else if (currentCandle.high >= openTrade.takeProfit) {
            exitPrice = openTrade.takeProfit;
            exitReason = "tp";
          }
        } else {
          // Short
          if (currentCandle.high >= openTrade.stopLoss) {
            exitPrice = openTrade.stopLoss;
            exitReason = "sl";
          } else if (currentCandle.low <= openTrade.takeProfit) {
            exitPrice = openTrade.takeProfit;
            exitReason = "tp";
          }
        }

        // Check time-based exit
        if (!exitPrice && config.exit.timeBasedExitEnabled && config.exit.maxHoldHours > 0) {
          const holdBars = i - openTrade.entryBar;
          // Approximate: each bar = 1 period of the timeframe
          const barsPerHour = btConfig.timeframe === "1h" || btConfig.timeframe === "1H" ? 1
            : btConfig.timeframe === "4h" || btConfig.timeframe === "4H" ? 0.25
            : btConfig.timeframe === "15m" || btConfig.timeframe === "15min" ? 4
            : btConfig.timeframe === "5m" || btConfig.timeframe === "5min" ? 12
            : btConfig.timeframe === "1day" || btConfig.timeframe === "1D" ? 1 / 24
            : 1;
          const holdHours = holdBars / barsPerHour;
          if (holdHours >= config.exit.maxHoldHours) {
            exitPrice = currentCandle.close;
            exitReason = "time";
          }
        }

        if (exitPrice && exitReason) {
          const pnl = openTrade.direction === "long"
            ? (exitPrice - openTrade.entryPrice) * openTrade.size * spec.lotValue
            : (openTrade.entryPrice - exitPrice) * openTrade.size * spec.lotValue;

          const pnlPercent = (pnl / balance) * 100;
          balance += pnl;

          const trade: BacktestTrade = {
            id: openTrade.id,
            entryBar: openTrade.entryBar,
            exitBar: i,
            entryTime: openTrade.entryTime,
            exitTime: currentCandle.datetime,
            direction: openTrade.direction,
            entryPrice: openTrade.entryPrice,
            exitPrice,
            stopLoss: openTrade.stopLoss,
            takeProfit: openTrade.takeProfit,
            size: openTrade.size,
            pnl,
            pnlPercent,
            exitReason,
            confluenceScore: openTrade.confluenceScore,
            bias: openTrade.bias,
            setupFactors: openTrade.setupFactors,
          };

          trades.push(trade);
          openTrade = null;

          // Track consecutive wins/losses
          if (pnl > 0) {
            consecutiveWins++;
            consecutiveLosses = 0;
            maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
          } else if (pnl < 0) {
            consecutiveLosses++;
            consecutiveWins = 0;
            maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
          }

          // Set cooldown
          if (config.entry.cooldownMinutes > 0) {
            const barsPerMinute = btConfig.timeframe === "1h" || btConfig.timeframe === "1H" ? 1 / 60
              : btConfig.timeframe === "4h" || btConfig.timeframe === "4H" ? 1 / 240
              : btConfig.timeframe === "15m" || btConfig.timeframe === "15min" ? 1 / 15
              : btConfig.timeframe === "5m" || btConfig.timeframe === "5min" ? 1 / 5
              : btConfig.timeframe === "1day" || btConfig.timeframe === "1D" ? 1 / 1440
              : 1 / 60;
            cooldownUntilBar = i + Math.ceil(config.entry.cooldownMinutes * barsPerMinute);
          }

          // Track drawdown
          if (balance > peakBalance) peakBalance = balance;
          const dd = peakBalance - balance;
          const ddPercent = (dd / peakBalance) * 100;
          if (dd > maxDrawdown) maxDrawdown = dd;
          if (ddPercent > maxDrawdownPercent) maxDrawdownPercent = ddPercent;

          // Check daily loss / max drawdown halt
          if (config.risk.maxDrawdown > 0 && maxDrawdownPercent >= config.risk.maxDrawdown) {
            // Stop backtesting — drawdown limit hit
            break;
          }
        }
      }

      // Record equity curve every 5 bars
      if (i % 5 === 0) {
        equityCurve.push({
          bar: i,
          time: currentCandle.datetime,
          equity: balance, // Closed equity
        });
      }

      // Skip if we have an open trade or in cooldown
      if (openTrade || i < cooldownUntilBar) continue;

      // Run SMC analysis on the window of candles up to this bar
      const windowCandles = candles.slice(Math.max(0, i - lookback), i + 1);
      if (windowCandles.length < lookback) continue;

      const analysis = runFullServerAnalysis(windowCandles, dailyCandles, 3);

      // Determine signal
      let signal: "buy" | "sell" | "no_signal" = "no_signal";
      if (analysis.bias === "bullish" && analysis.confluenceScore >= config.strategy.minConfluenceScore) {
        signal = "buy";
      } else if (analysis.bias === "bearish" && analysis.confluenceScore >= config.strategy.minConfluenceScore) {
        signal = "sell";
      }

      if (signal === "no_signal") continue;

      // Premium/Discount filter
      if (config.strategy.premiumDiscountEnabled) {
        if (config.strategy.onlyBuyInDiscount && signal === "buy" && analysis.premiumDiscount.currentZone === "premium") continue;
        if (config.strategy.onlySellInPremium && signal === "sell" && analysis.premiumDiscount.currentZone === "discount") continue;
      }

      // Calculate entry, SL, TP
      const direction: "long" | "short" = signal === "buy" ? "long" : "short";
      const entryPrice = currentCandle.close;
      const { sl, tp } = calculateSLTP(config, entryPrice, direction, analysis, btConfig.symbol);

      // Check minimum R:R
      const slDistance = Math.abs(entryPrice - sl);
      const tpDistance = Math.abs(tp - entryPrice);
      if (slDistance > 0) {
        const rr = tpDistance / slDistance;
        if (rr < config.risk.minRiskReward) continue;
      }

      // Calculate position size
      const size = calculatePositionSize(config, entryPrice, sl, btConfig.symbol, balance);
      if (size <= 0) continue;

      // Open trade
      tradeId++;
      const factors = [];
      if (analysis.structure.trend !== "ranging") factors.push("Market Structure");
      if (analysis.orderBlocks.some(ob => !ob.mitigated)) factors.push("Order Block");
      if (analysis.fvgs.some(f => !f.mitigated)) factors.push("FVG");
      if (analysis.premiumDiscount.oteZone) factors.push("OTE Zone");
      if (analysis.session.isKillZone) factors.push("Kill Zone");
      if (analysis.judasSwing.detected) factors.push("Judas Swing");
      if (analysis.liquidityPools.some(lp => lp.swept)) factors.push("Liquidity Sweep");

      openTrade = {
        id: tradeId,
        entryBar: i,
        entryTime: currentCandle.datetime,
        direction,
        entryPrice,
        stopLoss: sl,
        takeProfit: tp,
        size: Math.max(0.01, size),
        confluenceScore: analysis.confluenceScore,
        bias: analysis.bias,
        setupFactors: factors,
      };
    }

    // Close any remaining open trade at last bar
    if (openTrade) {
      const lastCandle = candles[candles.length - 1];
      const exitPrice = lastCandle.close;
      const pnl = openTrade.direction === "long"
        ? (exitPrice - openTrade.entryPrice) * openTrade.size * spec.lotValue
        : (openTrade.entryPrice - exitPrice) * openTrade.size * spec.lotValue;
      balance += pnl;

      trades.push({
        id: openTrade.id,
        entryBar: openTrade.entryBar,
        exitBar: candles.length - 1,
        entryTime: openTrade.entryTime,
        exitTime: lastCandle.datetime,
        direction: openTrade.direction,
        entryPrice: openTrade.entryPrice,
        exitPrice,
        stopLoss: openTrade.stopLoss,
        takeProfit: openTrade.takeProfit,
        size: openTrade.size,
        pnl,
        pnlPercent: (pnl / (balance - pnl)) * 100,
        exitReason: "end_of_data",
        confluenceScore: openTrade.confluenceScore,
        bias: openTrade.bias,
        setupFactors: openTrade.setupFactors,
      });
    }

    // Final equity point
    equityCurve.push({
      bar: totalBars - 1,
      time: candles[candles.length - 1].datetime,
      equity: balance,
    });

    // Calculate statistics
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    const breakEvenTrades = trades.filter(t => t.pnl === 0);
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const netProfit = balance - btConfig.initialBalance;

    const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;

    // Average R:R achieved
    const rrValues = trades.map(t => {
      const slDist = Math.abs(t.entryPrice - t.stopLoss);
      return slDist > 0 ? Math.abs(t.exitPrice - t.entryPrice) / slDist : 0;
    });
    const avgRR = rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0;

    // Sharpe ratio (simplified: using trade returns)
    const returns = trades.map(t => t.pnlPercent);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdReturn = returns.length > 1
      ? Math.sqrt(returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / (returns.length - 1))
      : 0;
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0; // Annualized

    const result: BacktestResult = {
      symbol: btConfig.symbol,
      timeframe: btConfig.timeframe,
      startDate: btConfig.startDate,
      endDate: btConfig.endDate,
      initialBalance: btConfig.initialBalance,
      configSnapshot: {
        minConfluence: config.strategy.minConfluenceScore,
        riskPerTrade: config.risk.riskPerTrade,
        minRR: config.risk.minRiskReward,
        slMethod: config.exit.stopLossMethod,
        tpMethod: config.exit.takeProfitMethod,
      },
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      breakEvenTrades: breakEvenTrades.length,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      netProfit,
      netProfitPercent: (netProfit / btConfig.initialBalance) * 100,
      grossProfit,
      grossLoss,
      maxDrawdown,
      maxDrawdownPercent,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      averageWin: avgWin,
      averageLoss: avgLoss,
      averageRR: avgRR,
      sharpeRatio,
      expectancy: trades.length > 0 ? netProfit / trades.length : 0,
      equityCurve,
      trades,
      totalBars,
      barsAnalyzed: totalBars - lookback,
      executionTimeMs: Date.now() - startTime,
      status: "completed",
    };

    currentBacktest.result = result;
    currentBacktest.running = false;
    currentBacktest.progress = 100;
    return result;
  } catch (err: any) {
    const errResult = emptyResult(err.message);
    currentBacktest.result = errResult;
    currentBacktest.running = false;
    currentBacktest.progress = 100;
    return errResult;
  }
}

/**
 * Get current backtest progress
 */
export function getBacktestProgress(): { running: boolean; progress: number } {
  return { running: currentBacktest.running, progress: currentBacktest.progress };
}

/**
 * Get last backtest result
 */
export function getLastBacktestResult(): BacktestResult | null {
  return currentBacktest.result;
}
