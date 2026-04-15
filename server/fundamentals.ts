/**
 * Fundamentals & Economic Calendar Module — LIVE DATA
 *
 * Fetches real economic calendar data from ForexFactory/FairEconomy public feed.
 * Falls back to the built-in recurring schedule generator if the live feed is unavailable.
 *
 * Live data includes: event title, country/currency, date/time, impact level,
 * forecast, previous, and actual values.
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
  | "government"
  | "other";

export interface EconomicEvent {
  id: string;
  name: string;
  country: string;        // ISO 2-letter: "US", "GB", "EU", "JP", "AU", "CA", "NZ", "CH"
  currency: string;       // "USD", "GBP", "EUR", "JPY", "AUD", "CAD", "NZD", "CHF"
  impact: ImpactLevel;
  category: EventCategory;
  description: string;
  affectedPairs: string[];
  scheduledTime: string;  // ISO string
  isRecurring: boolean;
  frequency: string;
  // Live data fields
  forecast?: string;
  previous?: string;
  actual?: string;
  isLive: boolean;        // true = from live feed, false = from static schedule
}

export interface FundamentalsData {
  upcomingEvents: EconomicEvent[];
  todayEvents: EconomicEvent[];
  thisWeekEvents: EconomicEvent[];
  highImpactCount: number;
  mediumImpactCount: number;
  lowImpactCount: number;
  currencyExposure: Record<string, { high: number; medium: number; low: number }>;
  dataSource: "live" | "schedule";
  lastUpdated: string;
}

// ─── Currency → Country & Pair Mapping ──────────────────────────────

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  USD: "US", EUR: "EU", GBP: "GB", JPY: "JP",
  AUD: "AU", CAD: "CA", NZD: "NZ", CHF: "CH",
  CNY: "CN",
};

const CURRENCY_PAIRS: Record<string, string[]> = {
  USD: ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CAD", "AUD/USD", "NZD/USD", "USD/CHF", "XAU/USD"],
  EUR: ["EUR/USD", "EUR/GBP", "EUR/JPY", "EUR/CHF", "EUR/AUD", "EUR/CAD"],
  GBP: ["GBP/USD", "EUR/GBP", "GBP/JPY", "GBP/AUD", "GBP/CAD"],
  JPY: ["USD/JPY", "EUR/JPY", "GBP/JPY", "AUD/JPY", "CAD/JPY"],
  AUD: ["AUD/USD", "AUD/JPY", "EUR/AUD", "GBP/AUD", "AUD/CAD"],
  CAD: ["USD/CAD", "CAD/JPY", "EUR/CAD", "GBP/CAD", "AUD/CAD"],
  NZD: ["NZD/USD", "NZD/JPY", "EUR/NZD", "GBP/NZD", "AUD/NZD"],
  CHF: ["USD/CHF", "EUR/CHF", "GBP/CHF", "CHF/JPY"],
  CNY: ["USD/CNH"],
};

// ─── Event Category Detection ───────────────────────────────────────

function detectCategory(title: string): EventCategory {
  const t = title.toLowerCase();
  if (t.includes("employment") || t.includes("payroll") || t.includes("nfp") || t.includes("jobless") || t.includes("unemployment") || t.includes("claimant") || t.includes("jobs") || t.includes("labor") || t.includes("labour")) return "employment";
  if (t.includes("cpi") || t.includes("inflation") || t.includes("ppi") || t.includes("price index") || t.includes("pce")) return "inflation";
  if (t.includes("rate decision") || t.includes("fomc") || t.includes("boe") || t.includes("ecb") || t.includes("boj") || t.includes("rba") || t.includes("boc") || t.includes("rbnz") || t.includes("snb") || t.includes("monetary policy") || t.includes("fed") || t.includes("central bank")) return "central_bank";
  if (t.includes("gdp") || t.includes("gross domestic")) return "gdp";
  if (t.includes("trade balance") || t.includes("current account") || t.includes("import") || t.includes("export")) return "trade";
  if (t.includes("housing") || t.includes("building permit") || t.includes("home") || t.includes("construction")) return "housing";
  if (t.includes("pmi") || t.includes("manufacturing") || t.includes("industrial") || t.includes("factory") || t.includes("ism")) return "manufacturing";
  if (t.includes("retail") || t.includes("consumer") || t.includes("confidence") || t.includes("sentiment") || t.includes("spending")) return "consumer";
  if (t.includes("budget") || t.includes("government") || t.includes("fiscal") || t.includes("treasury")) return "government";
  return "other";
}

function generateDescription(title: string, category: EventCategory): string {
  const descriptions: Record<string, string> = {
    employment: "Labor market indicator that measures changes in employment conditions.",
    inflation: "Price stability indicator tracked closely by central banks for policy decisions.",
    central_bank: "Central bank policy decision or communication that can move markets significantly.",
    gdp: "Broad measure of economic output and growth.",
    trade: "International trade flow indicator affecting currency demand.",
    housing: "Real estate and construction sector health indicator.",
    manufacturing: "Industrial sector activity and business conditions gauge.",
    consumer: "Consumer behavior and confidence indicator reflecting economic sentiment.",
    government: "Government fiscal policy or budget-related release.",
    other: "Economic data release that may affect market conditions.",
  };
  return descriptions[category] || descriptions.other;
}

// ─── Live Data Cache ────────────────────────────────────────────────

interface CacheEntry {
  data: EconomicEvent[];
  fetchedAt: number;
}

let liveCache: CacheEntry | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ─── Fetch Live Data ────────────────────────────────────────────────

interface FFEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

async function fetchLiveCalendar(): Promise<EconomicEvent[]> {
  // Check cache
  if (liveCache && Date.now() - liveCache.fetchedAt < CACHE_TTL_MS) {
    return liveCache.data;
  }

  try {
    const url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "SMC-Trading-Dashboard/1.0" },
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const rawEvents: FFEvent[] = await response.json();

    const events: EconomicEvent[] = rawEvents.map((raw, idx) => {
      // Map ForexFactory currency codes to our format
      const currency = raw.country; // FF uses currency codes like "USD", "EUR"
      const country = CURRENCY_TO_COUNTRY[currency] || currency.substring(0, 2);
      const impact = mapImpact(raw.impact);
      const category = detectCategory(raw.title);
      const affectedPairs = CURRENCY_PAIRS[currency] || CURRENCY_PAIRS[currency.toUpperCase()] || [];

      return {
        id: `live_${idx}_${raw.date}`,
        name: raw.title,
        country,
        currency,
        impact,
        category,
        description: generateDescription(raw.title, category),
        affectedPairs,
        scheduledTime: new Date(raw.date).toISOString(),
        isRecurring: false,
        frequency: "live",
        forecast: raw.forecast || undefined,
        previous: raw.previous || undefined,
        actual: undefined, // FF doesn't always include actual in this feed
        isLive: true,
      };
    });

    // Sort by time
    events.sort(
      (a, b) =>
        new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
    );

    liveCache = { data: events, fetchedAt: Date.now() };
    return events;
  } catch (err) {
    console.warn("[Fundamentals] Live feed unavailable, using static schedule:", (err as Error).message);
    return [];
  }
}

function mapImpact(ffImpact: string): ImpactLevel {
  switch (ffImpact?.toLowerCase()) {
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
    case "holiday":
    default:
      return "low";
  }
}

// ─── Static Schedule Fallback ───────────────────────────────────────
// (Kept as fallback when live feed is unavailable)

interface EventTemplate {
  name: string;
  country: string;
  currency: string;
  impact: ImpactLevel;
  category: EventCategory;
  description: string;
  affectedPairs: string[];
  frequency: string;
  scheduleType: "fixed_day" | "nth_weekday" | "variable";
  dayOfMonth?: number;
  weekOfMonth?: number;
  dayOfWeek?: number;
  hour: number;
  minute: number;
}

const EVENT_TEMPLATES: EventTemplate[] = [
  {
    name: "Non-Farm Payrolls (NFP)",
    country: "US", currency: "USD", impact: "high", category: "employment",
    description: "Monthly change in employment excluding farm workers. The most impactful forex event.",
    affectedPairs: ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CAD", "AUD/USD", "NZD/USD", "XAU/USD"],
    frequency: "monthly", scheduleType: "nth_weekday", weekOfMonth: 1, dayOfWeek: 5, hour: 12, minute: 30,
  },
  {
    name: "US CPI (Consumer Price Index)",
    country: "US", currency: "USD", impact: "high", category: "inflation",
    description: "Measures changes in consumer prices. Key inflation gauge for Fed policy decisions.",
    affectedPairs: ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"],
    frequency: "monthly", scheduleType: "fixed_day", dayOfMonth: 13, hour: 12, minute: 30,
  },
  {
    name: "FOMC Interest Rate Decision",
    country: "US", currency: "USD", impact: "high", category: "central_bank",
    description: "Federal Reserve interest rate decision and monetary policy statement.",
    affectedPairs: ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CAD", "AUD/USD", "NZD/USD", "XAU/USD", "BTC/USD"],
    frequency: "8x_year", scheduleType: "variable", hour: 18, minute: 0,
  },
  {
    name: "US GDP (Gross Domestic Product)",
    country: "US", currency: "USD", impact: "high", category: "gdp",
    description: "Quarterly measure of economic output.",
    affectedPairs: ["EUR/USD", "GBP/USD", "USD/JPY"],
    frequency: "quarterly", scheduleType: "fixed_day", dayOfMonth: 28, hour: 12, minute: 30,
  },
  {
    name: "US Retail Sales",
    country: "US", currency: "USD", impact: "medium", category: "consumer",
    description: "Monthly change in total retail sales.",
    affectedPairs: ["EUR/USD", "GBP/USD", "USD/JPY"],
    frequency: "monthly", scheduleType: "fixed_day", dayOfMonth: 15, hour: 12, minute: 30,
  },
  {
    name: "US ISM Manufacturing PMI",
    country: "US", currency: "USD", impact: "medium", category: "manufacturing",
    description: "Manufacturing sector health. Above 50 = expansion.",
    affectedPairs: ["EUR/USD", "USD/JPY"],
    frequency: "monthly", scheduleType: "fixed_day", dayOfMonth: 1, hour: 14, minute: 0,
  },
  {
    name: "US Unemployment Claims",
    country: "US", currency: "USD", impact: "medium", category: "employment",
    description: "Weekly initial jobless claims.",
    affectedPairs: ["EUR/USD", "USD/JPY"],
    frequency: "weekly", scheduleType: "nth_weekday", weekOfMonth: 1, dayOfWeek: 4, hour: 12, minute: 30,
  },
  {
    name: "ECB Interest Rate Decision",
    country: "EU", currency: "EUR", impact: "high", category: "central_bank",
    description: "European Central Bank rate decision and press conference.",
    affectedPairs: ["EUR/USD", "EUR/GBP", "EUR/JPY"],
    frequency: "8x_year", scheduleType: "variable", hour: 12, minute: 15,
  },
  {
    name: "EU CPI (Harmonised)",
    country: "EU", currency: "EUR", impact: "high", category: "inflation",
    description: "Eurozone harmonised consumer price index.",
    affectedPairs: ["EUR/USD", "EUR/GBP"],
    frequency: "monthly", scheduleType: "fixed_day", dayOfMonth: 17, hour: 9, minute: 0,
  },
  {
    name: "BOE Interest Rate Decision",
    country: "GB", currency: "GBP", impact: "high", category: "central_bank",
    description: "Bank of England rate decision.",
    affectedPairs: ["GBP/USD", "EUR/GBP", "GBP/JPY"],
    frequency: "8x_year", scheduleType: "variable", hour: 12, minute: 0,
  },
  {
    name: "UK CPI",
    country: "GB", currency: "GBP", impact: "high", category: "inflation",
    description: "UK consumer price index.",
    affectedPairs: ["GBP/USD", "EUR/GBP", "GBP/JPY"],
    frequency: "monthly", scheduleType: "fixed_day", dayOfMonth: 16, hour: 7, minute: 0,
  },
  {
    name: "BOJ Interest Rate Decision",
    country: "JP", currency: "JPY", impact: "high", category: "central_bank",
    description: "Bank of Japan rate decision.",
    affectedPairs: ["USD/JPY", "GBP/JPY", "EUR/JPY"],
    frequency: "8x_year", scheduleType: "variable", hour: 3, minute: 0,
  },
  {
    name: "RBA Interest Rate Decision",
    country: "AU", currency: "AUD", impact: "high", category: "central_bank",
    description: "Reserve Bank of Australia rate decision.",
    affectedPairs: ["AUD/USD", "AUD/JPY"],
    frequency: "monthly", scheduleType: "nth_weekday", weekOfMonth: 1, dayOfWeek: 2, hour: 3, minute: 30,
  },
  {
    name: "BOC Interest Rate Decision",
    country: "CA", currency: "CAD", impact: "high", category: "central_bank",
    description: "Bank of Canada rate decision.",
    affectedPairs: ["USD/CAD"],
    frequency: "8x_year", scheduleType: "variable", hour: 13, minute: 45,
  },
  {
    name: "RBNZ Interest Rate Decision",
    country: "NZ", currency: "NZD", impact: "high", category: "central_bank",
    description: "Reserve Bank of New Zealand rate decision.",
    affectedPairs: ["NZD/USD"],
    frequency: "8x_year", scheduleType: "variable", hour: 1, minute: 0,
  },
  {
    name: "SNB Interest Rate Decision",
    country: "CH", currency: "CHF", impact: "high", category: "central_bank",
    description: "Swiss National Bank rate decision.",
    affectedPairs: ["USD/CHF", "EUR/CHF"],
    frequency: "quarterly", scheduleType: "variable", hour: 7, minute: 30,
  },
];

function getNthWeekdayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date {
  const firstDay = new Date(Date.UTC(year, month, 1));
  let firstOccurrence = firstDay.getUTCDay();
  let diff = dayOfWeek - firstOccurrence;
  if (diff < 0) diff += 7;
  const day = 1 + diff + (n - 1) * 7;
  return new Date(Date.UTC(year, month, day));
}

function generateEventsForRange(startDate: Date, endDate: Date): EconomicEvent[] {
  const events: EconomicEvent[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (const template of EVENT_TEMPLATES) {
    const currentDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

    while (currentDate <= end) {
      const year = currentDate.getUTCFullYear();
      const month = currentDate.getUTCMonth();
      let eventDate: Date | null = null;

      if (template.frequency === "weekly") {
        for (let week = 1; week <= 5; week++) {
          if (template.dayOfWeek !== undefined) {
            const weeklyDate = getNthWeekdayOfMonth(year, month, template.dayOfWeek, week);
            if (weeklyDate.getUTCMonth() === month) {
              const d = new Date(Date.UTC(year, month, weeklyDate.getUTCDate(), template.hour, template.minute));
              if (d >= start && d <= end) {
                events.push(createStaticEvent(template, d));
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
        while (eventDate.getUTCDay() === 0 || eventDate.getUTCDay() === 6) {
          eventDate.setUTCDate(eventDate.getUTCDate() + 1);
        }
      } else if (template.scheduleType === "nth_weekday" && template.weekOfMonth !== undefined && template.dayOfWeek !== undefined) {
        eventDate = getNthWeekdayOfMonth(year, month, template.dayOfWeek, template.weekOfMonth);
        eventDate.setUTCHours(template.hour, template.minute, 0, 0);
      } else if (template.scheduleType === "variable") {
        if (template.frequency === "8x_year") {
          const meetingMonths = [0, 1, 2, 4, 5, 6, 8, 10, 11];
          if (meetingMonths.includes(month)) {
            const day = month % 2 === 0 ? 15 : 20;
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
        events.push(createStaticEvent(template, eventDate));
      }

      if (template.frequency === "quarterly") {
        currentDate.setUTCMonth(currentDate.getUTCMonth() + 3);
      } else {
        currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
      }
    }
  }

  events.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
  return events;
}

function createStaticEvent(template: EventTemplate, date: Date): EconomicEvent {
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
    isLive: false,
  };
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Get fundamentals data — tries live feed first, falls back to static schedule
 */
