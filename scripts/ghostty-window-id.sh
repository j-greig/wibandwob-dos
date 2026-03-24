#!/usr/bin/env bash
# ghostty-window-id.sh — find the CGWindowID of a Ghostty window
#
# Matching strategies (--port is most reliable for wibwob instances):
#   --port  <n>     window whose title contains the PID of the process on that port
#   --label <str>   window whose title contains the string (e.g. "e60")
#   --pid   <n>     window whose title contains the given PID
#
# Usage:
#   bash scripts/ghostty-window-id.sh --port 8100
#   bash scripts/ghostty-window-id.sh --label 17d
#   bash scripts/ghostty-window-id.sh --pid 80952
#
# Outputs: CGWindowID on stdout, or exits 1 with message on stderr.
# ─────────────────────────────────────────────────────────────

set -euo pipefail

MODE=""
PATTERN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port|--label|--pid) MODE="${1#--}"; PATTERN="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$MODE" ]]; then
  echo "Usage: $0 --port <n> | --label <str> | --pid <n>" >&2
  exit 1
fi

# Resolve port → PID first (outside Python — simpler)
SEARCH="$PATTERN"
if [[ "$MODE" == "port" ]]; then
  SEARCH=$(lsof -i ":${PATTERN}" -t 2>/dev/null | head -1)
  if [[ -z "$SEARCH" ]]; then
    echo "No process found on port $PATTERN" >&2; exit 1
  fi
  MODE="pid"
fi

python3 - "$MODE" "$SEARCH" << 'PYEOF'
import sys
from Quartz import (CGWindowListCopyWindowInfo, kCGWindowListOptionAll,
                     kCGWindowListExcludeDesktopElements, kCGNullWindowID)

mode    = sys.argv[1]   # "label" or "pid"
pattern = sys.argv[2].lower()

# kCGWindowListOptionAll so windows on other displays are included
windows = CGWindowListCopyWindowInfo(
    kCGWindowListOptionAll | kCGWindowListExcludeDesktopElements,
    kCGNullWindowID
)
for w in windows:
    if 'Ghostty' not in w.get('kCGWindowOwnerName', ''):
        continue
    name = w.get('kCGWindowName', '')
    cgid = w.get('kCGWindowNumber', 0)
    if pattern in name.lower():
        print(cgid)
        sys.exit(0)

print(f"No Ghostty window found for {mode}={pattern}", file=sys.stderr)
sys.exit(1)
PYEOF
