#!/usr/bin/env sh
# @name dvd-wib-to-wob
# @desc WIB↔WOB alternating figlet bounce with SFX and theme cycling.
# Usage: dvd-wib-to-wob.sh [font]
# Env: SPEED=0.10 DX=4 DY=2

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SFX_BOUNCE="$APP_ROOT/scratch/cli-experiments/sfx/hit-word.wav"
SFX_THEME="$APP_ROOT/scratch/cli-experiments/sfx/hit-theme.wav"

# Auto-detect API
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
[ -z "$_sock" ] && { echo "No running instance" >&2; exit 1; }
_h=$(curl -sf --unix-socket "$_sock" "http://localhost/health" 2>/dev/null) || { echo "not running" >&2; exit 1; }
API=$(echo "$_h" | python3 -c "import sys,json; h=json.load(sys.stdin); print(f'http://{h[\"host\"]}:{h[\"port\"]}')" 2>/dev/null)
SW=$(echo "$_h" | python3 -c "import sys,json; print(json.load(sys.stdin)['screen']['width'])" 2>/dev/null)
SH=$(echo "$_h" | python3 -c "import sys,json; print(json.load(sys.stdin)['screen']['height'])" 2>/dev/null)

FONT="${1:-doom}"
SPEED="${SPEED:-0.10}" DX="${DX:-4}" DY="${DY:-2}"
WORD="WIB"

# Measure both words, use the bigger
if command -v figlet >/dev/null 2>&1; then
  W1=$(figlet -f "$FONT" "WIB" 2>/dev/null | awk '{if(length>m)m=length}END{print m}')
  W2=$(figlet -f "$FONT" "WOB" 2>/dev/null | awk '{if(length>m)m=length}END{print m}')
  FH=$(figlet -f "$FONT" "WIB" 2>/dev/null | wc -l | tr -d ' ')
  FW=$((W1 > W2 ? W1 : W2))
  W=$((FW + 7)) H=$((FH + 7))
else
  W=30 H=15
fi
[ $W -gt $((SW - 4)) ] && W=$((SW - 4))
[ $H -gt $((SH - 4)) ] && H=$((SH - 4))
MX=$((SW - W - 2)) MY=$((SH - H - 2))

post() { curl -sf -X POST "$API$1" -H "Content-Type: application/json" -d "$2" >/dev/null; }
sfx() { [ -f "$1" ] && ffplay -nodisp -autoexit -volume 80 "$1" >/dev/null 2>&1 & }

# Fun macOS voices for WIB/WOB
VOICES="Albert Bahh Bells Boing Bubbles Wobble Zarvox Trinoids Whisper Jester Cellos Fred"
pick_voice() { echo "$VOICES" | tr ' ' '\n' | sort -R | head -1; }
SAY_OFFSET="${SAY_OFFSET:--0.2}"
speak() {
  # Phonetic spelling so macOS says "wib"/"wob" not "W I B"
  case "$1" in
    WIB) w="wibb" ;; WOB) w="wobb" ;; *) w="$1" ;;
  esac
  # Negative offset: sleep absorbs it (fire early next cycle)
  say -v "$(pick_voice)" -r 250 "$w" &
}

# Setup
post /commands/run '{"id":"desktop.clear-all"}'
sleep 0.3
post /commands/run "{\"id\":\"figlet.open\",\"args\":{\"text\":\"$WORD\",\"font\":\"$FONT\"}}"
sleep 0.5
FID=$(env -u WIBWOB_API wibwob windows -q 2>/dev/null | tail -1)
[ -z "$FID" ] && { echo "No window" >&2; exit 1; }
post /windows/batch "{\"ops\":[{\"id\":$FID,\"width\":$W,\"height\":$H,\"left\":2,\"top\":2}]}"

# Bounce
X=2 Y=2 B=0
echo "WIB↔WOB ${SW}x${SH} win=${W}x${H} — ^C to stop"

PREFIRED=0
while true; do
  # Look ahead: will NEXT frame bounce?
  NX=$((X + DX + DX)) NY=$((Y + DY + DY))
  WILL_HIT=0
  [ $NX -le 0 ] || [ $NX -ge $MX ] && WILL_HIT=1
  [ $NY -le 1 ] || [ $NY -ge $MY ] && WILL_HIT=1
  # Pre-fire voice 1 frame early
  if [ $WILL_HIT -eq 1 ] && [ $PREFIRED -eq 0 ]; then
    NEXT_WORD="WOB"; [ "$WORD" = "WOB" ] && NEXT_WORD="WIB"
    speak "$NEXT_WORD"
    PREFIRED=1
  fi

  X=$((X + DX)) Y=$((Y + DY)) HIT=0
  if [ $X -le 0 ] || [ $X -ge $MX ]; then DX=$((-DX)); X=$((X + DX + DX)); HIT=1; fi
  if [ $Y -le 1 ] || [ $Y -ge $MY ]; then DY=$((-DY)); Y=$((Y + DY + DY)); HIT=1; fi

  if [ $HIT -eq 1 ]; then
    B=$((B + 1))
    if [ "$WORD" = "WIB" ]; then WORD="WOB"; else WORD="WIB"; fi
    post /commands/run "{\"id\":\"microapp.wibwob.figlet.write\",\"args\":{\"windowId\":$FID,\"text\":\"$WORD\"}}"
    post /commands/run '{"id":"theme.cycle"}' &
    sfx "$SFX_BOUNCE"
    PREFIRED=0
  fi

  post /windows/move "{\"id\":$FID,\"left\":$X,\"top\":$Y}"
  sleep "$SPEED"
done
