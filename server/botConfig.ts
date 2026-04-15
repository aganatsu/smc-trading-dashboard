/**
 * Bot Configuration — All tunable parameters for the SMC trading bot
 * 
 * Persistence: Config is stored in the `bot_configs` DB table.
 * An in-memory cache is used for fast reads; writes go to both cache and DB.
 * On first access, config is loaded from DB (if available) or falls back to defaults.
 * 
 * Categories:
 * 1. Strategy Settings (SMC-specific setups, confluence, timeframes)
 * 2. Risk Management (position sizing, limits, protection)
 * 3. Entry Rules (order type, pyramiding, cooldown)
 * 4. Exit Rules (TP/SL methods, trailing, partial TP, break-even)
 * 5. Instrument Filter (allowed pairs, spread/volatility filters)
 * 6. Session/Time Filter (trading sessions, active hours, days)
 * 7. Notifications (trade/signal/error/daily summary alerts)
 * 8. Account Settings (starting balance, leverage, paper/live mode)
 */

import { getBotConfig as dbGetBotConfig, upsertBotConfig as dbUpsertBotConfig } from "./db";

// ─── Types ───────────────────────────────────────────────────────────

export interface StrategySettings {
  // SMC Setup Toggles
  enableBOS: boolean;         // Break of Structure
  enableCHoCH: boolean;       // Change of Character
  enableOB: boolean;          // Order Blocks
  enableFVG: boolean;         // Fair Value Gaps
  enableLiquiditySweep: boolean;

  // Confluence
  minConfluenceScore: number; // 1-10, minimum score to enter
  htfBiasRequired: boolean;   // Must align with higher timeframe trend

  // Order Block Detection
  obLookbackCandles: number;  // How many candles back to search for OBs
  obMinBodyWickRatio: number; // Minimum body-to-wick ratio (0.1-1.0)
  obMustBeAtSwing: boolean;   // OB must be at swing point
  obInvalidationClose: boolean; // Price closes through OB invalidates it
  obMitigationType: 'touch' | '50_percent' | 'full_close';

  // Fair Value Gap Detection
  fvgMinSizePips: number;     // Minimum gap size in pips
  fvgPremiumDiscountOnly: boolean; // Only trade FVGs in premium/discount zone
  fvgFillPercentInvalidate: number; // 50, 75, or 100% fill invalidates
  fvgOnlyUnfilled: boolean;   // Only trade unfilled FVGs

  // Market Structure
  structureBreakConfirmation: 'close' | 'wick'; // Candle close or wick
  chochAsReversal: boolean;   // Treat CHoCH as reversal signal
  structureLookback: number;  // Candles to look back for structure

  // Liquidity
  liquiditySweepRequired: boolean;
  equalHighsLowsSensitivity: number; // 1-5 (1=strict, 5=loose)
  liquidityPoolMinTouches: number;   // 2, 3, or 4

  // Premium/Discount Zone
  premiumDiscountEnabled: boolean;
  onlyBuyInDiscount: boolean; // Only buy below 50% of range
  onlySellInPremium: boolean; // Only sell above 50% of range
  zoneMethod: 'fibonacci' | 'swing_range';

  // Multi-Timeframe
  htfBiasTimeframe: '1W' | '1D' | '4H';
  entryTimeframe: '1H' | '15m' | '5m' | '1m';
  requireAllTFAligned: boolean;
  minTFsAligned: number; // 2 or 3
}

export interface RiskSettings {
  riskPerTrade: number;       // % of balance per trade (0.1-10)
  maxDailyLoss: number;       // % daily loss limit (1-20)
  maxDrawdown: number;        // % max drawdown before halt (5-50)
  positionSizingMethod: 'fixed_lots' | 'percent_risk' | 'kelly';
  fixedLotSize: number;       // Used when method is fixed_lots
  maxOpenPositions: number;   // Total simultaneous positions (1-20)
  maxPositionsPerSymbol: number; // Per-instrument limit (1-5)
  maxPortfolioHeat: number;   // Total exposure % (1-30)
  minRiskReward: number;      // Minimum R:R ratio (0.5-5)
}

export interface EntryRules {
  defaultOrderType: 'market' | 'limit' | 'stop';
  entryRefinement: boolean;   // Enter on lower TF confirmation
  refinementTimeframe: '5m' | '1m';
  trailingEntry: boolean;     // Trail price before entering
  trailingEntryPips: number;  // Trail distance in pips
  maxSlippagePips: number;    // Maximum allowed slippage
  pyramidingEnabled: boolean; // Allow adding to winning positions
  maxPyramidAdds: number;     // Max additional entries
  closeOnReverse: boolean;    // Close position if opposite signal
  cooldownMinutes: number;    // Wait time after trade before next (0-120)
}

