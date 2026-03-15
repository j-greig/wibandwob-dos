#!/usr/bin/env bash
# WibMux — Ghostty-native tmux replacement for WibWob-DOS
# Uses Ghostty AppleScript API (1.3+). macOS only.
set -euo pipefail
SELF="$0"
[[ -L "$SELF" ]] && SELF="$(readlink "$SELF")"
SCRIPT_DIR="$(cd "$(dirname "$SELF")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SHADER_DIR="$REPO_ROOT/shaders"
# Ghostty config includes this path (from main repo, not worktree)
ACTIVE_SHADER_CONFIG="$HOME/Repos/wibandwob-dos/scratch/.ghostty-shaders"
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
  # No default command — just opens a shell
  local win_id
  if [[ -n "$cmd" ]]; then
    win_id=$(osascript <<APPLESCRIPT
tell application "Ghostty"
  set cfg to new surface configuration
  set initial input of cfg to "${cmd}" & return
  set initial working directory of cfg to "$REPO_ROOT"
  set newWin to new window with configuration cfg
  return id of newWin
end tell
APPLESCRIPT
    ) || die "Failed to create Ghostty window"
  else
    win_id=$(osascript <<APPLESCRIPT
tell application "Ghostty"
  set newWin to new window
  return id of newWin
end tell
APPLESCRIPT
    ) || die "Failed to create Ghostty window"
  fi
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
cmd_focus_index() {
  local idx="$1"
  local win_id
  win_id=$(osascript -e "
    tell application \"Ghostty\"
      set wList to every window
      if (count of wList) > $idx then
        set w to item $((idx + 1)) of wList
        set t to first terminal of w
        focus t
        return id of w
      end if
    end tell
  " 2>/dev/null)
  [[ -z "$win_id" ]] && die "No window at index $idx"
  echo "$win_id"
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
# ─── Status Bar — tmux-style bottom row ──────────────
# Reserves the last line of YOUR terminal via ANSI scroll region.
# Shows: [0] zilla* [1] logs [2] dev     shader:none api●
# Must be run INSIDE the terminal where you want the bar.

cmd_bar() {
  local action="${1:-on}"
  case "$action" in
    on)  _bar_enable ;;
    off) _bar_disable ;;
    *)   die "bar on|off" ;;
  esac
}

_bar_ttysize() {
  # Get real terminal size from the tty, same as tmux's TIOCGWINSZ
  local _r _c
  if read -r _r _c < <(stty size </dev/tty 2>/dev/null); then
    BAR_ROWS=$_r; BAR_COLS=$_c
  else
    BAR_ROWS=${LINES:-24}; BAR_COLS=${COLUMNS:-80}
  fi
}