export async function getFundamentalsData(): Promise<FundamentalsData> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
  const weekEnd = new Date(todayStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  // Try live data first
  const liveEvents = await fetchLiveCalendar();
  let dataSource: "live" | "schedule" = "schedule";
  let allEvents: EconomicEvent[];

  if (liveEvents.length > 0) {
    dataSource = "live";
    allEvents = liveEvents;
  } else {
    // Fallback to static schedule
    const monthEnd = new Date(todayStart);
    monthEnd.setUTCDate(monthEnd.getUTCDate() + 30);
    allEvents = generateEventsForRange(todayStart, monthEnd);
  }

  const todayEvents = allEvents.filter((e) => {
    const t = new Date(e.scheduledTime);
    return t >= todayStart && t <= todayEnd;
  });

  const thisWeekEvents = allEvents.filter((e) => {
    const t = new Date(e.scheduledTime);
    return t >= todayStart && t <= weekEnd;
  });

  const upcomingEvents = allEvents.filter((e) => {
    return new Date(e.scheduledTime) >= now;
  });

  const highImpactCount = upcomingEvents.filter((e) => e.impact === "high").length;
  const mediumImpactCount = upcomingEvents.filter((e) => e.impact === "medium").length;
  const lowImpactCount = upcomingEvents.filter((e) => e.impact === "low").length;

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
    dataSource,
    lastUpdated: now.toISOString(),
  };
}

