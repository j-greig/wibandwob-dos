#!/usr/bin/env bash
# Toggle Ghostty custom shaders for WibWob-DOS
#
# Usage:
#   ghostty-shader.sh on [shader]   # Enable shader (default: wibwob-crt)
#   ghostty-shader.sh off           # Disable all wibwob shaders
#   ghostty-shader.sh status        # Show current state
#   ghostty-shader.sh list          # List available shaders
#   ghostty-shader.sh install       # Add config-file include to Ghostty config
#
# Available shaders: wibwob-crt, wibwob-glow, wibwob-nord-tint
#
# How it works:
#   Ghostty's config supports `config-file = ?/path` where ? means
#   "silently ignore if missing". We write a tiny config snippet to
#   scratch/.ghostty-shaders that points to the chosen GLSL file.
#   When removed, the ? prefix means Ghostty just ignores it on reload.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHADER_DIR="$REPO_ROOT/shaders"
ACTIVE_CONFIG="$REPO_ROOT/scratch/.ghostty-shaders"
GHOSTTY_CONFIG="$HOME/Library/Application Support/com.mitchellh.ghostty/config"

# Fallback to XDG path
if [[ ! -f "$GHOSTTY_CONFIG" ]]; then
    GHOSTTY_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config"
fi

cmd_on() {
    local shader="${1:-wibwob-crt}"
    local glsl="$SHADER_DIR/${shader}.glsl"

    if [[ ! -f "$glsl" ]]; then
        echo "❌ Shader not found: $glsl"
        echo "   Available: $(cmd_list)"
        exit 1
    fi

    cat > "$ACTIVE_CONFIG" <<EOF
# WibWob-DOS shader config (auto-generated, do not edit)
# Shader: ${shader}
# Activated: $(date -Iseconds)
custom-shader = ${glsl}
custom-shader-animation = true
EOF

    echo "✅ Shader enabled: ${shader}"
    echo "   Config written to: $ACTIVE_CONFIG"
    echo ""
    cmd_reload
}

cmd_off() {
    if [[ -f "$ACTIVE_CONFIG" ]]; then
        rm "$ACTIVE_CONFIG"
        echo "✅ Shaders disabled (config removed)"
        cmd_reload
    else
        echo "ℹ️  Shaders already disabled"
    fi
}

cmd_status() {
    if [[ -f "$ACTIVE_CONFIG" ]]; then
        echo "🟢 Shaders ACTIVE"
        cat "$ACTIVE_CONFIG"
    else
        echo "⚫ Shaders inactive"
    fi

    echo ""
    # Check if Ghostty config includes us
    if [[ -f "$GHOSTTY_CONFIG" ]]; then
        if grep -q "scratch/.ghostty-shaders" "$GHOSTTY_CONFIG" 2>/dev/null; then
            echo "✅ Ghostty config includes wibwob shader hook"
        else
            echo "⚠️  Ghostty config missing wibwob shader hook"
            echo "   Run: $0 install"
        fi
    else
        echo "⚠️  Ghostty config not found at: $GHOSTTY_CONFIG"
    fi
}

cmd_list() {
    local shaders=()
    for f in "$SHADER_DIR"/wibwob-*.glsl; do
        [[ -f "$f" ]] && shaders+=("$(basename "$f" .glsl)")
    done
    echo "${shaders[*]}"
}

cmd_install() {
    if [[ ! -f "$GHOSTTY_CONFIG" ]]; then
        echo "❌ Ghostty config not found at: $GHOSTTY_CONFIG"
        echo "   Create it first, then re-run install."
        exit 1
    fi

    local include_line="config-file = ?${ACTIVE_CONFIG}"

    if grep -qF "$include_line" "$GHOSTTY_CONFIG" 2>/dev/null; then
        echo "✅ Already installed in Ghostty config"
        return
    fi

    # Append the include
    cat >> "$GHOSTTY_CONFIG" <<EOF

# ─── WibWob-DOS shader integration ───────────────
# Conditionally loads shader config when WibWob-DOS activates it.
# The ? prefix means Ghostty silently ignores this if the file is missing.
${include_line}
EOF

    echo "✅ Installed shader hook in Ghostty config"
    echo "   Added: ${include_line}"
    echo "   Reload Ghostty to pick it up: Cmd+Shift+,"
}

cmd_reload() {
    osascript -e '
      tell application "Ghostty" to activate
      delay 0.3
      tell application "System Events" to tell process "Ghostty" to keystroke "," using {command down, shift down}
    ' 2>/dev/null && echo "✅ Ghostty config reloaded" || echo "⚠️  Could not reload — Cmd+Shift+, or restart Ghostty"
}

case "${1:-help}" in
    on)      cmd_on "${2:-}" ;;
    off)     cmd_off ;;
    status)  cmd_status ;;
    list)    cmd_list ;;
    install) cmd_install ;;
    *)
        echo "Usage: $0 {on [shader]|off|status|list|install}"
        echo ""
        echo "  on [shader]  Enable shader (default: wibwob-crt)"
        echo "  off          Disable shaders"
        echo "  status       Show current state"
        echo "  list         List available shaders"
        echo "  install      Add hook to Ghostty config (one-time setup)"
        echo ""
        echo "Available shaders: $(cmd_list)"
        ;;
esac
