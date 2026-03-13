#!/usr/bin/env bash
# zoo.sh — A TUI made of animals
#
# Opens a grid of Joan Stark animal ASCII art pieces as tiny windows.
# The desktop becomes a bestiary. Each animal is a window. The windows
# ARE the pixels. Then screenshot the zoo and glitch it — the animals
# bleed into each other.
#
# Usage: bash scripts/zoo.sh

set -uo pipefail
cd "$(dirname "$0")/.."

WIBWOB="bun run src/cli/wibwob.ts"
SMEAR=".pi/skills/vj-timeline/scripts/smear.py"
PRIMER_DIR="$(cd "$(dirname "$0")/../.." && pwd)/modules-private/ascii-art-farts/primers"
OUTDIR="scratch/captures/zoo-$(date +%s)"
mkdir -p "$OUTDIR"

echo "=== The Zoo ==="

$WIBWOB cmd desktop.clear-all 2>/dev/null; sleep 0.2
$WIBWOB theme.set --name wibwob-phosphor 2>/dev/null

# Find animal-themed primers
ANIMALS=$(ls "$PRIMER_DIR" | grep -iE 'cat|bear|bird|fish|dog|monkey|horse|snake|frog|duck|pig|cow|bat|ant|bee|bug|wolf|lion|fox|deer|owl|rat|mouse|panda|penguin|whale|shark|crab|lobster|octopus|squid|turtle|rabbit|bunny|chicken|eagle|hawk|dragon' | sort -R | head -16)

COL=0
ROW=0
COLS=4
W=42
H=12

for animal in $ANIMALS; do
  X=$((2 + COL * (W + 1)))
  Y=$((1 + ROW * (H - 1)))
  
  $WIBWOB cmd primer.open --filePath "$PRIMER_DIR/$animal" --x "$X" --y "$Y" 2>/dev/null
  WID=$($WIBWOB windows | jq -r '.[-1].id')
  $WIBWOB window.resize --id "$WID" --width "$W" --height "$H" 2>/dev/null
  sleep 0.08
  
  COL=$((COL + 1))
  if [ "$COL" -ge "$COLS" ]; then
    COL=0
    ROW=$((ROW + 1))
  fi
done

sleep 0.5
echo "  opened $(echo "$ANIMALS" | wc -w | tr -d ' ') animals"

# Screenshot the zoo
$WIBWOB screenshot > "$OUTDIR/zoo.txt" 2>/dev/null

# Glitch the zoo — animals dissolve into each other
python3 "$SMEAR" "$OUTDIR/zoo.txt" --mode glitch --intensity 0.5 --seed 13 \
  --out "$OUTDIR/zoo-mutant.txt" 2>/dev/null

# Shear the zoo — animals cascade diagonally
python3 "$SMEAR" "$OUTDIR/zoo.txt" --mode shear --skew 3 \
  --out "$OUTDIR/zoo-stampede.txt" 2>/dev/null

echo "=== Done. Files in $OUTDIR/ ==="
echo "  zoo.txt         — the bestiary grid"
echo "  zoo-mutant.txt  — glitched hybrid creatures"
echo "  zoo-stampede.txt — sheared stampede"
