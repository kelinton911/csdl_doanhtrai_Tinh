#!/usr/bin/env bash
# ============================================================================
# install-autostart.sh — Cài systemd unit để app CSDL (bản /home) TỰ CHẠY khi boot.
# ----------------------------------------------------------------------------
# Cần quyền root (ghi vào /etc/systemd/system). Chạy:
#     sudo bash scripts/install-autostart.sh
# Gỡ auto-start:
#     sudo systemctl disable --now csdl-doanhtrai
#     sudo rm /etc/systemd/system/csdl-doanhtrai.service && sudo systemctl daemon-reload
# ============================================================================
set -euo pipefail

UNIT_SRC="$(cd "$(dirname "$0")/.." && pwd)/infra/systemd/csdl-doanhtrai.service"
UNIT_DST="/etc/systemd/system/csdl-doanhtrai.service"

if [ "$(id -u)" -ne 0 ]; then
  echo "  [X] Cần chạy bằng root: sudo bash scripts/install-autostart.sh" >&2
  exit 1
fi
[ -f "$UNIT_SRC" ] || { echo "  [X] Không thấy $UNIT_SRC" >&2; exit 1; }

echo "==> Cài unit: $UNIT_DST"
install -m 0644 "$UNIT_SRC" "$UNIT_DST"
systemctl daemon-reload
systemctl enable --now csdl-doanhtrai.service

echo ""
echo "  [OK] Đã bật auto-start. Kiểm tra:"
echo "       systemctl status csdl-doanhtrai --no-pager"
echo "       Bật/tắt tay:  sudo systemctl start|stop csdl-doanhtrai"
