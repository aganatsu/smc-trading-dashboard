import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import {
  InsertUser, users,
  trades, InsertTrade, Trade,
  brokerConnections, InsertBrokerConnection,
  botConfigs, InsertBotConfigRow,
  tradeReasonings, InsertTradeReasoningRow,
  tradePostMortems, InsertTradePostMortemRow,
  userSettings, InsertUserSettingsRow,
  paperAccounts, InsertPaperAccountRow,
  paperPositions, InsertPaperPositionRow,
  paperTradeHistory, InsertPaperTradeHistoryRow,
} from "../drizzle/schema";

let _db: BetterSQLite3Database | null = null;
let _sqlite: Database.Database | null = null;

/**
 * Get or create the SQLite database instance.
 * Database file lives in ./data/smc-trading.db by default,
 * or wherever DATABASE_PATH env points to.
 */
export async function getDb(): Promise<BetterSQLite3Database | null> {
  if (_db) return _db;

  try {
    const dbPath = process.env.SQLITE_DB_PATH || process.env.DATABASE_PATH || path.join(process.cwd(), "data", "smc-trading.db");

    // Ensure the directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    _sqlite = new Database(dbPath);
    // Enable WAL mode for better concurrent read performance
    _sqlite.pragma("journal_mode = WAL");
    // Enable foreign keys
    _sqlite.pragma("foreign_keys = ON");

    _db = drizzle(_sqlite);
    return _db;
  } catch (error) {
    console.warn("[Database] Failed to connect:", error);
    _db = null;
    return null;
  }
}

/**
 * Get the raw better-sqlite3 instance (for running raw SQL like CREATE TABLE).
 */
export function getRawDb(): Database.Database | null {
  return _sqlite;
}

/**
 * Initialize the database schema by running CREATE TABLE IF NOT EXISTS.
 * This replaces drizzle-kit push for the standalone Electron app.
 */
export async function initializeSchema(): Promise<void> {
  const raw = getRawDb();
  if (!raw) {
    // Ensure DB is initialized first
    await getDb();
    const rawAfter = getRawDb();
    if (!rawAfter) throw new Error("Cannot initialize schema: database not available");
    return initializeSchemaWithRaw(rawAfter);
  }
  return initializeSchemaWithRaw(raw);
}

