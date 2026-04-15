/**
 * Fundamentals & Economic Calendar Module
 *
 * Provides a built-in economic calendar with major recurring events,
 * impact levels, and currency pair mappings. No external API required.
 *
 * Events are generated from known recurring schedules (NFP, CPI, FOMC, etc.)
 * and mapped to affected currency pairs for the trading dashboard.
 */

// ─── Types ──────────────────────────────────────────────────────────
export type ImpactLevel = "high" | "medium" | "low";
export type EventCategory =
  | "employment"
  | "inflation"
  | "central_bank"
  | "gdp"
  | "trade"
  | "housing"
  | "manufacturing"
  | "consumer"
  | "government";

export interface EconomicEvent {
  id: string;
  name: string;
  country: string;        // e.g. "US", "GB", "EU", "JP", "AU", "CA", "NZ", "CH"
  currency: string;       // e.g. "USD", "GBP", "EUR", "JPY"
  impact: ImpactLevel;
  category: EventCategory;
  description: string;
  affectedPairs: string[]; // e.g. ["EUR/USD", "GBP/USD"]
  scheduledTime: string;  // ISO string
  isRecurring: boolean;
  frequency: string;      // "monthly", "quarterly", "8x_year", "weekly"
}

export interface FundamentalsData {
  upcomingEvents: EconomicEvent[];
  todayEvents: EconomicEvent[];
  thisWeekEvents: EconomicEvent[];
  highImpactCount: number;
  mediumImpactCount: number;
  lowImpactCount: number;
  currencyExposure: Record<string, { high: number; medium: number; low: number }>;
}

// ─── Static Event Templates ─────────────────────────────────────────
// These represent the major recurring economic events that forex traders track

interface EventTemplate {
  name: string;
  country: string;
  currency: string;
  impact: ImpactLevel;
  category: EventCategory;
  description: string;
  affectedPairs: string[];
  frequency: string;
  // Schedule info: dayOfMonth or weekOfMonth + dayOfWeek
  scheduleType: "fixed_day" | "nth_weekday" | "variable";
  dayOfMonth?: number;
  weekOfMonth?: number;     // 1-5
  dayOfWeek?: number;       // 0=Sun, 1=Mon, ..., 6=Sat
  hour: number;             // UTC hour
  minute: number;
}

