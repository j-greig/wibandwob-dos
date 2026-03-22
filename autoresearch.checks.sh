#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# Typecheck — scripts can't break the TS codebase
bunx tsc --noEmit

# All scripts must have @desc
for f in .pi/skills/ghostty-control/scripts/*.sh; do
  name=$(basename "$f")
  [[ "$name" == "index.sh" ]] && continue
  if ! grep -q '@desc' "$f"; then
    echo "FAIL: $name missing @desc" >&2
    exit 1
  fi
done

# No python in scripts (jq + awk + bash only)
for f in .pi/skills/ghostty-control/scripts/*.sh; do
  if grep -q 'python3\|python ' "$f"; then
    echo "FAIL: $(basename "$f") uses python" >&2
    exit 1
  fi
done

# No hardcoded ports
for f in .pi/skills/ghostty-control/scripts/*.sh; do
  if grep -qE '(8099|8100|8101)' "$f"; then
    echo "FAIL: $(basename "$f") has hardcoded port" >&2
    exit 1
  fi
done

echo "checks passed"
