# SMC Trading Dashboard — Local Installation Guide

A production-grade Smart Money Concepts (SMC/ICT) trading analysis platform with autonomous bot, paper trading, backtesting, live broker execution, and real-time market data.

---

## One-Click Start (Recommended)

### macOS
1. Extract the ZIP
2. Double-click **`start.command`**
3. The dashboard opens in your browser automatically

### Windows
1. Extract the ZIP
2. Double-click **`start.bat`**
3. The dashboard opens in your browser automatically

### What Happens Automatically

The launcher detects your environment and chooses the best path:

| Environment | What Happens |
|---|---|
| **Docker installed** | Spins up MySQL + app containers, runs migrations, opens browser. Zero config. |
| **Node.js only** | Installs deps, creates `.env`, asks for a database URL (one-time), runs migrations, opens browser. |
| **Neither** | Shows install links for Docker Desktop or Node.js. |

---

## Docker Compose (Fully Automatic)

If you have [Docker Desktop](https://docker.com/products/docker-desktop) installed, the one-click launcher handles everything. You can also run it manually:

```bash
# Start everything (MySQL + app)
docker compose up -d

# View logs
docker compose logs -f app

# Stop everything
docker compose down

# Stop and remove all data
docker compose down -v
```

Data persists in a Docker volume and survives restarts.

---

## Database Options (Node.js Path Only)

If you don't have Docker, you need a MySQL connection string. Choose one:

### Option A: Free TiDB Serverless (Easiest — No Install)
1. Go to [tidbcloud.com/free-trial](https://tidbcloud.com/free-trial)
2. Sign up with GitHub or Google (no credit card required)
3. Create a **Serverless** cluster (free: 5GB storage, 50M requests/month)
4. Go to **Connect** and copy the connection string
5. Paste it when the launcher asks

### Option B: Local MySQL via Docker (One Command)
```bash
docker run -d --name smc-mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=smc_trading \
  -p 3306:3306 \
  mysql:8.0
```
Connection string: `mysql://root:password@localhost:3306/smc_trading`

### Option C: Any Existing MySQL Server
Use your connection string: `mysql://user:pass@host:3306/database_name`

---

## Manual Setup (If One-Click Doesn't Work)

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Create .env file (copy from below)
# 3. Set DATABASE_URL in .env
# 4. Run migrations
npm run db:push

# 5. Start the dashboard
npm run dev

# 6. Open http://localhost:3000
```

### .env Template

```env
DATABASE_URL=mysql://user:password@localhost:3306/smc_trading
JWT_SECRET=your-random-secret-here-at-least-32-chars
OWNER_OPEN_ID=local-owner
OWNER_NAME=Trader
VITE_APP_TITLE=SMC Trading Dashboard
VITE_APP_ID=smc-local
PORT=3000
STANDALONE_MODE=true
```

Generate a JWT secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

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
3. In the dashboard: **Settings > Broker Connection** > enter API key + account ID

### MetaApi (HFM, IC Markets, etc.)
1. Sign up at [metaapi.cloud](https://metaapi.cloud)
2. Connect your MT4/MT5 account
3. In the dashboard: **Settings > Broker Connection** > enter token + account ID

---

## Docker Compose Commands

```bash
docker compose up -d          # Start everything
docker compose logs -f app    # View app logs
docker compose down           # Stop everything
docker compose down -v        # Stop + delete all data
docker compose up -d --build  # Rebuild after code changes
```

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `1` | Dashboard view |
| `2` | Chart view |
| `3` | Bot view |
| `4` | Journal view |
| `5` | Settings view |
| `C` | Toggle chart panel |
| `/` | Focus sidebar filter |
| `Esc` | Close dialogs |

---

## Running Tests

```bash
npm test                                  # Run all 259 tests
npm test -- server/paperTrading.test.ts   # Run specific file
npm test -- --reporter=verbose            # Verbose output
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `ERESOLVE unable to resolve dependency tree` | Run `npm install --legacy-peer-deps` |
| `Cannot connect to database` | Check `DATABASE_URL` in `.env`. For TiDB, ensure SSL is enabled. |
| `Port 3000 already in use` | Change `PORT` in `.env` or run `lsof -ti:3000 \| xargs kill` |
| Docker: `port 3307 already in use` | Change MySQL port in `docker-compose.yml` |
| `Module not found` errors | Delete `node_modules` and reinstall |
| WebSocket connection fails | Ensure no proxy blocks WS upgrades |
| Page is blank after start | Wait 10-15s for Vite to compile |

---

## License

MIT