const EVENT_TEMPLATES: EventTemplate[] = [
  // ─── US Events ────────────────────────────────────────────────
  {
    name: "Non-Farm Payrolls (NFP)",
    country: "US",
    currency: "USD",
    impact: "high",
    category: "employment",
    description: "Monthly change in employment excluding farm workers. The most impactful forex event.",
    affectedPairs: ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CAD", "AUD/USD", "NZD/USD", "XAU/USD"],
    frequency: "monthly",
    scheduleType: "nth_weekday",
    weekOfMonth: 1,
    dayOfWeek: 5, // First Friday
    hour: 12,
    minute: 30,
  },
  {
    name: "US CPI (Consumer Price Index)",
    country: "US",
    currency: "USD",
    impact: "high",
    category: "inflation",
    description: "Measures changes in consumer prices. Key inflation gauge for Fed policy decisions.",
    affectedPairs: ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"],
    frequency: "monthly",
    scheduleType: "fixed_day",
    dayOfMonth: 13,
    hour: 12,
    minute: 30,
  },
  {
    name: "FOMC Interest Rate Decision",
    country: "US",
    currency: "USD",
    impact: "high",
    category: "central_bank",
    description: "Federal Reserve interest rate decision and monetary policy statement.",
    affectedPairs: ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CAD", "AUD/USD", "NZD/USD", "XAU/USD", "BTC/USD"],
    frequency: "8x_year",
    scheduleType: "variable",
    hour: 18,
    minute: 0,
  },
  {
    name: "US GDP (Gross Domestic Product)",
    country: "US",
    currency: "USD",
    impact: "high",
    category: "gdp",
    description: "Quarterly measure of economic output. Advance, preliminary, and final readings.",
    affectedPairs: ["EUR/USD", "GBP/USD", "USD/JPY"],
    frequency: "quarterly",
    scheduleType: "fixed_day",
    dayOfMonth: 28,
    hour: 12,
    minute: 30,
  },
  {
    name: "US Retail Sales",
    country: "US",
    currency: "USD",
    impact: "medium",
    category: "consumer",
    description: "Monthly change in total retail sales. Indicator of consumer spending.",
    affectedPairs: ["EUR/USD", "GBP/USD", "USD/JPY"],
    frequency: "monthly",
    scheduleType: "fixed_day",
    dayOfMonth: 15,
    hour: 12,
    minute: 30,
  },
  {
    name: "US ISM Manufacturing PMI",
    country: "US",
    currency: "USD",
    impact: "medium",
    category: "manufacturing",
    description: "Manufacturing sector health. Above 50 = expansion, below 50 = contraction.",
    affectedPairs: ["EUR/USD", "USD/JPY"],
    frequency: "monthly",
    scheduleType: "fixed_day",
    dayOfMonth: 1,
    hour: 14,
    minute: 0,
  },
  {
    name: "US Unemployment Claims",
    country: "US",
    currency: "USD",
    impact: "medium",
    category: "employment",
    description: "Weekly initial jobless claims. Leading indicator of labor market health.",
    affectedPairs: ["EUR/USD", "USD/JPY"],
    frequency: "weekly",
    scheduleType: "nth_weekday",
    weekOfMonth: 1,
    dayOfWeek: 4, // Thursday
    hour: 12,
    minute: 30,
  },
  {
    name: "US PPI (Producer Price Index)",
    country: "US",
    currency: "USD",
    impact: "medium",
    category: "inflation",
    description: "Measures wholesale price changes. Leading indicator of consumer inflation.",
    affectedPairs: ["EUR/USD", "USD/JPY", "XAU/USD"],
    frequency: "monthly",
    scheduleType: "fixed_day",
    dayOfMonth: 14,
    hour: 12,
    minute: 30,
  },

  // ─── EU Events ────────────────────────────────────────────────
  {
    name: "ECB Interest Rate Decision",
    country: "EU",
    currency: "EUR",
    impact: "high",
    category: "central_bank",
    description: "European Central Bank rate decision and press conference.",
    affectedPairs: ["EUR/USD", "EUR/GBP", "EUR/JPY"],
    frequency: "8x_year",
    scheduleType: "variable",
    hour: 12,
    minute: 15,
  },
  {
    name: "EU CPI (Harmonised)",
    country: "EU",
    currency: "EUR",
    impact: "high",
    category: "inflation",
    description: "Eurozone harmonised consumer price index. Key ECB policy input.",
    affectedPairs: ["EUR/USD", "EUR/GBP"],
    frequency: "monthly",
    scheduleType: "fixed_day",
    dayOfMonth: 17,
    hour: 9,
    minute: 0,
  },
  {
    name: "EU GDP",
    country: "EU",
    currency: "EUR",
    impact: "medium",
    category: "gdp",
    description: "Eurozone gross domestic product. Flash, preliminary, and final readings.",
    affectedPairs: ["EUR/USD", "EUR/GBP"],
    frequency: "quarterly",
    scheduleType: "fixed_day",
    dayOfMonth: 30,
    hour: 9,
    minute: 0,
  },
  {
    name: "German ZEW Economic Sentiment",
    country: "EU",
    currency: "EUR",
    impact: "medium",
    category: "consumer",
    description: "Survey of institutional investors on 6-month economic outlook for Germany.",
    affectedPairs: ["EUR/USD"],
    frequency: "monthly",
    scheduleType: "nth_weekday",
    weekOfMonth: 2,
    dayOfWeek: 2, // Second Tuesday
    hour: 9,
    minute: 0,
  },

  // ─── UK Events ────────────────────────────────────────────────
  {
    name: "BOE Interest Rate Decision",
    country: "GB",
    currency: "GBP",
    impact: "high",
    category: "central_bank",
    description: "Bank of England rate decision and monetary policy summary.",
    affectedPairs: ["GBP/USD", "EUR/GBP", "GBP/JPY"],
    frequency: "8x_year",
    scheduleType: "variable",
    hour: 12,
    minute: 0,
  },
  {
    name: "UK CPI",
    country: "GB",
    currency: "GBP",
    impact: "high",
    category: "inflation",
    description: "UK consumer price index. Key BOE policy input.",
    affectedPairs: ["GBP/USD", "EUR/GBP", "GBP/JPY"],
    frequency: "monthly",
    scheduleType: "fixed_day",
    dayOfMonth: 16,
    hour: 7,
    minute: 0,
  },
  {
    name: "UK GDP",
    country: "GB",
    currency: "GBP",
    impact: "medium",
    category: "gdp",
    description: "UK gross domestic product. Monthly and quarterly readings.",
    affectedPairs: ["GBP/USD", "GBP/JPY"],
    frequency: "monthly",
    scheduleType: "fixed_day",
    dayOfMonth: 12,
    hour: 7,
    minute: 0,
  },
  {
    name: "UK Employment/Claimant Count",
    country: "GB",
    currency: "GBP",
    impact: "medium",
    category: "employment",
    description: "UK unemployment rate and claimant count change.",
    affectedPairs: ["GBP/USD", "GBP/JPY"],
    frequency: "monthly",
    scheduleType: "fixed_day",
    dayOfMonth: 11,
    hour: 7,
    minute: 0,
  },

  // ─── Japan Events ─────────────────────────────────────────────
  {
    name: "BOJ Interest Rate Decision",
    country: "JP",
    currency: "JPY",
    impact: "high",
    category: "central_bank",
    description: "Bank of Japan rate decision and monetary policy statement.",
    affectedPairs: ["USD/JPY", "GBP/JPY", "EUR/JPY"],
    frequency: "8x_year",
    scheduleType: "variable",
    hour: 3,
    minute: 0,
  },
  {
    name: "Japan CPI",
    country: "JP",
    currency: "JPY",
    impact: "medium",
    category: "inflation",
    description: "Japan consumer price index. Key BOJ policy input.",
    affectedPairs: ["USD/JPY", "GBP/JPY"],
    frequency: "monthly",
    scheduleType: "fixed_day",
    dayOfMonth: 20,
    hour: 23,
    minute: 30,
  },
  {
    name: "Japan Tankan Survey",
    country: "JP",
    currency: "JPY",
    impact: "medium",
    category: "manufacturing",
    description: "BOJ quarterly business confidence survey. Key economic indicator.",
    affectedPairs: ["USD/JPY", "GBP/JPY"],
    frequency: "quarterly",
    scheduleType: "fixed_day",
    dayOfMonth: 1,
    hour: 23,
    minute: 50,
  },

  // ─── Australia Events ─────────────────────────────────────────
  {
    name: "RBA Interest Rate Decision",
    country: "AU",
    currency: "AUD",
    impact: "high",
    category: "central_bank",
    description: "Reserve Bank of Australia rate decision.",
    affectedPairs: ["AUD/USD", "AUD/JPY"],
    frequency: "monthly",
    scheduleType: "nth_weekday",
    weekOfMonth: 1,
    dayOfWeek: 2, // First Tuesday
    hour: 3,
    minute: 30,
  },
  {
    name: "Australia Employment Change",
    country: "AU",
    currency: "AUD",
    impact: "high",
    category: "employment",
    description: "Monthly change in employed persons. Key AUD mover.",
    affectedPairs: ["AUD/USD"],
    frequency: "monthly",
    scheduleType: "fixed_day",
    dayOfMonth: 18,
    hour: 0,
    minute: 30,
  },

  // ─── Canada Events ────────────────────────────────────────────
  {
    name: "BOC Interest Rate Decision",
    country: "CA",
    currency: "CAD",
    impact: "high",
    category: "central_bank",
    description: "Bank of Canada rate decision and monetary policy report.",
    affectedPairs: ["USD/CAD"],
    frequency: "8x_year",
    scheduleType: "variable",
    hour: 13,
    minute: 45,
  },
  {
    name: "Canada Employment Change",
    country: "CA",
    currency: "CAD",
    impact: "high",
    category: "employment",
    description: "Monthly change in employment. Released same day as US NFP.",
    affectedPairs: ["USD/CAD"],
    frequency: "monthly",
    scheduleType: "nth_weekday",
    weekOfMonth: 1,
    dayOfWeek: 5, // First Friday (same as NFP)
    hour: 12,
    minute: 30,
  },

  // ─── New Zealand Events ───────────────────────────────────────
  {
    name: "RBNZ Interest Rate Decision",
    country: "NZ",
    currency: "NZD",
    impact: "high",
    category: "central_bank",
    description: "Reserve Bank of New Zealand rate decision.",
    affectedPairs: ["NZD/USD"],
    frequency: "8x_year",
    scheduleType: "variable",
    hour: 1,
    minute: 0,
  },

  // ─── Switzerland Events ───────────────────────────────────────
  {
    name: "SNB Interest Rate Decision",
    country: "CH",
    currency: "CHF",
    impact: "high",
    category: "central_bank",
    description: "Swiss National Bank rate decision.",
    affectedPairs: ["USD/CHF", "EUR/CHF"],
    frequency: "quarterly",
    scheduleType: "variable",
    hour: 7,
    minute: 30,
  },
];

