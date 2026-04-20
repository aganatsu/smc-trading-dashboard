import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Migrated from MySQL to SQLite for standalone Electron desktop app.
 * 
 * Key SQLite differences:
 * - No native enum → use text with application-level validation
 * - No native decimal → use real (float64) for prices, text for precise money
 * - No native boolean → use integer mode:'boolean' (0/1)
 * - No native timestamp → use integer (Unix epoch ms) or text (ISO string)
 * - No onUpdateNow() → handled in application code
 * - No varchar length limits → all text columns are unlimited
 */

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  /** 'user' | 'admin' — no native enum in SQLite */
  role: text("role").default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Trade journal entries — records each trade with full details for review.
 * Prices stored as text to preserve decimal precision (avoid float rounding).
 */
export const trades = sqliteTable("trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  symbol: text("symbol").notNull(),
  /** 'long' | 'short' */
  direction: text("direction").notNull(),
  /** 'open' | 'closed' | 'cancelled' */
  status: text("status").default("open").notNull(),
  entryPrice: text("entryPrice").notNull(),
  exitPrice: text("exitPrice"),
  stopLoss: text("stopLoss"),
  takeProfit: text("takeProfit"),
  positionSize: text("positionSize"),
  riskReward: text("riskReward"),
  riskPercent: text("riskPercent"),
  pnlPips: text("pnlPips"),
  pnlAmount: text("pnlAmount"),
  timeframe: text("timeframe"),
  followedStrategy: integer("followedStrategy", { mode: "boolean" }),
  setupType: text("setupType"),
  notes: text("notes"),
  deviations: text("deviations"),
  improvements: text("improvements"),
  entryTime: integer("entryTime", { mode: "timestamp" }).notNull(),
  exitTime: integer("exitTime", { mode: "timestamp" }),
  screenshotUrl: text("screenshotUrl"),
  confluenceScore: integer("confluenceScore"),
  /** JSON stored as text */
  reasoningJson: text("reasoningJson", { mode: "json" }),
  postMortemJson: text("postMortemJson", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

/**
 * Broker connections — stores API credentials for each user's broker accounts.
 */
export const brokerConnections = sqliteTable("broker_connections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  /** 'oanda' | 'metaapi' */
  brokerType: text("brokerType").notNull(),
  displayName: text("displayName").notNull(),
  apiKey: text("apiKey").notNull(),
  accountId: text("accountId").notNull(),
  isLive: integer("isLive", { mode: "boolean" }).default(false).notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type BrokerConnection = typeof brokerConnections.$inferSelect;
export type InsertBrokerConnection = typeof brokerConnections.$inferInsert;

/**
 * Bot configuration — persists the full BotConfig JSON so it survives server restarts.
 * Single row per user (upsert pattern).
 */
export const botConfigs = sqliteTable("bot_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  configJson: text("configJson", { mode: "json" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type BotConfigRow = typeof botConfigs.$inferSelect;
export type InsertBotConfigRow = typeof botConfigs.$inferInsert;

/**
 * Trade reasonings — persists the bot's reasoning for each trade it places.
 */
export const tradeReasonings = sqliteTable("trade_reasonings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  positionId: text("positionId").notNull(),
  tradeId: integer("tradeId"),
  symbol: text("symbol").notNull(),
  /** 'long' | 'short' */
  direction: text("direction").notNull(),
  confluenceScore: integer("confluenceScore").notNull(),
  session: text("session"),
  timeframe: text("timeframe"),
  bias: text("bias"),
  /** JSON stored as text */
  factorsJson: text("factorsJson", { mode: "json" }),
  summary: text("summary"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type TradeReasoningRow = typeof tradeReasonings.$inferSelect;
export type InsertTradeReasoningRow = typeof tradeReasonings.$inferInsert;

/**
 * Trade post-mortems — persists the bot's analysis of what happened after a trade closed.
 */
export const tradePostMortems = sqliteTable("trade_post_mortems", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  positionId: text("positionId").notNull(),
  tradeId: integer("tradeId"),
  symbol: text("symbol").notNull(),
  exitReason: text("exitReason").notNull(),
  whatWorked: text("whatWorked"),
  whatFailed: text("whatFailed"),
  lessonLearned: text("lessonLearned"),
  exitPrice: text("exitPrice"),
  pnl: text("pnl"),
  detailJson: text("detailJson", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type TradePostMortemRow = typeof tradePostMortems.$inferSelect;
export type InsertTradePostMortemRow = typeof tradePostMortems.$inferInsert;

/**
 * User settings — persists risk management and preference settings per user.
 */
export const userSettings = sqliteTable("user_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  riskSettingsJson: text("riskSettingsJson", { mode: "json" }),
  preferencesJson: text("preferencesJson", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type UserSettingsRow = typeof userSettings.$inferSelect;
export type InsertUserSettingsRow = typeof userSettings.$inferInsert;

/**
 * Paper trading account state — persists balance, counters, and engine state.
 */
export const paperAccounts = sqliteTable("paper_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  /** Stored as text to preserve decimal precision */
  balance: text("balance").notNull(),
  peakBalance: text("peakBalance").notNull(),
  isRunning: integer("isRunning", { mode: "boolean" }).default(false).notNull(),
  isPaused: integer("isPaused", { mode: "boolean" }).default(false).notNull(),
  startedAt: integer("startedAt", { mode: "timestamp" }),
  scanCount: integer("scanCount").default(0).notNull(),
  signalCount: integer("signalCount").default(0).notNull(),
  rejectedCount: integer("rejectedCount").default(0).notNull(),
  dailyPnlBase: text("dailyPnlBase").notNull(),
  dailyPnlDate: text("dailyPnlDate").default("").notNull(),
  /** 'paper' | 'live' */
  executionMode: text("executionMode").default("paper").notNull(),
  killSwitchActive: integer("killSwitchActive", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type PaperAccountRow = typeof paperAccounts.$inferSelect;
export type InsertPaperAccountRow = typeof paperAccounts.$inferInsert;

/**
 * Paper trading positions — persists open positions and pending orders.
 */
export const paperPositions = sqliteTable("paper_positions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  positionId: text("positionId").notNull(),
  symbol: text("symbol").notNull(),
  /** 'long' | 'short' */
  direction: text("direction").notNull(),
  size: text("size").notNull(),
  entryPrice: text("entryPrice").notNull(),
  currentPrice: text("currentPrice").notNull(),
  stopLoss: text("stopLoss"),
  takeProfit: text("takeProfit"),
  openTime: text("openTime").notNull(),
  signalReason: text("signalReason"),
  signalScore: text("signalScore").default("0").notNull(),
  orderId: text("orderId").notNull(),
  /** Broker trade/position ID from live execution (OANDA trade ID or MetaApi position ID) */
  brokerTradeId: text("brokerTradeId"),
  /** 'open' | 'pending' */
  status: text("positionStatus").default("open").notNull(),
  triggerPrice: text("triggerPrice"),
  orderType: text("orderType"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type PaperPositionRow = typeof paperPositions.$inferSelect;
export type InsertPaperPositionRow = typeof paperPositions.$inferInsert;

/**
 * Paper trade history — persists closed paper trades.
 */
export const paperTradeHistory = sqliteTable("paper_trade_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  positionId: text("positionId").notNull(),
  symbol: text("symbol").notNull(),
  /** 'long' | 'short' */
  direction: text("direction").notNull(),
  size: text("size").notNull(),
  entryPrice: text("entryPrice").notNull(),
  exitPrice: text("exitPrice").notNull(),
  pnl: text("pnl").notNull(),
  pnlPips: text("pnlPips").notNull(),
  openTime: text("openTime").notNull(),
  closedAt: text("closedAt").notNull(),
  closeReason: text("closeReason").notNull(),
  signalReason: text("signalReason"),
  signalScore: text("signalScore").default("0").notNull(),
  orderId: text("orderId").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type PaperTradeHistoryRow = typeof paperTradeHistory.$inferSelect;
export type InsertPaperTradeHistoryRow = typeof paperTradeHistory.$inferInsert;
