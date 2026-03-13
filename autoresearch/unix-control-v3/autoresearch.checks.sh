#!/usr/bin/env bash
set -euo pipefail

cd /Users/james/Repos/wibandwob-dos

WIBWOB="bun run src/cli/wibwob.ts"

echo "=== v3 Preflight checks ==="

# 1. TypeScript compiles
echo "--- typecheck ---"
bun run typecheck 2>&1 | tail -3
echo "  typecheck passed"

# 2. wibwob CLI responds
echo "--- wibwob health ---"
WW_HEALTH=$($WIBWOB health 2>/dev/null | jq -r '.ok' || echo "false")
if [ "$WW_HEALTH" != "true" ]; then
  echo "FAIL: wibwob health failed"
  exit 1
fi
echo "  wibwob healthy"

# 3. API reachable (one raw curl as ground truth)
echo "--- api health ---"
HEALTH=$(curl -s http://127.0.0.1:8099/health | jq -r '.ok' 2>/dev/null || echo "false")
if [ "$HEALTH" != "true" ]; then
  echo "FAIL: API not responding"
  exit 1
fi
echo "  API healthy"

# 4. Python3 available (needed for breed.py, ascii-fx)
echo "--- python3 ---"
if ! command -v python3 &>/dev/null; then
  echo "FAIL: python3 not found"
  exit 1
fi
echo "  python3 available"

# 5. Clear desktop before regression test (leftover windows from creative sessions)
$WIBWOB cmd desktop.clear-all 2>/dev/null; sleep 0.5

# 6. v1 test suite still passes (regression gate)
echo "--- v1 regression gate ---"
V1_OUT=$(bash autoresearch/unix-control/autoresearch.sh 2>&1)
V1_SCORE=$(echo "$V1_OUT" | grep 'PASSED:' | grep -oE '[0-9]+' | head -1)
V1_TOTAL=$(echo "$V1_OUT" | grep 'PASSED:' | grep -oE '[0-9]+' | tail -1)
if [ "$V1_SCORE" != "$V1_TOTAL" ]; then
  echo "FAIL: v1 suite regressed ($V1_SCORE/$V1_TOTAL)"
  exit 1
fi
echo "  v1 suite: $V1_SCORE/$V1_TOTAL"

echo "=== All preflight checks passed ==="
