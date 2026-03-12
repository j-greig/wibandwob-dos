#!/usr/bin/env bash
# capture-tui-png.sh — capture a macOS display to PNG for WibWob visual proof.
#
# IMPORTANT:
# - This captures OS pixels via `screencapture` (not WibWob internals).
# - It is only valid proof if the tmux-attached WibWob UI is visibly on that display.
# - For semantic capture, pair with text tools:
#     /screenshot/text, scripts/screenshot-window.sh, tmux capture-pane.
#
# Usage:
#   ./scripts/capture-tui-png.sh
#   ./scripts/capture-tui-png.sh scratch/captures/custom.png
#   DISPLAY_NUM=2 ./scripts/capture-tui-png.sh
#   ./scripts/capture-tui-png.sh --display 2 --out scratch/captures/custom.png
#   ./scripts/capture-tui-png.sh --list-displays

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_PATH=""
DISPLAY="${DISPLAY_NUM:-}"
LIST_DISPLAYS=0

usage() {
  cat <<EOF
Usage: $0 [options] [out-path]

Options:
  --display <N>       Capture explicit display index (same as DISPLAY_NUM)
  --out <path>        Output PNG path
  --list-displays     Probe and print valid display indices
  -h, --help          Show this help

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
    --display)
      DISPLAY="${2:-}"
      shift 2
      ;;
    --out)
      OUT_PATH="${2:-}"
      shift 2
      ;;
    --list-displays)
      LIST_DISPLAYS=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -* )
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      # positional out path for backward compatibility
      OUT_PATH="$1"
      shift
      ;;
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
  if ! [[ "$DISPLAY" =~ ^[0-9]+$ ]]; then
    echo "Invalid --display value: $DISPLAY (must be integer)." >&2
    exit 1
  fi

  if ! screencapture -x -D "$DISPLAY" /dev/null 2>/dev/null; then
    echo "Display $DISPLAY is not valid on this machine." >&2
    echo "Try: $0 --list-displays" >&2
    exit 1
  fi

  screencapture -x -D "$DISPLAY" "$OUT_PATH"
else
  screencapture -x "$OUT_PATH"
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
