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
