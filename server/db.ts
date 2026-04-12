import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, trades, InsertTrade, Trade } from "../drizzle/schema";
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
