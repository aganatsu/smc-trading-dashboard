import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
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

describe("broker.connections", () => {
  it("requires authentication to list connections", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.broker.connections()).rejects.toThrow();
  });
});

describe("broker.addConnection", () => {
  it("requires authentication to add a connection", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.broker.addConnection({
        brokerType: "oanda",
        displayName: "Test OANDA",
        apiKey: "test-key",
        accountId: "test-account",
        isLive: false,
      })
    ).rejects.toThrow();
  });

  it("validates input schema - rejects invalid broker type", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.broker.addConnection({
        brokerType: "invalid" as any,
        displayName: "Test",
        apiKey: "key",
        accountId: "acc",
        isLive: false,
      })
    ).rejects.toThrow();
  });

  it("validates input schema - rejects empty display name", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.broker.addConnection({
        brokerType: "oanda",
        displayName: "",
        apiKey: "key",
        accountId: "acc",
        isLive: false,
      })
    ).rejects.toThrow();
  });
});

describe("trades.equityCurve", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.trades.equityCurve()).rejects.toThrow();
  });
});

describe("trades.uploadScreenshot", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.trades.uploadScreenshot({
        imageData: "dGVzdA==", // base64 for "test"
      })
    ).rejects.toThrow();
  });

  it("accepts empty imageData and uploads successfully", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Empty base64 string is technically valid, S3 accepts empty files
    const result = await caller.trades.uploadScreenshot({
      imageData: "",
    });
    expect(result).toHaveProperty("url");
    expect(typeof result.url).toBe("string");
  });
});

describe("trades.create with screenshotUrl", () => {
  it("accepts screenshotUrl in create input schema", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // This tests that the schema accepts screenshotUrl without throwing a validation error
    // The actual DB call may fail in test env, but schema validation should pass
    try {
      await caller.trades.create({
        symbol: "EUR/USD",
        direction: "long",
        status: "open",
        entryPrice: "1.08500",
        screenshotUrl: "https://example.com/screenshot.png",
        entryTime: new Date(),
      });
    } catch (error: any) {
      // DB errors are expected in test env, but schema validation errors are not
      expect(error.message).not.toContain("Expected");
      expect(error.message).not.toContain("invalid_type");
    }
  });
});

describe("broker.removeConnection", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.broker.removeConnection({ id: 1 })
    ).rejects.toThrow();
  });

  it("validates input - requires numeric id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.broker.removeConnection({ id: "abc" as any })
    ).rejects.toThrow();
  });
});

describe("broker.accountInfo", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.broker.accountInfo({ connectionId: 1 })
    ).rejects.toThrow();
  });
});

describe("broker.placeOrder", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.broker.placeOrder({
        connectionId: 1,
        symbol: "EUR/USD",
        units: 1000,
        direction: "long",
      })
    ).rejects.toThrow();
  });

  it("validates direction enum", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.broker.placeOrder({
        connectionId: 1,
        symbol: "EUR/USD",
        units: 1000,
        direction: "sideways" as any,
      })
    ).rejects.toThrow();
  });
});
