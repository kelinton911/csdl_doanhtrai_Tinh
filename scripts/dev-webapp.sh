#!/usr/bin/env bash
# Chạy webapp Vite (hot-reload) cho instance dev thứ 2 tại cổng 8100,
# proxy /api sang backend dev :3100 (BACKEND_ORIGIN từ .env.dev).
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source .env.dev
set +a

echo "Webapp dev -> http://localhost:${FRONTEND_PORT}  (proxy /api -> ${BACKEND_ORIGIN})"
exec npm --prefix webapp run dev -- --port "${FRONTEND_PORT}" --strictPort
