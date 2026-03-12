#!/usr/bin/env bash
# detect-wwdos-display.sh — heuristic display detector for the terminal app showing WibWob.
#
# Checks Ghostty, Terminal, iTerm2 front windows (if running), reads window title + position,
# and guesses display index.
#
# Output: JSON summary with candidates and best guess.
#
# Notes:
# - Requires macOS + AppleScript permissions for System Events window position access.
# - Display guess for multi-monitor is heuristic (x split by display-1 width).
# - For definitive proof, still verify by capturing and visually checking output.

set -euo pipefail

have() { command -v "$1" >/dev/null 2>&1; }

probe_displays() {
  local tmp
  tmp="$(mktemp -t wwdos-display-probe.XXXXXX).png"
  local out=()
  local i
  for i in {1..8}; do
    if screencapture -x -D "$i" "$tmp" >/dev/null 2>&1; then
      out+=("$i")
    fi
  done
  rm -f "$tmp"
  printf '%s\n' "${out[@]}"
}

display1_width() {
  local tmp w
  tmp="$(mktemp -t wwdos-d1.XXXXXX).png"
  if screencapture -x -D 1 "$tmp" >/dev/null 2>&1; then
    w=$(sips -g pixelWidth "$tmp" 2>/dev/null | awk '/pixelWidth:/{print $2}')
    rm -f "$tmp"
    echo "${w:-0}"
  else
    rm -f "$tmp"
    echo "0"
  fi
}

is_running() {
  local proc="$1"
  osascript -e "tell application \"System Events\" to (name of processes) contains \"$proc\"" 2>/dev/null | grep -qi true
}

get_pos() {
  local proc="$1"
  osascript -e "tell application \"System Events\" to get position of first window of application process \"$proc\"" 2>/dev/null || true
}

ghostty_title() {
  osascript -e 'tell application "Ghostty" to get name of front window' 2>/dev/null || true
}

terminal_title() {
  osascript -e 'tell application "Terminal" to get name of front window' 2>/dev/null || true
}

iterm_title() {
  osascript -e 'tell application "iTerm2" to get name of current window' 2>/dev/null || true
}

guess_display_from_x() {
  local x="$1" dcount="$2" d1w="$3"
  if [[ "$dcount" -le 1 ]]; then echo 1; return; fi
  if [[ "$x" =~ ^-?[0-9]+$ ]] && [[ "$d1w" -gt 0 ]]; then
    if [[ "$x" -lt "$d1w" ]]; then echo 1; else echo 2; fi
  else
    echo 1
  fi
}

if ! have screencapture; then
  echo '{"ok":false,"error":"screencapture not found"}'
  exit 1
fi

DISP=()
while IFS= read -r d; do
  [[ -n "$d" ]] && DISP+=("$d")
done <<EOF
$(probe_displays)
EOF
DCOUNT=${#DISP[@]}
D1W=$(display1_width)

# candidates
apps=("Ghostty" "Terminal" "iTerm2")
json_items=()
best_app=""
best_display=""

for app in "${apps[@]}"; do
  running=false
  if is_running "$app"; then running=true; fi

  title=""
  pos_raw=""
  x=""
  y=""
  display=""

  if [[ "$running" == true ]]; then
    case "$app" in
      Ghostty) title="$(ghostty_title)" ;;
      Terminal) title="$(terminal_title)" ;;
      iTerm2) title="$(iterm_title)" ;;
    esac

    pos_raw="$(get_pos "$app")"
    if [[ "$pos_raw" =~ ^[[:space:]]*([0-9-]+),[[:space:]]*([0-9-]+)[[:space:]]*$ ]]; then
      x="${BASH_REMATCH[1]}"
      y="${BASH_REMATCH[2]}"
      display="$(guess_display_from_x "$x" "$DCOUNT" "$D1W")"
    fi

    # prefer app whose title mentions wibwob
    if [[ -z "$best_app" ]]; then
      best_app="$app"; best_display="${display:-1}"
    fi
    if echo "$title" | grep -qi 'wibwob'; then
      best_app="$app"; best_display="${display:-1}"
    fi
  fi

  json_items+=("{\"app\":\"$app\",\"running\":$running,\"title\":\"${title//\"/\\\"}\",\"x\":${x:-null},\"y\":${y:-null},\"displayGuess\":${display:-null}}")
done

if [[ -z "$best_display" ]]; then best_display=1; fi

printf '{"ok":true,"displayCount":%s,"displayIds":%s,"display1Width":%s,"bestApp":"%s","bestDisplay":%s,"candidates":[%s]}' \
  "$DCOUNT" \
  "$(printf '%s\n' "${DISP[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')" \
  "$D1W" \
  "$best_app" \
  "$best_display" \
  "$(IFS=,; echo "${json_items[*]}")"
