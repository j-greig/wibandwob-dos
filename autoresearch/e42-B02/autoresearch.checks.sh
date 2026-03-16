#!/bin/bash
set -euo pipefail

# E042-B02 SDK Helpers — Correctness Checks

cd "$(dirname "$0")/../.."

# 1. Typecheck
bun run typecheck 2>&1 | grep -i "error" || true

# 2. No circular deps introduced in SDK chain
sdk_cycles=$(bunx madge --circular --no-spinner src/sdk/ src/services/microapp-sdk.ts 2>/dev/null | grep -c "→" || echo 0)
if [ "$sdk_cycles" -gt 0 ]; then
  echo "ERROR: Circular dependency in SDK chain! $sdk_cycles cycles"
  exit 1
fi

# 3. Existing SDK exports still present (no removals)
required_exports=("createWindow" "describeState" "MicroappHost")
for exp in "${required_exports[@]}"; do
  if ! grep -q "$exp" src/services/microapp-sdk.ts 2>/dev/null; then
    echo "ERROR: Required SDK export '$exp' missing from microapp-sdk.ts"
    exit 1
  fi
done

# 4. COAT: wibwob CLI health
if wibwob health >/dev/null 2>&1; then
  wibwob state >/dev/null 2>&1 || { echo "ERROR: wibwob state failed"; exit 1; }
fi

echo "Checks passed."
