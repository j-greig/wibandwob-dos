#!/usr/bin/env bash
# Lightweight hot-reload demo for humans.
# Edits one obvious line in the runtime reload canary, reloads the module,
# and prints the updated window text capture.

set -euo pipefail

API="${WIBWOB_API:-http://127.0.0.1:8099}"
MODULE_ID="runtime.reload-canary"
COMMAND_ID="microapp.runtime.reload-canary.open"
WINDOW_TITLE="Runtime Reload Canary"
FILE="modules/runtime-reload-canary/index.ts"
ORIGINAL_TEXT="greenfield microapp"
UPDATED_TEXT="greenfield microapp reloaded"

cleanup() {
  if [ -f "${FILE}.bak-reload-demo" ]; then
    mv "${FILE}.bak-reload-demo" "$FILE"
    curl -sf -X POST "$API/modules/reload" \
      -H "Content-Type: application/json" \
      -d "{\"id\":\"$MODULE_ID\"}" > /dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "Opening reload canary..."
curl -sf -X POST "$API/commands/run" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$COMMAND_ID\"}" > /dev/null

echo "Changing one visible line in ${FILE}..."
cp "$FILE" "${FILE}.bak-reload-demo"
python3 - <<'PY'
from pathlib import Path
path = Path("modules/runtime-reload-canary/index.ts")
text = path.read_text()
text = text.replace("greenfield microapp", "greenfield microapp reloaded", 1)
path.write_text(text)
PY

echo "Reloading module ${MODULE_ID}..."
curl -sf -X POST "$API/modules/reload" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$MODULE_ID\"}" > /dev/null

echo
echo "Window capture after reload:"
./scripts/screenshot-window.sh "$WINDOW_TITLE"
