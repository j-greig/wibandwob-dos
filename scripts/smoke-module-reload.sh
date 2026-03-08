#!/usr/bin/env bash
# Text-based runtime reload smoke test.
# Proves reload via a source edit that should appear in:
# - /state semantic content
# - screenshot-window output
# - tmux pane capture

set -euo pipefail

API="${WIBWOB_API:-http://127.0.0.1:8099}"
TMUX_TARGET="${WIBWOB_TMUX_TARGET:-wibwob:0}"
MODULE_ID="runtime.reload-canary"
COMMAND_ID="microapp.runtime.reload-canary.open"
WINDOW_TITLE="Runtime Reload Canary"
FILE="modules/runtime-reload-canary/index.ts"
ORIGINAL_SCREEN_TEXT="greenfield microapp"
RELOADED_SCREEN_TEXT="greenfield microapp reloaded"
ORIGINAL_STATE_TEXT='"variant":"greenfield"'
RELOADED_STATE_TEXT='"variant":"reloaded"'

pass() { printf '  ✓ %s\n' "$1"; }
fail() { printf '  ✗ %s\n' "$1" >&2; exit 1; }
note() { printf '  • %s\n' "$1"; }

cleanup() {
  if [ -f "${FILE}.bak-reload-smoke" ]; then
    mv "${FILE}.bak-reload-smoke" "$FILE"
    curl -sf -X POST "$API/modules/reload" \
      -H "Content-Type: application/json" \
      -d "{\"id\":\"$MODULE_ID\"}" > /dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if ! curl -sf "$API/health" > /dev/null 2>&1; then
  fail "app not running on $API"
fi

note "opening reload canary"
curl -sf -X POST "$API/commands/run" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$COMMAND_ID\"}" > /dev/null

BASE_STATE=$(curl -sf "$API/state")
printf '%s' "$BASE_STATE" | rg -q "$ORIGINAL_STATE_TEXT" \
  || fail "baseline state did not contain $ORIGINAL_STATE_TEXT"
pass "baseline state contains original canary marker"

BASE_SCREENSHOT=$(./scripts/screenshot-window.sh "$WINDOW_TITLE")
printf '%s' "$BASE_SCREENSHOT" | rg -q "$ORIGINAL_SCREEN_TEXT" \
  || fail "baseline screenshot did not contain '$ORIGINAL_SCREEN_TEXT'"
pass "baseline screenshot contains original canary text"

cp "$FILE" "${FILE}.bak-reload-smoke"
perl -0pi -e "s/\Q$ORIGINAL_SCREEN_TEXT\E/$RELOADED_SCREEN_TEXT/; s/\Qvariant: \"greenfield\"\E/variant: \"reloaded\"/; s/\QcontentPreview: \"runtime reload canary\"\E/contentPreview: \"runtime reload canary reloaded\"/" "$FILE"

note "reloading module after source edit"
curl -sf -X POST "$API/modules/reload" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$MODULE_ID\"}" > /dev/null

HEALTH=$(curl -sf "$API/health")
printf '%s' "$HEALTH" | rg -q '"ok":true' || fail "health failed after reload"
pass "health survived reload"

STATE=$(curl -sf "$API/state")
printf '%s' "$STATE" | rg -q "$RELOADED_STATE_TEXT" \
  || fail "state did not update to $RELOADED_STATE_TEXT"
pass "state reflects reloaded canary marker"

SCREENSHOT=$(./scripts/screenshot-window.sh "$WINDOW_TITLE")
printf '%s' "$SCREENSHOT" | rg -q "$RELOADED_SCREEN_TEXT" \
  || fail "window screenshot did not update to '$RELOADED_SCREEN_TEXT'"
pass "window screenshot reflects reloaded canary text"

PANE=$(tmux capture-pane -pt "$TMUX_TARGET")
printf '%s' "$PANE" | rg -q "$RELOADED_SCREEN_TEXT" \
  || fail "tmux pane capture did not update to '$RELOADED_SCREEN_TEXT'"
pass "tmux pane capture reflects reloaded canary text"

note "reload smoke passed"
