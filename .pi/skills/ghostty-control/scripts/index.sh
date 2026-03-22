#!/usr/bin/env bash
# @desc  List all scripts in this directory with their @desc one-liners.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Ghostty Control Scripts"
echo "======================="
echo ""

for f in "$SCRIPT_DIR"/*.sh; do
  name=$(basename "$f")
  [[ "$name" == "index.sh" ]] && continue
  desc=$(grep -m1 '# @desc' "$f" 2>/dev/null | sed 's/.*@desc[[:space:]]*//' || echo "(no description)")
  printf "  %-24s %s\n" "$name" "$desc"
done
