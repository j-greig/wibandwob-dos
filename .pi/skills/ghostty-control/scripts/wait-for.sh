#!/usr/bin/env bash
# @desc  Poll until a condition is true. Replaces sleep-and-hope with observe-and-proceed.
#
# Usage:
#   bash wait-for.sh window "Figlet"          # wait until a window title contains "Figlet"
#   bash wait-for.sh no-window "Figlet"       # wait until no window title contains "Figlet"
#   bash wait-for.sh overlay                  # wait until an overlay is active
#   bash wait-for.sh no-overlay               # wait until no overlay is active
#   bash wait-for.sh health                   # wait until wibwob health responds
#   bash wait-for.sh no-health                # wait until instance is down
#   bash wait-for.sh text "OK"               # wait until text appears in screenshot
#   bash wait-for.sh windows-count 3          # wait until exactly 3 windows open
#
# Options:
#   --timeout N   max seconds to wait (default: 10)
set -euo pipefail

CONDITION="${1:?usage: wait-for.sh <condition> [arg] [--timeout N]}"
ARG="${2:-}"
shift; [[ -n "$ARG" ]] && shift

TIMEOUT=10
while [[ $# -gt 0 ]]; do
  case "$1" in
    --timeout) TIMEOUT="$2"; shift 2 ;;
    *)         ARG="$1"; shift ;;
  esac
done

check() {
  case "$CONDITION" in
    window)
      wibwob windows 2>/dev/null | jq -e --arg t "$ARG" '[.[] | select(.title | test($t; "i"))] | length > 0' >/dev/null 2>&1
      ;;
    no-window)
      ! wibwob windows 2>/dev/null | jq -e --arg t "$ARG" '[.[] | select(.title | test($t; "i"))] | length > 0' >/dev/null 2>&1
      ;;
    overlay)
      curl -sf "http://127.0.0.1:$(wibwob health 2>&1 | awk '/^port:/{print $2}')/overlay/info" 2>/dev/null \
        | jq -e '.result.active == true' >/dev/null 2>&1
      ;;
    no-overlay)
      curl -sf "http://127.0.0.1:$(wibwob health 2>&1 | awk '/^port:/{print $2}')/overlay/info" 2>/dev/null \
        | jq -e '.result.active == false' >/dev/null 2>&1
      ;;
    health)
      wibwob health 2>&1 | grep -q "^port:" 2>/dev/null
      ;;
    no-health)
      ! wibwob health 2>&1 | grep -q "^port:" 2>/dev/null
      ;;
    text)
      wibwob screenshot 2>/dev/null | grep -q "$ARG"
      ;;
    windows-count)
      local count
      count=$(wibwob windows 2>/dev/null | jq 'length' 2>/dev/null)
      [[ "${count:-0}" -eq "$ARG" ]]
      ;;
    *)
      echo "unknown condition: $CONDITION" >&2; exit 1
      ;;
  esac
}

for i in $(seq 1 "$((TIMEOUT * 4))"); do
  if check; then
    exit 0
  fi
  sleep 0.25
done

echo "wait-for: timeout after ${TIMEOUT}s waiting for ${CONDITION} ${ARG}" >&2
exit 1
