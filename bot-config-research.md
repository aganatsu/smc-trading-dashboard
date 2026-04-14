# Trading Bot Configuration Research

## Sources Researched
- PineConnector EA (MetaTrader bridge) — full settings list
- Cryptohopper — General, Buy, Sell baseconfig settings
- SmartT — EA settings guide (MT4/MT5)
- 3Commas — DCA bot settings
- cTrader — Automate bot parameters
- SMC/ICT specific: Order Block, FVG, BOS detection parameters

---

## Category 1: STRATEGY / SIGNAL SETTINGS
What setups trigger a trade entry:

| Parameter | Description | Example Values |
|-----------|-------------|----------------|
| Strategy type | Which SMC setups to look for | BOS, CHoCH, OB, FVG, Liquidity Sweep |
| Minimum confluence score | How many confirmations needed before entry | 2/5, 3/5, 5/5 |
| Signal source | Where signals come from | Internal analysis, TradingView alerts, manual |
| Allowed setups toggle | Enable/disable individual setup types | OB: ON, FVG: ON, BOS: OFF |
| Timeframe for analysis | Which chart timeframes to scan | 1H, 4H, Daily (multi-TF) |
| Higher TF bias required | Must align with higher timeframe trend | ON/OFF |
| Order block lookback | How many candles back to search for OBs | 10, 20, 50 candles |
| FVG minimum size | Minimum gap size in pips to qualify | 5 pips, 10 pips |
| Structure break confirmation | Require candle close beyond level | ON/OFF |

## Category 2: RISK MANAGEMENT
How much capital to risk per trade:

| Parameter | Description | Example Values |
|-----------|-------------|----------------|
| Risk per trade % | % of balance risked per trade | 0.5%, 1%, 2% |
| Max risk per day % | Daily loss limit as % of balance | 3%, 5% |
| Max drawdown % | Stop bot if drawdown exceeds | 10%, 15%, 20% |
| Position sizing method | How lot size is calculated | Fixed lots, % risk, Kelly criterion |
| Max open positions | Total simultaneous positions | 1, 3, 5, 10 |
| Max positions per symbol | Per-instrument position limit | 1, 2, 3 |
| Max portfolio heat % | Total exposure as % of balance | 5%, 10%, 15% |
| Risk:Reward minimum | Only take trades with min R:R | 1:1.5, 1:2, 1:3 |
| Account protection: daily profit target | Stop after hitting daily profit | $500, 2% |
| Account protection: daily loss limit | Stop after hitting daily loss | $300, 3% |
| Cumulative profit target | Stop after total profit reached | $5000, 50% |
| Cumulative loss limit | Stop after total loss reached | $2000, 20% |

## Category 3: ENTRY RULES
How and when to enter trades:

| Parameter | Description | Example Values |
|-----------|-------------|----------------|
| Order type | Market or pending | Market, Limit, Stop |
| Entry refinement | Enter on lower TF confirmation | ON/OFF, which TF |
| Trailing entry | Trail price before entering | ON/OFF, trail distance |
| Max slippage | Maximum allowed slippage | 1 pip, 3 pips |
| Pyramiding | Allow adding to winning positions | ON/OFF, max adds |
| Close on reverse signal | Close position if opposite signal | ON/OFF |
| Cooldown period | Wait time after trade before next | 5 min, 30 min, 1 hour |
| Only trade positive momentum | Only enter if pair trending up | ON/OFF |

## Category 4: EXIT RULES
How and when to exit trades:

| Parameter | Description | Example Values |
|-----------|-------------|----------------|
| Take profit method | Fixed pips, R:R ratio, structure | Fixed, R:R, next level |
| Stop loss method | Fixed pips, ATR-based, structure | Fixed, ATR(14)*1.5, below OB |
| Trailing stop | Move SL to lock in profits | ON/OFF, trail distance |
| Trailing stop activation | When to start trailing | After +1R, after breakeven |
| Partial take profit | Close portion at first target | 50% at 1R, 50% at 2R |
| Break-even stop | Move SL to entry after X profit | ON/OFF, trigger distance |
| Time-based exit | Close after max hold time | 4 hours, 24 hours, never |
| End-of-session close | Close all at session end | ON/OFF |

