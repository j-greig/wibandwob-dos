#!/usr/bin/env bash
# @desc  List all scripts with descriptions, usage, and valid flags.
# Run this to see the real API — don't guess flags.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Ghostty Control Scripts"
echo "======================="
echo ""

for f in "$SCRIPT_DIR"/*.sh; do
  name=$(basename "$f")
  [[ "$name" == "index.sh" ]] && continue

  desc=$(grep -m1 '# @desc' "$f" 2>/dev/null | sed 's/.*@desc[[:space:]]*//' || echo "(no description)")
  printf "%-28s %s\n" "$name" "$desc"

  # Extract usage block: lines starting with "# Usage:" through next non-comment or blank
  in_usage=false
  while IFS= read -r line; do
    if [[ "$line" =~ ^#\ Usage: ]] || [[ "$line" =~ ^#\ Options: ]]; then
      in_usage=true
    elif $in_usage; then
      # Stop at non-comment line or empty comment that isn't indented usage
      if [[ ! "$line" =~ ^# ]]; then
        break
      fi
      # Stop at a new section header (non-indented comment that isn't a usage/example line)
      if [[ "$line" =~ ^#\ [A-Z] ]] && [[ ! "$line" =~ ^#\ Usage ]] && [[ ! "$line" =~ ^#\ Options ]]; then
        break
      fi
    fi
    if $in_usage; then
      # Strip leading "# " and print indented
      cleaned="${line#\# }"
      cleaned="${cleaned#\#}"
      printf "  %s\n" "$cleaned"
    fi
  done < "$f"

  echo ""
done
