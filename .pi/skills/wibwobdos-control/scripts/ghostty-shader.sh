#!/usr/bin/env bash
# @name    ghostty-shader
# @desc    Toggle Ghostty custom shaders + fswatch auto-reload on file change
#
# Usage:
#   ghostty-shader.sh on [shader]   # enable shader (default: wibwob-crt)
#   ghostty-shader.sh off           # disable + stop watcher
#   ghostty-shader.sh watch         # start fswatch watcher for active shader
#   ghostty-shader.sh unwatch       # stop watcher
#   ghostty-shader.sh status        # shader + watcher + Ghostty + wwdos health
#   ghostty-shader.sh list          # list available shaders
#   ghostty-shader.sh install       # one-time: add config-file hook to Ghostty config
#
# Watcher notes:
#   Requires fswatch — brew install fswatch
#   'on' restarts the watcher automatically if it was already running.
#   Each reload line reports wwdos API state so you know if the desktop is live.

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
SHADER_DIR="$REPO_ROOT/assets/shaders"
ACTIVE_CONFIG="$REPO_ROOT/scratch/.ghostty-shaders"
STALE_CONFIG="$REPO_ROOT/.ghostty-shaders"   # old path — migrated on off/install
WATCH_PID_FILE="$REPO_ROOT/scratch/.ghostty-shader-watch.pid"
WATCH_LOG="$REPO_ROOT/scratch/.ghostty-shader-watch.log"

# ── Ghostty config discovery: 1.3+ uses config.ghostty, older uses config, Linux uses XDG ──
GHOSTTY_CONFIG=""
for _candidate in \
    "$HOME/Library/Application Support/com.mitchellh.ghostty/config.ghostty" \
    "$HOME/Library/Application Support/com.mitchellh.ghostty/config" \
    "${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config"; do
    [[ -f "$_candidate" ]] && { GHOSTTY_CONFIG="$_candidate"; break; }
done

# ── Helpers ──────────────────────────────────────────────────────────────────

reload() {
    osascript -e 'tell application "Ghostty" to activate
                  delay 0.3
                  tell application "System Events" to tell process "Ghostty" to keystroke "," using {command down, shift down}
                 ' 2>/dev/null \
        && echo "✅ Ghostty reloaded" \
        || echo "⚠️  Reload manually: Cmd+Shift+,"
}

list() { cd "$SHADER_DIR" && basename -s .glsl wibwob-*.glsl 2>/dev/null | tr '\n' ' '; }

