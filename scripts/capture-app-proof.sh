#!/usr/bin/env bash
# capture-app-proof.sh — robust capture pipeline for WibWob app verification.
#
# Captures BOTH semantic text evidence and system PNG evidence:
#   1) full desktop text (/screenshot/text)
#   2) target window text (/screenshot/text?id=...)
#   3) system PNG(s) via macOS screencapture
#
# Designed for variable screen configs:
#   - single display laptops
#   - multi-display setups
#   - external monitors / iMac large screens
#
# Usage examples:
#   ./scripts/capture-app-proof.sh --target "Scramble"
#   ./scripts/capture-app-proof.sh --window-id 29 --target "Scramble" --display 2
#   ./scripts/capture-app-proof.sh --target "Terrarium Life" --display all
#   ./scripts/capture-app-proof.sh --tmux-session wibwob --tmux-window 0 --tmux-bootstrap --target "Scramble"
#   ./scripts/capture-app-proof.sh --list-displays

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API="${WIBWOB_API:-http://127.0.0.1:8099}"
TARGET=""
WINDOW_ID=""
DISPLAY_MODE="auto" # auto|all|<N>
OUT_DIR=""
OPEN_COMMAND=""
NO_PNG=0
LIST_DISPLAYS=0
TMUX_SESSION="wibwob"
TMUX_WINDOW="0"
TMUX_BOOTSTRAP=0

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --target <title-substring>   Target window title to resolve (required unless --window-id)
  --window-id <id>             Capture specific window id
  --open-command <id>          Run command before capture (e.g. microapp.wibwob.terrarium-life.open)
  --display <auto|all|N>       Which display(s) to capture for PNG (default: auto)
  --out-dir <path>             Output directory (default: scratch/captures/app-proof-<timestamp>)
  --no-png                     Skip system PNG capture (text evidence only)
  --list-displays              Probe and list valid screencapture display indices
  --tmux-session <name>        tmux session to control (default: wibwob)
  --tmux-window <index>        tmux window index to control (default: 0)
  --tmux-bootstrap             Create/start tmux session + app if needed
  -h, --help                   Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="${2:-}"; shift 2 ;;
    --window-id) WINDOW_ID="${2:-}"; shift 2 ;;
    --open-command) OPEN_COMMAND="${2:-}"; shift 2 ;;
    --display) DISPLAY_MODE="${2:-}"; shift 2 ;;
    --out-dir) OUT_DIR="${2:-}"; shift 2 ;;
    --no-png) NO_PNG=1; shift ;;
    --list-displays) LIST_DISPLAYS=1; shift ;;
    --tmux-session) TMUX_SESSION="${2:-}"; shift 2 ;;
    --tmux-window) TMUX_WINDOW="${2:-}"; shift 2 ;;
    --tmux-bootstrap) TMUX_BOOTSTRAP=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

health_check() {
  curl -sf "$API/health" >/dev/null
}

tmux_has_session() {
  tmux has-session -t "$TMUX_SESSION" >/dev/null 2>&1
}

bootstrap_tmux_app() {
  # Create session/window if missing and start app in that pane.
  if ! tmux_has_session; then
    tmux new-session -d -s "$TMUX_SESSION" -x 230 -y 62 "cd '$ROOT_DIR' && bun run start"
    return
  fi

  # Ensure requested window exists.
  if ! tmux list-windows -t "$TMUX_SESSION" | awk -F: '{print $1}' | grep -qx "$TMUX_WINDOW"; then
    tmux new-window -t "$TMUX_SESSION:$TMUX_WINDOW" "cd '$ROOT_DIR' && bun run start"
    return
  fi

  # If window exists but app may be down, start/restart in pane.
  tmux send-keys -t "$TMUX_SESSION:$TMUX_WINDOW" C-c
  sleep 0.1
  tmux send-keys -t "$TMUX_SESSION:$TMUX_WINDOW" "cd '$ROOT_DIR' && bun run start" C-m
}

