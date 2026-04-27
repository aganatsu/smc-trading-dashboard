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

## Bug Fixes (Current Session)
- [x] Fix flickering issue in the preview/app UI (better-sqlite3 was rebuilt for Electron, broke Node.js dev server)
- [x] Fix auth redirect loop when running locally without OAuth server (standalone mode)
- [x] Update install.sh for SQLite standalone mode (no MySQL/DATABASE_URL needed)
- [x] Server auto-creates 'local-owner' user when OWNER_OPEN_ID is not set
- [x] context.ts detects standalone mode when OAUTH_SERVER_URL is missing
- [x] Fix flashing/flickering issue in Manus preview app (reduced polling intervals, capped WS reconnects, removed aggressive health check)
- [x] Fix: Bot trades not being sent to MetaTrader API broker connection
- [x] Verify live execution bridge routes trades to MetaApi when in LIVE mode with active broker

## Bot #2 — FOTSI Mean Reversion (Magala Strategy)

### Edge Function (Supabase)
- [x] Create bot-scanner-fotsi Edge Function (Magala-style mean reversion)
- [x] FOTSI pair discovery by TSI divergence (28-pair aggregation)
- [x] Hook detection with strength grading (strong/moderate/weak)
- [x] EMA 50/100 TP targets with R:R-based fallback
- [x] ATR/structure/fixed SL methods
- [x] Session filtering, cooldown, daily loss limit, max concurrent
- [x] Partial TP at TP1 with break-even after
- [x] Tagged bot_id='fotsi_mr' in signal_reason JSON
- [x] Add bot_id column to scan_logs migration
- [x] Commit and push to GitHub

