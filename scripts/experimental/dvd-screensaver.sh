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
#   WIBWOB_API  — API base URL (auto-detected from running instance)
#   FRAMES      — number of bounce frames (default: 80)
#   SPEED       — sleep between frames in seconds (default: 0.1)
#   WIN_W       — window width (default: 38)
#   WIN_H       — window height (default: 12)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Auto-detect API from running instance socket
if [ -z "${WIBWOB_API:-}" ]; then
  _sock=""
  for _pf in "$APP_ROOT"/scratch/instances/*.pid; do
    [ -f "$_pf" ] || continue
    _pid=$(cat "$_pf" 2>/dev/null) || continue
    _label=$(basename "$_pf" .pid)
    if kill -0 "$_pid" 2>/dev/null && [ -S "$APP_ROOT/scratch/instances/${_label}.sock" ]; then
      _sock="$APP_ROOT/scratch/instances/${_label}.sock"
      break
    fi
  done
  if [ -n "$_sock" ]; then
    # Get TCP URL from health endpoint via socket
    _h=$(curl -sf --unix-socket "$_sock" "http://localhost/health" 2>/dev/null || true)
    API=$(echo "$_h" | python3 -c "import sys,json; h=json.load(sys.stdin); print(f'http://{h[\"host\"]}:{h[\"port\"]}')" 2>/dev/null || echo "http://127.0.0.1:8099")
  else
    API="http://127.0.0.1:8099"
  fi
else
  API="$WIBWOB_API"
fi
TEXT="${1:-DVD}"
FONT="${2:-banner3}"
FRAMES="${FRAMES:-80}"
SPEED="${SPEED:-0.1}"
WIN_W="${WIN_W:-38}"
WIN_H="${WIN_H:-12}"

# ── Preflight — detect screen size ──
_health=$(curl -sf "$API/health" 2>/dev/null) || { echo "WibWob-DOS not running on $API" >&2; exit 1; }
SCREEN_W=$(echo "$_health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('screen',{}).get('width',205))" 2>/dev/null || echo 205)
SCREEN_H=$(echo "$_health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('screen',{}).get('height',52))" 2>/dev/null || echo 52)

# ── Clear desktop ──
curl -sf -X POST "$API/commands/run" \
  -H "Content-Type: application/json" \
  -d '{"id":"desktop.clear-all"}' >/dev/null
sleep 0.5

# ── Open figlet ──
curl -sf -X POST "$API/commands/run" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"figlet.open\",\"args\":{\"text\":\"$TEXT\",\"font\":\"$FONT\"}}" >/dev/null
sleep 0.8

# ── Get window ID (last opened) ──
FID=$(wibwob windows -q 2>/dev/null | tail -1)

if [ -z "$FID" ]; then
  echo "No window found" >&2
  exit 1
fi

# ── Size the window ──
curl -sf -X POST "$API/windows/batch" \
  -H "Content-Type: application/json" \
  -d "{\"ops\":[{\"id\":$FID,\"width\":$WIN_W,\"height\":$WIN_H,\"left\":2,\"top\":2}]}" >/dev/null

# ── Bounce — adaptive to actual screen size ──
X=2 Y=2 DX=5 DY=2
MAX_X=$((SCREEN_W - WIN_W - 2))
MAX_Y=$((SCREEN_H - WIN_H - 2))

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
