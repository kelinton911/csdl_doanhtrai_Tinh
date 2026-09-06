#!/usr/bin/env bash
# Tắt hạ tầng instance dev thứ 2. Giữ nguyên volume dữ liệu.
# Thêm cờ -v để xoá luôn dữ liệu:  scripts/dev-infra-down.sh -v
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose -f docker-compose.dev.yml --env-file .env.dev down "$@"
