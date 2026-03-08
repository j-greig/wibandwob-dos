#!/usr/bin/env bash
# png.sh — render WibWob-DOS TUI (or a window) to a PNG image
#
# Usage:
#   bash scripts/png.sh                         # full TUI → /tmp/wibwob-tui.png
#   bash scripts/png.sh <window-id>             # single window
#   bash scripts/png.sh <window-id> out.png     # specify output path
#   bash scripts/png.sh --out path/to/out.png   # full TUI with explicit path
#
# Requires: pip install Pillow
# On Linux: apt-get install -y fonts-dejavu-core  (for sharper monospace font)
#
# The PNG is styled with WibWob-DOS dark theme colours.
# For Discord sharing: use scripts/discord.sh which calls this automatically.

set -euo pipefail
API="${WIBWOB_API:-http://127.0.0.1:8099}"
TOKEN="${WIBWOB_TOKEN:-}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Warn if token not set (protected endpoints)
if [[ -z "$TOKEN" ]]; then
  echo "warning: WIBWOB_TOKEN not set — requests may return 401. Run: eval \"\$(bash scripts/connect.sh)\"" >&2
fi

# Parse args
WIN_ID=""
OUT="/tmp/wibwob-tui.png"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)  OUT="$2"; shift 2 ;;
    --api)  API="$2"; shift 2 ;;
    [0-9]*) WIN_ID="$1"; shift ;;
    *.png)  OUT="$1"; shift ;;
    *)      shift ;;
  esac
done

# Check Pillow
if ! python3 -c "from PIL import Image" 2>/dev/null; then
  echo "error: Pillow not installed" >&2
  echo "  pip install Pillow" >&2
  exit 1
fi

# Get instance label for title (/health is public — no token needed)
LABEL=$(curl -sf --connect-timeout 3 "$API/health" \
  | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('instanceLabel') or d.get('sessionId','?'))" \
  2>/dev/null || echo "wibwobdos")

# Build python args
PY_ARGS=(--api "$API" --out "$OUT" --title "WibWob-DOS · $LABEL")
[[ -n "$WIN_ID" ]] && PY_ARGS+=(--window-id "$WIN_ID")
[[ -n "$TOKEN" ]] && PY_ARGS+=(--token "$TOKEN")

python3 "$SKILL_DIR/tui-to-png.py" "${PY_ARGS[@]}"
