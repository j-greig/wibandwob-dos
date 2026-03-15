#!/usr/bin/env bash
# WibMux — Ghostty-native tmux replacement for WibWob-DOS
# Uses Ghostty AppleScript API (1.3+). macOS only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SHADER_DIR="$REPO_ROOT/shaders"
ACTIVE_SHADER_CONFIG="$REPO_ROOT/scratch/.ghostty-shaders"
GHOSTTY_CONFIG="$HOME/Library/Application Support/com.mitchellh.ghostty/config"
[[ -f "$GHOSTTY_CONFIG" ]] || GHOSTTY_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config"
WIBWOB_PORT="${WIBWOB_PORT:-8099}"

# State directory for tracking window IDs by label
STATE_DIR="$REPO_ROOT/scratch/.wibmux"
mkdir -p "$STATE_DIR"

# ─── Helpers ─────────────────────────────────────────

die() { echo "ERROR: $*" >&2; exit 1; }

# Save window ID for a label
save_label() {
  local label="$1" win_id="$2"
  echo "$win_id" > "$STATE_DIR/$label.id"
}

# Load window ID for a label
load_label() {
  local label="$1"
  local id_file="$STATE_DIR/$label.id"
  if [[ -f "$id_file" ]]; then
    cat "$id_file"
  fi
}

# Remove label tracking
remove_label() {
  local label="$1"
  rm -f "$STATE_DIR/$label.id"
}

# Check if a window ID still exists in Ghostty
window_exists() {
  local win_id="$1"
  osascript -e "
    tell application \"Ghostty\"
      repeat with w in windows
        if id of w is \"$win_id\" then return true
      end repeat
      return false
    end tell
  " 2>/dev/null | grep -q "true"
}

# Find window by label — first check tracking file, then title match
resolve_window() {
  local label="$1"
  local win_id

  # Check tracked ID first
  win_id=$(load_label "$label")
  if [[ -n "$win_id" ]] && window_exists "$win_id"; then
    echo "$win_id"
    return 0
  fi

  # Fall back to title match
  win_id=$(osascript -e "
    tell application \"Ghostty\"
      repeat with w in windows
        if name of w contains \"$label\" then
          return id of w
        end if
      end repeat
    end tell
  " 2>/dev/null)

  if [[ -n "$win_id" ]]; then
    # Save for future lookups
    save_label "$label" "$win_id"
    echo "$win_id"
    return 0
  fi

  return 1
}

# Get first terminal ID in a window
get_terminal() {
  local win_id="$1"
  osascript -e "
    tell application \"Ghostty\"
      repeat with w in windows
        if id of w is \"$win_id\" then
          return id of first terminal of w
        end if
      end repeat
    end tell
  " 2>/dev/null
}

# ─── Commands ────────────────────────────────────────

cmd_create() {
  local label="" cmd=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --label) label="$2"; shift 2 ;;
      --cmd)   cmd="$2"; shift 2 ;;
      *)       shift ;;
    esac
  done
  [[ -z "$label" ]] && label="wibwob"

  # Default command: run WibWob-DOS
  if [[ -z "$cmd" ]]; then
    cmd="cd $REPO_ROOT && WIBWOB_LABEL=$label bun run dev"
  fi

  local win_id
  win_id=$(osascript <<APPLESCRIPT
tell application "Ghostty"
  set cfg to new surface configuration
  set command of cfg to "/bin/bash"
  set initial input of cfg to "export WIBMUX_LABEL=${label}; ${cmd}" & return
  set initial working directory of cfg to "$REPO_ROOT"
  set newWin to new window with configuration cfg
  return id of newWin
end tell
APPLESCRIPT
  ) || die "Failed to create Ghostty window"

  save_label "$label" "$win_id"
  echo "$win_id"
}

cmd_list() {
  osascript -e '
    tell application "Ghostty"
      set output to ""
      repeat with w in windows
        set wid to id of w
        set wname to name of w
        set output to output & wid & " | " & wname & linefeed
      end repeat
      return output
    end tell
  ' 2>/dev/null
}

cmd_focus() {
  local label="" win_id=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --label) label="$2"; shift 2 ;;
      --id)    win_id="$2"; shift 2 ;;
      *)       shift ;;
    esac
  done

  if [[ -n "$label" ]]; then
    win_id=$(resolve_window "$label") || die "No window found for label: $label"
  fi
  [[ -z "$win_id" ]] && die "Specify --label or --id"

  # Focus terminal (which brings window to front per SDEF)
  local term_id
  term_id=$(get_terminal "$win_id")
  if [[ -n "$term_id" ]]; then
    osascript -e "
      tell application \"Ghostty\"
        repeat with w in windows
          repeat with t in terminals of w
            if id of t is \"$term_id\" then
              focus t
              return true
            end if
          end repeat
        end repeat
        return false
      end tell
    " 2>/dev/null || die "Failed to focus terminal"
  else
    # Fallback: activate window directly
    osascript -e "
      tell application \"Ghostty\"
        repeat with w in windows
          if id of w is \"$win_id\" then
            activate window w
            return true
          end if
        end repeat
        return false
      end tell
    " 2>/dev/null || die "Failed to focus window"
  fi
}

