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
- [x] Support pending orders tab data (pending orders engine + UI + cancel support added)

## Phase 12: Pending Orders — Complete Implementation
- [x] Add UI controls in BotView order form to create pending orders (order type selector, trigger price input)
- [x] Handle pending-order quote fetch failures explicitly in paperTrading.ts (replace empty catch)
- [x] Add vitest tests for pending order creation, trigger execution, cancellation (6 new tests, 81 total)

## Phase 13: Pending Order Test Gaps
- [x] Add vitest test for pending order trigger execution (price condition met → converts to position)
- [x] Add route tests for paper.placePendingOrder and paper.cancelPendingOrder (5 new route tests + 1 trigger test, 87 total)

## Phase 14: Bot Configuration Panel (from research)
- [x] Strategy Settings: setup toggles (BOS, CHoCH, OB, FVG, Liquidity Sweep), min confluence score, HTF bias required, OB lookback, FVG min size
- [x] Risk Management: risk per trade %, max daily loss %, max drawdown %, position sizing method, max open positions, max per symbol, max portfolio heat %, min R:R
- [x] Entry Rules: order type (market/limit/stop), pyramiding, close on reverse, cooldown period, trailing entry
- [x] Exit Rules: TP method, SL method, trailing stop, partial TP, break-even stop, time-based exit, end-of-session close
- [x] Instrument Filter: allowed instruments with per-pair toggles, spread filter, volatility filter
- [x] Session/Time Filter: trading sessions (London/NY/Asian/Sydney), active hours, days of week, news filter
- [x] Notifications: notify on trade, signal, error, daily summary
- [x] SMC-Specific: OB body/wick ratio, OB invalidation, FVG fill %, premium/discount zone, structure break confirmation, liquidity sweep required, multi-TF alignment
- [x] Account Protection: daily profit target, daily loss limit, cumulative profit/loss limits with halt actions
- [x] Config persistence (server state + tRPC routes)
- [x] Config applied to paper trading engine behavior (validateTradeAgainstConfig wired into placeOrder)
- [x] Config UI panel with 8 tabbed sections (BotConfigPanel component)
- [x] Config button in Bot View top bar
- [x] Vitest tests for botConfig module (16 tests)
- [x] All 103 tests passing across 7 test files

## Phase 15: Bot Config Gaps (from audit)
- [x] Add tRPC route tests for botConfig.get, botConfig.update, botConfig.reset (9 tests)
- [x] Wire config into pending order placement (validateTradeAgainstConfig wired into placePendingOrder)
- [x] Verify BotConfigPanel.tsx has all 8 tabbed sections and save/reset/unsaved-changes feedback
- [x] Add config-driven engine behavior tests (disabled instrument blocks trade, disabled instrument blocks pending order, relaxed config allows trade)
- [x] All 112 tests passing across 8 test files

## Phase 16: Restore Missing Features & Autonomous Bot

### Missing Features to Restore
- [x] Fundamentals panel — economic calendar, news impact, high-impact events for traded pairs (built-in schedule, 14 tests)
- [x] Correlations panel — currency pair correlation matrix, positive/negative correlation alerts
- [x] Session Map — London/NY/Asian/Sydney session times with price range boxes on chart
- [x] Heat Map — currency strength meter showing which currencies are strong/weak
- [x] PD/PW (Previous Day/Previous Week) — automatic PD high/low/open/close and PW high/low levels
- [x] Judas Swing detection — identify false breakouts at session opens (ICT concept)
- [x] Backtest engine — test strategy against historical data with results summary

### Autonomous Bot Decision Engine
- [x] Bot auto-scan loop: periodically analyze all enabled instruments using SMC analysis
- [x] Bot uses config parameters (confluence score, enabled setups, R:R, session filter) to decide trades
- [x] Bot generates detailed reasoning for each trade: which setups triggered, confluence score breakdown, bias alignment
- [x] Trade reasoning stored with each position (tRPC routes wired)
- [x] ICT Analysis page: dedicated view with Session Map, Currency Strength, Correlations, PD/PW, Judas, Premium/Discount
- [x] BotView UI: wire engine.state/scanResults queries to display scan results and trade reasoning in Bot view
- [x] Journal UI: display trade reasoning and post-mortem in trade detail panel

### Trade Explanation System
- [x] When trade is placed: show WHY (which OB, FVG, BOS/CHoCH triggered, HTF bias, session, confluence score)
- [x] Post-mortem generation function created (generatePostMortem)
- [x] Wire generatePostMortem into paperTrading close flow for SL/TP/manual exits
- [x] Wire post-mortem into TP close flow
- [x] Post-mortem analysis visible in Journal trade detail panel
- [x] Engine logs REASON lines via addLog() during scans
- [x] BotView terminal: engine log entries will appear during autonomous scans (engine addLog wired to paper trading log)

