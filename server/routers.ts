import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { fetchCandlesFromYahoo, fetchQuoteFromYahoo } from "./marketData";
import {
  createTrade, getTradesByUser, getTradeById, updateTrade, deleteTrade, getTradeStats,
  createBrokerConnection, getBrokerConnectionsByUser, getBrokerConnectionById,
  updateBrokerConnection, deleteBrokerConnection, getClosedTradesForEquityCurve,
} from "./db";
import {
  getOandaAccounts, getOandaAccountSummary, getOandaOpenPositions,
  getOandaOpenTrades, placeOandaMarketOrder, closeOandaTrade,
} from "./brokers/oanda";
import {
  getMetaApiAccounts, getMetaApiAccountInfo, getMetaApiPositions,
  placeMetaApiMarketOrder, closeMetaApiPosition,
} from "./brokers/metaapi";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import {
  getStatus as getPaperStatus,
  placeOrder as placePaperOrder,
  closePosition as closePaperPosition,
  placePendingOrder as placePaperPendingOrder,
  cancelPendingOrder as cancelPaperPendingOrder,
  startEngine, pauseEngine, stopEngine, resetAccount,
  setOwnerUserId, getLog as getPaperLog,
} from "./paperTrading";
import { getConfig, updateConfig, resetConfig, type BotConfig } from "./botConfig";
import {
  calculateCurrencyStrength,
  calculateCorrelation,
  detectSession,
  calculatePDLevels,
  detectJudasSwing,
  calculatePremiumDiscount,
  detectSwingPoints,
  type CurrencyStrength,
  type CorrelationPair,
  type SessionInfo,
  type PDLevels,
  type JudasSwing,
  type PremiumDiscount,
  type Candle,
} from "./smcAnalysis";
import {
  startEngine as startBotEngine,
  stopEngine as stopBotEngine,
  setAutoTrading,
  getEngineState,
  getTradeReasoning,
  getPostMortems,
  getLastScanResults,
  triggerManualScan,
  generatePostMortem,
} from "./botEngine";
import { getFundamentalsData, getEventsForPair, hasUpcomingHighImpact } from "./fundamentals";
import { runBacktest, getBacktestProgress, getLastBacktestResult } from "./backtest";

