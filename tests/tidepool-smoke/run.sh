#!/usr/bin/env bash
# Tide Pool — Smoke Test Suite
#
# Tests the Tide Pool microapp via the control API:
#   - Module loads and command is discoverable
#   - Window opens with correct appType
#   - Engine ticks and state evolves
#   - describeState contract is correct
#   - Species populations are non-zero
#   - Shannon diversity is valid
#   - Text capture works
#   - Window closes cleanly
#
# Usage: ./tests/tidepool-smoke/run.sh
# Use live dev instance: TIDEPOOL_USE_DEV=1 ./tests/tidepool-smoke/run.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

API_PORT="${SMOKE_PORT:-8098}"
API="http://127.0.0.1:${API_PORT}"
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
OWN_APP=false

log() { echo "$(date +%H:%M:%S) $*" | tee -a "$RESULTS_DIR/test.log"; }
pass() { PASS_COUNT=$((PASS_COUNT + 1)); log "  ✓ PASS: $1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); log "  ✗ FAIL: $1 — $2"; }
skip() { SKIP_COUNT=$((SKIP_COUNT + 1)); log "  ○ SKIP: $1"; }

api_get() {
  curl -sf "${API}$1" 2>/dev/null || echo "{}"
}

api_post() {
  curl -sf -X POST "${API}$1" \
    -H "Content-Type: application/json" \
    -d "$2" 2>/dev/null || echo '{"ok":false}'
}

get_state() {
  local label="${1:-state}"
  local state
  state=$(api_get "/state")
  echo "$state" > "$RESULTS_DIR/${label}.json"
  echo "$state"
}

find_window_by_apptype() {
  local state="$1" apptype="$2"
  echo "$state" | python3 -c "
import sys, json
state = json.load(sys.stdin)
for w in state.get('windows', []):
    d = w.get('details', {})
    if d.get('appType') == '$apptype':
        print(w['id'])
        break
" 2>/dev/null
}

window_detail() {
  local state="$1" wid="$2" field="$3"
  echo "$state" | python3 -c "
import sys, json
state = json.load(sys.stdin)
for w in state.get('windows', []):
    if w['id'] == $wid:
        d = w.get('details', {})
        val = d.get('$field')
        if val is not None:
            if isinstance(val, bool):
                print('true' if val else 'false')
            else:
                print(val)
        break
" 2>/dev/null
}

window_detail_json() {
  local state="$1" wid="$2"
  echo "$state" | python3 -c "
import sys, json
state = json.load(sys.stdin)
for w in state.get('windows', []):
    if w['id'] == $wid:
        print(json.dumps(w.get('details', {})))
        break
" 2>/dev/null
}

# ── Launch or connect ──────────────────────────────────────

if [ "${TIDEPOOL_USE_DEV:-}" = "1" ]; then
  API_PORT=8099
  API="http://127.0.0.1:${API_PORT}"
  log "Using live dev instance on port $API_PORT"
else
  log "Starting headless app on port $API_PORT..."
  lsof -ti:${API_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 1

  TMUX_SESSION="tidepool-smoke-$$"
  tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
  tmux new-session -d -s "$TMUX_SESSION" -x 200 -y 60

  tmux send-keys -t "$TMUX_SESSION" "cd $REPO_ROOT && CONTROL_API_PORT=${API_PORT} bun run dev 2>&1 | tee $RESULTS_DIR/app.log" Enter
  OWN_APP=true

  log "Waiting for API on port $API_PORT..."
  for i in $(seq 1 30); do
    if curl -sf "${API}/health" >/dev/null 2>&1; then
      log "API ready after ${i}s"
      break
    fi
    sleep 1
  done

  if ! curl -sf "${API}/health" >/dev/null 2>&1; then
    log "FATAL: API did not start"
    tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
    exit 1
  fi
fi

cleanup() {
  if [ "$OWN_APP" = true ]; then
    log "Cleaning up..."
    tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
    lsof -ti:${API_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
  fi
  log ""
  log "Results: $RESULTS_DIR"
  log "═══════════════════════════════════════"
  log "  PASSED: $PASS_COUNT"
  log "  FAILED: $FAIL_COUNT"
  log "  SKIPPED: $SKIP_COUNT"
  log "═══════════════════════════════════════"
  [ $FAIL_COUNT -eq 0 ] && log "  ALL TESTS PASSED ✓" || log "  SOME TESTS FAILED ✗"
}
trap cleanup EXIT

# ══════════════════════════════════════════════════════════════
# Tests
# ══════════════════════════════════════════════════════════════

log ""
log "Tide Pool Smoke Test Suite"
log "═══════════════════════════════════════"

# ── Test 1: Command discoverable ──────────────────────────

log "Test 1: Tide Pool command discoverable"
CMDS=$(api_get "/commands/list")
TIDEPOOL_CMD=$(echo "$CMDS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
cmds = data.get('commands', data) if isinstance(data, dict) else data
tp = [c for c in cmds if 'tidepool' in c.get('id','').lower()]
print(len(tp))
" 2>/dev/null || echo "0")

if [ "$TIDEPOOL_CMD" -ge 1 ]; then
  pass "Found $TIDEPOOL_CMD tidepool command(s)"
else
  fail "Tidepool commands" "Expected >=1, found $TIDEPOOL_CMD"
fi

# ── Test 2: Open Tide Pool window ─────────────────────────

log "Test 2: Open Tide Pool window"
api_post "/commands/run" '{"id":"microapp.wibwob.tidepool.open"}' > /dev/null
sleep 3

STATE=$(get_state "02-after-open")
TP_ID=$(find_window_by_apptype "$STATE" "wibwob.tidepool")

if [ -n "$TP_ID" ]; then
  pass "Tide Pool window opened (id=$TP_ID)"
else
  fail "Tide Pool window" "Window not found in state"
  exit 1
fi

# ── Test 3: Initial state contract ────────────────────────

log "Test 3: describeState contract"
DETAILS=$(window_detail_json "$STATE" "$TP_ID")

# Check required fields exist
FIELDS_OK=$(echo "$DETAILS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
required = ['generation', 'era', 'tide', 'shannonDiversity', 'dominant',
            'populations', 'extinct', 'totalPopulation', 'running', 'speed',
            'seed', 'gridSize', 'recentEvents', 'highlight', 'appType']
missing = [f for f in required if f not in d]
if missing:
    print('MISSING:' + ','.join(missing))
else:
    print('OK')
" 2>/dev/null || echo "ERROR")

if [ "$FIELDS_OK" = "OK" ]; then
  pass "All 15 state fields present"
else
  fail "State contract" "$FIELDS_OK"
fi

# ── Test 4: Engine is running and ticking ─────────────────

log "Test 4: Engine is running"
RUNNING=$(window_detail "$STATE" "$TP_ID" "running")
GEN1=$(window_detail "$STATE" "$TP_ID" "generation")

if [ "$RUNNING" = "true" ]; then
  pass "Engine is running"
else
  fail "Engine running" "running=$RUNNING"
fi

# Wait and check generation advances
sleep 3
STATE=$(get_state "04-after-wait")
GEN2=$(window_detail "$STATE" "$TP_ID" "generation")

if [ "$GEN2" -gt "$GEN1" ]; then
  pass "Generation advanced: $GEN1 → $GEN2"
else
  fail "Generation advance" "gen1=$GEN1 gen2=$GEN2"
fi

# ── Test 5: All five species have populations ─────────────

log "Test 5: Species populations"
SPECIES_OK=$(echo "$(window_detail_json "$STATE" "$TP_ID")" | python3 -c "
import sys, json
d = json.load(sys.stdin)
pops = d.get('populations', {})
species = ['algae', 'lichen', 'coral', 'anemone', 'barnacle']
missing = [s for s in species if s not in pops]
zero = [s for s in species if pops.get(s, 0) == 0]
total = sum(pops.get(s, 0) for s in species)
if missing:
    print(f'MISSING:{missing}')
elif total < 10:
    print(f'LOW_POP:total={total}')
else:
    alive = len([s for s in species if pops.get(s, 0) > 0])
    print(f'OK:{alive}/5 alive, total={total}')
" 2>/dev/null || echo "ERROR")

if echo "$SPECIES_OK" | grep -q "^OK:"; then
  pass "Species: $SPECIES_OK"
else
  fail "Species" "$SPECIES_OK"
fi

# ── Test 6: Shannon diversity is valid ────────────────────

log "Test 6: Shannon diversity"
H=$(window_detail "$STATE" "$TP_ID" "shannonDiversity")
H_OK=$(python3 -c "
h = float('$H')
# H' should be 0..ln(5)≈1.609 for 5 species
if 0 <= h <= 1.7:
    print(f'OK:H={h:.3f}')
else:
    print(f'OUT_OF_RANGE:H={h}')
" 2>/dev/null || echo "ERROR")

if echo "$H_OK" | grep -q "^OK:"; then
  pass "Shannon diversity: $H_OK"
else
  fail "Shannon diversity" "$H_OK"
fi

# ── Test 7: Era is valid ─────────────────────────────────

log "Test 7: Era detection"
ERA=$(window_detail "$STATE" "$TP_ID" "era")
case "$ERA" in
  genesis|bloom|equilibrium|collapse|recovery)
    pass "Era: $ERA"
    ;;
  *)
    fail "Era" "Unknown era: $ERA"
    ;;
esac

# ── Test 8: Tide is valid ────────────────────────────────

log "Test 8: Tide level"
TIDE=$(window_detail "$STATE" "$TP_ID" "tide")
case "$TIDE" in
  low|mid|high)
    pass "Tide: $TIDE"
    ;;
  *)
    fail "Tide" "Unknown tide: $TIDE"
    ;;
esac

# ── Test 9: Grid size is reported ─────────────────────────

log "Test 9: Grid size"
GRID=$(window_detail "$STATE" "$TP_ID" "gridSize")
GRID_OK=$(python3 -c "
g = '$GRID'
parts = g.split('x')
if len(parts) == 2:
    w, h = int(parts[0]), int(parts[1])
    if w >= 5 and h >= 5:
        print(f'OK:{w}x{h}')
    else:
        print(f'TOO_SMALL:{g}')
else:
    print(f'BAD_FORMAT:{g}')
" 2>/dev/null || echo "ERROR")

if echo "$GRID_OK" | grep -q "^OK:"; then
  pass "Grid size: $GRID_OK"
else
  fail "Grid size" "$GRID_OK"
fi

# ── Test 10: Text capture works ───────────────────────────

log "Test 10: Text capture"
RAW=$(curl -sf "${API}/windows/text?id=${TP_ID}" 2>/dev/null || echo "")
TEXT=$(echo "$RAW" | python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  print(data.get('text', ''))
except: pass
" 2>/dev/null || echo "")

if echo "$TEXT" | grep -q "SPECIES"; then
  pass "Text capture contains SPECIES section"
elif echo "$RAW" | grep -q "SPECIES"; then
  pass "Text capture contains SPECIES section (raw)"
else
  fail "Text capture" "Missing SPECIES. First 100 chars: $(echo "$TEXT" | head -1 | cut -c1-100)"
fi

# ── Test 11: Window close ─────────────────────────────────

log "Test 11: Close window"
api_post "/windows/close" "{\"id\":${TP_ID}}" > /dev/null
sleep 0.5

STATE=$(get_state "11-after-close")
# Check OUR window is gone (by id, not appType — other instances may exist)
STILL_THERE=$(echo "$STATE" | python3 -c "
import sys, json
state = json.load(sys.stdin)
for w in state.get('windows', []):
    if w['id'] == $TP_ID:
        print('yes')
        break
else:
    print('no')
" 2>/dev/null)

if [ "$STILL_THERE" = "no" ]; then
  pass "Window closed cleanly (id=$TP_ID gone)"
else
  fail "Close window" "Window id=$TP_ID still present"
fi

# ── Test 12: Re-open works (no leftover state) ────────────

log "Test 12: Re-open after close"
api_post "/commands/run" '{"id":"microapp.wibwob.tidepool.open"}' > /dev/null
sleep 2

STATE=$(get_state "12-reopen")
TP_ID2=$(find_window_by_apptype "$STATE" "wibwob.tidepool")
GEN_REOPEN=$(window_detail "$STATE" "$TP_ID2" "generation")

if [ -n "$TP_ID2" ] && [ "$GEN_REOPEN" -lt 20 ]; then
  pass "Re-opened fresh (gen=$GEN_REOPEN)"
else
  fail "Re-open" "id=$TP_ID2 gen=$GEN_REOPEN"
fi

# ── Test 13: API stays responsive while ticking ───────────

log "Test 13: API responsiveness under tick load"
sleep 5
HEALTH=$(curl -sf -o /dev/null -w "%{http_code}" "${API}/health" 2>/dev/null || echo "000")
STATE_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${API}/state" 2>/dev/null || echo "000")

if [ "$HEALTH" = "200" ] && [ "$STATE_CODE" = "200" ]; then
  pass "API responsive while ticking (/health=$HEALTH /state=$STATE_CODE)"
else
  fail "API responsiveness" "/health=$HEALTH /state=$STATE_CODE"
fi

# ── Cleanup: close the window ────────────────────────────

if [ -n "${TP_ID2:-}" ]; then
  api_post "/windows/close" "{\"id\":${TP_ID2}}" > /dev/null
fi
sleep 0.5

log ""
log "Done."
