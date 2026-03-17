#!/usr/bin/env bash
# @name    list-scripts
# @desc    List all scripts with their name and description from @name/@desc meta
#
# Usage: bash scripts/list-scripts.sh

set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TOTAL=0

print_section() {
  local dir="$1" label="$2"
  local files=()
  for f in "$dir"/*.sh "$dir"/*.ts; do
    [ -f "$f" ] && files+=("$f")
  done
  [ ${#files[@]} -eq 0 ] && return

  [ -n "$label" ] && echo "── $label ──"
  for f in "${files[@]}"; do
    local name desc
    name=$(grep -m1 "@name" "$f" 2>/dev/null | sed 's/.*@name *//' || echo "$(basename "${f%.*}")")
    desc=$(grep -m1 "@desc" "$f" 2>/dev/null | sed 's/.*@desc *//' || echo "(no description)")
    printf "  %-28s %s\n" "$name" "$desc"
    TOTAL=$((TOTAL + 1))
  done
  echo ""
}

echo ""
echo "scripts/ index"
echo ""
printf "  %-28s %s\n" "NAME" "DESCRIPTION"
printf "  %-28s %s\n" "----" "-----------"

print_section "$DIR" ""
print_section "$DIR/checks" "checks"
print_section "$DIR/testing" "testing"
print_section "$DIR/experimental" "experimental"
print_section "$DIR/fx" "fx"

echo "$TOTAL scripts total"
echo ""