export interface ExitRules {
  takeProfitMethod: 'fixed_pips' | 'rr_ratio' | 'next_level' | 'atr_multiple';
  fixedTPPips: number;        // Fixed TP in pips
  tpRRRatio: number;          // R:R ratio for TP (e.g., 2.0 = 2R)
  tpATRMultiple: number;      // ATR multiple for TP

  stopLossMethod: 'fixed_pips' | 'atr_based' | 'structure' | 'below_ob';
  fixedSLPips: number;        // Fixed SL in pips
  slATRMultiple: number;      // ATR multiple for SL (e.g., 1.5)
  slATRPeriod: number;        // ATR period (e.g., 14)

  trailingStopEnabled: boolean;
  trailingStopPips: number;   // Trail distance in pips
  trailingStopActivation: 'immediate' | 'after_1r' | 'after_breakeven';

  partialTPEnabled: boolean;
  partialTPPercent: number;   // % to close at first target (e.g., 50)
  partialTPLevel: number;     // R multiple for first partial (e.g., 1.0)

  breakEvenEnabled: boolean;
  breakEvenTriggerPips: number; // Move SL to entry after X pips profit

  timeBasedExitEnabled: boolean;
  maxHoldHours: number;       // Close after X hours (0 = disabled)

  endOfSessionClose: boolean; // Close all at session end
}

export interface InstrumentFilter {
  allowedInstruments: Record<string, boolean>; // symbol → enabled
  spreadFilterEnabled: boolean;
  maxSpreadPips: number;      // Skip if spread exceeds
  volatilityFilterEnabled: boolean;
  minATR: number;             // Minimum ATR to trade
  maxATR: number;             // Maximum ATR to trade
  correlationFilterEnabled: boolean;
  maxCorrelation: number;     // 0-1, avoid correlated positions
}

export interface SessionFilter {
  londonEnabled: boolean;
  londonStart: string;        // "08:00"
  londonEnd: string;          // "16:00"
  newYorkEnabled: boolean;
  newYorkStart: string;       // "13:00"
  newYorkEnd: string;         // "21:00"
  asianEnabled: boolean;
  asianStart: string;         // "00:00"
  asianEnd: string;           // "08:00"
  sydneyEnabled: boolean;
  sydneyStart: string;        // "22:00"
  sydneyEnd: string;          // "06:00"
  activeDays: Record<string, boolean>; // mon-fri → enabled
  newsFilterEnabled: boolean;
  newsFilterPauseMinutes: number; // Pause X min before/after high-impact news
}

export interface NotificationSettings {
  notifyOnTrade: boolean;
  notifyOnSignal: boolean;
  notifyOnError: boolean;
  notifyDailySummary: boolean;
  notifyChannel: 'in_app' | 'telegram' | 'email';
}

export interface AccountProtection {
  dailyProfitTarget: number;  // $ amount, 0 = disabled
  dailyLossLimit: number;     // $ amount, 0 = disabled
  cumulativeProfitTarget: number; // $ amount, 0 = disabled
  cumulativeLossLimit: number;    // $ amount, 0 = disabled
  haltOnDailyTarget: boolean;     // Stop bot when daily target hit
  haltOnDailyLoss: boolean;       // Stop bot when daily loss hit
}

export interface AccountSettings {
  startingBalance: number;    // Initial paper trading balance
  leverage: number;           // 1:30, 1:100, 1:500
  mode: 'paper' | 'live';
}

export interface BotConfig {
  strategy: StrategySettings;
  risk: RiskSettings;
  entry: EntryRules;
  exit: ExitRules;
  instruments: InstrumentFilter;
  sessions: SessionFilter;
  notifications: NotificationSettings;
  protection: AccountProtection;
  account: AccountSettings;
}

// ─── Default Configuration ──────────────────────────────────────────

