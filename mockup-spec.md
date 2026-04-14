# Mockup Specification — Pixel-Level Detail

## MOCKUP 1: Bot Command Center (mockup-bot-center.png)

### Top Bar (full width)
- Left: STOP button (red bg, white text, large), PAUSE button (orange bg, white text, large)
- Center: Status pill "● RUNNING" (green dot + green text), "PAPER MODE" pill (green outline)
- Center below: "Uptime: 4h 23m"
- Right: Stat counters in bordered boxes:
  - "Scans: 847" (cyan number)
  - "Signals: 23" (cyan number)
  - "Trades: 9" (cyan number)
  - "Win Rate: 67%" (green number)

### Main Content — Two Columns

#### LEFT COLUMN (~65% width): Positions & History
- Section title: "Positions & History"
- Tab bar: "Open Positions (9)" (active, underlined cyan), "Pending (2)", "Closed Today (4)", "All History"
- Table columns: Symbol, Direction, Entry Price, Current Price, P&L, Size (lots), SL, TP, Duration, Actions
- Row 1: EURUSD, Long ↑ (green), 1.0823, 1.0847, +$125.40 (green), 0.50, 1.0778, 1.0913, 2h 15m, ✕ button
- Row 2: GBPUSD, Short ↓ (red), 1.2654, 1.2631, +$57.50 (green), 0.30, 1.2704, 1.2554, 1h 42m, ✕ button
- Row 3: XAUUSD, Long ↑ (green), 2341.50, 2338.20, -$33.00 (red), 0.10, 2331.50, 2371.50, 45m, ✕ button
- Row 4: USDJPY, Long ↑ (green), 154.23, 154.67, +$88.00 (green), 0.50, 153.73, 155.73, 3h 10m, ✕ button

#### RIGHT COLUMN (~35% width): Account Summary + Strategy Performance

##### Account Summary card
- Title: "Account Summary"
- Rows (label: value, right-aligned):
  - Balance: $19,339.29
  - Equity: $19,587.19 (green, bold, larger)
  - Margin Used: $2,450.00
  - Free Margin: $17,137.19
  - Margin Level: 799%
  - Daily P&L: +$847.50 (green)
  - Drawdown: 3.2% (green)
- Small equity sparkline chart at bottom of card

##### Strategy Performance card
- Title: "Strategy Performance"
- Active strategy: "SMC Default" with green dot
- Win Rate: 67.3% with cyan progress bar
- Avg R:R: 1:2.4
- Profit Factor: 1.89
- Expectancy: +$42.30/trade
- Max Drawdown: 8.7%

### Bottom Section: Live Log (full width)
- Section title: "Live Log"
- Monospace font, color-coded entries:
  - 10:45:23 ● (green dot) "Bot started with all modules active" (green text)
  - 10:45:25 ⚡ (yellow) "Signal: BUY EURUSD (score: 7.5/10)" (yellow text)
  - 10:45:26 ✓ (green) "Trade opened: EURUSD LONG 0.50 lots @ 1.0823" (green text)
  - 10:47:12 ● (gray) "Scanning GBPUSD..." (gray text)
  - 10:47:15 ⚡ (yellow) "Signal: SELL GBPUSD (score: 6.8/10)" (yellow text)
  - 10:48:00 ✕ (red) "NZDCAD: ICT confluence 1.5 < min 2 - skipping" (gray text)

### Bottom Status Bar
- Left: "Paper Mode" | "Bot Running" (green) | "9 positions" | "$19,587 equity"
- Right: "Latency: 15ms" | "Memory: 4.2GB"

---

## MOCKUP 2: Bot Trades Chart (mockup-bot-trades-chart.png)

### Top Bar
- Left: "● RUNNING" pill (green bg), "PAPER" pill (dark bg)
- Center: "‖ PAUSE" button, "■ STOP" button (red bg)
- Right: Balance $19,339.29 | Equity $20,145.80 (green) | Unrealized +$806.51 (green)

### Left Sidebar Icons (thin, ~30px)
- Dashboard grid, Chart bars, Chart line, Bot (robot, active/cyan), Settings gear, Help circle