export const appRouter = router({
  system: systemRouter,

  // ─── Bot Configuration ──────────────────────────────────────────────
  botConfig: router({
    get: publicProcedure.query(() => {
      return getConfig();
    }),
    update: publicProcedure
      .input(z.object({
        strategy: z.any().optional(),
        risk: z.any().optional(),
        entry: z.any().optional(),
        exit: z.any().optional(),
        instruments: z.any().optional(),
        sessions: z.any().optional(),
        notifications: z.any().optional(),
        protection: z.any().optional(),
        account: z.any().optional(),
      }))
      .mutation(({ input }) => {
        return updateConfig(input as Partial<BotConfig>);
      }),
    reset: publicProcedure.mutation(() => {
      return resetConfig();
    }),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  market: router({
    candles: publicProcedure
      .input(
        z.object({
          symbol: z.string(),
          interval: z.string(),
          outputsize: z.number().optional().default(200),
        })
      )
      .query(async ({ input }) => {
        return fetchCandlesFromYahoo(input.symbol, input.interval, input.outputsize);
      }),

    quote: publicProcedure
      .input(
        z.object({
          symbol: z.string(),
        })
      )
      .query(async ({ input }) => {
        return fetchQuoteFromYahoo(input.symbol);
      }),
  }),

  // ─── Fundamentals & Economic Calendar ────────────────────────────
  fundamentals: router({
    data: publicProcedure.query(() => {
      return getFundamentalsData();
    }),
    eventsForPair: publicProcedure
      .input(z.object({ pair: z.string() }))
      .query(({ input }) => {
        return getEventsForPair(input.pair);
      }),
    highImpactCheck: publicProcedure
      .input(z.object({ pair: z.string(), withinMinutes: z.number().optional().default(30) }))
      .query(({ input }) => {
        return hasUpcomingHighImpact(input.pair, input.withinMinutes);
      }),
  }),

  trades: router({
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).optional().default(50),
          offset: z.number().min(0).optional().default(0),
        })
      )
      .query(async ({ ctx, input }) => {
        return getTradesByUser(ctx.user.id, input.limit, input.offset);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return getTradeById(input.id, ctx.user.id);
      }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      return getTradeStats(ctx.user.id);
    }),

    equityCurve: protectedProcedure.query(async ({ ctx }) => {
      const closedTrades = await getClosedTradesForEquityCurve(ctx.user.id);
      let cumulative = 0;
      return closedTrades.map((t) => {
        cumulative += t.pnlAmount ? parseFloat(t.pnlAmount) : 0;
        return {
          id: t.id,
          date: t.exitTime,
          pnl: t.pnlAmount ? parseFloat(t.pnlAmount) : 0,
          cumulative,
          symbol: t.symbol,
        };
      });
    }),

    create: protectedProcedure
      .input(
        z.object({
          symbol: z.string().min(1),
          direction: z.enum(["long", "short"]),
          status: z.enum(["open", "closed", "cancelled"]).optional().default("open"),
          entryPrice: z.string(),
          exitPrice: z.string().optional(),
          stopLoss: z.string().optional(),
          takeProfit: z.string().optional(),
          positionSize: z.string().optional(),
          riskReward: z.string().optional(),
          riskPercent: z.string().optional(),
          pnlPips: z.string().optional(),
          pnlAmount: z.string().optional(),
          timeframe: z.string().optional(),
          followedStrategy: z.boolean().optional(),
          setupType: z.string().optional(),
          notes: z.string().optional(),
          deviations: z.string().optional(),
          improvements: z.string().optional(),
          screenshotUrl: z.string().optional(),
          entryTime: z.date(),
          exitTime: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const id = await createTrade({
          ...input,
          userId: ctx.user.id,
          exitPrice: input.exitPrice ?? null,
          stopLoss: input.stopLoss ?? null,
          takeProfit: input.takeProfit ?? null,
          positionSize: input.positionSize ?? null,
          riskReward: input.riskReward ?? null,
          riskPercent: input.riskPercent ?? null,
          pnlPips: input.pnlPips ?? null,
          pnlAmount: input.pnlAmount ?? null,
          timeframe: input.timeframe ?? null,
          followedStrategy: input.followedStrategy ?? null,
          setupType: input.setupType ?? null,
          notes: input.notes ?? null,
          deviations: input.deviations ?? null,
          improvements: input.improvements ?? null,
          screenshotUrl: input.screenshotUrl ?? null,
          exitTime: input.exitTime ?? null,
        });
        return { id };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          symbol: z.string().min(1).optional(),
          direction: z.enum(["long", "short"]).optional(),
          status: z.enum(["open", "closed", "cancelled"]).optional(),
          entryPrice: z.string().optional(),
          exitPrice: z.string().nullable().optional(),
          stopLoss: z.string().nullable().optional(),
          takeProfit: z.string().nullable().optional(),
          positionSize: z.string().nullable().optional(),
          riskReward: z.string().nullable().optional(),
          riskPercent: z.string().nullable().optional(),
          pnlPips: z.string().nullable().optional(),
          pnlAmount: z.string().nullable().optional(),
          timeframe: z.string().nullable().optional(),
          followedStrategy: z.boolean().nullable().optional(),
          setupType: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
          deviations: z.string().nullable().optional(),
          improvements: z.string().nullable().optional(),
          screenshotUrl: z.string().nullable().optional(),
          entryTime: z.date().optional(),
          exitTime: z.date().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateTrade(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteTrade(input.id, ctx.user.id);
        return { success: true };
      }),

    uploadScreenshot: protectedProcedure
      .input(
        z.object({
          imageData: z.string(), // base64 encoded image
          tradeId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.imageData, "base64");
        const fileKey = `screenshots/${ctx.user.id}/${nanoid()}.png`;
        const { url } = await storagePut(fileKey, buffer, "image/png");

        if (input.tradeId) {
          await updateTrade(input.tradeId, ctx.user.id, { screenshotUrl: url });
        }

        return { url };
      }),
  }),

  broker: router({
    // Connection management
    connections: protectedProcedure.query(async ({ ctx }) => {
      const conns = await getBrokerConnectionsByUser(ctx.user.id);
      // Mask API keys in response
      return conns.map((c) => ({
        ...c,
        apiKey: c.apiKey.substring(0, 8) + "..." + c.apiKey.substring(c.apiKey.length - 4),
      }));
    }),

    addConnection: protectedProcedure
      .input(
        z.object({
          brokerType: z.enum(["oanda", "metaapi"]),
          displayName: z.string().min(1),
          apiKey: z.string().min(1),
          accountId: z.string().min(1),
          isLive: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Validate the connection by testing it
        try {
          if (input.brokerType === "oanda") {
            await getOandaAccountSummary({
              apiKey: input.apiKey,
              accountId: input.accountId,
              isLive: input.isLive,
            });
          } else {
            await getMetaApiAccountInfo({
              token: input.apiKey,
              accountId: input.accountId,
            });
          }
        } catch (error: any) {
          throw new Error(`Failed to connect: ${error.message || "Invalid credentials"}`);
        }

        const id = await createBrokerConnection({
          userId: ctx.user.id,
          brokerType: input.brokerType,
          displayName: input.displayName,
          apiKey: input.apiKey,
          accountId: input.accountId,
          isLive: input.isLive,
        });

        return { id };
      }),

    removeConnection: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteBrokerConnection(input.id, ctx.user.id);
        return { success: true };
      }),

    // Account info
    accountInfo: protectedProcedure
      .input(z.object({ connectionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const conn = await getBrokerConnectionById(input.connectionId, ctx.user.id);
        if (!conn) throw new Error("Connection not found");

        if (conn.brokerType === "oanda") {
          const summary = await getOandaAccountSummary({
            apiKey: conn.apiKey,
            accountId: conn.accountId,
            isLive: conn.isLive,
          });
          return {
            broker: "oanda",
            balance: parseFloat(summary.balance),
            unrealizedPL: parseFloat(summary.unrealizedPL),
            nav: parseFloat(summary.NAV),
            marginUsed: parseFloat(summary.marginUsed),
            marginAvailable: parseFloat(summary.marginAvailable),
            openTradeCount: summary.openTradeCount,
            currency: summary.currency,
          };
        } else {
          const info = await getMetaApiAccountInfo({
            token: conn.apiKey,
            accountId: conn.accountId,
          });
          return {
            broker: "metaapi",
            balance: info.balance,
            unrealizedPL: info.equity - info.balance,
            nav: info.equity,
            marginUsed: info.margin,
            marginAvailable: info.freeMargin,
            openTradeCount: 0,
            currency: info.currency,
          };
        }
      }),

    // Open positions
    positions: protectedProcedure
      .input(z.object({ connectionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const conn = await getBrokerConnectionById(input.connectionId, ctx.user.id);
        if (!conn) throw new Error("Connection not found");

        if (conn.brokerType === "oanda") {
          const trades = await getOandaOpenTrades({
            apiKey: conn.apiKey,
            accountId: conn.accountId,
            isLive: conn.isLive,
          });
          return trades.map((t: any) => ({
            id: t.id,
            symbol: t.instrument.replace("_", "/"),
            direction: parseInt(t.currentUnits) > 0 ? "long" : "short",
            units: Math.abs(parseInt(t.currentUnits)),
            entryPrice: parseFloat(t.price),
            unrealizedPL: parseFloat(t.unrealizedPL),
            openTime: t.openTime,
          }));
        } else {
          const positions = await getMetaApiPositions({
            token: conn.apiKey,
            accountId: conn.accountId,
          });
          return positions.map((p: any) => ({
            id: p.id,
            symbol: p.symbol,
            direction: p.type === "POSITION_TYPE_BUY" ? "long" : "short",
            units: p.volume,
            entryPrice: p.openPrice,
            unrealizedPL: p.profit,
            openTime: p.time,
          }));
        }
      }),

    // Place a market order
    placeOrder: protectedProcedure
      .input(
        z.object({
          connectionId: z.number(),
          symbol: z.string(),
          direction: z.enum(["long", "short"]),
          units: z.number(), // For OANDA: number of units. For MetaApi: lot size
          stopLoss: z.string().optional(),
          takeProfit: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const conn = await getBrokerConnectionById(input.connectionId, ctx.user.id);
        if (!conn) throw new Error("Connection not found");

        if (conn.brokerType === "oanda") {
          const units = input.direction === "long" ? input.units : -input.units;
          const result = await placeOandaMarketOrder(
            {
              apiKey: conn.apiKey,
              accountId: conn.accountId,
              isLive: conn.isLive,
            },
            {
              symbol: input.symbol,
              units,
              stopLoss: input.stopLoss,
              takeProfit: input.takeProfit,
            }
          );
          return {
            success: true,
            orderId: result.orderFillTransaction?.id || result.orderCreateTransaction?.id,
            details: result,
          };
        } else {
          const result = await placeMetaApiMarketOrder(
            {
              token: conn.apiKey,
              accountId: conn.accountId,
            },
            {
              symbol: input.symbol,
              direction: input.direction,
              volume: input.units,
              stopLoss: input.stopLoss ? parseFloat(input.stopLoss) : undefined,
              takeProfit: input.takeProfit ? parseFloat(input.takeProfit) : undefined,
            }
          );
          return {
            success: true,
            orderId: result.orderId,
            details: result,
          };
        }
      }),

    // Close a position
    closePosition: protectedProcedure
      .input(
        z.object({
          connectionId: z.number(),
          positionId: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const conn = await getBrokerConnectionById(input.connectionId, ctx.user.id);
        if (!conn) throw new Error("Connection not found");

        if (conn.brokerType === "oanda") {
          const result = await closeOandaTrade(
            {
              apiKey: conn.apiKey,
              accountId: conn.accountId,
              isLive: conn.isLive,
            },
            input.positionId
          );
          return { success: true, details: result };
        } else {
          const result = await closeMetaApiPosition(
            {
              token: conn.apiKey,
              accountId: conn.accountId,
            },
            input.positionId
          );
          return { success: true, details: result };
        }
      }),
  }),

  // ── Paper Trading Engine ──
  paper: router({
    status: publicProcedure.query(() => {
      return getPaperStatus();
    }),

    start: protectedProcedure.mutation(({ ctx }) => {
      setOwnerUserId(ctx.user.id);
      startEngine();
      return { success: true };
    }),

    pause: protectedProcedure.mutation(() => {
      pauseEngine();
      return { success: true };
    }),

    stop: protectedProcedure.mutation(() => {
      stopEngine();
      return { success: true };
    }),

    reset: protectedProcedure.mutation(() => {
      resetAccount();
      return { success: true };
    }),

    placeOrder: protectedProcedure
      .input(
        z.object({
          symbol: z.string(),
          direction: z.enum(["long", "short"]),
          size: z.number().min(0.01).max(100),
          stopLoss: z.number().optional(),
          takeProfit: z.number().optional(),
          signalReason: z.string().optional(),
          signalScore: z.number().min(0).max(10).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        setOwnerUserId(ctx.user.id);
        return placePaperOrder(input);
      }),

    closePosition: protectedProcedure
      .input(z.object({ positionId: z.string() }))
      .mutation(async ({ input }) => {
        return closePaperPosition(input.positionId);
      }),

    placePendingOrder: protectedProcedure
      .input(
        z.object({
          symbol: z.string(),
          direction: z.enum(["long", "short"]),
          size: z.number().min(0.01).max(100),
          triggerPrice: z.number(),
          orderType: z.enum(["buy_limit", "sell_limit", "buy_stop", "sell_stop"]),
          stopLoss: z.number().optional(),
          takeProfit: z.number().optional(),
          signalReason: z.string().optional(),
          signalScore: z.number().min(0).max(10).optional(),
        })
      )
      .mutation(({ input }) => {
        return placePaperPendingOrder(input);
      }),

    cancelPendingOrder: protectedProcedure
      .input(z.object({ orderId: z.string() }))
      .mutation(({ input }) => {
        return cancelPaperPendingOrder(input.orderId);
      }),

    log: publicProcedure.query(() => {
      return getPaperLog();
    }),
  }),

  // ── ICT Analysis Endpoints ──
  ict: router({
    currencyStrength: publicProcedure.query(async () => {
      // Fetch quotes for all major pairs to compute currency strength
      const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP', 'GBP/JPY'];
      const quotes: Record<string, { price: number; previousClose: number }> = {};
      for (const pair of pairs) {
        try {
          const q = await fetchQuoteFromYahoo(pair);
          quotes[pair] = { price: q.price, previousClose: q.previousClose };
        } catch { /* skip unavailable pairs */ }
      }
      return calculateCurrencyStrength(quotes);
    }),

    correlations: publicProcedure.query(async () => {
      // Fetch daily close prices for correlation calculation
      const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP', 'GBP/JPY'];
      const priceData: Record<string, number[]> = {};
      for (const pair of pairs) {
        try {
          const candles = await fetchCandlesFromYahoo(pair, '1day', 30);
          priceData[pair] = candles.map(c => c.close);
        } catch { /* skip */ }
      }

      const results: CorrelationPair[] = [];
      const pairKeys = Object.keys(priceData);
      for (let i = 0; i < pairKeys.length; i++) {
        for (let j = i + 1; j < pairKeys.length; j++) {
          const p1 = priceData[pairKeys[i]];
          const p2 = priceData[pairKeys[j]];
          if (p1 && p2) {
            results.push({
              pair1: pairKeys[i],
              pair2: pairKeys[j],
              coefficient: calculateCorrelation(p1, p2),
            });
          }
        }
      }
      return results;
    }),

    sessionInfo: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        try {
          const candles = await fetchCandlesFromYahoo(input.symbol, '1h', 50);
          return detectSession(candles as Candle[]);
        } catch {
          return { name: 'Unknown', active: false, isKillZone: false, sessionHigh: 0, sessionLow: 0, sessionOpen: 0 };
        }
      }),

    pdLevels: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        try {
          const dailyCandles = await fetchCandlesFromYahoo(input.symbol, '1day', 30);
          return calculatePDLevels(dailyCandles as Candle[]);
        } catch {
          return null;
        }
      }),

    judasSwing: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        try {
          const candles = await fetchCandlesFromYahoo(input.symbol, '1h', 50);
          return detectJudasSwing(candles as Candle[]);
        } catch {
          return { detected: false, type: null, midnightOpen: 0, sweepLow: null, sweepHigh: null, reversalConfirmed: false, description: 'Data unavailable' };
        }
      }),

    premiumDiscount: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        try {
          const candles = await fetchCandlesFromYahoo(input.symbol, '4h', 100);
          const swings = detectSwingPoints(candles as Candle[], 3);
          return calculatePremiumDiscount(candles as Candle[], swings);
        } catch {
          return { swingHigh: 0, swingLow: 0, equilibrium: 0, currentZone: 'equilibrium' as const, zonePercent: 50, oteZone: false };
        }
      }),
  }),

  // ── Autonomous Bot Engine ──
  engine: router({
    state: publicProcedure.query(() => {
      const engineState = getEngineState();
      return {
        running: engineState.running,
        autoTrading: engineState.autoTrading,
        scanInterval: engineState.scanInterval,
        lastScanTime: engineState.lastScanTime,
        totalScans: engineState.totalScans,
        totalSignals: engineState.totalSignals,
        totalTradesPlaced: engineState.totalTradesPlaced,
        totalRejected: engineState.totalRejected,
        postMortemCount: engineState.postMortems.length,
      };
    }),

    start: protectedProcedure
      .input(z.object({
        autoTrade: z.boolean().default(true),
        intervalSeconds: z.number().min(30).max(3600).default(60),
      }))
      .mutation(({ ctx, input }) => {
        setOwnerUserId(ctx.user.id);
        startBotEngine(input.autoTrade, input.intervalSeconds);
        return { success: true };
      }),

    stop: protectedProcedure.mutation(() => {
      stopBotEngine();
      return { success: true };
    }),

    setAutoTrading: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(({ input }) => {
        setAutoTrading(input.enabled);
        return { success: true };
      }),

    manualScan: protectedProcedure.mutation(async () => {
      await triggerManualScan();
      return { success: true, scanResults: getLastScanResults().map(r => ({
        symbol: r.symbol,
        signal: r.signal,
        confluenceScore: r.confluenceScore,
        tradePlaced: r.tradePlaced,
        rejectionReason: r.rejectionReason,
        reasoning: r.reasoning,
      })) };
    }),

    scanResults: publicProcedure.query(() => {
      return getLastScanResults().map(r => ({
        symbol: r.symbol,
        signal: r.signal,
        confluenceScore: r.confluenceScore,
        tradePlaced: r.tradePlaced,
        rejectionReason: r.rejectionReason,
        reasoning: r.reasoning,
      }));
    }),

    tradeReasoning: publicProcedure
      .input(z.object({ positionId: z.string() }))
      .query(({ input }) => {
        return getTradeReasoning(input.positionId);
      }),

    postMortems: publicProcedure.query(() => {
      return getPostMortems();
    }),
  }),

  // ─── Backtest Engine ──────────────────────────────────────────────
  backtest: router({
    run: protectedProcedure
      .input(z.object({
        symbol: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        timeframe: z.string(),
        initialBalance: z.number().min(100).max(10000000).default(10000),
        useCurrentConfig: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const result = await runBacktest({
          symbol: input.symbol,
          startDate: input.startDate,
          endDate: input.endDate,
          timeframe: input.timeframe,
          initialBalance: input.initialBalance,
          useCurrentConfig: input.useCurrentConfig,
        });
        return result;
      }),

    progress: publicProcedure.query(() => {
      return getBacktestProgress();
    }),

    lastResult: publicProcedure.query(() => {
      return getLastBacktestResult();
    }),
  }),
});

export type AppRouter = typeof appRouter;
