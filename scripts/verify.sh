#!/usr/bin/env bash
# ============================================================================
# verify.sh — Kiểm thử tự động toàn ngăn xếp trong container (chạy sau mỗi đợt PT).
#
#   Các bước:
#     1) Build image backend + e2e (nest build & vite build = kiểm tra biên dịch)
#     2) Unit test backend (Jest) trong container
#     3) E2E toàn stack: db(ephemeral)+minio+backend(migrate+seed)+Playwright (5 luồng)
#     4) Dọn dẹp sạch + báo cáo PASS/FAIL
#
#   Dùng: scripts/verify.sh            # chạy đầy đủ (mặc định)
#         KEEP=1 scripts/verify.sh     # giữ container sau khi chạy để soi lỗi
#         scripts/verify.sh --e2e-only # bỏ qua unit test
#         scripts/verify.sh --unit-only# chỉ unit test
#   Mã thoát: 0 = PASS, khác 0 = FAIL (dùng được cho git hook / CI).
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.test.yml -p csdl-test"
START=$(date +%s)

RUN_UNIT=1
RUN_E2E=1
case "${1:-}" in
  --e2e-only)  RUN_UNIT=0 ;;
  --unit-only) RUN_E2E=0 ;;
  "" ) ;;
  *) echo "Tham số không hợp lệ: $1"; exit 2 ;;
esac

# Màu (bỏ qua nếu không phải TTY).
if [ -t 1 ]; then R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[1;34m'; N='\033[0m'; else R=; G=; Y=; B=; N=; fi
say()  { printf "${B}▸ %s${N}\n" "$*"; }
ok()   { printf "${G}✔ %s${N}\n" "$*"; }
warn() { printf "${Y}⚠ %s${N}\n" "$*"; }
err()  { printf "${R}✘ %s${N}\n" "$*"; }

teardown() {
  if [ "${KEEP:-0}" = "1" ]; then
    warn "KEEP=1 → giữ nguyên container (soi lỗi: $COMPOSE logs). Dọn thủ công: $COMPOSE down -v"
  else
    say "Dọn dẹp ngăn xếp test..."
    $COMPOSE down -v --remove-orphans >/dev/null 2>&1 || true
  fi
}
trap teardown EXIT

# --- Tiền kiểm tra ---
if ! docker info >/dev/null 2>&1; then
  err "Docker chưa chạy hoặc không truy cập được. Hãy khởi động Docker rồi thử lại."
  exit 1
fi

printf "\n${B}══════════════════════════════════════════════════════════${N}\n"
printf "${B}  CSDL Doanh trại — KIỂM THỬ TỰ ĐỘNG (container hoá)${N}\n"
printf "${B}══════════════════════════════════════════════════════════${N}\n\n"

# Bắt đầu từ trạng thái sạch (phòng lần chạy trước treo).
$COMPOSE down -v --remove-orphans >/dev/null 2>&1 || true

# --- 1) Build image (kiêm kiểm tra biên dịch TS) ---
say "1/3 · Build image backend + e2e (gồm nest build & vite build)..."
if ! $COMPOSE build; then
  err "BUILD THẤT BẠI — lỗi biên dịch hoặc phụ thuộc. Xem log phía trên."
  exit 1
fi
ok "Build xong."

# --- 2) Unit test backend (Jest) ---
if [ "$RUN_UNIT" = "1" ]; then
  say "2/3 · Unit test backend (Jest)..."
  if ! $COMPOSE run --rm --no-deps --entrypoint sh backend -c "npm test"; then
    err "UNIT TEST THẤT BẠI."
    exit 1
  fi
  ok "Unit test PASS."
else
  warn "2/3 · Bỏ qua unit test (--e2e-only)."
fi

# --- 3) E2E toàn stack ---
if [ "$RUN_E2E" = "1" ]; then
  say "3/3 · E2E toàn stack (db+minio+backend+Playwright)..."
  set +e
  $COMPOSE up --abort-on-container-exit --exit-code-from e2e
  E2E_CODE=$?
  set -e
  if [ "$E2E_CODE" != "0" ]; then
    err "E2E THẤT BẠI (mã $E2E_CODE). Log backend gần nhất:"
    $COMPOSE logs --tail 40 backend || true
    exit 1
  fi
  ok "E2E PASS (5 luồng nghiệp vụ)."
else
  warn "3/3 · Bỏ qua E2E (--unit-only)."
fi

DUR=$(( $(date +%s) - START ))
printf "\n${G}══════════════════════════════════════════════════════════${N}\n"
printf "${G}  ✔ TẤT CẢ KIỂM THỬ ĐẠT — sẵn sàng cho đợt phát triển mới${N}\n"
printf "${G}  Thời gian: ${DUR}s${N}\n"
printf "${G}══════════════════════════════════════════════════════════${N}\n"
