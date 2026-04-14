import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getStatus,
  placeOrder,
  closePosition,
  placePendingOrder,
  cancelPendingOrder,
  updatePrices,
  startEngine,
  pauseEngine,
  stopEngine,
  resetAccount,
  setOwnerUserId,
} from "./paperTrading";

// Mock the dependencies
vi.mock("./marketData", () => ({
  fetchQuoteFromYahoo: vi.fn(async (symbol: string) => {
    const prices: Record<string, number> = {
      "EUR/USD": 1.085,
      "GBP/USD": 1.25,
      "USD/JPY": 150.5,
      "XAU/USD": 2350.0,
      "BTC/USD": 65000.0,
    };
    const price = prices[symbol];
    if (!price) throw new Error(`Unknown symbol: ${symbol}`);
    return {
      price,
      change: 0,
      percentChange: 0,
      open: price,
      high: price + 0.001,
      low: price - 0.001,
      previousClose: price - 0.0005,
    };
  }),
}));

vi.mock("./db", () => ({
  createTrade: vi.fn(async () => 1),
}));

describe("Paper Trading Engine", () => {
  beforeEach(() => {
    resetAccount();
    setOwnerUserId(1);
  });

  afterEach(() => {
    stopEngine();
  });

  describe("getStatus", () => {
    it("returns initial account state", () => {
      const status = getStatus();
      expect(status.balance).toBe(10000);
      expect(status.equity).toBe(10000);
      expect(status.unrealizedPnl).toBe(0);
      expect(status.positions).toHaveLength(0);
      expect(status.tradeHistory).toHaveLength(0);
      expect(status.isRunning).toBe(false);
      expect(status.totalTrades).toBe(0);
      expect(status.winRate).toBe(0);
    });
  });

  describe("placeOrder", () => {
    it("places a long order successfully", async () => {
      const result = await placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
      });

      expect(result.success).toBe(true);
      expect(result.position).toBeDefined();
      expect(result.position!.symbol).toBe("EUR/USD");
      expect(result.position!.direction).toBe("long");
      expect(result.position!.size).toBe(0.1);
      expect(result.entryPrice).toBe(1.085);
    });

    it("places a short order successfully", async () => {
      const result = await placeOrder({
        symbol: "GBP/USD",
        direction: "short",
        size: 0.05,
      });

      expect(result.success).toBe(true);
      expect(result.position!.direction).toBe("short");
    });

    it("places order with SL and TP", async () => {
      const result = await placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        stopLoss: 1.08,
        takeProfit: 1.09,
      });

      expect(result.success).toBe(true);
      expect(result.position!.stopLoss).toBe(1.08);
      expect(result.position!.takeProfit).toBe(1.09);
    });

    it("rejects unsupported symbols", async () => {
      const result = await placeOrder({
        symbol: "INVALID/PAIR",
        direction: "long",
        size: 0.1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported symbol");
    });

    it("rejects invalid position size", async () => {
      const result = await placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid position size");
    });

    it("rejects SL above entry for long positions", async () => {
      const result = await placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        stopLoss: 1.09, // above entry of 1.085
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Stop loss must be below");
    });

    it("rejects SL below entry for short positions", async () => {
      const result = await placeOrder({
        symbol: "EUR/USD",
        direction: "short",
        size: 0.1,
        stopLoss: 1.08, // below entry of 1.085
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Stop loss must be above");
    });

    it("rejects TP below entry for long positions", async () => {
      const result = await placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        takeProfit: 1.08, // below entry of 1.085
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Take profit must be above");
    });

    it("rejects TP above entry for short positions", async () => {
      const result = await placeOrder({
        symbol: "EUR/USD",
        direction: "short",
        size: 0.1,
        takeProfit: 1.09, // above entry of 1.085
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Take profit must be below");
    });

    it("adds position to status after placing order", async () => {
      await placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
      });

      const status = getStatus();
      expect(status.positions).toHaveLength(1);
      expect(status.positions[0].symbol).toBe("EUR/USD");
    });

    it("can place multiple positions", async () => {
      await placeOrder({ symbol: "EUR/USD", direction: "long", size: 0.1 });
      await placeOrder({ symbol: "GBP/USD", direction: "short", size: 0.05 });

      const status = getStatus();
      expect(status.positions).toHaveLength(2);
    });
  });

  describe("closePosition", () => {
    it("closes a position and updates balance", async () => {
      const orderResult = await placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
      });

      const closeResult = await closePosition(orderResult.position!.id);

      expect(closeResult.success).toBe(true);
      expect(typeof closeResult.pnl).toBe("number");

      const status = getStatus();
      expect(status.positions).toHaveLength(0);
      expect(status.tradeHistory).toHaveLength(1);
      expect(status.totalTrades).toBe(1);
    });

    it("returns error for non-existent position", async () => {
      const result = await closePosition("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Position not found");
    });

    it("auto-logs closed trade to journal", async () => {
      const { createTrade } = await import("./db");

      const orderResult = await placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
      });

      await closePosition(orderResult.position!.id);

      expect(createTrade).toHaveBeenCalled();
      const callArgs = (createTrade as any).mock.calls[0][0];
      expect(callArgs.symbol).toBe("EUR/USD");
      expect(callArgs.direction).toBe("long");
      expect(callArgs.status).toBe("closed");
      expect(callArgs.userId).toBe(1);
    });
  });

  describe("engine controls", () => {
    it("starts the engine", () => {
      startEngine();
      const status = getStatus();
      expect(status.isRunning).toBe(true);
    });

    it("pauses the engine", () => {
      startEngine();
      pauseEngine();
      const status = getStatus();
      expect(status.isRunning).toBe(false);
    });

    it("stops the engine", () => {
      startEngine();
      stopEngine();
      const status = getStatus();
      expect(status.isRunning).toBe(false);
    });

    it("does not start if already running", () => {
      startEngine();
      startEngine(); // should not throw
      const status = getStatus();
      expect(status.isRunning).toBe(true);
    });
  });

  describe("resetAccount", () => {
    it("resets balance to initial value", async () => {
      await placeOrder({ symbol: "EUR/USD", direction: "long", size: 0.1 });
      resetAccount();

      const status = getStatus();
      expect(status.balance).toBe(10000);
      expect(status.positions).toHaveLength(0);
      expect(status.tradeHistory).toHaveLength(0);
      expect(status.isRunning).toBe(false);
    });
  });

  describe("pending orders", () => {
    it("places a pending buy limit order", () => {
      const result = placePendingOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        triggerPrice: 1.08,
        orderType: "buy_limit",
      });

      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order!.symbol).toBe("EUR/USD");
      expect(result.order!.triggerPrice).toBe(1.08);
      expect(result.order!.orderType).toBe("buy_limit");

      const status = getStatus();
      expect(status.pendingOrders).toHaveLength(1);
    });

    it("places a pending sell stop order with SL/TP", () => {
      const result = placePendingOrder({
        symbol: "GBP/USD",
        direction: "short",
        size: 0.05,
        triggerPrice: 1.24,
        orderType: "sell_stop",
        stopLoss: 1.25,
        takeProfit: 1.23,
        signalReason: "BOS confirmed",
        signalScore: 8,
      });

      expect(result.success).toBe(true);
      expect(result.order!.stopLoss).toBe(1.25);
      expect(result.order!.takeProfit).toBe(1.23);
      expect(result.order!.signalReason).toBe("BOS confirmed");
      expect(result.order!.signalScore).toBe(8);
    });

    it("rejects pending order for unsupported symbol", () => {
      const result = placePendingOrder({
        symbol: "INVALID/PAIR",
        direction: "long",
        size: 0.1,
        triggerPrice: 1.0,
        orderType: "buy_limit",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported symbol");
    });

    it("cancels a pending order", () => {
      const placeResult = placePendingOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        triggerPrice: 1.08,
        orderType: "buy_limit",
      });

      const cancelResult = cancelPendingOrder(placeResult.order!.id);
      expect(cancelResult.success).toBe(true);

      const status = getStatus();
      expect(status.pendingOrders).toHaveLength(0);
    });

    it("returns error when cancelling non-existent order", () => {
      const result = cancelPendingOrder("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Pending order not found");
    });

    it("clears pending orders on reset", () => {
      placePendingOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        triggerPrice: 1.08,
        orderType: "buy_limit",
      });

      resetAccount();
      const status = getStatus();
      expect(status.pendingOrders).toHaveLength(0);
    });

    it("triggers a buy_limit pending order when price drops to trigger level", async () => {
      // Place a buy limit at 1.08 (current price from mock is 1.085)
      // We need to make the mock return a price <= 1.08 to trigger it
      const { fetchQuoteFromYahoo } = await import("./marketData");
      const mockFetch = fetchQuoteFromYahoo as ReturnType<typeof vi.fn>;
      
      // First place a position so updatePrices processes the symbol
      await placeOrder({ symbol: "EUR/USD", direction: "long", size: 0.01 });
      
      // Now place the pending order
      const result = placePendingOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
        triggerPrice: 1.08,
        orderType: "buy_limit",
      });
      expect(result.success).toBe(true);
      expect(getStatus().pendingOrders).toHaveLength(1);
      
      // Mock price drop to 1.079 (below trigger of 1.08)
      mockFetch.mockResolvedValueOnce({
        price: 1.079,
        change: 0,
        percentChange: 0,
        open: 1.079,
        high: 1.08,
        low: 1.078,
        previousClose: 1.085,
      });
      
      await updatePrices();
      
      // Pending order should be triggered and converted to a position
      const status = getStatus();
      expect(status.pendingOrders).toHaveLength(0);
      // Should have 2 positions now (original + triggered)
      expect(status.positions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("P&L calculation", () => {
    it("calculates correct P&L for forex pairs", async () => {
      const result = await placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
      });

      // At entry, P&L should be 0
      expect(result.position!.pnl).toBe(0);
    });

    it("tracks win rate correctly", async () => {
      // Place and close a trade
      const order1 = await placeOrder({
        symbol: "EUR/USD",
        direction: "long",
        size: 0.1,
      });
      await closePosition(order1.position!.id);

      const status = getStatus();
      expect(status.totalTrades).toBe(1);
      // Win rate depends on whether P&L is positive (at same price, it's 0)
      expect(typeof status.winRate).toBe("number");
    });
  });
});
