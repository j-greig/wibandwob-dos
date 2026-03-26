#!/usr/bin/env bash
# Pd Player — Smoke Test Suite
#
# Tests the Pd Player microapp via the control API:
#   - Module loads and commands are discoverable
#   - Window opens with correct appType
#   - Preset loading, object count, connection count
#   - Transport control (play, stop, render)
#   - Patch editing (add, delete, connect, clear)
#   - State reporting accuracy
#   - Bounce to WAV
#   - Text capture
#
# Usage: ./tests/pd-player-smoke/run.sh
# Override port: SMOKE_PORT=8097 ./tests/pd-player-smoke/run.sh
# Use live dev instance: PD_USE_DEV=1 ./tests/pd-player-smoke/run.sh

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

if [ "${PD_USE_DEV:-}" = "1" ]; then
  API_PORT=8099
  API="http://127.0.0.1:${API_PORT}"
  log "Using live dev instance on port $API_PORT"
else
  log "Starting headless app on port $API_PORT..."
  lsof -ti:${API_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 1

  TMUX_SESSION="pd-smoke-$$"
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
log "Pd Player Smoke Test Suite"
log "═══════════════════════════════════════"

# ── Test 1: Module loaded — commands discoverable ──────────

log "Test 1: Pd Player commands discoverable"
CMDS=$(api_get "/commands/list")
PD_CMD_COUNT=$(echo "$CMDS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
cmds = data.get('commands', data) if isinstance(data, dict) else data
pd = [c for c in cmds if 'pd-player' in c.get('id','').lower()]
print(len(pd))
" 2>/dev/null || echo "0")

if [ "$PD_CMD_COUNT" -ge 5 ]; then
  pass "Found $PD_CMD_COUNT Pd Player commands"
else
  fail "Pd Player commands" "Expected >=5, found $PD_CMD_COUNT"
fi

# ── Test 2: Open Pd Player window ─────────────────────────

log "Test 2: Open Pd Player window via command"
api_post "/commands/run" '{"id":"microapp.wibwob.pd-player.open"}' > /dev/null
sleep 2

STATE=$(get_state "02-after-open")
PD_ID=$(find_window_by_apptype "$STATE" "wibwob.pd-player")

if [ -n "$PD_ID" ]; then
  pass "Pd Player window opened (id=$PD_ID)"
else
  fail "Pd Player window" "Window not found in state"
  exit 1
fi

# ── Test 3: Initial state is correct ──────────────────────

log "Test 3: Initial state"
TRANSPORT=$(window_detail "$STATE" "$PD_ID" "transport")
PATCH_NAME=$(window_detail "$STATE" "$PD_ID" "patchName")
OBJ_COUNT=$(window_detail "$STATE" "$PD_ID" "objectCount")

if [ "$TRANSPORT" = "stopped" ] && [ -n "$PATCH_NAME" ] && [ "$OBJ_COUNT" -ge 1 ]; then
  pass "Initial state: stopped, patch=$PATCH_NAME, $OBJ_COUNT objects"
else
  fail "Initial state" "transport=$TRANSPORT patch=$PATCH_NAME objects=$OBJ_COUNT"
fi

# ── Test 4: Load preset ───────────────────────────────────

log "Test 4: Load preset patch"
api_post "/commands/run" '{"id":"microapp.wibwob.pd-player.load-preset","args":{"preset":"fm-bell"}}' > /dev/null
sleep 0.5

STATE=$(get_state "04-after-preset")
PATCH_NAME=$(window_detail "$STATE" "$PD_ID" "patchName")
OBJ_COUNT=$(window_detail "$STATE" "$PD_ID" "objectCount")

if [ "$PATCH_NAME" = "fm-bell" ] && [ "$OBJ_COUNT" -ge 4 ]; then
  pass "fm-bell preset loaded ($OBJ_COUNT objects)"
else
  fail "Load preset" "patch=$PATCH_NAME objects=$OBJ_COUNT"
fi

# ── Test 5: Render audio ──────────────────────────────────

log "Test 5: Render audio"
api_post "/commands/run" '{"id":"microapp.wibwob.pd-player.render"}' > /dev/null
sleep 1

STATE=$(get_state "05-after-render")
HAS_AUDIO=$(window_detail "$STATE" "$PD_ID" "hasAudio")

if [ "$HAS_AUDIO" = "True" ]; then
  pass "Audio rendered"
else
  fail "Render audio" "hasAudio=$HAS_AUDIO"
fi

# ── Test 6: Play transport ────────────────────────────────

log "Test 6: Start transport"
api_post "/commands/run" '{"id":"microapp.wibwob.pd-player.play"}' > /dev/null
sleep 0.5

STATE=$(get_state "06-after-play")
TRANSPORT=$(window_detail "$STATE" "$PD_ID" "transport")

if [ "$TRANSPORT" = "playing" ]; then
  pass "Transport started"
else
  fail "Start transport" "transport=$TRANSPORT"
fi

# ── Test 7: Stop transport ────────────────────────────────

log "Test 7: Stop transport"
api_post "/commands/run" '{"id":"microapp.wibwob.pd-player.stop"}' > /dev/null
sleep 0.5

STATE=$(get_state "07-after-stop")
TRANSPORT=$(window_detail "$STATE" "$PD_ID" "transport")

if [ "$TRANSPORT" = "stopped" ]; then
  pass "Transport stopped"
else
  fail "Stop transport" "transport=$TRANSPORT"
fi

# ── Test 8: Add object ───────────────────────────────────

log "Test 8: Add object"
api_post "/commands/run" '{"id":"microapp.wibwob.pd-player.add-object","args":{"type":"noise~"}}' > /dev/null
sleep 0.5

STATE=$(get_state "08-after-add")
NEW_OBJ_COUNT=$(window_detail "$STATE" "$PD_ID" "objectCount")
DETAILS=$(window_detail_json "$STATE" "$PD_ID")
HAS_NOISE=$(echo "$DETAILS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
found = any(o.get('type') == 'noise~' for o in d.get('objects', []))
print('true' if found else 'false')
" 2>/dev/null || echo "false")

if [ "$HAS_NOISE" = "true" ]; then
  pass "noise~ object added (now $NEW_OBJ_COUNT objects)"
else
  fail "Add object" "noise~ not found, count=$NEW_OBJ_COUNT"
fi

# ── Test 9: Connect objects ──────────────────────────────

log "Test 9: Connect objects"
# Get the IDs of first two objects
CONN_IDS=$(echo "$DETAILS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
objs = d.get('objects', [])
if len(objs) >= 2:
    print(f\"{objs[0]['id']} {objs[1]['id']}\")
else:
    print('')
" 2>/dev/null || echo "")

if [ -n "$CONN_IDS" ]; then
  SRC_ID=$(echo "$CONN_IDS" | awk '{print $1}')
  SNK_ID=$(echo "$CONN_IDS" | awk '{print $2}')
  api_post "/commands/run" "{\"id\":\"microapp.wibwob.pd-player.connect\",\"args\":{\"sourceId\":$SRC_ID,\"sinkId\":$SNK_ID,\"sourceOutlet\":0,\"sinkInlet\":0}}" > /dev/null
  sleep 0.5

  STATE=$(get_state "09-after-connect")
  CONN_COUNT=$(window_detail "$STATE" "$PD_ID" "connectionCount")

  if [ "$CONN_COUNT" -ge 1 ]; then
    pass "Objects connected ($CONN_COUNT connections)"
  else
    fail "Connect objects" "connections=$CONN_COUNT"
  fi
else
  skip "Connect objects — not enough objects"
fi

# ── Test 10: Remove object ───────────────────────────────

log "Test 10: Remove object"
BEFORE_COUNT=$(window_detail "$STATE" "$PD_ID" "objectCount")

# Remove last object
LAST_OBJ_ID=$(echo "$(window_detail_json "$STATE" "$PD_ID")" | python3 -c "
import sys, json
d = json.load(sys.stdin)
objs = d.get('objects', [])
if objs:
    print(objs[-1]['id'])
else:
    print(-1)
" 2>/dev/null || echo "-1")

if [ "$LAST_OBJ_ID" != "-1" ]; then
  api_post "/commands/run" "{\"id\":\"microapp.wibwob.pd-player.remove-object\",\"args\":{\"id\":$LAST_OBJ_ID}}" > /dev/null
  sleep 0.5

  STATE=$(get_state "10-after-remove")
  AFTER_COUNT=$(window_detail "$STATE" "$PD_ID" "objectCount")

  if [ "$AFTER_COUNT" -lt "$BEFORE_COUNT" ]; then
    pass "Object removed ($BEFORE_COUNT → $AFTER_COUNT)"
  else
    fail "Remove object" "before=$BEFORE_COUNT after=$AFTER_COUNT"
  fi
else
  skip "Remove object — no objects to remove"
fi

# ── Test 11: Clear patch ─────────────────────────────────

log "Test 11: Clear patch"
api_post "/commands/run" '{"id":"microapp.wibwob.pd-player.clear"}' > /dev/null
sleep 0.5

STATE=$(get_state "11-after-clear")
OBJ_COUNT=$(window_detail "$STATE" "$PD_ID" "objectCount")
CONN_COUNT=$(window_detail "$STATE" "$PD_ID" "connectionCount")

if [ "$OBJ_COUNT" = "0" ] && [ "$CONN_COUNT" = "0" ]; then
  pass "Patch cleared"
else
  fail "Clear patch" "objects=$OBJ_COUNT connections=$CONN_COUNT"
fi

# ── Test 12: Load source ─────────────────────────────────

log "Test 12: Load source text"
api_post "/commands/run" '{"id":"microapp.wibwob.pd-player.load-source","args":{"source":"#N canvas 0 0 450 300 12;\n#X obj 100 50 osc~ 220;\n#X obj 100 100 *~ 0.5;\n#X obj 100 150 dac~;\n#X connect 0 0 1 0;\n#X connect 1 0 2 0;\n#X connect 1 0 2 1;","name":"test-patch"}}' > /dev/null
sleep 0.5

STATE=$(get_state "12-after-source")
PATCH_NAME=$(window_detail "$STATE" "$PD_ID" "patchName")
OBJ_COUNT=$(window_detail "$STATE" "$PD_ID" "objectCount")

if [ "$PATCH_NAME" = "test-patch" ] && [ "$OBJ_COUNT" = "3" ]; then
  pass "Source loaded: $PATCH_NAME with $OBJ_COUNT objects"
else
  fail "Load source" "patch=$PATCH_NAME objects=$OBJ_COUNT"
fi

# ── Test 13: Set render duration ─────────────────────────

log "Test 13: Set render duration"
api_post "/commands/run" '{"id":"microapp.wibwob.pd-player.set-duration","args":{"seconds":8}}' > /dev/null
sleep 0.5

STATE=$(get_state "13-after-duration")
DURATION=$(window_detail "$STATE" "$PD_ID" "renderDuration")

if [ "$DURATION" = "8" ]; then
  pass "Render duration set to 8s"
else
  fail "Set duration" "duration=$DURATION"
fi

# ── Test 14: Multiple presets ────────────────────────────

log "Test 14: Multiple presets"
PRESET_OK=true
for preset in detuned-pad bass-pulse noise-filter dual-saw sub-bass delay-drone; do
  api_post "/commands/run" "{\"id\":\"microapp.wibwob.pd-player.load-preset\",\"args\":{\"preset\":\"$preset\"}}" > /dev/null
  sleep 0.3
  STATE=$(get_state "14-preset-$preset")
  OBJ_COUNT=$(window_detail "$STATE" "$PD_ID" "objectCount")
  if [ "$OBJ_COUNT" -lt 2 ]; then
    PRESET_OK=false
    fail "Preset $preset" "Only $OBJ_COUNT objects"
    break
  fi
done

if [ "$PRESET_OK" = true ]; then
  pass "All presets load with objects"
fi

# ── Test 15: Text capture ────────────────────────────────

log "Test 15: Text capture"
RAW=$(curl -sf "${API}/windows/text?id=${PD_ID}" 2>/dev/null || echo "")
TEXT=$(echo "$RAW" | python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  print(data.get('text', ''))
except: pass
" 2>/dev/null || echo "")

if echo "$TEXT" | grep -qi "pure.*data"; then
  pass "Text capture contains Pd Player header"
elif echo "$RAW" | grep -qi "pure.*data"; then
  pass "Text capture contains Pd Player header (raw)"
else
  fail "Text capture" "Missing header. First 100 chars: $(echo "$TEXT" | head -1 | cut -c1-100)"
fi

# ── Test 16: Input handler ───────────────────────────────

log "Test 16: Input handler (writeInput)"
api_post "/windows/input" "{\"id\":${PD_ID},\"input\":\"preset sine-drone\r\"}" > /dev/null
sleep 0.5

STATE=$(get_state "16-input")
PATCH_NAME=$(window_detail "$STATE" "$PD_ID" "patchName")

if [ "$PATCH_NAME" = "sine-drone" ]; then
  pass "Input handler: preset loaded via text input"
else
  fail "Input handler" "Expected patch=sine-drone, got $PATCH_NAME"
fi

# ── Test 17: Bounce to WAV ──────────────────────────────

log "Test 17: Bounce to WAV"
BOUNCE_PATH="/tmp/pd-smoke-bounce-$$.wav"
api_post "/commands/run" "{\"id\":\"microapp.wibwob.pd-player.bounce\",\"args\":{\"path\":\"$BOUNCE_PATH\",\"duration\":1}}" > /dev/null
sleep 2

if [ -f "$BOUNCE_PATH" ]; then
  SIZE=$(stat -f%z "$BOUNCE_PATH" 2>/dev/null || stat -c%s "$BOUNCE_PATH" 2>/dev/null || echo "0")
  if [ "$SIZE" -gt 1000 ]; then
    pass "Bounced to WAV ($SIZE bytes)"
  else
    fail "Bounce" "File too small: $SIZE bytes"
  fi
  rm -f "$BOUNCE_PATH"
else
  fail "Bounce" "WAV file not created at $BOUNCE_PATH"
fi

# ── Test 19: Visual — tmux capture-pane ────────────────
# Only run if we own the tmux session (not using live dev instance)

if [ "$OWN_APP" = true ]; then
  log "Test 19: Visual verification via tmux capture-pane"

  # Reload a preset so we have visible content
  api_post "/commands/run" '{"id":"microapp.wibwob.pd-player.load-preset","args":{"preset":"fm-bell"}}' > /dev/null
  sleep 1

  PANE_TEXT=$(tmux capture-pane -t "$TMUX_SESSION" -p 2>/dev/null || echo "")
  echo "$PANE_TEXT" > "$RESULTS_DIR/19-tmux-capture.txt"

  VIS_OK=true

  # Check for title text
  if ! echo "$PANE_TEXT" | grep -qi "pure.*data"; then
    VIS_OK=false
    fail "Visual: tmux title" "Missing 'PURE DATA' header in tmux capture"
  fi

  # Check for object type names (fm-bell has osc~ and *~)
  if ! echo "$PANE_TEXT" | grep -q "osc~"; then
    VIS_OK=false
    fail "Visual: tmux objects" "Missing 'osc~' in tmux capture"
  fi

  # Check for Patch Graph section header
  if ! echo "$PANE_TEXT" | grep -qi "patch.*graph"; then
    VIS_OK=false
    fail "Visual: tmux patch graph" "Missing 'Patch Graph' section"
  fi

  # Check for Waveform section header
  if ! echo "$PANE_TEXT" | grep -qi "waveform"; then
    VIS_OK=false
    fail "Visual: tmux waveform" "Missing 'Waveform' section"
  fi

  # Check for keyboard help line
  if ! echo "$PANE_TEXT" | grep -q "play.*stop\|render\|preset"; then
    VIS_OK=false
    fail "Visual: tmux help" "Missing keyboard help line in tmux capture"
  fi

  if [ "$VIS_OK" = true ]; then
    pass "Visual tmux capture: title, objects, patch graph, waveform, help all present"
  fi
else
  skip "Visual tmux capture — not available in PD_USE_DEV mode"
fi

# ── Test 20: Visual — /screenshot/text API ─────────────

log "Test 20: Visual verification via /screenshot/text"
SCREEN_TEXT=$(curl -sf "${API}/screenshot/text" 2>/dev/null || echo "")
echo "$SCREEN_TEXT" > "$RESULTS_DIR/20-screenshot-text.txt"

if [ -n "$SCREEN_TEXT" ]; then
  SCREEN_VIS_OK=true

  # Check for Pd Player title
  if ! echo "$SCREEN_TEXT" | grep -qi "pure.*data\|pd.*player"; then
    SCREEN_VIS_OK=false
    fail "Visual: screenshot title" "Missing Pd Player title in screenshot/text"
  fi

  # Check for object boxes (should see box-drawing chars or object names)
  if ! echo "$SCREEN_TEXT" | grep -q "osc~\|phasor~\|noise~\|dac~\|fm-bell"; then
    SCREEN_VIS_OK=false
    fail "Visual: screenshot objects" "Missing DSP object names in screenshot/text"
  fi

  if [ "$SCREEN_VIS_OK" = true ]; then
    pass "Visual screenshot/text: Pd Player content verified"
  fi
else
  skip "Visual screenshot/text — endpoint returned empty"
fi

# ── Test 21: Visual — /windows/text API ────────────────

log "Test 21: Visual verification via /windows/text"
WIN_TEXT_RAW=$(curl -sf "${API}/windows/text?id=${PD_ID}" 2>/dev/null || echo "")
WIN_TEXT=$(echo "$WIN_TEXT_RAW" | python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  print(data.get('text', ''))
except: pass
" 2>/dev/null || echo "")
echo "$WIN_TEXT" > "$RESULTS_DIR/21-windows-text.txt"

if [ -n "$WIN_TEXT" ]; then
  WIN_VIS_OK=true

  if ! echo "$WIN_TEXT" | grep -qi "pure.*data"; then
    WIN_VIS_OK=false
    fail "Visual: window text title" "Missing 'PURE DATA' in window text"
  fi

  # Verify fm-bell objects are rendered
  if ! echo "$WIN_TEXT" | grep -q "osc~"; then
    WIN_VIS_OK=false
    fail "Visual: window text objects" "Missing 'osc~' in window text capture"
  fi

  # Check signal flow summary
  if ! echo "$WIN_TEXT" | grep -qi "flow"; then
    WIN_VIS_OK=false
    fail "Visual: window text flow" "Missing signal flow summary"
  fi

  if [ "$WIN_VIS_OK" = true ]; then
    pass "Visual window text: title, objects, flow all present"
  fi
else
  skip "Visual /windows/text — returned empty"
fi

# ── Test 22: Visual — rendered waveform shows after render ──

log "Test 22: Visual verification of rendered waveform"
api_post "/commands/run" '{"id":"microapp.wibwob.pd-player.render"}' > /dev/null
sleep 1

WIN_TEXT_POST=$(curl -sf "${API}/windows/text?id=${PD_ID}" 2>/dev/null || echo "")
WIN_TEXT_POST=$(echo "$WIN_TEXT_POST" | python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  print(data.get('text', ''))
except: pass
" 2>/dev/null || echo "")
echo "$WIN_TEXT_POST" > "$RESULTS_DIR/22-waveform-check.txt"

if [ -n "$WIN_TEXT_POST" ]; then
  # After render, waveform section should NOT say "no audio rendered"
  if echo "$WIN_TEXT_POST" | grep -q "no audio rendered"; then
    fail "Visual: waveform" "Still showing 'no audio rendered' after render command"
  else
    pass "Visual waveform: rendered audio waveform present"
  fi
else
  skip "Visual waveform check — window text empty"
fi

# ── Test 23: Close window ────────────────────────────────

log "Test 23: Close window"
api_post "/windows/close" "{\"id\":${PD_ID}}" > /dev/null
sleep 0.5

STATE=$(get_state "23-after-close")
FOUND=$(find_window_by_apptype "$STATE" "wibwob.pd-player")

if [ -z "$FOUND" ]; then
  pass "Window closed"
else
  fail "Close window" "Window still found (id=$FOUND)"
fi

log ""
log "Done."
