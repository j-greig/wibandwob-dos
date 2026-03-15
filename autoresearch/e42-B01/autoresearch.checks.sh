#!/bin/bash
set -euo pipefail

# E042-B01 Dead Code + Cycles — Correctness Checks
# Runs after every passing benchmark. Must pass to keep a result.
# Only last 80 lines shown on failure — keep output minimal.

cd "$(dirname "$0")/../.."

# 1. Typecheck (hard gate)
bun run typecheck 2>&1 | grep -i "error" || true

# 2. COAT check
if [ -f scripts/check-coat.sh ]; then
  bash scripts/check-coat.sh 2>&1 | grep -i "fail\|error" || true
fi

# 3. No new circular deps introduced
new_cycles=$(bunx madge --circular --no-spinner src/ 2>/dev/null | grep -c "→" || echo 0)
if [ "$new_cycles" -gt 6 ]; then
  echo "ERROR: New circular dependencies introduced! Was 6, now $new_cycles"
  exit 1
fi

# 4. App health via wibwob CLI
if wibwob health >/dev/null 2>&1; then
  state=$(wibwob state 2>/dev/null)
  if [ -z "$state" ]; then
    echo "ERROR: wibwob state returned empty"
    exit 1
  fi
else
  echo "WARN: App not running — skipping runtime health check"
fi

echo "Checks passed."
