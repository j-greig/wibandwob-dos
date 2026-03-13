#!/usr/bin/env bash
# upside-down.sh — Flip the desktop vertically, the Stranger Things TUI
#
# Screenshots, reverses line order (tail -r), opens the inverted world.
# Then layers the original on top at 50% offset for the membrane effect.
#
# Usage: bash scripts/upside-down.sh

set -uo pipefail
cd "$(dirname "$0")/.."

WIBWOB="bun run src/cli/wibwob.ts"
OUTDIR="scratch/captures/upside-down-$(date +%s)"
mkdir -p "$OUTDIR"

echo "=== The Upside Down ==="

$WIBWOB screenshot > "$OUTDIR/rightside-up.txt" 2>/dev/null
tail -r "$OUTDIR/rightside-up.txt" > "$OUTDIR/upside-down.txt"

# Also make a reversed version (mirror left-right)
rev "$OUTDIR/rightside-up.txt" > "$OUTDIR/mirror-world.txt"

# The full inversion: tail -r + rev = rotated 180 degrees
tail -r "$OUTDIR/rightside-up.txt" | rev > "$OUTDIR/rotated-180.txt"

$WIBWOB cmd desktop.clear-all 2>/dev/null; sleep 0.2
$WIBWOB theme.set --name wibwob-dark-nord 2>/dev/null

# Layer: upside down as backdrop
$WIBWOB cmd primer.open --filePath "$PWD/$OUTDIR/upside-down.txt" --x 0 --y 0 2>/dev/null; sleep 0.3

# Original world floating on top, offset
$WIBWOB cmd primer.open --filePath "$PWD/$OUTDIR/rightside-up.txt" --x 20 --y 5 2>/dev/null; sleep 0.3

# 180-rotated in the corner
$WIBWOB cmd primer.open --filePath "$PWD/$OUTDIR/rotated-180.txt" --x 90 --y 20 2>/dev/null; sleep 0.3

$WIBWOB cmd figlet.open --text "UPSIDE" --font doom 2>/dev/null
UID_=$($WIBWOB windows | jq -r '.[-1].id')
$WIBWOB window.move --id "$UID_" --x 60 --y 1 2>/dev/null

echo "=== Done. Files in $OUTDIR/ ==="
