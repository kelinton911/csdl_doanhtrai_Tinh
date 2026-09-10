#!/usr/bin/env bash
# ==============================================================================
# prepare-offline.sh — ĐÓNG GÓI BỘ CÀI OFFLINE WINDOWS (chạy trên máy DEV có Docker + Internet)
# ------------------------------------------------------------------------------
# Việc script làm:
#   1) Build image backend + webapp từ mã nguồn (Dockerfile trong repo).
#   2) Kéo (pull) các image hạ tầng: PostGIS, Redis, MinIO, TileServer.
#   3) docker save TẤT CẢ image -> installer/windows/dist/images/csdl-doanhtrai-images.tar
#   4) Sao chép script cài, compose, GIS geojson, tiles vào dist/.
# Sau đó: mang thư mục dist/ (hoặc biên dịch installer.iss -> Setup.exe) sang máy Windows.
#
# Dùng:  bash installer/windows/prepare-offline.sh
# ==============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"          # installer/windows
REPO="$(cd "$HERE/../.." && pwd)"              # gốc repo
DIST="$HERE/dist"

BACKEND_IMAGE="csdl-doanhtrai-backend:offline"
WEBAPP_IMAGE="csdl-doanhtrai-webapp:offline"
INFRA_IMAGES=(
  "postgis/postgis:16-3.4"
  "redis:7-alpine"
  "minio/minio:latest"
  "maptiler/tileserver-gl:latest"
)

say()  { printf "\n\033[1;34m==> %s\033[0m\n" "$*"; }
ok()   { printf "\033[0;32m  [OK] %s\033[0m\n" "$*"; }
die()  { printf "\033[0;31m  [X] %s\033[0m\n" "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "Chưa có 'docker' trên máy build."
docker info >/dev/null 2>&1 || die "Docker daemon chưa chạy trên máy build."

say "1/5 · Build image backend ($BACKEND_IMAGE)"
docker build -t "$BACKEND_IMAGE" "$REPO/backend"
ok "Backend image xong."

say "2/5 · Build image webapp ($WEBAPP_IMAGE)"
docker build -t "$WEBAPP_IMAGE" "$REPO/webapp"
ok "Webapp image xong."

say "3/5 · Kéo image hạ tầng"
for img in "${INFRA_IMAGES[@]}"; do
  echo "  - pull $img"
  docker pull "$img"
done
ok "Đã có đủ image hạ tầng."

say "4/5 · Dựng thư mục phát hành dist/"
rm -rf "$DIST"
mkdir -p "$DIST/images" "$DIST/tiles" \
         "$DIST/data/docs/vietnam_gis_admin_2026_geojson/vietnam_gis_admin_2026"

# Script + cấu hình cài đặt
cp "$HERE/docker-compose.windows.yml" "$DIST/"
cp "$HERE/.env.windows.example"       "$DIST/"
cp "$HERE/install.ps1"                "$DIST/"
cp "$HERE/install.bat"                "$DIST/"
cp "$HERE/start.bat"                  "$DIST/"
cp "$HERE/stop.bat"                   "$DIST/"
cp "$HERE/seed-demo.bat"              "$DIST/"
cp "$HERE/uninstall.ps1"              "$DIST/"
cp "$HERE/uninstall.bat"              "$DIST/"
cp "$HERE/README-WINDOWS.md"          "$DIST/"

# GIS geojson cho bước seed 'chuỗi vàng' (khoảng 5MB)
GIS_SRC="$REPO/docs/vietnam_gis_admin_2026_geojson/vietnam_gis_admin_2026"
GIS_DST="$DIST/data/docs/vietnam_gis_admin_2026_geojson/vietnam_gis_admin_2026"
cp "$GIS_SRC/vietnam_provinces_2026.geojson"           "$GIS_DST/" || die "Thiếu vietnam_provinces_2026.geojson"
cp "$GIS_SRC/vietnam_communes_2026_attributes.geojson" "$GIS_DST/" || die "Thiếu vietnam_communes_2026_attributes.geojson"

# Cấu hình tile-server (bản đồ nền offline — thêm *.mbtiles vào dist/tiles nếu cần)
cp -r "$REPO/tiles/." "$DIST/tiles/" 2>/dev/null || true
ok "Đã sao chép script + GIS + tiles."

say "5/5 · Xuất image ra 1 tệp tar (docker save)"
docker save -o "$DIST/images/csdl-doanhtrai-images.tar" \
  "$BACKEND_IMAGE" "$WEBAPP_IMAGE" "${INFRA_IMAGES[@]}"
TAR_SIZE="$(du -h "$DIST/images/csdl-doanhtrai-images.tar" | cut -f1)"
ok "Đã xuất image (kích thước: $TAR_SIZE)."

cat <<EOF

======================================================================
  ĐÓNG GÓI XONG. Thư mục phát hành: $DIST
----------------------------------------------------------------------
  Cách 1 — Chép cả thư mục dist/ sang máy Windows, chạy: install.bat
  Cách 2 — Tạo Setup.exe: mở installer/windows/installer.iss bằng
           Inno Setup 6 (trên Windows) rồi Build (Ctrl+F9).
======================================================================
EOF
