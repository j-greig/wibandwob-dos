#!/usr/bin/env bash
set -euo pipefail

cd /Users/james/Repos/wibandwob-dos

WIBWOB="bun run src/cli/wibwob.ts"

echo "=== Preflight checks ==="

# 1. TypeScript compiles
echo "--- typecheck ---"
bun run typecheck 2>&1 | tail -3
echo "  typecheck passed"

# 2. wibwob CLI exists
echo "--- wibwob binary ---"
if [ ! -f src/cli/wibwob.ts ]; then
  echo "FAIL: src/cli/wibwob.ts missing"
  exit 1
fi
echo "  src/cli/wibwob.ts exists"

# 3. wibwob responds to help
HELP_OUT=$($WIBWOB help 2>&1 || true)
if ! echo "$HELP_OUT" | grep -qi 'wibwob\|usage\|commands'; then
  echo "FAIL: wibwob help produces no recognisable output"
  exit 1
fi
echo "  wibwob help responds"

# 4. API is reachable (one raw curl as ground truth)
echo "--- api health ---"
HEALTH=$(curl -s http://127.0.0.1:8099/health | jq -r '.ok' 2>/dev/null || echo "false")
if [ "$HEALTH" != "true" ]; then
  echo "FAIL: API not responding on port 8099"
  exit 1
fi
echo "  API healthy"

# 5. wibwob can reach API
WW_HEALTH=$($WIBWOB health 2>/dev/null | jq -r '.ok' || echo "false")
if [ "$WW_HEALTH" != "true" ]; then
  echo "FAIL: wibwob health failed"
  exit 1
fi
echo "  wibwob health OK"

echo "=== All preflight checks passed ==="
