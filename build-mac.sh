#!/bin/bash
# ──────────────────────────────────────────────────────────────────
# SMC Trading Dashboard — macOS Build Script
# Builds the Electron desktop app as a .dmg installer for macOS
# ──────────────────────────────────────────────────────────────────

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║    SMC Trading Dashboard — macOS Build                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Install from https://nodejs.org"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

echo "📋 Node.js: $(node --version)"
echo "📋 pnpm: $(pnpm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Ensure Electron binary is downloaded
echo "⚡ Ensuring Electron binary is available..."
node node_modules/.pnpm/electron@*/node_modules/electron/install.js 2>/dev/null || true

# Build frontend + server
echo "🔨 Building frontend and server..."
pnpm build

# Build Electron app for macOS
echo "🍎 Packaging for macOS..."
npx electron-builder --mac --config electron-builder.yml

echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Output files:"
ls -lh electron-dist/*.dmg 2>/dev/null || echo "   (no .dmg found — check electron-dist/)"
ls -lh electron-dist/*.zip 2>/dev/null || echo "   (no .zip found)"
echo ""
echo "📂 Full output directory: electron-dist/"
echo ""
echo "To install:"
echo "  1. Open the .dmg file"
echo "  2. Drag 'SMC Trading Dashboard' to Applications"
echo "  3. Double-click to launch from Applications"