function initializeSchemaWithRaw(raw: Database.Database): void {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
      name TEXT,
      email TEXT,
      loginMethod TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      lastSignedIn INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      entryPrice TEXT NOT NULL,
      exitPrice TEXT,
      stopLoss TEXT,
      takeProfit TEXT,
      positionSize TEXT,
      riskReward TEXT,
      riskPercent TEXT,
      pnlPips TEXT,
      pnlAmount TEXT,
      timeframe TEXT,
      followedStrategy INTEGER,
      setupType TEXT,
      notes TEXT,
      deviations TEXT,
      improvements TEXT,
      entryTime INTEGER NOT NULL,
      exitTime INTEGER,
      screenshotUrl TEXT,
      confluenceScore INTEGER,
      reasoningJson TEXT,
      postMortemJson TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS broker_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      brokerType TEXT NOT NULL,
      displayName TEXT NOT NULL,
      apiKey TEXT NOT NULL,
      accountId TEXT NOT NULL,
      isLive INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bot_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      configJson TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trade_reasonings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      positionId TEXT NOT NULL,
      tradeId INTEGER,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      confluenceScore INTEGER NOT NULL,
      session TEXT,
      timeframe TEXT,
      bias TEXT,
      factorsJson TEXT,
      summary TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trade_post_mortems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      positionId TEXT NOT NULL,
      tradeId INTEGER,
      symbol TEXT NOT NULL,
      exitReason TEXT NOT NULL,
      whatWorked TEXT,
      whatFailed TEXT,
      lessonLearned TEXT,
      exitPrice TEXT,
      pnl TEXT,
      detailJson TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      riskSettingsJson TEXT,
      preferencesJson TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS paper_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      balance TEXT NOT NULL,
      peakBalance TEXT NOT NULL,
      isRunning INTEGER NOT NULL DEFAULT 0,
      isPaused INTEGER NOT NULL DEFAULT 0,
      startedAt INTEGER,
      scanCount INTEGER NOT NULL DEFAULT 0,
      signalCount INTEGER NOT NULL DEFAULT 0,
      rejectedCount INTEGER NOT NULL DEFAULT 0,
      dailyPnlBase TEXT NOT NULL,
      dailyPnlDate TEXT NOT NULL DEFAULT '',
      executionMode TEXT NOT NULL DEFAULT 'paper',
      killSwitchActive INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS paper_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      positionId TEXT NOT NULL,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      size TEXT NOT NULL,
      entryPrice TEXT NOT NULL,
      currentPrice TEXT NOT NULL,
      stopLoss TEXT,
      takeProfit TEXT,
      openTime TEXT NOT NULL,
      signalReason TEXT,
      signalScore TEXT NOT NULL DEFAULT '0',
      orderId TEXT NOT NULL,
      positionStatus TEXT NOT NULL DEFAULT 'open',
      triggerPrice TEXT,
      orderType TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS paper_trade_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      positionId TEXT NOT NULL,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      size TEXT NOT NULL,
      entryPrice TEXT NOT NULL,
      exitPrice TEXT NOT NULL,
      pnl TEXT NOT NULL,
      pnlPips TEXT NOT NULL,
      openTime TEXT NOT NULL,
      closedAt TEXT NOT NULL,
      closeReason TEXT NOT NULL,
      signalReason TEXT,
      signalScore TEXT NOT NULL DEFAULT '0',
      orderId TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `);
}

// ── User Queries ──

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const existing = await getUserByOpenId(user.openId);
    if (existing) {
      const updateSet: Record<string, unknown> = {};
      const textFields = ["name", "email", "loginMethod"] as const;
      type TextField = (typeof textFields)[number];

      const assignNullable = (field: TextField) => {
        const value = user[field];
        if (value === undefined) return;
        const normalized = value ?? null;
        updateSet[field] = normalized;
      };

      textFields.forEach(assignNullable);

      if (user.lastSignedIn !== undefined) {
        updateSet.lastSignedIn = user.lastSignedIn;
      }
      if (user.role !== undefined) {
        updateSet.role = user.role;
      }

      if (Object.keys(updateSet).length === 0) {
        updateSet.lastSignedIn = new Date();
      }

      updateSet.updatedAt = new Date();

      await db
        .update(users)
        .set(updateSet)
        .where(eq(users.openId, user.openId));
    } else {
      const values: InsertUser = {
        openId: user.openId,
        name: user.name,
        email: user.email,
        loginMethod: user.loginMethod,
        role: user.role ?? (user.openId === process.env.OWNER_OPEN_ID ? 'admin' : 'user'),
        lastSignedIn: user.lastSignedIn ?? new Date(),
      };

      await db.insert(users).values(values);
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Trade Journal Queries ──

export async function createTrade(trade: InsertTrade): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = db.insert(trades).values(trade).returning({ id: trades.id }).get();
  return result.id;
}

export async function getTradesByUser(userId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(desc(trades.entryTime))
    .limit(limit)
    .offset(offset);
}

export async function getTradeById(tradeId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(trades)
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateTrade(tradeId: number, userId: number, data: Partial<InsertTrade>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(trades)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)));
}

export async function deleteTrade(tradeId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(trades)
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)));
}

export async function getTradeStats(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allTrades = await db
    .select()
    .from(trades)
    .where(and(eq(trades.userId, userId), eq(trades.status, "closed")));

  const totalTrades = allTrades.length;
  const wins = allTrades.filter(t => t.pnlAmount && parseFloat(t.pnlAmount) > 0).length;
  const losses = allTrades.filter(t => t.pnlAmount && parseFloat(t.pnlAmount) < 0).length;
  const breakeven = totalTrades - wins - losses;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const totalPnl = allTrades.reduce((sum, t) => sum + (t.pnlAmount ? parseFloat(t.pnlAmount) : 0), 0);
  const totalPips = allTrades.reduce((sum, t) => sum + (t.pnlPips ? parseFloat(t.pnlPips) : 0), 0);
  const avgRR = allTrades.filter(t => t.riskReward).length > 0
    ? allTrades.reduce((sum, t) => sum + (t.riskReward ? parseFloat(t.riskReward) : 0), 0) / allTrades.filter(t => t.riskReward).length
    : 0;
  const followedCount = allTrades.filter(t => t.followedStrategy === true).length;
  const strategyAdherence = totalTrades > 0 ? (followedCount / totalTrades) * 100 : 0;

  return {
    totalTrades,
    wins,
    losses,
    breakeven,
    winRate,
    totalPnl,
    totalPips,
    avgRR,
    strategyAdherence,
  };
}

// ── Broker Connection Queries ──

export async function createBrokerConnection(conn: InsertBrokerConnection): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = db.insert(brokerConnections).values(conn).returning({ id: brokerConnections.id }).get();
  return result.id;
}

export async function getBrokerConnectionsByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(brokerConnections)
    .where(eq(brokerConnections.userId, userId))
    .orderBy(desc(brokerConnections.createdAt));
}

export async function getBrokerConnectionById(connId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(brokerConnections)
    .where(and(eq(brokerConnections.id, connId), eq(brokerConnections.userId, userId)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateBrokerConnection(connId: number, userId: number, data: Partial<InsertBrokerConnection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(brokerConnections)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(brokerConnections.id, connId), eq(brokerConnections.userId, userId)));
}

export async function deleteBrokerConnection(connId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(brokerConnections)
    .where(and(eq(brokerConnections.id, connId), eq(brokerConnections.userId, userId)));
}

// ── Equity Curve Query ──

export async function getClosedTradesForEquityCurve(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select({
      id: trades.id,
      exitTime: trades.exitTime,
      pnlAmount: trades.pnlAmount,
      symbol: trades.symbol,
    })
    .from(trades)
    .where(and(eq(trades.userId, userId), eq(trades.status, "closed")))
    .orderBy(trades.exitTime);
}

// ── Bot Config Queries ──

export async function getBotConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(botConfigs)
    .where(eq(botConfigs.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertBotConfig(userId: number, configJson: unknown) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getBotConfig(userId);
  if (existing) {
    await db
      .update(botConfigs)
      .set({ configJson, updatedAt: new Date() })
      .where(eq(botConfigs.userId, userId));
  } else {
    await db.insert(botConfigs).values({ userId, configJson });
  }
}

// ── Trade Reasoning Queries ──

export async function insertTradeReasoning(data: InsertTradeReasoningRow): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = db.insert(tradeReasonings).values(data).returning({ id: tradeReasonings.id }).get();
  return result.id;
}

export async function getTradeReasoningByPositionId(positionId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(tradeReasonings)
    .where(eq(tradeReasonings.positionId, positionId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getTradeReasoningByTradeId(tradeId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(tradeReasonings)
    .where(eq(tradeReasonings.tradeId, tradeId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getRecentTradeReasonings(limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(tradeReasonings)
    .orderBy(desc(tradeReasonings.createdAt))
    .limit(limit);
}

// ── Trade Post-Mortem Queries ──

export async function insertTradePostMortem(data: InsertTradePostMortemRow): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = db.insert(tradePostMortems).values(data).returning({ id: tradePostMortems.id }).get();
  return result.id;
}

export async function getTradePostMortemByPositionId(positionId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(tradePostMortems)
    .where(eq(tradePostMortems.positionId, positionId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getTradePostMortemByTradeId(tradeId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(tradePostMortems)
    .where(eq(tradePostMortems.tradeId, tradeId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getRecentTradePostMortems(limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(tradePostMortems)
    .orderBy(desc(tradePostMortems.createdAt))
    .limit(limit);
}

// ── User Settings Queries ──

export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUserSettings(userId: number, data: { riskSettingsJson?: unknown; preferencesJson?: unknown }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserSettings(userId);
  if (existing) {
    const updateSet: Record<string, unknown> = {};
    if (data.riskSettingsJson !== undefined) updateSet.riskSettingsJson = data.riskSettingsJson;
    if (data.preferencesJson !== undefined) updateSet.preferencesJson = data.preferencesJson;
    updateSet.updatedAt = new Date();
    await db
      .update(userSettings)
      .set(updateSet)
      .where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      riskSettingsJson: data.riskSettingsJson ?? null,
      preferencesJson: data.preferencesJson ?? null,
    });
  }
}

// ── Update trade with reasoning/post-mortem JSON ──

export async function updateTradeReasoningJson(tradeId: number, userId: number, reasoningJson: unknown) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(trades)
    .set({ reasoningJson, updatedAt: new Date() })
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)));
}

export async function updateTradePostMortemJson(tradeId: number, userId: number, postMortemJson: unknown) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(trades)
    .set({ postMortemJson, updatedAt: new Date() })
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)));
}

// ── Paper Account Persistence ──

export async function getPaperAccount(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(paperAccounts)
    .where(eq(paperAccounts.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertPaperAccount(userId: number, data: Partial<Omit<InsertPaperAccountRow, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) {
  const db = await getDb();
  if (!db) return;

  const existing = await getPaperAccount(userId);
  if (existing) {
    await db
      .update(paperAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(paperAccounts.userId, userId));
  } else {
    await db.insert(paperAccounts).values({
      userId,
      balance: data.balance ?? "10000.00",
      peakBalance: data.peakBalance ?? "10000.00",
      dailyPnlBase: data.dailyPnlBase ?? "10000.00",
      ...data,
    });
  }
}

// ── Paper Positions Persistence ──

export async function getPaperPositions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(paperPositions)
    .where(and(eq(paperPositions.userId, userId), eq(paperPositions.status, 'open')));
}

export async function getPaperPendingOrders(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(paperPositions)
    .where(and(eq(paperPositions.userId, userId), eq(paperPositions.status, 'pending')));
}

export async function insertPaperPosition(data: InsertPaperPositionRow) {
  const db = await getDb();
  if (!db) return;

  await db.insert(paperPositions).values(data);
}

export async function deletePaperPosition(userId: number, positionId: string) {
  const db = await getDb();
  if (!db) return;

  await db
    .delete(paperPositions)
    .where(and(eq(paperPositions.userId, userId), eq(paperPositions.positionId, positionId)));
}

export async function deleteAllPaperPositions(userId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(paperPositions).where(eq(paperPositions.userId, userId));
}

// ── Paper Trade History Persistence ──

export async function insertPaperTradeHistory(data: InsertPaperTradeHistoryRow) {
  const db = await getDb();
  if (!db) return;

  await db.insert(paperTradeHistory).values(data);
}

export async function getPaperTradeHistory(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(paperTradeHistory)
    .where(eq(paperTradeHistory.userId, userId))
    .orderBy(desc(paperTradeHistory.createdAt))
    .limit(limit);
}

export async function deleteAllPaperTradeHistory(userId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(paperTradeHistory).where(eq(paperTradeHistory.userId, userId));
}
