#!/usr/bin/env bash
# @name    spell-storm
# @desc    Generative desktop compositions — cascading, spiraling, stacking windows.
#           Each burst is a deliberate visual formation, not random placement.
#
# Usage:
#   bash scripts/experimental/spell-storm.sh [bursts] [delay]
#
#   bursts  — number of compositions (default: 6)
#   delay   — seconds between spawns (default: 0.12)
#
# Examples:
#   bash scripts/experimental/spell-storm.sh 8 0.1   # 8 compositions, fast
#   bash scripts/experimental/spell-storm.sh 4 0.15   # 4 compositions, slow

set -uo pipefail
cd "$(dirname "$0")/../.."

API="${WIBWOB_API:-http://127.0.0.1:8100}"
BURSTS="${1:-6}"
DELAY="${2:-0.12}"

# Command IDs (use full microapp IDs)
FIGLET="microapp.wibwob.figlet.open"
FIGLET_WRITE="microapp.wibwob.figlet.write"
NOTEPAD="microapp.wibwob.notepad.open"
NOTEPAD_WRITE="microapp.wibwob.notepad.write"
CONTOUR="microapp.wibwob.contour.open"
WORLD="microapp.wibwob.world.open"
JOURNAL="microapp.wibwob.journal.open"
PLASMA="microapp.wibwob.plasma.open"
WORLD_RESEED="microapp.wibwob.world.reseed"
CLEAR="desktop.clear-all"
THEME="theme.cycle"

FONTS=("banner3" "slant" "doom" "standard" "3d")
WORDS=("WIB" "WOB" "WIBWOB" "DOOM" "YES" "NO" "RAW" "AMP" "ECHO" "LOOP")

ww_post() {
  curl -sf -X POST "$API$1" -H "Content-Type: application/json" -d "$2" > /dev/null
}
ww_get() {
  curl -sf "$API$1" 2>/dev/null
}
wid_last_figlet() {
  ww_get /state | python3 -c "
import sys,json
ids=[w['id'] for w in json.load(sys.stdin).get('windows',[])
       if 'figlet' in (w.get('details',{}) or {}).get('appType','').lower()]
print(ids[-1] if ids else '')" 2>/dev/null
}
wid_last_notepad() {
  ww_get /state | python3 -c "
import sys,json
ids=[w['id'] for w in json.load(sys.stdin).get('windows',[])
       if 'notepad' in (w.get('details',{}) or {}).get('appType','').lower()]
print(ids[-1] if ids else '')" 2>/dev/null
}

spawn_figlet() {
  local text="$1" font="$2" x="$3" y="$4" w="$5" h="$6"
  ww_post /commands/run "{\"id\":\"$FIGLET\",\"args\":{\"text\":\"$text\",\"font\":\"$font\"}}"
  sleep 0.15
  local wid
  wid=$(wid_last_figlet)
  if [[ -n "$wid" ]]; then
    ww_post /windows/batch "{\"ops\":[{\"id\":$wid,\"left\":$x,\"top\":$y,\"width\":${w:-50},\"height\":${h:-12}}]}"
    echo "$wid"
  fi
}

spawn_notepad() {
  local text="$1" x="$2" y="$3" w="$4" h="$5"
  ww_post /commands/run "{\"id\":\"$NOTEPAD\",\"args\":{\"text\":\"$text\"}}"
  sleep 0.12
  local wid
  wid=$(wid_last_notepad)
  if [[ -n "$wid" ]]; then
    ww_post /windows/batch "{\"ops\":[{\"id\":$wid,\"left\":$x,\"top\":$y,\"width\":${w:-35},\"height\":${h:-10}}]}"
    echo "$wid"
  fi
}

# ── Compositions ────────────────────────────────────────────────────

# cascade: vertical column, each figlet smaller and offset
comp_cascade() {
  local cx="${1:-30}" start_y="${2:-5}" count="${3:-8}" font="${4:-banner3}"
  local wi=""
  for i in $(seq 0 $((count - 1))); do
    t="${WORDS[$((i % ${#WORDS[@]}))]}"
    w=$((60 - i * 5))
    [[ $w -lt 15 ]] && w=15
    spawn_figlet "$t" "$font" "$cx" "$((start_y + i * 4))" "$w" 10
    sleep "$DELAY"
  done
}

