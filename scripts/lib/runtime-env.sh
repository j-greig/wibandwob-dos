#!/usr/bin/env bash

WW_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
_ww_detect_port() {
  # Read port from runtime control manifest (written by last instance to start)
  local manifest="$WW_ROOT_DIR/.wibwob/runtime/control-manifest.json"
  if [[ -f "$manifest" ]]; then
    local port
    port=$(python3 -c "import json; print(json.load(open('$manifest')).get('apiPort',''))" 2>/dev/null)
    if [[ -n "$port" ]] && curl -sf --max-time 0.5 "http://127.0.0.1:${port}/health" &>/dev/null; then
      printf '%s' "$port"
      return
    fi
  fi
  # Fallback: env var or default
  printf '%s' "${CONTROL_API_PORT:-8099}"
}

if [[ -n "${WIBWOB_API:-}" ]]; then
  WW_DEFAULT_API="$WIBWOB_API"
elif [[ -n "${WW_API:-}" ]]; then
  WW_DEFAULT_API="$WW_API"
else
  WW_DEFAULT_API="http://127.0.0.1:$(_ww_detect_port)"
fi

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
