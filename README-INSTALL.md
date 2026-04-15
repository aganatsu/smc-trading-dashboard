# SMC Trading Dashboard — Local Installation Guide

A production-grade Smart Money Concepts (SMC/ICT) trading analysis platform with autonomous bot, paper trading, backtesting, live broker execution, and real-time market data.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 18+ | [Download](https://nodejs.org/) |
| **pnpm** | 8+ | `npm install -g pnpm` (recommended) or use npm |
| **MySQL** | 8.0+ | Or TiDB Serverless (free tier) |

---

## Quick Start

```bash
# 1. Extract the ZIP and enter the directory
unzip smc-trading-dashboard.zip
cd smc-trading-dashboard

# 2. Run the automated installer
chmod +x install.sh
./install.sh

# 3. Configure your database (edit .env)
#    Set DATABASE_URL to your MySQL connection string
nano .env

# 4. Run database migrations
pnpm run db:push

# 5. Start the dashboard
pnpm run dev

# 6. Open in browser
open http://localhost:3000
```

---

## Manual Setup (Step by Step)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Create Environment File

Copy the example below into a `.env` file at the project root:

```env
# Database (required)
DATABASE_URL=mysql://user:password@localhost:3306/smc_trading

# Authentication
JWT_SECRET=your-random-secret-here-at-least-32-chars
OWNER_OPEN_ID=local-owner
OWNER_NAME=Trader

# App Settings
VITE_APP_TITLE=SMC Trading Dashboard
VITE_APP_ID=smc-local
PORT=3000
STANDALONE_MODE=true
```

**Generate a JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Database Setup

The app uses MySQL (or TiDB). You have several options:

**Option A: Local MySQL**
```bash
mysql -u root -p -e "CREATE DATABASE smc_trading;"
# Set DATABASE_URL=mysql://root:yourpassword@localhost:3306/smc_trading
```

**Option B: TiDB Serverless (Free)**
1. Sign up at [tidbcloud.com](https://tidbcloud.com)
2. Create a Serverless cluster
3. Copy the connection string to `DATABASE_URL`
4. Add `?ssl={"rejectUnauthorized":true}` to the connection string

**Option C: Docker MySQL**
```bash
docker run -d --name smc-mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=smc_trading \
  -p 3306:3306 \
  mysql:8.0
# Set DATABASE_URL=mysql://root:password@localhost:3306/smc_trading
```

### 4. Run Migrations

```bash
pnpm run db:push
```

This creates all required tables: `users`, `trades`, `broker_connections`, `bot_configs`, `trade_reasonings`, `trade_post_mortems`, `user_settings`, `paper_accounts`, `paper_positions`, `paper_trade_history`.

### 5. Start the Application

**Development mode** (with hot reload):
```bash
pnpm run dev
```

**Production mode**:
```bash
pnpm run build
node dist/index.js
```

### 6. Access the Dashboard

Open [http://localhost:3000](http://localhost:3000) in your browser.

In standalone mode, you are automatically authenticated as the owner — no login required.

---

## Features Overview

### 5-View Architecture

| View | Description |
|---|---|
| **Dashboard** | KPI cards, equity curve with drawdown overlay, active positions, portfolio heat, bot activity |
| **Chart** | TradingView Advanced Chart with SMC analysis panels (structure, OBs, FVGs, levels) |
| **Bot** | Autonomous SMC bot with start/stop/pause, live terminal, trade reasoning, kill switch |
| **Journal** | Trade journal with performance analytics, equity curve, P&L breakdown, trade detail |
| **Settings** | Broker connections, risk management, preferences, keyboard shortcuts |

### Autonomous Bot Engine

The bot autonomously scans all enabled instruments using SMC analysis:
- **Order Blocks**, **Fair Value Gaps**, **Break of Structure**, **Change of Character**, **Liquidity Sweeps**
- Generates a **confluence score** (1-10) for each signal
- Places trades when score exceeds the configured minimum
- Stores detailed **reasoning** for every trade (which setups triggered, bias, session)
- Generates **post-mortem analysis** on trade close (what worked, what failed, lessons)

### Paper Trading

- Full paper trading engine with real-time Yahoo Finance quotes
- Positions, balance, and trade history **persist to database** (survive restarts)
- Margin tracking, daily P&L, drawdown monitoring
- Pending orders (limit/stop) with automatic trigger execution

### Live Broker Execution

- **OANDA** and **MetaApi** (HFM, IC Markets, etc.) integrations
- **Kill switch**: Emergency halt button + auto-halt on daily loss / max drawdown
- **Execution mode toggle**: PAPER / LIVE with confirmation dialog
- **Position size limits**: Conservative per-instrument caps
- **Automatic fallback**: Falls back to paper-only on broker errors

### Backtesting

- Test strategies against historical data (1-24 months)
- **Spread/slippage modeling**: Realistic per-instrument spreads and adverse slippage
- Full parameter overrides (strategy, risk, entry/exit rules, sessions)
- Results: equity curve, drawdown, monthly P&L, trade-by-trade breakdown
- **Comparison mode**: Save up to 20 runs, A/B side-by-side comparison

### ICT Analysis

- **Session Map**: 24h timeline with London/NY/Asian/Sydney kill zones
- **Currency Strength**: Ranked bar chart with strongest/weakest summary
- **Correlation Matrix**: 8x8 color-coded grid
- **PD/PW Levels**: Previous Day/Week high/low/open/close price ladder
- **Judas Swing**: False breakout detection at session opens
- **Premium/Discount**: Zone indicator with OTE and equilibrium

### Real-Time Data

- **WebSocket price feed**: Server broadcasts live quotes to all connected clients
- **Yahoo Finance**: Real-time quotes and OHLCV candles (no API key needed)
- **Economic Calendar**: Live ForexFactory feed with forecast/previous/actual values
- **Auto-reconnect**: Exponential backoff on disconnect

---

## Broker Setup (Optional)

### OANDA

1. Create an OANDA practice account at [oanda.com](https://www.oanda.com)
2. Generate an API key from your account settings
3. In the dashboard, go to **Settings > Broker Connection**
4. Enter your API key and account ID
5. Click **Test Connection**

### MetaApi (HFM, IC Markets, etc.)

1. Sign up at [metaapi.cloud](https://metaapi.cloud)
2. Connect your MT4/MT5 account
3. Copy your MetaApi token and account ID
4. In the dashboard, go to **Settings > Broker Connection**
5. Enter your token and account ID
6. Click **Test Connection**

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `1` | Dashboard view |
| `2` | Chart view |
| `3` | Bot view |
| `4` | Journal view |
| `5` | Settings view |
| `C` | Toggle chart panel (full-screen chart) |
| `/` | Focus sidebar filter |
| `Esc` | Close dialogs |

---

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test server/paperTrading.test.ts

# Run with verbose output
pnpm test -- --reporter=verbose
```

The test suite includes **259 tests** across **17 test files** covering:
- Paper trading engine (orders, positions, SL/TP, pending orders)
- Bot configuration (load/save/validate)
- Backtest engine (spread/slippage, results)
- Live execution (safety guards, kill switch, position limits)
- WebSocket price feed (subscribe/unsubscribe, broadcast)
- Market data, fundamentals, broker connections, notifications, settings

---

## Project Structure

```
client/
  src/
    pages/          ← View components (Dashboard, Chart, Bot, Journal, Settings)
    components/     ← Reusable UI (AppShell, charts, dialogs)
    hooks/          ← Custom hooks (useWebSocketPrices)
server/
  paperTrading.ts   ← Paper trading engine
  botEngine.ts      ← Autonomous SMC bot
  botConfig.ts      ← Bot configuration management
  backtest.ts       ← Backtesting engine
  liveExecution.ts  ← Live broker execution bridge
  wsPriceFeed.ts    ← WebSocket price feed server
  fundamentals.ts   ← Economic calendar
  notifications.ts  ← Config-aware notification system
  brokers/          ← OANDA + MetaApi integrations
  _core/            ← Framework (auth, tRPC, Vite, LLM)
drizzle/
  schema.ts         ← Database schema (10 tables)
```

---

## Troubleshooting

**"Cannot connect to database"**
- Verify `DATABASE_URL` in `.env` is correct
- For TiDB: ensure SSL is enabled in the connection string
- For local MySQL: ensure the database exists and MySQL is running

**"Port 3000 already in use"**
- Change `PORT` in `.env` to another port (e.g., 3001)
- Or kill the process: `lsof -ti:3000 | xargs kill`

**"Module not found" errors**
- Run `pnpm install` again
- Delete `node_modules` and reinstall: `rm -rf node_modules && pnpm install`

**WebSocket connection fails**
- The WS server runs on the same port as the HTTP server
- Ensure no proxy is blocking WebSocket upgrades
- Check browser console for connection errors

---

## License

MIT
