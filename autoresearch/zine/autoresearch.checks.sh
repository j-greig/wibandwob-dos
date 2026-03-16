#!/bin/bash
# Zine Moodboard — backpressure checks
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "=== typecheck ==="
if bun run typecheck 2>&1 | grep -qi "error"; then
  echo "FAIL: typecheck errors"
  exit 1
fi
echo "PASS"

echo "=== check-coat ==="
if ! bun run check-coat 2>&1 | grep -q "COAT check passed"; then
  echo "FAIL: COAT violations"
  exit 1
fi
echo "PASS"

echo "=== zine microapp.json valid ==="
if ! bun -e "JSON.parse(require('fs').readFileSync('microapps/zine/microapp.json','utf8'))" 2>/dev/null; then
  echo "FAIL: microapp.json invalid"
  exit 1
fi
echo "PASS"

echo "=== backward compat: loadCanvas API ==="
if ! grep -q "export function loadCanvas" microapps/sy2-chronicles/content-loader.ts; then
  echo "FAIL: loadCanvas export missing"
  exit 1
fi
echo "PASS"

echo ""
echo "All checks passed."
