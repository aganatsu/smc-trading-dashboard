import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { fetchCandlesFromYahoo, fetchQuoteFromYahoo } from "./marketData";
import { createTrade, getTradesByUser, getTradeById, updateTrade, deleteTrade, getTradeStats } from "./db";

export const appRouter = router({
  system: systemRouter,
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
  }),
});

export type AppRouter = typeof appRouter;
