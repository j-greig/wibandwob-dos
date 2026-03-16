#!/bin/bash
# wibwob-url-handler.sh — Handle wibwob:// URIs
#
# Usage: wibwob-url-handler.sh "wibwob://open?path=/foo/bar"
#
# Routes to WibWob-DOS file browser if running, otherwise system open.
# Register as macOS URL handler for wibwob:// scheme.

set -euo pipefail

URI="${1:-}"
if [ -z "$URI" ]; then
  echo "Usage: $0 'wibwob://open?path=/path/to/file'"
  exit 1
fi

# Parse path from URI: wibwob://open?path=/foo/bar
PATH_ARG=$(echo "$URI" | sed 's|wibwob://open?path=||; s|%20| |g')

if [ -z "$PATH_ARG" ]; then
  echo "Could not parse path from URI: $URI"
  exit 1
fi

# Check if wibwob is running
if curl -sf http://127.0.0.1:8099/health >/dev/null 2>&1; then
  if [ -d "$PATH_ARG" ]; then
    curl -sf http://127.0.0.1:8099/commands/run \
      -X POST -H "Content-Type: application/json" \
      -d "{\"id\":\"finder.open\",\"args\":{}}" >/dev/null 2>&1
    echo "Opened directory in WibWob-DOS: $PATH_ARG"
  else
    curl -sf http://127.0.0.1:8099/commands/run \
      -X POST -H "Content-Type: application/json" \
      -d "{\"id\":\"editor.open\",\"args\":{\"filePath\":$(printf '%s' "$PATH_ARG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}}" >/dev/null 2>&1
    echo "Opened file in WibWob-DOS: $PATH_ARG"
  fi
else
  open "$PATH_ARG" 2>/dev/null || echo "Failed to open: $PATH_ARG"
  echo "WibWob-DOS not running — opened with system default: $PATH_ARG"
fi
