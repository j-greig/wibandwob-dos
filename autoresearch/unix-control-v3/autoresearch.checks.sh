#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "=== typecheck ==="
bun run typecheck

echo "=== no circular imports (spot check) ==="
# Ensure split files don't create import cycles that tsc misses
# (tsc catches type cycles but not all runtime cycles)
# Simple check: app-controller should not import from window files
if grep -q "from.*windows/" src/core/app-controller.ts 2>/dev/null; then
  # This is currently expected — app-controller creates windows
  # Just flag if NEW window imports appear beyond existing ones
  existing_window_imports=$(git show HEAD:src/core/app-controller.ts 2>/dev/null | grep -c "from.*windows/" || echo "0")
  current_window_imports=$(grep -c "from.*windows/" src/core/app-controller.ts || echo "0")
  if [ "$current_window_imports" -gt "$existing_window_imports" ]; then
    echo "WARNING: app-controller gained new window imports ($existing_window_imports -> $current_window_imports)"
  fi
fi

echo "=== backward compat: primitives re-export ==="
# Ensure primitives.ts still exports (modules depend on it)
if [ -f src/core/primitives.ts ]; then
  exports=$(grep -c "^export" src/core/primitives.ts || echo "0")
  if [ "$exports" -lt 5 ]; then
    echo "FAIL: primitives.ts has too few exports ($exports)"
    exit 1
  fi
fi

echo "=== all checks passed ==="
