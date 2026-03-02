#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/james/Repos/wibandwob-dos"
OUT_DIR="$ROOT/scratch/feedback-loop"
SESSION="${SESSION_NAME:-ts-tui-backrooms-loop}"
API_BASE="${API_BASE:-}"
CONTROL_API_PORT="${CONTROL_API_PORT:-8120}"
THEME="${THEME:-liminal fluorescent maze}"
PRIMERS="${PRIMERS:-}"
TURNS="${TURNS:-2}"
MODEL="${MODEL:-sonnet}"
MODE="${MODE:-auto}"
KEEP_SESSION="${KEEP_SESSION:-0}"
WAIT_SECS="${WAIT_SECS:-18}"
TMUX_COLS="${TMUX_COLS:-132}"
TMUX_ROWS="${TMUX_ROWS:-40}"
REQUIRE_OUTPUT="${REQUIRE_OUTPUT:-1}"
KEEP_SESSION_ON_FAIL="${KEEP_SESSION_ON_FAIL:-1}"

mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
STATE_PATH="$OUT_DIR/state_${STAMP}.json"
PANE_PATH="$OUT_DIR/pane_${STAMP}.txt"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux kill-session -t "$SESSION"
fi

tmux new-session -d -x "$TMUX_COLS" -y "$TMUX_ROWS" -s "$SESSION" "cd '$ROOT' && CONTROL_API_PORT='$CONTROL_API_PORT' bun run start"

discover_api_base() {
  if [[ -n "$API_BASE" ]]; then
    if curl -sf "$API_BASE/health" >/dev/null 2>&1; then
      echo "$API_BASE"
      return 0
    fi
    return 1
  fi

  local port
  for port in "$CONTROL_API_PORT" $((CONTROL_API_PORT + 1)) $((CONTROL_API_PORT + 2)) $((CONTROL_API_PORT + 3)) $((CONTROL_API_PORT + 4)); do
    if curl -sf "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
      echo "http://127.0.0.1:${port}"
      return 0
    fi
  done
  return 1
}

API_BASE_RESOLVED=""
for _ in $(seq 1 60); do
  if API_BASE_RESOLVED="$(discover_api_base)"; then
    break
  fi
  sleep 0.5
done

if [[ -z "$API_BASE_RESOLVED" ]]; then
  echo "ERROR: control API did not come up on expected ports" >&2
  tmux capture-pane -pt "$SESSION:0.0" -S -220 > "$PANE_PATH"
  if [[ "$KEEP_SESSION_ON_FAIL" != "1" ]]; then
    tmux kill-session -t "$SESSION"
  fi
  exit 3
fi

curl -sf -X POST "$API_BASE_RESOLVED/view/backrooms/open" \
  -H "Content-Type: application/json" \
  -d "{\"theme\":\"$THEME\",\"primers\":\"$PRIMERS\",\"turns\":$TURNS,\"model\":\"$MODEL\",\"mode\":\"$MODE\"}" >/dev/null

sleep "$WAIT_SECS"

curl -sf "$API_BASE_RESOLVED/state" > "$STATE_PATH"

WINDOW_ID="$(python3 - "$STATE_PATH" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
for window in data.get("windows", []):
    if window.get("kind") == "backrooms":
        print(window["id"])
        break
PY
)"

if [[ -n "${WINDOW_ID:-}" ]]; then
  curl -sf -X POST "$API_BASE_RESOLVED/windows/focus" -H "Content-Type: application/json" -d "{\"id\":$WINDOW_ID}" >/dev/null
  curl -sf -X POST "$API_BASE_RESOLVED/windows/move" -H "Content-Type: application/json" -d "{\"id\":$WINDOW_ID,\"left\":2,\"top\":1}" >/dev/null
  curl -sf -X POST "$API_BASE_RESOLVED/windows/resize" -H "Content-Type: application/json" -d "{\"id\":$WINDOW_ID,\"width\":96,\"height\":28}" >/dev/null
fi

sleep 2
curl -sf "$API_BASE_RESOLVED/state" > "$STATE_PATH"

LINE_COUNT="$(python3 - "$STATE_PATH" <<'PY'
import json, sys
data=json.load(open(sys.argv[1]))
for window in data.get("windows", []):
    if window.get("kind") == "backrooms":
        print(window.get("details", {}).get("transcriptLineCount", 0))
        break
else:
    print(-1)
PY
)"
tmux capture-pane -pt "$SESSION:0.0" -S -220 > "$PANE_PATH"

echo "session=$SESSION"
echo "api_base=$API_BASE_RESOLVED"
echo "state=$STATE_PATH"
echo "pane=$PANE_PATH"
echo "backrooms_line_count=$LINE_COUNT"

if [[ "$REQUIRE_OUTPUT" == "1" && "${LINE_COUNT:-0}" -le 0 ]]; then
  echo "ERROR: backrooms window produced no transcript lines" >&2
  if [[ "$KEEP_SESSION_ON_FAIL" != "1" ]]; then
    tmux kill-session -t "$SESSION"
  fi
  exit 2
fi

if [[ "$KEEP_SESSION" != "1" ]]; then
  tmux kill-session -t "$SESSION"
fi
