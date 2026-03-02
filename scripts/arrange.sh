#!/bin/bash
# arrange.sh — batch arrange windows from a simple layout file
#
# Usage:
#   ./scripts/arrange.sh layout.txt
#   ./scripts/arrange.sh -              # read from stdin
#   echo "3 10 5 40 20" | ./scripts/arrange.sh -
#
# Layout format (one window per line):
#   ID  X  Y  [W  H]
#
# Lines starting with # are comments. Blank lines ignored.
# W and H are optional — omit to keep current size.
#
# Example layout file:
#   # top row
#   3  0  1  40  18
#   4  42 1  50  18
#   # just move, keep size
#   5  95 1

API="${WIBWOB_API:-http://localhost:8099}"

if [[ -z "$1" ]]; then
  echo "Usage: arrange.sh <layout-file | ->"
  exit 1
fi

input="$1"
if [[ "$input" == "-" ]]; then
  input="/dev/stdin"
fi

while IFS= read -r line; do
  # skip comments and blanks
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ "$line" =~ ^[[:space:]]*$ ]] && continue

  # parse fields
  read -r id x y w h <<< "$line"

  if [[ -z "$id" || -z "$x" || -z "$y" ]]; then
    echo "SKIP bad line: $line" >&2
    continue
  fi

  # move
  curl -s -X POST "$API/windows/move" \
    -H 'Content-Type: application/json' \
    -d "{\"id\":$id,\"left\":$x,\"top\":$y}" > /dev/null

  # resize if w and h given
  if [[ -n "$w" && -n "$h" ]]; then
    curl -s -X POST "$API/windows/resize" \
      -H 'Content-Type: application/json' \
      -d "{\"id\":$id,\"width\":$w,\"height\":$h}" > /dev/null
  fi

  echo "  $id → ($x,$y) ${w:+${w}x${h}}"
done < "$input"

echo "Done."
