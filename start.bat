@echo off
title SMC Trading Dashboard
color 0B

echo.
echo ========================================================
echo   SMC Trading Dashboard - One-Click Launcher
echo   Smart Money Concepts Analysis Platform
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/5] Detecting environment...
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    docker info >nul 2>&1
    if %errorlevel% equ 0 (
        echo   [OK] Docker detected
        goto :DOCKER_PATH
    )
)

node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Node.js detected
    goto :NODE_PATH
)

echo   [ERROR] Neither Docker nor Node.js found.
echo   Install Docker Desktop or Node.js 18+ and try again.
pause
exit /b 1

:DOCKER_PATH
echo.
echo [2/5] Starting MySQL + App via Docker Compose...
docker compose up -d --build
echo [3/5] Waiting for MySQL...
timeout /t 15 /nobreak >nul
echo [4/5] Running migrations...
docker compose exec -T app sh -c "npx drizzle-kit generate && npx drizzle-kit migrate"
echo [5/5] Opening dashboard...
timeout /t 3 /nobreak >nul
start http://localhost:3000
echo.
echo   Dashboard: http://localhost:3000
echo   To stop:   docker compose down
pause
exit /b 0

:NODE_PATH
echo.
echo [2/5] Installing dependencies...
if not exist node_modules (
    npm install --legacy-peer-deps
)
echo   [OK] Dependencies ready

echo [3/5] Checking environment...
if not exist .env (
    echo DATABASE_URL=> .env
    echo JWT_SECRET=smc-local-secret>> .env
    echo OWNER_OPEN_ID=local-owner>> .env
    echo OWNER_NAME=Trader>> .env
    echo VITE_APP_TITLE=SMC Trading Dashboard>> .env
    echo VITE_APP_ID=smc-local>> .env
    echo PORT=3000>> .env
    echo STANDALONE_MODE=true>> .env
)

findstr /B "DATABASE_URL=mysql" .env >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   Database URL required. Options:
    echo   A) Free: https://tidbcloud.com/free-trial
    echo   B) Docker: docker run -d --name smc-mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=smc_trading -p 3306:3306 mysql:8.0
    echo      Then use: mysql://root:password@localhost:3306/smc_trading
    echo.
    set /p "DB_URL=  Paste DATABASE_URL: "
    if defined DB_URL (
        powershell -Command "(Get-Content .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=%DB_URL%' | Set-Content .env"
    ) else (
        echo   No URL. Edit .env and run again.
        pause
        exit /b 1
    )
)

echo [4/5] Running migrations...
npm run db:push

echo [5/5] Starting dashboard...
start /b cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"
npm run dev
