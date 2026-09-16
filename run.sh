#!/usr/bin/env bash

# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# ==============================================================================
# Local Markdown & Directory Explorer Launcher (Idempotent & Proxy Guard Aware)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# Initialize .env from .env.example if .env does not exist
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
fi

# Load .env variables
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# Parse CLI flags
DAEMON_MODE=false
FORCE_BUILD=false
CLI_ROOT=""
CLI_PIN_ROOT=""
CLI_LOCK_ROOT=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --root=*)
            CLI_ROOT="${1#*=}"
            shift
            ;;
        --root)
            CLI_ROOT="$2"
            shift 2
            ;;
        --pin-root=*)
            CLI_PIN_ROOT="${1#*=}"
            shift
            ;;
        --pin-root)
            CLI_PIN_ROOT="$2"
            shift 2
            ;;
        --lock-root)
            CLI_LOCK_ROOT=true
            shift
            ;;
        --port=*)
            PORT="${1#*=}"
            shift
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --daemon|-d)
            DAEMON_MODE=true
            shift
            ;;
        --build|-b)
            FORCE_BUILD=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

PUBLIC_PORT="${PUBLIC_PORT:-8000}"
ROOT_DIR="${CLI_PIN_ROOT:-${CLI_ROOT:-${ROOT_DIR:-${DOCS_ROOT:-${DEV_ROOT:-~/dev/cloud-gtm}}}}}"

# Detect Zero-Trust Local Proxy Guard deployment
PROXY_GUARD_ACTIVE=false
if [ -f "${HOME}/.config/iap_guard/allowlist.json" ]; then
    PROXY_GUARD_ACTIVE=true
    HOST="127.0.0.1"
    PORT="${PORT:-18000}"
    # If PORT was accidentally set to PUBLIC_PORT (8000), shift to internal port 18000
    if [ "${PORT}" = "${PUBLIC_PORT}" ]; then
        PORT="18000"
    fi
else
    HOST="${HOST:-127.0.0.1}"
    PORT="${PORT:-8000}"
fi

# Format De-ID display root (replace home with ~)
DISPLAY_ROOT="${ROOT_DIR/#$HOME/\~}"

echo "================================================================="
echo "🚀 Starting Local Markdown Explorer (Idempotent Launcher)"
echo "   Active Root (De-ID) : ${DISPLAY_ROOT}"
if [ -n "${CLI_PIN_ROOT}" ]; then
    echo "   Root Pinning        : PINNED & LOCKED (${DISPLAY_ROOT})"
elif [ "${LOCK_ROOT}" = "true" ] || [ "${CLI_LOCK_ROOT}" = "true" ]; then
    echo "   Root Pinning        : LOCKED (${DISPLAY_ROOT})"
else
    echo "   Root Pinning        : Configurable via GUI / .env"
fi
if [ "${PROXY_GUARD_ACTIVE}" = "true" ]; then
    echo "   Proxy Guard Shield  : ACTIVE (Public :${PUBLIC_PORT} ➔ Loopback 127.0.0.1:${PORT})"
    echo "   Direct Shield URL   : http://localhost:${PUBLIC_PORT}/"
    echo "   Carbon Gateway URL  : https://<cloudtop-host>:8443/port/${PUBLIC_PORT}/"
else
    echo "   Server Bind         : http://${HOST}:${PORT}/"
fi
echo "================================================================="

# Activate virtualenv if present
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Build Vite frontend if dist does not exist or --build passed
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ] || [ "${FORCE_BUILD}" = "true" ]; then
    echo "📦 Compiling Vite frontend assets..."
    npm run build
fi

# Idempotent cleanup: stop any existing server.py process listening on target port
EXISTING_PIDS=$(pgrep -f "server.py.*--port[= ]${PORT}" || true)
if [ -z "${EXISTING_PIDS}" ]; then
    EXISTING_PIDS=$(ss -tlnp 2>/dev/null | grep ":${PORT} " | grep -oP 'pid=\K[0-9]+' || true)
fi

if [ -n "${EXISTING_PIDS}" ]; then
    for pid in ${EXISTING_PIDS}; do
        if ps -p "${pid}" -o args= 2>/dev/null | grep -q "server.py"; then
            echo "♻️  Stopping existing Local Markdown Explorer process (PID ${pid})..."
            kill "${pid}" 2>/dev/null || true
            sleep 0.5
            kill -9 "${pid}" 2>/dev/null || true
        fi
    done
fi

# Construct server arguments
SERVER_ARGS=(--root="${ROOT_DIR}" --port="${PORT}" --host="${HOST}")
if [ -n "${CLI_PIN_ROOT}" ]; then
    SERVER_ARGS+=(--pin-root="${CLI_PIN_ROOT}")
fi
if [ "${CLI_LOCK_ROOT}" = "true" ] || [ "${LOCK_ROOT}" = "true" ]; then
    SERVER_ARGS+=(--lock-root)
fi

if [ "${DAEMON_MODE}" = "true" ]; then
    setsid nohup python3 server.py "${SERVER_ARGS[@]}" </dev/null >/tmp/local-md.log 2>&1 &
    NEW_PID=$!
    disown "${NEW_PID}" 2>/dev/null || true
    echo "${NEW_PID}" > /tmp/local-md.pid
    sleep 1.2
    if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
        echo "✅ Local Markdown Explorer is ONLINE in background (PID ${NEW_PID}, Port 127.0.0.1:${PORT})"
    else
        echo "⚠️  Daemon started (PID ${NEW_PID}); check /tmp/local-md.log for details."
    fi
else
    exec python3 server.py "${SERVER_ARGS[@]}"
fi
