#!/usr/bin/env bash
# @name    cli-parity-check
# @desc    Verify CLI commands match API surface
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/runtime-env.sh"

API="$(ww_api_base)"
WIBWOB="bun run src/cli/wibwob.ts"
MARKER="cli-parity-$(date +%s)"
TITLE="CLI ${MARKER}"
TARGET_ID=""

cli_json() {
  WW_API="$API" $WIBWOB "$@"
}

cleanup() {
  if [[ -n "$TARGET_ID" ]]; then
    cli_json window "$TARGET_ID" close >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

echo "=== CLI parity check ==="
cli_json health | python3 -c '
import json,sys
payload=json.load(sys.stdin)
assert payload["ok"] is True
assert isinstance(payload["instanceId"], str) and payload["instanceId"]
assert isinstance(payload["requestedPort"], int)
print("health-ok instance=" + payload["instanceId"])
'

cli_json inspection | python3 -c '
import json,sys
payload=json.load(sys.stdin)
snap=payload["snapshot"]
assert payload["ok"] is True
assert isinstance(snap["state"]["app"]["instanceId"], str)
assert isinstance(snap["ui"]["blockers"], list)
print("inspection-ok")
'

cli_json editor.open --title "$TITLE" --initial alpha >/dev/null
sleep 0.3

TARGET_ID="$(curl -sf "$API/state" | python3 -c '
import json,sys
state=json.load(sys.stdin)
title=sys.argv[1]
for window in state.get("windows", []):
    if window.get("title") == title:
        print(window["id"])
        break
' "$TITLE")"

if [[ -z "$TARGET_ID" ]]; then
  echo "CLI window did not appear in /state" >&2
  exit 1
fi

cli_json window "$TARGET_ID" move --left 14 --top 8 >/dev/null
cli_json window "$TARGET_ID" resize --width 48 --height 14 >/dev/null
cli_json window "$TARGET_ID" focus >/dev/null
sleep 0.2

curl -sf "$API/state" | python3 -c '
import json,sys
state=json.load(sys.stdin)
target=int(sys.argv[1])
window=next((w for w in state.get("windows", []) if w["id"] == target), None)
if not window:
    raise SystemExit("window missing after CLI mutations")
assert window["left"] == 14
assert window["top"] == 8
assert window["width"] == 48
assert window["height"] == 14
assert window["focused"] is True
print(f"window-ok id={target}")
' "$TARGET_ID"

cli_json window "$TARGET_ID" close >/dev/null
sleep 0.2

curl -sf "$API/state" | python3 -c '
import json,sys
state=json.load(sys.stdin)
target=int(sys.argv[1])
if any(window["id"] == target for window in state.get("windows", [])):
    raise SystemExit("window still open after CLI close")
print("close-ok")
' "$TARGET_ID"

TARGET_ID=""
echo "tmux attach -t wibwob"
