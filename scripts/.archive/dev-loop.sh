#!/usr/bin/env bash
# Auto-restart dev server on crash. Watches for file changes AND
# restarts after crashes with a brief cooldown to avoid spin loops.
#
# Usage: ./scripts/dev-loop.sh
#        CONTROL_API_PORT=8099 ./scripts/dev-loop.sh

set -euo pipefail
cd "$(dirname "$0")/.."

COOLDOWN=2

while true; do
  echo ""
  echo "━━━ Starting WibWob-DOS ($(date +%H:%M:%S)) ━━━"
  echo ""
  bun --watch src/app.ts || true
  echo ""
  echo "━━━ Crashed or stopped. Restarting in ${COOLDOWN}s... ━━━"
  sleep "$COOLDOWN"
done
