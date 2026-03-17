#!/usr/bin/env sh
# @name dvd-screensaver-v2
# @desc Bouncing figlet, theme cycle on bounce, auto-sized, infinite.
# Usage: dvd-screensaver-v2.sh [text] [font]
# Env: SPEED=0.08 DX=4 DY=2 FRAMES=0 (0=infinite)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Auto-detect API from running instance socket
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
  _h=$(curl -sf --unix-socket "$_sock" "http://localhost/health" 2>/dev/null || true)
  API=$(echo "$_h" | python3 -c "import sys,json; h=json.load(sys.stdin); print(f'http://{h[\"host\"]}:{h[\"port\"]}')" 2>/dev/null || echo "http://127.0.0.1:8099")
  SW=$(echo "$_h" | python3 -c "import sys,json; print(json.load(sys.stdin)['screen']['width'])" 2>/dev/null || echo 205)
  SH=$(echo "$_h" | python3 -c "import sys,json; print(json.load(sys.stdin)['screen']['height'])" 2>/dev/null || echo 52)
else
  echo "No running instance found" >&2; exit 1
fi

TEXT="${1:-DVD}"
FONT="${2:-banner3}"
SPEED="${SPEED:-0.10}"
DX="${DX:-4}"
DY="${DY:-2}"
FRAMES="${FRAMES:-0}"

# Auto-size from figlet output
if command -v figlet >/dev/null 2>&1; then
  FIG=$(figlet -f "$FONT" "$TEXT" 2>/dev/null || true)
  FW=$(echo "$FIG" | awk '{if(length>m)m=length}END{print m}')
  FH=$(echo "$FIG" | wc -l | tr -d ' ')
  W=$((FW + 7))
  H=$((FH + 7))
else
  W=38; H=12
fi
[ $W -gt $((SW - 4)) ] && W=$((SW - 4))
[ $H -gt $((SH - 4)) ] && H=$((SH - 4))
MX=$((SW - W - 2))
MY=$((SH - H - 2))

# Clear + open figlet
curl -sf -X POST "$API/commands/run" \
  -H "Content-Type: application/json" \
  -d '{"id":"desktop.clear-all"}' >/dev/null
sleep 0.5

curl -sf -X POST "$API/commands/run" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"figlet.open\",\"args\":{\"text\":\"$TEXT\",\"font\":\"$FONT\"}}" >/dev/null
sleep 0.8

FID=$(env -u WIBWOB_API wibwob windows -q 2>/dev/null | tail -1)
[ -z "$FID" ] && { echo "No window" >&2; exit 1; }

curl -sf -X POST "$API/windows/batch" \
  -H "Content-Type: application/json" \
  -d "{\"ops\":[{\"id\":$FID,\"width\":$W,\"height\":$H,\"left\":2,\"top\":2}]}" >/dev/null

# Bounce
X=2 Y=2 B=0 C=0 I=0
echo "DVD v2 ${SW}x${SH} win=${W}x${H} — ^C to stop"

while true; do
  X=$((X + DX))
  Y=$((Y + DY))
  HIT=0

  if [ $X -le 0 ] || [ $X -ge $MX ]; then DX=$((-DX)); X=$((X + DX + DX)); HIT=1; fi
  if [ $Y -le 1 ] || [ $Y -ge $MY ]; then DY=$((-DY)); Y=$((Y + DY + DY))
    [ $HIT -eq 1 ] && C=$((C + 1))
    HIT=1
  fi

  if [ $HIT -eq 1 ]; then
    B=$((B + 1))
    curl -sf -X POST "$API/commands/run" \
      -H "Content-Type: application/json" \
      -d '{"id":"theme.cycle"}' >/dev/null &
  fi

  curl -sf -X POST "$API/windows/move" \
    -H "Content-Type: application/json" \
    -d "{\"id\":$FID,\"left\":$X,\"top\":$Y}" >/dev/null

  sleep "$SPEED"
  I=$((I + 1))
  [ "$FRAMES" -gt 0 ] && [ $I -ge "$FRAMES" ] && break
done

echo "Done. $B bounces, $C corners."
