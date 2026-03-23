#!/usr/bin/env bash
# @name    ghostty-shader
# @desc    Toggle Ghostty custom shaders via scratch/.ghostty-shaders config include
# Usage:   ghostty-shader.sh on [shader] | off | status | list | install
# How:     Writes custom-shader= to scratch/.ghostty-shaders, included via
#          `config-file = ?<path>` — ? means silent no-op when file is absent.

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
SHADER_DIR="$REPO_ROOT/assets/shaders"
ACTIVE_CONFIG="$REPO_ROOT/scratch/.ghostty-shaders"
GHOSTTY_CONFIG="$HOME/Library/Application Support/com.mitchellh.ghostty/config"
[[ -f "$GHOSTTY_CONFIG" ]] || GHOSTTY_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config"

reload()    { osascript -e 'tell application "Ghostty" to activate
                delay 0.3
                tell application "System Events" to tell process "Ghostty" to keystroke "," using {command down, shift down}
              ' 2>/dev/null && echo "✅ Ghostty reloaded" || echo "⚠️  Reload manually: Cmd+Shift+,"; }
list()      { cd "$SHADER_DIR" && basename -s .glsl wibwob-*.glsl 2>/dev/null | tr '\n' ' '; }
has_hook()  { grep -qF "scratch/.ghostty-shaders" "$GHOSTTY_CONFIG" 2>/dev/null; }

case "${1:-help}" in
    on)
        shader="${2:-wibwob-crt}"; glsl="$SHADER_DIR/${shader}.glsl"
        [[ -f "$glsl" ]] || { echo "❌ Unknown shader: $shader  Available: $(list)"; exit 1; }
        printf 'custom-shader = %s\ncustom-shader-animation = true\n' "$glsl" > "$ACTIVE_CONFIG"
        echo "✅ Shader: $shader"; reload ;;
    off)
        [[ -f "$ACTIVE_CONFIG" ]] && rm "$ACTIVE_CONFIG" && echo "✅ Off" && reload || echo "ℹ️  Already off" ;;
    status)
        [[ -f "$ACTIVE_CONFIG" ]] && { echo "🟢 Active"; cat "$ACTIVE_CONFIG"; } || echo "⚫ Inactive"
        has_hook && echo "✅ Hook present" || echo "⚠️  Hook missing — run: $0 install" ;;
    list)    list ;;
    install)
        [[ -f "$GHOSTTY_CONFIG" ]] || { echo "❌ Ghostty config not found: $GHOSTTY_CONFIG"; exit 1; }
        has_hook && { echo "✅ Already installed"; exit 0; }
        grep -q "^custom-shader = disabled" "$GHOSTTY_CONFIG" 2>/dev/null && \
            echo "⚠️  'custom-shader = disabled' found — comment it out or shaders won't load"
        printf '\n# WibWob-DOS: loads shader when active, silent no-op when off\nconfig-file = ?%s\n' "$ACTIVE_CONFIG" >> "$GHOSTTY_CONFIG"
        echo "✅ Installed — reload Ghostty: Cmd+Shift+," ;;
    *)
        echo "Usage: $0 on [shader] | off | status | list | install"
        echo "Shaders: $(list)" ;;
esac
