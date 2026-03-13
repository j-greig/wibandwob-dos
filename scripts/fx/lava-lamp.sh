#!/usr/bin/env bash
# lava-lamp.sh — Recursive self-melting desktop animation
#
# Each iteration: screenshot → transform → replace desktop → repeat.
# The desktop feeds on its own distortion. Alternates shear and glitch.
#
# Usage: bash scripts/lava-lamp.sh [iterations] [intensity]

set -uo pipefail
cd "$(dirname "$0")/.."

WIBWOB="bun run src/cli/wibwob.ts"
SMEAR=".pi/skills/vj-timeline/scripts/smear.py"
ITERS=${1:-12}
INTENSITY=${2:-7}
OUTDIR="scratch/captures/lava-$(date +%s)"
mkdir -p "$OUTDIR"

echo "=== Lava Lamp — $ITERS iterations ==="

for i in $(seq 1 "$ITERS"); do
  $WIBWOB screenshot > "$OUTDIR/frame-$i.txt" 2>/dev/null

  if [ $((i % 2)) -eq 0 ]; then
    python3 "$SMEAR" "$OUTDIR/frame-$i.txt" --mode shear --skew $((i / 2 + 1)) \
      --out "$OUTDIR/frame-$i-xform.txt" 2>/dev/null
    echo "  frame $i: shear skew=$((i / 2 + 1))"
  else
    python3 "$SMEAR" "$OUTDIR/frame-$i.txt" --mode glitch --intensity "0.$((i * INTENSITY))" --seed "$i" \
      --out "$OUTDIR/frame-$i-xform.txt" 2>/dev/null
    echo "  frame $i: glitch intensity=0.$((i * INTENSITY))"
  fi

  $WIBWOB cmd desktop.clear-all 2>/dev/null; sleep 0.1
  $WIBWOB cmd primer.open --filePath "$PWD/$OUTDIR/frame-$i-xform.txt" --x 0 --y 0 2>/dev/null
  sleep 0.4
done

echo "=== Done. Frames in $OUTDIR/ ==="
