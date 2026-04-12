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
