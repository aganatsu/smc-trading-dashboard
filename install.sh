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

echo -e "${YELLOW}[1/4] Checking prerequisites...${NC}"

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
    INSTALL_CMD="pnpm install"
    echo -e "  ${GREEN}✓ pnpm $(pnpm -v)${NC}"
elif command -v npm &> /dev/null; then
    PKG_MANAGER="npm"
    INSTALL_CMD="npm install --legacy-peer-deps"
    echo -e "  ${GREEN}✓ npm $(npm -v)${NC}"
else
    echo -e "${RED}✗ Neither pnpm nor npm found.${NC}"
    exit 1
fi

# ─── Install Dependencies ───────────────────────────────────────────

echo ""
echo -e "${YELLOW}[2/4] Installing dependencies...${NC}"
echo -e "  ${CYAN}Running: ${INSTALL_CMD}${NC}"
$INSTALL_CMD
echo -e "  ${GREEN}✓ Dependencies installed${NC}"

# ─── Create .env File ───────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[3/4] Setting up environment...${NC}"

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
# This app uses SQLite (embedded) — no external database needed!
# Your data is stored in ./data/smc-trading.db

# ─── Authentication ─────────────────────────────────────────────
# JWT secret for session cookies (auto-generated)
JWT_SECRET=${JWT_SECRET}

# Owner info (single-user mode — no login needed)
OWNER_OPEN_ID=local-owner
OWNER_NAME=Trader

# ─── Standalone Mode ────────────────────────────────────────────
# Skips Manus OAuth — app works without any external auth
STANDALONE_MODE=true

# ─── App Settings ───────────────────────────────────────────────
VITE_APP_TITLE=SMC Trading Dashboard
VITE_APP_ID=smc-local
PORT=3000

# ─── Broker Connections (Optional) ──────────────────────────────
# OANDA
# OANDA_API_KEY=your-oanda-api-key
# OANDA_ACCOUNT_ID=your-oanda-account-id
# OANDA_IS_LIVE=false

# MetaApi (for HFM, IC Markets, etc.)
# METAAPI_TOKEN=your-metaapi-token
# METAAPI_ACCOUNT_ID=your-metaapi-account-id
EOF

    echo -e "  ${GREEN}✓ .env file created${NC}"
fi

# ─── Done ───────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[4/4] Setup complete!${NC}"
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗"
echo -e "║  ${GREEN}✓ Installation successful!${CYAN}                              ║"
echo -e "╠══════════════════════════════════════════════════════════╣"
echo -e "║                                                          ║"
echo -e "║  ${NC}To start the dashboard:${CYAN}                                 ║"
echo -e "║                                                          ║"
echo -e "║  ${NC}  npm run dev${CYAN}                                            ║"
echo -e "║                                                          ║"
echo -e "║  ${NC}Then open: ${GREEN}http://localhost:3000${CYAN}                        ║"
echo -e "║                                                          ║"
echo -e "║  ${NC}Data stored in: ./data/smc-trading.db${CYAN}                    ║"
echo -e "║                                                          ║"
echo -e "╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
