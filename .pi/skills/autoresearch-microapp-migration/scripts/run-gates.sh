#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-microapps/demo-layout-stress-test-pi}"
COMMAND_ID="${2:-microapp.wibwob.layout-stress-test-pi.open}"
SIGNAL_REGEX="${3:-layout|stress|pi}"
TITLE_REGEX="${4:-Layout Stress Test \\(Pi\\)}"
MODE_FIELD="${5:-mode}"
if [[ -n "${WIBWOB_API_BASE_URL:-}" ]]; then
  API="$WIBWOB_API_BASE_URL"
else
  PORT=$(wibwob health --json 2>/dev/null | jq -r '.port // 8099')
  API="http://127.0.0.1:${PORT}"
fi

echo "[1] typecheck"
bun run typecheck >/dev/null

echo "[2] health"
wibwob health >/dev/null

echo "[3] command discoverable"
wibwob commands -q | grep -F "$COMMAND_ID" >/dev/null

echo "[4] command executes"
wibwob cmd "$COMMAND_ID" >/dev/null

echo "[5] state has windows"
wibwob state | jq -e '.windows | length > 0' >/dev/null

echo "[6] screenshot signal"
curl -sS "$API/screenshot/text" | grep -Eiq "$SIGNAL_REGEX"

echo "[7] responsive default size"
bash .pi/skills/autoresearch-microapp-migration/scripts/check-responsive-sizes.sh default "$COMMAND_ID" "$TITLE_REGEX" "$SIGNAL_REGEX" "$MODE_FIELD" >/dev/null

echo "[8] responsive medium size"
bash .pi/skills/autoresearch-microapp-migration/scripts/check-responsive-sizes.sh medium "$COMMAND_ID" "$TITLE_REGEX" "$SIGNAL_REGEX" "$MODE_FIELD" >/dev/null

echo "[9] responsive fullscreen size"
bash .pi/skills/autoresearch-microapp-migration/scripts/check-responsive-sizes.sh fullscreen "$COMMAND_ID" "$TITLE_REGEX" "$SIGNAL_REGEX" "$MODE_FIELD" >/dev/null

echo "[10] import boundary"
bash .pi/skills/autoresearch-microapp-migration/scripts/check-microapp-imports.sh "$TARGET_DIR" >/dev/null

echo "[11] sdk doc sync"
bash .pi/skills/autoresearch-microapp-migration/scripts/check-sdk-doc-sync.sh >/dev/null

echo "PASS all gates"
