#!/usr/bin/env bash
set -euo pipefail

cd /Users/james/Repos/wibandwob-dos

echo "=== CLI checks ==="

# 1. TypeScript compiles
echo "--- typecheck ---"
bun run typecheck 2>&1 | tail -3
echo "  typecheck passed"

# 2. ww.ts exists and is executable
echo "--- file check ---"
if [ ! -f src/cli/wibwob.ts ]; then
  echo "FAIL: src/cli/wibwob.ts missing"
  exit 1
fi
echo "  src/cli/wibwob.ts exists"

# 3. API is reachable
echo "--- api check ---"
HEALTH=$(curl -s http://127.0.0.1:8099/health | jq -r '.ok' 2>/dev/null || echo "false")
if [ "$HEALTH" != "true" ]; then
  echo "FAIL: API not responding on port 8099"
  exit 1
fi
echo "  API healthy"

echo "=== All checks passed ==="
