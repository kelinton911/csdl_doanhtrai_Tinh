#!/usr/bin/env bash
# ============================================================================
# switch-to-home-app.sh — CHUYỂN app CSDL sang chạy từ bản /home (thư mục này).
# ----------------------------------------------------------------------------
# Vì bản /media và /home dùng CHUNG project name "csdl-doanhtrai" + trùng cổng
# 8000/3011, chỉ một bản chạy được. Script này:
#   1) Dừng stack bản /media (nếu đang chạy) — GIỮ nguyên volume dữ liệu.
#   2) Build image backend + webapp từ mã nguồn bản /home.
#   3) Dựng cả stack /home (profile "app") — dùng lại volume csdl-doanhtrai_* nên
#      dữ liệu CSDL được giữ nguyên. Backend tự chạy migration khi khởi động.
#
# Dữ liệu KHÔNG bị mất (down không kèm -v; volume dùng chung theo project name).
# Chạy:  bash scripts/switch-to-home-app.sh
# ============================================================================
set -euo pipefail

HOME_DIR="/home/kelinton/P08_Duan_CSDL_doanhtrai_Tinh"
MEDIA_DIR="/media/kelinton/Data/AI_COWORK_MASTER/5_DU_AN/P08_Duan_CSDL_doanhtrai_Tinh"

say()  { printf "\n\033[1;34m==> %s\033[0m\n" "$*"; }
ok()   { printf "\033[0;32m  [OK] %s\033[0m\n" "$*"; }

cd "$HOME_DIR"

if [ -f "$MEDIA_DIR/docker-compose.yml" ]; then
  say "1/3 · Dừng stack bản /media (giữ volume dữ liệu)"
  docker compose -f "$MEDIA_DIR/docker-compose.yml" --profile app down || true
  ok "Đã dừng bản /media (nếu có)."
else
  say "1/3 · Không thấy bản /media — bỏ qua."
fi

say "2/3 · Build image backend + webapp (bản /home)"
docker compose -f docker-compose.yml --profile app build
ok "Build xong."

say "3/3 · Dựng cả stack /home (db, redis, minio, adminer, backend, webapp)"
docker compose -f docker-compose.yml --profile app up -d
ok "Đã dựng stack /home."

cat <<EOF

======================================================================
  ĐÃ CHUYỂN SANG BẢN /home. Truy cập:
    Giao diện : http://localhost:${FRONTEND_HOST_PORT:-8000}
    API       : http://localhost:${BACKEND_HOST_PORT:-3011}/api/v1
  Vì restart=unless-stopped + docker.service đã enabled, stack này SẼ
  TỰ CHẠY mỗi lần bật máy. Muốn chắc chắn hơn (tự tạo lại nếu container
  bị xoá) cài systemd: sudo bash scripts/install-autostart.sh
======================================================================
EOF