## Category 5: INSTRUMENT FILTER
Which pairs/instruments to trade:

| Parameter | Description | Example Values |
|-----------|-------------|----------------|
| Allowed instruments | Whitelist of tradeable pairs | EURUSD, GBPUSD, XAUUSD |
| Instrument enable/disable | Toggle each pair on/off | Per-pair toggles |
| Spread filter | Skip if spread exceeds max | Max 2 pips, 3 pips |
| Volatility filter | Only trade if ATR in range | Min ATR 10, Max ATR 50 |
| Correlation filter | Avoid correlated positions | ON/OFF, max correlation 0.7 |

## Category 6: SESSION / TIME FILTER
When the bot is allowed to trade:

| Parameter | Description | Example Values |
|-----------|-------------|----------------|
| Trading sessions | Which sessions are active | London, New York, Asian, Sydney |
| Session times | Custom start/end times | London: 08:00-16:00 UTC |
| Active hours | Bot only trades during these hours | 08:00-20:00 |
| Days of week | Which days to trade | Mon-Fri, exclude Friday PM |
| News filter | Pause before/after high-impact news | ON/OFF, pause 30 min before/after |
| Holiday filter | Don't trade on major holidays | ON/OFF |

## Category 7: NOTIFICATIONS
How the bot communicates:

| Parameter | Description | Example Values |
|-----------|-------------|----------------|
| Notify on trade | Alert when trade opened/closed | ON/OFF |
| Notify on signal | Alert when signal detected | ON/OFF |
| Notify on error | Alert on execution errors | ON/OFF |
| Notify on daily summary | Daily P&L report | ON/OFF |
| Notification channel | Where to send alerts | In-app, Telegram, Email |

## Category 8: ADVANCED
Power-user settings:

| Parameter | Description | Example Values |
|-----------|-------------|----------------|
| Magic number | Unique ID for this bot instance | 12345 |
| Symbol prefix/suffix | Broker-specific symbol naming | Prefix: "m.", Suffix: ".pro" |
| Auto-restart on error | Restart bot after crash | ON/OFF |
| Backtest mode | Run on historical data | ON/OFF |
| Paper trading toggle | Simulated vs live execution | Paper/Live |
| Starting balance | Initial paper trading balance | $10,000, $50,000 |
| Leverage | Account leverage setting | 1:30, 1:100, 1:500 |

---

## SMC/ICT Specific Parameters (unique to our bot)

These are the parameters that make this bot specifically an SMC/ICT bot:

1. **Order Block Detection**
   - OB lookback period (candles)
   - OB minimum body-to-wick ratio
   - OB must be at swing point (ON/OFF)
   - OB invalidation: price closes through OB (ON/OFF)
   - Mitigation type: touch, 50% penetration, full close through

2. **Fair Value Gap Detection**
   - FVG minimum size (pips)
   - FVG must be in premium/discount zone (ON/OFF)
   - FVG fill percentage to invalidate (50%, 75%, 100%)
   - Only trade unfilled FVGs (ON/OFF)

3. **Market Structure**
   - BOS confirmation: candle close or wick (close/wick)
   - CHoCH as reversal signal (ON/OFF)
   - Structure lookback period
   - Require higher TF structure alignment (ON/OFF)

4. **Liquidity**
   - Liquidity sweep required before entry (ON/OFF)
   - Equal highs/lows detection sensitivity
   - Liquidity pool minimum touches (2, 3, 4)

5. **Premium/Discount Zone**
   - Only buy in discount zone (below 50% of range)
   - Only sell in premium zone (above 50% of range)
   - Zone calculation method: Fibonacci, swing range

6. **Multi-Timeframe Alignment**
   - Higher TF for bias: Daily, 4H
   - Entry TF: 15m, 5m, 1m
   - Require all TFs aligned (ON/OFF)
   - Minimum TFs aligned: 2/3, 3/3
