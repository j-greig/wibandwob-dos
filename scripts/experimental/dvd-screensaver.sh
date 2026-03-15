#!/usr/bin/env sh
# @name dvd-screensaver
# @desc Bounce a figlet window around the desktop like a DVD screensaver
#
# Pure POSIX sh. No python, no jq, no node. Just curl + arithmetic.
# Proves the control API is the only interface that matters.
#
# Usage:
#   bash scripts/experimental/dvd-screensaver.sh              # "DVD" in banner3
#   bash scripts/experimental/dvd-screensaver.sh "WIB WOB"    # custom text
#   bash scripts/experimental/dvd-screensaver.sh "COAT" doom   # custom text + font
#
# Env:
#   WIBWOB_API  — API base URL (default: http://127.0.0.1:8099)
#   FRAMES      — number of bounce frames (default: 80)
#   SPEED       — sleep between frames in seconds (default: 0.1)
#   WIN_W       — window width (default: 38)
#   WIN_H       — window height (default: 12)

set -e

API="${WIBWOB_API:-http://127.0.0.1:8099}"
TEXT="${1:-DVD}"
FONT="${2:-banner3}"
FRAMES="${FRAMES:-80}"
SPEED="${SPEED:-0.1}"
WIN_W="${WIN_W:-38}"
WIN_H="${WIN_H:-12}"

# ── Preflight ──
curl -sf "$API/health" >/dev/null 2>&1 || { echo "WibWob-DOS not running on $API" >&2; exit 1; }

# ── Clear desktop ──
curl -sf -X POST "$API/commands/run" \
  -H "Content-Type: application/json" \
  -d '{"id":"desktop.clear-all"}' >/dev/null
sleep 0.5

# ── Open figlet ──
curl -sf -X POST "$API/view/figlet/open-default" \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"$TEXT\",\"font\":\"$FONT\"}" >/dev/null
sleep 0.8

# ── Get window ID (last line from windows -q) ──
W="$HOME/Repos/wibandwob-dos/src/cli/wibwob.ts"
FID=$("$W" windows -q 2>/dev/null | tail -1)

if [ -z "$FID" ]; then
  echo "No window found" >&2
  exit 1
fi

# ── Size the window ──
curl -sf -X POST "$API/windows/batch" \
  -H "Content-Type: application/json" \
  -d "{\"ops\":[{\"id\":$FID,\"width\":$WIN_W,\"height\":$WIN_H,\"left\":2,\"top\":2}]}" >/dev/null

# ── Bounce ──
X=2 Y=2 DX=5 DY=2
MAX_X=$((130 - WIN_W - 2))
MAX_Y=$((38 - WIN_H - 2))

echo "DVD screensaver: \"$TEXT\" ($FONT) — $FRAMES frames, ${SPEED}s interval"

i=0
while [ $i -lt "$FRAMES" ]; do
  X=$((X + DX))
  Y=$((Y + DY))

  # Bounce off walls
  if [ $X -le 0 ] || [ $X -ge $MAX_X ]; then DX=$((-DX)); X=$((X + DX + DX)); fi
  if [ $Y -le 0 ] || [ $Y -ge $MAX_Y ]; then DY=$((-DY)); Y=$((Y + DY + DY)); fi

  curl -sf -X POST "$API/windows/move" \
    -H "Content-Type: application/json" \
    -d "{\"id\":$FID,\"left\":$X,\"top\":$Y}" >/dev/null

  sleep "$SPEED"
  i=$((i + 1))
done

echo "Done. Window $FID resting at $X,$Y"
