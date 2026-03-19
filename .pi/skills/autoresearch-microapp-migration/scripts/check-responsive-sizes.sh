#!/usr/bin/env bash
set -euo pipefail

# Generic responsive gate:
# check-responsive-sizes.sh <stage> <command_id> <title_regex> <signal_regex> [mode_field] [app_type_regex]
# stage: default|medium|fullscreen|all
# Optional instance pinning:
#   WIBWOB_INSTANCE=<label-or-display-id> bash .../check-responsive-sizes.sh ...
# Optional CLI override:
#   WIBWOB_CLI="bun run src/cli/wibwob.ts" bash .../check-responsive-sizes.sh ...

STAGE="${1:-all}"
CMD_ID="${2:-microapp.wibwob.layout-stress-test-pi.open}"
TITLE_REGEX="${3:-Layout Stress Test \(Pi\)}"
SIGNAL_REGEX="${4:-layout|stress|pi}"
MODE_FIELD="${5:-mode}"   # set empty to disable mode checks
APP_TYPE_REGEX="${6:-}"
WIBWOB_INSTANCE_TARGET="${WIBWOB_INSTANCE:-}"

if [[ -n "${WIBWOB_CLI:-}" ]]; then
  # shellcheck disable=SC2206
  WIBWOB_CLI_CMD=(${WIBWOB_CLI})
elif [[ -f "src/cli/wibwob.ts" ]] && command -v bun >/dev/null 2>&1; then
  WIBWOB_CLI_CMD=(bun run src/cli/wibwob.ts)
else
  WIBWOB_CLI_CMD=(wibwob)
fi

wibwob_cmd() {
  if [[ -n "$WIBWOB_INSTANCE_TARGET" ]]; then
    "${WIBWOB_CLI_CMD[@]}" -i "$WIBWOB_INSTANCE_TARGET" "$@"
  else
    "${WIBWOB_CLI_CMD[@]}" "$@"
  fi
}

MEDIUM_WIDTH="${RESPONSIVE_MEDIUM_WIDTH:-90}"
MEDIUM_HEIGHT="${RESPONSIVE_MEDIUM_HEIGHT:-24}"
FULL_MIN_WIDTH="${RESPONSIVE_FULL_MIN_WIDTH:-90}"
FULL_MIN_HEIGHT="${RESPONSIVE_FULL_MIN_HEIGHT:-20}"
DEFAULT_MIN_WIDTH="${RESPONSIVE_DEFAULT_MIN_WIDTH:-40}"
DEFAULT_MIN_HEIGHT="${RESPONSIVE_DEFAULT_MIN_HEIGHT:-10}"
OPEN_RETRIES="${RESPONSIVE_OPEN_RETRIES:-8}"
OPEN_RETRY_SLEEP="${RESPONSIVE_OPEN_RETRY_SLEEP:-0.2}"

if [[ -z "$APP_TYPE_REGEX" ]]; then
  APP_TYPE_REGEX="${CMD_ID}"
  APP_TYPE_REGEX="${APP_TYPE_REGEX#microapp.}"
  APP_TYPE_REGEX="${APP_TYPE_REGEX%.open}"
fi

api_base() {
  local port
  port=$(wibwob_cmd health --json | jq -r '.port // 8099')
  printf 'http://127.0.0.1:%s' "$port"
}

open_target() {
  local id=""
  local attempt=1

  wibwob_cmd cmd "$CMD_ID" >/dev/null
  while (( attempt <= OPEN_RETRIES )); do
    id=$(wibwob_cmd state | jq -r --arg titleRe "$TITLE_REGEX" --arg appRe "$APP_TYPE_REGEX" '[.windows[] | select((.title | test($titleRe)) or ((.appType // "") | test($appRe)) )][-1].id // empty')
    if [[ -n "$id" ]]; then
      echo "$id"
      return 0
    fi
    sleep "$OPEN_RETRY_SLEEP"
    attempt=$((attempt + 1))
  done

  echo ""
}

mode_from_width() {
  local w="$1"
  if (( w >= 100 )); then echo lg
  elif (( w >= 60 )); then echo md
  else echo sm
  fi
}

window_details() {
  local id="$1"
  wibwob_cmd state | jq -c --argjson id "$id" '.windows[] | select(.id == $id)'
}

window_details_stable() {
  local id="$1"
  local attempt=1
  local details=""
  local ww=0

  while (( attempt <= OPEN_RETRIES )); do
    details=$(window_details "$id")
    ww=$(jq -r '.details.windowWidth // .width // 0' <<<"$details")
    if (( ww > 0 )); then
      echo "$details"
      return 0
    fi
    sleep "$OPEN_RETRY_SLEEP"
    attempt=$((attempt + 1))
  done

  echo "$details"
}

