#!/bin/bash
set -euo pipefail

API="http://127.0.0.1:8099"

# ── 1. Typecheck ─────────────────────────────────────────────────
echo "=== typecheck ==="
ERRORS=$(bun run typecheck 2>&1 | grep -i "microapps/journal" || true)
if [ -n "$ERRORS" ]; then
  echo "TYPECHECK FAILED — journal errors:"
  echo "$ERRORS"
  exit 1
fi
echo "PASS: no journal typecheck errors"

# ── 2. API health ───────────────────────────────────────────────
echo "=== health ==="
for i in $(seq 1 10); do
  curl -sf "$API/health" > /dev/null 2>&1 && break
  sleep 1
done
curl -sf "$API/health" > /dev/null 2>&1 || {
  echo "ERROR: API not healthy"
  exit 1
}
echo "PASS: API healthy"

# ── 3. Journal can open ─────────────────────────────────────────
echo "=== open journal ==="
curl -sf -X POST "$API/commands/run" \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.journal.open"}' > /dev/null 2>&1 || true
sleep 3

# ── 4. Journal in state ─────────────────────────────────────────
echo "=== verify state ==="
STATE=$(curl -sf "$API/state" 2>/dev/null || echo "{}")
echo "$STATE" | grep -q "wibwob.journal" || {
  echo "ERROR: journal window not found in /state"
  echo "STATE: $(echo "$STATE" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get("windows",[])), "windows")' 2>/dev/null || echo 'parse error')"
  exit 1
}
echo "PASS: journal in /state"

echo ""
echo "All checks passed."
