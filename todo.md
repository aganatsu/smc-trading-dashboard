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
