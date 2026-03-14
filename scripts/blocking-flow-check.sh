#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${WIBWOB_API:-http://127.0.0.1:8099}"
ARTIFACT_DIR="$ROOT/scratch/captures"
MARKER="blocking-flow-$(date +%s)"

api_get() {
  curl -sf "$API$1"
}

api_post() {
  local path="$1"
  local body="${2-}"
  if [ -z "$body" ]; then
    body='{}'
  fi
  curl -sf -X POST "$API$path" \
    -H "Content-Type: application/json" \
    -d "$body"
}

assert_blocked_overlay() {
  local expected_type="$1"
  local expected_label="$2"
  local snapshot_json="$3"
  python3 - "$expected_type" "$expected_label" "$snapshot_json" <<'PY'
import json, sys
expected_type, expected_label, raw = sys.argv[1], sys.argv[2], sys.argv[3]
snap = json.loads(raw)
ui = snap["snapshot"]["ui"]
overlay = ui["overlay"]
if ui["blocked"] is not True:
    raise SystemExit("runtime inspection did not report blocked=true")
if not overlay or overlay.get("type") != expected_type:
    raise SystemExit(f"expected overlay type {expected_type}, got {overlay}")
if overlay.get("label") != expected_label:
    raise SystemExit(f"expected overlay label {expected_label}, got {overlay.get('label')}")
types = [b.get("type") for b in ui.get("blockers", [])]
if expected_type not in types:
    raise SystemExit(f"expected blocker list to include {expected_type}, got {types}")
print("blocked-ok")
PY
}

assert_unblocked() {
  local snapshot_json="$1"
  python3 - "$snapshot_json" <<'PY'
import json, sys
snap = json.loads(sys.argv[1])
ui = snap["snapshot"]["ui"]
if ui["blocked"]:
    raise SystemExit(f"expected unblocked ui, got blockers={ui.get('blockers')}")
if ui.get("overlay") is not None:
    raise SystemExit(f"expected overlay null, got {ui['overlay']}")
print("unblocked-ok")
PY
}

wait_for_window_growth() {
  local before_count="$1"
  for _ in $(seq 1 20); do
    sleep 0.2
    local state_json
    state_json="$(api_get /state)"
    local count
    count="$(python3 - "$state_json" <<'PY'
import json, sys
print(len(json.loads(sys.argv[1]).get("windows", [])))
PY
)"
    if [ "$count" -gt "$before_count" ]; then
      printf '%s\n' "$state_json"
      return 0
    fi
  done
  echo "window count did not increase" >&2
  return 1
}

mkdir -p "$ARTIFACT_DIR"

api_get /health >/dev/null
api_post /commands/run '{"id":"desktop.clear-all","args":{"all":true}}' >/dev/null
sleep 0.3

api_post /commands/run '{"id":"editor.picker.open"}' >/dev/null
EDITOR_BLOCKED="$(api_get /runtime/inspection)"
assert_blocked_overlay "file-browser" "Open Text File" "$EDITOR_BLOCKED" >/dev/null
api_post /overlay/cancel >/dev/null
sleep 0.2
assert_unblocked "$(api_get /runtime/inspection)" >/dev/null

STATE_BEFORE="$(api_get /state)"
WINDOWS_BEFORE="$(python3 - "$STATE_BEFORE" <<'PY'
import json, sys
print(len(json.loads(sys.argv[1]).get("windows", [])))
PY
)"

api_post /commands/run '{"id":"markdown.picker.open"}' >/dev/null
MARKDOWN_BLOCKED="$(api_get /runtime/inspection)"
assert_blocked_overlay "centered-list" "Open Markdown" "$MARKDOWN_BLOCKED" >/dev/null
api_post /overlay/select '{"index":0}' >/dev/null
api_post /overlay/confirm >/dev/null

FINAL_STATE="$(wait_for_window_growth "$WINDOWS_BEFORE")"
FINAL_SNAPSHOT="$(api_get /runtime/inspection)"
assert_unblocked "$FINAL_SNAPSHOT" >/dev/null

STATE_PATH="$ARTIFACT_DIR/${MARKER}.json"
SHOT_PATH="$ARTIFACT_DIR/${MARKER}.txt"
printf '%s\n' "$FINAL_STATE" > "$STATE_PATH"
api_get /screenshot/text > "$SHOT_PATH"

echo "state: $STATE_PATH"
echo "text:  $SHOT_PATH"
echo "tmux attach -t wibwob"
