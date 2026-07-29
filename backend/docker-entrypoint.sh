#!/bin/sh
# Khởi động backend trong container: chờ DB → chạy migration → (tuỳ chọn) seed → chạy app.
# Idempotent: migration do TypeORM theo dõi; seed có guard findOne nên chạy lại an toàn.
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

# Chờ CSDL sẵn sàng (phòng khi depends_on healthcheck chưa đủ). Tối đa ~60s.
echo "[entrypoint] Chờ CSDL ${DB_HOST}:${DB_PORT}..."
i=0
until node -e "require('net').createConnection({host:process.env.DB_HOST||'db',port:+(process.env.DB_PORT||5432)}).on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))" 2>/dev/null; do
  i=$((i+1))
  if [ "$i" -ge 30 ]; then
    echo "[entrypoint] LỖI: CSDL không phản hồi sau 60s." >&2
    exit 1
  fi
  sleep 2
done
echo "[entrypoint] CSDL đã sẵn sàng."

# Chạy migration (trừ khi tắt tường minh).
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Chạy migration..."
  npm run migration:run
fi

# Seed dữ liệu (mặc định tắt; bật cho môi trường test/DEV mới).
# THỨ TỰ BẮT BUỘC — danh mục tài sản là dữ liệu NỀN, phải có trước:
#   1) seed:asset-catalog    → 1272 mã của Phụ lục CV 2837/DT-QLDT vào asset_catalog_items
#   2) seed:official-catalog → dựng materials + nhóm vật chất + loại công trình từ (1)
#   3) seed                  → doanh trại/công trình/tồn kho giả lập, LẤY mã từ (1) và (2)
# Bỏ bước (1) thì bước (3) sẽ dừng với lỗi "Chưa có danh mục loại công trình chính thức".
if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] Nạp danh mục tài sản ngành Doanh trại (Phụ lục CV 2837/DT-QLDT)..."
  npm run seed:asset-catalog
  echo "[entrypoint] Dựng danh mục chính thức (vật chất/nhóm/loại công trình)..."
  npm run seed:official-catalog
  echo "[entrypoint] Seed dữ liệu giả lập..."
  npm run seed
fi

echo "[entrypoint] Khởi động ứng dụng: $*"
exec "$@"
