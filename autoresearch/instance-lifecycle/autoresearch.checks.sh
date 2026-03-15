#!/bin/bash
# E039 Instance Lifecycle — backpressure checks
# Runs after passing benchmark to catch regressions.
#
# Canon: `wibwob` is the command surface. No curl, no ww-* aliases.
set -euo pipefail

source ~/.wibwob

echo "=== typecheck ==="
bun run typecheck 2>&1 | tail -3
if bun run typecheck 2>&1 | grep -qi "error"; then
  echo "FAIL: typecheck errors"
  exit 1
fi
echo "PASS"

echo "=== health ==="
for i in $(seq 1 10); do
  wibwob health > /dev/null 2>&1 && break
  sleep 1
done
wibwob health > /dev/null 2>&1 || {
  echo "FAIL: wibwob health unreachable"
  exit 1
}
echo "PASS"

echo "=== socket exists ==="
LABEL=$(wibwob health | jq -r '.instanceLabel // .instanceId')
SOCK="scratch/instances/${LABEL}.sock"
[ -S "$SOCK" ] || {
  echo "FAIL: socket not found at $SOCK"
  exit 1
}
echo "PASS: $SOCK"

echo "=== core microapps load ==="
CMDS=$(wibwob commands -q)
for needed in microapp.wibwob.figlet.open microapp.wibwob.contour.open microapp.wibwob.runtime-inspector.open; do
  echo "$CMDS" | grep -q "$needed" || {
    echo "FAIL: missing command $needed"
    exit 1
  }
done
echo "PASS: all core microapp commands present"

echo ""
echo "All checks passed."
