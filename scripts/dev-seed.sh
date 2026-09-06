#!/usr/bin/env bash
# Tạo schema + nạp dữ liệu demo cho DB của instance dev thứ 2 (cổng 5436).
# Chạy một lần sau khi bật hạ tầng dev lần đầu.
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source .env.dev
set +a

echo ">> migration:run trên DB :${DB_PORT}"
npm --prefix backend run migration:run

echo ">> seed tài khoản/dữ liệu demo (chỉ DEV)"
npm --prefix backend run seed

echo "Hoàn tất khởi tạo CSDL dev (DB :${DB_PORT})."
