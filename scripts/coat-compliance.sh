#!/usr/bin/env bash
# scripts/coat-compliance.sh — COAT smoke test
#
# POSTs every registered command via the HTTP API and reports which ones error.
# Proves the API surface exists and responds — not that apps work correctly.
# For deeper per-app verification, write app-specific tests.
#
# Usage: scripts/coat-compliance.sh [--port N]
# Exit:  0=all commands reachable, 1=some errored, 2=no instance

set -eo pipefail

PORT="${WIBWOB_PORT:-8099}"
BASE_URL="http://127.0.0.1:${PORT}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --port) PORT="$2"; BASE_URL="http://127.0.0.1:${PORT}"; shift 2 ;;
    *)      shift ;;
  esac
done

api()      { curl -sf --max-time 5 "${BASE_URL}$1" 2>/dev/null; }
api_post() { curl -s -o /dev/null -w "%{http_code}" --max-time 8 \
               -X POST -H "Content-Type: application/json" \
               -d "$2" "${BASE_URL}$1" 2>/dev/null; }

# ── Health ────────────────────────────────────────────────────────────────────

health=$(api /health) || { echo "EXIT 2: no instance on port ${PORT}"; exit 2; }
INSTANCE=$(echo "$health" | jq -r '.label // "unknown"')
echo "COAT smoke — ${INSTANCE}  port:${PORT}  $(date -u +%H:%M:%SZ)"
echo ""

# ── POST every command ────────────────────────────────────────────────────────

cmds=$(api /commands/list) || { echo "❌ cannot fetch /commands/list"; exit 2; }
total=0; errors=0; skipped=0
errored=()

while IFS= read -r cmd; do
  id=$(echo "$cmd" | jq -r '.id')

  # Skip session-breaking commands only
  case "$id" in
    app.quit|*.shutdown) skipped=$((skipped+1)); continue ;;
  esac

  status=$(api_post /commands/run "{\"id\":\"${id}\"}")
  total=$((total+1))

  if [[ "$status" -ge 500 ]]; then
    echo "  ❌  $id  → HTTP $status"
    errored+=("$id")
    errors=$((errors+1))
  else
    echo "  ✅  $id  → HTTP $status"
  fi

done < <(echo "$cmds" | jq -c '.commands[]')

# ── Report ────────────────────────────────────────────────────────────────────

echo ""
echo "──────────────────────────────────────────"
echo "${total} commands  |  ${errors} errors  |  ${skipped} skipped"

if [[ "$errors" -gt 0 ]]; then
  echo ""
  echo "Errored commands:"
  printf '  %s\n' "${errored[@]}"
  echo ""
  echo "EXIT: 1"
  exit 1
fi

echo "EXIT: 0  ✅"
