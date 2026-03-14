#!/usr/bin/env bash
# @name    cli-batch-relayout
# @desc    Batch relayout windows via CLI for testing
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="${WIBWOB_SCRIPT_API:-http://127.0.0.1:8099}"

wibwob() {
  WW_API="$API" bun run "$ROOT/src/cli/wibwob.ts" "$@"
}

curl_json() {
  curl -sf "$@"
}

wibwob cmd desktop.clear-all --all true >/dev/null
sleep 1
wibwob cmd figlet.open --text "PIPELINE" --font doom >/dev/null
wibwob cmd editor.new >/dev/null
wibwob cmd microapp.wibwob.runtime-inspector.open >/dev/null
sleep 1

wibwob windows \
  | jq '{
      ops: [
        .[]
        | if (.details.appType // null) == "wibwob.runtime-inspector" then
            { id, left: 96, top: 2, width: 80, height: 28 }
          elif (.details.appType // null) == "text-editor" then
            { id, left: 2, top: 20, width: 90, height: 22 }
          elif (.details.appType // null) == "figlet-banner" then
            { id, left: 2, top: 2, width: 92, height: 16 }
          else
            { id, left: 4, top: 8, width: 80, height: 18 }
          end
      ]
    }' \
  | curl_json -X POST "$API/windows/batch" \
      -H 'Content-Type: application/json' \
      -d @- >/dev/null

sleep 1
wibwob state | jq '[.windows[] | {id, title, left, top, width, height, appType: (.details.appType // null)}]'
echo
wibwob screenshot | tee "$ROOT/scratch/captures/cli-batch-relayout.txt" >/dev/null
echo "Saved text capture: $ROOT/scratch/captures/cli-batch-relayout.txt"
