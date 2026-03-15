#!/bin/bash
# F6 Plumb — backpressure checks
set -euo pipefail
source ~/.wibwob

echo "=== typecheck ==="
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
wibwob health > /dev/null 2>&1 || { echo "FAIL: health"; exit 1; }
echo "PASS"

echo "=== F5 write regression ==="
wibwob commands -q | grep -q 'microapp.wibwob.figlet.write' || { echo "FAIL: figlet.write missing"; exit 1; }
echo "PASS"

echo "=== F7 CLI table regression ==="
grep -q 'CLI_COMMANDS' src/cli/wibwob.ts || { echo "FAIL: CLI_COMMANDS missing"; exit 1; }
echo "PASS"

echo "=== F8 start/restart regression ==="
grep -q '"start"' src/cli/wibwob.ts || { echo "FAIL: start missing"; exit 1; }
grep -q '"restart"' src/cli/wibwob.ts || { echo "FAIL: restart missing"; exit 1; }
echo "PASS"

echo ""
echo "All checks passed."
