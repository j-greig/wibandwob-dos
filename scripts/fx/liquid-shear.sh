#!/usr/bin/env bash
# liquid-shear.sh — Progressive shear cascade of the live desktop
#
# Screenshots the current TUI, applies increasing shear distortion,
# and opens each frame overlapping the previous. The desktop dissolves
# diagonally into itself. Each frame captures the previous frame's
# distortion, creating compound shearing.
#
# Usage: bash scripts/liquid-shear.sh [steps] [base_skew]
#   steps:     number of shear iterations (default: 5)
#   base_skew: starting skew multiplier (default: 1)

set -uo pipefail
cd "$(dirname "$0")/.."

WIBWOB="bun run src/cli/wibwob.ts"
SMEAR=".pi/skills/vj-timeline/scripts/smear.py"
STEPS=${1:-5}
BASE_SKEW=${2:-1}
OUTDIR="scratch/captures/liquid-shear-$(date +%s)"
mkdir -p "$OUTDIR"

echo "=== Liquid Shear — $STEPS steps, base skew $BASE_SKEW ==="

for i in $(seq 1 "$STEPS"); do
  SKEW=$((BASE_SKEW * i))
  
  # Capture the current desktop (includes previous sheared frames)
  $WIBWOB screenshot > "$OUTDIR/frame-$i.txt" 2>/dev/null
  
  # Shear it
  python3 "$SMEAR" "$OUTDIR/frame-$i.txt" \
    --mode shear --skew "$SKEW" \
    --out "$OUTDIR/frame-$i-sheared.txt" 2>/dev/null
  
  # Open at diagonal offset
  X=$((i * 8))
  Y=$((i * 3))
  $WIBWOB cmd primer.open \
    --filePath "$PWD/$OUTDIR/frame-$i-sheared.txt" \
    --x "$X" --y "$Y" 2>/dev/null
  
  sleep 0.5
  echo "  frame $i: skew=$SKEW at ($X,$Y)"
done

echo "=== Done. Frames in $OUTDIR/ ==="
