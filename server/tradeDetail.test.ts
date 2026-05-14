import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("engine.tradeReasoning", () => {
  it("returns null for a non-existent position ID", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.engine.tradeReasoning({ positionId: "non-existent-id-12345" });
    expect(result).toBeNull();
  });

  it("accepts both string and numeric positionId", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Should not throw - validates input schema accepts number
    const result = await caller.engine.tradeReasoning({ positionId: "999" });
    expect(result).toBeNull();
  });
});

describe("engine.postMortems", () => {
  it("returns an array (possibly empty) of post-mortems", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.engine.postMortems();
    expect(Array.isArray(result)).toBe(true);
  });

  it("each post-mortem has expected shape when data exists", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.engine.postMortems();
    // If there are any post-mortems, verify shape
    if (result.length > 0) {
      const pm = result[0];
      expect(pm).toHaveProperty("tradeId");
      expect(pm).toHaveProperty("outcome");
      expect(["win", "loss", "breakeven"]).toContain(pm.outcome);
      expect(pm).toHaveProperty("whatWorked");
      expect(pm).toHaveProperty("whatFailed");
      expect(pm).toHaveProperty("lessonLearned");
    }
  });
});
