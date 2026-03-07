#!/usr/bin/env bash
# share.sh — post WibWob-DOS TUI screenshot and/or minimap to Discord
#
# Usage:
#   share.sh png               — full TUI as PNG image
#   share.sh png --window-id N — single window as PNG
#   share.sh minimap           — ASCII spatial minimap as code block
#   share.sh both              — minimap text + full PNG image
#
# Required env:
#   DISCORD_WEBHOOK_URL        — Discord webhook URL
#
# Optional env:
#   WIBWOB_API                 — default: http://127.0.0.1:8099
#   DISCORD_MESSAGE            — prepended caption (e.g. "@alice's WibWobWorld")
#   SKILL_DIR                  — set automatically when run via pi skill

set -euo pipefail

SKILL_DIR="${SKILL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
API="${WIBWOB_API:-http://127.0.0.1:8099}"
MODE="${1:-both}"
WINDOW_ID="${WINDOW_WINDOW_ID:-}"  # parsed from --window-id flag below

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --window-id) WINDOW_ID="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ── Validation ────────────────────────────────────────────────────────────────

if [[ -z "${DISCORD_WEBHOOK_URL:-}" ]]; then
  echo "error: DISCORD_WEBHOOK_URL not set" >&2
  echo "  export DISCORD_WEBHOOK_URL='https://discord.com/api/webhooks/...'" >&2
  exit 1
fi

if ! curl -sf "$API/health" > /dev/null 2>&1; then
  echo "error: WibWob-DOS not reachable at $API" >&2
  exit 1
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

INSTANCE=$(curl -sf "$API/health" | python3 -c "
import sys,json; d=json.loads(sys.stdin.read())
label = d.get('instanceLabel') or d.get('sessionId','?')
print(label)" 2>/dev/null || echo "unknown")

CAPTION="${DISCORD_MESSAGE:-WibWob-DOS \`$INSTANCE\`}"

post_minimap() {
  local MAP
  MAP=$(bash "$SKILL_DIR/../../scripts/minimap.sh" 2>/dev/null) || {
    echo "warn: minimap.sh failed, fetching raw state" >&2
    MAP=$(curl -sf "$API/state" | python3 -c "
import sys,json; d=json.loads(sys.stdin.read())
wins=d.get('windows',[])
screen=d.get('screen',{})
print(f\"{screen.get('width','?')}x{screen.get('height','?')} — {len(wins)} windows\")
for w in wins: print(f\"  [{w['id']}] {w['title']} ({w['rect']['w']}x{w['rect']['h']})\")
" 2>/dev/null || echo "(state unavailable)")
  }

  local PAYLOAD
  PAYLOAD=$(python3 -c "
import json, sys
content = sys.argv[1] + '\n\`\`\`\n' + sys.argv[2][:1800] + '\n\`\`\`'
print(json.dumps({'content': content}))
" "$CAPTION" "$MAP")

  curl -sf -X POST \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$DISCORD_WEBHOOK_URL" > /dev/null
  echo "posted: minimap ($INSTANCE)"
}

post_png() {
  local TMP_PNG="/tmp/wibwob-tui-$$.png"
  local TITLE="WibWob-DOS · $INSTANCE"

  local EXTRA_ARGS=()
  [[ -n "$WINDOW_ID" ]] && EXTRA_ARGS+=(--window-id "$WINDOW_ID")

  python3 "$SKILL_DIR/tui-to-png.py" \
    --api "$API" \
    --out "$TMP_PNG" \
    --title "$TITLE" \
    "${EXTRA_ARGS[@]}"

  # Post as file attachment with caption
  curl -sf -X POST \
    -F "payload_json=$(python3 -c "import json; print(json.dumps({'content': '$CAPTION'}))")" \
    -F "file=@${TMP_PNG};type=image/png;filename=wibwob-tui.png" \
    "$DISCORD_WEBHOOK_URL" > /dev/null

  rm -f "$TMP_PNG"
  echo "posted: PNG screenshot ($INSTANCE)"
}

# ── Main ──────────────────────────────────────────────────────────────────────

case "$MODE" in
  minimap)
    post_minimap
    ;;
  png)
    post_png
    ;;
  both)
    post_minimap
    sleep 1
    post_png
    ;;
  *)
    echo "usage: $0 [png|minimap|both] [--window-id N]" >&2
    exit 1
    ;;
esac