cmd_attach() {
  local label=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --label) label="$2"; shift 2 ;;
      *)       shift ;;
    esac
  done
  [[ -z "$label" ]] && label="wibwob"

  # Check if WibWob API is reachable
  if ! curl -sf "http://127.0.0.1:$WIBWOB_PORT/health" >/dev/null 2>&1; then
    echo "WARN: WibWob API not reachable on port $WIBWOB_PORT"
  fi

  # Find existing window or create new one
  local win_id
  win_id=$(resolve_window "$label") && {
    cmd_focus --id "$win_id"
    echo "Attached to existing window: $win_id"
    return 0
  }

  echo "No existing window found, creating new one..."
  cmd_create --label "$label"
}

cmd_close() {
  local label="" win_id=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --label) label="$2"; shift 2 ;;
      --id)    win_id="$2"; shift 2 ;;
      *)       shift ;;
    esac
  done

  if [[ -n "$label" ]]; then
    win_id=$(resolve_window "$label") || die "No window found for label: $label"
  fi
  [[ -z "$win_id" ]] && die "Specify --label or --id"

  # Send exit to shell, then close window
  local term_id
  term_id=$(get_terminal "$win_id")

  osascript -e "
    tell application \"Ghostty\"
      repeat with w in windows
        if id of w is \"$win_id\" then
          -- send exit to each terminal first
          repeat with t in terminals of w
            try
              input text \"exit\" & return to t
            end try
          end repeat
          delay 0.5
          -- close the window
          close window w
          return true
        end if
      end repeat
      return false
    end tell
  " 2>/dev/null || true  -- best effort

  # Clean up tracking
  [[ -n "$label" ]] && remove_label "$label"
}

cmd_send() {
  local label="" text="" win_id=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --label) label="$2"; shift 2 ;;
      --id)    win_id="$2"; shift 2 ;;
      --text)  text="$2"; shift 2 ;;
      *)       shift ;;
    esac
  done

  if [[ -n "$label" ]]; then
    win_id=$(resolve_window "$label") || die "No window found for label: $label"
  fi
  [[ -z "$win_id" ]] && die "Specify --label or --id"
  [[ -z "$text" ]] && die "Specify --text"

  local term_id
  term_id=$(get_terminal "$win_id")
  [[ -z "$term_id" ]] && die "No terminal found in window $win_id"

  osascript -e "
    tell application \"Ghostty\"
      repeat with w in windows
        repeat with t in terminals of w
          if id of t is \"$term_id\" then
            input text \"$text\" & return to t
            return true
          end if
        end repeat
      end repeat
      return false
    end tell
  " 2>/dev/null || die "Failed to send text to terminal"
}

cmd_read() {
  # Read via WibWob HTTP API, not terminal scraping
  local endpoint="${1:-/screenshot/ansi}"
  curl -sf "http://127.0.0.1:$WIBWOB_PORT$endpoint" 2>/dev/null || die "WibWob API not reachable on port $WIBWOB_PORT"
}

cmd_layout() {
  local file="" tabs=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --file) file="$2"; shift 2 ;;
      --tabs) shift; tabs="$*"; break ;;
      *)      shift ;;
    esac
  done

  if [[ -n "$file" ]]; then
    [[ -f "$file" ]] || die "Layout file not found: $file"
    _apply_layout_file "$file"
  elif [[ -n "$tabs" ]]; then
    _apply_inline_tabs "$tabs"
  else
    die "Specify --file <path> or --tabs <tab specs>"
  fi
}

