import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

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
  /** Record timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;