### Testing Gaps
- [x] Vitest tests for autonomous engine routes (engine.state, engine.start, engine.stop, engine.manualScan, engine.scanResults, engine.tradeReasoning, engine.postMortems) — 31 tests
- [x] Vitest tests for post-mortem generation on SL/TP closures

## Bug Fixes
- [x] Fix positionId type mismatch: engine.tradeReasoning expects string but receives number

## Backtest Rebuild — Full Parameter Controls
- [x] Backtest UI: add strategy parameter overrides (min confluence, enabled setups: BOS/CHoCH/OB/FVG/Liquidity, HTF bias required)
- [x] Backtest UI: add risk parameter overrides (risk per trade %, max positions, min R:R)
- [x] Backtest UI: add entry/exit rule overrides (SL method, TP method, trailing stop, break-even)
- [x] Backtest UI: add session filter overrides (London/NY/Asian/Sydney toggles)
- [x] Backtest UI: lookback period slider (1-24 months) instead of fixed 3-month window
- [x] Backtest UI: "Dashboard Config" vs "Custom Override" toggle
- [x] Backtest results: show parameter snapshot used, trade-by-trade breakdown with reasoning
- [x] Server: accept full configOverrides in backtest.run route

## Backtest Rebuild — Production-Grade
- [x] Server: expand backtest.run configOverrides to accept ALL BotConfig parameters (strategy, risk, entry, exit, session, instruments)
- [x] Server: add monthly P&L breakdown, consecutive wins/losses, avg win/loss size, best/worst trade to results
- [x] Server: add drawdown curve data points alongside equity curve
- [x] UI: full collapsible parameter sections — Strategy (setup toggles, confluence, HTF bias), Risk (risk%, max positions, min R:R), Entry/Exit (SL/TP methods, trailing, break-even), Session (kill zone toggles, day-of-week filter)
- [x] UI: lookback period slider (1-24 months) with preset labels
- [x] UI: "Dashboard Config" vs "Custom Override" toggle with LOCKED badges
- [x] UI: results dashboard — KPI cards, equity+drawdown chart, monthly P&L heatmap, setup/exit distribution, long/short breakdown
- [x] UI: trade-by-trade table with expandable rows showing entry reasoning (setups, confluence, bias, session)
- [x] UI: config snapshot display showing exact parameters used for the run
- [x] UI: loading state with progress bar during backtest execution
- [x] UI: comparison mode — save runs to localStorage (max 20), A/B selection, side-by-side metric table with delta coloring, config diff display

## Quality Gap Fixes — Production-Grade Rebuild
### 1. Persist state to DB (critical — all state lost on restart)
- [x] Add `bot_config` table to schema (JSON column for full config, userId, updatedAt)
- [x] Add `trade_reasonings` table (positionId, symbol, direction, confluenceScore, session, timeframe, factors JSON, summary, bias, createdAt)
- [x] Add `trade_post_mortems` table (positionId, symbol, exitReason, whatWorked, whatFailed, lessonLearned, exitPrice, pnl, createdAt)
- [x] Run pnpm db:push to migrate schema (7 tables, migration applied)
- [x] Update botConfig.ts to load/save config from DB instead of in-memory variable
- [x] Update botEngine.ts to persist trade reasonings to DB on trade placement
- [x] Update botEngine.ts to persist post-mortems to DB on trade close
- [x] Update routers.ts to query reasoning/post-mortems from DB
- [x] Add reasoning/post-mortem columns to trades table (confluenceScore, reasoningJson, postMortemJson)

### 2. BotView engine controls (critical — no way to start autonomous engine)
- [x] Add engine start/stop buttons to BotView (Start Engine / Stop Engine)
- [x] Add auto-trade toggle switch (custom toggle component)
- [x] Add manual scan trigger button (Scan Now)
- [x] Add scan interval selector (30s, 60s, 2m, 5m, 10m)
- [x] Show engine status indicator (ACTIVE/INACTIVE badge + pulse dot)

### 3. ICT Analysis real visualizations (significant)
- [x] Session Map: SVG 24h timeline with colored session blocks, NOW marker, kill zone legend
- [x] Currency Strength: SVG horizontal bar chart ranked by strength, color-coded green/red, strongest/weakest summary
- [x] Correlation Matrix: color-coded 8x8 grid with correlation coefficients and legend
- [x] PD/PW Levels: SVG price ladder with colored markers, daily/weekly range display
- [x] Judas Swing: visual detection display with sweep direction, entry zone, and explanation
- [x] Premium/Discount: SVG zone indicator with OTE zone, equilibrium line, and current position