_apply_layout_file() {
  local file="$1"
  local tab_count
  tab_count=$(python3 -c "import json; d=json.load(open('$file')); print(len(d.get('tabs',[])))" 2>/dev/null)
  [[ -z "$tab_count" || "$tab_count" == "0" ]] && die "No tabs in layout file"

  local first_cmd
  first_cmd=$(python3 -c "import json; d=json.load(open('$file')); print(d['tabs'][0].get('command','bash'))" 2>/dev/null)

  local win_id
  win_id=$(osascript -e "
    tell application \"Ghostty\"
      set cfg to new surface configuration
      set command of cfg to \"/bin/bash\"
      set initial input of cfg to \"$first_cmd\" & return
      set initial working directory of cfg to \"$REPO_ROOT\"
      set newWin to new window with configuration cfg
      return id of newWin
    end tell
  " 2>/dev/null) || die "Failed to create layout window"

  local i=1
  while [[ $i -lt $tab_count ]]; do
    local tab_cmd
    tab_cmd=$(python3 -c "import json; d=json.load(open('$file')); print(d['tabs'][$i].get('command','bash'))" 2>/dev/null)

    osascript -e "
      tell application \"Ghostty\"
        repeat with w in windows
          if id of w is \"$win_id\" then
            set cfg to new surface configuration
            set command of cfg to \"/bin/bash\"
            set initial input of cfg to \"$tab_cmd\" & return
            set initial working directory of cfg to \"$REPO_ROOT\"
            new tab in w with configuration cfg
          end if
        end repeat
      end tell
    " 2>/dev/null || echo "WARN: Failed to create tab $i"

    i=$((i + 1))
  done

  echo "Layout applied: $tab_count tabs from $file"
}

_apply_inline_tabs() {
  local specs=("$@")
  local first=true win_id=""

  for spec in "${specs[@]}"; do
    local name="${spec%%:*}"
    local cmd="${spec#*:}"
    [[ "$name" == "$cmd" ]] && cmd="bash"

    if $first; then
      win_id=$(osascript -e "
        tell application \"Ghostty\"
          set cfg to new surface configuration
          set command of cfg to \"/bin/bash\"
          set initial input of cfg to \"$cmd\" & return
          set initial working directory of cfg to \"$REPO_ROOT\"
          set newWin to new window with configuration cfg
          return id of newWin
        end tell
      " 2>/dev/null) || die "Failed to create layout window"
      first=false
    else
      osascript -e "
        tell application \"Ghostty\"
          repeat with w in windows
            if id of w is \"$win_id\" then
              set cfg to new surface configuration
              set command of cfg to \"/bin/bash\"
              set initial input of cfg to \"$cmd\" & return
              set initial working directory of cfg to \"$REPO_ROOT\"
              new tab in w with configuration cfg
            end if
          end repeat
        end tell
      " 2>/dev/null || echo "WARN: Failed to create tab: $name"
    fi
  done

  echo "Layout applied: ${#specs[@]} tabs"
}

cmd_shader() {
  local name=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --name) name="$2"; shift 2 ;;
      *)      shift ;;
    esac
  done
  [[ -z "$name" ]] && die "Specify --name <shader-name|none>"

  if [[ "$name" == "none" || "$name" == "off" ]]; then
    rm -f "$ACTIVE_SHADER_CONFIG"
  else
    local glsl=""
    if [[ -f "$SHADER_DIR/${name}.glsl" ]]; then
      glsl="$SHADER_DIR/${name}.glsl"
    elif [[ -f "$SHADER_DIR/${name}-overlay.glsl" ]]; then
      glsl="$SHADER_DIR/${name}-overlay.glsl"
    else
      die "Shader not found: $name (looked in $SHADER_DIR)"
    fi

    cat > "$ACTIVE_SHADER_CONFIG" <<EOF
# WibMux shader config (auto-generated)
custom-shader = ${glsl}
custom-shader-animation = always
EOF
  fi

  # Reload via AppleScript action (no keystroke hack)
  osascript -e '
    tell application "Ghostty"
      set t to first terminal of front window
      perform action "reload_config" on t
    end tell
  ' 2>/dev/null || die "Failed to reload Ghostty config"
}

cmd_shader_list() {
  [[ -d "$SHADER_DIR" ]] || die "Shader directory not found: $SHADER_DIR"
  for f in "$SHADER_DIR"/*.glsl; do
    [[ -f "$f" ]] && basename "$f" .glsl
  done
}

cmd_help() {
  cat <<EOF
wibmux — Ghostty-native tmux replacement for WibWob-DOS

COMMANDS:
  create   [--label NAME] [--cmd CMD]     Open a new Ghostty window
  list                                     List Ghostty windows
  focus    --label NAME | --id ID          Focus a window
  attach   [--label NAME]                  Reconnect to a WibWob instance
  close    --label NAME | --id ID          Close a window
  send     --label NAME --text TEXT        Send text to a terminal
  read     [endpoint]                      Read via WibWob API
  layout   --file FILE | --tabs SPECS      Apply a project layout
  shader   --name NAME|none                Hot-swap Ghostty shader
  shader-list                              List available shaders
  help                                     Show this help
EOF
}

# ─── Dispatch ────────────────────────────────────────

case "${1:-help}" in
  create)      shift; cmd_create "$@" ;;
  list)        cmd_list ;;
  focus)       shift; cmd_focus "$@" ;;
  attach)      shift; cmd_attach "$@" ;;
  close)       shift; cmd_close "$@" ;;
  send)        shift; cmd_send "$@" ;;
  read)        shift; cmd_read "$@" ;;
  layout)      shift; cmd_layout "$@" ;;
  shader)      shift; cmd_shader "$@" ;;
  shader-list) cmd_shader_list ;;
  help|--help|-h) cmd_help ;;
  *)           die "Unknown command: $1. Run 'wibmux help' for usage." ;;
esac
