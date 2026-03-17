#!/bin/bash
# wibwob-url-handler.sh — Handle wibwob:// URIs and file paths
# @name    wibwob-url-handler
# @desc    Handle wibwob:// URIs and file paths via router (called by WibWob.app)
# @name    wibwob-url-handler
# @desc    Handle wibwob:// URIs and file paths via router (called by WibWob.app)
#
# Thin wrapper around `wibwob open` which uses lib/wibwob-router.ts
# for smart file-type routing and instance discovery.
#
# Called by:
#   - WibWob.app macOS URL scheme handler (LaunchServices → this script)
#   - Manual: ./scripts/wibwob-url-handler.sh "wibwob://open?path=/foo"
#   - Manual: ./scripts/wibwob-url-handler.sh /path/to/file.md
#
# @see lib/wibwob-router.ts
# @see scripts/create-wibwob-app.sh

set -euo pipefail

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "Usage: $0 <path|wibwob://url>" >&2
  exit 1
fi

# Resolve project root (this script lives in scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Delegate to wibwob open (which uses the router)
exec bun "$PROJECT_ROOT/src/cli/wibwob.ts" open "$TARGET"
