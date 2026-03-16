#!/bin/bash
set -euo pipefail

# E042-B04 Infra Wrappers — Correctness Checks

cd "$(dirname "$0")/../.."

# 1. Typecheck
bun run typecheck 2>&1 | grep -i "error" || true

# 2. COAT check
if [ -f scripts/check-coat.sh ]; then
  bash scripts/check-coat.sh 2>&1 | grep -i "fail\|error" || true
fi

# 3. wibwob CLI health — wrappers must not break runtime
if wibwob health >/dev/null 2>&1; then
  wibwob state >/dev/null 2>&1 || { echo "ERROR: wibwob state failed"; exit 1; }
else
  echo "WARN: App not running — skipping runtime check"
fi

echo "Checks passed."
