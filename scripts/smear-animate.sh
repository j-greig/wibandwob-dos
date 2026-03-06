#!/usr/bin/env bash
# smear-animate.sh — rapid-cycle smear frames in a primer window as generative art smoke test
# Usage: ./scripts/smear-animate.sh [fx] [primer] [frames] [fps]
#   fx:     bloom | scanline | collapse | glitch  (default: bloom)
#   primer: path to .txt file  (default: synth-faces)
#   frames: number of frames  (default: 12)
#   fps:    frames per second  (default: 6)

set -e
PORT=${CONTROL_API_PORT:-8099}
FX=${1:-bloom}
PRIMER=${2:-/Users/james/Repos/wibandwob-dos/scratch/backrooms-runs/2026-03-03T13-13-23-377Z/primers/synth-faces.txt}
NFRAMES=${3:-12}
FPS=${4:-6}
DELAY=$(python3 -c "print(round(1/$FPS, 3))")
TMPDIR=$(mktemp -d /tmp/smear-anim-XXXX)
SCRIPT=/Users/james/Repos/wibandwob-dos/scripts/ascii-fx.py

echo "=== smear-animate: fx=$FX frames=$NFRAMES fps=$FPS delay=${DELAY}s ==="
echo "    primer: $(basename $PRIMER)"
echo "    frames dir: $TMPDIR"

# pre-generate all frames
for i in $(seq 0 $((NFRAMES-1))); do
  OUTFILE="$TMPDIR/frame-$(printf '%03d' $i).txt"
  case $FX in
    bloom)    python3 $SCRIPT "$PRIMER" --fx bloom    --frame $((i+1)) --seeds $((15 + i*3)) --out "$OUTFILE" 2>/dev/null ;;
    scanline) python3 $SCRIPT "$PRIMER" --fx scanline --frame $i        --skew 3              --out "$OUTFILE" 2>/dev/null ;;
    collapse) python3 $SCRIPT "$PRIMER" --fx collapse --frame $i        --seed $((i*7))       --out "$OUTFILE" 2>/dev/null ;;
    glitch)   python3 $SCRIPT "$PRIMER" --fx glitch   --seed $i         --intensity $(python3 -c "print(round(0.1 + $i*0.07, 2))") --out "$OUTFILE" 2>/dev/null ;;
    *)        echo "unknown fx: $FX"; exit 1 ;;
  esac
  echo -n "."
done
echo " done"

# get content dimensions from first frame
W=$(python3 -c "lines=open('$TMPDIR/frame-000.txt').read().splitlines(); print(max(len(l) for l in lines) if lines else 80)")
H=$(wc -l < "$TMPDIR/frame-000.txt" | tr -d ' ')
WINW=$((W + 4))
WINH=$((H + 2))
echo "    window: ${WINW}x${WINH}"

# open first frame, get window id, position it
curl -s -X POST http://127.0.0.1:$PORT/view/primer/open \
  -H "Content-Type: application/json" \
  -d "{\"filePath\":\"$TMPDIR/frame-000.txt\"}" > /dev/null
sleep 0.3
WIN_ID=$(curl -s http://127.0.0.1:$PORT/state | python3 -c "
import sys,json; s=json.load(sys.stdin)
ws=[w for w in s['windows'] if w.get('appType')=='primer-viewer']
print(ws[-1]['id'] if ws else '')")
echo "    window id: $WIN_ID"
curl -s -X POST http://127.0.0.1:$PORT/windows/batch \
  -H "Content-Type: application/json" \
  -d "{\"ops\":[{\"id\":$WIN_ID,\"x\":2,\"y\":2,\"w\":$WINW,\"h\":$WINH}]}" > /dev/null
sleep 0.3

echo "=== playing ==="
# cycle frames: close prev, open next at same position
PREV_ID=$WIN_ID
for i in $(seq 1 $((NFRAMES-1))); do
  FRAME="$TMPDIR/frame-$(printf '%03d' $i).txt"
  curl -s -X POST http://127.0.0.1:$PORT/view/primer/open \
    -H "Content-Type: application/json" \
    -d "{\"filePath\":\"$FRAME\"}" > /dev/null &
  OPEN_PID=$!
  sleep 0.1
  NEW_ID=$(curl -s http://127.0.0.1:$PORT/state | python3 -c "
import sys,json; s=json.load(sys.stdin)
ws=[w for w in s['windows'] if w.get('appType')=='primer-viewer']
print(ws[-1]['id'] if ws else '')")
  # position new window and close old one atomically
  curl -s -X POST http://127.0.0.1:$PORT/windows/batch \
    -H "Content-Type: application/json" \
    -d "{\"ops\":[{\"id\":$NEW_ID,\"x\":2,\"y\":2,\"w\":$WINW,\"h\":$WINH},{\"id\":$PREV_ID,\"close\":true}]}" > /dev/null
  wait $OPEN_PID 2>/dev/null || true
  PREV_ID=$NEW_ID
  echo -n "$i "
  sleep $DELAY
done
echo ""
echo "=== done. window $PREV_ID is final frame ==="
