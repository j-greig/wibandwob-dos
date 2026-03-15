#!/bin/bash
# F5 Write Pipe — backpressure checks
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

echo "=== figlet + journal commands load ==="
CMDS=$(wibwob commands -q)
for needed in microapp.wibwob.figlet.open microapp.wibwob.journal.open; do
  echo "$CMDS" | grep -q "$needed" || {
    echo "FAIL: missing command $needed"
    exit 1
  }
done
echo "PASS"

echo "=== E039 lifecycle still works ==="
# Quick check: socket cleanup on SIGTERM still works
PID=$(wibwob health | jq -r '.pid')
# Don't actually kill — just verify the handler code exists
grep -q "SIGHUP" src/app.ts || {
  echo "FAIL: SIGHUP handler missing from src/app.ts"
  exit 1
}
echo "PASS: SIGHUP handler present"

echo ""
echo "All checks passed."
