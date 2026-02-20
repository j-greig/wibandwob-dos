#!/usr/bin/env bash
# wibwobdos-screenshot.sh — capture WibWobDOS screen
#
# Usage:
#   ./scripts/wibwobdos-screenshot.sh              # stdout (pipeable)
#   ./scripts/wibwobdos-screenshot.sh -o file.txt   # save to file
#   ./scripts/wibwobdos-screenshot.sh -f ansi       # ANSI color output
#   ./scripts/wibwobdos-screenshot.sh | some-tool   # pipe to anything
#
# Options:
#   -o FILE    write to file instead of stdout
#   -f FORMAT  "text" (default) or "ansi" (.ans with color escapes)
#   -q         quiet (suppress stderr status messages)
#   -h         help
#
# Examples:
#   # Save plain text
#   ./scripts/wibwobdos-screenshot.sh -o /tmp/screen.txt
#
#   # Pipe ANSI to a PNG renderer
#   ./scripts/wibwobdos-screenshot.sh -f ansi | ansilove -o screen.png
#
#   # Diff two captures
#   ./scripts/wibwobdos-screenshot.sh > before.txt
#   # ... do stuff ...
#   ./scripts/wibwobdos-screenshot.sh | diff before.txt -
#
#   # Feed to another skill / LLM context
#   ./scripts/wibwobdos-screenshot.sh | pbcopy

set -euo pipefail

FORMAT="text"
OUTPUT=""
QUIET=false

while getopts "o:f:qh" opt; do
    case $opt in
        o) OUTPUT="$OPTARG" ;;
        f) FORMAT="$OPTARG" ;;
        q) QUIET=true ;;
        h) head -30 "$0" | grep '^#' | sed 's/^# \?//'; exit 0 ;;
        *) exit 1 ;;
    esac
done

# Pick file extension
case "$FORMAT" in
    text) EXT="txt" ;;
    ansi) EXT="ans" ;;
    *) echo "unknown format: $FORMAT (use 'text' or 'ansi')" >&2; exit 1 ;;
esac

# Trigger screenshot via API
docker compose exec -T substrate bash -c \
  'curl -sf -X POST $WIBWOBDOS_URL/screenshot -H "Content-Type: application/json" -d "{}"' > /dev/null

# Grab latest capture
CONTENT=$(docker compose exec -T wibwobdos bash -c \
  "cat \$(ls -t /opt/wibwobdos/logs/screenshots/*.$EXT | head -1)")

if [ -n "$OUTPUT" ]; then
    echo "$CONTENT" > "$OUTPUT"
    $QUIET || echo "saved → $OUTPUT ($(wc -c < "$OUTPUT") bytes)" >&2
else
    echo "$CONTENT"
fi
