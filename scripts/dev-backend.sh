#!/usr/bin/env bash
# Chạy backend NestJS (hot-reload) cho instance dev thứ 2 tại cổng 3100,
# trỏ vào hạ tầng cô lập (DB 5436 / Redis 6381 / MinIO 9006).
#
# Biến từ .env.dev được export ra shell nên THẮNG file ../.env mà backend nạp
# (dotenv/@nestjs/config không ghi đè biến process.env đã set).
set -euo pipefail
cd "$(dirname "$0")/.."

# Export toàn bộ biến trong .env.dev ra môi trường tiến trình.
set -a
# shellcheck disable=SC1091
source .env.dev
set +a

echo "Backend dev -> http://localhost:${BACKEND_PORT}/${API_PREFIX}  (DB :${DB_PORT})"
exec npm --prefix backend run start:dev
