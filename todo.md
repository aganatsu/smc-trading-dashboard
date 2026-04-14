# SMC Trading Dashboard - Full Integration TODO

## Completed (Previous Sessions)
- [x] Yahoo Finance market data integration (no API key needed)
- [x] TradingView Advanced Chart widget
- [x] SMC analysis engine (structure, levels, OBs, FVGs, liquidity, fib, checklist)
- [x] Trade Journal CRUD with database
- [x] Broker connection management (OANDA + MetaApi/HFM)
- [x] Broker trade execution (place order, close position)
- [x] Screenshot upload for journal entries
- [x] Equity curve component (Recharts)
- [x] CandlestickChart component (lightweight-charts v5 with SMC overlays)
- [x] Owner fallback auth (single-user mode, no login required)
- [x] Risk management panel with position sizing
- [x] Alert generator panel

## Phase 1: AppShell — 5-View Architecture
- [x] Create AppShell.tsx with left icon rail (48px) + bottom status bar
- [x] 5 views: Dashboard, Chart, Bot, Journal, Settings
- [x] Keyboard shortcuts: 1-5 for views, / for search, Esc to close
- [x] Lazy-mounted panels (display:none/block) to prevent tab-switching data loss
- [x] Compact sidebar filter input with / keyboard shortcut
- [x] macOS traffic light padding (28px top)
- [x] Update App.tsx to use AppShell as the single route

## Phase 2: Paper Trading Engine (Server)
- [x] Create server/paperTrading.ts — in-memory paper trading engine
- [x] Paper account state: balance, equity, positions, trade history
- [x] Place paper trade (market order with SL/TP)
- [x] Close paper position (calculate P&L)
- [x] Auto-close on SL/TP hit (price monitoring via Yahoo quotes)
- [x] Portfolio heat calculation (% of account at risk)
- [x] Add tRPC routes: paper.status, paper.start, paper.pause, paper.stop, paper.reset, paper.placeOrder, paper.closePosition
- [x] Auto-log closed paper trades to journal (trades table)

## Phase 3: Dashboard View
- [x] KPI cards: Balance, Equity, Open P&L, Win Rate, Active Positions
- [x] Equity curve chart (from journal closed trades)
- [x] Active positions table with live P&L
- [x] Portfolio heat gauge (circular)
- [x] Quick stats: Total Trades, Wins, Losses, Total P&L
- [x] Data refreshes on interval (polling)

## Phase 4: Chart View
- [x] TradingView chart with built-in symbol search
- [x] Right-side accordion analysis panels
- [x] Panels: Market Bias, Market Structure, Key Levels & Zones, SMC Analysis, Multi-Timeframe, Entry Checklist, Risk Calculator
- [x] Collapsible right panel (C key shortcut for full-screen chart)
- [x] Timeframe buttons (W/D/4H/1H/15m/5m)
- [x] Symbol sync listener (sidebar → chart)

## Phase 5: Bot View — Trade Visualization
- [x] Paper trading controls: Start/Pause/Stop/Reset, mode badge (PAPER)
- [x] Account stats bar: Balance, Equity, Unrealized P&L
- [x] Lightweight Charts candlestick chart with trade markers (TradeChart component)
- [x] Entry/exit price lines on chart
- [x] SL/TP dashed lines on chart
- [x] Positions list: Symbol, Direction, Size, Entry, Current, P&L, Duration, SL, TP, Close button
- [x] Live terminal log (timestamped, color-coded)
- [x] Symbol selector for chart (matches paper trading instruments)
- [x] Place Order form: symbol dropdown, BUY/SELL toggle, size/SL/TP inputs
- [x] Symbol sync from sidebar

## Phase 6: Journal View
- [x] Trade journal table with all fields (Date, Symbol, Dir, Status, Entry, Exit, SL, TP, Size, P&L, R:R, Setup, TF)
- [x] Performance summary cards (Total Trades, Win Rate, Wins/Losses, Total P&L, Profit Factor, Avg R:R)
- [x] Sub-tabs: Trades, Performance (equity curve + daily P&L), Calculator
- [x] Calculator tab: Position Size Calculator + Pip Value Calculator
- [x] Auto-populated from paper trading closed positions
- [x] Manual trade entry still supported (via existing tRPC routes)
- [x] Filter by symbol, direction, date range
- [x] Trade detail side panel on row click

