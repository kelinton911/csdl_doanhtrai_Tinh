#!/usr/bin/env bash
# Bật hạ tầng cô lập cho instance dev thứ 2 (DB 5436 / Redis 6381 / MinIO 9006-9007 / Adminer 8083).
# Không đụng stack :8000 (project csdl-doanhtrai).
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose -f docker-compose.dev.yml --env-file .env.dev up -d "$@"

echo
echo "Hạ tầng dev đã bật (project: csdl-doanhtrai-dev):"
echo "  PostGIS   -> localhost:5436"
echo "  Redis     -> localhost:6381"
echo "  MinIO     -> localhost:9006 (console 9007)"
echo "  Adminer   -> http://localhost:8083"
