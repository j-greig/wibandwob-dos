#!/usr/bin/env bash
# @desc  Find text on screen and click it. Searches wibwob screenshot for the string.
#
# Usage:
#   bash click-text.sh "OK"                # find "OK", double-click it
#   bash click-text.sh "Quit" --single     # single click
#   bash click-text.sh "OK" --occurrence 2 # click the 2nd match
set -euo pipefail

TEXT="${1:?usage: click-text.sh <text> [--single] [--occurrence N]}"
shift

CLICKS_FLAG=""
OCCURRENCE=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --single)      CLICKS_FLAG="--single"; shift ;;
    --occurrence)  OCCURRENCE="$2"; shift 2 ;;
    *)             echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

eval "$("${SCRIPT_DIR}/calibrate.sh")"
export CELL_W CELL_H GHOSTTY_WIN_INDEX

# Find text in screenshot using pure bash
SCREENSHOT=$(wibwob screenshot 2>/dev/null)
N=0
FOUND_ROW="" FOUND_COL=""
while IFS= read -r line; do
  case "$line" in
    *"$TEXT"*)
      N=$((N + 1))
      if [[ $N -eq $OCCURRENCE ]]; then
        # Get col: length of prefix before match
        prefix="${line%%"$TEXT"*}"
        FOUND_COL=$(( ${#prefix} + ${#TEXT} / 2 ))
        break
      fi
      ;;
  esac
  FOUND_ROW=$((${FOUND_ROW:-0} + 1))
done <<< "$SCREENSHOT"

# FOUND_ROW was incremented for non-matching lines; the match line is the current count
FOUND_ROW=${FOUND_ROW:-0}

if [[ -z "$FOUND_COL" ]]; then
  echo "text not found: \"$TEXT\"" >&2
  exit 1
fi

bash "${SCRIPT_DIR}/click-cell.sh" "$FOUND_COL" "$FOUND_ROW" $CLICKS_FLAG