wait_health() {
  local i
  for i in {1..60}; do
    if health_check; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

probe_displays() {
  # Probe screencapture display indices by trial.
  # macOS screencapture accepts 1-based display indices for -D.
  local tmp
  tmp="$(mktemp -t wwdos-display-probe.XXXXXX).png"
  local valid=()
  local i
  for i in {1..8}; do
    if screencapture -x -D "$i" "$tmp" >/dev/null 2>&1; then
      valid+=("$i")
    fi
  done
  rm -f "$tmp"
  printf '%s\n' "${valid[@]}"
}

if [[ "$TMUX_BOOTSTRAP" -eq 1 ]]; then
  bootstrap_tmux_app
  if ! wait_health; then
    echo "API did not become healthy after tmux bootstrap" >&2
    exit 1
  fi
fi

if [[ "$LIST_DISPLAYS" -eq 1 ]]; then
  if ! health_check; then
    echo "API unreachable at $API" >&2
    exit 1
  fi
  echo "Valid display indices:"
  probe_displays | awk '{print "  - "$0}'
  exit 0
fi

if ! health_check; then
  echo "API unreachable at $API (use --tmux-bootstrap for controlled startup)" >&2
  exit 1
fi

if [[ -n "$OPEN_COMMAND" ]]; then
  curl -sf "$API/commands/run" -X POST -H 'Content-Type: application/json' \
    -d "{\"command\":\"$OPEN_COMMAND\"}" >/dev/null || true
  sleep 0.4
fi

if [[ -z "$WINDOW_ID" ]]; then
  if [[ -z "$TARGET" ]]; then
    echo "Provide --window-id or --target" >&2
    exit 1
  fi
  WINDOW_ID="$(curl -sf "$API/state" | python3 -c '
import sys, json
state = json.load(sys.stdin)
q = sys.argv[1].lower()
for w in state.get("windows", []):
    if q in (w.get("title") or "").lower():
        print(w["id"])
        break
' "$TARGET" || true)"
  if [[ -z "$WINDOW_ID" ]]; then
    echo "Could not resolve target window for: $TARGET" >&2
    exit 1
  fi
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR="scratch/captures/app-proof-$STAMP"
fi
mkdir -p "$OUT_DIR/text"

FULL_TEXT="$OUT_DIR/text/full.txt"
WINDOW_TEXT="$OUT_DIR/text/window-$WINDOW_ID.txt"
MANIFEST="$OUT_DIR/manifest.json"

# 1) Full desktop semantic text
curl -sf "$API/screenshot/text" > "$FULL_TEXT"

# 2) Window semantic text
curl -sf "$API/screenshot/text?id=$WINDOW_ID" > "$WINDOW_TEXT"

# Verify target evidence exists in captures (if target provided)
VERIFY_RESULT="ok"
VERIFY_NOTE="window text captured"
if [[ -n "$TARGET" ]]; then
  if ! grep -qi -- "$TARGET" "$WINDOW_TEXT" && ! grep -qi -- "$TARGET" "$FULL_TEXT"; then
    VERIFY_RESULT="warn"
    VERIFY_NOTE="target title not found in text captures"
  fi
fi

PNG_FILES=()
if [[ "$NO_PNG" -eq 0 ]]; then
  if [[ "$DISPLAY_MODE" == "auto" || "$DISPLAY_MODE" == "all" ]]; then
    DISP_RAW="$(probe_displays || true)"
    if [[ -z "$DISP_RAW" ]]; then
      VERIFY_RESULT="warn"
      VERIFY_NOTE="$VERIFY_NOTE; no valid displays probed"
    else
      while IFS= read -r d; do
        [[ -z "$d" ]] && continue
        p="$OUT_DIR/display-$d.png"
        if screencapture -x -D "$d" "$p" >/dev/null 2>&1; then
          PNG_FILES+=("$p")
        fi
      done <<EOF
$DISP_RAW
EOF
    fi
  else
    p="$OUT_DIR/display-$DISPLAY_MODE.png"
    if screencapture -x -D "$DISPLAY_MODE" "$p" >/dev/null 2>&1; then
      PNG_FILES+=("$p")
    else
      VERIFY_RESULT="warn"
      VERIFY_NOTE="$VERIFY_NOTE; display $DISPLAY_MODE capture failed"
    fi
  fi
fi

STATE_JSON="$OUT_DIR/state.json"
curl -sf "$API/state" > "$STATE_JSON"

TMUX_PANE_TEXT="$OUT_DIR/text/tmux-pane-${TMUX_SESSION}-${TMUX_WINDOW}.txt"
if tmux_has_session; then
  tmux capture-pane -p -t "$TMUX_SESSION:$TMUX_WINDOW" > "$TMUX_PANE_TEXT" || true
else
  : > "$TMUX_PANE_TEXT"
fi

PNG_JSON="$(printf '%s\n' "${PNG_FILES[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')"

python3 - <<PY
import json
from datetime import datetime
manifest = {
  "createdAt": datetime.now().isoformat(timespec="seconds"),
  "api": "$API",
  "target": "$TARGET",
  "windowId": int("$WINDOW_ID"),
  "verify": {"result": "$VERIFY_RESULT", "note": "$VERIFY_NOTE"},
  "tmux": {
    "session": "$TMUX_SESSION",
    "window": "$TMUX_WINDOW",
    "bootstrap": bool(int("$TMUX_BOOTSTRAP")),
  },
  "files": {
    "fullText": "$FULL_TEXT",
    "windowText": "$WINDOW_TEXT",
    "tmuxPaneText": "$TMUX_PANE_TEXT",
    "state": "$STATE_JSON",
    "png": json.loads('''$PNG_JSON'''),
  },
  "displayMode": "$DISPLAY_MODE",
}
with open("$MANIFEST", "w") as f:
    json.dump(manifest, f, indent=2)
PY

echo "Capture complete"
echo "  out: $OUT_DIR"
echo "  window: $WINDOW_ID"
echo "  full text: $FULL_TEXT"
echo "  window text: $WINDOW_TEXT"
echo "  tmux pane text: $TMUX_PANE_TEXT"
if [[ ${#PNG_FILES[@]} -gt 0 ]]; then
  echo "  pngs:"; printf '    - %s\n' "${PNG_FILES[@]}"
else
  echo "  pngs: none"
fi
echo "  manifest: $MANIFEST"