### Main Chart Area
- Header: "🥇 XAUUSD Gold · 4H" with green dot, "D2,341.50 H2,357.60 C2,358.20 (+8.82%)"
- Dropdown: "▾ 4" (timeframe selector)
- Full candlestick chart with:
  - Green/red candles
  - Trade entry annotations: "BUY 0.50 @ 2,341.50" with up arrow (green)
  - Trade exit annotations: "SELL 0.30 @ 2,358.20" with down arrow (red)
  - SL lines: "SL: 2,328.00" (red dashed), "SL: 2,368.00" (red dashed)
  - TP lines: "TP: 2,365.00" (green dashed), "TP: 2,335.00" (green dashed)
  - Shaded risk zones (red translucent below entry for longs)
  - Shaded reward zones (green translucent above entry for longs)
  - P&L labels on chart: "+$806.51" (green bg), "-$142.30" (red bg)
- TradingView logo bottom-left

### Bottom Left: Positions table (collapsible with — button)
- Columns: Symbol, Direction, Size, Entry, Current, P&L, SL, TP, Duration
- XAUUSD BUY 0.50 2,341.50 2,357.62 +$806.51 2,328.00 2,365.00 4h 15m
- EURUSD SELL 0.20 1.08500 1.08711 -$42.30 1.08900 1.08100 2h 30m
- GBPJPY BUY 0.30 192.500 193.117 +$185.20 191.800 194.000 1h 45m

### Bottom Right: Terminal Log (collapsible with — button)
- Color-coded log entries with categories:
  - [10:45:22] SIGNAL: (yellow) XAUUSD BUY Signal Detected (RSI Oversold, MACD Crossover)
  - [10:45:25] TRADE: (green) Executing BUY 0.50 XAUUSD @ 2,341.50. Order ID: #98765432
  - [11:15:00] INFO: (cyan) Market Analysis Update - Volatility Increasing
  - [12:30:10] WARNING: (red) EURUSD Position Approaching Stop Loss
  - [13:05:45] SIGNAL: (yellow) GBPJPY BUY Signal Confirmed (Moving Average Breakout)
  - [13:05:48] TRADE: (green) Executing BUY 0.30 GBPJPY @ 192.500. Order ID: #98765433
  - [14:50:30] INFO: (cyan) Position XAUUSD P&L +$806.51. Holding.
  - [15:10:15] TRADE: (green) Executing SELL 0.20 EURUSD @ 1.08500. Order ID: #98765434

### Bottom Status Bar
- PAPER | Running (green) | Yahoo Finance | Latency: 45ms | Balance: $19,339.29

---

## MOCKUP 3: Dashboard Overview (mockup-dashboard-overview.png)

### Header
- Left: Hamburger menu icon
- "SMC Trading Dashboard" title
- "● BOT RUNNING" green pill badge
- Right: "10:45 AM" | User avatar circle

### KPI Cards Row (4 cards)
1. Balance: $19,339.29 (large), "+$9,339.29 (+93.4%) ↗" (green subtext)
2. Today P&L: +$847.50 (green, large), "4 trades" (gray subtext)
3. Open Positions: 9 (large), "$2,450 exposure" (gray subtext)
4. Win Rate: 67.3% (green, large), "142W / 69L" (gray subtext)

### Middle Row — Two Columns

#### LEFT: Equity Curve (~60% width)
- Title: "Equity Curve" with "3 months" right-aligned
- Area chart with cyan fill gradient, line from ~$10,000 to ~$19,339
- X-axis: Jan, Feb, Mar, Apr, May, Jun, Jul
- Y-axis: $10,000 to $19,339.29

#### RIGHT: Active Positions (~40% width)
- Title: "Active Positions"
- Compact table: Symbol, ↑/↓ arrow, Entry Price, Current P&L, Lot Size
- Multiple EURUSD rows with green/red P&L values
- Scrollable

### Bottom Row — Two Columns

#### LEFT: Portfolio Heat (~35% width)
- Title: "Portfolio Heat"
- Donut chart with center text "62%" (large)
- Legend:
  - USD exposure 62% (orange)
  - EUR exposure 33% (blue)
  - GBP exposure 27% (purple)
  - other currencies 8% (gray)

#### RIGHT: Bot Activity (~65% width)
- Title: "Bot Activity" with "Last 24 hours" right-aligned
- Scatter/timeline chart with colored dots:
  - Small gray dots (scans)
  - Cyan triangles (signals)
  - Red triangles (rejected)
  - Purple diamonds (trades)
- Bottom stats: "Scans: 847 | Signals: 23 | Trades: 9 | Rejected: 14"

### Bottom Status Bar
- Left: "Paper Mode" pill | "✓ Connected to Yahoo Finance"
- Right: "⚡ Latency: 12ms" | "Memory: 245MB"
