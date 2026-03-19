#!/usr/bin/env bash
# @name    zine-flipbook
# @desc    Cycle through primer files like a flipbook — rapid frame switching
#           Creates one primer window per file, hides/shows in sequence
#
# Usage:
#   bash scripts/experimental/zine-flipbook.sh [primer-dir] [fps] [loops]
#
#   primer-dir  — folder of .txt/.ansi primers (default: microapps/example-primers/primers)
#   fps         — frames per second (default: 6)
#   loops       — how many times through the set (0=infinite, default: 2)
#
# Examples:
#   bash scripts/experimental/zine-flipbook.sh                              # default 6fps, 2 loops
#   bash scripts/experimental/zine-flipbook.sh /path/to/my/art 12 3        # 12fps, 3 loops
#   bash scripts/experimental/zine-flipbook.sh ~/art 4 0                 # slow, infinite

set -uo pipefail
cd "$(dirname "$0")/../.."

API="${WIBWOB_API:-http://127.0.0.1:8100}"
PRIMER_DIR="${1:-microapps/example-primers/primers}"
FPS="${2:-6}"
LOOPS="${3:-2}"
DELAY=$(python3 -c "print(1.0/$FPS)")

# Colour palette for frame counter overlay
COLOURS=("36" "33" "35" "32" "31" "34" "37")
COL_I=0

ww_post() {
  curl -sf -X POST "$API$1" -H "Content-Type: application/json" -d "$2" > /dev/null
}
ww_get() {
  curl -sf "$API$1" 2>/dev/null
}

# ── Gather primers ──────────────────────────────────────────────────
if [[ ! -d "$PRIMER_DIR" ]]; then
  echo "ERROR: primer dir not found: $PRIMER_DIR" >&2
  exit 1
fi

# Filter to reasonable size files
PRIMERS=()
while IFS= read -r primer; do
  [[ -n "$primer" ]] && PRIMERS+=("$primer")
done < <(python3 -c "
import os, sys
d = sys.argv[1]
files = []
for f in os.listdir(d):
    if not f.endswith(('.txt','.ans','.ansi')): continue
    p = os.path.join(d, f)
    lines = open(p).readlines()
    w = max((len(l.rstrip()) for l in lines), default=0)
    h = len(lines)
    if 5 < h < 60 and 10 < w < 150:
        files.append((f, os.path.abspath(p), w, h))
files.sort()
for f, p, w, h in files:
    print(p)
" "$PRIMER_DIR")

COUNT=${#PRIMERS[@]}
if [[ $COUNT -eq 0 ]]; then
  echo "ERROR: no suitable primers found in $PRIMER_DIR" >&2
  exit 1
fi

echo "=== FLIPBOOK: $COUNT primers @ ${FPS}fps (${DELAY}s/frame) ==="
echo "  dir : $PRIMER_DIR"
echo "  loops: ${LOOPS:-infinite}"
echo ""

# Clear desktop first
ww_post /commands/run '{"id":"desktop.clear-all"}'
sleep 0.3

# ── Open all primer windows, stacked at 0,0 ─────────────────────────

FRAME=0
LOOP=0
CURRENT_WID=""
OPENED_FIRST=0

cleanup() {
  echo ""
  echo "=== done. $FRAME frames, $LOOP loops ==="
}
trap cleanup INT TERM

echo "  opening first primer..."
FIRST="${PRIMERS[0]}"
sleep 0.1
ww_post /commands/run "{\"id\":\"primer.open\",\"args\":{\"filePath\":\"$FIRST\",\"x\":1,\"y\":0}}"
sleep 0.3
CURRENT_WID=$(ww_get /state | python3 -c "
import sys,json
ids=[w['id'] for w in json.load(sys.stdin).get('windows',[]) if w.get('kind')=='primer']
print(ids[-1] if ids else '')
" 2>/dev/null || true)

if [[ -z "$CURRENT_WID" ]]; then
  echo "ERROR: could not open first primer" >&2
  exit 1
fi
OPENED_FIRST=1
echo "  window $CURRENT_WID ready. starting flip..."

# ── Flip loop ──────────────────────────────────────────────────────
echo ""
while true; do
  FRAME=$((FRAME + 1))
  IDX=$((FRAME % COUNT))
  PRIMER="${PRIMERS[$IDX]}"
  NAME=$(basename "$PRIMER")
  COL="${COLOURS[$((FRAME % ${#COLOURS[@]}))]}"

  # Update window content by re-opening the primer (the API swaps it)
  # For now: just keep cycling — each frame: close, open next
  ww_post /commands/run "{\"id\":\"window.close\",\"args\":{\"id\":$CURRENT_WID}}"
  sleep 0.03

  ww_post /commands/run "{\"id\":\"primer.open\",\"args\":{\"filePath\":\"$PRIMER\",\"x\":1,\"y\":0}}"
  sleep 0.05

  CURRENT_WID=$(ww_get /state | python3 -c "
import sys,json
ids=[w['id'] for w in json.load(sys.stdin).get('windows',[]) if w.get('kind')=='primer']
print(ids[-1] if ids else '')
" 2>/dev/null || true)

  if [[ -n "$CURRENT_WID" ]]; then
    printf "  \033[${COL}m[%05d] frame %-4d \033[1m%-30s\033[0m\033[${COL}m WID=%s\033[0m\r" \
      "$LOOP" "$FRAME" "$NAME" "$CURRENT_WID" >&2
  else
    printf "  \033[${COL}m[%05d] frame %-4d \033[1m%-30s\033[0m\r" \
      "$LOOP" "$FRAME" "$NAME" >&2
  fi

  sleep "$DELAY"

  if [[ $FRAME -gt 0 ]] && [[ $((FRAME % COUNT)) -eq 0 ]]; then
    LOOP=$((LOOP + 1))
    if [[ $LOOPS -gt 0 ]] && [[ $LOOP -ge "$LOOPS" ]]; then
      break
    fi
  fi
done

cleanup
