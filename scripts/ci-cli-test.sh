#!/usr/bin/env bash
set -euo pipefail
# CI parity gate — runs the wibwob CLI test suite against a live API.
#
# Prerequisites:
#   - API running on port 8099 (or WW_API set)
#   - bun installed
#
# Usage:
#   bash scripts/ci-cli-test.sh          # run full suite
#   bash scripts/ci-cli-test.sh --quick  # preflight checks only

cd "$(dirname "$0")/.."

echo "=== CI CLI Parity Test ==="

# Preflight
echo "--- preflight ---"
bun run typecheck 2>&1 | tail -3
echo "  typecheck OK"

WIBWOB="bun run src/cli/wibwob.ts"
HEALTH=$($WIBWOB health 2>/dev/null | jq -r '.ok' || echo "false")
if [ "$HEALTH" != "true" ]; then
  echo "FAIL: API not reachable. Start the app first."
  exit 1
fi
echo "  API healthy"

if [ "${1:-}" = "--quick" ]; then
  echo "=== Quick preflight passed ==="
  exit 0
fi

# Full suite
echo "--- running v1 parity suite ---"
bash autoresearch/unix-control/autoresearch.sh
V1_EXIT=$?

echo ""
echo "--- running v2 backlog suite ---"
bash autoresearch/unix-control-v2/autoresearch.sh
V2_EXIT=$?

if [ "$V1_EXIT" -ne 0 ]; then
  echo "FAIL: v1 parity suite failed"
  exit 1
fi

echo ""
echo "=== CI CLI tests complete ==="
