# ICT/SMC Concepts Research for Implementation

## 1. Judas Swing Detection
**What it is:** A false move at session open designed to trap retail traders before the real move.
**When it forms:** Between NY midnight (00:00) and 05:00 AM NY time, especially after London open (03:00 AM NY).
**Bullish Judas:** Price drops below NY midnight open, sweeps liquidity, then reverses up.
**Bearish Judas:** Price rises above NY midnight open, sweeps liquidity, then reverses down.

**Algorithm to detect:**
1. Record NY midnight open price (00:00 NY time)
2. Track price movement from midnight to 05:00 AM NY
3. If price moves BELOW open by X pips then reverses ABOVE open → Bullish Judas detected
4. If price moves ABOVE open by X pips then reverses BELOW open → Bearish Judas detected
5. Confirmation: Look for market structure shift (BOS/CHoCH) after the sweep
6. Entry: On FVG or OB retracement after the reversal

## 2. PD/PW (Previous Day / Previous Week) Levels
**What it is:** Key reference levels from prior timeframes that act as liquidity targets and support/resistance.
**Levels to track:**
- PDH (Previous Day High), PDL (Previous Day Low), PDO (Previous Day Open), PDC (Previous Day Close)
- PWH (Previous Week High), PWL (Previous Week Low), PWO (Previous Week Open), PWC (Previous Week Close)
- PMH (Previous Month High), PML (Previous Month Low) — optional

**Algorithm:**
1. At start of each new day (NY midnight), store yesterday's OHLC
2. At start of each new week (Sunday open), store last week's OHLC
3. Draw horizontal lines on chart at these levels
4. Use as liquidity targets: price tends to sweep PDH/PDL before reversing
5. Bias: If price is above PDH → bullish continuation likely; below PDL → bearish

## 3. Session Map / Kill Zones
**ICT Kill Zone Times (NY Time):**
- Asian Kill Zone: 20:00 - 00:00 (previous day evening)
- London Kill Zone: 02:00 - 05:00
- New York Kill Zone: 07:00 - 10:00
- London Close Kill Zone: 10:00 - 12:00

**Implementation:**
1. Draw colored session boxes on chart showing price range during each session
2. Track session high/low/open/close
3. Highlight current active kill zone
4. Session statistics: average range, typical direction

## 4. Currency Strength Heat Map
**What it is:** Visual grid showing which individual currencies (USD, EUR, GBP, JPY, etc.) are strongest/weakest.
**Calculation method:**
1. Take 8 major currencies: USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD
2. For each currency, calculate its average performance against all others over a period
3. Method: Sum percentage changes of all pairs containing that currency
   - For USD: average of EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD changes
   - Normalize: if currency is base, use positive change; if quote, use negative
4. Rank currencies from strongest to weakest
5. Color code: dark green (strongest) → red (weakest)

**Display:** 8x8 grid where rows and columns are currencies, cells show pair performance color-coded.

## 5. Correlation Matrix
**What it is:** Shows how currency pairs move relative to each other.
**Calculation:**
1. Pearson correlation coefficient between closing prices of two pairs over N periods
2. r = Σ((x-x̄)(y-ȳ)) / √(Σ(x-x̄)² × Σ(y-ȳ)²)
3. Range: -1 (perfect inverse) to +1 (perfect positive)
4. Known correlations: EUR/USD and GBP/USD (positive ~0.85), EUR/USD and USD/CHF (negative ~-0.95)

**Display:** Matrix grid with color coding: green (positive), red (negative), intensity = strength.
**Trading use:** Avoid doubling risk on correlated pairs; use divergence as signal.

## 6. Premium/Discount Zones (PD Arrays)
**What it is:** Divides any price range into premium (expensive, above 50%) and discount (cheap, below 50%).
**Calculation:**
1. Take a swing high and swing low
2. Equilibrium = (High + Low) / 2 (the 50% level)
3. Premium zone = above equilibrium (sell zone for smart money)
4. Discount zone = below equilibrium (buy zone for smart money)
5. Optimal Trade Entry (OTE) = 62-79% Fibonacci retracement zone

**Trading rule:**
- In bullish market: only buy in discount zone
- In bearish market: only sell in premium zone
- Equilibrium is the dividing line

## 7. Fundamentals / Economic Calendar
**What it is:** High-impact economic events that cause volatility spikes.
**Key events:** NFP, FOMC, CPI, GDP, Interest Rate Decisions, PMI
**Implementation:**
1. Fetch economic calendar data (Finnhub API or scrape ForexFactory)
2. Show upcoming events with impact level (high/medium/low)
3. Filter by currency relevance to traded pairs
4. Bot behavior: pause trading X minutes before/after high-impact events

## 8. Backtesting Engine
**What it is:** Test strategy against historical data to evaluate performance.
**Implementation:**
1. Fetch historical OHLC data for selected instrument and timeframe
2. Run SMC analysis on each bar sequentially
3. Apply bot config rules to determine entries/exits
4. Track: total trades, win rate, profit factor, max drawdown, equity curve
5. Generate report with statistics and trade list

## Bot Autonomous Decision Engine
**How it should work:**
1. Scan loop runs every N seconds for each enabled instrument
2. For each instrument:
   a. Fetch latest price data
   b. Run SMC analysis (structure, OBs, FVGs, liquidity)
   c. Check Judas Swing status
   d. Check PD/PW levels proximity
   e. Check session/kill zone
   f. Check currency strength alignment
   g. Calculate confluence score based on config weights
   h. If score >= minConfluenceScore AND all filters pass → generate signal
3. For each signal:
   a. Calculate position size based on risk config
   b. Determine SL/TP based on structure
   c. Build reasoning string explaining every factor
   d. Place trade with reasoning attached
4. For each open position:
   a. Monitor for SL/TP hits
   b. When closed, generate post-mortem explaining outcome

## Trade Reasoning Format
**Entry reasoning example:**
"LONG EUR/USD @ 1.0850 | Score: 8.2/10
- HTF Bias: Bullish (Daily BOS confirmed)
- Structure: 1H CHoCH at 1.0830
- Order Block: Bullish OB at 1.0840-1.0845 (mitigated)
- FVG: Bullish FVG at 1.0835-1.0848
- PD Zone: Price in discount (38% of swing range)
- Session: London Kill Zone active
- PD Levels: Targeting PDH at 1.0920
- Judas: Bearish Judas completed, reversal confirmed
- Correlation: GBP/USD also bullish (confirming USD weakness)
- Fundamentals: No high-impact events for 4 hours"

**Exit post-mortem (loss):**
"CLOSED EUR/USD LONG @ 1.0810 | P&L: -$40.00
- SL Hit: Price broke below OB invalidation level
- Reason: Unexpected USD strength from unscheduled Fed comments
- Structure: 1H structure shifted bearish after entry
- Lesson: Consider wider SL or wait for OB retest confirmation"

**Exit post-mortem (win):**
"CLOSED EUR/USD LONG @ 1.0920 | P&L: +$70.00
- TP Hit: Price reached PDH target as anticipated
- Setup played out: OB held, FVG filled, structure continued bullish
- R:R achieved: 1:1.75 (target was 1:2)"
