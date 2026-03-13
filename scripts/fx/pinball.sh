#!/usr/bin/env bash
# pinball.sh — Bounce a figlet window around the desktop like Pong
#
# The window bounces off walls. Every few frames, the desktop is
# screenshotted and sheared — leaving smeared trails like step-and-repeat
# in Photoshop. Theme flashes on wall bounces. The trails accumulate
# as primer windows underneath, creating a compound motion blur.
#
# Usage: bash scripts/fx/pinball.sh [text] [steps] [speed]
#   text:  figlet text (default: DOOM)
#   steps: number of bounce frames (default: 25)
#   speed: pixels per step (default: 14)

set -uo pipefail
cd "$(dirname "$0")/../.."

WIBWOB="bun run src/cli/wibwob.ts"
TEXT=${1:-DOOM}
STEPS=${2:-25}
SPEED=${3:-14}
TRAIL_FREQ=3

$WIBWOB cmd desktop.clear-all 2>/dev/null; sleep 0.2
$WIBWOB theme.set --name wibwob-phosphor 2>/dev/null

$WIBWOB cmd figlet.open --text "$TEXT" --font doom 2>/dev/null; sleep 0.2
BALL=$($WIBWOB windows | jq -r '.[-1].id')

DW=$($WIBWOB state | jq '.desktop.width')
DH=$($WIBWOB state | jq '.desktop.height')

X=10 Y=3 DX=$SPEED DY=$((SPEED / 3 + 1))
BALL_W=22 BALL_H=10
THEMES=("wibwob-phosphor" "wibwob-dark-pastel" "wibwob-dark-nord")

for step in $(seq 1 "$STEPS"); do
  $WIBWOB window.move --id "$BALL" --x "$X" --y "$Y" 2>/dev/null

  if [ $((step % TRAIL_FREQ)) -eq 0 ]; then
    $WIBWOB screenshot | scripts/fx/shear $((step / TRAIL_FREQ)) > "/tmp/pinball-$step.txt" 2>/dev/null
    $WIBWOB cmd primer.open --filePath "/tmp/pinball-$step.txt" --x 0 --y 0 2>/dev/null
    $WIBWOB window.focus --id "$BALL" 2>/dev/null
  fi

  sleep 0.12

  X=$((X + DX)); Y=$((Y + DY))

  if [ "$X" -le 1 ] || [ "$X" -ge $((DW - BALL_W)) ]; then
    DX=$((-DX)); X=$((X + DX + DX))
    $WIBWOB theme.set --name "${THEMES[$((RANDOM % ${#THEMES[@]}))]}" 2>/dev/null
  fi
  if [ "$Y" -le 1 ] || [ "$Y" -ge $((DH - BALL_H)) ]; then
    DY=$((-DY)); Y=$((Y + DY + DY))
  fi
done

$WIBWOB screenshot | scripts/fx/glitch 0.3 > scratch/captures/pinball-finale.txt 2>/dev/null
$WIBWOB cmd desktop.clear-all 2>/dev/null; sleep 0.1
$WIBWOB cmd primer.open --filePath "$PWD/scratch/captures/pinball-finale.txt" --x 0 --y 0 2>/dev/null
$WIBWOB cmd figlet.open --text "GAME OVER" --font doom 2>/dev/null
GID=$($WIBWOB windows | jq -r '.[-1].id')
$WIBWOB window.move --id "$GID" --x 50 --y 16 2>/dev/null

echo "=== Pinball complete ==="