_bar_paint() {
  _bar_ttysize
  local rows=$BAR_ROWS
  local cols=$BAR_COLS

  # Build window list: [0] name* [1] name ...
  local win_list=""
  local idx=0
  local front_id
  front_id=$(osascript -e 'tell application "Ghostty" to return id of front window' 2>/dev/null || echo "")

  while IFS='|' read -r wid wname; do
    wid=$(echo "$wid" | xargs)
    wname=$(echo "$wname" | xargs)
    [[ -z "$wid" ]] && continue
    local marker=""
    [[ "$wid" == "$front_id" ]] && marker="*"
    win_list="${win_list}[${idx}] ${wname}${marker}  "
    idx=$((idx + 1))
  done < <(osascript -e '
    tell application "Ghostty"
      set output to ""
      repeat with w in windows
        set output to output & (id of w) & "|" & (name of w) & linefeed
      end repeat
      return output
    end tell
  ' 2>/dev/null)

  # Right side: shader + api status
  local shader_name="none"
  if [[ -f "$ACTIVE_SHADER_CONFIG" ]]; then
    shader_name=$(grep "^custom-shader" "$ACTIVE_SHADER_CONFIG" 2>/dev/null | sed 's|.*/||;s|\.glsl||' || echo "none")
  fi
  local api_dot="○"
  curl -sf "http://127.0.0.1:$WIBWOB_PORT/health" >/dev/null 2>&1 && api_dot="●"

  local right="shader:${shader_name} api${api_dot}"
  local left="$win_list"

  # Trim left if too long
  local right_len=${#right}
  local max_left=$(( cols - right_len - 3 ))
  (( ${#left} > max_left )) && left="${left:0:$max_left}"

  local gap=$(( cols - ${#left} - right_len - 1 ))
  (( gap < 1 )) && gap=1

  # Paint: save cursor → jump to last row → draw → restore
  # All output to /dev/tty so it hits the real terminal
  {
    printf '\033[s'
    printf "\033[${rows};1H"
    printf '\033[0;30;42m'  # black on green (tmux default)
    printf '%s' "$left"
    printf "%${gap}s" ""
    printf '%s' "$right"
    printf '\033[0m'
    printf '\033[u'
  } >/dev/tty
}

_bar_enable() {
  # Kill any existing bar first
  local pid_file="$STATE_DIR/.bar.pid"
  [[ -f "$pid_file" ]] && kill "$(cat "$pid_file")" 2>/dev/null || true
  rm -f "$pid_file"

  _bar_ttysize
  local rows=$BAR_ROWS

  # Reset scroll region to full, clear last 2 rows (clean up any old bar)
  {
    printf "\033[1;${rows}r"
    printf "\033[$((rows - 1));1H\033[2K"
    printf "\033[${rows};1H\033[2K"
  } >/dev/tty

  # Now set scroll region to reserve just the last row
  printf "\033[1;$((rows - 1))r" >/dev/tty
  # Move cursor into the scroll region
  printf "\033[$((rows - 1));1H" >/dev/tty

  _bar_paint

  # Background refresh
  local pid_file="$STATE_DIR/.bar.pid"
  [[ -f "$pid_file" ]] && kill "$(cat "$pid_file")" 2>/dev/null || true

  (
    trap 'exit 0' TERM INT
    while true; do
      sleep 2
      _bar_paint
    done
  ) &
  echo $! > "$pid_file"
  disown
}

_bar_disable() {
  local pid_file="$STATE_DIR/.bar.pid"
  [[ -f "$pid_file" ]] && kill "$(cat "$pid_file")" 2>/dev/null || true
  rm -f "$pid_file"

  _bar_ttysize
  local rows=$BAR_ROWS
  # Restore full scroll region + clear the bar row
  {
    printf "\033[1;${rows}r"
    printf "\033[${rows};1H\033[2K"
    printf '\033[u'
  } >/dev/tty
}
# ─── GUI Automation (System Events) ─────────────────
# Navigate Ghostty's menus, click items, simulate human interaction
cmd_menu() {
  local action="${1:-list}"
  shift || true
  case "$action" in
    list)  _menu_list "$@" ;;
    click) _menu_click "$@" ;;
    *)     die "menu: list|click" ;;
  esac
}
_menu_list() {
  # List all menu bar items and their sub-items
  local menu_name="${1:-}"
  if [[ -z "$menu_name" ]]; then
    # List top-level menu bar items
    osascript <<'AS'
tell application "Ghostty" to activate
delay 0.2
tell application "System Events"
  tell process "Ghostty"
    set menuNames to {}
    repeat with m in menu bar items of menu bar 1
      set end of menuNames to name of m
    end repeat
    return menuNames
  end tell
end tell
AS
  else
    # List items in a specific menu
    osascript <<AS
tell application "Ghostty" to activate
delay 0.2
tell application "System Events"
  tell process "Ghostty"
    set itemNames to {}
    try
      set targetMenu to menu 1 of menu bar item "$menu_name" of menu bar 1
      repeat with mi in menu items of targetMenu
        set itemName to name of mi
        if itemName is not missing value then
          set end of itemNames to itemName
        end if
      end repeat
    end try
    return itemNames
  end tell
end tell
AS
  fi
}
_menu_click() {
  # Click a menu item: wibmux menu click "File" "New Window"
  local menu_bar_item="${1:-}" menu_item="${2:-}"
  [[ -z "$menu_bar_item" ]] && die "Usage: wibmux menu click <menu> <item>"
  [[ -z "$menu_item" ]] && die "Usage: wibmux menu click <menu> <item>"
  osascript <<AS
tell application "Ghostty" to activate
delay 0.2
tell application "System Events"
  tell process "Ghostty"
    try
      click menu item "$menu_item" of menu 1 of menu bar item "$menu_bar_item" of menu bar 1
      return true
    on error errMsg
      return "ERROR: " & errMsg
    end try
  end tell
end tell
AS
}
# Navigate nested submenus: wibmux menu deep "View" "Tab Overview"
cmd_click() {
  # Convenience alias: wibmux click <x> <y> (click at screen coordinates)
  local x="${1:-}" y="${2:-}"
  [[ -z "$x" || -z "$y" ]] && die "Usage: wibmux click <x> <y>"
  osascript <<AS
tell application "Ghostty" to activate
delay 0.2
tell application "System Events"
  click at {$x, $y}
end tell
AS
}
# Keystroke simulation — send arbitrary keyboard shortcuts
cmd_key() {
  # wibmux key "n" "command"        → Cmd+N
  # wibmux key "t" "command"        → Cmd+T (new tab)
  # wibmux key "," "command,shift"  → Cmd+Shift+, (reload config)
  local key="${1:-}" mods="${2:-}"
  [[ -z "$key" ]] && die "Usage: wibmux key <key> [modifiers]"
  local mod_clause=""
  if [[ -n "$mods" ]]; then
    # Convert "command,shift" → "command down, shift down"
    local mod_list=""
    IFS=',' read -ra mod_arr <<< "$mods"
    for m in "${mod_arr[@]}"; do
      m=$(echo "$m" | xargs)  # trim
      [[ -n "$mod_list" ]] && mod_list="$mod_list, "
      mod_list="${mod_list}${m} down"
    done
    mod_clause=" using {${mod_list}}"
  fi
  osascript <<AS
tell application "Ghostty" to activate
delay 0.2
tell application "System Events"
  tell process "Ghostty"
    keystroke "$key"$mod_clause
  end tell
end tell
AS
}
# ─── Window Inspector ────────────────────────────────
# Detailed info about Ghostty windows (tabs, terminals, working dirs)
cmd_inspect() {
  local win_id="${1:-}"
  if [[ -z "$win_id" ]]; then
    # Inspect all windows
    osascript <<'AS'
tell application "Ghostty"
  set output to ""
  repeat with w in windows
    set output to output & "window: " & (id of w) & "  title: " & (name of w) & linefeed
    repeat with tb in tabs of w
      set output to output & "  tab: " & (id of tb) & "  title: " & (name of tb) & "  selected: " & (selected of tb) & linefeed
      repeat with t in terminals of tb
        set tdir to ""
        try
          set tdir to working directory of t
        end try
        set output to output & "    terminal: " & (id of t) & "  title: " & (name of t) & "  cwd: " & tdir & linefeed
      end repeat
    end repeat
  end repeat
  return output
end tell
AS
  else
    # Inspect specific window
    osascript <<AS
tell application "Ghostty"
  repeat with w in windows
    if id of w is "$win_id" then
      set output to "window: " & (id of w) & "  title: " & (name of w) & linefeed
      repeat with tb in tabs of w
        set output to output & "  tab: " & (id of tb) & "  title: " & (name of tb) & "  selected: " & (selected of tb) & linefeed
        repeat with t in terminals of tb
          set tdir to ""
          try
            set tdir to working directory of t
          end try
          set output to output & "    terminal: " & (id of t) & "  title: " & (name of t) & "  cwd: " & tdir & linefeed
        end repeat
      end repeat
      return output
    end if
  end repeat
end tell
AS
  fi
}
# ─── Splits (panes within same window) ───────────────

cmd_split() {
  local dir="${1:-right}" cmd="${2:-}"

  # Validate direction
  case "$dir" in
    right|left|down|up) ;;
    h|horizontal) dir="right" ;;
    v|vertical) dir="down" ;;
    *) die "split direction: right|left|down|up (or h|v)" ;;
  esac

  if [[ -n "$cmd" ]]; then
    osascript <<AS
tell application "Ghostty"
  set t to first terminal of front window
  set cfg to new surface configuration
  set initial input of cfg to "$cmd" & return
  set newT to split t direction $dir with configuration cfg
  return id of newT
end tell
AS
  else
    osascript <<AS
tell application "Ghostty"
  set t to first terminal of front window
  set newT to split t direction $dir
  return id of newT
end tell
AS
  fi
}

# Set up tmux-like workspace: [L][R] on top, [BAR] on bottom
cmd_workspace() {
  # All in one AppleScript — split down, shrink, split top left/right
  local bar_term
  bar_term=$(osascript <<'AS'
tell application "Ghostty"
  set topT to first terminal of front window

  -- split down to create bar pane
  set barT to split topT direction down

  -- shrink bar to 1 row
  repeat 500 times
    perform action "resize_split:up,1" on barT
  end repeat

  -- focus back to top pane, split left/right
  focus topT
  delay 0.3
  split topT direction right

  return id of barT
end tell
AS
  ) || die "Failed to create workspace"

  # Paint the bar
  sleep 0.5
  _workspace_paint_bar "$bar_term"
  echo "$bar_term" > "$STATE_DIR/.bar-term"
}

_workspace_paint_bar() {
  local bar_id="$1"
  # Write a tiny bar script
  local bar_script="$STATE_DIR/bar-loop.sh"
  cat > "$bar_script" <<'BARSCRIPT'
#!/bin/bash
tput civis 2>/dev/null  # hide cursor
while true; do
  cols=$(tput cols 2>/dev/null || echo 80)
  wins=$(wmux ls 2>/dev/null | while IFS='|' read -r id name; do
    name=$(echo "$name" | xargs)
    printf "[%s] " "$name"
  done)
  printf "\r\033[42;30m %-${cols}s\033[0m" "$wins"
  sleep 2
done
BARSCRIPT
  chmod +x "$bar_script"

  # Send the bar script to the bar terminal
  osascript -e "
    tell application \"Ghostty\"
      repeat with t in terminals of front window
        if id of t is \"$bar_id\" then
          input text \"bash $bar_script\" & return to t
          return true
        end if
      end repeat
    end tell
  " 2>/dev/null
}

# Move focus between splits
cmd_pane() {
  local action="${1:-next}"
  case "$action" in
    next) osascript -e '
      tell application "Ghostty"
        set t to first terminal of front window
        perform action "goto_split:next" on t
      end tell
    ' 2>/dev/null ;;
    prev) osascript -e '
      tell application "Ghostty"
        set t to first terminal of front window
        perform action "goto_split:previous" on t
      end tell
    ' 2>/dev/null ;;
    *) die "pane: next|prev" ;;
  esac
}

