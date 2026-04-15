@echo off
REM ──────────────────────────────────────────────────────────────────
REM SMC Trading Dashboard — Windows Build Script
REM Builds the Electron desktop app as a .exe installer for Windows
REM ──────────────────────────────────────────────────────────────────

echo ╔══════════════════════════════════════════════════════════╗
echo ║    SMC Trading Dashboard — Windows Build                ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js is required. Install from https://nodejs.org
    pause
    exit /b 1
)

REM Check pnpm
where pnpm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo 📦 Installing pnpm...
    npm install -g pnpm
)

echo 📋 Node.js version:
node --version
echo 📋 pnpm version:
pnpm --version
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call pnpm install

REM Build frontend + server
echo 🔨 Building frontend and server...
call pnpm build

REM Build Electron app for Windows
echo 🪟 Packaging for Windows...
call npx electron-builder --win --config electron-builder.yml

echo.
echo ✅ Build complete!
echo.
echo 📁 Output files are in: electron-dist\
echo.
echo To install:
echo   1. Run the .exe installer from electron-dist\
echo   2. Follow the installation wizard
echo   3. Launch from Start Menu or Desktop shortcut
echo.
pause
