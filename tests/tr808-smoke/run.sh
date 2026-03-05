#!/usr/bin/env bash
# TR-808 Drum Machine — Smoke Test Suite
#
# Tests the TR-808 microapp via the control API:
#   - Module loads and commands are discoverable
#   - Window opens with correct appType
#   - API commands work (play, stop, tempo, select, toggle, preset, etc.)
#   - State reporting is accurate
#   - Pattern editing via commands works
#
# Usage: ./tests/tr808-smoke/run.sh
# Override port: SMOKE_PORT=8097 ./tests/tr808-smoke/run.sh
# Use live dev instance: TR808_USE_DEV=1 ./tests/tr808-smoke/run.sh

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

if [ "${TR808_USE_DEV:-}" = "1" ]; then
  API_PORT=8099
  API="http://127.0.0.1:${API_PORT}"
  log "Using live dev instance on port $API_PORT"
else
  log "Starting headless app on port $API_PORT..."
  # Kill any stale process on our port
  lsof -ti:${API_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 1

  # Start in tmux
  TMUX_SESSION="tr808-smoke-$$"
  tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
  tmux new-session -d -s "$TMUX_SESSION" -x 200 -y 60

  tmux send-keys -t "$TMUX_SESSION" "cd $REPO_ROOT && CONTROL_API_PORT=${API_PORT} bun run dev 2>&1 | tee $RESULTS_DIR/app.log" Enter
  OWN_APP=true

  # Wait for API
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
log "TR-808 Smoke Test Suite"
log "═══════════════════════════════════════"

# ── Test 1: Module loaded — commands discoverable ──────────

log "Test 1: TR-808 commands discoverable"
CMDS=$(api_get "/commands/list")
TR808_CMD_COUNT=$(echo "$CMDS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
cmds = data.get('commands', data) if isinstance(data, dict) else data
tr808 = [c for c in cmds if 'tr808' in c.get('id','').lower()]
print(len(tr808))
" 2>/dev/null || echo "0")

if [ "$TR808_CMD_COUNT" -ge 5 ]; then
  pass "Found $TR808_CMD_COUNT TR-808 commands"
else
  fail "TR-808 commands" "Expected >=5, found $TR808_CMD_COUNT"
fi

# ── Test 2: Open TR-808 window ─────────────────────────────

log "Test 2: Open TR-808 window via command"
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.open"}' > /dev/null
sleep 2

STATE=$(get_state "02-after-open")
TR808_ID=$(find_window_by_apptype "$STATE" "wibwob.tr808")

if [ -n "$TR808_ID" ]; then
  pass "TR-808 window opened (id=$TR808_ID)"
else
  fail "TR-808 window" "Window not found in state"
  # Can't continue without window
  exit 1
fi

# ── Test 3: Initial state is correct ──────────────────────

log "Test 3: Initial state"
TRANSPORT=$(window_detail "$STATE" "$TR808_ID" "transport")
TEMPO=$(window_detail "$STATE" "$TR808_ID" "tempo")

if [ "$TRANSPORT" = "stopped" ] && [ "$TEMPO" = "120" ]; then
  pass "Initial state: stopped, 120bpm"
else
  fail "Initial state" "transport=$TRANSPORT tempo=$TEMPO"
fi

# ── Test 4: Load preset ───────────────────────────────────

log "Test 4: Load preset pattern"
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.load-preset","args":{"preset":"classic-house"}}' > /dev/null
sleep 0.5

STATE=$(get_state "04-after-preset")
DETAILS=$(window_detail_json "$STATE" "$TR808_ID")
BD_STEPS=$(echo "$DETAILS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for inst in d.get('instruments', []):
    if inst['id'] == 'bd':
        active = sum(1 for s in inst['steps'] if s)
        print(active)
        break
" 2>/dev/null || echo "0")

if [ "$BD_STEPS" -ge 3 ]; then
  pass "Classic house preset loaded (BD has $BD_STEPS active steps)"
else
  fail "Load preset" "BD steps=$BD_STEPS, expected >=3"
fi

# ── Test 5: Start transport ──────────────────────────────

log "Test 5: Start transport"
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.play"}' > /dev/null
sleep 1

STATE=$(get_state "05-after-play")
TRANSPORT=$(window_detail "$STATE" "$TR808_ID" "transport")

if [ "$TRANSPORT" = "playing" ]; then
  pass "Transport started"
else
  fail "Start transport" "transport=$TRANSPORT"
fi

# ── Test 6: Stop transport ──────────────────────────────

log "Test 6: Stop transport"
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.stop"}' > /dev/null
sleep 0.5

STATE=$(get_state "06-after-stop")
TRANSPORT=$(window_detail "$STATE" "$TR808_ID" "transport")

if [ "$TRANSPORT" = "stopped" ]; then
  pass "Transport stopped"
else
  fail "Stop transport" "transport=$TRANSPORT"
fi

# ── Test 7: Set tempo ────────────────────────────────────

log "Test 7: Set tempo"
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.tempo","args":{"bpm":140}}' > /dev/null
sleep 0.5

STATE=$(get_state "07-after-tempo")
TEMPO=$(window_detail "$STATE" "$TR808_ID" "tempo")

if [ "$TEMPO" = "140" ]; then
  pass "Tempo set to 140"
else
  fail "Set tempo" "tempo=$TEMPO"
fi

# ── Test 8: Select instrument ────────────────────────────

log "Test 8: Select instrument"
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.select","args":{"instrument":"sd"}}' > /dev/null
sleep 0.5

STATE=$(get_state "08-after-select")
SELECTED=$(window_detail "$STATE" "$TR808_ID" "selectedInstrument")

if [ "$SELECTED" = "sd" ]; then
  pass "Instrument selected: sd"
else
  fail "Select instrument" "selected=$SELECTED"
fi

# ── Test 9: Toggle step ─────────────────────────────────

log "Test 9: Toggle step"
# First clear sd, then toggle step 2 on
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.clear","args":{"instrument":"sd"}}' > /dev/null
sleep 0.3
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.toggle-step","args":{"step":2,"instrument":"sd"}}' > /dev/null
sleep 0.5

STATE=$(get_state "09-after-toggle")
DETAILS=$(window_detail_json "$STATE" "$TR808_ID")
SD_STEP2=$(echo "$DETAILS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for inst in d.get('instruments', []):
    if inst['id'] == 'sd':
        print('true' if inst['steps'][2] else 'false')
        break
" 2>/dev/null || echo "false")

if [ "$SD_STEP2" = "true" ]; then
  pass "Step 2 toggled on for SD"
else
  fail "Toggle step" "sd step 2 = $SD_STEP2"
fi

# ── Test 10: Set parameter ──────────────────────────────

log "Test 10: Set parameter"
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.set-param","args":{"instrument":"bd","param":"tune","value":75}}' > /dev/null
sleep 0.5

STATE=$(get_state "10-after-param")
DETAILS=$(window_detail_json "$STATE" "$TR808_ID")
BD_TUNE=$(echo "$DETAILS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for inst in d.get('instruments', []):
    if inst['id'] == 'bd':
        print(inst.get('params', {}).get('tune', -1))
        break
" 2>/dev/null || echo "-1")

if [ "$BD_TUNE" = "75" ]; then
  pass "BD tune set to 75"
else
  fail "Set parameter" "bd tune=$BD_TUNE"
fi

# ── Test 11: Set step explicitly ─────────────────────────

log "Test 11: Set step explicitly"
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.set-step","args":{"instrument":"ch","step":7,"active":true}}' > /dev/null
sleep 0.5

STATE=$(get_state "11-after-set-step")
DETAILS=$(window_detail_json "$STATE" "$TR808_ID")
CH_STEP7=$(echo "$DETAILS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for inst in d.get('instruments', []):
    if inst['id'] == 'ch':
        print('true' if inst['steps'][7] else 'false')
        break
" 2>/dev/null || echo "false")

if [ "$CH_STEP7" = "true" ]; then
  pass "CH step 7 set to on"
else
  fail "Set step" "ch step 7 = $CH_STEP7"
fi

# ── Test 12: Switch pattern ──────────────────────────────

log "Test 12: Switch pattern"
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.set-pattern","args":{"bank":"B","number":3,"variation":"B"}}' > /dev/null
sleep 0.5

STATE=$(get_state "12-after-pattern")
BANK=$(window_detail "$STATE" "$TR808_ID" "bank")
PATTERN=$(window_detail "$STATE" "$TR808_ID" "pattern")
VARIATION=$(window_detail "$STATE" "$TR808_ID" "variation")

if [ "$BANK" = "B" ] && [ "$PATTERN" = "3" ] && [ "$VARIATION" = "B" ]; then
  pass "Pattern switched to B3-B"
else
  fail "Switch pattern" "bank=$BANK pattern=$PATTERN variation=$VARIATION"
fi

# ── Test 13: Clear all ──────────────────────────────────

log "Test 13: Clear all"
# First load a preset into B3-B, then clear all
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.load-preset","args":{"preset":"electro"}}' > /dev/null
sleep 0.3
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.clear","args":{"all":true}}' > /dev/null
sleep 0.5

STATE=$(get_state "13-after-clear")
DETAILS=$(window_detail_json "$STATE" "$TR808_ID")
TOTAL_ACTIVE=$(echo "$DETAILS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
total = 0
for inst in d.get('instruments', []):
    total += sum(1 for s in inst['steps'] if s)
total += sum(1 for s in d.get('accentSteps', []) if s)
print(total)
" 2>/dev/null || echo "-1")

if [ "$TOTAL_ACTIVE" = "0" ]; then
  pass "Pattern cleared"
else
  fail "Clear all" "active steps=$TOTAL_ACTIVE"
fi

# ── Test 14: Text capture ──────────────────────────────

log "Test 14: Text capture"
# Switch back to pattern A1-A first (tests 12-13 left us on B3-B cleared)
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.set-pattern","args":{"bank":"A","number":1,"variation":"A"}}' > /dev/null
sleep 0.5

RAW=$(curl -sf "${API}/windows/text?id=${TR808_ID}" 2>/dev/null || echo "")
TEXT=$(echo "$RAW" | python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  print(data.get('text', ''))
except: pass
" 2>/dev/null || echo "")

if echo "$TEXT" | grep -q "R O L A N D"; then
  pass "Text capture contains TR-808 header"
elif echo "$RAW" | grep -q "R O L A N D"; then
  pass "Text capture contains TR-808 header (raw)"
else
  fail "Text capture" "Missing header. First 100 chars: $(echo "$TEXT" | head -1 | cut -c1-100)"
fi

# ── Test 15: Window close ──────────────────────────────

log "Test 15: Close window"
api_post "/windows/close" "{\"id\":${TR808_ID}}" > /dev/null
sleep 0.5

STATE=$(get_state "15-after-close")
FOUND=$(find_window_by_apptype "$STATE" "wibwob.tr808")

if [ -z "$FOUND" ]; then
  pass "Window closed"
else
  fail "Close window" "Window still found (id=$FOUND)"
fi

# ── Test 16: Audio state reported ─────────────────────────

log "Test 16: Audio state in details"
# Re-open the 808
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.open"}' > /dev/null
sleep 2

STATE=$(get_state "16-audio")
TR808_ID=$(find_window_by_apptype "$STATE" "wibwob.tr808")
AUDIO=$(window_detail "$STATE" "$TR808_ID" "audioEnabled")

if [ "$AUDIO" = "True" ] || [ "$AUDIO" = "False" ]; then
  pass "Audio state reported: $AUDIO"
else
  fail "Audio state" "audioEnabled=$AUDIO"
fi

# ── Test 17: Multiple presets ─────────────────────────────

log "Test 17: Multiple presets"
PRESET_OK=true
for preset in electro trap bossa reggaeton minimal afrobeat; do
  api_post "/commands/run" "{\"id\":\"microapp.wibwob.tr808.load-preset\",\"args\":{\"preset\":\"$preset\"}}" > /dev/null
  sleep 0.3
  STATE=$(get_state "17-preset-$preset")
  DETAILS=$(window_detail_json "$STATE" "$TR808_ID")
  TOTAL=$(echo "$DETAILS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
total = sum(sum(1 for s in inst['steps'] if s) for inst in d.get('instruments', []))
print(total)
" 2>/dev/null || echo "0")
  if [ "$TOTAL" -lt 2 ]; then
    PRESET_OK=false
    fail "Preset $preset" "Only $TOTAL active steps"
    break
  fi
done

if [ "$PRESET_OK" = true ]; then
  pass "All presets load with active steps"
fi

# ── Test 18: Input handler ──────────────────────────────

log "Test 18: Input handler (writeInput)"
# Clear and use text input
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.clear","args":{"all":true}}' > /dev/null
sleep 0.3

# Use windows/input to send text commands
api_post "/windows/input" "{\"id\":${TR808_ID},\"input\":\"tempo 180\r\"}" > /dev/null
sleep 0.5

STATE=$(get_state "18-input")
TEMPO=$(window_detail "$STATE" "$TR808_ID" "tempo")

if [ "$TEMPO" = "180" ]; then
  pass "Input handler: tempo set to 180"
else
  fail "Input handler" "Expected tempo=180, got $TEMPO"
fi

# ── Test 19: Bounce to WAV ────────────────────────────────

log "Test 19: Bounce pattern to WAV"
# Load a preset first
api_post "/commands/run" '{"id":"microapp.wibwob.tr808.load-preset","args":{"preset":"electro"}}' > /dev/null
sleep 0.5

BOUNCE_PATH="/tmp/tr808-smoke-bounce-$$.wav"
api_post "/commands/run" "{\"id\":\"microapp.wibwob.tr808.bounce\",\"args\":{\"path\":\"$BOUNCE_PATH\",\"loops\":1}}" > /dev/null
sleep 1

if [ -f "$BOUNCE_PATH" ]; then
  SIZE=$(stat -f%z "$BOUNCE_PATH" 2>/dev/null || stat -c%s "$BOUNCE_PATH" 2>/dev/null || echo "0")
  if [ "$SIZE" -gt 1000 ]; then
    pass "Bounced pattern to WAV ($SIZE bytes)"
  else
    fail "Bounce" "File too small: $SIZE bytes"
  fi
  rm -f "$BOUNCE_PATH"
else
  fail "Bounce" "WAV file not created at $BOUNCE_PATH"
fi

# ── Cleanup: close the window ────────────────────────────

api_post "/windows/close" "{\"id\":${TR808_ID}}" > /dev/null
sleep 0.5

log ""
log "Done."
