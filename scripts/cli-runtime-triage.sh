#!/usr/bin/env bash
# @name    cli-runtime-triage
# @desc    Quick runtime health triage via CLI
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTDIR="${1:-$ROOT/scratch/captures/triage-$(date +%s)}"
API="${WIBWOB_SCRIPT_API:-http://127.0.0.1:8099}"

wibwob() {
  WW_API="$API" bun run "$ROOT/src/cli/wibwob.ts" "$@"
}

mkdir -p "$OUTDIR"

wibwob health | tee "$OUTDIR/health.json"
wibwob inspection | tee "$OUTDIR/inspection.json" >/dev/null
wibwob state | tee "$OUTDIR/state.json" >/dev/null
wibwob screenshot | tee "$OUTDIR/desktop.txt" >/dev/null

echo
echo "UI blockers"
jq '.snapshot.ui | {blocked, menu, overlay, blockers}' "$OUTDIR/inspection.json"
echo
echo "Windows"
jq '[.windows[] | {id, title, kind, focused, left, top, width, height, appType: (.details.appType // null)}]' "$OUTDIR/state.json"
echo
echo "Artifacts saved to: $OUTDIR"
