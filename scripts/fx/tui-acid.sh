#!/usr/bin/env bash
# tui-acid.sh — The desktop on acid
#
# Rapid theme cycling + glitch + shear + theme cycling again.
# Each iteration compounds. Themes bleed through the distortion
# because screenshots capture colour-as-character-density.
# The result is synesthetic — colour changes become shape changes.
#
# Usage: bash scripts/tui-acid.sh [rounds]

set -uo pipefail
cd "$(dirname "$0")/.."

WIBWOB="bun run src/cli/wibwob.ts"
SMEAR=".pi/skills/vj-timeline/scripts/smear.py"
ROUNDS=${1:-4}
OUTDIR="scratch/captures/acid-$(date +%s)"
mkdir -p "$OUTDIR"
THEMES=("wibwob-phosphor" "wibwob-dark-pastel" "wibwob-light" "wibwob-dark-nord" "wibwob-phosphor")

echo "=== TUI on Acid — $ROUNDS rounds ==="

for r in $(seq 1 "$ROUNDS"); do
  # Flash through themes, screenshot each
  for t in "${THEMES[@]}"; do
    $WIBWOB theme.set --name "$t" 2>/dev/null
    sleep 0.15
  done

  # Capture mid-flash
  $WIBWOB screenshot > "$OUTDIR/r${r}-raw.txt" 2>/dev/null

  # Double-transform: glitch then shear
  python3 "$SMEAR" "$OUTDIR/r${r}-raw.txt" \
    --mode glitch --intensity "0.$((r * 15 + 20))" --seed "$((r * 7))" \
    --out "$OUTDIR/r${r}-glitch.txt" 2>/dev/null

  python3 "$SMEAR" "$OUTDIR/r${r}-glitch.txt" \
    --mode shear --skew "$((r + 1))" \
    --out "$OUTDIR/r${r}-acid.txt" 2>/dev/null

  # Replace desktop with the acid version
  $WIBWOB cmd desktop.clear-all 2>/dev/null; sleep 0.1
  $WIBWOB cmd primer.open --filePath "$PWD/$OUTDIR/r${r}-acid.txt" --x 0 --y 0 2>/dev/null

  # Add a word that dissolves into the next round
  WORDS=("MELT" "DRIP" "GLOW" "POOL")
  $WIBWOB cmd figlet.open --text "${WORDS[$((r-1))]}" --font doom 2>/dev/null
  FID=$($WIBWOB windows | jq -r '.[-1].id')
  $WIBWOB window.move --id "$FID" --x $((r * 20)) --y $((r * 5)) 2>/dev/null

  sleep 0.6
  echo "  round $r: acid applied"
done

echo "=== Done. Frames in $OUTDIR/ ==="
