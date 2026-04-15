#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  SMC Trading Dashboard — One-Click Launcher
#  Double-click this file on macOS to start everything automatically.
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# Navigate to the script's directory (handles double-click from Finder)
cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║     ███████╗███╗   ███╗ ██████╗                              ║"
echo "║     ██╔════╝████╗ ████║██╔════╝                              ║"
echo "║     ███████╗██╔████╔██║██║                                   ║"
echo "║     ╚════██║██║╚██╔╝██║██║                                   ║"
echo "║     ███████║██║ ╚═╝ ██║╚██████╗                              ║"
echo "║     ╚══════╝╚═╝     ╚═╝ ╚═════╝                              ║"
echo "║                                                              ║"
echo "║     Smart Money Concepts Trading Dashboard                   ║"
echo "║     One-Click Launcher                                       ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Helper Functions ───────────────────────────────────────────────

open_browser() {
    local url="$1"
    sleep 3
    if command -v open &> /dev/null; then
        open "$url"  # macOS
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$url"  # Linux
    elif command -v start &> /dev/null; then
        start "$url"  # Windows/Git Bash
    fi
}

wait_for_server() {
    local url="$1"
    local max_wait=60
    local waited=0
    echo -ne "  ${CYAN}Waiting for server to start...${NC}"
    while [ $waited -lt $max_wait ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -q "200\|304"; then
            echo -e "\r  ${GREEN}✓ Server is ready!                    ${NC}"
            return 0
        fi
        echo -ne "\r  ${CYAN}Waiting for server to start... ${waited}s${NC}"
        sleep 2
        waited=$((waited + 2))
    done
    echo -e "\r  ${YELLOW}⚠ Server may still be starting...${NC}"
    return 0
}

# ─── Detect Best Launch Method ──────────────────────────────────────

echo -e "${BOLD}Detecting environment...${NC}"
echo ""

USE_DOCKER=false
USE_NODE=false

# Check for Docker
if command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
    if command -v docker compose &> /dev/null || command -v docker-compose &> /dev/null; then
        USE_DOCKER=true
        echo -e "  ${GREEN}✓ Docker detected — will use Docker Compose (recommended)${NC}"
    fi
fi

# Check for Node.js as fallback
if ! $USE_DOCKER; then
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            USE_NODE=true
            echo -e "  ${GREEN}✓ Node.js $(node -v) detected${NC}"
            echo -e "  ${YELLOW}  Docker not found — will use Node.js directly${NC}"
        fi
    fi
fi

if ! $USE_DOCKER && ! $USE_NODE; then
    echo -e "  ${RED}✗ Neither Docker nor Node.js 18+ found.${NC}"
    echo ""
    echo -e "  ${BOLD}Please install one of:${NC}"
    echo -e "    ${CYAN}Option A (Easiest):${NC} Docker Desktop → https://docker.com/products/docker-desktop"
    echo -e "    ${CYAN}Option B:${NC} Node.js 18+ → https://nodejs.org"
    echo ""
    echo -e "  After installing, double-click this file again."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════
#  DOCKER PATH — Fully automated, zero config
# ═══════════════════════════════════════════════════════════════════════

if $USE_DOCKER; then
    echo ""
    echo -e "${YELLOW}[1/3] Starting MySQL + App via Docker Compose...${NC}"
    echo -e "  ${CYAN}This may take a few minutes on first run (downloading images)${NC}"
    echo ""

    # Generate JWT secret if not set
    export JWT_SECRET=${JWT_SECRET:-$(openssl rand -hex 32 2>/dev/null || echo "smc-trading-local-secret-$(date +%s)")}

    # Use docker compose (v2) or docker-compose (v1)
    if command -v docker compose &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    # Build and start
    $COMPOSE_CMD up -d --build 2>&1 | while IFS= read -r line; do
        echo -e "  ${CYAN}│${NC} $line"
    done

    echo ""
    echo -e "${YELLOW}[2/3] Running database migrations...${NC}"

    # Wait for MySQL to be ready
    echo -ne "  ${CYAN}Waiting for MySQL...${NC}"
    for i in $(seq 1 30); do
        if $COMPOSE_CMD exec -T db mysqladmin ping -h localhost -u root -psmctrading2024 &> /dev/null; then
            echo -e "\r  ${GREEN}✓ MySQL is ready!            ${NC}"
            break
        fi
        echo -ne "\r  ${CYAN}Waiting for MySQL... ${i}s${NC}"
        sleep 2
    done

    # Run migrations inside the app container
    $COMPOSE_CMD exec -T app sh -c "npx drizzle-kit generate && npx drizzle-kit migrate" 2>&1 | while IFS= read -r line; do
        echo -e "  ${CYAN}│${NC} $line"
    done
    echo -e "  ${GREEN}✓ Database schema applied${NC}"

    echo ""
    echo -e "${YELLOW}[3/3] Opening dashboard...${NC}"
    wait_for_server "http://localhost:3000"
    open_browser "http://localhost:3000"

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗"
    echo -e "║  ✓ SMC Trading Dashboard is running!                         ║"
    echo -e "╠══════════════════════════════════════════════════════════════╣"
    echo -e "║                                                              ║"
    echo -e "║  ${BOLD}Dashboard:${NC}${GREEN}  http://localhost:3000                             ║"
    echo -e "║                                                              ║"
    echo -e "║  ${NC}${BOLD}To stop:${NC}${GREEN}    docker compose down                              ║"
    echo -e "║  ${NC}${BOLD}To restart:${NC}${GREEN} double-click start.command again                 ║"
    echo -e "║  ${NC}${BOLD}Your data:${NC}${GREEN}  persisted in Docker volume (survives restarts)   ║"
    echo -e "║                                                              ║"
    echo -e "╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    read -p "Press Enter to exit (dashboard keeps running in background)..."
    exit 0
fi

# ═══════════════════════════════════════════════════════════════════════
#  NODE.JS PATH — Requires DATABASE_URL to be set
# ═══════════════════════════════════════════════════════════════════════

if $USE_NODE; then
    echo ""

    # ─── Step 1: Install dependencies if needed ─────────────────────
    echo -e "${YELLOW}[1/4] Checking dependencies...${NC}"

    if [ ! -d "node_modules" ]; then
        echo -e "  ${CYAN}Installing dependencies (first run only)...${NC}"
        if command -v pnpm &> /dev/null; then
            pnpm install 2>&1 | tail -3
        else
            npm install --legacy-peer-deps 2>&1 | tail -3
        fi
        echo -e "  ${GREEN}✓ Dependencies installed${NC}"
    else
        echo -e "  ${GREEN}✓ Dependencies already installed${NC}"
    fi

    # ─── Step 2: Check/create .env ──────────────────────────────────
    echo ""
    echo -e "${YELLOW}[2/4] Checking environment...${NC}"

    if [ ! -f .env ]; then
        JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        cat > .env << ENVEOF
DATABASE_URL=
JWT_SECRET=${JWT_SECRET}
OWNER_OPEN_ID=local-owner
OWNER_NAME=Trader
VITE_APP_TITLE=SMC Trading Dashboard
VITE_APP_ID=smc-local
PORT=3000
STANDALONE_MODE=true
ENVEOF
        echo -e "  ${GREEN}✓ .env file created${NC}"
    fi

    # Check if DATABASE_URL is set
    DB_URL=$(grep "^DATABASE_URL=" .env 2>/dev/null | cut -d= -f2- || true)

    if [ -z "$DB_URL" ]; then
        echo ""
        echo -e "  ${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "  ${BOLD}  Database Setup Required (one-time only)${NC}"
        echo -e "  ${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "  ${CYAN}Choose one option:${NC}"
        echo ""
        echo -e "  ${BOLD}A) Free TiDB Cloud (Easiest — 2 minutes):${NC}"
        echo -e "     1. Go to ${CYAN}https://tidbcloud.com/free-trial${NC}"
        echo -e "     2. Sign up with GitHub/Google (no credit card)"
        echo -e "     3. Create a Serverless cluster → copy the connection string"
        echo -e "     4. Paste it below"
        echo ""
        echo -e "  ${BOLD}B) Local MySQL via Docker:${NC}"
        echo -e "     docker run -d --name smc-mysql \\"
        echo -e "       -e MYSQL_ROOT_PASSWORD=password \\"
        echo -e "       -e MYSQL_DATABASE=smc_trading \\"
        echo -e "       -p 3306:3306 mysql:8.0"
        echo -e "     Then use: ${CYAN}mysql://root:password@localhost:3306/smc_trading${NC}"
        echo ""
        echo -e "  ${BOLD}C) Any existing MySQL server:${NC}"
        echo -e "     Use: ${CYAN}mysql://user:pass@host:3306/database_name${NC}"
        echo ""

        read -p "  Paste your DATABASE_URL (or press Enter to exit): " USER_DB_URL

        if [ -z "$USER_DB_URL" ]; then
            echo ""
            echo -e "  ${YELLOW}No database URL provided. Set DATABASE_URL in .env and run this again.${NC}"
            echo ""
            read -p "Press Enter to exit..."
            exit 1
        fi

        # Write the DATABASE_URL to .env
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=${USER_DB_URL}|" .env
        else
            sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${USER_DB_URL}|" .env
        fi
        echo -e "  ${GREEN}✓ Database URL saved to .env${NC}"
    else
        echo -e "  ${GREEN}✓ DATABASE_URL is configured${NC}"
    fi

    # ─── Step 3: Run migrations ─────────────────────────────────────
    echo ""
    echo -e "${YELLOW}[3/4] Running database migrations...${NC}"

    # Source .env for the migration command
    set -a
    source .env
    set +a

    if command -v pnpm &> /dev/null; then
        pnpm run db:push 2>&1 && echo -e "  ${GREEN}✓ Database schema applied${NC}" || echo -e "  ${YELLOW}⚠ Migration may have failed — check DATABASE_URL${NC}"
    else
        npm run db:push 2>&1 && echo -e "  ${GREEN}✓ Database schema applied${NC}" || echo -e "  ${YELLOW}⚠ Migration may have failed — check DATABASE_URL${NC}"
    fi

    # ─── Step 4: Start the server ───────────────────────────────────
    echo ""
    echo -e "${YELLOW}[4/4] Starting dashboard...${NC}"

    # Open browser after a delay
    open_browser "http://localhost:3000" &

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗"
    echo -e "║  ✓ SMC Trading Dashboard is starting!                        ║"
    echo -e "╠══════════════════════════════════════════════════════════════╣"
    echo -e "║                                                              ║"
    echo -e "║  ${BOLD}Dashboard:${NC}${GREEN}  http://localhost:3000                             ║"
    echo -e "║                                                              ║"
    echo -e "║  ${NC}${BOLD}To stop:${NC}${GREEN}    Press Ctrl+C                                    ║"
    echo -e "║  ${NC}${BOLD}To restart:${NC}${GREEN} double-click start.command again                 ║"
    echo -e "║                                                              ║"
    echo -e "╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Start the dev server (foreground — Ctrl+C to stop)
    if command -v pnpm &> /dev/null; then
        pnpm run dev
    else
        npm run dev
    fi
fi
