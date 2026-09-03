#!/usr/bin/env bash
# ==============================================================================
# Local Markdown & Dev Directory Explorer Launcher
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"
DEV_ROOT="${DEV_ROOT:-/home/dev}"

echo "================================================================="
echo "🚀 Starting Local Markdown Explorer"
echo "   Root Directory  : ${DEV_ROOT}"
echo "   Server Port     : ${PORT}"
echo "   Cloudtop URL    : http://sh.net.dev:${PORT}"
echo "================================================================="

# Activate virtualenv if present
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Build Vite frontend if dist does not exist
if [ ! -d "dist" ]; then
    echo "📦 Compiling Vite frontend assets..."
    npm run build
fi

# Start FastAPI server
export DEV_ROOT="${DEV_ROOT}"
export PORT="${PORT}"
export HOST="${HOST}"

exec python3 server.py
