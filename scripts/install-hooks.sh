#!/usr/bin/env bash
# Trỏ git hooks vào thư mục .githooks (được version-control). Chạy một lần sau clone.
set -e
cd "$(dirname "$0")/.."

# Chỉ cấu hình khi đang ở trong repo git.
if git rev-parse --git-dir >/dev/null 2>&1; then
  git config core.hooksPath .githooks
  chmod +x .githooks/* 2>/dev/null || true
  echo "✔ Đã cài git hooks (core.hooksPath=.githooks). Pre-push sẽ chạy 'npm run verify'."
  echo "  Bỏ qua khi cần: git push --no-verify   hoặc   SKIP_VERIFY=1 git push"
else
  echo "⚠ Không phải repo git — bỏ qua cài hooks."
fi
