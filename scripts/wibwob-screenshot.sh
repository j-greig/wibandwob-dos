#!/usr/bin/env bash
# wibwob-screenshot.sh — capture the Ghostty window for a given wibwob instance label
# Usage: bash scripts/wibwob-screenshot.sh <label> <outfile.png>
# Example: bash scripts/wibwob-screenshot.sh e60 /tmp/snap.png

set -euo pipefail

LABEL="${1:-}"
OUTFILE="${2:-/tmp/wibwob-snap.png}"

if [[ -z "$LABEL" ]]; then
  echo "Usage: $0 <instance-label> <outfile.png>" >&2
  exit 1
fi

WIN_ID=$(python3 - <<PYEOF
from Quartz import CGWindowListCopyWindowInfo, kCGWindowListOptionOnScreenOnly, kCGNullWindowID
windows = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID)
for w in windows:
    owner = w.get('kCGWindowOwnerName', '')
    name  = w.get('kCGWindowName', '')
    wid   = w.get('kCGWindowNumber', '')
    if 'Ghostty' in owner and '${LABEL}' in str(name):
        print(wid)
        break
PYEOF
)

if [[ -z "$WIN_ID" ]]; then
  echo "No Ghostty window found matching label '${LABEL}'" >&2
  exit 1
fi

echo "Capturing window id=$WIN_ID → $OUTFILE"
screencapture -x -l "$WIN_ID" "$OUTFILE"
echo "Done"
