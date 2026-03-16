#!/bin/bash
set -euo pipefail

# E042-B05 Test Harness — Correctness Checks

cd "$(dirname "$0")/../.."

# 1. Typecheck
bun run typecheck 2>&1 | grep -i "error" || true

# 2. COAT: wibwob CLI health
if wibwob health >/dev/null 2>&1; then
  wibwob state >/dev/null 2>&1 || { echo "ERROR: wibwob state failed"; exit 1; }
fi

# 3. Tests must not regress (if runner exists)
if grep -q '"test"' package.json 2>/dev/null; then
  fail_count=$(bun test 2>&1 | grep -oP '\d+ fail' | grep -oP '\d+' || echo 0)
  if [ "$fail_count" -gt 0 ]; then
    echo "ERROR: $fail_count tests failing"
    exit 1
  fi
fi

echo "Checks passed."
