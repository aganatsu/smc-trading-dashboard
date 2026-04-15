import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, trades, InsertTrade, Trade, brokerConnections, InsertBrokerConnection, botConfigs, InsertBotConfigRow, tradeReasonings, InsertTradeReasoningRow, tradePostMortems, InsertTradePostMortemRow, userSettings, InsertUserSettingsRow } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

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
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
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

  const result = await db.insert(trades).values(trade);
  return result[0].insertId;
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
    .set(data)
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

  const result = await db.insert(brokerConnections).values(conn);
  return result[0].insertId;
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
    .set(data)
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
      .set({ configJson })
      .where(eq(botConfigs.userId, userId));
  } else {
    await db.insert(botConfigs).values({ userId, configJson });
  }
}

// ── Trade Reasoning Queries ──

export async function insertTradeReasoning(data: InsertTradeReasoningRow) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(tradeReasonings).values(data);
  return result[0].insertId;
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

export async function insertTradePostMortem(data: InsertTradePostMortemRow) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(tradePostMortems).values(data);
  return result[0].insertId;
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
    .set({ reasoningJson })
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)));
}

export async function updateTradePostMortemJson(tradeId: number, userId: number, postMortemJson: unknown) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(trades)
    .set({ postMortemJson })
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)));
}