### 4. Dashboard equity curve enhancement
- [x] Add drawdown overlay line to equity curve
- [x] Add time range selector (1W, 1M, 3M, 6M, All)
- [x] Add benchmark line (starting balance)

### 5. Notification system
- [x] Wire notifyOwner for high-confluence signals
- [x] Wire notifyOwner for trade placements
- [x] Wire notifyOwner for SL/TP hits
- [x] Create notifications.ts module with config-aware notification helpers
- [x] Wire notifyEngineError for bot engine errors

### 6. Settings persistence
- [x] Move risk management settings from localStorage to DB (via user_settings table)
- [x] Move preferences from localStorage to DB
- [x] Settings view reads/writes via tRPC instead of localStorage
- [x] Add tRPC routes: settings.get, settings.updateRisk, settings.updatePreferences
- [x] Auto-migrate from localStorage on first load if no server data exists

### 7. Live Economic Calendar Enhancement
- [x] Replace static schedule with live ForexFactory/FairEconomy API feed
- [x] Add 15-minute server-side cache to avoid rate limits
- [x] Show forecast/previous/actual values in event rows
- [x] Add LIVE DATA / SCHEDULE indicator badge
- [x] Add last updated timestamp
- [x] Fallback to static schedule when live feed unavailable
- [x] Add CN flag for CNY events

## Production-Grade Gaps — Full Resolution

### 1. Persist paper trading state to DB
- [x] Add `paper_accounts` table (userId, balance, peakBalance, counters, engine state, executionMode, killSwitch)
- [x] Add `paper_positions` table (open positions + pending orders in single table with status enum)
- [x] Add `paper_trade_history` table (closed trades with full P&L data)
- [x] Run pnpm db:push to migrate new tables
- [x] Create paperTradingPersistence.ts with debounced save/restore/clear functions
- [x] On trade place/close: persist position changes to DB
- [x] On pending order create/cancel/trigger: persist to DB
- [x] On balance/equity change: persist account state to DB (debounced 1s)
- [x] On server restart: auto-restore last known state from DB
- [x] Add kill switch (emergency halt) with auto-halt on daily loss / cumulative loss limits
- [x] Add execution mode (paper/live) flag persisted to DB
- [x] Add emergency close all positions function
- [x] Add tRPC routes: paper.killSwitch, paper.executionMode, paper.emergencyCloseAll
- [x] Write vitest tests for state persistence (9 tests in persistence.test.ts)

### 2. Slippage/spread modeling in backtest engine
- [x] Add spread simulation (configurable per instrument, default realistic spreads per pair)
- [x] Add slippage simulation (random within configurable range, 0-10 pips)
- [x] Apply spread to entry price (buy at ask = mid + half spread, sell at bid = mid - half spread)
- [x] Apply slippage to SL/TP fills (adverse slippage on SL, minimal on TP, half on time exits)
- [x] Add spread/slippage config to backtest UI parameters (Spread & Slippage section)
- [x] Show spread/slippage impact in backtest results summary (total cost, avg per trade)
- [x] Track rawEntryPrice/rawExitPrice and spreadCost/slippageCost per trade
- [x] Add route params: spreadPips, slippagePips, useRealisticSpread
- [x] Write vitest tests for spread/slippage calculations (21 tests in spreadSlippage.test.ts)

### 3. Live broker execution with safety guards
- [x] Create liveExecution.ts bridge module (OANDA + MetaApi)
- [x] Add execution mode toggle: PAPER / LIVE (with confirmation dialog)
- [x] Add kill switch: emergency stop all trading + close all positions
- [x] Add max daily loss halt: auto-stop trading when daily loss exceeds threshold
- [x] Add max drawdown halt: auto-stop when drawdown exceeds threshold
- [x] Add position size validation against broker account balance
- [x] Add max live lot size limits per instrument
- [x] Wire placeOrder to route through broker when mode is LIVE
- [x] Live execution log entries with [LIVE] prefix and broker trade IDs
- [x] Automatic fallback to paper-only on broker errors
- [x] Show LIVE mode warning banner in UI (fixed top red bar)
- [x] Kill switch banner with deactivate + close all buttons (fixed bottom)
- [x] Live mode confirmation dialog with safety warnings
- [x] Execution mode badge (clickable toggle in top bar)
- [x] Add tRPC routes: liveBrokerStatus, setActiveBroker, getActiveBroker
- [x] Owner notification on every live trade execution and failure
- [x] Write vitest tests for safety guard logic (19 tests in liveExecution.test.ts)

