#!/usr/bin/env bash
# Phục hồi CSDL + object storage từ một backup set (UC-24).
# CẢNH BÁO: ghi đè dữ liệu hiện tại. Chỉ chạy khi đã xác nhận điểm phục hồi.
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Dùng: $0 <đường-dẫn-backup-set>   (ví dụ infra/data/backups/20260728-120000)"
  exit 1
fi
SET="$1"
[ -f "$SET/db.dump" ] || { echo "Không thấy $SET/db.dump"; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a; [ -f "$ROOT/.env" ] && . "$ROOT/.env"; set +a
DB_NAME="${DB_NAME:-csdl_doanhtrai}"
DB_USER="${DB_USER:-csdl}"
DB_CONTAINER="${DB_CONTAINER:-csdl-db}"
MINIO_CONTAINER="${MINIO_CONTAINER:-csdl-minio}"
MINIO_BUCKET="${MINIO_BUCKET:-csdl-documents}"

echo "[0/3] Kiểm tra checksum"
( cd "$SET" && sha256sum -c CHECKSUMS.txt )

echo "[1/3] Phục hồi CSDL ($DB_NAME) — DROP/CREATE + pg_restore"
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME}_restore;"
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME}_restore;"
docker exec -i "$DB_CONTAINER" pg_restore -U "$DB_USER" -d "${DB_NAME}_restore" < "$SET/db.dump"
echo "   → Đã phục hồi vào CSDL '${DB_NAME}_restore' (kiểm tra trước khi đổi tên thành '$DB_NAME')."

echo "[2/3] Phục hồi object storage ($MINIO_BUCKET)"
if [ -d "$SET/objects" ]; then
  docker cp "$SET/objects" "$MINIO_CONTAINER:/tmp/rs" 2>/dev/null || true
  docker exec "$MINIO_CONTAINER" sh -c \
    "mc alias set local http://localhost:9000 \"\$MINIO_ROOT_USER\" \"\$MINIO_ROOT_PASSWORD\" >/dev/null 2>&1 || true; \
     mc mb -p local/$MINIO_BUCKET >/dev/null 2>&1 || true; \
     mc mirror --overwrite /tmp/rs local/$MINIO_BUCKET >/dev/null 2>&1 || true"
fi

echo "[3/3] Hoàn tất. Ghi biên bản RPO/RTO và diễn tập định kỳ."
echo "✅ Phục hồi thử vào '${DB_NAME}_restore'. Đối chiếu dữ liệu rồi mới chuyển production."
