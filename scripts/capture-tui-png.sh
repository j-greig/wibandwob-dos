#!/usr/bin/env bash
# @name    capture-tui-png
# @desc    Capture the Ghostty window to PNG (auto-detects via CGWindowList)
# capture-tui-png.sh — capture WibWob-DOS to PNG for visual proof.
#
# Default: auto-finds the Ghostty window via CGWindowList and captures
# exactly that window — no display guessing, works on any monitor layout.
#
# Fallback: --display N captures an entire display (old behavior).
#
# Usage:
#   ./scripts/capture-tui-png.sh                              # auto-find Ghostty
#   ./scripts/capture-tui-png.sh --out scratch/custom.png     # custom output path
#   ./scripts/capture-tui-png.sh --display 2                  # explicit display
#   ./scripts/capture-tui-png.sh --list-displays              # probe displays

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HELPER="$ROOT_DIR/scripts/lib/find-ghostty-window"
OUT_PATH=""
DISPLAY="${DISPLAY_NUM:-}"
LIST_DISPLAYS=0

usage() {
  cat <<EOF
Usage: $0 [options] [out-path]

Options:
  --display <N>       Capture explicit display (bypasses auto-detect)
  --out <path>        Output PNG path
  --list-displays     Probe and print valid display indices
  -h, --help          Show this help

Default (no --display): auto-detects the Ghostty window via CGWindowList
and captures exactly that window using screencapture -l <windowID>.

If out-path/--out is omitted:
  $ROOT_DIR/scratch/captures/tui-<timestamp>.png
EOF
}

probe_displays() {
  local i
  for i in {1..8}; do
    if screencapture -x -D "$i" /dev/null 2>/dev/null; then
      echo "$i"
    fi
  done
}

if ! command -v screencapture >/dev/null 2>&1; then
  echo "screencapture not found (this script requires macOS)." >&2
  exit 1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --display)  DISPLAY="${2:-}"; shift 2 ;;
    --out)      OUT_PATH="${2:-}"; shift 2 ;;
    --list-displays) LIST_DISPLAYS=1; shift ;;
    -h|--help)  usage; exit 0 ;;
    -*)         echo "Unknown option: $1" >&2; usage; exit 1 ;;
    *)          OUT_PATH="$1"; shift ;;
  esac
done

if [[ "$LIST_DISPLAYS" -eq 1 ]]; then
  echo "Valid display indices:"
  probe_displays | awk '{print "  - "$0}'
  exit 0
fi

if [[ -z "$OUT_PATH" ]]; then
  OUT_PATH="$ROOT_DIR/scratch/captures/tui-$(date +%Y%m%d-%H%M%S).png"
fi
mkdir -p "$(dirname "$OUT_PATH")"

if [[ -n "$DISPLAY" ]]; then
  # Explicit display mode (old behavior)
  if ! [[ "$DISPLAY" =~ ^[0-9]+$ ]]; then
    echo "Invalid --display value: $DISPLAY (must be integer)." >&2
    exit 1
  fi
  screencapture -x -D "$DISPLAY" "$OUT_PATH"
else
  # Auto-detect Ghostty window via CGWindowList
  # Build the helper if needed
  if [[ ! -x "$HELPER" ]]; then
    echo "  building find-ghostty-window helper..."
    cc -framework CoreGraphics -framework CoreFoundation \
      "$HELPER.c" -o "$HELPER" 2>/dev/null || {
      echo "Failed to build CGWindowList helper. Use --display N instead." >&2
      exit 1
    }
  fi

  WIN_ID=$("$HELPER" | head -1 | awk '{print $1}')

  if [[ -z "$WIN_ID" ]]; then
    echo "No Ghostty window found on screen. Is Ghostty running?" >&2
    echo "Fallback: $0 --display N" >&2
    exit 1
  fi

  screencapture -l "$WIN_ID" -x "$OUT_PATH"
fi

if [[ ! -s "$OUT_PATH" ]]; then
  echo "Capture failed: output file missing/empty: $OUT_PATH" >&2
  exit 1
fi

if ! file "$OUT_PATH" | grep -q "PNG image data"; then
  echo "Capture failed: output is not PNG image data: $OUT_PATH" >&2
  exit 1
fi

file "$OUT_PATH"
echo "$OUT_PATH"
