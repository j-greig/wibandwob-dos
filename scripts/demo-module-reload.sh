#!/usr/bin/env bash
# Lightweight hot-reload demo for humans.
# Edits one obvious line in the runtime reload canary, reloads the module,
# and leaves the changed text visible until you explicitly restore it with
# `bash scripts/demo-module-reload.sh --restore`.

set -euo pipefail

API="${WIBWOB_API:-http://127.0.0.1:8099}"
MODULE_ID="runtime.reload-canary"
COMMAND_ID="microapp.runtime.reload-canary.open"
WINDOW_TITLE="Runtime Reload Canary"
FILE="modules/runtime-reload-canary/index.ts"
ORIGINAL_BODY='const CANARY_BODY_LINE = "greenfield microapp";'
UPDATED_BODY='const CANARY_BODY_LINE = "greenfield microapp reloaded";'

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

if ! curl -sf "$API/health" > /dev/null 2>&1; then
  fail "app not running on $API. Start or restart WibWob-DOS first."
fi

if [ "${1:-}" = "--restore" ]; then
  if [ ! -f "${FILE}.bak-reload-demo" ]; then
    fail "no demo backup found to restore"
  fi
  mv "${FILE}.bak-reload-demo" "$FILE"
  curl -sf -X POST "$API/modules/reload" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$MODULE_ID\"}" > /dev/null \
    || fail "failed to restore ${MODULE_ID}"
  echo "Restored runtime reload canary to original text."
  exit 0
fi

echo "Opening reload canary..."
curl -sf -X POST "$API/commands/run" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$COMMAND_ID\"}" > /dev/null \
  || fail "failed to open runtime reload canary via $COMMAND_ID"

echo "Changing one visible line in ${FILE}..."
if [ ! -f "${FILE}.bak-reload-demo" ]; then
  cp "$FILE" "${FILE}.bak-reload-demo"
fi
python3 - <<'PY'
from pathlib import Path
path = Path("modules/runtime-reload-canary/index.ts")
text = path.read_text()
text = text.replace(
    'const CANARY_BODY_LINE = "greenfield microapp";',
    'const CANARY_BODY_LINE = "greenfield microapp reloaded";',
    1,
)
path.write_text(text)
PY

echo "Reloading module ${MODULE_ID}..."
curl -sf -X POST "$API/modules/reload" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$MODULE_ID\"}" > /dev/null \
  || fail "module reload failed for ${MODULE_ID}"

echo
echo "Window capture after reload:"
./scripts/screenshot-window.sh "$WINDOW_TITLE"
echo
echo "The reloaded text stays visible."
echo "Restore original text with: bash scripts/demo-module-reload.sh --restore"
