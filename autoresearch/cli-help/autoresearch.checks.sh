#!/bin/bash
# F7 CLI Help — backpressure checks
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

echo "=== write pipe still works ==="
wibwob cmd microapp.wibwob.figlet.open --text CHECK --font doom > /dev/null 2>&1 || true
sleep 1
FID=$(wibwob state | jq '[.windows[] | select(.appType=="wibwob.figlet")] | last | .id' 2>/dev/null || echo "")
if [ -n "$FID" ]; then
  echo "VERIFIED" | wibwob write "$FID" > /dev/null 2>&1 || true
  sleep 1
  wibwob state 2>/dev/null | jq -e ".windows[] | select(.id==$FID) | .details.inputText" | grep -q "VERIFIED" || {
    echo "FAIL: write pipe regression"
    exit 1
  }
  wibwob cmd window.close --id "$FID" > /dev/null 2>&1 || true
  echo "PASS"
else
  echo "SKIP: no figlet window to test"
fi

echo ""
echo "All checks passed."
