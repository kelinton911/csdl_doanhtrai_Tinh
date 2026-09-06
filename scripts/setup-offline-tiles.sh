#!/bin/bash
# ==============================================================================
# Setup Offline Tile Server cho CSDL Doanh trại Tỉnh (P08)
# Hỗ trợ mạng nội bộ quân sự (Air-gapped Network)
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TILES_DIR="$PROJECT_DIR/tiles"

echo "[GIS Offline] Khởi tạo thư mục bản đồ số nội bộ..."
mkdir -p "$TILES_DIR"

# Tạo file cấu hình TileServer config nếu chưa tồn tại
CONFIG_FILE="$TILES_DIR/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    cat << 'EOF' > "$CONFIG_FILE"
{
  "options": {
    "paths": {
      "root": "",
      "fonts": "fonts",
      "styles": "styles",
      "mbtiles": "/tiles"
    },
    "frontPage": true
  },
  "styles": {
    "basic": {
      "style": "basic/style.json",
      "tilejson": {
        "type": "overlay"
      }
    }
  },
  "data": {
    "vietnam-provinces": {
      "mbtiles": "doanhtrai_tinh.mbtiles"
    }
  }
}
EOF
    echo "[GIS Offline] Đã tạo tệp cấu hình mẫu $CONFIG_FILE"
fi

# Kiểm tra các tệp .mbtiles trong thư mục tiles
MBTILES_COUNT=$(find "$TILES_DIR" -name "*.mbtiles" | wc -l)

if [ "$MBTILES_COUNT" -eq 0 ]; then
    echo "----------------------------------------------------------------------"
    echo "[CẢNH BÁO GIS] Chưa tìm thấy tệp dữ liệu bản đồ (.mbtiles) nào trong $TILES_DIR."
    echo "Để bản đồ offline hoạt động:"
    echo "1. Sao chép tệp bản đồ địa bàn tỉnh (ví dụ: doanhtrai_tinh.mbtiles) vào thư mục: $TILES_DIR"
    echo "2. Khởi động lại service tile-server:"
    echo "   docker compose restart tile-server"
    echo "----------------------------------------------------------------------"
else
    echo "[GIS Offline] Đã tìm thấy $MBTILES_COUNT tệp bản đồ .mbtiles trong $TILES_DIR:"
    ls -lh "$TILES_DIR"/*.mbtiles
fi

echo "[GIS Offline] Hoàn tất thiết lập ban đầu cho Offline Tile Server."
