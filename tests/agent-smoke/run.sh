#!/usr/bin/env bash
# Agent Smoke Test Suite
# Launches WibWob-DOS in tmux, exercises agent via control API, reports results.
#
# Usage: ./tests/agent-smoke/run.sh
#
# Requirements: tmux, bun, curl, jq

set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"

API_PORT="${SMOKE_PORT:-8098}"
API="http://127.0.0.1:${API_PORT}"
TMUX_SESSION="wibwob-test"
RESULTS_DIR="tests/agent-smoke/results/$(date +%Y-%m-%dT%H-%M-%S)"
mkdir -p "$RESULTS_DIR"

PASS=0
FAIL=0
TESTS=()

# ── Helpers ──────────────────────────────────────────────────────────────────

log() { echo "[smoke] $*"; }
pass() { log "  ✓ $1"; PASS=$((PASS + 1)); TESTS+=("PASS: $1"); }
fail() { log "  ✗ $1 — $2"; FAIL=$((FAIL + 1)); TESTS+=("FAIL: $1 — $2"); }

api_get() { curl -sf "$API$1" 2>/dev/null || echo '{}'; }
api_post() { curl -sf -X POST "$API$1" -H "Content-Type: application/json" -d "$2" 2>/dev/null || echo '{"ok":false}'; }

# Get state, save snapshot
get_state() {
  local label="${1:-state}"
  local state
  state=$(api_get "/state")
  echo "$state" > "$RESULTS_DIR/${label}.json"
  echo "$state"
}

# Send input to agent window and wait for response
agent_send() {
  local id="$1"
  local text="$2"
  local wait="${3:-3}"
  api_post "/windows/input" "{\"id\":$id,\"input\":\"$text\\r\"}"
  sleep "$wait"
}

# Send agent-message (with sender label)
agent_message() {
  local id="$1"
  local text="$2"
  local sender="$3"
  api_post "/windows/agent-message" "{\"id\":$id,\"text\":\"$text\",\"sender\":\"$sender\"}"
}

# Get agent window text
agent_text() {
  local id="$1"
  api_get "/windows/text?id=$id"
}

# Find agent window ID from state
find_agent_id() {
  local state="$1"
  echo "$state" | python3 -c "
import sys, json
state = json.load(sys.stdin)
for w in state.get('windows', []):
  if w.get('appType') == 'wibwob-agent' or w.get('details',{}).get('appType') == 'wibwob-agent':
    print(w['id'])
    break
" 2>/dev/null || echo ""
}

# Get agent details from state
agent_details() {
  local state="$1"
  local agent_id="$2"
  echo "$state" | python3 -c "
import sys, json
state = json.load(sys.stdin)
for w in state.get('windows', []):
  if w['id'] == $agent_id:
    print(json.dumps(w.get('details', {})))
    break
" 2>/dev/null || echo "{}"
}

# Get agent message count from state
agent_msg_count() {
  local state="$1"
  local agent_id="$2"
  echo "$state" | python3 -c "
import sys, json
state = json.load(sys.stdin)
for w in state.get('windows', []):
  if w['id'] == $agent_id:
    print(w.get('details', {}).get('messageCount', 0))
    break
" 2>/dev/null || echo "0"
}

