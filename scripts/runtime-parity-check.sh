#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/runtime-env.sh"
API="$(ww_api_base)"
MARKER="parity-$(date +%s)"
FIGLET_TEXT="RUNTIME ${MARKER}"
EDITOR_TITLE="Runtime Parity ${MARKER}"
EDITOR_INITIAL="runtime parity check ${MARKER}"
ARTIFACT_DIR="$(ww_captures_dir)"
OPENED_STATE=""
OPENED_WINDOW_ID=""

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

extract_new_window_id() {
  local before_json="$1"
  local after_json="$2"
  python3 - "$before_json" "$after_json" <<'PY'
import json, sys
before = json.loads(sys.argv[1])
after = json.loads(sys.argv[2])
before_ids = {w["id"] for w in before.get("windows", [])}
new = [w for w in after.get("windows", []) if w["id"] not in before_ids]
if len(new) != 1:
    raise SystemExit(f"expected exactly one new window, got {len(new)}")
print(new[0]["id"])
PY
}

open_and_capture_id() {
  local path="$1"
  local body="$2"
  local before_json="$3"
  local after_json=""
  local new_count=""
  api_post "$path" "$body" >/dev/null

  for _ in $(seq 1 10); do
    sleep 0.3
    after_json="$(api_get /state 2>/dev/null || true)"
    if [ -z "$after_json" ]; then
      continue
    fi
    new_count="$(python3 - "$before_json" "$after_json" <<'PY'
import json, sys
try:
    before = json.loads(sys.argv[1])
    after = json.loads(sys.argv[2])
except json.JSONDecodeError:
    print("invalid")
    raise SystemExit(0)
before_ids = {w["id"] for w in before.get("windows", [])}
new = [w for w in after.get("windows", []) if w["id"] not in before_ids]
print(len(new))
PY
)"
    if [ "$new_count" = "invalid" ]; then
      continue
    fi
    if [ "$new_count" = "1" ]; then
      OPENED_STATE="$after_json"
      OPENED_WINDOW_ID="$(extract_new_window_id "$before_json" "$after_json")"
      return 0
    fi
  done

  echo "timed out waiting for new window from $path" >&2
  if [ -n "$after_json" ]; then
    printf '%s\n' "$after_json" >&2
  fi
  return 1
}

assert_layout() {
  local state_json="$1"
  local layout_json="$2"
  local figlet_id="$3"
  local editor_id="$4"
  local inspector_id="$5"
  python3 - "$state_json" "$layout_json" "$figlet_id" "$editor_id" "$inspector_id" <<'PY'
import json, sys
state = json.loads(sys.argv[1])
layout = json.loads(sys.argv[2])
expected = {
    int(sys.argv[3]): layout["figlet"],
    int(sys.argv[4]): layout["editor"],
    int(sys.argv[5]): layout["inspector"],
}
windows = {w["id"]: w for w in state.get("windows", [])}
for wid, want in expected.items():
    if wid not in windows:
        raise SystemExit(f"window {wid} missing from /state")
    got = windows[wid]
    for key, value in want.items():
        if int(got.get(key) or 0) != value:
            raise SystemExit(
                f"window {wid} field {key} expected {value} got {got.get(key)}"
            )
print("layout-ok")
PY
}

