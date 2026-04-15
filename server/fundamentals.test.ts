import { describe, it, expect } from "vitest";
import { getFundamentalsData, getEventsForPair, hasUpcomingHighImpact } from "./fundamentals";

describe("Fundamentals / Economic Calendar", () => {
  describe("getFundamentalsData", () => {
    it("returns a valid FundamentalsData structure", async () => {
      const data = await getFundamentalsData();
      expect(data).toHaveProperty("upcomingEvents");
      expect(data).toHaveProperty("todayEvents");
      expect(data).toHaveProperty("thisWeekEvents");
      expect(data).toHaveProperty("highImpactCount");
      expect(data).toHaveProperty("mediumImpactCount");
      expect(data).toHaveProperty("lowImpactCount");
      expect(data).toHaveProperty("currencyExposure");
      expect(Array.isArray(data.upcomingEvents)).toBe(true);
      expect(Array.isArray(data.todayEvents)).toBe(true);
      expect(Array.isArray(data.thisWeekEvents)).toBe(true);
    });

    it("upcoming events span up to 30 days", async () => {
      const data = await getFundamentalsData();
      expect(data.upcomingEvents.length).toBeGreaterThan(0);
      // All events should be in the future (or today)
      const now = new Date();
      const thirtyDaysLater = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
      for (const event of data.upcomingEvents) {
        const eventDate = new Date(event.scheduledTime);
        expect(eventDate.getTime()).toBeLessThanOrEqual(thirtyDaysLater.getTime());
      }
    });

    it("events are sorted by scheduled time", async () => {
      const data = await getFundamentalsData();
      for (let i = 1; i < data.upcomingEvents.length; i++) {
        const prev = new Date(data.upcomingEvents[i - 1].scheduledTime).getTime();
        const curr = new Date(data.upcomingEvents[i].scheduledTime).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    it("impact counts match event data", async () => {
      const data = await getFundamentalsData();
      const highCount = data.upcomingEvents.filter(e => e.impact === "high").length;
      const medCount = data.upcomingEvents.filter(e => e.impact === "medium").length;
      const lowCount = data.upcomingEvents.filter(e => e.impact === "low").length;
      expect(data.highImpactCount).toBe(highCount);
      expect(data.mediumImpactCount).toBe(medCount);
      expect(data.lowImpactCount).toBe(lowCount);
    });

    it("currency exposure aggregates correctly from this week events", async () => {
      const data = await getFundamentalsData();
      // Verify that each currency in exposure exists in thisWeekEvents
      for (const [currency, counts] of Object.entries(data.currencyExposure)) {
        const eventsForCurrency = data.thisWeekEvents.filter(e => e.currency === currency);
        const high = eventsForCurrency.filter(e => e.impact === "high").length;
        const medium = eventsForCurrency.filter(e => e.impact === "medium").length;
        const low = eventsForCurrency.filter(e => e.impact === "low").length;
        expect(counts.high).toBe(high);
        expect(counts.medium).toBe(medium);
        expect(counts.low).toBe(low);
      }
    });

    it("each event has required fields", async () => {
      const data = await getFundamentalsData();
      for (const event of data.upcomingEvents.slice(0, 10)) {
        expect(event.id).toBeTruthy();
        expect(event.name).toBeTruthy();
        expect(event.country).toBeTruthy();
        expect(event.currency).toBeTruthy();
        expect(["high", "medium", "low"]).toContain(event.impact);
        expect(event.category).toBeTruthy();
        expect(event.description).toBeTruthy();
        expect(Array.isArray(event.affectedPairs)).toBe(true);
        expect(event.affectedPairs.length).toBeGreaterThan(0);
        expect(event.scheduledTime).toBeTruthy();
      }
    });
  });

  describe("getEventsForPair", () => {
    it("returns events that include the given pair in affectedPairs", async () => {
      const events = await getEventsForPair("EUR/USD");
      for (const event of events) {
        expect(event.affectedPairs).toContain("EUR/USD");
      }
    });

    it("returns events for USD/JPY", async () => {
      const events = await getEventsForPair("USD/JPY");
      for (const event of events) {
        expect(event.affectedPairs).toContain("USD/JPY");
      }
    });

    it("returns events within the next 7 days", async () => {
      const events = await getEventsForPair("EUR/USD");
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
      for (const event of events) {
        const eventDate = new Date(event.scheduledTime);
        expect(eventDate.getTime()).toBeLessThanOrEqual(sevenDaysLater.getTime());
      }
    });

    it("returns empty array for a pair with no events", async () => {
      const events = await getEventsForPair("FAKE/PAIR");
      expect(events).toEqual([]);
    });
  });

  describe("hasUpcomingHighImpact", () => {
    it("returns an object with hasEvent boolean", async () => {
      const result = await hasUpcomingHighImpact("EUR/USD", 30);
      expect(result).toHaveProperty("hasEvent");
      expect(typeof result.hasEvent).toBe("boolean");
    });

    it("if hasEvent is true, event is provided", async () => {
      // Check with a very wide window to increase chance of finding an event
      const result = await hasUpcomingHighImpact("EUR/USD", 60 * 24 * 30); // 30 days
      if (result.hasEvent) {
        expect(result.event).toBeDefined();
        expect(result.event!.impact).toBe("high");
        expect(result.event!.affectedPairs).toContain("EUR/USD");
      }
    });

    it("returns false for a pair with no events", async () => {
      const result = await hasUpcomingHighImpact("FAKE/PAIR", 30);
      expect(result.hasEvent).toBe(false);
      expect(result.event).toBeUndefined();
    });

    it("returns false for 0 minute window", async () => {
      const result = await hasUpcomingHighImpact("EUR/USD", 0);
      expect(result.hasEvent).toBe(false);
    });
  });
});
