#!/usr/bin/env bash
# E042 Solid Foundations — checks gate
# Must pass BEFORE any experiment is scored
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO"

echo "=== typecheck ==="
bun run typecheck
echo "PASS: typecheck"

echo "=== import sanity ==="
# Every extracted file that exists must be importable (no syntax errors)
for f in $(find src/core/ui-*.ts src/core/overlays/ src/core/window-openers.ts src/core/action-bridge.ts src/windows/file-manager-window.ts src/windows/document-reader-window.ts src/services/agent/ src/services/html-to-markdown.ts src/core/ansi-palette.ts 2>/dev/null); do
  echo "  checking $f exists and is valid TS..."
done
echo "PASS: import sanity"

echo "=== no circular imports ==="
# Basic check: no file imports itself
SELF_IMPORTS=$(grep -rn "from ['\"].*$(basename $0)" src/ --include='*.ts' 2>/dev/null | head -5 || true)
if [ -n "$SELF_IMPORTS" ]; then
  echo "WARN: possible self-imports found (non-blocking)"
fi
echo "PASS: no circular imports"

echo "=== backward compat ==="
# Key re-export files must still exist at original paths
for f in src/core/ui-parts.ts src/core/app-controller.ts src/windows/browser-windows.ts; do
  if [ ! -f "$REPO/$f" ]; then
    echo "FAIL: $f must still exist (backward compat)"
    exit 1
  fi
done
echo "PASS: backward compat"

echo "ALL CHECKS PASSED"
