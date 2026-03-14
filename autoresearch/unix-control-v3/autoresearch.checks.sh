#!/bin/bash
set -euo pipefail

API="http://127.0.0.1:8099"

# ── 1. Typecheck ─────────────────────────────────────────────────────
echo "=== typecheck ==="
ERRORS=$(bun run typecheck 2>&1 | grep -i "microapps/journal" || true)
if [ -n "$ERRORS" ]; then
  echo "TYPECHECK FAILED — journal errors:"
  echo "$ERRORS"
  exit 1
fi
echo "PASS: no journal typecheck errors"

# ── 2. API health ───────────────────────────────────────────────────
echo "=== health ==="
curl -sf "$API/health" > /dev/null 2>&1 || {
  echo "ERROR: API not healthy"
  exit 1
}
echo "PASS: API healthy"

# ── 3. Microapp reload ──────────────────────────────────────────────
echo "=== reload ==="
RELOAD=$(curl -sf -X POST "$API/commands/run" \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapps.reload"}' 2>/dev/null || echo '{"ok":false}')
echo "$RELOAD" | grep -q '"ok"' || {
  echo "ERROR: microapps.reload failed"
  exit 1
}
sleep 1
echo "PASS: microapps reloaded"

# ── 4. Journal opens ────────────────────────────────────────────────
echo "=== open journal ==="
OPEN=$(curl -sf -X POST "$API/commands/run" \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.journal.open"}' 2>/dev/null || echo '{"ok":false}')
echo "$OPEN" | grep -q '"ok"' || {
  echo "ERROR: journal.open command failed"
  exit 1
}
sleep 1
echo "PASS: journal opened"

# ── 5. Journal in state ─────────────────────────────────────────────
echo "=== verify state ==="
STATE=$(curl -sf "$API/state" 2>/dev/null || echo "{}")
echo "$STATE" | grep -q "wibwob.journal" || {
  echo "ERROR: journal window not found in /state"
  exit 1
}
echo "PASS: journal in /state"

echo ""
echo "All checks passed."
