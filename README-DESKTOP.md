# SMC Trading Dashboard — Desktop App

A production-grade Smart Money Concepts (SMC/ICT) trading analysis dashboard packaged as a standalone desktop application. No servers, no Docker, no database setup — just double-click and trade.

## What's Inside

- **Autonomous Bot Engine** — Scans markets, identifies SMC setups, places paper/live trades
- **ICT Analysis Suite** — 7 analysis panels (Market Structure, Order Blocks, FVGs, Liquidity, Fibonacci, Kill Zones, Premium/Discount)
- **Paper Trading** — Full simulation engine with balance tracking, P&L, position management
- **Live Broker Bridge** — Connect to OANDA/MetaApi for real execution (with kill switch + safety limits)
- **Backtesting Engine** — Historical bar-by-bar simulation with spread/slippage modeling
- **Economic Calendar** — Live ForexFactory data with 15-minute cache
- **Trade Journal** — Full trade logging with reasoning, post-mortem analysis, performance metrics
- **Real-time Prices** — WebSocket price feed from Yahoo Finance

## System Requirements

| Requirement | Minimum |
|-------------|---------|
| **OS** | macOS 11+ (Big Sur), Windows 10+, or Linux (Ubuntu 20.04+) |
| **RAM** | 4 GB |
| **Disk** | 500 MB free |
| **Internet** | Required for market data, economic calendar, and broker connections |
| **Node.js** | v18+ (only needed for building from source) |

## Quick Start (Pre-built)

### Linux AppImage
```bash
chmod +x "SMC Trading Dashboard-1.0.0.AppImage"
./"SMC Trading Dashboard-1.0.0.AppImage"
```

### macOS .dmg (build on Mac)
```bash
./build-mac.sh
# Then open electron-dist/SMC Trading Dashboard-1.0.0.dmg
```

### Windows .exe (build on Windows)
```
build-win.bat
REM Then run electron-dist\SMC Trading Dashboard Setup 1.0.0.exe
```

## Building from Source

### Prerequisites
1. Install [Node.js](https://nodejs.org) v18 or later
2. Install pnpm: `npm install -g pnpm`

### Build Steps

```bash
# 1. Install dependencies
pnpm install

# 2. Build frontend + server
pnpm build

# 3. Package for your platform
# macOS:
npx electron-builder --mac --config electron-builder.yml

# Windows:
npx electron-builder --win --config electron-builder.yml

# Linux:
npx electron-builder --linux --config electron-builder.yml
```

Output files will be in `electron-dist/`.

## Architecture

```
┌─────────────────────────────────────────────┐
│              Electron Shell                  │
│  ┌────────────────────────────────────────┐  │
│  │         BrowserWindow (React)          │  │
│  │  Dashboard │ Chart │ ICT │ Bot │ ...   │  │
│  └──────────────────┬─────────────────────┘  │
│                     │ HTTP/WebSocket          │
│  ┌──────────────────┴─────────────────────┐  │
│  │    Express + tRPC Server (forked)      │  │
│  │  ┌─────────┐  ┌──────────┐            │  │
│  │  │ SQLite  │  │ Bot      │            │  │
│  │  │ (local) │  │ Engine   │            │  │
│  │  └─────────┘  └──────────┘            │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

- **Electron main process** (`electron/main.mjs`) — Manages app lifecycle, forks the server
- **Express/tRPC server** (`dist/index.js`) — API server with all trading logic
- **React frontend** (`dist/public/`) — Single-page app loaded in BrowserWindow
- **SQLite database** — Stored in user data directory, persists across updates

## Data Storage

Your trading data (journal, settings, paper trading state) is stored in a SQLite database file:

| Platform | Location |
|----------|----------|
| **macOS** | `~/Library/Application Support/smc-trading-dashboard/smc-trading.db` |
| **Windows** | `%APPDATA%/smc-trading-dashboard/smc-trading.db` |
| **Linux** | `~/.config/smc-trading-dashboard/smc-trading.db` |

The database is automatically created on first launch. You can access it via **Help > Open Data Folder** in the app menu.

## App Menu

| Menu Item | Description |
|-----------|-------------|
| **Help > Open Data Folder** | Opens the directory containing your database |
| **Help > Open Database File** | Shows the SQLite file in Finder/Explorer |
| **Help > Reset Database** | Deletes all data and restarts fresh |
| **View > Toggle DevTools** | Opens Chrome DevTools for debugging |

## Development Mode

For development with hot-reload:

```bash
# Terminal 1: Start the dev server
pnpm dev

# Terminal 2: Launch Electron pointing at dev server
pnpm electron:dev
```

## Running Tests

```bash
pnpm test
```

259 tests across 17 test files covering:
- Paper trading engine
- Bot configuration
- Trade journal CRUD
- Backtest engine
- Economic calendar
- WebSocket price feed
- Settings persistence
- And more

## Troubleshooting

### App won't start
- Check if another instance is already running
- Try **Help > Reset Database** from the menu
- Delete the database file manually (see Data Storage section)

### No market data
- Ensure you have an internet connection
- Yahoo Finance may be temporarily unavailable — data will resume automatically

### Broker connection fails
- Verify your API key and account ID in Settings
- Ensure your broker account is active and has API access enabled
- Check if you're using the correct environment (demo vs live)

### Native module errors
If you see errors about `better-sqlite3`, rebuild native modules:
```bash
npx @electron/rebuild -f -w better-sqlite3
```

## License

MIT