has_hook()       { [[ -n "$GHOSTTY_CONFIG" ]] && grep -qF ".ghostty-shaders" "$GHOSTTY_CONFIG" 2>/dev/null; }
ghostty_running(){ pgrep -xi ghostty > /dev/null 2>&1; }
wwdos_running()  { curl -sf http://127.0.0.1:8099/health > /dev/null 2>&1; }

active_shader_path() {
    [[ -f "$ACTIVE_CONFIG" ]] || return 1
    grep "^custom-shader = " "$ACTIVE_CONFIG" | awk '{print $3}'
}

# Returns 0 if a watcher was running and was killed, 1 if nothing to kill.
kill_watcher() {
    [[ -f "$WATCH_PID_FILE" ]] || return 1
    local pid; pid=$(cat "$WATCH_PID_FILE" 2>/dev/null)
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        pkill -P "$pid" 2>/dev/null || true   # kill fswatch child
        kill    "$pid" 2>/dev/null || true    # kill subshell
    fi
    rm -f "$WATCH_PID_FILE"
    return 0
}

start_watcher() {
    local glsl="$1"
    if ! command -v fswatch >/dev/null 2>&1; then
        echo "❌ fswatch not found — brew install fswatch"
        return 1
    fi
    # Write watcher as a temp script — avoids quoting nightmares in bash -c
    local watch_script; watch_script="$(mktemp /tmp/ghostty-watcher-XXXXXX.sh)"
    cat > "$watch_script" <<WATCHSCRIPT
#!/usr/bin/env bash
fswatch -o "$glsl" | while IFS= read -r _; do
    if ! pgrep -xi ghostty > /dev/null 2>&1; then
        printf '[%s] ⚠️  Ghostty not running — skipping\n' "\$(date +%H:%M:%S)"
        continue
    fi
    osascript -e 'tell application "Ghostty" to activate
                  delay 0.2
                  tell application "System Events" to tell process "Ghostty" to keystroke "," using {command down, shift down}
                 ' 2>/dev/null || true
    wstatus=""
    curl -sf http://127.0.0.1:8099/health > /dev/null 2>&1 && wstatus=" · wwdos ✅" || wstatus=" · wwdos ⚫"
    printf '[%s] 🔄 Reloaded%s\n' "\$(date +%H:%M:%S)" "\$wstatus"
done
WATCHSCRIPT
    chmod +x "$watch_script"
    nohup bash "$watch_script" >> "$WATCH_LOG" 2>&1 &
    local pid=$!
    echo "$pid" > "$WATCH_PID_FILE"
    printf '👁  Watching %s  [PID %s]\n' "$(basename "$glsl")" "$pid"
    printf '   Log: tail -f %s\n' "$WATCH_LOG"
}

watcher_status() {
    if [[ -f "$WATCH_PID_FILE" ]]; then
        local pid; pid=$(cat "$WATCH_PID_FILE" 2>/dev/null)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            printf '👁  Watcher running  [PID %s]\n' "$pid"
        else
            echo "⚠️  Watcher PID stale — run: $0 unwatch"
            rm -f "$WATCH_PID_FILE"
        fi
    else
        echo "⚫ Watcher off  (run: $0 watch)"
    fi
}

# ── Commands ─────────────────────────────────────────────────────────────────

case "${1:-help}" in
    on)
        shader="${2:-wibwob-crt}"; glsl="$SHADER_DIR/${shader}.glsl"
        [[ -f "$glsl" ]] || { echo "❌ Unknown shader: $shader  Available: $(list)"; exit 1; }
        mkdir -p "$(dirname "$ACTIVE_CONFIG")"
        printf 'custom-shader = %s\ncustom-shader-animation = true\n' "$glsl" > "$ACTIVE_CONFIG"
        echo "✅ Shader: $shader"
        # Restart watcher on the new file if it was already running
        was_watching=false
        if kill_watcher; then was_watching=true; fi
        reload
        if $was_watching; then start_watcher "$glsl"; fi
        ;;

    off)
        if kill_watcher; then echo "✅ Watcher stopped"; fi
        # Migrate stale file from old path if present
        [[ -f "$STALE_CONFIG" ]] && rm "$STALE_CONFIG" && echo "🗑  Removed stale config at old path"
        if [[ -f "$ACTIVE_CONFIG" ]]; then
            rm "$ACTIVE_CONFIG" && echo "✅ Shader off" && reload
        else
            echo "ℹ️  Already off"
        fi
        ;;

    watch)
        glsl=$(active_shader_path) || { echo "❌ No active shader — run: $0 on [shader] first"; exit 1; }
        [[ -f "$glsl" ]] || { echo "❌ Shader file not found: $glsl"; exit 1; }
        if kill_watcher; then echo "♻️  Restarting watcher"; fi
        start_watcher "$glsl"
        ;;

    unwatch)
        if kill_watcher; then
            echo "✅ Watcher stopped"
        else
            echo "ℹ️  No watcher running"
        fi
        ;;

    status)
        if [[ -f "$ACTIVE_CONFIG" ]]; then
            echo "🟢 Shader active"
            cat "$ACTIVE_CONFIG"
        else
            echo "⚫ Shader inactive"
        fi
        has_hook       && echo "✅ Config hook present" || echo "⚠️  Hook missing — run: $0 install"
        watcher_status
        ghostty_running && echo "✅ Ghostty running"    || echo "⚫ Ghostty not running"
        wwdos_running   && echo "✅ wwdos API up"       || echo "⚫ wwdos API down"
        ;;

    list)
        list
        ;;

    install)
        [[ -n "$GHOSTTY_CONFIG" ]] || {
            echo "❌ Ghostty config not found. Searched:"
            echo "   ~/Library/Application Support/com.mitchellh.ghostty/config.ghostty  (Ghostty ≥1.3)"
            echo "   ~/Library/Application Support/com.mitchellh.ghostty/config           (Ghostty <1.3)"
            echo "   \${XDG_CONFIG_HOME:-~/.config}/ghostty/config                        (Linux/XDG)"
            echo ""
            echo "Create the file first, or set GHOSTTY_CONFIG= to point at it."
            exit 1
        }
        # Migrate stale hook pointing at old path
        if grep -qF "$STALE_CONFIG" "$GHOSTTY_CONFIG" 2>/dev/null; then
            sed -i.bak "s|${STALE_CONFIG}|${ACTIVE_CONFIG}|g" "$GHOSTTY_CONFIG"
            echo "🔧 Migrated stale hook path → scratch/.ghostty-shaders"
        fi
        has_hook && { echo "✅ Already installed  ($GHOSTTY_CONFIG)"
            echo "   Hook: config-file = ?${ACTIVE_CONFIG}"
            exit 0
        }
        grep -q "^custom-shader = disabled" "$GHOSTTY_CONFIG" 2>/dev/null && \
            echo "⚠️  'custom-shader = disabled' found in config — comment it out or shaders won't load"
        printf '\n# WibWob-DOS: loads shader when active, silent no-op when off\nconfig-file = ?%s\n' "$ACTIVE_CONFIG" >> "$GHOSTTY_CONFIG"
        echo "✅ Installed into $GHOSTTY_CONFIG"
        echo "   Hook: config-file = ?${ACTIVE_CONFIG}"
        echo "   Reload Ghostty: Cmd+Shift+,"
        ;;

    *)
        echo "Usage: $0 on [shader] | off | watch | unwatch | status | list | install"
        echo "Shaders: $(list)"
        ;;
esac