export const DEFAULT_CONFIG: BotConfig = {
  strategy: {
    enableBOS: true,
    enableCHoCH: true,
    enableOB: true,
    enableFVG: true,
    enableLiquiditySweep: true,
    minConfluenceScore: 6,
    htfBiasRequired: true,
    obLookbackCandles: 20,
    obMinBodyWickRatio: 0.5,
    obMustBeAtSwing: true,
    obInvalidationClose: true,
    obMitigationType: 'touch',
    fvgMinSizePips: 5,
    fvgPremiumDiscountOnly: false,
    fvgFillPercentInvalidate: 75,
    fvgOnlyUnfilled: true,
    structureBreakConfirmation: 'close',
    chochAsReversal: true,
    structureLookback: 50,
    liquiditySweepRequired: false,
    equalHighsLowsSensitivity: 3,
    liquidityPoolMinTouches: 2,
    premiumDiscountEnabled: true,
    onlyBuyInDiscount: true,
    onlySellInPremium: true,
    zoneMethod: 'fibonacci',
    htfBiasTimeframe: '1D',
    entryTimeframe: '15m',
    requireAllTFAligned: false,
    minTFsAligned: 2,
  },
  risk: {
    riskPerTrade: 1,
    maxDailyLoss: 5,
    maxDrawdown: 15,
    positionSizingMethod: 'percent_risk',
    fixedLotSize: 0.1,
    maxOpenPositions: 5,
    maxPositionsPerSymbol: 2,
    maxPortfolioHeat: 10,
    minRiskReward: 1.5,
  },
  entry: {
    defaultOrderType: 'market',
    entryRefinement: false,
    refinementTimeframe: '5m',
    trailingEntry: false,
    trailingEntryPips: 5,
    maxSlippagePips: 2,
    pyramidingEnabled: false,
    maxPyramidAdds: 1,
    closeOnReverse: true,
    cooldownMinutes: 15,
  },
  exit: {
    takeProfitMethod: 'rr_ratio',
    fixedTPPips: 50,
    tpRRRatio: 2.0,
    tpATRMultiple: 2.0,
    stopLossMethod: 'structure',
    fixedSLPips: 25,
    slATRMultiple: 1.5,
    slATRPeriod: 14,
    trailingStopEnabled: false,
    trailingStopPips: 15,
    trailingStopActivation: 'after_1r',
    partialTPEnabled: false,
    partialTPPercent: 50,
    partialTPLevel: 1.0,
    breakEvenEnabled: true,
    breakEvenTriggerPips: 20,
    timeBasedExitEnabled: false,
    maxHoldHours: 24,
    endOfSessionClose: false,
  },
  instruments: {
    allowedInstruments: {
      'EUR/USD': true,
      'GBP/USD': true,
      'USD/JPY': true,
      'GBP/JPY': true,
      'AUD/USD': true,
      'USD/CAD': true,
      'EUR/GBP': false,
      'NZD/USD': false,
      'XAU/USD': true,
      'XAG/USD': false,
      'BTC/USD': false,
      'ETH/USD': false,
    },
    spreadFilterEnabled: true,
    maxSpreadPips: 3,
    volatilityFilterEnabled: false,
    minATR: 10,
    maxATR: 100,
    correlationFilterEnabled: false,
    maxCorrelation: 0.7,
  },
  sessions: {
    londonEnabled: true,
    londonStart: '08:00',
    londonEnd: '16:00',
    newYorkEnabled: true,
    newYorkStart: '13:00',
    newYorkEnd: '21:00',
    asianEnabled: false,
    asianStart: '00:00',
    asianEnd: '08:00',
    sydneyEnabled: false,
    sydneyStart: '22:00',
    sydneyEnd: '06:00',
    activeDays: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
    },
    newsFilterEnabled: false,
    newsFilterPauseMinutes: 30,
  },
  notifications: {
    notifyOnTrade: true,
    notifyOnSignal: false,
    notifyOnError: true,
    notifyDailySummary: true,
    notifyChannel: 'in_app',
  },
  protection: {
    dailyProfitTarget: 0,
    dailyLossLimit: 0,
    cumulativeProfitTarget: 0,
    cumulativeLossLimit: 0,
    haltOnDailyTarget: false,
    haltOnDailyLoss: true,
  },
  account: {
    startingBalance: 10000,
    leverage: 100,
    mode: 'paper',
  },
};

// ─── State (in-memory cache, synced to DB) ─────────────────────────

let currentConfig: BotConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let configLoaded = false;
let currentUserId: number | null = null;

// ─── DB Persistence ────────────────────────────────────────────────

/**
 * Load config from DB for a given user. Falls back to defaults if no DB row.
 * Called once on first access or when userId changes.
 */
export async function loadConfigFromDb(userId: number): Promise<BotConfig> {
  try {
    const row = await dbGetBotConfig(userId);
    if (row && row.configJson) {
      // Deep merge DB config over defaults to handle new fields added after save
      const saved = row.configJson as Partial<BotConfig>;
      currentConfig = deepMergeConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), saved);
    } else {
      currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  } catch (err) {
    console.warn("[BotConfig] Failed to load from DB, using defaults:", err);
    currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  configLoaded = true;
  currentUserId = userId;
  return getConfig();
}

/**
 * Save current config to DB for the given user.
 */
async function saveConfigToDb(userId: number): Promise<void> {
  try {
    await dbUpsertBotConfig(userId, currentConfig);
  } catch (err) {
    console.error("[BotConfig] Failed to save to DB:", err);
  }
}

