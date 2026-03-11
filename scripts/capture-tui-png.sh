#!/usr/bin/env bash
# capture-tui-png.sh — capture the current macOS display to a PNG for WibWob-DOS smoke/debug.
#
# Usage:
#   ./scripts/capture-tui-png.sh
#   ./scripts/capture-tui-png.sh scratch/captures/custom.png
#   DISPLAY_NUM=2 ./scripts/capture-tui-png.sh
#
# Notes:
# - This is a machine-level screen capture via macOS screencapture, not a TUI-native render export.
# - Useful for smoke tests, visual evidence, and quick operator captures.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_PATH="${1:-$ROOT_DIR/scratch/captures/tui-$(date +%Y%m%d-%H%M%S).png}"
mkdir -p "$(dirname "$OUT_PATH")"

if [[ -n "${DISPLAY_NUM:-}" ]]; then
  screencapture -x -D "$DISPLAY_NUM" "$OUT_PATH"
else
  screencapture -x "$OUT_PATH"
fi

file "$OUT_PATH"
echo "$OUT_PATH"
