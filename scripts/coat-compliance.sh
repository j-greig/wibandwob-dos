#!/usr/bin/env bash
# scripts/coat-compliance.sh — COAT Runtime Compliance Checker
#
# Collects command execution snapshots, delegates judgment to coat-review.ts.
# No fingerprinting, no skip lists, no jq loops — just HTTP calls and data.
#
# Usage:
#   scripts/coat-compliance.sh [--port N] [--update-baseline]
# Exit: 0=compliant, 1=regressions, 2=no instance

set -eo pipefail

PORT="${WIBWOB_PORT:-8099}"
BASE_URL="http://127.0.0.1:${PORT}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESULTS_FILE="${TMPDIR:-/tmp}/coat-results-$$.json"
UPDATE_BASELINE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --port)            PORT="$2"; BASE_URL="http://127.0.0.1:${PORT}"; shift 2 ;;
    --update-baseline) UPDATE_BASELINE=true; shift ;;
    *)                 shift ;;
  esac
done

api()      { curl -sf --max-time 5 "${BASE_URL}$1" 2>/dev/null; }
api_post() { curl -sf --max-time 8 -X POST -H "Content-Type: application/json" \
               -d "$2" "${BASE_URL}$1" 2>/dev/null; }

state_snapshot() {
  api /state 2>/dev/null | jq -c '{
    windowCount: (.windows | length),
    focusedWindowId: .focusedWindowId,
    windowIds: [.windows[].id],
    windowKinds: [.windows[] | .appType // .kind]
  }' 2>/dev/null || echo "{}"
}

# ── Health check ──────────────────────────────────────────────────────────────

health=$(api /health) || { echo "EXIT 2: no instance on port ${PORT}"; exit 2; }
INSTANCE=$(echo "$health" | jq -r '.label // "unknown"')
CHECKED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "Collecting COAT data — ${INSTANCE}  port:${PORT}  ${CHECKED_AT}"

# ── Capability gap ────────────────────────────────────────────────────────────

G1_OK=false
api /errors/recent &>/dev/null && G1_OK=true

# ── Collect command executions ────────────────────────────────────────────────

cmds=$(api /commands/list) || { echo "❌ cannot fetch /commands/list"; exit 2; }

# Clear desktop once before the run
api_post /commands/run '{"id":"desktop.clear-all"}' &>/dev/null || true
sleep 0.5

echo "[]" > "$RESULTS_FILE"

while IFS= read -r cmd; do
  id=$(echo "$cmd"   | jq -r '.id')
  desc=$(echo "$cmd" | jq -r '.description // ""')

  # Only skip genuinely destructive commands that would break the test session
  case "$id" in
    app.quit|*.shutdown|desktop.clear-all) continue ;;
  esac

  before=$(state_snapshot)
  http_ok=true
  api_post /commands/run "{\"id\":\"${id}\"}" &>/dev/null || http_ok=false
  sleep 0.3
  after=$(state_snapshot)

  # Append result to array
  entry=$(jq -n \
    --arg id "$id" \
    --arg desc "$desc" \
    --argjson http_ok "$http_ok" \
    --argjson before "$before" \
    --argjson after "$after" \
    '{id: $id, description: $desc, http_ok: $http_ok, before: $before, after: $after}')

  tmp=$(jq --argjson e "$entry" '. + [$e]' "$RESULTS_FILE")
  echo "$tmp" > "$RESULTS_FILE"

  echo "  collected $id"
done < <(echo "$cmds" | jq -c '.commands[]')

echo ""
echo "Collected $(jq 'length' "$RESULTS_FILE") commands — running agent review..."
echo ""

# ── Agent review ──────────────────────────────────────────────────────────────

bun "${REPO_ROOT}/scripts/coat-review.ts" \
  --results "$RESULTS_FILE" \
  --baseline "${REPO_ROOT}/coat-compliance.baseline.json" \
  --g1 "$G1_OK" \
  $( [[ "$UPDATE_BASELINE" == true ]] && echo "--update-baseline" )

STATUS=$?
rm -f "$RESULTS_FILE"
exit $STATUS