## Phase 7: Settings View
- [x] Settings sidebar with sub-pages
- [x] Broker Connection: MetaApi/OANDA setup form, Test button, supported instruments grid
- [x] Risk Management: Max risk per trade, max portfolio heat, max positions (localStorage, persisted)
- [x] Preferences: Default instrument, default timeframe, auto-refresh toggle, refresh interval, theme (localStorage, persisted)
- [x] Keyboard Shortcuts: 8 shortcuts documented (1-5 views, C, /, Esc)
- [x] About: Version info, credits

## Phase 8: Integration & Testing
- [x] Verify paper trade → journal auto-logging pipeline (code verified)
- [x] Verify Dashboard KPIs update from paper trading data (code verified)
- [x] Verify Bot View chart shows trade markers from paper positions (code verified)
- [x] Write vitest tests for paper trading engine (22 tests)
- [x] Write vitest integration tests for paper trading tRPC routes (14 tests)
- [x] Run full test suite — 75 tests pass across 6 files
- [x] Visual verification in browser — all 5 views render correctly
- [x] TypeScript: 0 errors

## Bug Fixes
- [x] Fix tRPC query error: limit parameter exceeds maximum of 100 on Dashboard page (JournalView was sending limit:200)

## Phase 9: Bot View Rebuild (match mockup)
- [x] Remove broken Lightweight Charts from Bot View
- [x] Top bar: STOP (red) + PAUSE (orange) buttons, RUNNING/PAPER status pills, Uptime counter
- [x] Top bar right: Stat counters — Scans, Signals, Trades, Win Rate in bordered boxes
- [x] Left column: Positions & History with tabs (Open Positions, Closed Today, All History)
- [x] Positions table: Symbol, Direction (colored arrows), Entry Price, Current Price, P&L, Size, SL, TP, Duration, Signal, Close button
- [x] Right column top: Account Summary card (Balance, Equity bold green, Margin Used, Free Margin, Margin Level, Daily P&L, Drawdown, equity sparkline)
- [x] Right column bottom: Strategy Performance card (Active strategy name + dot, Win Rate with progress bar, Avg R:R, Profit Factor, Expectancy, Max Drawdown)
- [x] Bottom: Live Log with color-coded categories (green=bot events, yellow=signals with score, green=trades with details, gray=scanning, red=warnings/rejections)
- [x] Status bar: Paper Mode | Bot Running (green) | positions count | equity | Latency | Memory

## Phase 10: Dashboard View Rebuild (match mockup)
- [x] Header: "SMC Trading Dashboard" title, BOT RUNNING green pill, time
- [x] KPI cards with subtexts: Balance (+gain%), Today P&L (trade count), Open Positions (exposure $), Win Rate (W/L counts)
- [x] Equity Curve: area chart with cyan gradient fill, 3-month timeframe label
- [x] Active Positions: compact table with Symbol, direction arrow, Entry Price, Current P&L, Lot Size (scrollable)
- [x] Portfolio Heat: donut chart with currency breakdown (USD/EUR/GBP/other percentages), center percentage
- [x] Bot Activity: scatter timeline (last 24h) with colored dots for scans/signals/trades/rejected, bottom stat counts
- [x] Status bar: Paper Mode pill, Connected to Yahoo Finance, Latency, Memory

## Phase 11: Paper Trading Engine Enhancements
- [x] Add signal reason/score to trade records (why trade was taken)
- [x] Track margin used, free margin, margin level
- [x] Track daily P&L, drawdown
- [x] Track scan count, signal count, rejected count
- [x] Track strategy name and performance stats (win rate, avg R:R, profit factor, expectancy, max drawdown)
- [x] Track uptime since engine started
- [ ] Support pending orders tab data (deferred — no pending order type in engine yet)
