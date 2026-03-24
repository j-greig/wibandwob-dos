#!/usr/bin/env bash
# ghostty-capture.sh — screenshot a specific Ghostty window to a PNG file
#
# Finds the window using ghostty-window-id.sh (label, cwd, or port strategy)
# then calls screencapture -l <cgid>.
#
# Usage:
#   bash scripts/ghostty-capture.sh --port 8100 /tmp/snap.png
#   bash scripts/ghostty-capture.sh --label e60  /tmp/snap.png
#   bash scripts/ghostty-capture.sh --cwd wibandwob-dos /tmp/snap.png
#
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── config ────────────────────────────────────────────────────
OUTFILE="/tmp/wibwob-snap.png"
MATCH_FLAG=""
MATCH_VALUE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --label|--cwd|--port) MATCH_FLAG="$1"; MATCH_VALUE="$2"; shift 2 ;;
    *.png|*.jpg) OUTFILE="$1"; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$MATCH_FLAG" ]]; then
  echo "Usage: $0 --port <n> | --label <str> | --cwd <str>  [outfile.png]" >&2
  exit 1
fi

WIN_ID=$(bash "$SCRIPT_DIR/ghostty-window-id.sh" "$MATCH_FLAG" "$MATCH_VALUE")
echo "Window CGWindowID: $WIN_ID → $OUTFILE"
screencapture -x -l "$WIN_ID" "$OUTFILE"
echo "Captured."
