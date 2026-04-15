#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# SMC Trading Dashboard — Local Installation Script
# ─────────────────────────────────────────────────────────────────────
# Usage:  chmod +x install.sh && ./install.sh
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       SMC Trading Dashboard — Local Setup               ║"
echo "║       Smart Money Concepts Analysis Platform             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Check Prerequisites ────────────────────────────────────────────

echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed.${NC}"
    echo "  Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js version must be 18 or higher (found v$(node -v))${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ Node.js $(node -v)${NC}"

# Check npm/pnpm
if command -v pnpm &> /dev/null; then
    PKG_MANAGER="pnpm"
    echo -e "  ${GREEN}✓ pnpm $(pnpm -v)${NC}"
elif command -v npm &> /dev/null; then
    PKG_MANAGER="npm"
    echo -e "  ${GREEN}✓ npm $(npm -v)${NC}"
    echo -e "  ${YELLOW}  (pnpm recommended for faster installs: npm install -g pnpm)${NC}"
else
    echo -e "${RED}✗ Neither pnpm nor npm found.${NC}"
    exit 1
fi

# ─── Install Dependencies ───────────────────────────────────────────

echo ""
echo -e "${YELLOW}[2/6] Installing dependencies...${NC}"
$PKG_MANAGER install
echo -e "  ${GREEN}✓ Dependencies installed${NC}"

# ─── Create .env File ───────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[3/6] Setting up environment...${NC}"

if [ -f .env ]; then
    echo -e "  ${YELLOW}⚠ .env file already exists. Skipping creation.${NC}"
    echo -e "  ${YELLOW}  Delete .env and re-run this script to regenerate.${NC}"
else
    # Generate a random JWT secret
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

    cat > .env << EOF
# ─────────────────────────────────────────────────────────────────
# SMC Trading Dashboard — Environment Configuration
# ─────────────────────────────────────────────────────────────────

# ─── Database ────────────────────────────────────────────────────
# Option 1: SQLite (default, no setup needed)
# DATABASE_URL=file:./data/smc.db

# Option 2: MySQL / TiDB (for production)
# DATABASE_URL=mysql://user:password@localhost:3306/smc_trading

# Option 3: Use an existing MySQL connection string
DATABASE_URL=

# ─── Authentication ─────────────────────────────────────────────
# JWT secret for session cookies (auto-generated)
JWT_SECRET=${JWT_SECRET}

# Owner info (used for single-user fallback auth — no login needed)
OWNER_OPEN_ID=local-owner
OWNER_NAME=Trader

# ─── Broker Connections (Optional) ──────────────────────────────
# OANDA
# OANDA_API_KEY=your-oanda-api-key
# OANDA_ACCOUNT_ID=your-oanda-account-id
# OANDA_IS_LIVE=false

# MetaApi (for HFM, IC Markets, etc.)
# METAAPI_TOKEN=your-metaapi-token
# METAAPI_ACCOUNT_ID=your-metaapi-account-id

# ─── App Settings ───────────────────────────────────────────────
VITE_APP_TITLE=SMC Trading Dashboard
VITE_APP_ID=smc-local
PORT=3000

# ─── Standalone Mode ────────────────────────────────────────────
# When true, skips Manus OAuth and uses owner fallback auth
STANDALONE_MODE=true
EOF

    echo -e "  ${GREEN}✓ .env file created${NC}"
    echo -e "  ${CYAN}  Edit .env to configure your database and broker connections${NC}"
fi

# ─── Database Setup ─────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[4/6] Database setup...${NC}"

if [ -z "${DATABASE_URL:-}" ] && grep -q "^DATABASE_URL=$" .env 2>/dev/null; then
    echo -e "  ${YELLOW}⚠ DATABASE_URL is empty in .env${NC}"
    echo -e "  ${YELLOW}  The app requires a MySQL/TiDB database.${NC}"
    echo -e "  ${YELLOW}  Options:${NC}"
    echo -e "  ${YELLOW}    1. Set DATABASE_URL in .env to your MySQL connection string${NC}"
    echo -e "  ${YELLOW}    2. Use a free TiDB Serverless instance: https://tidbcloud.com${NC}"
    echo -e "  ${YELLOW}    3. Use a local MySQL: mysql://root:password@localhost:3306/smc${NC}"
    echo -e ""
    echo -e "  ${YELLOW}  After setting DATABASE_URL, run: ${PKG_MANAGER} run db:push${NC}"
else
    echo -e "  ${GREEN}  Running database migrations...${NC}"
    $PKG_MANAGER run db:push 2>/dev/null && echo -e "  ${GREEN}✓ Database schema applied${NC}" || echo -e "  ${YELLOW}⚠ Migration skipped (set DATABASE_URL first)${NC}"
fi

# ─── Build ──────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[5/6] Building application...${NC}"
$PKG_MANAGER run build 2>/dev/null && echo -e "  ${GREEN}✓ Build complete${NC}" || echo -e "  ${YELLOW}⚠ Build skipped (will build on first run)${NC}"

# ─── Done ───────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[6/6] Setup complete!${NC}"
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗"
echo -e "║  ${GREEN}✓ Installation successful!${CYAN}                              ║"
echo -e "╠══════════════════════════════════════════════════════════╣"
echo -e "║                                                          ║"
echo -e "║  ${NC}To start the dashboard:${CYAN}                                 ║"
echo -e "║    ${NC}${PKG_MANAGER} run dev${CYAN}                                          ║"
echo -e "║                                                          ║"
echo -e "║  ${NC}Then open: ${GREEN}http://localhost:3000${CYAN}                        ║"
echo -e "║                                                          ║"
echo -e "║  ${NC}Before first run, make sure to:${CYAN}                         ║"
echo -e "║    ${NC}1. Set DATABASE_URL in .env${CYAN}                            ║"
echo -e "║    ${NC}2. Run: ${PKG_MANAGER} run db:push${CYAN}                             ║"
echo -e "║                                                          ║"
echo -e "╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
