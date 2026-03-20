#!/usr/bin/env bash
# @name    contour-drift
# @desc    Pan the WibWobWorld contour map across the screen like a radar sweep
#           Simultaneously opens a figlet compass rose and status window
#
# Usage:
#   bash scripts/experimental/contour-drift.sh [steps] [speed]
#   # e.g.
#   bash scripts/experimental/contour-drift.sh 0 0.15   # infinite, fast
#   bash scripts/experimental/contour-drift.sh 60 0.3   # 60 frames, medium

set -uo pipefail
cd "$(dirname "$0")/../.."

API="${WIBWOB_API:-http://127.0.0.1:8100}"
STEPS="${1:-0}"
SPEED="${SPEED:-0.20}"
WIN_W="${WIN_W:-90}"
WIN_H="${WIN_H:-40}"
COMPASS_W=28
COMPASS_H=12
STATUS_W=35
STATUS_H=8

ww_post() {
  curl -sf -X POST "$API$1" -H "Content-Type: application/json" -d "$2" > /dev/null
}
ww_get() {
  curl -sf "$API$1" 2>/dev/null
}

# Compass rose directions
DIRS=("N→" "NE→" "E→" "SE→" "S→" "SW→" "W→" "NW→")
DIR_I=0
DVEL=1  # direction index velocity

# Pan state
PX=0; PY=0
DPX=1; DPY=1

# ── Setup ──────────────────────────────────────────────────────────────
echo "=== CONTOUR DRIFT: ${STEPS:-∞} steps @ ${SPEED}s ==="
echo "  API  : $API"

ww_post /commands/run '{"id":"desktop.clear-all"}'
sleep 0.2

# Open contour map
ww_post /commands/run '{"id":"microapp.wibwob.contour.open"}'
sleep 0.4

CONTOUR_WID=$(ww_get /state | python3 -c "
import sys,json
ids=[w['id'] for w in json.load(sys.stdin).get('windows',[]) if 'contour' in w.get('details',{}).get('appType','')]
print(ids[-1] if ids else '')
" 2>/dev/null || true)

if [[ -z "$CONTOUR_WID" ]]; then
  echo "ERROR: could not open contour map" >&2
  exit 1
fi
ww_post /windows/batch "{\"ops\":[{\"id\":$CONTOUR_WID,\"width\":$WIN_W,\"height\":$WIN_H,\"left\":0,\"top\":0}]}"
echo "  contour WID=$CONTOUR_WID"

# Open compass rose (figlet)
sleep 0.1
ww_post /commands/run '{"id":"microapp.wibwob.figlet.open","args":{"text":"N→","font":"banner3"}}'
sleep 0.2
COMPASS_WID=$(ww_get /state | python3 -c "
import sys,json
ids=[w['id'] for w in json.load(sys.stdin).get('windows',[]) if 'figlet' in w.get('details',{}).get('appType','')]
print(ids[-1] if ids else '')
" 2>/dev/null || true)

if [[ -n "$COMPASS_WID" ]]; then
  ww_post /windows/batch "{\"ops\":[{\"id\":$COMPASS_WID,\"width\":$COMPASS_W,\"height\":$COMPASS_H,\"left\":92,\"top\":1}]}"
  echo "  compass WID=$COMPASS_WID"
fi

# Open terrain lab
sleep 0.1
ww_post /commands/run '{"id":"terrain-lab.open"}'
sleep 0.2
TERRAIN_WID=$(ww_get /state | python3 -c "
import sys,json
ids=[w['id'] for w in json.load(sys.stdin).get('windows',[]) if 'terrain' in w.get('title','').lower() or 'terrain' in w.get('details',{}).get('appType','')]
print(ids[-1] if ids else '')
" 2>/dev/null || true)

if [[ -n "$TERRAIN_WID" ]]; then
  ww_post /windows/batch "{\"ops\":[{\"id\":$TERRAIN_WID,\"width\":50,\"height\":20,\"left\":92,\"top\":14}]}"
  echo "  terrain WID=$TERRAIN_WID"
fi

echo ""
echo "  drifting... ^C to stop"

# ── Drift loop ────────────────────────────────────────────────────────
FRAME=0
cleanup() {
  echo ""
  echo "=== done. $FRAME frames, pan=($PX,$PY) ==="
}
trap cleanup INT TERM

while true; do
  FRAME=$((FRAME + 1))

  # Bounce the pan
  if [[ $PX -ge 20 ]] || [[ $PX -le -10 ]]; then DPX=$((-DPX)); fi
  if [[ $PY -ge 15 ]] || [[ $PY -le -8 ]]; then DPY=$((-DPY)); fi
  PX=$((PX + DPX))
  PY=$((PY + DPY))

  # Move contour map (negative = pan right/down into the terrain)
  NX=$((0 - PX))
  NY=$((0 - PY))
  ww_post /windows/move "{\"id\":$CONTOUR_WID,\"left\":$NX,\"top\":$NY}"

  # Rotate compass
  if [[ $((FRAME % 6)) -eq 0 ]]; then
    DIR_I=$(( (DIR_I + DVEL) % ${#DIRS[@]} ))
    if [[ -n "$COMPASS_WID" ]]; then
      ww_post /commands/run "{\"id\":\"microapp.wibwob.figlet.write\",\"args\":{\"windowId\":$COMPASS_WID,\"text\":\"${DIRS[$DIR_I]}\"}}"
    fi
  fi

  # Occasionally reseed terrain
  if [[ $((FRAME % 20)) -eq 0 ]]; then
    ww_post /commands/run '{"id":"microapp.wibwob.world.reseed"}'
  fi

  printf "  \033[36mframe %-5d\033[0m pan=(%+.2d,%+.2d) dir=%s\r" "$FRAME" "$PX" "$PY" "${DIRS[$DIR_I]}" >&2

  sleep "$SPEED"

  [[ $STEPS -gt 0 ]] && [[ $FRAME -ge "$STEPS" ]] && break
done

cleanup
