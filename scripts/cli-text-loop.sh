#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%s)"
OUTDIR="$ROOT/scratch/captures/text-loop-$STAMP"
TRANSFORM="${1:-mask}"
API="${WIBWOB_SCRIPT_API:-http://127.0.0.1:8099}"

wibwob() {
  WW_API="$API" bun run "$ROOT/src/cli/wibwob.ts" "$@"
}

mkdir -p "$OUTDIR"
wibwob screenshot > "$OUTDIR/source.txt"

case "$TRANSFORM" in
  mask)
    sed 's/[A-Z]/#/g' "$OUTDIR/source.txt" > "$OUTDIR/render.txt"
    ;;
  mirror)
    rev "$OUTDIR/source.txt" > "$OUTDIR/render.txt"
    ;;
  dense)
    tr ' .' '#@' < "$OUTDIR/source.txt" > "$OUTDIR/render.txt"
    ;;
  *)
    echo "Unknown transform: $TRANSFORM" >&2
    echo "Use: mask | mirror | dense" >&2
    exit 1
    ;;
esac

wibwob cmd primer.open --filePath "$OUTDIR/render.txt" >/dev/null
echo "Opened transformed text artifact: $OUTDIR/render.txt"
