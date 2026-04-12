import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { fetchCandlesFromYahoo, fetchQuoteFromYahoo } from "./marketData";

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
});

export type AppRouter = typeof appRouter;