extract_mode() {
  local details="$1"
  if [[ -z "$MODE_FIELD" ]]; then
    echo ""
    return
  fi
  jq -r --arg k "$MODE_FIELD" '.details[$k] // .[$k] // empty' <<<"$details"
}

require_signal() {
  local id="$1"
  curl -sS "$(api_base)/screenshot/text?id=${id}" | grep -Eiq "$SIGNAL_REGEX"
}

assert_default() {
  local id details mode ww wh expected
  id=$(open_target)
  [[ -n "$id" ]] || { echo "no target window" >&2; return 1; }
  details=$(window_details_stable "$id")
  mode=$(extract_mode "$details")
  ww=$(jq -r '.details.windowWidth // .width // 0' <<<"$details")
  wh=$(jq -r '.details.windowHeight // .height // 0' <<<"$details")

  (( ww >= DEFAULT_MIN_WIDTH && wh >= DEFAULT_MIN_HEIGHT )) || {
    echo "default window too small: ${ww}x${wh}" >&2; return 1;
  }

  if [[ -n "$mode" ]]; then
    expected=$(mode_from_width "$ww")
    [[ "$mode" =~ ^(lg|md|sm)$ ]] || { echo "invalid mode:$mode" >&2; return 1; }
    [[ "$mode" == "$expected" ]] || { echo "default mode mismatch mode=$mode expected=$expected ww=$ww" >&2; return 1; }
  fi

  require_signal "$id" || { echo "missing screenshot signal on default" >&2; return 1; }
  echo "PASS default mode=${mode:-n/a} size=${ww}x${wh} id=$id"
}

assert_medium() {
  local id details mode ww wh
  id=$(open_target)
  [[ -n "$id" ]] || { echo "no target window" >&2; return 1; }
  wibwob_cmd cmd window.resize --id "$id" --width "$MEDIUM_WIDTH" --height "$MEDIUM_HEIGHT" >/dev/null
  sleep 0.4
  details=$(window_details_stable "$id")
  mode=$(extract_mode "$details")
  ww=$(jq -r '.details.windowWidth // .width // 0' <<<"$details")
  wh=$(jq -r '.details.windowHeight // .height // 0' <<<"$details")

  (( ww >= 60 )) || { echo "medium width too small:${ww}" >&2; return 1; }
  if [[ -n "$mode" ]]; then
    [[ "$mode" == "md" ]] || { echo "expected md after medium resize, got $mode (${ww}x${wh})" >&2; return 1; }
  fi
  require_signal "$id" || { echo "missing screenshot signal on medium" >&2; return 1; }
  echo "PASS medium mode=${mode:-n/a} size=${ww}x${wh} id=$id"
}

assert_fullscreen() {
  local id details mode ww wh expected
  id=$(open_target)
  [[ -n "$id" ]] || { echo "no target window" >&2; return 1; }
  wibwob_cmd cmd window.toggle_maximize --id "$id" >/dev/null
  sleep 0.4
  details=$(window_details_stable "$id")
  mode=$(extract_mode "$details")
  ww=$(jq -r '.details.windowWidth // .width // 0' <<<"$details")
  wh=$(jq -r '.details.windowHeight // .height // 0' <<<"$details")

  if [[ -n "$mode" ]]; then
    expected=$(mode_from_width "$ww")
    [[ "$mode" == "$expected" ]] || { echo "fullscreen mode mismatch mode=$mode expected=$expected ww=$ww" >&2; return 1; }
  fi

  (( ww >= FULL_MIN_WIDTH && wh >= FULL_MIN_HEIGHT )) || {
    echo "fullscreen size too small:${ww}x${wh}" >&2; return 1;
  }
  require_signal "$id" || { echo "missing screenshot signal on fullscreen" >&2; return 1; }
  echo "PASS fullscreen mode=${mode:-n/a} size=${ww}x${wh} id=$id"
}

case "$STAGE" in
  default) assert_default ;;
  medium) assert_medium ;;
  fullscreen) assert_fullscreen ;;
  all)
    assert_default
    assert_medium
    assert_fullscreen
    ;;
  *)
    echo "usage: $0 [default|medium|fullscreen|all] [command_id] [title_regex] [signal_regex] [mode_field] [app_type_regex]" >&2
    exit 2
    ;;
esac