### Dashboard Integration (webdev)
- [x] Add FOTSI computation module (server-side TSI calculator)
- [x] Add Bot #2 tRPC routes (fotsi.strengths, fotsi.cached, fotsi.config.get/update/reset)
- [x] FOTSI Currency Strength Meter component (8-currency bar chart with OB/OS zones, sparklines, ranked pairs)
- [x] Bot #2 Config Panel (divergence, risk, SL/TP, sessions — 4 tabbed sections)
- [x] Bot Selector tabs in BotView (Bot #1: SMC Confluence / Bot #2: FOTSI Mean Reversion)
- [x] Bot #2 positions view (filtered by bot_id in signalReason) — shared positions table, filter pending
- [x] Bot #2 scan results display (ranked pairs table with direction, TSI values, spread, hook score)
- [x] Write vitest tests for FOTSI engine (14 tests — constants, config CRUD, cache, sessions merge)

## Config Preset System
- [x] Create config_presets Supabase table (SQL migration)
- [x] Add preset CRUD endpoints to bot-config Edge Function (list, save, delete)
- [x] Upgrade hardcoded Quick Presets to full config snapshots
- [x] Add Save Preset UI (button + name/description dialog)
- [x] Add My Presets section with load/delete in BotConfigModal
- [x] Push changes to GitHub

## Collapse Three Thresholds Into One
- [x] Remove minFactorCount from bot-scanner signal gate (keep only percentage threshold)
- [x] Remove minStrongFactors from bot-scanner signal gate (keep only percentage threshold)
- [x] Remove minFactorCount from backtest-engine signal gate
- [x] Remove minStrongFactors from backtest-engine signal gate
- [x] Remove minFactorCount from smcAnalysis.ts DEFAULTS
- [x] Remove minFactorCount and minStrongFactors sliders from BotConfigModal.tsx
- [x] Update presets to only use percentage threshold
- [x] Clean up BotView.tsx gate summary display
- [x] Clean up bot-config validation for removed fields

## Fix Remaining Backtest Issues
- [x] Add session time filtering (only trade during London/NY when enabled)
- [x] Make STEP configurable (dynamic based on entryTimeframe + scanIntervalMinutes)
- [x] Add weekend gap handling (skip Saturday/Sunday candles for FX/indices)
- [ ] Update factor analytics to track percentage scores
- [x] Align backtest engine gates with bot scanner gates (same logic, same order)
- [x] Per-instrument spread simulation (SPECS[symbol].typicalSpread when spreadPips=0)
- [x] Drawdown circuit breaker (real check using peakBalance)
- [x] Shared regime classifier (replaced local copy with import from smcAnalysis)
- [x] Updated bot-daily-review and bot-weekly-advisor for new threshold field
- [x] Updated botStyleClassifier.ts to percentage-based confluenceThreshold

## Backtest Documentation & Validation Test
- [x] Document full backtest engine flow end-to-end (BACKTEST_ARCHITECTURE.md)
- [x] Build deterministic validation test with known candle data (50 tests)
- [x] Test threshold gate fires at correct percentage (config mapping tests)
- [x] Test per-instrument spread applied correctly (5 spread tests)
- [x] Test drawdown circuit breaker halts when it should (3 drawdown tests)
- [x] Test weekend candles are skipped for FX (3 weekend tests)
- [x] Test session filtering works correctly (4 session detection tests)
- [x] All 50 tests passing with Deno test runner

## Bug: Backtest Returns No Results
- [x] Trace frontend Backtest.tsx request payload
- [x] Trace Edge Function backtest-engine request handler
- [x] Root cause: session case mismatch (DEFAULTS used 'London'/'New York', gate compared to 'london'/'newyork')
- [x] Fix: lowercase DEFAULTS.enabledSessions, normalize in mapConfig, fix frontend symbol names
- [x] Added 7 missing forex cross SPECS entries (AUD/NZD, NZD/JPY, CHF/JPY, NZD/CAD, AUD/CHF, NZD/CHF, CAD/CHF)
- [x] Fixed frontend SYMBOL_GROUPS (USOIL→'US Oil', removed UKOIL/US2000 — no backend support)
- [x] Added diagnostic counters to backtest response + zero-trade diagnostic UI panel
- [ ] Verify backtest produces results after fix (needs deploy + test)

## Backtest Engine: Background Execution Refactor
- [x] Map current architecture (entry point, frontend invocation, existing tables)
- [x] Create backtest_runs table migration (id, user_id, status, progress, results, config, timestamps)
- [x] Refactor backtest-engine to EdgeRuntime.waitUntil background pattern
- [x] Return runId immediately on start action, persist results to backtest_runs table
- [x] Add action-based routing: start/status/list
- [x] Update frontend Backtest.tsx to poll backtestApi.status() every 2s
- [x] Add progress updates at 6 milestones (10/30/50/55/85/95%)
- [x] Add progress bar with percentage, cancel button, run ID display
- [x] Verify syntax (balanced), all 50 Deno tests still passing
- [x] Committed and pushed to main

## Bug: Trades Placed With All Confluences Off (FIXED)
- [x] Trace scoring logic when all factors are disabled
- [x] Root cause 1: DEFAULTS.minConfluence was 5.5 (legacy 0-10 scale) — any score above 5.5% passed on 0-100 scale
- [x] Root cause 2: enabledMax summed ALL factor weights including disabled ones — percentage denominator inflated
- [x] Root cause 3: backtest-engine had different factor weight keys/values than bot-scanner
- [x] Fix: DEFAULTS.minConfluence 5.5→55, STYLE_OVERRIDES 5/5.5/6.5→45/55/65
- [x] Fix: Auto-scale legacy 0-10 configs to percentage in both loadConfig/mapConfig
- [x] Fix: enabledMax uses FACTOR_TOGGLE_MAP to skip disabled factors from denominator
- [x] Fix: Po3 bonus only added to enabledMax when prerequisite factors enabled
- [x] Fix: Backtest factor weights synced with bot-scanner totals (23.5)
- [x] All 50 Deno tests still passing

## Bug: Weekend Detection Investigation (NOT a bug — diagnostics were misleading)
- [x] Investigate weekend detection logic — correct (UTC getUTCDay 0=Sun, 6=Sat)
- [x] Diagnostic counters WERE double-counting — totalCandlesEvaluated was post-filter, not pre-filter
- [x] Added totalCandlesFetched counter at start of loop (before any filters)
- [x] Session filter verified correct — 42% filtered matches expected off-hours ratio
- [x] Restructured diagnostic UI as proper funnel (5 rows: total → pre-filters → analyzed → analysis → outcome)
- [x] Zero trades caused by threshold + enabledMax fix not yet deployed, not by filtering bugs

## Diagnostic Panel Upgrade — Actionable Advice
- [x] Add highestScoreSeen tracking to backtest engine diagnostics
- [x] Add enabledFactorCount and totalFactorCount to diagnostics
- [x] Add score distribution histogram (below20/below40/below60/below80/above80)
- [x] Build smart advice engine in Backtest.tsx diagnostic panel
- [x] Prioritized recommendations based on funnel bottleneck analysis
- [x] Show "Best score was X% but threshold is Y%" when below-threshold is the blocker
- [x] Show session coverage advice when session filter removes >50% of candles
- [x] Show factor enablement advice when few factors are enabled
- [x] Show "no direction" advice when many candles lack directional bias

## Session UI Fix
- [x] Fix Backtest.tsx session labels — use ET times matching actual detectSession() boundaries
- [x] Rename Sydney → Off-Hours in Backtest.tsx (backend never returns "Sydney")
- [x] Fix BotConfigModal.tsx Sydney description to clarify it maps to Off-Hours in backend

## Full Session System Refactor
- [x] Create `_shared/sessions.ts` — single canonical session module (4 non-overlapping sessions, DST-aware)
- [x] Migrate bot-scanner to import from `_shared/sessions.ts` (delete local detectSession)
- [x] Fix bot-scanner empty-array bug (empty filter = nothing enabled, not "no filtering")
- [x] Migrate backtest-engine to use `_shared/sessions.ts`
- [x] Migrate FOTSI bot to use `_shared/sessions.ts` (fix DST hardcode, convert boolean config)
- [x] Rewrite frontend `sessionSchedule.ts` to read `sessions.filter` array format
- [x] Rewrite `SessionStatusPill.tsx` to use new sessionSchedule
- [x] Fix config validation in `bot-config/index.ts` — reject unknown session names, auto-migrate sydney→offhours
- [x] Remove Sydney from all UI — only Asian, London, New York, Off-Hours
- [x] Fix BotConfigModal session toggles to use "offhours" instead of "sydney"
- [x] Fix FOTSIConfigModal session toggles — converted from boolean to filter-array format
- [x] Fix Backtest.tsx session toggles
- [x] Also fixed: marketData.ts getCurrentSession() (now DST-aware NY time), scannerManagement.ts sessionNameMap (uses filterKey)
- [x] Test all changes — 50 Deno tests passing, all type checks passing

## Scan Now Button Bug
- [x] Investigate: Scan Now button stays active after click — fixed: now awaits scan, button stays loading until done
- [x] Fix button to show loading/disabled state during scan — button now spins for full scan duration
- [x] Ensure scan results actually appear after scan completes — detailed toast with breakdown
- [x] Pre-existing bug: background scan silently fails — no results appear after "Scan Now"
- [x] Investigate: errors swallowed by .catch() in manual_scan handler — fixed by awaiting scan

## Scan Error Reporting
- [x] Backend: change manual_scan from fire-and-forget to await-and-return full result
- [x] Backend: return detailed result (pairsScanned, signalsFound, tradesPlaced, skippedReason, error)
- [x] Frontend: show detailed scan result toast (not just "Scan started")
- [x] Frontend: show specific error/skip reason when scan produces no results

## Scan Log Refresh + Overlap Lock Bugs
- [x] Scan log list doesn't refresh after manual scan completes — fixed: reset selectedScanIdx to 0 on success
- [x] First click shows "Another scan is still running" — fixed: manual scans force-clear stale lock before acquiring

## FOTSI Cron Wasting API Credits
- [x] FOTSI bot-scanner-fotsi is firing on cron even though user doesn't use it
- [x] FOTSI consumes ~28 TwelveData credits per cycle, eating half the 55/min budget
- [x] Investigate how FOTSI cron is triggered and add early-exit if not enabled
- [x] Add rate-limit throttling to candle source as safety net
- [x] Delete bot-scanner-fotsi folder from codebase
- [x] Clean up any frontend references to bot-scanner-fotsi
- [x] Add rate-limit throttling to candle source in main bot-scanner

## FOTSI Bot Removal (Complete)
- [x] Delete supabase/functions/bot-scanner-fotsi/ folder
- [x] Remove fotsiScannerApi and fotsiConfigApi from src/lib/api.ts
- [x] Remove Bot #2 tab switcher from BotView.tsx
- [x] Remove FOTSIMeter import and conditional rendering from BotView.tsx
- [x] Remove all activeBot === "fotsi" conditionals from scan log section
- [x] Remove FOTSI scan results rendering block (replaced with SMC-only)
- [x] Remove FOTSI scan detail rendering block (replaced with SMC-only)
- [x] Remove FOTSIConfigModal rendering from BotView.tsx
- [x] Delete src/components/FOTSIConfigModal.tsx
- [x] Delete src/components/FOTSIMeter.tsx
- [x] TypeScript compiles clean, brace balance verified
- [ ] User manual: Delete bot-scanner-fotsi from Supabase Dashboard Edge Functions
- [ ] User manual: Kill FOTSI cron job in Supabase SQL Editor

## TwelveData Rate-Limit Throttling
- [x] Lower TD_RATE_LIMIT from 55 to 50 (5 credit safety margin)
- [x] Increase max wait threshold from 10s to 25s (wait for slots instead of falling back)
- [x] Add throttle counter tracking and resetThrottleStats() export
- [x] Add rateLimitThrottles to scan meta entry for UI visibility
- [x] Reduce FOTSI batch size from 7 to 5 with 1.2s inter-batch delay
- [x] Increase per-instrument delay from 500ms to 1s
- [x] Import and call resetThrottleStats in bot-scanner at scan start and end

## FOTSI Currency Strength Meter Widget (Rebuild)
- [x] Investigate how FOTSI data flows from bot-scanner scan results to frontend
- [x] Add fotsiStrengths to __meta entry in bot-scanner scan details
- [x] Build FOTSIStrengthMeter component matching screenshot design (horizontal bars, flags, OB/OS zones, ranked pairs tab, key divergences)
- [x] Integrate meter into BotView right sidebar as collapsible card (between Performance and Engine Controls)
- [x] Verify TypeScript compilation and visual output (0 errors, balanced braces)

## Bug: Scan Results Not Showing in BotView
- [x] Investigate why scan log section shows "No scans yet" despite scans running
- [x] Check if FOTSI removal broke the scan results rendering (it didn't — issue was details_json string parsing)
- [x] Fix scan display issue (added JSON.parse safety + fixed analysis_snapshot.fotsi path)

## Bug: Trade Management Not Reaching MT4/5 Broker
- [x] Trailing stop, break-even, partial TP fire internally (Telegram notifications sent) but don't modify positions on MT4/5
- [x] Trace modifyBrokerSL and partialCloseBroker to find the disconnect
- [x] Check execution_mode gate, mirrored_connection_ids, and position matching
- [x] Fix the issue — added immediate broker SL sync after scannerManagement actions in bot-scanner

## Bug: Factor Weights, Spread Quality, and Regime Alignment Config Issues
- [x] Investigate how factor weights interact with percentage gate scoring — working correctly
- [x] Spread quality is penalty-only by design (not disabled, always active with -0.2 to -1.0 penalty)
- [x] Regime alignment toggle works correctly — was set to false by Scalper preset
- [x] Config toggles save and load state correctly

## MT4/MT5 Live Trades Tab
- [x] Reused existing broker-execute function (already has account_summary, open_trades actions) — added trade_history and modify_trade actions
- [x] Added tradeHistory and modifyTrade to frontend brokerExecApi in lib/api.ts
- [x] Built BrokerTradesTab component with 4 sections:
  - [x] Open Positions table (symbol, direction, lot size, entry, current, P&L, SL/TP, bot-managed flag, duration, inline edit/close)
  - [x] Sync Status panel (paper ledger vs broker position comparison, SL mismatch highlights, orphaned positions)
  - [x] Account Summary card (balance, equity, margin, free margin, floating P&L, margin level)
  - [x] Trade History table (last 30 days closed trades, actual P&L, BOT vs MANUAL source, win rate)
- [x] Integrated as 'MT4/MT5 Live' tab in BotView positions area
- [x] TypeScript compilation verified (0 errors, balanced braces)

## BrokerTradesTab: Collapsible + Draggable Sections
- [x] Add collapse/expand toggle to each section (Account Summary, Open Positions, Sync Status, Trade History)
- [x] Add drag handles and drag-to-reorder functionality for sections
- [x] Persist section order and collapse state in localStorage

## Bug: MT4/MT5 Live SL/TP Edit Shows "Unknown" Error
- [x] Investigate modify_trade action in broker-execute Edge Function — user gets "unknown something" error when editing SL/TP inline (root cause: broker-execute not deployed yet, "Unknown action" fallback)
- [x] Fix the modify_trade MetaAPI call — code was correct, just needed deployment
- [ ] Verify the fix works end-to-end (frontend edit → broker-execute → MetaAPI → MT4/MT5 position updated) — user deployed

## BotView Collapsible Panels
- [x] Add collapse/expand toggle to the Latest Scan Results section in BotView
- [x] Add collapse/expand toggle to the right sidebar (FOTSI meter, Performance, Engine Controls)
- [x] Persist collapse state in localStorage

## Bug: Broker SL Sync — Telegram Says Tightened But MT4/MT5 Unchanged
- [x] Investigate: SL tightened notification sent via Telegram but actual MT4/MT5 position SL not modified (root cause: bot-scanner not deployed with broker sync fix)
- [x] Check if this is the same bot-scanner broker sync bug (needs supabase functions deploy) — confirmed same issue, user deployed

## Audit Fixes (April 22, 2026)

### Fix #1: RLS on trade_archive and bot_recommendations (CRITICAL)
- [x] Create SQL migration to enable RLS on trade_archive
- [x] Create SQL migration to enable RLS on bot_recommendations
- [ ] User manual: Run migration in Supabase SQL Editor

### Fix #2: OANDA Broker Management Sync (CRITICAL)
- [x] Change management sync query from eq("broker_type","metaapi") to in("broker_type",["metaapi","oanda"])
- [x] Add OANDA branch in SL modification loop (route through broker-execute)
- [x] Change partial TP sync query to include OANDA
- [x] Add OANDA branch in partial TP close loop
- [x] Change close sync query to include OANDA (already included in trade mirroring)
- [x] Add OANDA branch in close loop (already included in trade mirroring)
- [x] Verify broker_trade_ids stores OANDA trade IDs at entry time (confirmed in trade mirroring section)
- [ ] Deploy bot-scanner after testing (user action)

### Fix #3: Unify Telegram Notifications (CRITICAL)
- [x] Replace direct api.telegram.org call in bot-daily-review with telegram-notify function call
- [x] Replace direct api.telegram.org call in bot-weekly-advisor with telegram-notify function call
- [x] Switch both from env-var TELEGRAM_CHAT_ID to user_settings telegramChatIds
- [ ] Deploy bot-daily-review and bot-weekly-advisor (user action)

### Fix #4: Input Validation on broker-execute modify_trade (HIGH)
- [x] Add tradeId validation (required, string)
- [x] Add stopLoss/takeProfit validation (at least one required, positive number)
- [ ] Deploy broker-execute (user action)

### Fix #5: Batch Dashboard Quote Fetches (HIGH)
- [x] Add batch_quotes action to market-data Edge Function
- [x] Update frontend marketApi with batchQuotes method
- [x] Update Index.tsx to use single batch call instead of 10 parallel calls
- [ ] Deploy market-data (user action)

### Fix #6: ErrorBoundary Around Heavy Components (HIGH)
- [x] Wrap BotView route in individual ErrorBoundary in App.tsx
- [x] Wrap Backtest route in individual ErrorBoundary in App.tsx
- [ ] Wrap BotConfigModal usage in ErrorBoundary (deferred — already inside BotView boundary)
- [ ] Wrap RecommendationsDashboard usage in ErrorBoundary (deferred — already inside BotView boundary)

## Scoring Engine Rewrite: Tiered Model (April 22, 2026)
- [x] Remove group caps from scoring
- [x] Implement tiered scoring: Tier 1 (core ×2), Tier 2 (confirmation ×1), Tier 3 (bonus ×0.5)
- [x] Move spread penalty to separate gate (pass/fail, not score adjustment)
- [x] Move regime penalty to separate gate (pass/fail, not score adjustment)
- [x] Add minimum Tier 1 gate: at least 2 Tier 1 factors required for any trade
- [x] Update score normalization to use tiered weights instead of factor weights
- [x] Verify TypeScript compilation and balanced braces (all balanced after stripping comments)
- [x] Commit and push bot-scanner (commit a92b090)
- [ ] Deploy bot-scanner to Supabase (user action)

## Frontend: Tier-Grouped Factor Display (April 23, 2026)
- [x] Create shared TierFactorBreakdown component with T1/T2/T3 collapsible sections
- [x] Update BotView ScanSignalDetail to use tier-grouped factor display
- [x] Update BotView ScanDetailInline to use tier-grouped factor display
- [x] Update SignalReasoningCard to use tier-grouped factor display
- [x] Update score header to show T1:x/4, T2:x/5, T3:x/8 counts (TierScoreSummary component)
- [x] Show tiered scoring gates (Tier 1 minimum, Regime, Spread) in gates section (TierGates component)
- [x] Verify TypeScript compilation (tsc --noEmit exit 0)
- [x] Commit and push to GitHub (commit d988c60)

## Settings: Factor Weights Tab Tier Grouping (April 23, 2026)
- [x] Update FACTOR_WEIGHT_DEFS to include tier field (1, 2, 3)
- [x] Regroup FactorWeightsTab by T1 Core / T2 Confirmation / T3 Bonus
- [x] Show tier point value (×2pts, ×1pt, ×0.5pts) next to each factor
- [x] Update Spread Quality to show as gate (pass/fail) not penalty
- [x] Add explanation of how custom weights multiply tier base points
- [x] Verify TypeScript compilation (tsc --noEmit exit 0)
- [x] Commit and push to GitHub (commit d40b0bf)

## Spread Gate: Convert to Info-Only (April 23, 2026)
- [x] Convert Gate 21 (Spread Quality) from hard reject to info-only in bot-scanner
- [x] Update frontend TierFactorBreakdown to show spread as info-only (Info icon, not pass/fail shield)
- [x] Update BotConfigModal gates section to reflect spread is info-only
- [x] Verify TypeScript compilation (tsc --noEmit exit 0)
- [x] Commit and push to GitHub (commit 0dcdb89)

## Regime Classifier Rewrite (April 23, 2026)
- [x] Rewrite classifyInstrumentRegime with 7 SMC-aligned checks
- [x] Check 1: Swing Structure (BOS vs CHoCH count)
- [x] Check 2: EMA 20/50 Alignment (slope + separation)
- [x] Check 3: Impulse vs Correction Ratio (catches pullbacks)
- [x] Check 4: Consecutive Directional Candles
- [x] Check 5: ADX (proper Wilder's smoothing calculation)
- [x] Check 6: Higher Timeframe Bias Consistency (50d vs 20d)
- [x] Check 7: Range Compression (BB width proxy)
- [x] Updated scoring: -14 to +14 range, strong_trend >= 8, choppy_range <= -8
- [x] Verify TypeScript compilation and brace balance (all 0, tsc clean)
- [x] Commit and push to GitHub (commit 1a897ed)

## OB Volume Pivot Bonus (April 23, 2026)
- [x] Add optional volume parameter to detectOrderBlocks function (uses candle.volume directly)
- [x] Implement volume pivot detection (highest vol in ±5 bars, LuxAlgo-inspired)
- [x] Add volume pivot as quality bonus (+2) in OB scoring + hasVolumePivot flag
- [x] Update bot-scanner OB detail to show volume pivot tag (candles already have volume from MetaAPI/Yahoo)
- [x] Backtest engine already passes candles with volume — no change needed
- [x] Verify TypeScript compilation (tsc --noEmit clean)
- [x] Commit and push to GitHub (commit 00f0607)

## PineScript Comparison — OB/BB Improvements (April 23, 2026)
- [x] Gap 1: OB scan-back — scan up to 10 bars back from engulfing candle to find last opposite-color candle (not just immediate prev)
- [x] Gap 2: OB zone 50% wick extension — extend OB zone from body-only to body + 50% of wicks for more accurate institutional footprint
- [x] Gap 4: BB vs MB distinction — label Breaker Blocks as true "breaker" (new HH/LL confirmed) vs "mitigation_block" (no new extreme)
- [x] Verify TypeScript compilation and brace balance (all 0/0/0, tsc clean)
- [x] Commit and push to GitHub (commit 4deef8e)

## Gate Threshold Visibility (April 23, 2026)
- [x] Show actual resolved minConfluence gate on dashboard (e.g. "Gate: 40% (Scalper)" not just raw 55%)
- [x] Include resolved gate in scan detail output alongside the score (resolvedMinConfluence in manual scan response)
- [x] Show style-based threshold in bot config UI so user knows what they're getting (Gate badge shows style name + warning color when overridden)

## FVG Improvements (April 23, 2026)
- [x] FVG Quality Scoring: Add quality score (0-8) to each FVG at detection time (displacement +3, ATR-relative size +0-2, body ratio +0-1, structure break nearby +2)
- [x] Update bot-scanner FVG scoring to scale points by quality instead of flat 2.0/1.5
- [x] FVG-Aware SL/TP: Tighten SL to unfilled FVG boundary when FVG exists between entry and SL
- [x] FVG-Aware SL/TP: Extend TP to far edge of unfilled FVG when FVG exists between entry and TP (commit 1b856b6)

## Bot View Mobile Responsiveness (April 23, 2026)
- [x] Audit BotView layout for mobile breakpoints and fix overflow/layout issues
- [x] Make top bar stats wrap/scroll on small screens (flex-wrap, compact text sizes)
- [x] Stack positions table and account summary vertically on mobile (flex-col lg:flex-row)
- [x] Wrap all 4 position tables in overflow-x-auto with min-w for horizontal scroll
- [x] Bot selector tabs: compact padding, shorter labels on mobile, overflow-x-auto
- [x] Order form: responsive grid layout (grid-cols-2 md:grid-cols-4)
- [x] Ensure log terminal is usable on phone screens (120px height on mobile, smaller text)
- [x] Kill switch banner: stack vertically on mobile (flex-col sm:flex-row)
- [x] Live mode banner: compact text on mobile
- [x] Right column sections: responsive padding (p-2 md:p-4)
- [x] TypeScript: 0 errors after all changes

## Bug: FX Market Session Detection (April 23, 2026)
- [x] Fix "FX market closed (weekend)" showing during active trading hours — was using UTC day instead of NY day (commit 172b16f)

- [x] Setup Staging: Create staged_setups Supabase table (symbol, direction, score, factors, staged_at, ttl, sl_level, status)
- [x] Setup Staging: Bot-scanner watch threshold logic — stage setups scoring between watch_threshold and minConfluence
- [x] Setup Staging: Bot-scanner promotion logic — promote staged setup to trade when score reaches gate + staged >=1 cycle
- [x] Setup Staging: Bot-scanner invalidation logic — discard when SL breached, TTL expired, or score drops below watch threshold
- [x] Setup Staging: Bot-scanner re-evaluation priority — check staged setups first before fresh pair scanning
- [x] Setup Staging: Config fields (watchThreshold, stagingTTLMinutes, minStagingCycles, stagingEnabled)
- [x] Setup Staging: BotView Watching panel UI (connect-assist) — show staged setups with score, time remaining, missing factors
- [x] Setup Staging: BotView Watching panel UI (smc-trading-dashboard) — mirror panel
- [x] Setup Staging: Include staging data in bot-scanner response for frontend consumption
- [x] Setup Staging: Vitest tests for staging types and public API (9 tests)
## Contradiction Fixes C4-C7 (April 26, 2026)
- [x] C4: Pass entryTimeframe to scannerManagement — use it for structure invalidation candle selection instead of hardcoded 15m
- [x] C5: Align Factor 22 (Daily Bias) and Gate 1 (HTF Bias) ranging tolerance — consistent treatment of ranging daily
- [x] C6: After close-on-reverse, splice closed positions from openPosArr so Gate 4/5 counts are accurate for remaining pairs
- [x] C7: Add post-direction weight adjustment for Factor 1 (Market Structure) — counter-trend structure should get reduced score
- [x] Verify all C4-C7 fixes compile cleanly (tsc + brace balance)
- [x] Commit and push C4-C7 fixes to GitHub
## Broader Systematic Audit (April 26, 2026)
- [x] Audit: Limit order fill path — does pending_orders → paper_positions correctly inherit all analysis data?
- [x] Audit: Broker mirroring race conditions — can two scan cycles place the same trade?
- [x] Audit: Config inheritance chain — default → style overrides → pair-specific overrides edge cases
- [x] Audit: Session/kill zone logic interaction with regime detection
- [x] Compile and deliver full broader audit report
## Broader Audit Fixes — MODERATE Severity (April 26, 2026)
- [x] L1: Use actual candle touch price instead of limit price for paper position entry on fill
- [x] L3: Add Gate 4/5 (max positions, max per symbol) check at limit order fill time
- [x] B1: Remove symbol+direction fallback from SL modify — require comment-tag match only
- [x] B2: Change management SL fallback to skip (not try-all) when mirrored_connection_ids is empty
- [x] B4: Add fetchBrokerSpread() check to limit order fill broker mirror path
- [x] I1: Replace identity check with provenance tracking for STYLE_OVERRIDES
- [x] I2: Add tpRatio to userProtectedFields set
## Broader Audit Fixes — LOW Severity Quick Wins (April 26, 2026)
- [x] I5: allowSameDirectionStacking: false already in DEFAULTS (line 65)
- [x] I6: scanIntervalMinutes: 15 already in DEFAULTS (line 110)
- [x] I7: maxHoldEnabled: false already in DEFAULTS (line 120)
- [x] S3: Capture session once at scan start and pass as parameter
- [x] Verify all broader audit fixes compile cleanly (brace balance) — 0 diff braces, 0 diff brackets
- [x] Commit and push all broader audit fixes to GitHub — commit a6ba473

## Bug: Paper Trading Positions Show +0.0 P&L — Not Updating (April 26, 2026)
- [x] Investigate why positions show current price = entry price and +0.0 P&L
- [x] Check if paper trading engine price monitoring loop is running
- [x] Fix the issue — added price refresh via fetchCandles before management (commit 690380a)
- [ ] Verify positions update with live prices (requires deploy to Supabase)

## Bug: broker-execute RUNTIME_ERROR (April 26, 2026)
- [x] Investigate RUNTIME_ERROR in broker-execute/index.ts
- [x] Root cause: esm.sh /cors import causing cold-start timeout on Deno boot
- [x] Fix: Replaced esm.sh cors import with local _shared/cors.ts
- [x] Push fix to GitHub — commit 2a25937

## Bug: paper-trading RUNTIME_ERROR 503 (April 26, 2026)
- [x] Investigate boot-time crash in paper-trading/index.ts (lineno:0, colno:0, stack:not_applicable)
- [x] Root cause: esm.sh /cors import + version mismatch (v2.103.2 + v2.95.0) causing cold-start timeout
- [x] Fix: Replaced esm.sh cors import with local _shared/cors.ts across all 12 Edge Functions
- [x] Push fix to GitHub — commit 2a25937

## Feature: Dynamic Scan Skip When Max Positions Reached (April 26, 2026)
- [x] Add early exit check: if openPosArr.length >= maxOpenTrades, skip per-pair analysis loop
- [x] Still run: price refresh + management (trailing SL, break-even, partial TP, close-on-reverse)
- [x] Read maxOpenTrades from live config each cycle (fully dynamic, no hardcoded numbers)
- [x] Log clearly: "Max positions reached (X/Y) — management only, skipping new entry scan"
- [x] Resumes scanning automatically when positions close or maxOpenTrades config increases
- [x] Push to GitHub — commit 45673bf

## Feature: Per-Trade Individual SL/BE/TS Adjustment (April 26, 2026)
- [x] Add trade_overrides JSON column to paper_positions table (SQL provided, user needs to run)
- [x] Backend: management function reads per-trade overrides before applying global config
- [x] Backend: paper-trading update_position extended to accept tradeOverrides payload
- [x] Frontend (Lovable): per-trade edit UI (edit SL price, toggle BE on/off, toggle trailing on/off, adjust trailing distance)
- [x] Frontend: visual indicator showing which trades have custom overrides
- [x] Push backend changes to GitHub (connect-assist) — commit 0029745
- [x] Push frontend changes to Lovable (commit 85b1554 — TradeOverrideEditor.tsx + integration guide)

## Entry & Exit Logic Audit (April 26, 2026)
- [x] Full audit: verify bot scanner entry logic uses all recent upgrades (ZigZag pivots, Fib 2-pivot, OB scan-back, FVG quality, regime classifier)
- [x] Full audit: verify bot scanner exit/management logic uses all recent upgrades (per-trade overrides, structure invalidation, close-on-reverse)
- [x] Compile entry/exit audit report and deliver to user

## Bug Fix: Locked R / Locked P&L Display (April 26, 2026)
- [x] Fix: originalSl derivation uses trailingStopPips (trail distance) instead of true original SL
- [x] Fix: lockedR should use the true original SL distance as denominator
- [x] Fix: lockedPnl should be capped — cannot exceed current floating P&L
- [x] Push fix to GitHub for Lovable (commit 22f505b)

## Full Calculation Audit (April 26, 2026)
- [x] Audit: bot-scanner SL/TP placement (calculateSLTP function)
- [x] Audit: bot-scanner position sizing (calculatePositionSize function)
- [x] Audit: bot-scanner commission-adjusted R:R gate
- [x] Audit: bot-scanner spread filter calculation
- [x] Audit: management engine R-multiple calculation
- [x] Audit: management engine break-even trigger and activation math
- [x] Audit: management engine trailing stop activation, tightening, and proportional trail
- [x] Audit: management engine partial TP level and size reduction
- [x] Audit: management engine max hold time calculation
- [x] Audit: frontend ExpandedPositionCard — R-multiple, locked R, locked P&L, pips, dollar/pip, BE/trail/partial displays
- [x] Audit: frontend BotView table — R-multiple column, P&L, pips, BE/trail status
- [x] Audit: Dashboard account calculations — equity, margin, drawdown, win rate, profit factor
- [x] Compile comprehensive calculation audit report

## Calculation Audit Bug Fixes (April 26, 2026)
- [x] Fix Bug 1: Align pip sizes — backend SPECS BTC/USD=1.0 vs frontend INSTRUMENTS BTC/USD=0.01; remove getPipSize() and use INSTRUMENTS everywhere
- [x] Fix Bug 2: Add BE trigger R clamp [1.0, 2.0] in ExpandedPositionCard to match backend
- [x] Fix Bug 3: Journal equity curve — use actual account balance instead of hardcoded $10,000
- [x] Fix Bug 4: Clean up dead ternary in BotView origSl fallback
- [x] Fix Bug 5: Remove getPipSize() duplication — ExpandedPositionCard should use INSTRUMENTS lookup
- [x] Fix Inconsistency: Journal daily P&L should group by exit_time (closedAt) not entry_time

## Max Trades Scan-Stop (April 26, 2026)
- [x] Implement: when open positions >= max_open_positions, skip scanning entirely (don't waste API calls)
- [x] Add log message: "Scan skipped — at max positions (X/X)" 
- [x] Still run management on existing positions even when scan is skipped
- [x] Push to GitHub

## Bug Fix: Scan-Stop Not Firing (April 27, 2026)
- [x] Fix: scan-stop at line 4358 not skipping scan loop when at max positions — bulletproofed with parseInt + openPosArr.length (commit 5679ac9)
- [x] Verify: currentOpenCount is calculated correctly before the scan loop
- [x] Push fix to GitHub

## CRITICAL BUG: Trailing SL Not Closing Position (April 27, 2026)
- [x] Fix: management engine updates SL in DB but doesn't check if current price has already breached it
- [x] Fix: BTC/USD BUY position has trailing SL at 79398.30 but current price is 77828.39 — should have been stopped out
- [x] Add SL/TP breach check in bot-scanner after price refresh + rateMap build (line 4001) — checks all open positions, closes breached ones with full close pattern (commit ecf1c59)
- [x] Push fix to GitHub (commit ecf1c59)

## Premarket Game Plan — Automatic Session Analysis (April 27, 2026)

### Backend: Game Plan Engine
- [x] Build gamePlan.ts shared module — pre-session analysis engine (909 lines, commit 4d28e53)
- [x] DOL (Draw on Liquidity) identification — find nearest unmitigated liquidity pools (equal highs/lows, old swing points) and determine likely draw direction
- [x] HTF bias determination — analyze D1/4H structure (BOS/CHoCH, premium/discount, trend direction) to set bullish/bearish/neutral bias per instrument
- [x] Key level mapping — auto-mark PD H/L/O/C, PW H/L, significant OBs, FVGs, liquidity pools for the session
- [x] Scenario planning — generate "if X then Y" conditional trade plans per instrument
- [x] Regime-aware filtering — use regime classifier (trending/ranging/volatile/quiet) to adjust game plan aggressiveness
- [x] Session-specific game plan — separate plans for London, NY, Asian sessions
- [x] Store game plan in scan_logs (type: game_plan) with session, bias, DOL, key levels, scenarios, confidence, news events

### Backend: Scanner Integration
- [x] Game plan runs every scan cycle (auto-detects current session) — no separate trigger needed
- [x] Add game plan gate in scanner — check signal direction against game plan bias before placing trade
- [x] Reject misaligned trades with clear reason: "Game plan: long REJECTED — bias is bearish (75%), signal is long"
- [x] Fall back to existing confluence scoring when no game plan exists for a pair
- [x] Game plan regenerates every scan cycle — automatically reflects structure changes

### Backend: Economic Calendar
- [x] Integrated with existing fundamentals function (ForexFactory data via faireconomy.media)
- [x] Flag high-impact events (NFP, CPI, FOMC, rate decisions) with time + affected currencies
- [x] News events enriched into game plan summary (existing news filter gate already handles trade blocking)

### Backend: Telegram Notification
- [x] Send game plan summary to Telegram (bias, DOL, focus pairs, scenarios, news events)
- [x] Trade rejections include game plan reason in gates (attached to scan detail)

### Frontend: Game Plan UI
- [x] Game Plan panel in BotView — new tab + dedicated /game-plan page + sidebar nav (commit c428026)
- [x] Visual bias indicators (emerald=bullish, red=bearish, zinc=neutral) per instrument with confidence %
- [x] News/events timeline showing upcoming high-impact events with impact badges and past-event dimming
- [x] Game plan history — view last 10 game plans with session selector (data stored in scan_logs)

## Fix: Game Plan Notification Spam + Settings UI
- [x] Fix: game plan now runs once per session with dedup check (commit defb139)
- [x] Add session-based dedup: check scan_logs (contains filter type=game_plan) for existing plan
- [x] Only send Telegram notification when a NEW game plan is generated (cached reuses skip notification)
- [x] Add config: gamePlanEnabled, gamePlanNotify, gamePlanRefreshHours, gamePlanFilterEnabled, gamePlanMinConfidence
- [x] Build Game Plan tab in BotConfigModal with all settings + search index entries
- [x] Push fixes to GitHub (commit defb139)