function deepMergeConfig(base: BotConfig, partial: Partial<BotConfig>): BotConfig {
  const result = { ...base };
  if (partial.strategy) result.strategy = { ...base.strategy, ...partial.strategy };
  if (partial.risk) result.risk = { ...base.risk, ...partial.risk };
  if (partial.entry) result.entry = { ...base.entry, ...partial.entry };
  if (partial.exit) result.exit = { ...base.exit, ...partial.exit };
  if (partial.instruments) {
    result.instruments = {
      ...base.instruments,
      ...partial.instruments,
      allowedInstruments: {
        ...base.instruments.allowedInstruments,
        ...(partial.instruments.allowedInstruments || {}),
      },
    };
  }
  if (partial.sessions) {
    result.sessions = {
      ...base.sessions,
      ...partial.sessions,
      activeDays: {
        ...base.sessions.activeDays,
        ...(partial.sessions.activeDays || {}),
      },
    };
  }
  if (partial.notifications) result.notifications = { ...base.notifications, ...partial.notifications };
  if (partial.protection) result.protection = { ...base.protection, ...partial.protection };
  if (partial.account) result.account = { ...base.account, ...partial.account };
  return result;
}

// ─── Public API ─────────────────────────────────────────────────────

export function getConfig(): BotConfig {
  return JSON.parse(JSON.stringify(currentConfig));
}

export function isConfigLoaded(): boolean {
  return configLoaded;
}

/**
 * Update config and persist to DB. Requires userId for DB persistence.
 */
export async function updateConfig(partial: Partial<BotConfig>, userId?: number): Promise<BotConfig> {
  currentConfig = deepMergeConfig(currentConfig, partial);

  // Persist to DB if we have a userId
  const uid = userId ?? currentUserId;
  if (uid) {
    await saveConfigToDb(uid);
  }

  return getConfig();
}

/**
 * Reset config to defaults and persist to DB.
 */
export async function resetConfig(userId?: number): Promise<BotConfig> {
  currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  const uid = userId ?? currentUserId;
  if (uid) {
    await saveConfigToDb(uid);
  }

  return getConfig();
}

/**
 * Validate a trade against the current bot configuration.
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
export function validateTradeAgainstConfig(params: {
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  stopLoss?: number;
  takeProfit?: number;
  entryPrice: number;
  currentPositions: number;
  positionsForSymbol: number;
  portfolioHeatPercent: number;
  dailyLossPercent: number;
  drawdownPercent: number;
  confluenceScore: number;
}): { allowed: boolean; reason?: string } {
  const cfg = currentConfig;

  // Check instrument allowed
  if (cfg.instruments.allowedInstruments[params.symbol] === false) {
    return { allowed: false, reason: `${params.symbol} is disabled in instrument filter` };
  }

  // Check max open positions
  if (params.currentPositions >= cfg.risk.maxOpenPositions) {
    return { allowed: false, reason: `Max open positions (${cfg.risk.maxOpenPositions}) reached` };
  }

  // Check max positions per symbol
  if (params.positionsForSymbol >= cfg.risk.maxPositionsPerSymbol) {
    return { allowed: false, reason: `Max positions per symbol (${cfg.risk.maxPositionsPerSymbol}) reached for ${params.symbol}` };
  }

  // Check portfolio heat
  if (params.portfolioHeatPercent >= cfg.risk.maxPortfolioHeat) {
    return { allowed: false, reason: `Portfolio heat (${params.portfolioHeatPercent.toFixed(1)}%) exceeds max (${cfg.risk.maxPortfolioHeat}%)` };
  }

  // Check daily loss limit
  if (cfg.risk.maxDailyLoss > 0 && params.dailyLossPercent >= cfg.risk.maxDailyLoss) {
    return { allowed: false, reason: `Daily loss limit (${cfg.risk.maxDailyLoss}%) reached` };
  }

  // Check max drawdown
  if (cfg.risk.maxDrawdown > 0 && params.drawdownPercent >= cfg.risk.maxDrawdown) {
    return { allowed: false, reason: `Max drawdown (${cfg.risk.maxDrawdown}%) reached` };
  }

  // Check minimum confluence score
  if (params.confluenceScore < cfg.strategy.minConfluenceScore) {
    return { allowed: false, reason: `Confluence score (${params.confluenceScore}) below minimum (${cfg.strategy.minConfluenceScore})` };
  }

  // Check minimum R:R
  if (params.stopLoss !== undefined && params.takeProfit !== undefined) {
    const riskPips = Math.abs(params.entryPrice - params.stopLoss);
    const rewardPips = Math.abs(params.takeProfit - params.entryPrice);
    if (riskPips > 0) {
      const rr = rewardPips / riskPips;
      if (rr < cfg.risk.minRiskReward) {
        return { allowed: false, reason: `R:R ratio (${rr.toFixed(1)}) below minimum (${cfg.risk.minRiskReward})` };
      }
    }
  }

  return { allowed: true };
}
