#!/usr/bin/env bash
set -euo pipefail

# Generic responsive gate:
# check-responsive-sizes.sh <stage> <command_id> <title_regex> <signal_regex> [mode_field]
# stage: default|medium|fullscreen|all

STAGE="${1:-all}"
CMD_ID="${2:-microapp.wibwob.layout-stress-test-pi.open}"
TITLE_REGEX="${3:-Layout Stress Test \(Pi\)}"
SIGNAL_REGEX="${4:-layout|stress|pi}"
MODE_FIELD="${5:-mode}"   # set empty to disable mode checks

MEDIUM_WIDTH="${RESPONSIVE_MEDIUM_WIDTH:-90}"
MEDIUM_HEIGHT="${RESPONSIVE_MEDIUM_HEIGHT:-24}"
FULL_MIN_WIDTH="${RESPONSIVE_FULL_MIN_WIDTH:-90}"
FULL_MIN_HEIGHT="${RESPONSIVE_FULL_MIN_HEIGHT:-20}"
DEFAULT_MIN_WIDTH="${RESPONSIVE_DEFAULT_MIN_WIDTH:-40}"
DEFAULT_MIN_HEIGHT="${RESPONSIVE_DEFAULT_MIN_HEIGHT:-10}"

api_base() {
  local port
  port=$(wibwob health --json | jq -r '.port // 8099')
  printf 'http://127.0.0.1:%s' "$port"
}

open_target() {
  wibwob cmd "$CMD_ID" >/dev/null
  sleep 0.2
  wibwob state | jq -r --arg re "$TITLE_REGEX" '[.windows[] | select(.title | test($re))][-1].id // empty'
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
  wibwob state | jq -c --argjson id "$id" '.windows[] | select(.id == $id) | .details'
}

extract_mode() {
  local details="$1"
  if [[ -z "$MODE_FIELD" ]]; then
    echo ""
    return
  fi
  jq -r --arg k "$MODE_FIELD" '.[$k] // empty' <<<"$details"
}

require_signal() {
  curl -sS "$(api_base)/screenshot/text" | grep -Eiq "$SIGNAL_REGEX"
}

assert_default() {
  local id details mode ww wh expected
  id=$(open_target)
  [[ -n "$id" ]] || { echo "no target window" >&2; return 1; }
  details=$(window_details "$id")
  mode=$(extract_mode "$details")
  ww=$(jq -r '.windowWidth // 0' <<<"$details")
  wh=$(jq -r '.windowHeight // 0' <<<"$details")

  (( ww >= DEFAULT_MIN_WIDTH && wh >= DEFAULT_MIN_HEIGHT )) || {
    echo "default window too small: ${ww}x${wh}" >&2; return 1;
  }

  if [[ -n "$mode" ]]; then
    expected=$(mode_from_width "$ww")
    [[ "$mode" =~ ^(lg|md|sm)$ ]] || { echo "invalid mode:$mode" >&2; return 1; }
    [[ "$mode" == "$expected" ]] || { echo "default mode mismatch mode=$mode expected=$expected ww=$ww" >&2; return 1; }
  fi

  require_signal || { echo "missing screenshot signal on default" >&2; return 1; }
  echo "PASS default mode=${mode:-n/a} size=${ww}x${wh} id=$id"
}

assert_medium() {
  local id details mode ww wh
  id=$(open_target)
  [[ -n "$id" ]] || { echo "no target window" >&2; return 1; }
  wibwob cmd window.resize --id "$id" --width "$MEDIUM_WIDTH" --height "$MEDIUM_HEIGHT" >/dev/null
  sleep 0.2
  details=$(window_details "$id")
  mode=$(extract_mode "$details")
  ww=$(jq -r '.windowWidth // 0' <<<"$details")
  wh=$(jq -r '.windowHeight // 0' <<<"$details")

  (( ww >= 60 )) || { echo "medium width too small:${ww}" >&2; return 1; }
  if [[ -n "$mode" ]]; then
    [[ "$mode" == "md" ]] || { echo "expected md after medium resize, got $mode (${ww}x${wh})" >&2; return 1; }
  fi
  require_signal || { echo "missing screenshot signal on medium" >&2; return 1; }
  echo "PASS medium mode=${mode:-n/a} size=${ww}x${wh} id=$id"
}

assert_fullscreen() {
  local id details mode ww wh expected
  id=$(open_target)
  [[ -n "$id" ]] || { echo "no target window" >&2; return 1; }
  wibwob cmd window.toggle_maximize --windowId "$id" >/dev/null
  sleep 0.2
  details=$(window_details "$id")
  mode=$(extract_mode "$details")
  ww=$(jq -r '.windowWidth // 0' <<<"$details")
  wh=$(jq -r '.windowHeight // 0' <<<"$details")

  if [[ -n "$mode" ]]; then
    expected=$(mode_from_width "$ww")
    [[ "$mode" == "$expected" ]] || { echo "fullscreen mode mismatch mode=$mode expected=$expected ww=$ww" >&2; return 1; }
  fi

  (( ww >= FULL_MIN_WIDTH && wh >= FULL_MIN_HEIGHT )) || {
    echo "fullscreen size too small:${ww}x${wh}" >&2; return 1;
  }
  require_signal || { echo "missing screenshot signal on fullscreen" >&2; return 1; }
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
    echo "usage: $0 [default|medium|fullscreen|all] [command_id] [title_regex] [signal_regex] [mode_field]" >&2
    exit 2
    ;;
esac
