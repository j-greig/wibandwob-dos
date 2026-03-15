#!/usr/bin/env bash
# @name    reload-microapp
# @desc    Close → reload code → reopen a microapp (solves reload ≠ reopen)
# reload-microapp.sh — Close, reload, and reopen a microapp window.
#
# Solves the "reload ≠ reopen" confusion: microapps.reload refreshes
# command registrations but does NOT close/reopen existing windows.
# This script does the full cycle.
#
# Usage:
#   bash scripts/reload-microapp.sh wibwob.journal
#   bash scripts/reload-microapp.sh wibwob.figlet --args '{"text":"HI"}'
#
# Steps:
#   1. Find open windows with matching appType → close them
#   2. Call microapps.reload to refresh code
#   3. Reopen via microapp.<id>.open

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/runtime-env.sh"

MICROAPP_ID="${1:?Usage: reload-microapp.sh <microapp-id> [--args JSON]}"
shift
ARGS="{}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --args) ARGS="$2"; shift 2 ;;
    *)      shift ;;
  esac
done

API="$(ww_api_base)"
OPEN_CMD="microapp.${MICROAPP_ID}.open"

# ── Check API is alive ──────────────────────────────────────────────
if ! curl -sf --max-time 2 "${API}/health" >/dev/null 2>&1; then
  echo "✗ API not responding on ${API}" >&2
  exit 1
fi

# ── Close matching windows ──────────────────────────────────────────
WINDOW_IDS=$(curl -sf "${API}/state" | python3 -c "
import json, sys
state = json.load(sys.stdin)
for w in state.get('windows', []):
    if w.get('appType', '') == '${MICROAPP_ID}':
        print(w['id'])
" 2>/dev/null || true)

if [ -n "$WINDOW_IDS" ]; then
  for wid in $WINDOW_IDS; do
    echo "  closing window $wid (${MICROAPP_ID})"
    curl -sf -X POST "${API}/commands/run" \
      -H 'Content-Type: application/json' \
      -d "{\"id\":\"window.close\",\"args\":{\"id\":${wid}}}" >/dev/null
  done
  sleep 0.3
fi

# ── Reload microapps ────────────────────────────────────────────────
echo "  reloading microapps..."
curl -sf -X POST "${API}/commands/run" \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapps.reload"}' >/dev/null
sleep 0.5

# ── Reopen ──────────────────────────────────────────────────────────
echo "  opening ${OPEN_CMD}"
RESULT=$(curl -sf -X POST "${API}/commands/run" \
  -H 'Content-Type: application/json' \
  -d "{\"id\":\"${OPEN_CMD}\",\"args\":${ARGS}}" 2>/dev/null || true)

if echo "$RESULT" | grep -q '"ok":true'; then
  echo "✓ reloaded and reopened ${MICROAPP_ID}"
else
  echo "✗ failed to open: $RESULT" >&2
  exit 1
fi
