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
# Local Markdown & Directory Explorer Launcher
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"
ROOT_DIR="${ROOT_DIR:-${DOCS_ROOT:-${DEV_ROOT:-${HOME}}}}"

echo "================================================================="
echo "🚀 Starting Local Markdown Explorer"
echo "   Active Root     : ${ROOT_DIR}"
echo "   Server Port     : ${PORT}"
echo "   Access URL      : http://localhost:${PORT}"
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
export ROOT_DIR="${ROOT_DIR}"
export PORT="${PORT}"
export HOST="${HOST}"

exec python3 server.py --root="${ROOT_DIR}" --port="${PORT}" --host="${HOST}"