# Wait for agent to stop streaming
wait_idle() {
  local id="$1"
  local max_wait="${2:-30}"
  local elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    local state
    state=$(api_get "/state")
    local streaming
    streaming=$(echo "$state" | python3 -c "
import sys, json
state = json.load(sys.stdin)
for w in state.get('windows', []):
  if w['id'] == $id:
    d = w.get('describeState', {})
    print('true' if d.get('streaming') else 'false')
    break
" 2>/dev/null || echo "false")
    if [ "$streaming" = "false" ]; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  return 1
}

# Find latest session log
find_session_log() {
  local session_dir="$HOME/.pi/agent/sessions/--Users-james-Repos-wibandwob-dos--"
  if [ -d "$session_dir" ]; then
    ls -t "$session_dir"/*.jsonl 2>/dev/null | head -1
  fi
}

# ── Startup ──────────────────────────────────────────────────────────────────

log "Cleaning up..."
tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
sleep 1

# Kill any existing process on the test port (NOT 8099 which may be the user's live instance)
lsof -ti:${API_PORT} | xargs kill -9 2>/dev/null || true
sleep 1

log "Launching WibWob-DOS in tmux session '$TMUX_SESSION'..."
# COLUMNS/LINES env vars ensure blessed gets a real terminal size even in headless tmux
tmux new-session -d -s "$TMUX_SESSION" -x 200 -y 60 \
  "cd $REPO && COLUMNS=200 LINES=60 CONTROL_API_PORT=${API_PORT} bun run dev 2>&1 | tee $RESULTS_DIR/app.log"

log "Waiting for API on $API..."
for i in $(seq 1 30); do
  if curl -sf "$API/health" >/dev/null 2>&1; then
    log "API ready after ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    log "API did not start in 30s"
    tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

# Extra settle time for blessed to initialize
sleep 2

# ── Test 1: Open agent window ───────────────────────────────────────────────

log "Test 1: Open agent window"
api_post "/view/wibwob-agent/open" "{}"
sleep 3

STATE=$(get_state "01-agent-open")
AGENT_ID=$(find_agent_id "$STATE")

if [ -n "$AGENT_ID" ]; then
  pass "Agent window opened (id=$AGENT_ID)"
else
  fail "Agent window open" "No wibwob-agent window found in state"
  log "Aborting — cannot continue without agent window"
  tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
  exit 1
fi

# Wait for agent to initialize (model loading etc)
log "Waiting for agent to initialize..."
sleep 8

# ── Test 2: /help ────────────────────────────────────────────────────────────

log "Test 2: /help command"
COUNT_BEFORE=$(agent_msg_count "$(get_state 'pre-help')" "$AGENT_ID")
agent_send "$AGENT_ID" "/help" 2
STATE=$(get_state "02-help")
COUNT_AFTER=$(agent_msg_count "$STATE" "$AGENT_ID")

# /help adds a status message, so count should increase
if [ "$COUNT_AFTER" -gt "$COUNT_BEFORE" ]; then
  pass "/help added status message (count: $COUNT_BEFORE → $COUNT_AFTER)"
else
  fail "/help" "Message count did not increase ($COUNT_BEFORE → $COUNT_AFTER)"
fi

# Also try text capture (may work if terminal size is correct)
agent_text "$AGENT_ID" > "$RESULTS_DIR/02-help.txt" 2>/dev/null || true

# ── Test 3: /session ─────────────────────────────────────────────────────────

log "Test 3: /session command"
COUNT_BEFORE=$(agent_msg_count "$(get_state 'pre-session')" "$AGENT_ID")
agent_send "$AGENT_ID" "/session" 2
STATE=$(get_state "03-session")
COUNT_AFTER=$(agent_msg_count "$STATE" "$AGENT_ID")
DETAILS=$(agent_details "$STATE" "$AGENT_ID")

# /session adds a status message with session info
if [ "$COUNT_AFTER" -gt "$COUNT_BEFORE" ]; then
  MODEL=$(echo "$DETAILS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('model',''))" 2>/dev/null || echo "")
  pass "/session added status (model: $MODEL)"
else
  fail "/session" "Message count did not increase"
fi

# ── Test 4: /tools ───────────────────────────────────────────────────────────

log "Test 4: /tools command"
COUNT_BEFORE=$(agent_msg_count "$(get_state 'pre-tools')" "$AGENT_ID")
agent_send "$AGENT_ID" "/tools" 2
STATE=$(get_state "04-tools")
COUNT_AFTER=$(agent_msg_count "$STATE" "$AGENT_ID")

if [ "$COUNT_AFTER" -gt "$COUNT_BEFORE" ]; then
  pass "/tools added status message (count: $COUNT_BEFORE → $COUNT_AFTER)"
else
  fail "/tools" "Message count did not increase"
fi

# ── Test 5: /model ───────────────────────────────────────────────────────────

log "Test 5: /model command"
COUNT_BEFORE=$(agent_msg_count "$(get_state 'pre-model')" "$AGENT_ID")
agent_send "$AGENT_ID" "/model" 2
STATE=$(get_state "05-model")
COUNT_AFTER=$(agent_msg_count "$STATE" "$AGENT_ID")
DETAILS=$(agent_details "$STATE" "$AGENT_ID")
MODEL=$(echo "$DETAILS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('model','none'))" 2>/dev/null || echo "none")

if [ "$COUNT_AFTER" -gt "$COUNT_BEFORE" ] && [ "$MODEL" != "none" ] && [ -n "$MODEL" ]; then
  pass "/model shows model ($MODEL)"
else
  fail "/model" "count=$COUNT_BEFORE→$COUNT_AFTER model=$MODEL"
fi

# ── Test 6: Simple prompt ────────────────────────────────────────────────────

log "Test 6: Simple prompt (say hello)"
COUNT_BEFORE=$(agent_msg_count "$(get_state 'pre-prompt')" "$AGENT_ID")
agent_send "$AGENT_ID" "say hello in exactly 3 words" 5

# Wait for streaming to finish
wait_idle "$AGENT_ID" 30 || true

STATE=$(get_state "06-prompt")
COUNT_AFTER=$(agent_msg_count "$STATE" "$AGENT_ID")
DETAILS=$(agent_details "$STATE" "$AGENT_ID")
STREAMING=$(echo "$DETAILS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('streaming',False))" 2>/dev/null || echo "True")

# Must have user + assistant (+2), not be streaming, and status should be Ready not Error
SUMMARY=$(echo "$DETAILS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('summary',''))" 2>/dev/null || echo "")
if [ "$COUNT_AFTER" -ge $((COUNT_BEFORE + 2)) ] && [ "$STREAMING" = "False" ] && ! echo "$SUMMARY" | grep -qi "error"; then
  pass "Simple prompt got response (count: $COUNT_BEFORE → $COUNT_AFTER)"
else
  # Check session log for the actual error
  SESSION_LOG_NOW=$(find_session_log)
  if [ -n "$SESSION_LOG_NOW" ]; then
    ERR=$(tail -1 "$SESSION_LOG_NOW" | python3 -c "
import sys, json
e = json.loads(sys.stdin.readline())
if e.get('type') == 'message':
  m = e['message']
  if m.get('errorMessage'):
    print(m['errorMessage'][:200])
  elif m.get('stopReason') == 'error':
    print('stopReason=error (no errorMessage)')
" 2>/dev/null || echo "")
    if [ -n "$ERR" ]; then
      fail "Simple prompt" "API error: $ERR"
    else
      fail "Simple prompt" "count=$COUNT_BEFORE→$COUNT_AFTER streaming=$STREAMING summary=$SUMMARY"
    fi
  else
    fail "Simple prompt" "count=$COUNT_BEFORE→$COUNT_AFTER streaming=$STREAMING summary=$SUMMARY"
  fi
fi

agent_text "$AGENT_ID" > "$RESULTS_DIR/06-prompt.txt" 2>/dev/null || true

# ── Test 7: /clear ───────────────────────────────────────────────────────────

log "Test 7: /clear command"
agent_send "$AGENT_ID" "/clear" 2
STATE=$(get_state "07-clear")
COUNT_AFTER=$(agent_msg_count "$STATE" "$AGENT_ID")

if [ "$COUNT_AFTER" -le 1 ]; then
  pass "/clear clears transcript (count=$COUNT_AFTER)"
else
  fail "/clear" "Message count after clear: $COUNT_AFTER"
fi

# ── Test 8: Sender label via agent-message API ──────────────────────────────

log "Test 8: Sender label via agent-message"
COUNT_BEFORE=$(agent_msg_count "$(get_state 'pre-sender')" "$AGENT_ID")
agent_message "$AGENT_ID" "test message from smoke suite" "smoke-test"
sleep 3
STATE=$(get_state "08-sender")
COUNT_AFTER=$(agent_msg_count "$STATE" "$AGENT_ID")

# agent-message should add at least a user message (and trigger agent response)
if [ "$COUNT_AFTER" -gt "$COUNT_BEFORE" ]; then
  pass "Agent-message received (count: $COUNT_BEFORE → $COUNT_AFTER)"
else
  fail "Agent-message" "Message count did not increase"
fi

# Wait for any streaming to finish before /new
wait_idle "$AGENT_ID" 30 || true

# ── Test 9: /new ─────────────────────────────────────────────────────────────

log "Test 9: /new command"
agent_send "$AGENT_ID" "/new" 3

STATE=$(get_state "09-new")
MSG_COUNT=$(agent_msg_count "$STATE" "$AGENT_ID")

if [ "$MSG_COUNT" -le 2 ]; then
  pass "/new resets session (messageCount=$MSG_COUNT)"
else
  fail "/new" "Message count after reset: $MSG_COUNT"
fi

# ── Test 10: Session log exists ──────────────────────────────────────────────

log "Test 10: Session log check"
SESSION_LOG=$(find_session_log)

if [ -n "$SESSION_LOG" ] && [ -f "$SESSION_LOG" ]; then
  LOG_LINES=$(wc -l < "$SESSION_LOG" | tr -d ' ')
  cp "$SESSION_LOG" "$RESULTS_DIR/session-log.jsonl"
  if [ "$LOG_LINES" -gt 0 ]; then
    pass "Session log exists ($LOG_LINES lines: $(basename "$SESSION_LOG"))"
  else
    fail "Session log" "Log file exists but is empty"
  fi
else
  fail "Session log" "No session JSONL found"
fi

# ── Test 11: /stop (abort) ──────────────────────────────────────────────────

log "Test 11: /stop command"
# Send a prompt that will take a while
agent_send "$AGENT_ID" "write a very long detailed essay about the history of computing" 1
# Immediately stop
agent_send "$AGENT_ID" "/stop" 2

STATE=$(get_state "11-stop")
TEXT=$(agent_text "$AGENT_ID")
echo "$TEXT" > "$RESULTS_DIR/11-stop.txt"

# Check that status shows aborted or ready (not still streaming)
STREAMING=$(echo "$STATE" | python3 -c "
import sys, json
state = json.load(sys.stdin)
for w in state.get('windows', []):
  if w['id'] == $AGENT_ID:
    print('true' if w.get('describeState', {}).get('streaming') else 'false')
    break
" 2>/dev/null || echo "unknown")

if [ "$STREAMING" = "false" ]; then
  pass "/stop aborted streaming"
else
  fail "/stop" "Still streaming after abort (streaming=$STREAMING)"
fi

# ── Final capture ────────────────────────────────────────────────────────────

log "Final state capture..."
get_state "final" > /dev/null
agent_text "$AGENT_ID" > "$RESULTS_DIR/final-transcript.txt" 2>/dev/null || true

# ── Teardown ─────────────────────────────────────────────────────────────────

log "Shutting down tmux session..."
tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════"
echo "  AGENT SMOKE TEST RESULTS"
echo "════════════════════════════════════════════"
echo ""
printf "  Passed: %d\n" "$PASS"
printf "  Failed: %d\n" "$FAIL"
printf "  Total:  %d\n" $((PASS + FAIL))
echo ""

for t in "${TESTS[@]}"; do
  echo "  $t"
done

echo ""
echo "  Results: $RESULTS_DIR/"
echo "════════════════════════════════════════════"

# Write summary file
{
  echo "Agent Smoke Test — $(date)"
  echo "Passed: $PASS  Failed: $FAIL  Total: $((PASS + FAIL))"
  echo ""
  for t in "${TESTS[@]}"; do
    echo "$t"
  done
} > "$RESULTS_DIR/summary.txt"

# Exit with failure if any tests failed
[ "$FAIL" -eq 0 ]
