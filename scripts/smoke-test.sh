#!/usr/bin/env bash
# Smoke test: opens main window types via control API, checks state, cleans up.
# Requires the app to be running on port 8099.
set -euo pipefail

API="http://127.0.0.1:8099"
FAIL=0
OPENED_IDS=()

# Cleanup on exit (including failures)
cleanup() {
  for WID in "${OPENED_IDS[@]}"; do
    curl -sf -X POST "$API/windows/close" \
      -H "Content-Type: application/json" \
      -d "{\"id\":$WID}" > /dev/null 2>&1 || true
  done
}
trap cleanup EXIT

log() { echo "  $1"; }
pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; FAIL=1; }

# Check app is running
if ! curl -sf "$API/health" > /dev/null 2>&1; then
  echo "ERROR: App not running on $API. Start with: bun run dev"
  exit 1
fi

echo "=== Smoke Test ==="
echo

# Helper: run a command and verify the expected appType appears
smoke_command() {
  local CMD_ID="$1"
  local EXPECTED_TYPE="$2"
  local ARGS="${3:-}"

  # Get window IDs before
  local BEFORE_IDS
  BEFORE_IDS=$(curl -sf "$API/state" | python3 -c "
import sys, json
ids = [w['id'] for w in json.load(sys.stdin)['windows']]
print(' '.join(str(i) for i in ids))
")

  # Run command
  if [ -n "$ARGS" ]; then
    curl -sf -X POST "$API/commands/run" \
      -H "Content-Type: application/json" \
      -d "{\"id\":\"$CMD_ID\",\"args\":$ARGS}" > /dev/null
  else
    curl -sf -X POST "$API/commands/run" \
      -H "Content-Type: application/json" \
      -d "{\"id\":\"$CMD_ID\"}" > /dev/null
  fi

  sleep 0.5

  # Find NEW windows (ids not in before set) with expected appType
  local FOUND
  FOUND=$(curl -sf "$API/state" | python3 -c "
import sys, json
before = set('$BEFORE_IDS'.split())
state = json.load(sys.stdin)
for w in state['windows']:
    if str(w['id']) not in before:
        d = w.get('details', {})
        if d.get('appType') == '$EXPECTED_TYPE':
            print(w['id'])
            break
else:
    # Focus-or-create: accept if appType exists (singleton window)
    for w in state['windows']:
        d = w.get('details', {})
        if d.get('appType') == '$EXPECTED_TYPE':
            print('existing:' + str(w['id']))
            break
    else:
        print('')
" 2>/dev/null || echo "")

  if [ -z "$FOUND" ]; then
    fail "$CMD_ID → expected appType=$EXPECTED_TYPE not found"
  elif [[ "$FOUND" == existing:* ]]; then
    local EID="${FOUND#existing:}"
    pass "$CMD_ID → appType=$EXPECTED_TYPE (focused existing id=$EID)"
  else
    pass "$CMD_ID → appType=$EXPECTED_TYPE (new id=$FOUND)"
    OPENED_IDS+=("$FOUND")
  fi

  # Health check
  local HEALTH
  HEALTH=$(curl -sf "$API/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
  if [ "$HEALTH" != "ok" ]; then
    fail "health degraded after $CMD_ID"
  fi
}

# ── Window type smoke tests ──

echo "Opening window types..."
smoke_command "editor.new" "text-editor"
smoke_command "companion.open" "companion-widget"
smoke_command "art.open" "generative-art"
smoke_command "figlet.open" "figlet-banner" '{"text":"SMOKE"}'
smoke_command "primer-browser.open" "primer-browser"
smoke_command "file-manager.open" "farjs-file-manager"
smoke_command "inspector.open" "state-inspector"

echo
echo "Verifying health..."
HEALTH=$(curl -sf "$API/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
if [ "$HEALTH" = "ok" ]; then
  pass "health OK after all opens"
else
  fail "health degraded"
fi

# Export one text capture
echo
echo "Exporting text capture..."
if [ ${#OPENED_IDS[@]} -gt 0 ]; then
  EXPORT_RESULT=$(curl -sf -X POST "$API/windows/text/export" \
    -H "Content-Type: application/json" \
    -d "{\"id\":${OPENED_IDS[0]},\"name\":\"smoke-test\"}" 2>/dev/null || echo "failed")
  if echo "$EXPORT_RESULT" | grep -q "Exported\|smoke"; then
    pass "text export succeeded"
  else
    log "text export: $EXPORT_RESULT (non-fatal)"
  fi
fi

# Clean up: close opened windows (except agent/companion which may be persistent)
echo
echo "Cleaning up..."
for WID in "${OPENED_IDS[@]}"; do
  curl -sf -X POST "$API/windows/close" \
    -H "Content-Type: application/json" \
    -d "{\"id\":$WID}" > /dev/null 2>&1 || true
done
pass "closed ${#OPENED_IDS[@]} test windows"

echo
if [ "$FAIL" -eq 1 ]; then
  echo "SMOKE TEST FAILED"
  exit 1
else
  echo "ALL SMOKE TESTS PASSED"
fi
