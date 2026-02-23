#!/usr/bin/env bash
# init-submodules.sh — robustly initialise all nested submodules
#
# Run once after a fresh clone, or if build fails with:
#   "add_subdirectory given source ... which is not an existing directory"
#
# Why not plain `git submodule update --init --recursive`?
# vendor/tvterm pins a SHA that isn't on a named branch; plain init fails.
# This script handles the non-standard tvterm init separately.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "📦  Initialising submodules..."

# Standard ones (tvision, claude-system, MicropolisCore)
for mod in vendor/tvision vendor/claude-system vendor/MicropolisCore; do
  if [ -z "$(ls -A "$mod" 2>/dev/null)" ]; then
    echo "  → $mod"
    cd "$mod"
    git fetch origin --depth=1 2>/dev/null || true
    git checkout "$(git branch -r | grep -E 'HEAD|main|master' | tail -1 | sed 's|.*origin/||')" 2>/dev/null || true
    cd - > /dev/null
  else
    echo "  ✓ $mod (already populated)"
  fi
done

# tvterm: pinned SHA may not be fetchable; use origin/master instead
echo "  → vendor/tvterm (special case)"
cd vendor/tvterm
git fetch origin --depth=1 2>/dev/null || true
git checkout origin/master 2>/dev/null || true
git submodule update --init 2>/dev/null || true
cd - > /dev/null

echo ""
echo "✅  All submodules ready. You can now run:"
echo "   cmake . -B build -DCMAKE_BUILD_TYPE=Release"
echo "   cmake --build build --target test_pattern -j\$(sysctl -n hw.logicalcpu)"