build_layout() {
  local state_json="$1"
  python3 - "$state_json" <<'PY'
import json, sys
state = json.loads(sys.argv[1])
screen = state.get("screen", {})
screen_w = int(screen.get("width") or 180)
screen_h = int(screen.get("height") or 48)

left_margin = 4
right_margin = 4
gutter = 4
top_margin = 3

right_width = max(58, min(76, screen_w // 2 - 12))
left_width = max(72, screen_w - left_margin - right_margin - gutter - right_width)
figlet_top = top_margin
figlet_height = min(12, max(10, screen_h // 4))
editor_top = figlet_top + figlet_height + 2
editor_height = max(14, min(18, screen_h - editor_top - 6))
inspector_top = 6
inspector_height = max(18, min(26, screen_h - inspector_top - 6))
inspector_left = left_margin + left_width + gutter

layout = {
    "figlet": {
        "left": left_margin,
        "top": figlet_top,
        "width": left_width,
        "height": figlet_height,
    },
    "editor": {
        "left": left_margin + 2,
        "top": editor_top,
        "width": left_width,
        "height": editor_height,
    },
    "inspector": {
        "left": inspector_left,
        "top": inspector_top,
        "width": right_width,
        "height": inspector_height,
    },
}
print(json.dumps(layout))
PY
}

assert_runtime_snapshot() {
  local snapshot_json="$1"
  python3 - "$snapshot_json" <<'PY'
import json, sys
payload = json.loads(sys.argv[1])
snapshot = payload.get("snapshot", {})
ui = snapshot.get("ui", {})
menu = ui.get("menu", {})
overlay = ui.get("overlay")
state = snapshot.get("state", {})
stats = snapshot.get("stats", {})

if payload.get("ok") is not True:
    raise SystemExit("runtime inspection did not report ok=true")
if menu.get("open") not in (False, None):
    raise SystemExit(f"expected menu to be closed, got {menu!r}")
if overlay is not None:
    raise SystemExit(f"expected no active overlay, got {overlay!r}")
if len(state.get("windows", [])) < 3:
    raise SystemExit("runtime inspection reported fewer than 3 windows")
if "render" not in stats:
    raise SystemExit("runtime inspection missing render stats")
print("runtime-inspection-ok")
PY
}

echo "=== Runtime parity check ==="
api_get "/health" >/dev/null
echo "API healthy: $API"

api_post "/commands/run" '{"id":"desktop.clear-all","args":{"all":true}}' >/dev/null
sleep 0.3

mkdir -p "$ARTIFACT_DIR"

FIGLET_BODY="$(python3 - "$FIGLET_TEXT" <<'PY'
import json, sys
print(json.dumps({"text": sys.argv[1]}))
PY
)"
STATE_BEFORE="$(api_get /state)"
LAYOUT_JSON="$(build_layout "$STATE_BEFORE")"
open_and_capture_id "/view/figlet/open-default" "$FIGLET_BODY" "$STATE_BEFORE"
FIGLET_ID="$OPENED_WINDOW_ID"
STATE_AFTER="$OPENED_STATE"
STATE_BEFORE="$STATE_AFTER"

EDITOR_BODY="$(python3 - "$EDITOR_TITLE" "$EDITOR_INITIAL" <<'PY'
import json, sys
print(json.dumps({"title": sys.argv[1], "initial": sys.argv[2]}))
PY
)"
open_and_capture_id "/view/editor/open" "$EDITOR_BODY" "$STATE_BEFORE"
EDITOR_ID="$OPENED_WINDOW_ID"
STATE_AFTER="$OPENED_STATE"
STATE_BEFORE="$STATE_AFTER"

open_and_capture_id "/view/inspector/open" '{}' "$STATE_BEFORE"
INSPECTOR_ID="$OPENED_WINDOW_ID"
STATE_AFTER="$OPENED_STATE"

BATCH_BODY="$(python3 - "$LAYOUT_JSON" "$FIGLET_ID" "$EDITOR_ID" "$INSPECTOR_ID" <<'PY'
import json, sys
layout = json.loads(sys.argv[1])
figlet_id, editor_id, inspector_id = map(int, sys.argv[2:5])
print(json.dumps({
    "ops": [
        {"id": figlet_id, **layout["figlet"]},
        {"id": editor_id, **layout["editor"]},
        {"id": inspector_id, **layout["inspector"]},
    ]
}))
PY
)"
api_post "/windows/batch" "$BATCH_BODY" >/dev/null
sleep 0.5

FINAL_STATE="$(api_get /state)"
assert_layout "$FINAL_STATE" "$LAYOUT_JSON" "$FIGLET_ID" "$EDITOR_ID" "$INSPECTOR_ID" >/dev/null
RUNTIME_SNAPSHOT="$(api_get /runtime/inspection)"
assert_runtime_snapshot "$RUNTIME_SNAPSHOT" >/dev/null

STATE_PATH="$ARTIFACT_DIR/runtime-parity-${MARKER}.json"
SHOT_PATH="$ARTIFACT_DIR/runtime-parity-${MARKER}.txt"
printf '%s\n' "$FINAL_STATE" > "$STATE_PATH"
api_get "/screenshot/text" > "$SHOT_PATH"

python3 - "$FINAL_STATE" "$FIGLET_ID" "$EDITOR_ID" "$INSPECTOR_ID" <<'PY'
import json, sys
state = json.loads(sys.argv[1])
targets = {int(v) for v in sys.argv[2:5]}
for w in state.get("windows", []):
    if w["id"] in targets:
        print(f'{w["id"]}: {w["title"]} @{w["left"]},{w["top"]} {w["width"]}x{w["height"]}')
PY

echo "state: $STATE_PATH"
echo "text:  $SHOT_PATH"
echo "tmux attach -t wibwob"