# diagonal: slide from corner to corner
comp_diagonal() {
  local sx="${1:-0}" sy="${2:-0}" dx="${3:-5}" dy="${4:-3}" count="${5:-10}"
  local wi=""
  for i in $(seq 1 $count); do
    xx=$((sx + i * dx))
    yy=$((sy + i * dy))
    [[ $xx -gt 180 ]] && xx=180
    [[ $yy -gt 50 ]] && yy=50
    f="${FONTS[$((i % ${#FONTS[@]}))]}"
    t="${WORDS[$((i % ${#WORDS[@]}))]}"
    spawn_figlet "$t" "$f" "$xx" "$yy" 45 11
    sleep "$DELAY"
  done
}

# cluster: pile at one spot with slight scatter
comp_cluster() {
  local cx="${1:-90}" cy="${2:-25}" count="${3:-12}" spread="${4:-30}"
  for i in $(seq 1 $count); do
    ox=$((RANDOM % spread - spread / 2))
    oy=$((RANDOM % spread - spread / 2))
    xx=$((cx + ox))
    yy=$((cy + oy))
    [[ $xx -lt 1 ]] && xx=1
    [[ $yy -lt 1 ]] && yy=1
    t="$(date +%H%M%S) $i"
    spawn_notepad "$t" "$xx" "$yy" 38 10
    sleep "$DELAY"
  done
}

# corner_explode: radiate from a corner
comp_corner() {
  local corner="${1:-tl}" count="${2:-12}"
  case "$corner" in
    tl) sx=2; sy=2; dx=8; dy=5 ;;
    tr) sx=160; sy=2; dx=-8; dy=5 ;;
    bl) sx=2; sy=45; dx=8; dy=-5 ;;
    br) sx=160; sy=45; dx=-8; dy=-5 ;;
  esac
  for i in $(seq 1 $count); do
    sx=$((sx + dx + (RANDOM % 6 - 3)))
    sy=$((sy + dy + (RANDOM % 6 - 3)))
    [[ $sx -lt 1 ]] && sx=2 && dx=$((-dx))
    [[ $sx -gt 160 ]] && sx=160 && dx=$((-dx))
    [[ $sy -lt 1 ]] && sy=2 && dy=$((-dy))
    [[ $sy -gt 50 ]] && sy=50 && dy=$((-dy))
    f="${FONTS[$((RANDOM % ${#FONTS[@]}))]}"
    t="${WORDS[$((RANDOM % ${#WORDS[@]}))]}"
    spawn_figlet "$t" "$f" "$sx" "$sy" $((25 + RANDOM % 30)) 11
    sleep "$DELAY"
  done
}

# spiral: orbit from centre outward
comp_spiral() {
  local cx="${1:-90}" cy="${2:-25}" count="${3:-14}"
  python3 -- << 'PYEOF'
import sys, math
cx = int(sys.argv[1]); cy = int(sys.argv[2]); count = int(sys.argv[3])
delay = float(sys.argv[4])
for i in range(count):
    angle = i * 0.55 + 0.3
    r = 5 + i * 4
    x = int(cx + r * math.cos(angle))
    y = int(cy + r * math.sin(angle))
    x = max(1, min(180, x))
    y = max(1, min(50, y))
    fonts = ["banner3","slant","doom","standard","3d"]
    words = ["WIB","WOB","WIBWOB","DOOM","YES","NO","RAW","AMP","ECHO","LOOP"]
    f = fonts[i % len(fonts)]
    w = words[i % len(words)]
    print(f"{x}:{y}:{f}:{w}", flush=True)
PYEOF
}

# cross: vertical + horizontal arms from centre
comp_cross() {
  local cx="${1:-90}" cy="${2:-25}" count="${3:-5}"
  for i in $(seq 1 $count); do
    # vertical arm
    yy=$((cy - count * 5 + i * 10))
    [[ $yy -lt 1 ]] && yy=1
    spawn_notepad "V:$i" "$cx" "$yy" 30 8
    sleep "$DELAY"
  done
  for i in $(seq 1 $count); do
    # horizontal arm
    xx=$((cx - count * 8 + i * 16))
    [[ $xx -lt 1 ]] && xx=1
    spawn_notepad "H:$i" "$xx" "$cy" 30 8
    sleep "$DELAY"
  done
  # centre hub
  spawn_figlet "X" "doom" $((cx - 30)) $((cy - 7)) 60 15
}