// ─── Helper: Get Nth Weekday of Month ───────────────────────────────
function getNthWeekdayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date {
  const firstDay = new Date(Date.UTC(year, month, 1));
  let firstOccurrence = firstDay.getUTCDay();
  let diff = dayOfWeek - firstOccurrence;
  if (diff < 0) diff += 7;
  const day = 1 + diff + (n - 1) * 7;
  return new Date(Date.UTC(year, month, day));
}

// ─── Generate Events for a Date Range ───────────────────────────────
function generateEventsForRange(startDate: Date, endDate: Date): EconomicEvent[] {
  const events: EconomicEvent[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (const template of EVENT_TEMPLATES) {
    // Generate events month by month
    const currentDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

    while (currentDate <= end) {
      const year = currentDate.getUTCFullYear();
      const month = currentDate.getUTCMonth();
      let eventDate: Date | null = null;

      if (template.frequency === "weekly") {
        // Generate weekly events for each week in the month
        for (let week = 1; week <= 5; week++) {
          if (template.dayOfWeek !== undefined) {
            const weeklyDate = getNthWeekdayOfMonth(year, month, template.dayOfWeek, week);
            if (weeklyDate.getUTCMonth() === month) {
              const d = new Date(Date.UTC(year, month, weeklyDate.getUTCDate(), template.hour, template.minute));
              if (d >= start && d <= end) {
                events.push(createEvent(template, d));
              }
            }
          }
        }
        currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
        continue;
      }

      if (template.scheduleType === "fixed_day" && template.dayOfMonth) {
        const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const day = Math.min(template.dayOfMonth, maxDay);
        eventDate = new Date(Date.UTC(year, month, day, template.hour, template.minute));
        // Skip weekends
        while (eventDate.getUTCDay() === 0 || eventDate.getUTCDay() === 6) {
          eventDate.setUTCDate(eventDate.getUTCDate() + 1);
        }
      } else if (template.scheduleType === "nth_weekday" && template.weekOfMonth !== undefined && template.dayOfWeek !== undefined) {
        eventDate = getNthWeekdayOfMonth(year, month, template.dayOfWeek, template.weekOfMonth);
        eventDate.setUTCHours(template.hour, template.minute, 0, 0);
      } else if (template.scheduleType === "variable") {
        // For variable schedules (central bank meetings), approximate mid-month
        // In a real app, these would come from an API or manually maintained schedule
        if (template.frequency === "8x_year") {
          // ~8 meetings per year, roughly every 6 weeks
          const meetingMonths = [0, 1, 2, 4, 5, 6, 8, 10, 11]; // Jan, Feb, Mar, May, Jun, Jul, Sep, Nov, Dec
          if (meetingMonths.includes(month)) {
            const day = month % 2 === 0 ? 15 : 20; // Approximate
            eventDate = new Date(Date.UTC(year, month, day, template.hour, template.minute));
            while (eventDate.getUTCDay() === 0 || eventDate.getUTCDay() === 6) {
              eventDate.setUTCDate(eventDate.getUTCDate() + 1);
            }
          }
        } else if (template.frequency === "quarterly") {
          if (month % 3 === 0) {
            eventDate = new Date(Date.UTC(year, month, 20, template.hour, template.minute));
            while (eventDate.getUTCDay() === 0 || eventDate.getUTCDay() === 6) {
              eventDate.setUTCDate(eventDate.getUTCDate() + 1);
            }
          }
        }
      }

      if (eventDate && eventDate >= start && eventDate <= end) {
        events.push(createEvent(template, eventDate));
      }

      // Skip months for quarterly events
      if (template.frequency === "quarterly") {
        currentDate.setUTCMonth(currentDate.getUTCMonth() + 3);
      } else {
        currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
      }
    }
  }

  // Sort by scheduled time
  events.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
  return events;
}

function createEvent(template: EventTemplate, date: Date): EconomicEvent {
  return {
    id: `${template.name.replace(/\s+/g, "_").toLowerCase()}_${date.toISOString().split("T")[0]}`,
    name: template.name,
    country: template.country,
    currency: template.currency,
    impact: template.impact,
    category: template.category,
    description: template.description,
    affectedPairs: template.affectedPairs,
    scheduledTime: date.toISOString(),
    isRecurring: true,
    frequency: template.frequency,
  };
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Get fundamentals data for the current period
 */
export function getFundamentalsData(): FundamentalsData {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
  const weekEnd = new Date(todayStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const monthEnd = new Date(todayStart);
  monthEnd.setUTCDate(monthEnd.getUTCDate() + 30);

  const todayEvents = generateEventsForRange(todayStart, todayEnd);
  const thisWeekEvents = generateEventsForRange(todayStart, weekEnd);
  const upcomingEvents = generateEventsForRange(todayStart, monthEnd);

  const highImpactCount = upcomingEvents.filter(e => e.impact === "high").length;
  const mediumImpactCount = upcomingEvents.filter(e => e.impact === "medium").length;
  const lowImpactCount = upcomingEvents.filter(e => e.impact === "low").length;

  // Calculate currency exposure
  const currencyExposure: Record<string, { high: number; medium: number; low: number }> = {};
  for (const event of thisWeekEvents) {
    if (!currencyExposure[event.currency]) {
      currencyExposure[event.currency] = { high: 0, medium: 0, low: 0 };
    }
    currencyExposure[event.currency][event.impact]++;
  }

  return {
    upcomingEvents,
    todayEvents,
    thisWeekEvents,
    highImpactCount,
    mediumImpactCount,
    lowImpactCount,
    currencyExposure,
  };
}

/**
 * Get events that affect a specific currency pair
 */
export function getEventsForPair(pair: string): EconomicEvent[] {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const allEvents = generateEventsForRange(now, weekEnd);
  return allEvents.filter(e => e.affectedPairs.includes(pair));
}

/**
 * Check if there's a high-impact event within the next N minutes for a given pair
 */
export function hasUpcomingHighImpact(pair: string, withinMinutes: number = 30): { hasEvent: boolean; event?: EconomicEvent } {
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinMinutes * 60 * 1000);

  const events = generateEventsForRange(now, cutoff);
  const highImpact = events.find(e => e.impact === "high" && e.affectedPairs.includes(pair));

  return highImpact ? { hasEvent: true, event: highImpact } : { hasEvent: false };
}
