#!/usr/bin/env bash
# @desc  Open a new Ghostty window running WibWob-DOS from any repo path or worktree.
#
# Usage:
#   bash open-instance.sh                          # auto-detects: uses $PWD if it looks like wwdos,
#                                                  # else falls back to ~/Repos/wibandwob-dos
#   bash open-instance.sh --path /path/to/wwdos    # explicit path
#   bash open-instance.sh --path ~/Repos/wibandwob-dos-cga-theme
#   bash open-instance.sh --worktree cga-theme     # short name → ~/Repos/wibandwob-dos-{name}
#   bash open-instance.sh --worktree .             # same as --path $PWD
#   bash open-instance.sh --theme wibwob-cga       # set theme after launch
#   bash open-instance.sh --cmd "bun run dev"      # override launch command (default: bun run dev)
#   bash open-instance.sh --no-wait                # don't wait for API health
#
# Examples:
#   bash open-instance.sh --worktree cga-theme --theme wibwob-cga
#   bash open-instance.sh --path ~/Repos/wibandwob-dos --theme wibwob-phosphor
#   bash open-instance.sh                          # quick launch from main repo

set -euo pipefail

# ── Defaults ────────────────────────────────────────────────────────────────
WWDOS_PATH=""
THEME=""
LAUNCH_CMD="bun run dev"
WAIT=true
TIMEOUT=20

# ── Arg parsing ─────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)
      WWDOS_PATH="$(realpath "${2:?--path requires a directory}")"
      shift 2 ;;
    --worktree)
      wt="${2:?--worktree requires a name or .}"
      if [[ "$wt" == "." ]]; then
        WWDOS_PATH="$(pwd)"
      else
        WWDOS_PATH="$HOME/Repos/wibandwob-dos-${wt}"
      fi
      shift 2 ;;
    --theme)
      THEME="${2:?--theme requires a theme name}"
      shift 2 ;;
    --cmd)
      LAUNCH_CMD="${2:?--cmd requires a command}"
      shift 2 ;;
    --no-wait)
      WAIT=false
      shift ;;
    --timeout)
      TIMEOUT="${2:?--timeout requires seconds}"
      shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0" | sed 's/^# \?//'
      exit 0 ;;
    *)
      echo "Unknown option: $1  (try --help)" >&2
      exit 1 ;;
  esac
done

# ── Auto-detect path ─────────────────────────────────────────────────────────
if [[ -z "$WWDOS_PATH" ]]; then
  # If we're already inside a wwdos repo, use it
  if [[ -f "$(pwd)/src/core/theme/resolver.ts" ]]; then
    WWDOS_PATH="$(pwd)"
  elif [[ -d "$HOME/Repos/wibandwob-dos" ]]; then
    WWDOS_PATH="$HOME/Repos/wibandwob-dos"
  else
    echo "❌ Cannot auto-detect a WibWob-DOS repo. Use --path or --worktree." >&2
    exit 1
  fi
fi

# ── Validate ─────────────────────────────────────────────────────────────────
if [[ ! -d "$WWDOS_PATH" ]]; then
  echo "❌ Directory not found: $WWDOS_PATH" >&2
  exit 1
fi

if [[ ! -f "$WWDOS_PATH/package.json" ]]; then
  echo "⚠️  No package.json at $WWDOS_PATH — is this really a WibWob-DOS repo?" >&2
fi

echo "📂 Path:    $WWDOS_PATH"
echo "🚀 Command: $LAUNCH_CMD"
[[ -n "$THEME" ]] && echo "🎨 Theme:   $THEME"

# ── Open new Ghostty window at the path ──────────────────────────────────────
osascript << APPLESCRIPT
tell application "Ghostty"
  activate
  set cfg to new surface configuration
  set initial working directory of cfg to "${WWDOS_PATH}"
  set win to new window with configuration cfg
  delay 1.2
  set t to focused terminal of selected tab of win
  -- Clear any shell prompt noise
  send key "u" modifiers "control" to t
  delay 0.2
  input text "${LAUNCH_CMD}" to t
  send key "enter" to t
end tell
APPLESCRIPT

echo "🪟 New Ghostty window opened"

# ── Wait for API to come up ───────────────────────────────────────────────────
if [[ "$WAIT" == "false" ]]; then
  echo "⏩ Skipping API health wait (--no-wait)"
  exit 0
fi

echo -n "⏳ Waiting for API"

# Find the port — new instance uses next available port after 8099
# Poll all plausible ports (8099–8110) for one that has our cwd
API_URL=""
elapsed=0
while (( elapsed < TIMEOUT )); do
  for port in $(seq 8099 8110); do
    candidate="http://127.0.0.1:${port}"
    cwd_check=$(curl -s --max-time 0.5 "${candidate}/state" 2>/dev/null \
      | python3 -c "import json,sys; s=json.load(sys.stdin); print(s['app']['cwd'])" 2>/dev/null || true)
    if [[ "$cwd_check" == "$WWDOS_PATH" ]]; then
      API_URL="$candidate"
      break 2
    fi
  done
  echo -n "."
  sleep 1
  (( elapsed++ ))
done

echo ""

if [[ -z "$API_URL" ]]; then
  echo "⚠️  API didn't come up within ${TIMEOUT}s — app may still be starting"
  exit 0
fi

echo "✅ API ready at $API_URL"

# ── Set theme if requested ────────────────────────────────────────────────────
if [[ -n "$THEME" ]]; then
  result=$(curl -s -X POST "${API_URL}/commands/run" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"theme.set\",\"args\":{\"name\":\"${THEME}\"}}" 2>/dev/null)
  if echo "$result" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if d.get('ok') else 1)" 2>/dev/null; then
    echo "🎨 Theme set → $THEME"
  else
    echo "⚠️  Theme set failed: $result"
  fi
fi

# ── Report final state ────────────────────────────────────────────────────────
final=$(curl -s "${API_URL}/state" 2>/dev/null)
theme_active=$(echo "$final" | python3 -c "import json,sys; s=json.load(sys.stdin); print(s['app']['theme'])" 2>/dev/null || echo "unknown")
instance=$(echo "$final" | python3 -c "import json,sys; s=json.load(sys.stdin); print(s['app']['instanceId'])" 2>/dev/null || echo "unknown")

echo ""
echo "  instance: $instance"
echo "  port:     ${API_URL##*:}"
echo "  theme:    $theme_active"
echo "  path:     $WWDOS_PATH"
