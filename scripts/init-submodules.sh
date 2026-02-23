#!/usr/bin/env bash
# init-submodules.sh — initialise all git submodules robustly
#
# Handles the tvterm pinned-SHA quirk: if the standard init fails because
# the pinned commit isn't on any remote branch, fetches from origin/master.
#
# Run once after first clone, or after pulling commits that update submodule pins.
# Also safe to re-run at any time.

set -euo pipefail

echo "🔗 Initialising submodules..."

# Standard init — covers most submodules
git submodule update --init --recursive 2>&1 | grep -v "^$" || true

# tvterm needs special handling if pinned SHA isn't on a branch
TVTERM="vendor/tvterm"
if [ -d "$TVTERM" ] && [ -z "$(ls -A $TVTERM 2>/dev/null)" ]; then
  echo "⚠️  $TVTERM empty — trying origin/master fetch workaround..."
  cd "$TVTERM"
  git fetch origin
  git checkout origin/master
  git submodule update --init --recursive
  cd - > /dev/null
  echo "   tvterm: ok"
fi

# Verify key submodules are populated
REQUIRED=("vendor/tvterm" "vendor/MicropolisCore")
ALL_OK=true
for d in "${REQUIRED[@]}"; do
  if [ -z "$(ls -A $d 2>/dev/null)" ]; then
    echo "❌ Still empty after init: $d"
    ALL_OK=false
  else
    echo "   $d: ok"
  fi
done

$ALL_OK && echo "" && echo "✅ All submodules ready." || {
  echo ""
  echo "❌ Some submodules still empty. Check git submodule status and retry."
  exit 1
}
