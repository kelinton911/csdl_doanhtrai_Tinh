#!/usr/bin/env bash
# Sao lưu CSDL PostGIS + object storage MinIO (UC-24).
# Dùng cho DEV/nội bộ. KHÔNG để backup chứa secret dạng rõ; mã hóa khi lưu trữ dài hạn.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Nạp biến môi trường (không in secret).
set -a; [ -f "$ROOT/.env" ] && . "$ROOT/.env"; set +a

DB_NAME="${DB_NAME:-csdl_doanhtrai}"
DB_USER="${DB_USER:-csdl}"
DB_CONTAINER="${DB_CONTAINER:-csdl-db}"
MINIO_CONTAINER="${MINIO_CONTAINER:-csdl-minio}"
MINIO_BUCKET="${MINIO_BUCKET:-csdl-documents}"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR:-$ROOT/infra/data/backups}/$STAMP"
mkdir -p "$OUT"

echo "[1/3] pg_dump ($DB_NAME) → $OUT/db.dump"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -F c -d "$DB_NAME" > "$OUT/db.dump"

echo "[2/3] MinIO bucket ($MINIO_BUCKET) → $OUT/objects/"
# mc alias trong container MinIO (dùng biến MINIO_USER/MINIO_PASSWORD của compose).
docker exec "$MINIO_CONTAINER" sh -c \
  "mc alias set local http://localhost:9000 \"\$MINIO_ROOT_USER\" \"\$MINIO_ROOT_PASSWORD\" >/dev/null 2>&1 || true; \
   mc mirror --overwrite local/$MINIO_BUCKET /tmp/bk >/dev/null 2>&1 || true"
docker cp "$MINIO_CONTAINER:/tmp/bk" "$OUT/objects" 2>/dev/null || mkdir -p "$OUT/objects"

echo "[3/3] Checksum + biên bản"
( cd "$OUT" && sha256sum db.dump > CHECKSUMS.txt )
cat > "$OUT/MANIFEST.txt" <<EOF
Backup set: $STAMP
DB: $DB_NAME (pg_dump custom format)
Objects: bucket $MINIO_BUCKET
Tạo lúc: $(date -Is)
Ghi chú: dữ liệu giả lập (DEV). Với PROD: mã hóa + tách vùng lưu trữ + kiểm tra phục hồi định kỳ.
EOF

echo "✅ Xong: $OUT"
echo "   Kiểm tra: (cd $OUT && sha256sum -c CHECKSUMS.txt)"
