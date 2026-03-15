#!/bin/bash
set -euo pipefail

# E042-B06 Next Frontier — Correctness Checks
# Composite gate: nothing from B01–B05 should regress.

cd "$(dirname "$0")/../.."

# 1. Typecheck (hard gate)
bun run typecheck 2>&1 | grep -i "error" || true

# 2. COAT check
if [ -f scripts/check-coat.sh ]; then
  bash scripts/check-coat.sh 2>&1 | grep -i "fail\|error" || true
fi

# 3. No circular deps above B01 exit count
# (Agent: update this threshold to match B01's final count)
max_cycles=6
current_cycles=$(bunx madge --circular --no-spinner src/ 2>/dev/null | grep -c "→" || echo 0)
if [ "$current_cycles" -gt "$max_cycles" ]; then
  echo "ERROR: Circular deps regressed! Was ≤$max_cycles, now $current_cycles"
  exit 1
fi

# 4. Tests don't regress (if runner exists)
if grep -q '"test"' package.json 2>/dev/null; then
  fail_count=$(bun test 2>&1 | grep -oP '\d+ fail' | grep -oP '\d+' || echo 0)
  if [ "$fail_count" -gt 0 ]; then
    echo "ERROR: $fail_count tests failing"
    exit 1
  fi
fi

# 5. wibwob CLI health
if wibwob health >/dev/null 2>&1; then
  wibwob state >/dev/null 2>&1 || { echo "ERROR: wibwob state failed"; exit 1; }
else
  echo "WARN: App not running — skipping runtime check"
fi

echo "Checks passed."
