#!/usr/bin/env bash
# kaleidoscope.sh — Mirror the desktop into a 4-quadrant kaleidoscope
#
# Screenshots the desktop, then creates 4 transformed copies:
# original, horizontally flipped, vertically flipped, both flipped.
# Opens them as a 2x2 grid. The desktop reflects itself.
#
# Usage: bash scripts/kaleidoscope.sh

set -uo pipefail
cd "$(dirname "$0")/.."

WIBWOB="bun run src/cli/wibwob.ts"
SMEAR=".pi/skills/vj-timeline/scripts/smear.py"
OUTDIR="scratch/captures/kaleidoscope-$(date +%s)"
mkdir -p "$OUTDIR"

echo "=== Kaleidoscope ==="

# Capture current desktop
$WIBWOB screenshot > "$OUTDIR/source.txt" 2>/dev/null

# Create mirrored versions using rev (horizontal) and tail -r (vertical)
# Quadrant 1: original (top-left half)
head -24 "$OUTDIR/source.txt" | cut -c1-90 > "$OUTDIR/q1.txt"

# Quadrant 2: horizontal mirror (top-right half)
head -24 "$OUTDIR/source.txt" | cut -c1-90 | rev > "$OUTDIR/q2.txt"

# Quadrant 3: vertical mirror (bottom-left half)
head -24 "$OUTDIR/source.txt" | cut -c1-90 | tail -r > "$OUTDIR/q3.txt"

# Quadrant 4: both mirrors (bottom-right half)
head -24 "$OUTDIR/source.txt" | cut -c1-90 | tail -r | rev > "$OUTDIR/q4.txt"

# Also make a full composite — stitch Q1+Q2 side by side, Q3+Q4 below
paste -d'' "$OUTDIR/q1.txt" "$OUTDIR/q2.txt" > "$OUTDIR/top.txt"
paste -d'' "$OUTDIR/q3.txt" "$OUTDIR/q4.txt" > "$OUTDIR/bottom.txt"
cat "$OUTDIR/top.txt" "$OUTDIR/bottom.txt" > "$OUTDIR/kaleidoscope.txt"

# Display
$WIBWOB cmd desktop.clear-all 2>/dev/null; sleep 0.2

# Open the composite full-screen
$WIBWOB cmd primer.open --filePath "$PWD/$OUTDIR/kaleidoscope.txt" --x 0 --y 0 2>/dev/null
sleep 0.5

# Also open quadrants as separate overlapping windows for the cascade effect
$WIBWOB cmd primer.open --filePath "$PWD/$OUTDIR/q1.txt" --x 2 --y 1 2>/dev/null; sleep 0.2
$WIBWOB cmd primer.open --filePath "$PWD/$OUTDIR/q2.txt" --x 92 --y 1 2>/dev/null; sleep 0.2
$WIBWOB cmd primer.open --filePath "$PWD/$OUTDIR/q3.txt" --x 2 --y 24 2>/dev/null; sleep 0.2
$WIBWOB cmd primer.open --filePath "$PWD/$OUTDIR/q4.txt" --x 92 --y 24 2>/dev/null; sleep 0.2

$WIBWOB cmd figlet.open --text "MIRROR" --font slant 2>/dev/null
MID=$($WIBWOB windows | jq -r '.[-1].id')
$WIBWOB window.move --id "$MID" --x 55 --y 18 2>/dev/null

echo "=== Done. Files in $OUTDIR/ ==="
