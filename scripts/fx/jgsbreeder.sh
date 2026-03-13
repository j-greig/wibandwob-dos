#!/usr/bin/env bash
# jgsbreeder.sh — Breed two Joan Stark ASCII art pieces end-to-end
#
# Picks two jgs primers (or takes paths as args), breeds them through
# all modes, opens results as primers in the TUI.
#
# Usage:
#   bash scripts/fx/jgsbreeder.sh                    # random pair
#   bash scripts/fx/jgsbreeder.sh file1.txt file2.txt  # specific pair

set -uo pipefail
cd "$(dirname "$0")/../.."

WIBWOB="bun run src/cli/wibwob.ts"
BREED="scripts/fx/breed"
PRIMER_DIR="modules-private/ascii-art-farts/primers"
OUTDIR="scratch/captures/jgsbreeder-$(date +%s)"
mkdir -p "$OUTDIR"

if [ $# -ge 2 ]; then
  FILE1="$1"
  FILE2="$2"
else
  # Pick two random primers with reasonable dimensions
  CANDIDATES=$(python3 -c "
import os, random
d = '$PRIMER_DIR'
files = [f for f in os.listdir(d) if f.endswith('.txt')]
random.shuffle(files)
# filter to reasonable size
for f in files[:50]:
    p = os.path.join(d, f)
    lines = open(p).readlines()
    if 5 < len(lines) < 40:
        w = max(len(l.rstrip()) for l in lines) if lines else 0
        if 15 < w < 80:
            print(p)
            if len(open('/dev/stdout','w').name) > 1: pass  # just print
" 2>/dev/null | head -2)
  FILE1=$(echo "$CANDIDATES" | head -1)
  FILE2=$(echo "$CANDIDATES" | tail -1)
fi

if [ -z "$FILE1" ] || [ -z "$FILE2" ]; then
  echo "FAIL: Could not find two suitable primers" >&2
  exit 1
fi

NAME1=$(basename "$FILE1" .txt)
NAME2=$(basename "$FILE2" .txt)
echo "=== JGSBREEDER: $NAME1 × $NAME2 ==="

# Breed through all modes
MODES=("xor" "density" "blend" "random" "interleave")
for mode in "${MODES[@]}"; do
  python3 "$BREED" "$FILE1" "$FILE2" --mode "$mode" --seed 42 \
    --out "$OUTDIR/${NAME1}-x-${NAME2}-${mode}.txt" 2>&1
done

# Open the most interesting ones in TUI
$WIBWOB cmd desktop.clear-all 2>/dev/null; sleep 0.2
$WIBWOB theme.set --name wibwob-phosphor 2>/dev/null

# Source A top-left
$WIBWOB cmd primer.open --filePath "$PWD/$FILE1" --x 2 --y 1 2>/dev/null; sleep 0.1

# Source B top-right
$WIBWOB cmd primer.open --filePath "$PWD/$FILE2" --x 90 --y 1 2>/dev/null; sleep 0.1

# XOR hybrid center
$WIBWOB cmd primer.open --filePath "$PWD/$OUTDIR/${NAME1}-x-${NAME2}-xor.txt" --x 30 --y 15 2>/dev/null; sleep 0.1

# Density hybrid bottom-left
$WIBWOB cmd primer.open --filePath "$PWD/$OUTDIR/${NAME1}-x-${NAME2}-density.txt" --x 2 --y 28 2>/dev/null; sleep 0.1

# Blend hybrid bottom-right
$WIBWOB cmd primer.open --filePath "$PWD/$OUTDIR/${NAME1}-x-${NAME2}-blend.txt" --x 90 --y 28 2>/dev/null; sleep 0.1

# Title
$WIBWOB cmd figlet.open --text "BREED" --font doom 2>/dev/null
BID=$($WIBWOB windows | jq -r '.[-1].id')
$WIBWOB window.move --id "$BID" --x 55 --y 12 2>/dev/null

echo "=== Done. Hybrids in $OUTDIR/ ==="
ls "$OUTDIR/"
