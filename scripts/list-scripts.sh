#!/usr/bin/env bash
# @name    list-scripts
# @desc    List all scripts with their name and description from @name/@desc meta
#
# Usage: bash scripts/list-scripts.sh

set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "scripts/ index"
echo ""
printf "  %-28s %s\n" "NAME" "DESCRIPTION"
printf "  %-28s %s\n" "----" "-----------"

for f in "$DIR"/*.sh "$DIR"/*.ts; do
  [ -f "$f" ] || continue
  base="$(basename "$f")"
  name=$(grep -m1 "@name" "$f" 2>/dev/null | sed 's/.*@name *//' || echo "${base%.*}")
  desc=$(grep -m1 "@desc" "$f" 2>/dev/null | sed 's/.*@desc *//' || echo "(no description)")
  printf "  %-28s %s\n" "$name" "$desc"
done
echo ""
echo "$(ls "$DIR"/*.sh "$DIR"/*.ts 2>/dev/null | wc -l | tr -d ' ') scripts total"
echo ""
