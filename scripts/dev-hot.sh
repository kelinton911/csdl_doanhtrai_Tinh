#!/usr/bin/env bash
# ============================================================================
# dev-hot.sh — Bật stack :8000 ở chế độ HOT-RELOAD để phát triển trên Ubuntu.
# ----------------------------------------------------------------------------
# Cùng cổng quen thuộc (webapp :8000, API :3011) nhưng 2 container app chuyển
# sang dev-server bind-mount source: sửa file trong backend/ hoặc webapp/ là
# container tự nạp lại NGAY — KHÔNG cần build lại image.
#
# Hạ tầng (db/redis/minio/adminer) và dữ liệu giữ nguyên (dùng chung volume).
# Overlay: docker-compose.hotreload.yml. Về lại bản build-sẵn: npm run dev:hot:restore
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

FILES=(-f docker-compose.yml -f docker-compose.hotreload.yml)

echo "==> Bật stack :8000 (hot-reload) — backend: nest --watch · webapp: vite dev"
docker compose -p csdl-doanhtrai "${FILES[@]}" --profile app up -d

cat <<EOF

======================================================================
  STACK :8000 ĐANG CHẠY Ở CHẾ ĐỘ HOT-RELOAD
    Giao diện : http://localhost:${FRONTEND_HOST_PORT:-8000}          (vite dev · HMR)
    API       : http://localhost:${BACKEND_HOST_PORT:-3011}/api/v1    (nest --watch)
    Swagger   : http://localhost:${BACKEND_HOST_PORT:-3011}/api/v1/docs

  • Sửa file trong backend/ hoặc webapp/ -> tự nạp lại, KHÔNG build image.
  • Lần đầu backend biên dịch TypeScript ~20-40s. Theo dõi:  npm run dev:hot:logs
  • Không còn service worker/PWA ở dev nên khỏi hard-refresh.
  • Về lại bản build-sẵn (production-like):  npm run dev:hot:restore
  • Nếu đổi dependencies (package.json), tạo lại volume node_modules:
      docker compose -p csdl-doanhtrai ${FILES[*]} --profile app down
      docker volume rm csdl-doanhtrai_backend_node_modules csdl-doanhtrai_webapp_node_modules
      npm run dev:hot
======================================================================
EOF
