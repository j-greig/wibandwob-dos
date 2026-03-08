#!/usr/bin/env bash
# Stronger hot-reload demo:
# changes title, body text, semantic state, and app-local colors together.

set -euo pipefail

API="${WIBWOB_API:-http://127.0.0.1:8099}"
MODULE_ID="runtime.reload-canary"
COMMAND_ID="microapp.runtime.reload-canary.open"
WINDOW_TITLE="Runtime Reload Canary"
UPDATED_TITLE="Runtime Reload Canary V2"
FILE="modules/runtime-reload-canary/index.ts"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

if ! curl -sf "$API/health" > /dev/null 2>&1; then
  fail "app not running on $API. Start or restart WibWob-DOS first."
fi

if [ "${1:-}" = "--restore" ]; then
  if [ ! -f "${FILE}.bak-reload-demo-v2" ]; then
    fail "no v2 demo backup found to restore"
  fi
  mv "${FILE}.bak-reload-demo-v2" "$FILE"
  curl -sf -X POST "$API/modules/reload" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$MODULE_ID\"}" > /dev/null \
    || fail "failed to restore ${MODULE_ID}"
  echo "Restored runtime reload canary v2 demo changes."
  exit 0
fi

echo "Opening reload canary..."
curl -sf -X POST "$API/commands/run" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$COMMAND_ID\"}" > /dev/null \
  || fail "failed to open runtime reload canary"

echo "Applying v2 demo changes to ${FILE}..."
if [ ! -f "${FILE}.bak-reload-demo-v2" ]; then
  cp "$FILE" "${FILE}.bak-reload-demo-v2"
fi
python3 - <<'PY'
from pathlib import Path
path = Path("modules/runtime-reload-canary/index.ts")
text = path.read_text()
replacements = [
    ('const CANARY_TITLE = "Runtime Reload Canary";', 'const CANARY_TITLE = "Runtime Reload Canary V2";'),
    ('const CANARY_VARIANT = "greenfield";', 'const CANARY_VARIANT = "v2-live";'),
    ('const CANARY_PREVIEW = "runtime reload canary";', 'const CANARY_PREVIEW = "runtime reload canary v2";'),
    ('const CANARY_SUMMARY = "Runtime reload canary — greenfield reload proof.";', 'const CANARY_SUMMARY = "Runtime reload canary — v2 live theme + state proof.";'),
    ('const CANARY_BODY_LINE = "greenfield microapp";', 'const CANARY_BODY_LINE = "v2 hot reload: title, state, and colors";'),
    ('const CANARY_COLOR = "white";', 'const CANARY_COLOR = "black";'),
    ('const CANARY_BACKGROUND = "black";', 'const CANARY_BACKGROUND = "green";'),
    ('const CANARY_ACCENT_COLOR = "black";', 'const CANARY_ACCENT_COLOR = "white";'),
    ('const CANARY_ACCENT_BACKGROUND = "yellow";', 'const CANARY_ACCENT_BACKGROUND = "red";'),
]
for old, new in replacements:
    text = text.replace(old, new, 1)
path.write_text(text)
PY

echo "Reloading module ${MODULE_ID}..."
curl -sf -X POST "$API/modules/reload" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$MODULE_ID\"}" > /dev/null \
  || fail "module reload failed for ${MODULE_ID}"

echo
echo "Window capture after reload:"
./scripts/screenshot-window.sh "$UPDATED_TITLE"
echo
echo "State after reload:"
curl -sf "$API/state" | rg -n 'Runtime Reload Canary V2|runtime\\.reload-canary|v2-live|v2 live theme \\+ state proof|\"color\"|\"background\"' -N
echo
echo "The v2 changes stay visible."
echo "Restore original text with: bash scripts/demo-module-reload-v2.sh --restore"
