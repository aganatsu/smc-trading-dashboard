import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Trade journal entries — records each trade with full details for review.
 */
export const trades = mysqlTable("trades", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Trading instrument symbol e.g. "EUR/USD", "BTC/USD", "XAU/USD" */
  symbol: varchar("symbol", { length: 32 }).notNull(),
  /** Trade direction */
  direction: mysqlEnum("direction", ["long", "short"]).notNull(),
  /** Trade status */
  status: mysqlEnum("status", ["open", "closed", "cancelled"]).default("open").notNull(),
  /** Entry price */
  entryPrice: decimal("entryPrice", { precision: 18, scale: 8 }).notNull(),
  /** Exit price (null if still open) */
  exitPrice: decimal("exitPrice", { precision: 18, scale: 8 }),
  /** Stop loss price */
  stopLoss: decimal("stopLoss", { precision: 18, scale: 8 }),
  /** Take profit price */
  takeProfit: decimal("takeProfit", { precision: 18, scale: 8 }),
  /** Position size / lot size */
  positionSize: decimal("positionSize", { precision: 18, scale: 8 }),
  /** Risk-reward ratio at entry */
  riskReward: decimal("riskReward", { precision: 8, scale: 2 }),
  /** Risk percentage of account */
  riskPercent: decimal("riskPercent", { precision: 8, scale: 2 }),
  /** Realized P&L in pips or points */
  pnlPips: decimal("pnlPips", { precision: 12, scale: 2 }),
  /** Realized P&L in account currency */
  pnlAmount: decimal("pnlAmount", { precision: 18, scale: 2 }),
  /** Timeframe used for entry */
  timeframe: varchar("timeframe", { length: 10 }),
  /** Whether trader followed the strategy */
  followedStrategy: boolean("followedStrategy"),
  /** Entry setup type (e.g. "OB Retest", "FVG Entry", "Liquidity Sweep") */
  setupType: varchar("setupType", { length: 64 }),
  /** Free-form notes about the trade */
  notes: text("notes"),
  /** Deviations from the trading plan */
  deviations: text("deviations"),
  /** Areas for improvement */
  improvements: text("improvements"),
  /** Trade entry timestamp */
  entryTime: timestamp("entryTime").notNull(),
  /** Trade exit timestamp */
  exitTime: timestamp("exitTime"),
  /** Screenshot URL from S3 */
  screenshotUrl: text("screenshotUrl"),
  /** Bot confluence score at entry (0-100) */
  confluenceScore: int("confluenceScore"),
  /** Bot reasoning JSON — full TradeReasoning object from the engine */
  reasoningJson: json("reasoningJson"),
  /** Bot post-mortem JSON — full TradePostMortem object after close */
  postMortemJson: json("postMortemJson"),
  /** Record timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

/**
 * Broker connections — stores encrypted API credentials for each user's broker accounts.
 */
export const brokerConnections = mysqlTable("broker_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Broker type */
  brokerType: mysqlEnum("brokerType", ["oanda", "metaapi"]).notNull(),
  /** Display name for this connection */
  displayName: varchar("displayName", { length: 128 }).notNull(),
  /** API key / token (encrypted at rest) */
  apiKey: text("apiKey").notNull(),
  /** Broker account ID */
  accountId: varchar("accountId", { length: 128 }).notNull(),
  /** Whether this is a live or practice/demo account */
  isLive: boolean("isLive").default(false).notNull(),
  /** Whether this connection is active */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrokerConnection = typeof brokerConnections.$inferSelect;
export type InsertBrokerConnection = typeof brokerConnections.$inferInsert;

/**
 * Bot configuration — persists the full BotConfig JSON so it survives server restarts.
 * Single row per user (upsert pattern).
 */
export const botConfigs = mysqlTable("bot_configs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Full BotConfig JSON object */
  configJson: json("configJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BotConfigRow = typeof botConfigs.$inferSelect;
export type InsertBotConfigRow = typeof botConfigs.$inferInsert;

/**
 * Trade reasonings — persists the bot's reasoning for each trade it places.
 * Linked to trades by positionId (the paper trading position ID string).
 */
export const tradeReasonings = mysqlTable("trade_reasonings", {
  id: int("id").autoincrement().primaryKey(),
  /** Paper trading position ID (string) */
  positionId: varchar("positionId", { length: 64 }).notNull(),
  /** Trade ID in the trades table (if logged to journal) */
  tradeId: int("tradeId"),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  direction: mysqlEnum("direction", ["long", "short"]).notNull(),
  confluenceScore: int("confluenceScore").notNull(),
  session: varchar("session", { length: 32 }),
  timeframe: varchar("timeframe", { length: 10 }),
  bias: varchar("bias", { length: 16 }),
  /** JSON array of { concept, weight, present, detail } */
  factorsJson: json("factorsJson"),
  /** Human-readable summary of why the trade was taken */
  summary: text("summary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TradeReasoningRow = typeof tradeReasonings.$inferSelect;
export type InsertTradeReasoningRow = typeof tradeReasonings.$inferInsert;

/**
 * Trade post-mortems — persists the bot's analysis of what happened after a trade closed.
 */
export const tradePostMortems = mysqlTable("trade_post_mortems", {
  id: int("id").autoincrement().primaryKey(),
  /** Paper trading position ID (string) */
  positionId: varchar("positionId", { length: 64 }).notNull(),
  /** Trade ID in the trades table (if logged to journal) */
  tradeId: int("tradeId"),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  exitReason: varchar("exitReason", { length: 64 }).notNull(),
  /** What worked in this trade */
  whatWorked: text("whatWorked"),
  /** What failed in this trade */
  whatFailed: text("whatFailed"),
  /** Key lesson learned */
  lessonLearned: text("lessonLearned"),
  exitPrice: decimal("exitPrice", { precision: 18, scale: 8 }),
  pnl: decimal("pnl", { precision: 18, scale: 2 }),
  /** Full post-mortem JSON for additional data */
  detailJson: json("detailJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TradePostMortemRow = typeof tradePostMortems.$inferSelect;
export type InsertTradePostMortemRow = typeof tradePostMortems.$inferInsert;

/**
 * User settings — persists risk management and preference settings per user.
 * Single row per user (upsert pattern).
 */
export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Risk management settings JSON */
  riskSettingsJson: json("riskSettingsJson"),
  /** UI preferences JSON */
  preferencesJson: json("preferencesJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettingsRow = typeof userSettings.$inferSelect;
export type InsertUserSettingsRow = typeof userSettings.$inferInsert;