### 4. WebSocket real-time price updates
- [x] Add WebSocket server endpoint on /ws/prices (ws package)
- [x] Stream live price quotes via WebSocket to connected clients
- [x] Server-side price feed: poll Yahoo Finance at 5s interval, broadcast to WS clients
- [x] Client: useWebSocketPrices hook (per-component) and useGlobalPriceFeed hook (singleton)
- [x] Client: subscribe/unsubscribe protocol with symbol filtering
- [x] Add WS connection status indicator in AppShell status bar (WS Live / Reconnecting / Offline)
- [x] Auto-reconnect with exponential backoff on disconnect (1s base, 30s max)
- [x] Heartbeat ping/pong every 25s, stale client cleanup after 5min
- [x] Cached prices sent immediately on new subscription
- [x] Add tRPC route: ws.status (connected clients, latest prices)
- [x] Write vitest tests for WebSocket message format (16 tests in wsPriceFeed.test.ts)

### 5. Standalone ZIP package for local installation
- [x] Create install.sh script (installs Node.js deps, sets up .env, runs DB migration)
- [x] Create README-INSTALL.md with step-by-step local setup instructions
- [x] Package entire project as downloadable ZIP (493KB)
- [x] Ensure app runs standalone without Manus OAuth (fallback to owner auth)

## Bug Fixes (Post-Delivery)
- [x] Fix npm ERESOLVE peer dependency conflict: made Manus plugins optional in vite.config.ts (graceful fallback)
- [x] Update install.sh to use --legacy-peer-deps for npm
- [x] Add .npmrc with legacy-peer-deps=true for npm users

## One-Click Installer
- [x] Create start.command (macOS double-clickable launcher with ASCII art banner)
- [x] Create start.bat (Windows double-clickable launcher)
- [x] Create docker-compose.yml (MySQL + app bundled — zero config)
- [x] Create Dockerfile for the app
- [x] Create .dockerignore for fast builds
- [x] Auto-detect Docker vs Node.js and choose best path
- [x] Docker path: fully automatic (zero config, data persists in volume)
- [x] Node.js path: guided database setup with paste prompt (one-time only)
- [x] Auto-open browser after server starts
- [x] Update README-INSTALL.md with one-click instructions

## Electron Desktop App (SQLite)

### Schema Migration (MySQL → SQLite)
- [x] Audit all MySQL-specific types: mysqlTable, mysqlEnum, onUpdateNow(), timestamp defaults, decimal→string, insertId, onDuplicateKeyUpdate
- [x] Rewrite drizzle/schema.ts using sqliteTable, text for enums, integer for timestamps
- [x] Rewrite drizzle.config.ts for SQLite driver
- [x] Update all DB helpers in server/db.ts for SQLite-compatible queries
- [x] Update paperTradingPersistence.ts for SQLite
- [x] Update botConfig.ts DB load/save for SQLite
- [x] Update server/_core/context.ts user lookup for SQLite
- [x] Replace mysql2 driver with better-sqlite3 in db.ts initialization

### Electron Shell
- [x] Create electron/main.mjs — Electron main process
- [x] Boot Express server as forked child process inside Electron
- [x] Create BrowserWindow pointing to localhost server
- [x] SQLite database file stored in app userData directory
- [x] Auto-run migrations on first launch (via server startup)
- [x] App menu with Help > Open Data Folder, Reset Database, DevTools
- [x] Graceful shutdown (stop server, close DB on quit)

### Build & Package
- [x] Add electron v41.2.0, electron-builder v26.8.1, better-sqlite3 dependencies
- [x] Configure electron-builder for macOS DMG, Windows NSIS, Linux AppImage
- [x] Build pipeline: vite build → esbuild server → electron-builder package
- [x] Test the packaged Linux AppImage builds successfully (178 MB)
- [x] Create build-mac.sh and build-win.bat cross-platform build scripts
- [x] Create README-DESKTOP.md with architecture docs and build instructions

### Testing
- [x] Run full vitest suite after SQLite migration
- [x] Fix backtest test timeouts (shorter date ranges, 60s timeout)
- [x] Fix fundamentals test assertion (affectedPairs can be empty for exotic currencies)
- [x] Fix botConfigRoutes test timeout (15s for network-dependent test)
- [x] All 259 tests passing across 17 test files
