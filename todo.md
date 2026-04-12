# SMC Dashboard - Yahoo Finance Migration

- [x] Upgrade project to web-db-user for backend API access
- [x] Create backend API route that calls Yahoo Finance via callDataApi
- [x] Map all instrument symbols to Yahoo Finance format
- [x] Handle multiple timeframes (1W, 1D, 4H, 1H, 15m, 5m)
- [x] Update frontend marketData.ts to call backend API instead of Twelve Data
- [x] Remove Twelve Data API key dependency
- [x] Remove/simplify ApiKeyModal (no longer needed)
- [x] Update Dashboard to remove API key related UI
- [x] Test all instruments: Forex pairs, BTC, Gold
- [x] Verify SMC analysis still works correctly with Yahoo Finance data
- [x] Save checkpoint

## PWA Support
- [x] Create web app manifest (manifest.json) with app name, icons, theme colors
- [x] Generate PWA icons (192x192, 512x512)
- [x] Add service worker for offline caching
- [x] Add install prompt/button in the dashboard UI
- [x] Register manifest and service worker in index.html

## Trade Journal
- [x] Create trade journal database schema (trades table)
- [x] Create backend tRPC routes for CRUD operations on trades
- [x] Build Trade Journal page/panel UI with trade list
- [x] Build Add/Edit Trade form (symbol, entry/exit price, direction, notes, strategy adherence, P&L)
- [x] Add trade statistics summary (win rate, total P&L, avg R:R)
- [x] Add navigation to Trade Journal from dashboard
- [x] Write vitest tests for trade journal backend

## Broker Integration (OANDA + HFM)
- [x] Research OANDA REST API v20 for order placement and account info
- [x] Research HFM (HotForex) API capabilities (MetaApi.cloud bridge)
- [x] Build backend broker connection service (OANDA)
- [x] Build backend broker connection service (HFM via MetaApi)
- [x] Create tRPC routes for broker operations (connect, place order, get positions, account info)
- [x] Build frontend BrokerPanel (connect, view account, place orders, close positions)
- [x] Integrate BrokerPanel into Dashboard as Trade Execution panel
- [x] Add broker account balance/positions display

## Chart Screenshots for Journal
- [x] Add screenshot upload endpoint (base64 to S3)
- [x] Update trades schema to include screenshotUrl field
- [x] Build ScreenshotCapture component (upload, drag-drop, paste, preview)
- [x] Integrate screenshot capture into Trade Journal form
- [x] Display screenshots in trade journal expanded view

## Equity Curve Visualization
- [x] Build EquityCurve component using Recharts (area chart + per-trade P&L bars)
- [x] Create equityCurve tRPC endpoint (cumulative P&L from closed trades)
- [x] Integrate equity curve into Trade Journal page
- [x] Write vitest tests for broker, screenshot, and equity curve features

## Remaining Improvements
- [x] Add daily/weekly/monthly P&L breakdown view in equity curve section
- [x] Add one-click trade execution button in Risk Management panel that pre-fills BrokerPanel
