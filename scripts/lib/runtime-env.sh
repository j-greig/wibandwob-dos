#!/usr/bin/env bash

WW_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WW_DEFAULT_API="${WIBWOB_API:-${WW_API:-http://127.0.0.1:${CONTROL_API_PORT:-8099}}}"

ww_api_base() {
  printf '%s\n' "$WW_DEFAULT_API"
}

ww_health_json() {
  curl -sf "$(ww_api_base)/health"
}

ww_state_json() {
  curl -sf "$(ww_api_base)/state"
}

ww_runtime_inspection_json() {
  curl -sf "$(ww_api_base)/runtime/inspection"
}

ww_instance_id() {
  local health_json
  health_json="$(ww_health_json 2>/dev/null || true)"
  if [[ -n "$health_json" ]]; then
    python3 - "$health_json" <<'PY'
import json, sys
print(json.loads(sys.argv[1]).get("instanceId", ""))
PY
    return 0
  fi
  printf '\n'
}

ww_state_app_field() {
  local field="$1"
  local state_json
  state_json="$(ww_state_json 2>/dev/null || true)"
  if [[ -z "$state_json" ]]; then
    return 1
  fi
  python3 - "$field" "$state_json" <<'PY'
import json, sys
field = sys.argv[1]
value = json.loads(sys.argv[2]).get("app", {}).get(field)
if isinstance(value, str):
    print(value)
PY
}

ww_captures_dir() {
  local resolved
  resolved="$(ww_state_app_field capturesDir 2>/dev/null || true)"
  if [[ -n "$resolved" ]]; then
    printf '%s\n' "$resolved"
    return 0
  fi
  printf '%s\n' "$WW_ROOT_DIR/scratch/captures"
}

ww_workspaces_dir() {
  local resolved
  resolved="$(ww_state_app_field workspacesDir 2>/dev/null || true)"
  if [[ -n "$resolved" ]]; then
    printf '%s\n' "$resolved"
    return 0
  fi
  printf '%s\n' "$WW_ROOT_DIR/scratch/workspaces"
}