# stack: same position, growing
comp_stack() {
  local cx="${1:-50}" cy="${2:-15}" count="${3:-6}"
  for i in $(seq 0 $((count - 1))); do
    ww=$((40 + i * 10))
    wh=$((10 + i * 2))
    [[ $ww -gt 110 ]] && ww=110
    [[ $wh -gt 25 ]] && wh=25
    spawn_figlet "LAYER $i" "banner3" "$cx" "$cy" "$ww" "$wh"
    sleep "$DELAY"
  done
}

# scatter_figlets: random positions, varied fonts, same word
comp_scatter() {
  local word="${1:-WIB}" count="${2:-15}"
  for i in $(seq 1 $count); do
    xx=$((RANDOM % 170 + 1))
    yy=$((RANDOM % 45 + 1))
    f="${FONTS[$((RANDOM % ${#FONTS[@]}))]}"
    spawn_figlet "$word" "$f" "$xx" "$yy" $((30 + RANDOM % 40)) 11
    sleep "$DELAY"
  done
}

# ring: windows in a circle
comp_ring() {
  local cx="${1:-90}" cy="${2:-25}" count="${3:-10}" radius="${4:-30}"
  python3 -- << PYEOF
import sys, math
cx=int(sys.argv[1]); cy=int(sys.argv[2]); count=int(sys.argv[3]); r=int(sys.argv[4])
for i in range(count):
    angle = 2 * math.pi * i / count
    x = int(cx + r * math.cos(angle))
    y = int(cy + r * math.sin(angle))
    x=max(1,min(180,x)); y=max(1,min(50,y))
    print(f"{x}:{y}", flush=True)
PYEOF
}

# the main compositions pool — each entry: name:function:args
POOL=(
  "cascade:CASCADE:30:5:8:banner3"
  "diagonal:DIAGONAL:0:0:6:4:12"
  "cluster:CLUSTER:90:25:14:35"
  "corner-tl:CORNER:tl:14"
  "corner-br:CORNER:br:14"
  "cross:CROSS:90:25:6"
  "spiral:SPIRAL:90:25:16"
  "stack:STACK:50:10:7"
  "scatter-wib:SCA:0:18"
  "scatter-wob:SCA:1:18"
)

NUM=${#POOL[@]}

# ── Main ──────────────────────────────────────────────────────────────
echo "=== SPELL STORM: $BURSTS compositions ==="
echo "  delay: ${DELAY}s"

ww_post /commands/run "{\"id\":\"$CLEAR\"}"
sleep 0.3

BATCH=0
TOTAL_WINDOWS=0

cleanup() {
  echo ""
  echo "=== done. ~$TOTAL_WINDOWS windows across $BATCH compositions ==="
}
trap cleanup INT TERM

echo "  casting... ^C to stop"
echo ""

while [[ $BATCH -lt $BURSTS ]]; do
  BATCH=$((BATCH + 1))
  IDX=$((BATCH % NUM))
  IFS=':' read -r NAME FUNC ARG1 ARG2 ARG3 ARG4 ARG5 <<< "${POOL[$IDX]}"

  echo -ne "  \033[1;3$((IDX % 7 + 1))m[BATCH $BATCH/$BURSTS] ${NAME}\033[0m\n"

  # Execute composition
  case "$FUNC" in
    CASCADE)    comp_cascade "$ARG1" "$ARG2" "$ARG3" "$ARG4" ;;
    DIAGONAL)   comp_diagonal "$ARG1" "$ARG2" "$ARG3" "$ARG4" "$ARG5" ;;
    CLUSTER)    comp_cluster "$ARG1" "$ARG2" "$ARG3" "$ARG4" ;;
    CORNER)     comp_corner "$ARG1" "$ARG2" ;;
    CROSS)      comp_cross "$ARG1" "$ARG2" "$ARG3" ;;
    SPIRAL)     comp_spiral "$ARG1" "$ARG2" "$ARG3" ;;
    STACK)      comp_stack "$ARG1" "$ARG2" "$ARG3" ;;
    SCA)        comp_scatter "${WORDS[$ARG1]:-WIB}" "$ARG2" ;;
  esac

  # Flash theme between batches
  ww_post /commands/run "{\"id\":\"$THEME\"}" &

  sleep 0.4
done

cleanup
