#!/bin/bash
# E039 Instance Lifecycle — backpressure checks
# Runs after passing benchmark to catch regressions.
set -euo pipefail

API="http://127.0.0.1:8099"

echo "=== typecheck ==="
bun run typecheck 2>&1 | tail -3
if bun run typecheck 2>&1 | grep -qi "error"; then
  echo "FAIL: typecheck errors"
  exit 1
fi
echo "PASS"

echo "=== health ==="
for i in $(seq 1 10); do
  curl -sf "$API/health" > /dev/null 2>&1 && break
  sleep 1
done
curl -sf "$API/health" > /dev/null 2>&1 || {
  echo "FAIL: API not healthy"
  exit 1
}
echo "PASS"

echo "=== socket exists ==="
LABEL=$(curl -sf "$API/health" | python3 -c "import sys,json; h=json.load(sys.stdin); print(h.get('instanceLabel') or h['instanceId'])")
SOCK="scratch/instances/${LABEL}.sock"
[ -S "$SOCK" ] || {
  echo "FAIL: socket not found at $SOCK"
  exit 1
}
echo "PASS: $SOCK"

echo "=== core microapps load ==="
CMDS=$(curl -sf "$API/commands/list" | python3 -c "
import sys, json
cmds = json.load(sys.stdin)
if isinstance(cmds, dict): cmds = cmds.get('commands', [])
ids = [c['id'] for c in cmds]
for needed in ['microapp.wibwob.figlet.open', 'microapp.wibwob.contour.open', 'microapp.wibwob.runtime-inspector.open']:
    if needed not in ids:
        print(f'MISSING: {needed}')
        exit(1)
print('all present')
")
echo "PASS: $CMDS"

echo ""
echo "All checks passed."