/**
 * Get events that affect a specific currency pair
 */
export async function getEventsForPair(pair: string): Promise<EconomicEvent[]> {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  // Try live data first
  const liveEvents = await fetchLiveCalendar();

  if (liveEvents.length > 0) {
    // Extract currencies from pair (e.g., "EUR/USD" → ["EUR", "USD"])
    const pairCurrencies: string[] = pair.replace("/", "").match(/.{3}/g) || [];
    return liveEvents.filter((e) => {
      const eventTime = new Date(e.scheduledTime);
      if (eventTime < now || eventTime > weekEnd) return false;
      // Match if event currency is one of the pair's currencies
      return pairCurrencies.includes(e.currency) || e.affectedPairs.includes(pair);
    });
  }

  // Fallback
  const allEvents = generateEventsForRange(now, weekEnd);
  return allEvents.filter((e) => e.affectedPairs.includes(pair));
}

/**
 * Check if there's a high-impact event within the next N minutes for a given pair
 */
export async function hasUpcomingHighImpact(
  pair: string,
  withinMinutes: number = 30
): Promise<{ hasEvent: boolean; event?: EconomicEvent }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinMinutes * 60 * 1000);

  // Try live data first
  const liveEvents = await fetchLiveCalendar();

  if (liveEvents.length > 0) {
    const pairCurrencies: string[] = pair.replace("/", "").match(/.{3}/g) || [];
    const highImpact = liveEvents.find((e) => {
      const t = new Date(e.scheduledTime);
      if (t < now || t > cutoff) return false;
      if (e.impact !== "high") return false;
      return pairCurrencies.includes(e.currency) || e.affectedPairs.includes(pair);
    });
    return highImpact ? { hasEvent: true, event: highImpact } : { hasEvent: false };
  }

  // Fallback
  const events = generateEventsForRange(now, cutoff);
  const highImpact = events.find(
    (e) => e.impact === "high" && e.affectedPairs.includes(pair)
  );
  return highImpact ? { hasEvent: true, event: highImpact } : { hasEvent: false };
}