cmd_help() {
  cat <<EOF
wibmux — Ghostty-native tmux replacement for WibWob-DOS
SESSION:
  create   [--label NAME] [--cmd CMD]     Open a new Ghostty window
  list                                     List Ghostty windows
  focus    --label NAME | --id ID          Focus a window
  attach   [--label NAME]                  Reconnect to a WibWob instance
  close    --label NAME | --id ID          Close a window
  inspect  [window-id]                     Deep inspect windows/tabs/terminals
INPUT:
  send     --label NAME --text TEXT        Send text to a terminal
  read     [endpoint]                      Read via WibWob API
WORKSPACE:
  workspace                                tmux-style: [L][R] + bar at bottom
  ws                                       alias for workspace

SPLITS:
  split    [right|left|down|up] [cmd]      Split pane (default: right)
  split    h                               Split horizontal (left/right)
  split    v                               Split vertical (top/bottom)
  pane     next|prev                       Move focus between panes

LAYOUT:
  layout   --file FILE | --tabs SPECS      Apply a project layout
SHADERS:
  shader   --name NAME|none                Hot-swap Ghostty shader
  shader-list                              List available shaders
STATUS BAR:
  bar on                                   Enable tmux-style status bar
  bar off                                  Disable status bar
  bar update                               Force refresh status bar
GUI AUTOMATION:
  menu list [menu-name]                    List menu bar items (or submenu)
  menu click <menu> <item>                 Click a menu item
  key <key> [modifiers]                    Send keystroke (e.g. key n command)
  click <x> <y>                            Click at screen coordinates
  help                                     Show this help
EOF
}
# ─── Dispatch ────────────────────────────────────────
case "${1:-help}" in
  create)      shift; cmd_create "$@" ;;
  list|ls)     cmd_list ;;
  [0-9])       cmd_focus_index "$1" ;;
  [0-9][0-9])  cmd_focus_index "$1" ;;
  focus)       shift; cmd_focus "$@" ;;
  attach)      shift; cmd_attach "$@" ;;
  close)       shift; cmd_close "$@" ;;
  send)        shift; cmd_send "$@" ;;
  read)        shift; cmd_read "$@" ;;
  layout)      shift; cmd_layout "$@" ;;
  shader)      shift; cmd_shader "$@" ;;
  shader-list) cmd_shader_list ;;
  workspace|ws) shift; cmd_workspace "$@" ;;
  split)       shift; cmd_split "$@" ;;
  pane)        shift; cmd_pane "$@" ;;
  bar)         shift; cmd_bar "$@" ;;
  menu)        shift; cmd_menu "$@" ;;
  key)         shift; cmd_key "$@" ;;
  click)       shift; cmd_click "$@" ;;
  inspect)     shift; cmd_inspect "$@" ;;
  help|--help|-h) cmd_help ;;
  *)           die "Unknown command: $1. Run 'wibmux help' for usage." ;;
esac
